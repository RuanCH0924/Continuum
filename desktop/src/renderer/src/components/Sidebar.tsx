import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, IconName } from './Icon'
import { PromptModal } from './PromptModal'
import { NoteEditorDialog, KIND_LABEL } from './NoteEditorDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { useAppStore } from '../stores/appStore'
import { useUiStore } from '../stores/uiStore'
import { clueStatusOf } from '../lib/clueLink'
import type { ChapterMeta, Note, NoteKind, TimelineEntry } from '@shared/types'

type TabKey = 'works' | 'outline' | 'roles' | 'world' | 'clues' | 'materials' | 'timeline'

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'works', label: '作品', icon: 'book' },
  { key: 'outline', label: '大纲', icon: 'list' },
  { key: 'roles', label: '角色', icon: 'user' },
  { key: 'world', label: '设定', icon: 'globe' },
  { key: 'clues', label: '伏笔', icon: 'flag' },
  { key: 'materials', label: '素材', icon: 'grid' },
  { key: 'timeline', label: '时间线', icon: 'list-ol' }
]

const KIND_BY_TAB: Record<'roles' | 'world' | 'clues' | 'materials', NoteKind> = {
  roles: 'character',
  world: 'world',
  clues: 'clue',
  materials: 'material'
}

type PromptState =
  | { type: 'rename-work'; id: string; title: string }
  | { type: 'rename-chapter'; seq: number; title: string }
  | { type: 'create-volume' }
  | { type: 'rename-volume'; id: string; title: string }
  | { type: 'create-timeline' }
  | { type: 'rename-unassigned'; label: string }
  | null

function promptMeta(prompt: PromptState): { title: string; placeholder: string; initial: string } | null {
  if (!prompt) return null
  switch (prompt.type) {
    case 'rename-work':
      return { title: '重命名作品', placeholder: '作品名称', initial: prompt.title }
    case 'rename-chapter':
      return { title: '重命名章节', placeholder: '章节标题', initial: prompt.title }
    case 'create-volume':
      return { title: '新建卷', placeholder: '卷名称（如：第一卷 · 风起）', initial: '' }
    case 'rename-volume':
      return { title: '重命名卷', placeholder: '卷名称', initial: prompt.title }
    case 'create-timeline':
      return { title: '新建时间线', placeholder: '时间描述（如：第三年 · 春）', initial: '' }
    case 'rename-unassigned':
      return { title: '重命名分组', placeholder: '分组名称', initial: prompt.label }
  }
}

const CLUE_STATUS_CLS: Record<string, string> = {
  resolved: 'bg-status-success/10 text-status-success',
  active: 'bg-status-warning/15 text-status-warning',
  buried: 'bg-brand-50 text-brand-500',
  other: 'bg-neutral-100 text-neutral-500'
}

