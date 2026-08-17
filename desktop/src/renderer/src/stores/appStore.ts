import { create } from 'zustand'
import type {
  ChapterMeta,
  ChapterOutline,
  DeleteNotesResult,
  MindMap,
  MindMapNode,
  Note,
  NoteKind,
  NoteListOptions,
  OutlineNode,
  TimelineEntry,
  Volume,
  WorkMeta
} from '@shared/types'
import { chineseCharCount } from '../lib/markdown'
import { mindMapTemplate } from '@shared/mindmap-parse'
import { useToastStore } from './toastStore'
import { useEditorStore } from './editorStore'
import { syncChapterTitleBlock } from '../lib/chapterTitle'

export interface OutlineItem {
  level: number
  title: string
}

interface ContinuumState {
  works: WorkMeta[]
  chapters: ChapterMeta[]
  volumes: Volume[]
  timeline: TimelineEntry[]
  notes: Note[]
  /** 归档池：已归档知识实体（伏笔/素材统一归档，保留完整数据可检索回溯） */
  archivedNotes: Note[]
  currentWorkId: string | null
  currentChapter: ChapterMeta | null
  chapterContent: string
  loading: boolean
  outline: OutlineItem[]
  jumpTarget: { index: number; ts: number } | null
  /** 伏笔定位信号：待定位到编辑器原文的锚点（由伏笔卡片发起，含创建偏移用于消歧） */
  pendingAnchor: { text: string; ts: number; offset?: number } | null
  /** 「未分卷」系统分组自定义名称（按作品持久化；空则显示默认名） */
  unassignedLabel: string

  /** 统计（M2 收口）：当前文档字数 / 今日净增字数 / 每日目标 / 上次保存时间 */
  charCount: number
  todayChars: number
  todayDate: string
  dailyGoal: number
  lastSavedAt: number | null
  /** 今日是否已推送「目标达成」通知（跨天重置） */
  goalNotifiedToday: boolean
  /** 当前章节上次保存/加载时的字数（用于累计今日增量） */
  prevSavedCount: number
  /** 当前作品总字数（正文 + 备注内容；写作目标板块） */
  workChars: number
  /** 该账号全部作品累计总字数（正文 + 备注内容；写作目标板块） */
  totalChars: number

  loadWorks: () => Promise<void>
  loadStats: () => Promise<void>
  /** 刷新作品字数统计（主进程按存储全量核算，保证展示口径与数据一致） */
  refreshWordTotals: () => Promise<void>
  /** 更新每日写作目标字数（写入 settings 并同步状态） */
  setDailyGoal: (goal: number) => Promise<void>
  loadNotes: (kind?: NoteKind, opts?: NoteListOptions) => Promise<void>
  /** 加载归档池（归档知识实体，供统一归档模块检索） */
  loadArchivedNotes: (kind?: NoteKind) => Promise<void>
  selectWork: (id: string) => Promise<void>
  selectChapter: (seq: number) => Promise<void>
  createWork: (title: string, description?: string) => Promise<void>
  createChapter: (title: string) => Promise<void>
  renameWork: (id: string, title: string) => Promise<void>
  renameChapter: (seq: number, title: string) => Promise<void>
  deleteWork: (id: string) => Promise<void>
  deleteChapter: (seq: number) => Promise<void>
  saveChapter: (content: string) => Promise<void>
  saveChapterFor: (seq: number, title: string, content: string) => Promise<void>
  saveNote: (note: Note) => Promise<Note>
  deleteNote: (id: string) => Promise<boolean>
  /** 批量删除（含归档条目）：主进程自动清除关联并留存删除日志快照 */
  deleteNotes: (ids: string[]) => Promise<DeleteNotesResult>
  /** 归档 / 恢复：仅改动归档标志，保留完整原始数据 */
  setNoteArchived: (note: Note, archived: boolean) => Promise<void>
  updateCharCount: (count: number) => void
  setOutline: (items: OutlineItem[]) => void
  requestJump: (index: number) => void
  consumeJump: () => void
  loadVolumes: () => Promise<void>
  createVolume: (title: string) => Promise<void>
  renameVolume: (id: string, title: string) => Promise<void>
  deleteVolume: (id: string) => Promise<void>
  reorderVolumes: (orderedIds: string[]) => Promise<void>
  /** 移动章节到指定卷（volumeId 为空表示移出为未分卷） */
  moveChapter: (seq: number, volumeId: string | null) => Promise<void>
  loadTimeline: () => Promise<void>
  addTimelineEntry: (time: string) => Promise<void>
  updateTimelineEntry: (entry: TimelineEntry) => Promise<void>
  deleteTimelineEntry: (id: string) => Promise<void>
  reorderTimeline: (orderedIds: string[]) => Promise<void>
  locateClue: (note: Note) => Promise<void>
  consumeAnchor: () => void
  loadUnassignedLabel: () => Promise<void>
  renameUnassignedGroup: (name: string) => Promise<void>
  /** 大纲（总纲/卷纲树） */
  outlineNodes: OutlineNode[]
  loadOutline: () => Promise<void>
  createOutlineNode: (title: string, parentId: string | null, kind?: 'story' | 'volume') => Promise<void>
  saveOutlineNode: (node: OutlineNode) => Promise<void>
  deleteOutlineNode: (id: string) => Promise<void>
  reorderOutlineNodes: (parentId: string | null, orderedIds: string[]) => Promise<void>
  /** 章纲 */
  chapterOutlines: ChapterOutline[]
  loadChapterOutlines: () => Promise<void>
  saveChapterOutline: (outline: ChapterOutline) => Promise<void>
  /** 思维导图 */
  mindMap: MindMap | null
  loadMindMap: () => Promise<void>
  saveMindMap: (map: MindMap) => Promise<void>
  createMindMap: (kind?: 'story' | 'characters' | 'world') => Promise<void>
  importMindMap: (text: string) => Promise<{ fixed: number } | null>
  /** 将思维导图根节点的直接分支递归转换为大纲节点（转大纲） */
  convertMindMapToOutline: () => Promise<void>
}

