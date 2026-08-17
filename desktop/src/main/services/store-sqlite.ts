/**
 * SQLite 存储实现（P2 存储升级，零原生依赖：sql.js wasm）。
 *
 * 设计（与规划对齐）：正文与版本快照仍以纯 Markdown 文件保存（用户可读可迁移），
 * 作品 / 章节索引 / 创作知识 / 设置 / 版本索引 元数据存入 <root>/continuum.db。
 * 实现与 WorksStore（文件版）接口完全一致（IWorksStore），可无缝替换、渲染层零改动。
 */

import fs from 'fs'
import path from 'path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type {
  Chapter,
  ChapterMeta,
  ChapterOutline,
  DeleteNotesResult,
  MindMap,
  MindMapNode,
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
import type { IWorksStore } from './store'

interface DbRow {
  [key: string]: unknown
}

export class SqliteWorksStore implements IWorksStore {
  private readonly root: string
  private readonly worksDir: string
  private db: Database

  private constructor(root: string, db: Database) {
    this.root = root
    this.worksDir = path.join(root, 'works')
    fs.mkdirSync(this.worksDir, { recursive: true })
    this.db = db
  }

  /** 打开（或初始化）数据库并构建存储。 */
  static async open(root: string): Promise<SqliteWorksStore> {
    const SQL = await initSqlJs()
    const dbFile = path.join(root, 'continuum.db')
    const db = fs.existsSync(dbFile)
      ? new SQL.Database(fs.readFileSync(dbFile))
      : new SQL.Database()
    const store = new SqliteWorksStore(root, db)
    store.migrate(SQL)
    store.persist()
    return store
  }

  /** 建表（幂等）。 */
  private migrate(SQL: SqlJsStatic): void {
    void SQL
    this.db.run(`
      CREATE TABLE IF NOT EXISTS works(
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chapters(
        work_id TEXT NOT NULL, seq INTEGER NOT NULL, title TEXT NOT NULL, file TEXT NOT NULL,
        PRIMARY KEY(work_id, seq)
      );
      CREATE TABLE IF NOT EXISTS volumes(
        work_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL,
        chapter_seqs TEXT NOT NULL DEFAULT '[]', order_no INTEGER NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY(work_id, id)
      );
      CREATE TABLE IF NOT EXISTS timeline(
        work_id TEXT NOT NULL, id TEXT NOT NULL, time TEXT NOT NULL,
        summary TEXT DEFAULT '', order_no INTEGER NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY(work_id, id)
      );
      CREATE TABLE IF NOT EXISTS notes(
        work_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
        tag TEXT DEFAULT '', content TEXT DEFAULT '', chapter_seq INTEGER, updated_at INTEGER NOT NULL,
        PRIMARY KEY(work_id, id)
      );
      CREATE TABLE IF NOT EXISTS note_delete_logs(
        work_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
        tag TEXT DEFAULT '', content TEXT DEFAULT '', chapter_seq INTEGER, anchor_text TEXT,
        deleted_at INTEGER NOT NULL,
        PRIMARY KEY(work_id, id, deleted_at)
      );
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS versions(
        work_id TEXT NOT NULL, chapter_seq INTEGER NOT NULL, ts INTEGER NOT NULL,
        note TEXT DEFAULT '', char_count INTEGER NOT NULL, file TEXT NOT NULL,
        PRIMARY KEY(work_id, chapter_seq, ts)
      );
      CREATE TABLE IF NOT EXISTS outline_nodes(
        work_id TEXT NOT NULL, id TEXT NOT NULL, parent_id TEXT, title TEXT NOT NULL,
        content TEXT DEFAULT '', kind TEXT NOT NULL DEFAULT 'story', beat TEXT NOT NULL DEFAULT 'other',
        target_words INTEGER NOT NULL DEFAULT 0, volume_id TEXT, chapter_seqs TEXT DEFAULT '[]',
        character_ids TEXT DEFAULT '[]', order_no INTEGER NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY(work_id, id)
      );
      CREATE TABLE IF NOT EXISTS chapter_outlines(
        work_id TEXT NOT NULL, chapter_seq INTEGER NOT NULL, id TEXT NOT NULL,
        core_plot TEXT DEFAULT '', character_scenes TEXT DEFAULT '', conflict TEXT DEFAULT '',
        hook TEXT DEFAULT '', content TEXT DEFAULT '', extracted INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unwritten', updated_at INTEGER NOT NULL,
        PRIMARY KEY(work_id, chapter_seq)
      );
      CREATE TABLE IF NOT EXISTS mind_maps(
        work_id TEXT PRIMARY KEY, root TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
    `)
    // 增量列迁移（旧库升级幂等）：伏笔锚点 / 锚点偏移 / 归档标志 / 归档时间
    const noteCols = this.columnNames('notes')
    if (!noteCols.includes('anchor_text')) this.db.run('ALTER TABLE notes ADD COLUMN anchor_text TEXT')
    if (!noteCols.includes('anchor_offset')) this.db.run('ALTER TABLE notes ADD COLUMN anchor_offset INTEGER')
    if (!noteCols.includes('archived')) this.db.run('ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')
    if (!noteCols.includes('archived_at')) this.db.run('ALTER TABLE notes ADD COLUMN archived_at INTEGER')
  }

