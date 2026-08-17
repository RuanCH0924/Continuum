/**
 * 续言数据存储层（WorksStore）。
 *
 * 存储模型（与《技术路线评估与迁移方案》§5 语义对齐）：
 *   <root>/works/<workId>/meta.json            作品元数据
 *   <root>/works/<workId>/chapters/<seq>_<slug>.md   章节正文（纯 Markdown）
 *   <root>/works/<workId>/chapters/index.json  章节标题索引
 *   <root>/settings.json                       全局设置
 *
 * 说明：M1 以 JSON + Markdown 文件实现，接口设计为可替换实现——
 * P2 引入 SQLite（RAG/检索）时仅替换本类内部实现，IPC 与渲染层不变。
 */

import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import type {
  Chapter,
  ChapterMeta,
  ChapterOutline,
  DeleteNotesResult,
  MindMap,
  Note,
  NoteDeleteLogEntry,
  NoteKind,
  NoteListOptions,
  OutlineNode,
  Settings,
  TimelineEntry,
  VersionSnapshot,
  Volume,
  WorkMeta
} from '../../shared/types'

function slugify(text: string): string {
  const cleaned = (text || '').replace(/[^\w\u4e00-\u9fff-]/g, '').trim()
  return (cleaned || 'untitled').slice(0, 20)
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

/** 存储层统一接口（IPC 契约的落点）：文件实现与 SQLite 实现均实现本接口，可互换。 */
export interface IWorksStore {
  listWorks(): WorkMeta[]
  getWork(id: string): WorkMeta | null
  worksDirOf(workId: string): string
  createWork(title: string, description?: string): WorkMeta
  renameWork(id: string, title: string): boolean
  deleteWork(id: string): boolean
  listChapters(workId: string): ChapterMeta[]
  getChapter(workId: string, seq: number): ChapterMeta | null
  createChapter(workId: string, title: string, content?: string): Chapter
  saveChapter(workId: string, seq: number, title: string, content: string): Chapter
  renameChapter(workId: string, seq: number, title: string): Chapter | null
  readChapter(meta: ChapterMeta): string
  deleteChapter(workId: string, seq: number): boolean
  listVolumes(workId: string): Volume[]
  getVolume(workId: string, id: string): Volume | null
  createVolume(workId: string, title: string): Volume
  renameVolume(workId: string, id: string, title: string): boolean
  deleteVolume(workId: string, id: string): boolean
  reorderVolumes(workId: string, orderedIds: string[]): boolean
  setVolumeChapters(workId: string, id: string, chapterSeqs: number[]): boolean
  listTimeline(workId: string): TimelineEntry[]
  saveTimelineEntry(workId: string, entry: TimelineEntry): TimelineEntry
  deleteTimelineEntry(workId: string, id: string): boolean
  reorderTimeline(workId: string, orderedIds: string[]): boolean
  listOutlineNodes(workId: string): OutlineNode[]
  saveOutlineNode(workId: string, node: OutlineNode): OutlineNode
  /** 级联删除节点及其全部子节点 */
  deleteOutlineNode(workId: string, id: string): boolean
  /** 按传入 id 顺序重排某父节点下的子节点（order 归一化为下标） */
  reorderOutlineNodes(workId: string, parentId: string | null, orderedIds: string[]): boolean
  listChapterOutlines(workId: string): ChapterOutline[]
  saveChapterOutline(workId: string, outline: ChapterOutline): ChapterOutline
  deleteChapterOutline(workId: string, chapterSeq: number): boolean
  getMindMap(workId: string): MindMap | null
  saveMindMap(workId: string, map: MindMap): MindMap
  listNotes(workId: string, kind?: NoteKind, opts?: NoteListOptions): Note[]
  saveNote(workId: string, note: Note): Note
  /** 删除单个知识实体（批量删除的便捷入口，同样留存日志）。 */
  deleteNote(workId: string, id: string): boolean
  /** 批量删除知识实体：留存删除操作日志（含数据快照），返回实际删除/未找到与日志。 */
  deleteNotes(workId: string, ids: string[]): DeleteNotesResult
  /** 删除操作日志（按删除时间倒序，供追溯核验）。 */
  listNoteDeleteLogs(workId: string): NoteDeleteLogEntry[]
  saveVersion(workId: string, seq: number, content: string, note?: string): VersionSnapshot
  listVersions(workId: string, seq: number): VersionSnapshot[]
  readVersion(meta: VersionSnapshot): string
  getSettings(): Settings
  getSetting(key: string, fallback?: unknown): unknown
  setSetting(key: string, value: unknown): void
}

export class WorksStore implements IWorksStore {
  private readonly root: string
  private readonly worksDir: string

  constructor(root: string) {
    this.root = root
    this.worksDir = path.join(root, 'works')
    fs.mkdirSync(this.worksDir, { recursive: true })
  }

  // ============================================================ 作品
  listWorks(): WorkMeta[] {
    if (!fs.existsSync(this.worksDir)) return []
    const result: WorkMeta[] = []
    for (const name of fs.readdirSync(this.worksDir)) {
      const meta = readJson<WorkMeta | null>(
        path.join(this.worksDir, name, 'meta.json'),
        null
      )
      if (meta) result.push(meta)
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getWork(id: string): WorkMeta | null {
    return this.listWorks().find((w) => w.id === id) ?? null
  }

  /** 作品数据目录（供 RAG/Embedding 缓存等读写作品级文件）。 */
  worksDirOf(workId: string): string {
    return path.join(this.worksDir, workId)
  }

  createWork(title: string, description = ''): WorkMeta {
    const now = Date.now()
    const meta: WorkMeta = {
      id: `work_${now}_${randomUUID().slice(0, 6)}`,
      title,
      description,
      createdAt: now,
      updatedAt: now
    }
    const dir = path.join(this.worksDir, meta.id, 'chapters')
    fs.mkdirSync(dir, { recursive: true })
    writeJson(path.join(this.worksDir, meta.id, 'meta.json'), meta)
    return meta
  }

  renameWork(id: string, title: string): boolean {
    const meta = this.getWork(id)
    if (!meta) return false
    meta.title = title
    meta.updatedAt = Date.now()
    writeJson(path.join(this.worksDir, id, 'meta.json'), meta)
    return true
  }

  deleteWork(id: string): boolean {
    const dir = path.join(this.worksDir, id)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      return true
    }
    return false
  }
  private touchWork(id: string): void {
    const meta = this.getWork(id)
    if (meta) {
      meta.updatedAt = Date.now()
      writeJson(path.join(this.worksDir, id, 'meta.json'), meta)
    }
  }

  // ============================================================ 章节
  private chaptersDir(workId: string): string {
    return path.join(this.worksDir, workId, 'chapters')
  }

  private chaptersIndex(workId: string): Record<string, string> {
    return readJson<Record<string, string>>(
      path.join(this.chaptersDir(workId), 'index.json'),
      {}
    )
  }

  private saveChaptersIndex(workId: string, index: Record<string, string>): void {
    writeJson(path.join(this.chaptersDir(workId), 'index.json'), index)
  }

  listChapters(workId: string): ChapterMeta[] {
    const dir = this.chaptersDir(workId)
    if (!fs.existsSync(dir)) return []
    const index = this.chaptersIndex(workId)
    const result: ChapterMeta[] = []
    for (const name of fs.readdirSync(dir)) {
      const match = /^(\d+)_(.+)\.md$/.exec(name)
      if (!match) continue
      const seq = Number(match[1])
      result.push({
        workId,
        seq,
        title: index[String(seq)] ?? match[2],
        file: name
      })
    }
    return result.sort((a, b) => a.seq - b.seq)
  }

  getChapter(workId: string, seq: number): ChapterMeta | null {
    return this.listChapters(workId).find((c) => c.seq === seq) ?? null
  }

  createChapter(workId: string, title: string, content = ''): Chapter {
    const chapters = this.listChapters(workId)
    const seq = chapters.length > 0 ? chapters[chapters.length - 1].seq + 1 : 1
    return this.saveChapter(workId, seq, title, content)
  }

  saveChapter(workId: string, seq: number, title: string, content: string): Chapter {
    const dir = this.chaptersDir(workId)
    fs.mkdirSync(dir, { recursive: true })
    // 移除同序号旧文件（标题变更避免残留）
    for (const name of fs.readdirSync(dir)) {
      if (new RegExp(`^${String(seq).padStart(3, '0')}_.*\\.md$`).test(name)) {
        fs.rmSync(path.join(dir, name), { force: true })
      }
    }
    const file = `${String(seq).padStart(3, '0')}_${slugify(title)}.md`
    fs.writeFileSync(path.join(dir, file), content, 'utf-8')
    // 持久化标题（支持重命名）
    const index = this.chaptersIndex(workId)
    index[String(seq)] = title
    this.saveChaptersIndex(workId, index)
    this.touchWork(workId)
    return { workId, seq, title, file, content }
  }

  /** 仅改标题，保留正文（避免渲染层重命名时覆盖内容）。 */
  renameChapter(workId: string, seq: number, title: string): Chapter | null {
    const meta = this.getChapter(workId, seq)
    if (!meta) return null
    const content = this.readChapter(meta)
    return this.saveChapter(workId, seq, title, content)
  }

  readChapter(meta: ChapterMeta): string {
    try {
      return fs.readFileSync(path.join(this.chaptersDir(meta.workId), meta.file), 'utf-8')
    } catch {
      return ''
    }
  }

  deleteChapter(workId: string, seq: number): boolean {
    const meta = this.getChapter(workId, seq)
    if (!meta) return false
    const file = path.join(this.chaptersDir(workId), meta.file)
    if (fs.existsSync(file)) fs.rmSync(file, { force: true })
    const index = this.chaptersIndex(workId)
    delete index[String(seq)]
    this.saveChaptersIndex(workId, index)
    // 级联清理：从所有卷的章节关联中移除
    const volumes = this.listVolumes(workId)
    for (const v of volumes) {
      if (v.chapterSeqs.includes(seq)) {
        this.setVolumeChapters(workId, v.id, v.chapterSeqs.filter((s) => s !== seq))
      }
    }
    // 级联清理：删除对应章纲（大纲节点与导图保留，由用户手动处理）
    this.deleteChapterOutline(workId, seq)
    this.touchWork(workId)
    return true
  }

  // ============================================================ 卷（章节层级容器）
  private volumesFile(workId: string): string {
    return path.join(this.worksDir, workId, 'volumes.json')
  }

  private readVolumes(workId: string): Volume[] {
    return readJson<Volume[]>(this.volumesFile(workId), [])
  }

  private writeVolumes(workId: string, volumes: Volume[]): void {
    writeJson(this.volumesFile(workId), volumes)
  }

  listVolumes(workId: string): Volume[] {
    return this.readVolumes(workId).sort((a, b) => a.order - b.order)
  }

  getVolume(workId: string, id: string): Volume | null {
    return this.readVolumes(workId).find((v) => v.id === id) ?? null
  }

  createVolume(workId: string, title: string): Volume {
    const volumes = this.readVolumes(workId)
    const now = Date.now()
    const volume: Volume = {
      id: `vol_${now}_${randomUUID().slice(0, 6)}`,
      workId,
      title,
      chapterSeqs: [],
      order: volumes.length > 0 ? Math.max(...volumes.map((v) => v.order)) + 1 : 0,
      createdAt: now,
      updatedAt: now
    }
    volumes.push(volume)
    this.writeVolumes(workId, volumes)
    this.touchWork(workId)
    return volume
  }

  renameVolume(workId: string, id: string, title: string): boolean {
    const volumes = this.readVolumes(workId)
    const v = volumes.find((x) => x.id === id)
    if (!v) return false
    v.title = title
    v.updatedAt = Date.now()
    this.writeVolumes(workId, volumes)
    this.touchWork(workId)
    return true
  }

  // ============================================================ 时间线（剧情时间节点）
  private timelineFile(workId: string): string {
    return path.join(this.worksDir, workId, 'timeline.json')
  }

  private readTimeline(workId: string): TimelineEntry[] {
    return readJson<TimelineEntry[]>(this.timelineFile(workId), [])
  }

  private writeTimeline(workId: string, entries: TimelineEntry[]): void {
    writeJson(this.timelineFile(workId), entries)
  }

  listTimeline(workId: string): TimelineEntry[] {
    return this.readTimeline(workId).sort((a, b) => a.order - b.order)
  }

  /** upsert 时间线条目；id 为空时生成（新建，追加到末尾）。 */
  saveTimelineEntry(workId: string, entry: TimelineEntry): TimelineEntry {
    const entries = this.readTimeline(workId)
    const merged: TimelineEntry = {
      ...entry,
      id: entry.id || `tl_${Date.now()}_${randomUUID().slice(0, 6)}`,
      workId,
      order: entry.id
        ? entry.order
        : entries.length > 0
          ? Math.max(...entries.map((e) => e.order)) + 1
          : 0,
      updatedAt: Date.now(),
      createdAt: entry.id ? entry.createdAt : Date.now()
    }
    const idx = entries.findIndex((e) => e.id === merged.id)
    if (idx >= 0) entries[idx] = merged
    else entries.push(merged)
    this.writeTimeline(workId, entries)
    this.touchWork(workId)
    return merged
  }

  deleteTimelineEntry(workId: string, id: string): boolean {
    const entries = this.readTimeline(workId)
    const next = entries.filter((e) => e.id !== id)
    if (next.length === entries.length) return false
    this.writeTimeline(workId, next)
    this.touchWork(workId)
    return true
  }

  /** 按传入 id 顺序重排时间线条目（order 归一化为下标）。 */
  reorderTimeline(workId: string, orderedIds: string[]): boolean {
    const entries = this.readTimeline(workId)
    const byId = new Map(entries.map((e) => [e.id, e]))
    const next: TimelineEntry[] = []
    for (const [i, id] of orderedIds.entries()) {
      const e = byId.get(id)
      if (!e) return false
      next.push({ ...e, order: i, updatedAt: Date.now() })
    }
    if (next.length !== entries.length) return false
    this.writeTimeline(workId, next)
    this.touchWork(workId)
    return true
  }

  deleteVolume(workId: string, id: string): boolean {
    const volumes = this.readVolumes(workId)
    const next = volumes.filter((v) => v.id !== id)
    if (next.length === volumes.length) return false
    this.writeVolumes(workId, next)
    this.touchWork(workId)
    return true
  }

  /** 按传入 id 顺序重排卷（order 归一化为下标）。 */
  reorderVolumes(workId: string, orderedIds: string[]): boolean {
    const volumes = this.readVolumes(workId)
    const byId = new Map(volumes.map((v) => [v.id, v]))
    const next: Volume[] = []
    for (const [i, id] of orderedIds.entries()) {
      const v = byId.get(id)
      if (!v) return false
      next.push({ ...v, order: i, updatedAt: Date.now() })
    }
    if (next.length !== volumes.length) return false
    this.writeVolumes(workId, next)
    this.touchWork(workId)
    return true
  }

  /** 整体替换卷的章节关联：目标卷设为指定集合，并从其他卷移除相同章节（单归属约束，保证数据可靠）。 */
  setVolumeChapters(workId: string, id: string, chapterSeqs: number[]): boolean {
    const volumes = this.readVolumes(workId)
    const v = volumes.find((x) => x.id === id)
    if (!v) return false
    // 去重并过滤已删除/不存在的章节
    const valid = new Set(this.listChapters(workId).map((c) => c.seq))
    const target = Array.from(new Set(chapterSeqs)).filter((s) => valid.has(s))
    const targetSet = new Set(target)
    const now = Date.now()
    for (const vol of volumes) {
      if (vol.id === id) {
        vol.chapterSeqs = target
      } else if (vol.chapterSeqs.some((s) => targetSet.has(s))) {
        vol.chapterSeqs = vol.chapterSeqs.filter((s) => !targetSet.has(s))
      }
      vol.updatedAt = now
    }
    this.writeVolumes(workId, volumes)
    this.touchWork(workId)
    return true
  }

  // ============================================================ 大纲 / 章纲 / 思维导图（PRD v1.0）
  private outlineFile(workId: string): string {
    return path.join(this.worksDir, workId, 'outline.json')
  }

  private chapterOutlinesFile(workId: string): string {
    return path.join(this.worksDir, workId, 'chapter_outlines.json')
  }

  private mindMapFile(workId: string): string {
    return path.join(this.worksDir, workId, 'mindmap.json')
  }

  listOutlineNodes(workId: string): OutlineNode[] {
    return readJson<OutlineNode[]>(this.outlineFile(workId), []).sort((a, b) => a.order - b.order)
  }

  /** upsert 大纲节点；新建时 id 生成、按同级末尾追加 order。 */
  saveOutlineNode(workId: string, node: OutlineNode): OutlineNode {
    const all = this.listOutlineNodes(workId)
    const merged: OutlineNode = {
      ...node,
      id: node.id || `ol_${Date.now()}_${randomUUID().slice(0, 6)}`,
      workId,
      order: node.id
        ? node.order
        : all
            .filter((n) => n.parentId === node.parentId)
            .reduce((m, n) => Math.max(m, n.order), -1) + 1,
      updatedAt: Date.now(),
      createdAt: node.id ? node.createdAt : Date.now()
    }
    const idx = all.findIndex((n) => n.id === merged.id)
    if (idx >= 0) all[idx] = merged
    else all.push(merged)
    writeJson(this.outlineFile(workId), all)
    this.touchWork(workId)
    return merged
  }

  /** 级联删除节点及其全部子孙节点。 */
  deleteOutlineNode(workId: string, id: string): boolean {
    const all = this.listOutlineNodes(workId)
    const doomed = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const n of all) {
        if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
          doomed.add(n.id)
          changed = true
        }
      }
    }
    const next = all.filter((n) => !doomed.has(n.id))
    if (next.length === all.length) return false
    writeJson(this.outlineFile(workId), next)
    this.touchWork(workId)
    return true
  }

  /** 按传入 id 顺序重排某父节点下的子节点（order 归一化为下标）。 */
  reorderOutlineNodes(workId: string, parentId: string | null, orderedIds: string[]): boolean {
    const all = this.listOutlineNodes(workId)
    const siblings = all.filter((n) => n.parentId === parentId)
    if (orderedIds.length !== siblings.length) return false
    const byId = new Map(siblings.map((n) => [n.id, n]))
    const now = Date.now()
    for (const [i, id] of orderedIds.entries()) {
      const n = byId.get(id)
      if (!n) return false
      n.order = i
      n.updatedAt = now
    }
    writeJson(this.outlineFile(workId), all)
    this.touchWork(workId)
    return true
  }

  listChapterOutlines(workId: string): ChapterOutline[] {
    return readJson<ChapterOutline[]>(this.chapterOutlinesFile(workId), []).sort(
      (a, b) => a.chapterSeq - b.chapterSeq
    )
  }

  /** upsert 章纲（按 chapterSeq 唯一绑定）。 */
  saveChapterOutline(workId: string, outline: ChapterOutline): ChapterOutline {
    const all = this.listChapterOutlines(workId)
    const merged: ChapterOutline = {
      ...outline,
      id: outline.id || `co_${Date.now()}_${randomUUID().slice(0, 6)}`,
      workId,
      updatedAt: Date.now()
    }
    const idx = all.findIndex((o) => o.chapterSeq === merged.chapterSeq)
    if (idx >= 0) all[idx] = merged
    else all.push(merged)
    writeJson(this.chapterOutlinesFile(workId), all)
    this.touchWork(workId)
    return merged
  }

  deleteChapterOutline(workId: string, chapterSeq: number): boolean {
    const all = this.listChapterOutlines(workId)
    const next = all.filter((o) => o.chapterSeq !== chapterSeq)
    if (next.length === all.length) return false
    writeJson(this.chapterOutlinesFile(workId), next)
    this.touchWork(workId)
    return true
  }

  getMindMap(workId: string): MindMap | null {
    return readJson<MindMap | null>(this.mindMapFile(workId), null)
  }

  saveMindMap(workId: string, map: MindMap): MindMap {
    const merged: MindMap = { ...map, workId, updatedAt: Date.now() }
    writeJson(this.mindMapFile(workId), merged)
    this.touchWork(workId)
    return merged
  }

  // ============================================================ 创作知识（RAG 前置数据层）
  private notesFile(workId: string): string {
    return path.join(this.worksDir, workId, 'notes.json')
  }

  private notesDeleteLogFile(workId: string): string {
    return path.join(this.worksDir, workId, 'notes_delete_log.json')
  }

  /** 读取全部知识实体（含归档，不过滤）。 */
  private readAllNotes(workId: string): Note[] {
    return readJson<Note[]>(this.notesFile(workId), [])
  }

  /**
   * 列出知识实体。默认仅返回活跃条目（未归档）；
   * opts.archived=true 时仅返回归档条目（统一归档池检索）。
   */
  listNotes(workId: string, kind?: NoteKind, opts?: NoteListOptions): Note[] {
    const archived = opts?.archived === true
    let list = this.readAllNotes(workId)
    if (kind) list = list.filter((n) => n.kind === kind)
    list = list.filter((n) => (n.archived === true) === archived)
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /** upsert 知识实体；id 为空时生成（新建）。归档/锚点字段完整保留。 */
  saveNote(workId: string, note: Note): Note {
    const all = this.readAllNotes(workId)
    const merged: Note = {
      ...note,
      id: note.id || `note_${Date.now()}_${randomUUID().slice(0, 6)}`,
      updatedAt: Date.now()
    }
    const idx = all.findIndex((n) => n.id === merged.id)
    if (idx >= 0) all[idx] = merged
    else all.push(merged)
    writeJson(this.notesFile(workId), all)
    this.touchWork(workId)
    return merged
  }

  deleteNote(workId: string, id: string): boolean {
    const result = this.deleteNotes(workId, [id])
    return result.deleted.length > 0
  }

  /**
   * 批量删除知识实体（含归档条目）：
   * 删除前为每个被删条目留存完整数据快照到删除日志，保障删除可追溯、
   * 正文关联（锚点）可核验，避免数据不可恢复。
   */
  deleteNotes(workId: string, ids: string[]): DeleteNotesResult {
    const all = this.readAllNotes(workId)
    const idSet = new Set(ids)
    const doomed = all.filter((n) => idSet.has(n.id))
    const deletedIds = new Set(doomed.map((n) => n.id))
    const missing = Array.from(new Set(ids)).filter((id) => !deletedIds.has(id))
    if (doomed.length > 0) {
      const next = all.filter((n) => !deletedIds.has(n.id))
      writeJson(this.notesFile(workId), next)
      // 删除操作日志：留存完整数据快照（含锚点与归档状态）
      const now = Date.now()
      const log: NoteDeleteLogEntry[] = doomed.map((n) => ({
        id: n.id,
        workId,
        kind: n.kind,
        title: n.title,
        tag: n.tag ?? '',
        content: n.content ?? '',
        chapterSeq: n.chapterSeq,
        anchorText: n.anchorText,
        deletedAt: now
      }))
      const existing = readJson<NoteDeleteLogEntry[]>(this.notesDeleteLogFile(workId), [])
      existing.push(...log)
      writeJson(this.notesDeleteLogFile(workId), existing)
      this.touchWork(workId)
      return { deleted: doomed.map((n) => n.id), missing, log }
    }
    return { deleted: [], missing, log: [] }
  }

  /** 删除操作日志（按删除时间倒序，供追溯核验）。 */
  listNoteDeleteLogs(workId: string): NoteDeleteLogEntry[] {
    return readJson<NoteDeleteLogEntry[]>(this.notesDeleteLogFile(workId), []).sort(
      (a, b) => b.deletedAt - a.deletedAt
    )
  }

  // ============================================================ 历史版本（手动保存快照）
  private versionsIndexFile(workId: string): string {
    return path.join(this.worksDir, workId, 'versions', 'index.json')
  }

  private versionsDir(workId: string, seq: number): string {
    return path.join(this.worksDir, workId, 'versions', String(seq))
  }

  /** 保存一份章节快照（手动保存时调用），返回快照元数据。 */
  saveVersion(workId: string, seq: number, content: string, note = ''): VersionSnapshot {
    const ts = Date.now()
    const dir = this.versionsDir(workId, seq)
    fs.mkdirSync(dir, { recursive: true })
    const file = `${ts}.md`
    fs.writeFileSync(path.join(dir, file), content, 'utf-8')
    const snapshot: VersionSnapshot = {
      workId,
      chapterSeq: seq,
      ts,
      note,
      charCount: content.replace(/\s/g, '').length,
      file
    }
    const index = readJson<Record<string, VersionSnapshot[]>>(this.versionsIndexFile(workId), {})
    const list = (index[String(seq)] ?? []).filter((v) => v.file !== file)
    list.push(snapshot)
    list.sort((a, b) => b.ts - a.ts)
    index[String(seq)] = list.slice(0, 50) // 每章最多保留 50 份快照
    writeJson(this.versionsIndexFile(workId), index)
    return snapshot
  }

  listVersions(workId: string, seq: number): VersionSnapshot[] {
    const index = readJson<Record<string, VersionSnapshot[]>>(this.versionsIndexFile(workId), {})
    return index[String(seq)] ?? []
  }

  readVersion(meta: VersionSnapshot): string {
    try {
      return fs.readFileSync(
        path.join(this.versionsDir(meta.workId, meta.chapterSeq), meta.file),
        'utf-8'
      )
    } catch {
      return ''
    }
  }

  // ============================================================ 设置
  getSettings(): Settings {
    return readJson<Settings>(path.join(this.root, 'settings.json'), {})
  }

  getSetting(key: string, fallback: unknown = null): unknown {
    const all = this.getSettings()
    return key in all ? all[key] : fallback
  }

  setSetting(key: string, value: unknown): void {
    const all = this.getSettings()
    all[key] = value
    writeJson(path.join(this.root, 'settings.json'), all)
  }
}