/** 左侧创作管理侧栏：作品树（卷/章节层级 + 搜索/新建/重命名/删除）+ 大纲 + 创作知识（含伏笔卡片联动）。 */
export function Sidebar({
  collapsed,
  onToggleCollapse
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}): React.JSX.Element {
  const tab = useUiStore((s) => s.sidebarTab)
  const setTab = useUiStore((s) => s.setSidebarTab)
  const clueFocus = useUiStore((s) => s.clueFocus)
  const timelineFocus = useUiStore((s) => s.timelineFocus)
  const [prompt, setPrompt] = useState<PromptState>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ kind: NoteKind; note: Note | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'work' | 'chapter' | 'volume' | 'timeline'
    name: string
    id?: string
  } | null>(null)
  /** 卷展开状态（作品内卷容器） */
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set())
  const [unassignedOpen, setUnassignedOpen] = useState(false)
  /** 右键上下文菜单（作品/卷/章节节点统一入口） */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  /** 伏笔卡片聚焦高亮 */
  const [flashClueId, setFlashClueId] = useState<string | null>(null)
  const flashTimer = useRef<number | undefined>(undefined)
  /** 时间线条目聚焦高亮 */
  const [flashTimelineId, setFlashTimelineId] = useState<string | null>(null)
  const timelineFlashTimer = useRef<number | undefined>(undefined)
  /** 时间线内联编辑：防抖保存（本地实时存储） */
  const timelineSaveTimer = useRef<number | undefined>(undefined)
  const pendingTimeline = useRef<TimelineEntry | null>(null)
  /**
   * 上一次卷行单击：点击配对检测双击（双击卷名 → 重命名）。
   * 展开/折叠由卷行旁的「折叠图标」独立负责，行单击不触发展开，彻底避免单击/双击冲突。
   */
  const lastVolumeClick = useRef<{ id: string; title: string; ts: number } | null>(null)
  /** 上一次「未分卷」分组单击（点击配对检测双击重命名） */
  const lastUnassignedClick = useRef<number>(0)
  const setPromptKind = useUiStore((s) => s.setPromptKind)

  const works = useAppStore((s) => s.works)
  const chapters = useAppStore((s) => s.chapters)
  const volumes = useAppStore((s) => s.volumes)
  const timeline = useAppStore((s) => s.timeline)
  const notes = useAppStore((s) => s.notes)
  const currentWorkId = useAppStore((s) => s.currentWorkId)
  const currentChapter = useAppStore((s) => s.currentChapter)
  const outline = useAppStore((s) => s.outline)
  const selectWork = useAppStore((s) => s.selectWork)
  const selectChapter = useAppStore((s) => s.selectChapter)
  const renameWork = useAppStore((s) => s.renameWork)
  const renameChapter = useAppStore((s) => s.renameChapter)
  const deleteWork = useAppStore((s) => s.deleteWork)
  const deleteChapter = useAppStore((s) => s.deleteChapter)
  const createVolume = useAppStore((s) => s.createVolume)
  const renameVolume = useAppStore((s) => s.renameVolume)
  const deleteVolume = useAppStore((s) => s.deleteVolume)
  const reorderVolumes = useAppStore((s) => s.reorderVolumes)
  const moveChapter = useAppStore((s) => s.moveChapter)
  const locateClue = useAppStore((s) => s.locateClue)
  const addTimelineEntry = useAppStore((s) => s.addTimelineEntry)
  const updateTimelineEntry = useAppStore((s) => s.updateTimelineEntry)
  const deleteTimelineEntry = useAppStore((s) => s.deleteTimelineEntry)
  const reorderTimeline = useAppStore((s) => s.reorderTimeline)
  const unassignedLabel = useAppStore((s) => s.unassignedLabel)
  const renameUnassignedGroup = useAppStore((s) => s.renameUnassignedGroup)
  const requestJump = useAppStore((s) => s.requestJump)

  const q = search.trim().toLowerCase()
  const searching = q.length > 0

  const visibleWorks = useMemo(
    () => (searching ? works.filter((w) => w.title.toLowerCase().includes(q)) : works),
    [works, q, searching]
  )
  const visibleChapters = useMemo(
    () => (searching ? chapters.filter((c) => c.title.toLowerCase().includes(q)) : chapters),
    [chapters, q, searching]
  )

  // 编辑器伏笔标记点击 → 定位侧栏对应卡片并高亮
  useEffect(() => {
    if (!clueFocus) return
    const el = document.querySelector(`[data-note-id="${clueFocus.noteId}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setFlashClueId(clueFocus.noteId)
      window.clearTimeout(flashTimer.current)
      flashTimer.current = window.setTimeout(() => setFlashClueId(null), 1800)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clueFocus?.ts, clueFocus?.noteId])

  // 编辑器时间线标注点击 → 定位侧栏对应条目并高亮
  useEffect(() => {
    if (!timelineFocus) return
    const el = document.querySelector(`[data-timeline-id="${timelineFocus.entryId}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setFlashTimelineId(timelineFocus.entryId)
      window.clearTimeout(timelineFlashTimer.current)
      timelineFlashTimer.current = window.setTimeout(() => setFlashTimelineId(null), 1800)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineFocus?.ts, timelineFocus?.entryId])

  const handlePromptConfirm = (value: string): void => {
    if (!prompt) return
    switch (prompt.type) {
      case 'rename-work':
        void renameWork(prompt.id, value)
        break
      case 'rename-chapter':
        void renameChapter(prompt.seq, value)
        break
      case 'create-volume':
        void createVolume(value)
        break
      case 'rename-volume':
        void renameVolume(prompt.id, value)
        break
      case 'create-timeline':
        void addTimelineEntry(value)
        break
      case 'rename-unassigned':
        void renameUnassignedGroup(value)
        break
    }
    setPrompt(null)
  }

  /** 打开自定义右键菜单：跟随鼠标坐标，并阻止浏览器原生菜单。 */
  const openCtxMenu = (e: React.MouseEvent, items: ContextMenuItem[]): void => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }

  const toggleVolume = (id: string): void => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** 卷行单击：500ms 内再次点击同一卷判定为「双击」→ 打开重命名弹窗；单击不做任何事。 */
  const onVolumeRowClick = (id: string, title: string): void => {
    const now = Date.now()
    const prev = lastVolumeClick.current
    lastVolumeClick.current = { id, title, ts: now }
    if (prev && prev.id === id && now - prev.ts <= 500) {
      setPrompt({ type: 'rename-volume', id, title })
    }
  }

  /** 卷行双击兜底：弹出重命名弹窗（原生 dblclick 不触发时由点击配对兜底）。 */
  const onVolumeRowDblClick = (id: string, title: string): void => {
    setPrompt({ type: 'rename-volume', id, title })
  }

  /** 「未分卷」分组单击：500ms 内再次点击判定为双击 → 打开重命名分组弹窗。 */
  const onUnassignedRowClick = (): void => {
    const now = Date.now()
    if (now - lastUnassignedClick.current <= 500) {
      lastUnassignedClick.current = 0
      setPrompt({ type: 'rename-unassigned', label: unassignedLabel || '未分卷' })
      return
    }
    lastUnassignedClick.current = now
  }

  /** 「未分卷」分组双击兜底。 */
  const onUnassignedRowDblClick = (): void => {
    setPrompt({ type: 'rename-unassigned', label: unassignedLabel || '未分卷' })
  }

  /** 时间线内联编辑：立即落盘（本地实时存储，避免内容丢失）。 */
  const flushTimelineSave = (): void => {
    window.clearTimeout(timelineSaveTimer.current)
    if (pendingTimeline.current) {
      const entry = pendingTimeline.current
      pendingTimeline.current = null
      void updateTimelineEntry(entry)
    }
  }

  /** 时间线内联编辑：防抖 400ms 保存（输入间隙自动落盘）。 */
  const scheduleTimelineSave = (entry: TimelineEntry): void => {
    pendingTimeline.current = entry
    window.clearTimeout(timelineSaveTimer.current)
    timelineSaveTimer.current = window.setTimeout(flushTimelineSave, 400)
  }

  const editTimelineTime = (entry: TimelineEntry, value: string): void => {
    scheduleTimelineSave({ ...entry, time: value })
  }
  const editTimelineSummary = (entry: TimelineEntry, value: string): void => {
    scheduleTimelineSave({ ...entry, summary: value })
  }

  const meta = promptMeta(prompt)

  if (collapsed) {
    return (
      <aside className="flex w-[48px] shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-neutral-50 pt-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded-md text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900 ${
              tab === t.key ? 'bg-brand-50 text-brand-500' : ''
            }`}
            title={t.label}
            onClick={() => {
              setTab(t.key)
              onToggleCollapse()
            }}
          >
            <Icon name={t.icon} size={18} />
          </button>
        ))}
      </aside>
    )
  }

  /** 时间线视图：独立条目（可编辑时间 + 剧情梗概），支持新增/编辑/删除/排序，内联实时存储。 */
  const renderTimeline = (): React.JSX.Element => {
    const entries = timeline
      .filter((e) => e.workId === currentWorkId)
      .filter((e) =>
        q
          ? e.time.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)
          : true
      )
    const swapTimeline = (a: number, b: number): void => {
      const ids = timeline
        .filter((e) => e.workId === currentWorkId)
        .map((e) => e.id)
      ;[ids[a], ids[b]] = [ids[b], ids[a]]
      void reorderTimeline(ids)
    }
    return (
      <div className="flex h-full flex-col">
        {notesHeader('时间线', entries.length, () => setPrompt({ type: 'create-timeline' }))}
        {entries.length === 0 ? (
          emptyHint(q ? '未找到匹配内容' : '还没有时间线，点击「+ 新建」添加剧情时间节点')
        ) : (
          <div className="space-y-1.5 px-1">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                data-timeline-id={entry.id}
                className={`rounded-md border p-2 transition-colors duration-base ${
                  flashTimelineId === entry.id
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/25'
                    : 'border-neutral-200 bg-neutral-0 hover:border-brand-500/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <input
                    value={entry.time}
                    onChange={(e) => editTimelineTime(entry, e.target.value)}
                    onBlur={flushTimelineSave}
                    placeholder="时间描述…"
                    className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[12px] font-medium text-neutral-900 outline-none transition-colors duration-fast focus:border-brand-500 focus:bg-neutral-50"
                  />
                  <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button
                      className="rounded px-1 text-[10px] text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900"
                      title="上移（时间线排序）"
                      disabled={i === 0}
                      onClick={() => {
                        if (i > 0) swapTimeline(i, i - 1)
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="rounded px-1 text-[10px] text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900"
                      title="下移（时间线排序）"
                      disabled={i === entries.length - 1}
                      onClick={() => {
                        if (i < entries.length - 1) swapTimeline(i, i + 1)
                      }}
                    >
                      ↓
                    </button>
                    <button
                      className="rounded px-1 text-[10px] text-status-danger/70 transition-colors duration-fast hover:bg-status-danger/10 hover:text-status-danger"
                      title="删除时间线条目"
                      onClick={() => setConfirmDelete({ type: 'timeline', name: entry.time || '未命名', id: entry.id })}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <textarea
                  value={entry.summary}
                  onChange={(e) => editTimelineSummary(entry, e.target.value)}
                  onBlur={flushTimelineSave}
                  rows={2}
                  placeholder="剧情梗概…"
                  className="mt-1 w-full resize-none rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[11px] leading-[1.6] text-neutral-700 outline-none transition-colors duration-fast focus:border-brand-500 focus:bg-neutral-50"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderWorks = (): React.JSX.Element => {
    if (works.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="text-[26px] text-brand-500">·</span>
          <span className="text-[14px] font-semibold text-neutral-900">还没有作品</span>
          <span className="text-[12px] text-neutral-500">点击上方「+ 作品」创建第一本书</span>
        </div>
      )
    }
    if (visibleWorks.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-[12px] text-neutral-500">未找到匹配的作品</div>
      )
    }

    /** 单个章节行（右键菜单：重命名 / 移动到卷 / 删除）。 */
    const chapterRow = (c: ChapterMeta): React.JSX.Element => (
      <div key={c.seq}>
        <div
          className={`group flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 transition-colors duration-fast hover:bg-neutral-100 ${
            currentChapter?.seq === c.seq ? 'bg-brand-50 font-medium text-brand-500' : 'text-neutral-500 hover:text-neutral-900'
          }`}
          onClick={() => void selectChapter(c.seq)}
          onDoubleClick={() => setPrompt({ type: 'rename-chapter', seq: c.seq, title: c.title })}
          onContextMenu={(e) =>
            openCtxMenu(e, [
              { type: 'item', label: '重命名章节', onClick: () => setPrompt({ type: 'rename-chapter', seq: c.seq, title: c.title }) },
              { type: 'separator' },
              { type: 'header', label: '移动到卷' },
              ...volumes.map((v) => ({
                type: 'item' as const,
                label: (v.chapterSeqs.includes(c.seq) ? '✓ ' : '') + v.title,
                onClick: () => void moveChapter(c.seq, v.id)
              })),
              { type: 'item', label: '未分卷', onClick: () => void moveChapter(c.seq, null) },
              { type: 'separator' },
              { type: 'item', label: '删除章节', danger: true, onClick: () => setConfirmDelete({ type: 'chapter', name: c.title, id: String(c.seq) }) }
            ])
          }
          title={`${c.title}（双击重命名）`}
        >
          <Icon name="text" size={13} className="text-neutral-300" />
          <span className="truncate">{c.title}</span>
        </div>
      </div>
    )

    return (
      <div className="py-1">
        {visibleWorks.map((w) => {
          const expanded = searching || currentWorkId === w.id
          const chs = expanded ? visibleChapters.filter((c) => c.workId === w.id) : []
          const vols = expanded ? volumes.filter((v) => v.workId === w.id) : []
          const assigned = new Set(vols.flatMap((v) => v.chapterSeqs))
          const unassigned = chs.filter((c) => !assigned.has(c.seq))
          const chapterOf = (seq: number): ChapterMeta | undefined => chs.find((c) => c.seq === seq)
          return (
            <div key={w.id}>
              <div
                className={`group flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 transition-colors duration-fast hover:bg-neutral-100 ${
                  currentWorkId === w.id ? 'bg-brand-50 font-medium text-brand-500' : 'text-neutral-900'
                }`}
                onClick={() => void selectWork(w.id)}
                onDoubleClick={() => setPrompt({ type: 'rename-work', id: w.id, title: w.title })}
                onContextMenu={(e) =>
                  openCtxMenu(e, [
                    { type: 'item', label: '重命名作品', onClick: () => setPrompt({ type: 'rename-work', id: w.id, title: w.title }) },
                    { type: 'separator' },
                    { type: 'item', label: '删除作品', danger: true, onClick: () => setConfirmDelete({ type: 'work', name: w.title, id: w.id }) }
                  ])
                }
                title={`${w.title}（双击重命名）`}
              >
                <Icon
                  name="chevron-down"
                  size={12}
                  className={`${expanded ? 'rotate-0' : '-rotate-90'} text-neutral-300 transition-transform duration-base`}
                />
                <Icon name="folder" size={15} className="text-neutral-500" />
                <span className="truncate">{w.title}</span>
              </div>

              {expanded && (
                <div className="ml-1.5 border-l border-neutral-100 pl-1.5">
                  {/* 卷容器 */}
                  {vols.map((v, vi) => {
                    const open = expandedVolumes.has(v.id)
                    const vchs = v.chapterSeqs
                      .map(chapterOf)
                      .filter((c): c is ChapterMeta => !!c)
                    const swap = (a: number, b: number): void => {
                      const ids = vols.map((x) => x.id)
                      ;[ids[a], ids[b]] = [ids[b], ids[a]]
                      void reorderVolumes(ids)
                    }
                    return (
                      <div key={v.id}>
                        <div
                          className={`group flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 transition-colors duration-fast hover:bg-neutral-100 ${
                            open ? 'bg-neutral-50 text-neutral-900' : 'text-neutral-700'
                          }`}
                          onClick={() => onVolumeRowClick(v.id, v.title)}
                          onDoubleClick={() => onVolumeRowDblClick(v.id, v.title)}
                          onContextMenu={(e) =>
                            openCtxMenu(e, [
                              { type: 'item', label: '重命名卷', onClick: () => setPrompt({ type: 'rename-volume', id: v.id, title: v.title }) },
                              { type: 'separator' },
                              { type: 'item', label: '上移（卷排序）', disabled: vi === 0, onClick: () => { if (vi > 0) swap(vi, vi - 1) } },
                              { type: 'item', label: '下移（卷排序）', disabled: vi === vols.length - 1, onClick: () => { if (vi < vols.length - 1) swap(vi, vi + 1) } },
                              { type: 'separator' },
                              { type: 'item', label: '删除卷', danger: true, onClick: () => setConfirmDelete({ type: 'volume', name: v.title, id: v.id }) }
                            ])
                          }
                          title={`${v.title}（双击重命名；点击箭头展开/折叠）`}
                        >
                          <button
                            className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded text-neutral-300 transition-colors duration-fast hover:bg-neutral-200 hover:text-neutral-700"
                            title={open ? '折叠卷' : '展开卷'}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleVolume(v.id)
                            }}
                          >
                            <Icon
                              name="chevron-down"
                              size={11}
                              className={`${open ? 'rotate-0' : '-rotate-90'} transition-transform duration-base`}
                            />
                          </button>
                          <Icon name="book" size={14} className="text-brand-500" />
                          <span className="truncate text-[12px]">{v.title}</span>
                          <span className="shrink-0 text-[10px] tabular-nums text-neutral-300">
                            {v.chapterSeqs.length}
                          </span>
                        </div>
                        {open && vchs.map((c) => chapterRow(c))}
                      </div>
                    )
                  })}

                  {/* 未分卷章节（系统分组，名称可自定义：双击重命名） */}
                  {unassigned.length > 0 && (
                    <div>
                      <div
                        className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-700"
                        onClick={onUnassignedRowClick}
                        onDoubleClick={onUnassignedRowDblClick}
                        title={`${unassignedLabel || '未分卷'}（系统分组，双击重命名；点击箭头展开/折叠）`}
                      >
                        <button
                          className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded text-neutral-300 transition-colors duration-fast hover:bg-neutral-200 hover:text-neutral-700"
                          title={unassignedOpen ? '折叠分组' : '展开分组'}
                          onClick={(e) => {
                            e.stopPropagation()
                            setUnassignedOpen((v) => !v)
                          }}
                        >
                          <Icon
                            name="chevron-down"
                            size={11}
                            className={`${unassignedOpen ? 'rotate-0' : '-rotate-90'} transition-transform duration-base`}
                          />
                        </button>
                        <Icon name="text" size={12} className="text-neutral-300" />
                        <span className="text-[11px]">{unassignedLabel || '未分卷'}</span>
                        <span className="text-[10px] tabular-nums text-neutral-300">{unassigned.length}</span>
                      </div>
                      {unassignedOpen && unassigned.map((c) => chapterRow(c))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderOutline = (): React.JSX.Element => {
    if (outline.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="text-[26px] text-brand-500">·</span>
          <span className="text-[14px] font-semibold text-neutral-900">暂无大纲</span>
          <span className="text-[12px] text-neutral-500">
            在正文中使用 H1/H2/H3 标题，将自动生成可点击跳转的大纲
          </span>
        </div>
      )
    }
    return (
      <div className="py-1">
        {outline.map((item, i) => (
          <div
            key={i}
            className="flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-[5px] transition-colors duration-fast hover:bg-neutral-100"
            style={{ paddingLeft: `${10 + (item.level - 1) * 14}px` }}
            onClick={() => requestJump(i)}
            title={`跳转到：${item.title}`}
          >
            <span className="w-[26px] shrink-0 text-[10px] tabular-nums text-neutral-300">
              H{item.level}
            </span>
            <span className="truncate text-neutral-700">{item.title}</span>
          </div>
        ))}
      </div>
    )
  }

  const notesHeader = (label: string, count: number, onNew: () => void): React.JSX.Element => (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-[11px] text-neutral-400">
        {label}（{count}）
      </span>
      <button
        className="rounded px-1.5 py-0.5 text-[12px] text-brand-500 transition-colors duration-fast hover:bg-brand-50"
        onClick={onNew}
      >
        + 新建
      </button>
    </div>
  )

  const emptyHint = (text: string): React.JSX.Element => (
    <div className="px-4 py-6 text-center text-[12px] text-neutral-400">{text}</div>
  )

  /** 伏笔卡片视图：状态徽标 + 原文锚点 + 定位原文/编辑，与编辑器标记双向联动。 */
  const renderClueCards = (): React.JSX.Element => {
    const filtered = notes.filter((n) => n.kind === 'clue')
    const visible = q
      ? filtered.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tag.toLowerCase().includes(q) ||
            (n.anchorText ?? '').toLowerCase().includes(q)
        )
      : filtered
    return (
      <div className="flex h-full flex-col">
        {notesHeader('伏笔', filtered.length, () => setEditing({ kind: 'clue', note: null }))}
        {visible.length === 0 ? (
          emptyHint(q ? '未找到匹配内容' : '还没有伏笔，在编辑器中选中文本即可「创建伏笔」')
        ) : (
          <div className="space-y-1.5 px-1">
            {visible.map((n) => {
              const status = clueStatusOf(n)
              return (
                <div
                  key={n.id}
                  data-note-id={n.id}
                  className={`rounded-md border p-2 transition-colors duration-base ${
                    flashClueId === n.id
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/25'
                      : 'border-neutral-200 bg-neutral-0 hover:border-brand-500/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium text-neutral-900">{n.title}</span>
                    <span
                      className={`shrink-0 rounded-sm px-1 py-px text-[10px] ${CLUE_STATUS_CLS[status] ?? CLUE_STATUS_CLS.other}`}
                    >
                      {n.tag || '未标记'}
                    </span>
                  </div>
                  {n.anchorText && (
                    <p className="mt-1 line-clamp-2 rounded-sm bg-neutral-50 px-1.5 py-1 text-[10px] leading-[1.6] text-neutral-500">
                      原文：{n.anchorText}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    {n.anchorText && n.chapterSeq != null && (
                      <button
                        className="text-[11px] text-brand-500 transition-colors duration-fast hover:text-brand-300"
                        onClick={() => void locateClue(n)}
                        title="定位到编辑器原文选中片段"
                      >
                        定位原文
                      </button>
                    )}
                    <button
                      className="text-[11px] text-neutral-500 transition-colors duration-fast hover:text-neutral-900"
                      onClick={() => setEditing({ kind: 'clue', note: n })}
                    >
                      编辑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderNotes = (kind: NoteKind): React.JSX.Element => {
    if (kind === 'clue') return renderClueCards()
    const label = KIND_LABEL[kind]
    const filtered = notes.filter((n) => n.kind === kind)
    const visible = q
      ? filtered.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tag.toLowerCase().includes(q)
        )
      : filtered
    return (
      <div className="flex h-full flex-col">
        {notesHeader(label, filtered.length, () => setEditing({ kind, note: null }))}
        {visible.length === 0 ? (
          emptyHint(q ? '未找到匹配内容' : `还没有${label}，点击「+ 新建」创建`)
        ) : (
          <div className="space-y-0.5 px-1">
            {visible.map((n) => (
              <button
                key={n.id}
                className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left transition-colors duration-fast hover:bg-neutral-100"
                onClick={() => setEditing({ kind, note: n })}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="truncate text-[12px] text-neutral-900">{n.title}</span>
                  {n.tag && (
                    <span className="shrink-0 rounded-sm bg-brand-50 px-1 py-px text-[10px] text-brand-500">
                      {n.tag}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-neutral-300">
                  {new Date(n.updatedAt).toLocaleDateString('zh-CN')}
                  {n.chapterSeq != null ? ` · 第${n.chapterSeq}章` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      {/* 顶部操作行 */}
      <div className="flex items-center gap-1.5 px-2 pt-2">
        <button
          className="rounded-md px-2 py-1 text-[12px] text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900"
          onClick={() => setPromptKind('work')}
        >
          + 作品
        </button>
        <button
          className="rounded-md px-2 py-1 text-[12px] text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900"
          onClick={() => setPromptKind('chapter')}
        >
          + 章节
        </button>
        <button
          className="rounded-md px-2 py-1 text-[12px] text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900"
          title="新建卷（章节层级容器）"
          onClick={() => setPrompt({ type: 'create-volume' })}
        >
          + 卷
        </button>
        <button
          className="ml-auto rounded-md px-2 py-1 text-[12px] text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900"
          title="折叠侧栏"
          onClick={onToggleCollapse}
        >
          ‹‹
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-2 py-2">
        <div className="flex h-[30px] items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-0 px-2.5">
          <Icon name="search" size={14} className="text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[12px] text-neutral-900 outline-none placeholder:text-neutral-300"
            placeholder="搜索作品 / 章节 / 卷 / 知识…"
          />
          {search && (
            <button
              className="text-neutral-300 transition-colors duration-fast hover:text-neutral-900"
              onClick={() => setSearch('')}
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tab：上下结构（图标在上 · 名称在下），避免 7 个 Tab 横向溢出换行 */}
      <div className="grid grid-cols-7 gap-0.5 px-1 pt-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`relative flex h-[46px] flex-col items-center justify-center gap-0.5 rounded-t-md text-[10.5px] leading-none transition-colors duration-fast ${
              tab === t.key
                ? 'bg-neutral-0 font-medium text-brand-500'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={15} />
            <span className="px-0.5 truncate max-w-full">{t.label}</span>
            {tab === t.key && (
              <span className="absolute inset-x-[18%] -bottom-px h-[2px] rounded-t bg-brand-500" />
            )}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-1 pb-2 text-[12px]">
        {tab === 'works' && renderWorks()}
        {tab === 'outline' && renderOutline()}
        {tab === 'timeline' && renderTimeline()}
        {(tab === 'roles' || tab === 'world' || tab === 'clues' || tab === 'materials') &&
          renderNotes(KIND_BY_TAB[tab])}
      </div>

      {editing && (
        <NoteEditorDialog
          kind={editing.kind}
          note={editing.note}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.type === 'work'
              ? '删除作品'
              : confirmDelete.type === 'volume'
                ? '删除卷'
                : confirmDelete.type === 'timeline'
                  ? '删除时间线'
                  : '删除章节'
          }
          message={
            confirmDelete.type === 'volume'
              ? `确定要删除卷「${confirmDelete.name}」吗？卷内章节将保留为未分卷。`
              : `确定要删除「${confirmDelete.name}」吗？此操作不可恢复。`
          }
          confirmLabel="删除"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete.type === 'work') {
              const id = confirmDelete.id ?? currentWorkId
              if (id) void deleteWork(id)
            } else if (confirmDelete.type === 'chapter') {
              const seq = confirmDelete.id != null ? Number(confirmDelete.id) : currentChapter?.seq
              if (seq != null) void deleteChapter(seq)
            } else if (confirmDelete.type === 'volume' && currentWorkId && confirmDelete.id) {
              void deleteVolume(confirmDelete.id)
            } else if (confirmDelete.type === 'timeline' && currentWorkId && confirmDelete.id) {
              void deleteTimelineEntry(confirmDelete.id)
            }
            setConfirmDelete(null)
          }}
        />
      )}

      {prompt && meta && (
        <PromptModal
          title={meta.title}
          placeholder={meta.placeholder}
          initialValue={meta.initial}
          onConfirm={handlePromptConfirm}
          onCancel={() => setPrompt(null)}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </aside>
  )
}