  /** 获取表列名（用于幂等迁移判定）。 */
  private columnNames(table: string): string[] {
    const rows = this.all(`PRAGMA table_info(${table})`)
    return rows.map((r) => String(r.name))
  }

  /** 将内存 DB 落盘（sql.js 需显式 export 持久化）。 */
  private persist(): void {
    const data = this.db.export()
    fs.mkdirSync(this.root, { recursive: true })
    fs.writeFileSync(path.join(this.root, 'continuum.db'), data)
  }

  private all(sql: string, params: (string | number | null)[] = []): DbRow[] {
    const stmt = this.db.prepare(sql)
    try {
      stmt.bind(params)
      const rows: DbRow[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as DbRow)
      return rows
    } finally {
      stmt.free()
    }
  }

  private one(sql: string, params: (string | number | null)[] = []): DbRow | null {
    return this.all(sql, params)[0] ?? null
  }

  private run(sql: string, params: (string | number | null)[] = []): void {
    this.db.run(sql, params)
  }

  // ============================================================ 作品
  listWorks(): WorkMeta[] {
    const rows = this.all('SELECT id, title, description, created_at, updated_at FROM works')
    const works = rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      description: String(r.description ?? ''),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at)
    }))
    return works.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getWork(id: string): WorkMeta | null {
    const r = this.one('SELECT * FROM works WHERE id = ?', [id])
    if (!r) return null
    return {
      id: String(r.id),
      title: String(r.title),
      description: String(r.description ?? ''),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at)
    }
  }

  worksDirOf(workId: string): string {
    return path.join(this.worksDir, workId)
  }

  createWork(title: string, description = ''): WorkMeta {
    const now = Date.now()
    const meta: WorkMeta = {
      id: `work_${now}_${Math.random().toString(16).slice(2, 8)}`,
      title,
      description,
      createdAt: now,
      updatedAt: now
    }
    this.run('INSERT INTO works VALUES (?, ?, ?, ?, ?)', [
      meta.id,
      meta.title,
      meta.description,
      meta.createdAt,
      meta.updatedAt
    ])
    this.persist()
    return meta
  }

  renameWork(id: string, title: string): boolean {
    const r = this.run.bind(this)
    r('UPDATE works SET title = ?, updated_at = ? WHERE id = ?', [title, Date.now(), id])
    const changed = this.db.getRowsModified() > 0
    if (changed) this.persist()
    return changed
  }

  deleteWork(id: string): boolean {
    this.run('DELETE FROM works WHERE id = ?', [id])
    this.run('DELETE FROM chapters WHERE work_id = ?', [id])
    this.run('DELETE FROM volumes WHERE work_id = ?', [id])
    this.run('DELETE FROM timeline WHERE work_id = ?', [id])
    this.run('DELETE FROM notes WHERE work_id = ?', [id])
    this.run('DELETE FROM note_delete_logs WHERE work_id = ?', [id])
    this.run('DELETE FROM versions WHERE work_id = ?', [id])
    this.run('DELETE FROM outline_nodes WHERE work_id = ?', [id])
    this.run('DELETE FROM chapter_outlines WHERE work_id = ?', [id])
    this.run('DELETE FROM mind_maps WHERE work_id = ?', [id])
    this.persist()
    const dir = this.worksDirOf(id)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    return true
  }

  private touchWork(id: string): void {
    this.run('UPDATE works SET updated_at = ? WHERE id = ?', [Date.now(), id])
  }

  // ============================================================ 章节
  private chaptersDir(workId: string): string {
    return path.join(this.worksDirOf(workId), 'chapters')
  }

  private slugify(text: string): string {
    const cleaned = (text || '').replace(/[^\w\u4e00-\u9fff-]/g, '').trim()
    return (cleaned || 'untitled').slice(0, 20)
  }

  listChapters(workId: string): ChapterMeta[] {
    const rows = this.all('SELECT seq, title, file FROM chapters WHERE work_id = ? ORDER BY seq', [workId])
    return rows.map((r) => ({
      workId,
      seq: Number(r.seq),
      title: String(r.title),
      file: String(r.file)
    }))
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
    for (const name of fs.readdirSync(dir)) {
      if (new RegExp(`^${String(seq).padStart(3, '0')}_.*\\.md$`).test(name)) {
        fs.rmSync(path.join(dir, name), { force: true })
      }
    }
    const file = `${String(seq).padStart(3, '0')}_${this.slugify(title)}.md`
    fs.writeFileSync(path.join(dir, file), content, 'utf-8')
    this.run(
      `INSERT INTO chapters(work_id, seq, title, file) VALUES (?, ?, ?, ?)
       ON CONFLICT(work_id, seq) DO UPDATE SET title = excluded.title, file = excluded.file`,
      [workId, seq, title, file]
    )
    this.touchWork(workId)
    this.persist()
    return { workId, seq, title, file, content }
  }

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
    this.run('DELETE FROM chapters WHERE work_id = ? AND seq = ?', [workId, seq])
    // 级联清理：从所有卷的章节关联中移除
    for (const v of this.listVolumes(workId)) {
      if (v.chapterSeqs.includes(seq)) {
        this.setVolumeChapters(workId, v.id, v.chapterSeqs.filter((s) => s !== seq))
      }
    }
    // 级联清理：删除对应章纲（大纲节点与导图保留，由用户手动处理）
    this.deleteChapterOutline(workId, seq)
    this.touchWork(workId)
    this.persist()
    return true
  }

  // ============================================================ 时间线（剧情时间节点）
  private rowToTimeline(r: DbRow, workId: string): TimelineEntry {
    return {
      id: String(r.id),
      workId,
      time: String(r.time),
      summary: String(r.summary ?? ''),
      order: Number(r.order_no),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at)
    }
  }

  listTimeline(workId: string): TimelineEntry[] {
    const rows = this.all('SELECT * FROM timeline WHERE work_id = ? ORDER BY order_no', [workId])
    return rows.map((r) => this.rowToTimeline(r, workId))
  }

  saveTimelineEntry(workId: string, entry: TimelineEntry): TimelineEntry {
    const merged: TimelineEntry = {
      ...entry,
      id: entry.id || `tl_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      workId,
      order: entry.id
        ? entry.order
        : (Number(this.one('SELECT MAX(order_no) AS m FROM timeline WHERE work_id = ?', [workId])?.m) || -1) + 1,
      updatedAt: Date.now(),
      createdAt: entry.id ? entry.createdAt : Date.now()
    }
    this.run(
      `INSERT INTO timeline(work_id, id, time, summary, order_no, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(work_id, id) DO UPDATE SET
         time = excluded.time, summary = excluded.summary,
         order_no = excluded.order_no, updated_at = excluded.updated_at`,
      [workId, merged.id, merged.time, merged.summary ?? '', merged.order, merged.createdAt, merged.updatedAt]
    )
    this.touchWork(workId)
    this.persist()
    return merged
  }

  deleteTimelineEntry(workId: string, id: string): boolean {
    this.run('DELETE FROM timeline WHERE work_id = ? AND id = ?', [workId, id])
    const changed = this.db.getRowsModified() > 0
    if (changed) {
      this.touchWork(workId)
      this.persist()
    }
    return changed
  }

  /** 按传入 id 顺序重排时间线条目（order 归一化为下标）。 */
  reorderTimeline(workId: string, orderedIds: string[]): boolean {
    const existing = this.listTimeline(workId)
    if (orderedIds.length !== existing.length) return false
    const byId = new Map(existing.map((e) => [e.id, e]))
    const now = Date.now()
    for (const [i, id] of orderedIds.entries()) {
      if (!byId.has(id)) return false
      this.run('UPDATE timeline SET order_no = ?, updated_at = ? WHERE work_id = ? AND id = ?', [i, now, workId, id])
    }
    this.touchWork(workId)
    this.persist()
    return true
  }

  // ============================================================ 大纲 / 章纲 / 思维导图（PRD v1.0）
  private rowToOutlineNode(r: DbRow, workId: string): OutlineNode {
    return {
      id: String(r.id),
      workId,
      parentId: r.parent_id != null ? String(r.parent_id) : null,
      title: String(r.title),
      content: String(r.content ?? ''),
      kind: String(r.kind) === 'volume' ? 'volume' : 'story',
      beat: String(r.beat ?? 'other') as OutlineNode['beat'],
      targetWords: Number(r.target_words ?? 0),
      volumeId: r.volume_id != null && String(r.volume_id) ? String(r.volume_id) : undefined,
      chapterSeqs: this.parseNumberArray(String(r.chapter_seqs ?? '[]')),
      characterIds: this.parseStringArray(String(r.character_ids ?? '[]')),
      order: Number(r.order_no),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at)
    }
  }

  private parseNumberArray(text: string): number[] {
    try {
      const parsed = JSON.parse(text) as unknown
      if (Array.isArray(parsed)) return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    } catch {
      /* 忽略损坏数据 */
    }
    return []
  }

  private parseStringArray(text: string): string[] {
    try {
      const parsed = JSON.parse(text) as unknown
      if (Array.isArray(parsed)) return parsed.map((n) => String(n))
    } catch {
      /* 忽略损坏数据 */
    }
    return []
  }

  listOutlineNodes(workId: string): OutlineNode[] {
    const rows = this.all('SELECT * FROM outline_nodes WHERE work_id = ? ORDER BY order_no', [workId])
    return rows.map((r) => this.rowToOutlineNode(r, workId))
  }

  saveOutlineNode(workId: string, node: OutlineNode): OutlineNode {
    const merged: OutlineNode = {
      ...node,
      id: node.id || `ol_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      workId,
      order: node.id
        ? node.order
        : (Number(
            this.one(
              'SELECT MAX(order_no) AS m FROM outline_nodes WHERE work_id = ? AND parent_id IS ?',
              [workId, node.parentId]
            )?.m ?? -1
          )) + 1,
      updatedAt: Date.now(),
      createdAt: node.id ? node.createdAt : Date.now()
    }
    this.run(
      `INSERT INTO outline_nodes(
        work_id, id, parent_id, title, content, kind, beat, target_words,
        volume_id, chapter_seqs, character_ids, order_no, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(work_id, id) DO UPDATE SET
        parent_id = excluded.parent_id, title = excluded.title, content = excluded.content,
        kind = excluded.kind, beat = excluded.beat, target_words = excluded.target_words,
        volume_id = excluded.volume_id, chapter_seqs = excluded.chapter_seqs,
        character_ids = excluded.character_ids, order_no = excluded.order_no,
        updated_at = excluded.updated_at`,
      [
        workId,
        merged.id,
        merged.parentId,
        merged.title,
        merged.content ?? '',
        merged.kind,
        merged.beat,
        merged.targetWords,
        merged.volumeId ?? null,
        JSON.stringify(merged.chapterSeqs ?? []),
        JSON.stringify(merged.characterIds ?? []),
        merged.order,
        merged.createdAt,
        merged.updatedAt
      ]
    )
    this.touchWork(workId)
    this.persist()
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
    const before = all.length
    for (const nid of doomed) {
      this.run('DELETE FROM outline_nodes WHERE work_id = ? AND id = ?', [workId, nid])
    }
    // id 不存在时没有任何行被删除（doomed 仅含自身）
    if (doomed.size === 1 && before === all.length && this.one('SELECT id FROM outline_nodes WHERE work_id = ? AND id = ?', [workId, id]) == null) {
      return false
    }
    this.touchWork(workId)
    this.persist()
    return true
  }

  reorderOutlineNodes(workId: string, parentId: string | null, orderedIds: string[]): boolean {
    const siblings = this.listOutlineNodes(workId).filter((n) => n.parentId === parentId)
    if (orderedIds.length !== siblings.length) return false
    const byId = new Map(siblings.map((n) => [n.id, n]))
    const now = Date.now()
    for (const [i, id] of orderedIds.entries()) {
      if (!byId.has(id)) return false
      this.run('UPDATE outline_nodes SET order_no = ?, updated_at = ? WHERE work_id = ? AND id = ?', [
        i,
        now,
        workId,
        id
      ])
    }
    this.touchWork(workId)
    this.persist()
    return true
  }

  private rowToChapterOutline(r: DbRow, workId: string): ChapterOutline {
    return {
      id: String(r.id),
      workId,
      chapterSeq: Number(r.chapter_seq),
      corePlot: String(r.core_plot ?? ''),
      characterScenes: String(r.character_scenes ?? ''),
      conflict: String(r.conflict ?? ''),
      hook: String(r.hook ?? ''),
      content: String(r.content ?? ''),
      extracted: Number(r.extracted ?? 0) === 1,
      status: (String(r.status ?? 'unwritten') as ChapterOutline['status']),
      updatedAt: Number(r.updated_at)
    }
  }

  listChapterOutlines(workId: string): ChapterOutline[] {
    const rows = this.all('SELECT * FROM chapter_outlines WHERE work_id = ? ORDER BY chapter_seq', [workId])
    return rows.map((r) => this.rowToChapterOutline(r, workId))
  }

  saveChapterOutline(workId: string, outline: ChapterOutline): ChapterOutline {
    const merged: ChapterOutline = {
      ...outline,
      id: outline.id || `co_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      workId,
      updatedAt: Date.now()
    }
    this.run(
      `INSERT INTO chapter_outlines(
        work_id, chapter_seq, id, core_plot, character_scenes, conflict, hook,
        content, extracted, status, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(work_id, chapter_seq) DO UPDATE SET
        id = excluded.id, core_plot = excluded.core_plot,
        character_scenes = excluded.character_scenes, conflict = excluded.conflict,
        hook = excluded.hook, content = excluded.content, extracted = excluded.extracted,
        status = excluded.status, updated_at = excluded.updated_at`,
      [
        workId,
        merged.chapterSeq,
        merged.id,
        merged.corePlot ?? '',
        merged.characterScenes ?? '',
        merged.conflict ?? '',
        merged.hook ?? '',
        merged.content ?? '',
        merged.extracted ? 1 : 0,
        merged.status,
        merged.updatedAt
      ]
    )
    this.touchWork(workId)
    this.persist()
    return merged
  }

  deleteChapterOutline(workId: string, chapterSeq: number): boolean {
    this.run('DELETE FROM chapter_outlines WHERE work_id = ? AND chapter_seq = ?', [workId, chapterSeq])
    const changed = this.db.getRowsModified() > 0
    if (changed) {
      this.touchWork(workId)
      this.persist()
    }
    return changed
  }

  getMindMap(workId: string): MindMap | null {
    const r = this.one('SELECT root, updated_at FROM mind_maps WHERE work_id = ?', [workId])
    if (!r) return null
    let root: MindMapNode
    try {
      root = JSON.parse(String(r.root)) as MindMapNode
    } catch {
      return null
    }
    return { workId, root, updatedAt: Number(r.updated_at) }
  }

  saveMindMap(workId: string, map: MindMap): MindMap {
    const merged: MindMap = { ...map, workId, updatedAt: Date.now() }
    this.run(
      'INSERT INTO mind_maps(work_id, root, updated_at) VALUES (?, ?, ?) ON CONFLICT(work_id) DO UPDATE SET root = excluded.root, updated_at = excluded.updated_at',
      [workId, JSON.stringify(merged.root), merged.updatedAt]
    )
    this.touchWork(workId)
    this.persist()
    return merged
  }

  // ============================================================ 卷（章节层级容器）
  private rowToVolume(r: DbRow, workId: string): Volume {
    let seqs: number[] = []
    try {
      const parsed = JSON.parse(String(r.chapter_seqs ?? '[]')) as unknown
      if (Array.isArray(parsed)) seqs = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    } catch {
      seqs = []
    }
    return {
      id: String(r.id),
      workId,
      title: String(r.title),
      chapterSeqs: seqs,
      order: Number(r.order_no),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at)
    }
  }

  listVolumes(workId: string): Volume[] {
    const rows = this.all('SELECT * FROM volumes WHERE work_id = ? ORDER BY order_no', [workId])
    return rows.map((r) => this.rowToVolume(r, workId))
  }

  getVolume(workId: string, id: string): Volume | null {
    const r = this.one('SELECT * FROM volumes WHERE work_id = ? AND id = ?', [workId, id])
    return r ? this.rowToVolume(r, workId) : null
  }

  createVolume(workId: string, title: string): Volume {
    const now = Date.now()
    const max = this.one('SELECT MAX(order_no) AS m FROM volumes WHERE work_id = ?', [workId])
    const volume: Volume = {
      id: `vol_${now}_${Math.random().toString(16).slice(2, 8)}`,
      workId,
      title,
      chapterSeqs: [],
      order: (Number(max?.m) || -1) + 1,
      createdAt: now,
      updatedAt: now
    }
    this.run('INSERT INTO volumes(work_id, id, title, chapter_seqs, order_no, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      workId,
      volume.id,
      volume.title,
      JSON.stringify(volume.chapterSeqs),
      volume.order,
      volume.createdAt,
      volume.updatedAt
    ])
    this.touchWork(workId)
    this.persist()
    return volume
  }

  renameVolume(workId: string, id: string, title: string): boolean {
    this.run('UPDATE volumes SET title = ?, updated_at = ? WHERE work_id = ? AND id = ?', [
      title,
      Date.now(),
      workId,
      id
    ])
    const changed = this.db.getRowsModified() > 0
    if (changed) {
      this.touchWork(workId)
      this.persist()
    }
    return changed
  }

  deleteVolume(workId: string, id: string): boolean {
    this.run('DELETE FROM volumes WHERE work_id = ? AND id = ?', [workId, id])
    const changed = this.db.getRowsModified() > 0
    if (changed) {
      this.touchWork(workId)
      this.persist()
    }
    return changed
  }

  /** 按传入 id 顺序重排卷（order 归一化为下标）。 */
  reorderVolumes(workId: string, orderedIds: string[]): boolean {
    const existing = this.listVolumes(workId)
    if (orderedIds.length !== existing.length) return false
    const byId = new Map(existing.map((v) => [v.id, v]))
    const now = Date.now()
    for (const [i, id] of orderedIds.entries()) {
      if (!byId.has(id)) return false
      this.run('UPDATE volumes SET order_no = ?, updated_at = ? WHERE work_id = ? AND id = ?', [
        i,
        now,
        workId,
        id
      ])
    }
    this.touchWork(workId)
    this.persist()
    return true
  }

  /** 整体替换卷的章节关联：目标卷设为指定集合，并从其他卷移除相同章节（单归属约束，保证数据可靠）。 */
  setVolumeChapters(workId: string, id: string, chapterSeqs: number[]): boolean {
    if (!this.getVolume(workId, id)) return false
    const valid = new Set(this.listChapters(workId).map((c) => c.seq))
    const target = Array.from(new Set(chapterSeqs)).filter((s) => valid.has(s))
    const now = Date.now()
    // 先从其他卷移除目标章节（单归属）
    for (const vol of this.listVolumes(workId)) {
      if (vol.id === id) continue
      const next = vol.chapterSeqs.filter((s) => !target.includes(s))
      if (next.length !== vol.chapterSeqs.length) {
        this.run('UPDATE volumes SET chapter_seqs = ?, updated_at = ? WHERE work_id = ? AND id = ?', [
          JSON.stringify(next),
          now,
          workId,
          vol.id
        ])
      }
    }
    this.run('UPDATE volumes SET chapter_seqs = ?, updated_at = ? WHERE work_id = ? AND id = ?', [
      JSON.stringify(target),
      now,
      workId,
      id
    ])
    this.touchWork(workId)
    this.persist()
    return true
  }

  // ============================================================ 创作知识
  /**
   * 列出知识实体。默认仅返回活跃条目（未归档）；
   * opts.archived=true 时仅返回归档条目（统一归档池检索）。
   */
  listNotes(workId: string, kind?: NoteKind, opts?: NoteListOptions): Note[] {
    const archived = opts?.archived === true ? 1 : 0
    let sql = 'SELECT * FROM notes WHERE work_id = ? AND COALESCE(archived, 0) = ?'
    const params: (string | number | null)[] = [workId, archived]
    if (kind) {
      sql += ' AND kind = ?'
      params.push(kind)
    }
    const rows = this.all(sql, params)
    const notes = rows.map((r) => ({
      id: String(r.id),
      kind: String(r.kind) as NoteKind,
      title: String(r.title),
      tag: String(r.tag ?? ''),
      content: String(r.content ?? ''),
      chapterSeq: r.chapter_seq != null ? Number(r.chapter_seq) : undefined,
      anchorText: r.anchor_text != null && String(r.anchor_text) ? String(r.anchor_text) : undefined,
      anchorOffset: r.anchor_offset != null ? Number(r.anchor_offset) : undefined,
      archived: Number(r.archived ?? 0) === 1,
      archivedAt: r.archived_at != null ? Number(r.archived_at) : undefined,
      updatedAt: Number(r.updated_at)
    }))
    return notes.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /** upsert 知识实体；id 为空时生成（新建）。归档/锚点字段完整保留。 */
  saveNote(workId: string, note: Note): Note {
    const merged: Note = {
      ...note,
      id: note.id || `note_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      archived: note.archived === true,
      updatedAt: Date.now()
    }
    this.run(
      `INSERT INTO notes(work_id, id, kind, title, tag, content, chapter_seq, anchor_text, anchor_offset, archived, archived_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(work_id, id) DO UPDATE SET
         kind = excluded.kind, title = excluded.title, tag = excluded.tag,
         content = excluded.content, chapter_seq = excluded.chapter_seq,
         anchor_text = excluded.anchor_text, anchor_offset = excluded.anchor_offset,
         archived = excluded.archived, archived_at = excluded.archived_at, updated_at = excluded.updated_at`,
      [
        workId,
        merged.id,
        merged.kind,
        merged.title,
        merged.tag ?? '',
        merged.content ?? '',
        merged.chapterSeq ?? null,
        merged.anchorText ?? null,
        merged.anchorOffset ?? null,
        merged.archived ? 1 : 0,
        merged.archived ? merged.archivedAt ?? Date.now() : null,
        merged.updatedAt
      ]
    )
    this.touchWork(workId)
    this.persist()
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
    const all = this.listNotesAll(workId)
    const idSet = new Set(ids)
    const doomed = all.filter((n) => idSet.has(n.id))
    const deletedIds = new Set(doomed.map((n) => n.id))
    const missing = Array.from(new Set(ids)).filter((id) => !deletedIds.has(id))
    if (doomed.length === 0) return { deleted: [], missing, log: [] }
    const now = Date.now()
    for (const n of doomed) {
      this.run('DELETE FROM notes WHERE work_id = ? AND id = ?', [workId, n.id])
      this.run(
        `INSERT INTO note_delete_logs(work_id, id, kind, title, tag, content, chapter_seq, anchor_text, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workId,
          n.id,
          n.kind,
          n.title,
          n.tag ?? '',
          n.content ?? '',
          n.chapterSeq ?? null,
          n.anchorText ?? null,
          now
        ]
      )
    }
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
    this.touchWork(workId)
    this.persist()
    return { deleted: doomed.map((n) => n.id), missing, log }
  }

  /** 读取全部知识实体（含归档，不过滤；批量删除内部使用）。 */
  private listNotesAll(workId: string): Note[] {
    const rows = this.all('SELECT * FROM notes WHERE work_id = ?', [workId])
    return rows.map((r) => ({
      id: String(r.id),
      kind: String(r.kind) as NoteKind,
      title: String(r.title),
      tag: String(r.tag ?? ''),
      content: String(r.content ?? ''),
      chapterSeq: r.chapter_seq != null ? Number(r.chapter_seq) : undefined,
      anchorText: r.anchor_text != null && String(r.anchor_text) ? String(r.anchor_text) : undefined,
      anchorOffset: r.anchor_offset != null ? Number(r.anchor_offset) : undefined,
      archived: Number(r.archived ?? 0) === 1,
      archivedAt: r.archived_at != null ? Number(r.archived_at) : undefined,
      updatedAt: Number(r.updated_at)
    }))
  }

  /** 删除操作日志（按删除时间倒序，供追溯核验）。 */
  listNoteDeleteLogs(workId: string): NoteDeleteLogEntry[] {
    const rows = this.all(
      'SELECT id, kind, title, tag, content, chapter_seq, anchor_text, deleted_at FROM note_delete_logs WHERE work_id = ? ORDER BY deleted_at DESC',
      [workId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      workId,
      kind: String(r.kind) as NoteKind,
      title: String(r.title),
      tag: String(r.tag ?? ''),
      content: String(r.content ?? ''),
      chapterSeq: r.chapter_seq != null ? Number(r.chapter_seq) : undefined,
      anchorText: r.anchor_text != null && String(r.anchor_text) ? String(r.anchor_text) : undefined,
      deletedAt: Number(r.deleted_at)
    }))
  }

  // ============================================================ 历史版本
  saveVersion(workId: string, seq: number, content: string, note = ''): VersionSnapshot {
    const ts = Date.now()
    const dir = path.join(this.worksDirOf(workId), 'versions', String(seq))
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
    this.run('DELETE FROM versions WHERE work_id = ? AND chapter_seq = ? AND file = ?', [
      workId,
      seq,
      file
    ])
    this.run('INSERT INTO versions VALUES (?, ?, ?, ?, ?, ?)', [
      workId,
      seq,
      ts,
      note,
      snapshot.charCount,
      file
    ])
    // 每章保留最近 50 份
    const rows = this.all(
      'SELECT ts FROM versions WHERE work_id = ? AND chapter_seq = ? ORDER BY ts DESC LIMIT -1 OFFSET 50',
      [workId, seq]
    )
    for (const r of rows) {
      this.run('DELETE FROM versions WHERE work_id = ? AND chapter_seq = ? AND ts = ?', [
        workId,
        seq,
        Number(r.ts)
      ])
    }
    this.persist()
    return snapshot
  }

  listVersions(workId: string, seq: number): VersionSnapshot[] {
    const rows = this.all(
      'SELECT ts, note, char_count, file FROM versions WHERE work_id = ? AND chapter_seq = ? ORDER BY ts DESC',
      [workId, seq]
    )
    return rows.map((r) => ({
      workId,
      chapterSeq: seq,
      ts: Number(r.ts),
      note: String(r.note ?? ''),
      charCount: Number(r.char_count),
      file: String(r.file)
    }))
  }

  readVersion(meta: VersionSnapshot): string {
    try {
      return fs.readFileSync(
        path.join(this.worksDirOf(meta.workId), 'versions', String(meta.chapterSeq), meta.file),
        'utf-8'
      )
    } catch {
      return ''
    }
  }

  // ============================================================ 设置
  getSettings(): Settings {
    const rows = this.all('SELECT key, value FROM settings')
    const out: Settings = {}
    for (const r of rows) {
      try {
        out[String(r.key)] = JSON.parse(String(r.value))
      } catch {
        out[String(r.key)] = String(r.value)
      }
    }
    return out
  }

  getSetting(key: string, fallback: unknown = null): unknown {
    const r = this.one('SELECT value FROM settings WHERE key = ?', [key])
    if (!r) return fallback
    try {
      return JSON.parse(String(r.value))
    } catch {
      return String(r.value)
    }
  }

  setSetting(key: string, value: unknown): void {
    this.run(
      'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)]
    )
    this.persist()
  }
}