export const useAppStore = create<ContinuumState>((set, get) => ({
  works: [],
  chapters: [],
  volumes: [],
  timeline: [],
  notes: [],
  archivedNotes: [],
  currentWorkId: null,
  currentChapter: null,
  chapterContent: '',
  loading: false,
  outline: [],
  jumpTarget: null,
  pendingAnchor: null,
  unassignedLabel: '',
  outlineNodes: [],
  chapterOutlines: [],
  mindMap: null,
  charCount: 0,
  todayChars: 0,
  todayDate: '',
  dailyGoal: 2500,
  lastSavedAt: null,
  goalNotifiedToday: false,
  prevSavedCount: 0,
  workChars: 0,
  totalChars: 0,

  loadWorks: async () => {
    set({ loading: true })
    try {
      const works = await window.api.works.list()
      set({ works })
      if (works.length > 0 && !get().currentWorkId) {
        await get().selectWork(works[0].id)
      }
    } finally {
      set({ loading: false })
    }
  },

  loadStats: async () => {
    const stats = (await window.api.settings.get('stats')) as
      | { todayChars?: number; todayDate?: string; goalNotified?: boolean }
      | null
      | undefined
    const goal = await window.api.settings.get('dailyGoal')
    const today = new Date().toISOString().slice(0, 10)
    const sameDay = stats?.todayDate === today
    set({
      todayChars: sameDay ? (stats?.todayChars ?? 0) : 0,
      todayDate: stats?.todayDate ?? '',
      dailyGoal: typeof goal === 'number' ? goal : 2500,
      goalNotifiedToday: sameDay && stats?.goalNotified === true
    })
  },

  refreshWordTotals: async () => {
    const { currentWorkId } = get()
    const totals = await window.api.stats.totals(currentWorkId)
    set({ workChars: totals.workChars, totalChars: totals.totalChars })
  },

  setDailyGoal: async (goal) => {
    const g = Math.max(0, Math.floor(goal))
    await window.api.settings.set('dailyGoal', g)
    set({ dailyGoal: g })
  },

  loadNotes: async (kind, opts) => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ notes: [] })
      return
    }
    const notes = await window.api.notes.list(currentWorkId, kind, opts)
    set({ notes })
  },

  loadArchivedNotes: async (kind) => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ archivedNotes: [] })
      return
    }
    const archivedNotes = await window.api.notes.list(currentWorkId, kind, { archived: true })
    set({ archivedNotes })
  },

  selectWork: async (id: string) => {
    set({
      currentWorkId: id,
      currentChapter: null,
      chapterContent: '',
      outline: [],
      notes: [],
      archivedNotes: [],
      outlineNodes: [],
      chapterOutlines: [],
      mindMap: null
    })
    const chapters = await window.api.chapters.list(id)
    set({ chapters })
    void get().loadNotes()
    void get().loadArchivedNotes()
    void get().loadVolumes()
    void get().loadTimeline()
    void get().loadUnassignedLabel()
    void get().loadOutline()
    void get().loadChapterOutlines()
    void get().loadMindMap()
    if (chapters.length > 0) {
      await get().selectChapter(chapters[0].seq)
    }
  },

  selectChapter: async (seq: number) => {
    const { currentWorkId, chapters } = get()
    if (!currentWorkId) return
    const meta = chapters.find((c) => c.seq === seq) ?? null
    const content = meta ? await window.api.chapters.read(currentWorkId, seq) : ''
    set({
      currentChapter: meta,
      chapterContent: content,
      prevSavedCount: chineseCharCount(content),
      charCount: chineseCharCount(content)
    })
  },

  createWork: async (title: string, description?: string) => {
    await window.api.works.create(title, description)
    await get().loadWorks()
  },

  createChapter: async (title: string) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.chapters.create(currentWorkId, title)
    const chapters = await window.api.chapters.list(currentWorkId)
    set({ chapters })
    if (chapters.length > 0) {
      await get().selectChapter(chapters[chapters.length - 1].seq)
    }
  },

  renameWork: async (id: string, title: string) => {
    await window.api.works.rename(id, title)
    const works = await window.api.works.list()
    set({ works })
  },

  renameChapter: async (seq: number, title: string) => {
    const { currentWorkId, currentChapter } = get()
    if (!currentWorkId) return
    const renamed = await window.api.chapters.rename(currentWorkId, seq, title)
    if (renamed && currentChapter && currentChapter.seq === seq) {
      set({ currentChapter: { ...currentChapter, title: renamed.title } })
      // 同步编辑器内未编辑的章节标题块（保留原始绑定，支持章节名联动更新）
      syncChapterTitleBlock(useEditorStore.getState().editor, seq, currentChapter.title, renamed.title)
    }
    const chapters = await window.api.chapters.list(currentWorkId)
    set({ chapters })
  },

  deleteWork: async (id: string) => {
    await window.api.works.delete(id)
    if (get().currentWorkId === id) {
      set({ currentWorkId: null, currentChapter: null, chapterContent: '', chapters: [], outline: [] })
    }
    await get().loadWorks()
  },

  deleteChapter: async (seq: number) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.chapters.delete(currentWorkId, seq)
    if (get().currentChapter?.seq === seq) {
      set({ currentChapter: null, chapterContent: '', outline: [] })
    }
    const chapters = await window.api.chapters.list(currentWorkId)
    set({ chapters })
    // 卷的章节关联由存储层级联清理，此处刷新
    void get().loadVolumes()
  },

  /**
   * 按显式章节身份落盘（防抖自动保存专用）。
   * 保存目标是调度时捕获的 seq/title，而非调用时的「当前章节」——
   * 避免用户在 800ms 防抖窗口内切换章节时，旧章节的待保存内容误写入新章节。
   * 仅当目标即当前章节时更新字数统计基线，避免后台补存污染统计。
   */
  saveChapterFor: async (seq: number, title: string, content: string) => {
    const {
      currentWorkId,
      currentChapter,
      prevSavedCount,
      todayChars,
      todayDate,
      dailyGoal,
      goalNotifiedToday,
      workChars,
      totalChars
    } = get()
    if (!currentWorkId) return
    await window.api.chapters.save(currentWorkId, seq, title, content)
    if (!currentChapter || currentChapter.seq !== seq) return
    // 今日字数统计：净增字数（相对上次保存/加载），跨天重置
    const cur = chineseCharCount(content)
    const delta = Math.max(0, cur - prevSavedCount)
    const today = new Date().toISOString().slice(0, 10)
    const tChars = todayDate === today ? todayChars + delta : delta
    const now = Date.now()
    // 目标达成：首次达到时推送一次鼓励（跨天重置）
    const reached = !goalNotifiedToday && dailyGoal > 0 && tChars >= dailyGoal
    await window.api.settings.set('stats', {
      todayChars: tChars,
      todayDate: today,
      goalNotified: goalNotifiedToday || reached
    })
    set({
      prevSavedCount: cur,
      charCount: cur,
      todayChars: tChars,
      todayDate: today,
      lastSavedAt: now,
      goalNotifiedToday: goalNotifiedToday || reached,
      // 作品/全库字数随净增同步（初始基线由 refreshWordTotals 全量校准，避免重复计数）
      workChars: workChars + delta,
      totalChars: totalChars + delta
    })
    if (reached) {
      useToastStore.getState().notify('success', `今日目标达成！已写 ${tChars.toLocaleString('zh-CN')} 字，继续保持`)
    }
  },

  saveChapter: async (content: string) => {
    const { currentWorkId, currentChapter } = get()
    if (!currentWorkId || !currentChapter) return
    await get().saveChapterFor(currentChapter.seq, currentChapter.title, content)
  },

  saveNote: async (note) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return { ...note, id: note.id, updatedAt: note.updatedAt }
    const saved = await window.api.notes.save(currentWorkId, note)
    await get().loadNotes()
    void get().loadArchivedNotes()
    return saved
  },

  deleteNote: async (id) => {
    const result = await get().deleteNotes([id])
    return result.deleted.length > 0
  },

  deleteNotes: async (ids) => {
    const { currentWorkId } = get()
    if (!currentWorkId || ids.length === 0) return { deleted: [], missing: ids, log: [] }
    const result = await window.api.notes.deleteBatch(currentWorkId, ids)
    await get().loadNotes()
    void get().loadArchivedNotes()
    return result
  },

  /** 归档 / 恢复：仅改归档标志与归档时间，保留完整原始数据（含锚点，可检索回溯）。 */
  setNoteArchived: async (note, archived) => {
    await get().saveNote({
      ...note,
      archived,
      archivedAt: archived ? Date.now() : undefined
    })
  },

  updateCharCount: (count: number) => set({ charCount: count }),

  setOutline: (items: OutlineItem[]) => set({ outline: items }),

  requestJump: (index: number) => set({ jumpTarget: { index, ts: Date.now() } }),

  consumeJump: () => set({ jumpTarget: null }),

  loadVolumes: async () => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ volumes: [] })
      return
    }
    const volumes = await window.api.volumes.list(currentWorkId)
    set({ volumes })
  },

  createVolume: async (title: string) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.volumes.create(currentWorkId, title)
    await get().loadVolumes()
  },

  renameVolume: async (id: string, title: string) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.volumes.rename(currentWorkId, id, title)
    await get().loadVolumes()
  },

  deleteVolume: async (id: string) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.volumes.delete(currentWorkId, id)
    await get().loadVolumes()
  },

  reorderVolumes: async (orderedIds: string[]) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.volumes.reorder(currentWorkId, orderedIds)
    await get().loadVolumes()
  },

  moveChapter: async (seq: number, volumeId: string | null) => {
    const { currentWorkId, volumes } = get()
    if (!currentWorkId) return
    // 目标卷加入该章节，其余卷移除（保证单归属）
    for (const v of volumes) {
      if (v.id === volumeId && !v.chapterSeqs.includes(seq)) {
        await window.api.volumes.setChapters(currentWorkId, v.id, [...v.chapterSeqs, seq])
      } else if (v.id !== volumeId && v.chapterSeqs.includes(seq)) {
        await window.api.volumes.setChapters(
          currentWorkId,
          v.id,
          v.chapterSeqs.filter((s) => s !== seq)
        )
      }
    }
    await get().loadVolumes()
  },

  locateClue: async (note) => {
    if (!note.anchorText) return
    const { currentChapter } = get()
    // 锚点位于其他章节时先切换章节
    if (note.chapterSeq != null && (!currentChapter || currentChapter.seq !== note.chapterSeq)) {
      await get().selectChapter(note.chapterSeq)
    }
    set({ pendingAnchor: { text: note.anchorText, ts: Date.now(), offset: note.anchorOffset } })
  },

  consumeAnchor: () => set({ pendingAnchor: null }),

  loadTimeline: async () => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ timeline: [] })
      return
    }
    const timeline = await window.api.timeline.list(currentWorkId)
    set({ timeline })
  },

  addTimelineEntry: async (time: string) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    const entry: TimelineEntry = {
      id: '',
      workId: currentWorkId,
      time,
      summary: '',
      order: 0,
      createdAt: 0,
      updatedAt: 0
    }
    await window.api.timeline.save(currentWorkId, entry)
    await get().loadTimeline()
  },

  updateTimelineEntry: async (entry) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.timeline.save(currentWorkId, entry)
    await get().loadTimeline()
  },

  deleteTimelineEntry: async (id) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.timeline.delete(currentWorkId, id)
    await get().loadTimeline()
  },

  reorderTimeline: async (orderedIds) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.timeline.reorder(currentWorkId, orderedIds)
    await get().loadTimeline()
  },

  loadUnassignedLabel: async () => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ unassignedLabel: '' })
      return
    }
    const name = await window.api.settings.get(`unassignedLabel_${currentWorkId}`)
    set({ unassignedLabel: typeof name === 'string' ? name : '' })
  },

  renameUnassignedGroup: async (name) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.settings.set(`unassignedLabel_${currentWorkId}`, name)
    set({ unassignedLabel: name })
  },

  // ============================================================ 大纲 / 章纲 / 思维导图
  loadOutline: async () => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ outlineNodes: [] })
      return
    }
    const outlineNodes = await window.api.outlines.list(currentWorkId)
    set({ outlineNodes })
  },

  createOutlineNode: async (title, parentId, kind = 'story') => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    const node: OutlineNode = {
      id: '',
      workId: currentWorkId,
      parentId,
      title,
      content: '',
      kind,
      beat: 'other',
      targetWords: 0,
      order: 0,
      createdAt: 0,
      updatedAt: 0
    }
    await window.api.outlines.save(currentWorkId, node)
    await get().loadOutline()
  },

  saveOutlineNode: async (node) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.outlines.save(currentWorkId, node)
    await get().loadOutline()
  },

  deleteOutlineNode: async (id) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.outlines.delete(currentWorkId, id)
    await get().loadOutline()
  },

  reorderOutlineNodes: async (parentId, orderedIds) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.outlines.reorder(currentWorkId, parentId, orderedIds)
    await get().loadOutline()
  },

  loadChapterOutlines: async () => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ chapterOutlines: [] })
      return
    }
    const chapterOutlines = await window.api.chapterOutlines.list(currentWorkId)
    set({ chapterOutlines })
  },

  saveChapterOutline: async (outline) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    await window.api.chapterOutlines.save(currentWorkId, outline)
    await get().loadChapterOutlines()
  },

  loadMindMap: async () => {
    const { currentWorkId } = get()
    if (!currentWorkId) {
      set({ mindMap: null })
      return
    }
    const mindMap = await window.api.mindmap.get(currentWorkId)
    set({ mindMap })
  },

  saveMindMap: async (map) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    const saved = await window.api.mindmap.save(currentWorkId, map)
    set({ mindMap: saved })
  },

  createMindMap: async (kind = 'story') => {
    const { currentWorkId } = get()
    if (!currentWorkId) return
    const saved = await window.api.mindmap.save(currentWorkId, {
      workId: currentWorkId,
      root: mindMapTemplate(kind),
      updatedAt: 0
    })
    set({ mindMap: saved })
  },

  importMindMap: async (text) => {
    const { currentWorkId } = get()
    if (!currentWorkId) return null
    const { map, fixed } = await window.api.mindmap.import(currentWorkId, text)
    set({ mindMap: map })
    return { fixed }
  },

  convertMindMapToOutline: async () => {
    const { currentWorkId, mindMap } = get()
    if (!currentWorkId || !mindMap) return
    const walk = async (node: MindMapNode, parentId: string | null): Promise<void> => {
      const created = await window.api.outlines.save(currentWorkId, {
        id: '',
        workId: currentWorkId,
        parentId,
        title: node.text,
        content: node.note ?? '',
        kind: 'story',
        beat: 'other',
        targetWords: 0,
        order: 0,
        createdAt: 0,
        updatedAt: 0
      })
      for (const child of node.children) {
        await walk(child, created.id)
      }
    }
    for (const child of mindMap.root.children) {
      await walk(child, null)
    }
    await get().loadOutline()
  }
}))
