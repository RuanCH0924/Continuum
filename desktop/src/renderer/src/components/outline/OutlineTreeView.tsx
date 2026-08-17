import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { PromptModal } from '../PromptModal'
import { ConfirmDialog } from '../ConfirmDialog'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { useAppStore } from '../../stores/appStore'
import { useUiStore } from '../../stores/uiStore'
import { useToastStore } from '../../stores/toastStore'
import { BEAT_CLS, BEAT_LABELS, isKeyNode } from '../../lib/outline/beats'
import type { ChapterMeta, Note, OutlineNode } from '@shared/types'

type PromptState =
  | { type: 'rename'; node: OutlineNode }
  | { type: 'create-child'; parentId: string | null; kind: 'story' | 'volume' }
  | null

/**
 * 大纲列表视图（PRD v1.0 §6.3）：左侧大纲树（展开/折叠、双击重命名、右键增删排序）
 * + 右侧节点详情编辑（节奏标签 / 预估字数 / 关联章节 / 涉及角色 / 剧情梗概）。
 */
export function OutlineTreeView({ granular }: { granular: 'core' | 'full' }): React.JSX.Element {
  const nodes = useAppStore((s) => s.outlineNodes)
  const chapters = useAppStore((s) => s.chapters)
  const notes = useAppStore((s) => s.notes)
  const createOutlineNode = useAppStore((s) => s.createOutlineNode)
  const saveOutlineNode = useAppStore((s) => s.saveOutlineNode)
  const deleteOutlineNode = useAppStore((s) => s.deleteOutlineNode)
  const reorderOutlineNodes = useAppStore((s) => s.reorderOutlineNodes)
  const selectChapter = useAppStore((s) => s.selectChapter)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<number | undefined>(undefined)
  const [prompt, setPrompt] = useState<PromptState>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ node: OutlineNode } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  /** 大纲节点聚焦信号（侧栏导航 / 工作台内跳转） */
  const outlineFocus = useUiStore((s) => s.outlineFocus)
  const setOutlineFocus = useUiStore((s) => s.setOutlineFocus)
  /** 行单击配对检测双击（S4：与折叠图标分离） */
  const lastClick = useRef<{ id: string; ts: number } | null>(null)

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  )
  const characterNotes = useMemo(() => notes.filter((n) => n.kind === 'character'), [notes])

  // 工作台 / 侧栏节点定位：滚动 + 1.8s 高亮 + 展开父链
  useEffect(() => {
    if (!outlineFocus) return
    const el = document.querySelector(`[data-outline-id="${outlineFocus.nodeId}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setFlashId(outlineFocus.nodeId)
      setSelectedId(outlineFocus.nodeId)
      // 展开祖先链
      setExpanded((prev) => {
        const next = new Set(prev)
        let parentId = nodes.find((n) => n.id === outlineFocus.nodeId)?.parentId ?? null
        while (parentId) {
          next.add(parentId)
          parentId = nodes.find((n) => n.id === parentId)?.parentId ?? null
        }
        return next
      })
      window.clearTimeout(flashTimer.current)
      flashTimer.current = window.setTimeout(() => {
        setFlashId(null)
        setOutlineFocus(null)
      }, 1800)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineFocus?.ts, outlineFocus?.nodeId, nodes])

  const childrenOf = (parentId: string | null): OutlineNode[] =>
    nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order)

  /** 粒度过滤：「仅核心节点」隐藏非关键叶子（无关键后代且 beat=other）。 */
  const visibleIds = useMemo(() => {
    if (granular === 'full') return null
    const keyIds = new Set(nodes.filter((n) => isKeyNode(n.beat)).map((n) => n.id))
    // 收集关键节点的祖先链
    for (const n of nodes) {
      if (!keyIds.has(n.id)) continue
      let p = n.parentId
      while (p) {
        keyIds.add(p)
        p = nodes.find((x) => x.id === p)?.parentId ?? null
      }
    }
    return keyIds
  }, [nodes, granular])

  const isVisible = (n: OutlineNode): boolean => !visibleIds || visibleIds.has(n.id)

  const openCtxMenu = (e: React.MouseEvent, node: OutlineNode): void => {
    e.preventDefault()
    e.stopPropagation()
    const siblings = childrenOf(node.parentId)
    const idx = siblings.findIndex((s) => s.id === node.id)
    const items: ContextMenuItem[] = [
      { type: 'item', label: '新建子节点', onClick: () => setPrompt({ type: 'create-child', parentId: node.id, kind: 'story' }) },
      { type: 'item', label: '重命名', onClick: () => setPrompt({ type: 'rename', node }) },
      node.kind === 'story'
        ? { type: 'item', label: '转为卷纲', onClick: () => void saveOutlineNode({ ...node, kind: 'volume' }) }
        : { type: 'item', label: '转为剧情节点', onClick: () => void saveOutlineNode({ ...node, kind: 'story' }) },
      { type: 'separator' },
      { type: 'item', label: '上移', disabled: idx <= 0, onClick: () => swap(node.parentId, idx, idx - 1) },
      { type: 'item', label: '下移', disabled: idx === siblings.length - 1, onClick: () => swap(node.parentId, idx, idx + 1) },
      { type: 'separator' },
      { type: 'item', label: '删除节点', danger: true, onClick: () => setConfirmDelete({ node }) }
    ]
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }

  const swap = (parentId: string | null, a: number, b: number): void => {
    const siblings = childrenOf(parentId)
    const ids = siblings.map((s) => s.id)
    ;[ids[a], ids[b]] = [ids[b], ids[a]]
    void reorderOutlineNodes(parentId, ids)
  }

  const toggleExpand = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** 行单击：500ms 内再次点击同一行判定为双击 → 打开重命名弹窗（S4）。 */
  const onRowClick = (node: OutlineNode): void => {
    setSelectedId(node.id)
    const now = Date.now()
    const prev = lastClick.current
    lastClick.current = { id: node.id, ts: now }
    if (prev && prev.id === node.id && now - prev.ts <= 500) {
      setPrompt({ type: 'rename', node })
    }
  }
  const onRowDblClick = (node: OutlineNode): void => {
    setPrompt({ type: 'rename', node })
  }

  const row = (node: OutlineNode, depth: number): React.JSX.Element => {
    const hasChildren = nodes.some((n) => n.parentId === node.id)
    const open = expanded.has(node.id)
    const cls = flashId === node.id
      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/25'
      : selectedId === node.id
        ? 'border-neutral-200 bg-neutral-50'
        : 'border-transparent'
    return (
      <div key={node.id}>
        <div
          data-outline-id={node.id}
          className={`group flex cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-1 transition-colors duration-fast hover:bg-neutral-100 ${cls}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onRowClick(node)}
          onDoubleClick={() => onRowDblClick(node)}
          onContextMenu={(e) => openCtxMenu(e, node)}
          title={`${node.title}（双击重命名；右键更多操作）`}
        >
          <button
            className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded text-neutral-300 transition-colors duration-fast hover:bg-neutral-200 hover:text-neutral-700 ${hasChildren ? '' : 'invisible'}`}
            title={open ? '折叠' : '展开'}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(node.id)
            }}
          >
            <Icon
              name="chevron-down"
              size={11}
              className={`${open ? 'rotate-0' : '-rotate-90'} transition-transform duration-base`}
            />
          </button>
          <Icon name={node.kind === 'volume' ? 'book' : 'flag'} size={13} className={node.kind === 'volume' ? 'text-brand-500' : 'text-neutral-300'} />
          <span className={`min-w-0 flex-1 truncate text-[12px] ${selectedId === node.id ? 'font-medium text-brand-500' : 'text-neutral-700'}`}>
            {node.title}
          </span>
          {node.beat !== 'other' && (
            <span className={`shrink-0 rounded-sm px-1 py-px text-[10px] ${BEAT_CLS[node.beat]}`}>
              {BEAT_LABELS[node.beat]}
            </span>
          )}
          {node.targetWords > 0 && (
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-300">
              {node.targetWords >= 10000 ? `${(node.targetWords / 10000).toFixed(1)}万` : `${node.targetWords}`}
            </span>
          )}
        </div>
        {open && hasChildren && (
          <div className="ml-[9px] border-l border-neutral-100 pl-1">
            {childrenOf(node.id)
              .filter(isVisible)
              .map((c) => row(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const handlePromptConfirm = (value: string): void => {
    if (!prompt) return
    if (prompt.type === 'rename') {
      void saveOutlineNode({ ...prompt.node, title: value })
      useToastStore.getState().notify('success', '节点已重命名')
    } else {
      void createOutlineNode(value, prompt.parentId, prompt.kind)
    }
    setPrompt(null)
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* 左：大纲树 */}
      <div className="w-[280px] shrink-0 overflow-y-auto border-r border-neutral-200 py-1">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="text-[26px] text-brand-500">·</span>
            <span className="text-[14px] font-semibold text-neutral-900">暂无大纲</span>
            <span className="text-[12px] text-neutral-500">点击右上角「+ 新建节点」搭建故事框架</span>
          </div>
        ) : (
          childrenOf(null)
            .filter(isVisible)
            .map((n) => row(n, 0))
        )}
      </div>

      {/* 右：节点详情 */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {selected ? (
          <NodePanel
            key={selected.id}
            node={selected}
            chapters={chapters}
            characters={characterNotes}
            onSave={(patch) => void saveOutlineNode({ ...selected, ...patch })}
            onLocate={(seq) => {
              void selectChapter(seq)
              useUiStore.getState().setCentralMode('editor')
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-300">
            <Icon name="flag" size={28} />
            <span className="text-[12px]">选择左侧大纲节点查看与编辑详情</span>
          </div>
        )}
      </div>

      {prompt && (
        <PromptModal
          title={prompt.type === 'rename' ? '重命名节点' : prompt.kind === 'volume' ? '新建卷纲' : '新建剧情节点'}
          placeholder={prompt.type === 'rename' ? '节点标题' : '节点标题（如：北境初雪）'}
          initialValue={prompt.type === 'rename' ? prompt.node.title : ''}
          onConfirm={handlePromptConfirm}
          onCancel={() => setPrompt(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="删除大纲节点"
          message={`确定要删除节点「${confirmDelete.node.title}」吗？其全部子节点将一并删除，此操作不可恢复。`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            void deleteOutlineNode(confirmDelete.node.id)
            setConfirmDelete(null)
          }}
        />
      )}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  )
}

/** 节点详情编辑面板：节奏标签 / 预估字数 / 关联章节 / 涉及角色 / 剧情梗概。 */
function NodePanel({
  node,
  chapters,
  characters,
  onSave,
  onLocate
}: {
  node: OutlineNode
  chapters: ChapterMeta[]
  characters: Note[]
  onSave: (patch: Partial<OutlineNode>) => void
  onLocate: (seq: number) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(node)
  const timer = useRef<number | undefined>(undefined)
  const isFirst = useRef(true)

  // 节点切换时重置草稿
  useEffect(() => {
    setDraft(node)
    isFirst.current = true
  }, [node.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const schedule = (patch: Partial<OutlineNode>): void => {
    const next = { ...draft, ...patch }
    setDraft(next)
    window.clearTimeout(timer.current)
    // 首帧（外部同步刷新触发）不重复保存
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    timer.current = window.setTimeout(() => onSave(next), 400)
  }

  const toggleSeq = (seq: number): void => {
    const cur = draft.chapterSeqs ?? []
    schedule({ chapterSeqs: cur.includes(seq) ? cur.filter((s) => s !== seq) : [...cur, seq] })
  }
  const toggleChar = (id: string): void => {
    const cur = draft.characterIds ?? []
    schedule({ characterIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-3">
      <input
        value={draft.title}
        onChange={(e) => schedule({ title: e.target.value })}
        placeholder="节点标题"
        className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[15px] font-medium text-neutral-900 outline-none focus:border-brand-500"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[12px] text-neutral-500">
          节奏标签
          <select
            value={draft.beat}
            onChange={(e) => schedule({ beat: e.target.value as OutlineNode['beat'] })}
            className="rounded-sm border border-neutral-200 bg-neutral-0 px-1 py-0.5 text-[12px] text-neutral-900 outline-none"
          >
            {(Object.keys(BEAT_LABELS) as OutlineNode['beat'][]).map((b) => (
              <option key={b} value={b}>
                {BEAT_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-neutral-500">
          预估字数
          <input
            type="number"
            min={0}
            step={1000}
            value={draft.targetWords || ''}
            onChange={(e) => schedule({ targetWords: Math.max(0, Number(e.target.value) || 0) })}
            placeholder="如 50000"
            className="w-[92px] rounded-sm border border-neutral-200 bg-neutral-0 px-1 py-0.5 text-[12px] text-neutral-900 outline-none"
          />
        </label>
        <span className="text-[11px] text-neutral-300">类型：{draft.kind === 'volume' ? '卷纲' : '剧情节点'}</span>
      </div>

      <div>
        <div className="mb-1 text-[11px] text-neutral-400">关联章节（点击跳转）</div>
        <div className="flex flex-wrap gap-1">
          {chapters.length === 0 && <span className="text-[11px] text-neutral-300">暂无章节</span>}
          {chapters.map((c) => {
            const active = (draft.chapterSeqs ?? []).includes(c.seq)
            return (
              <span
                key={c.seq}
                className={`flex cursor-pointer items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors duration-fast ${
                  active ? 'border-brand-500 bg-brand-50 text-brand-500' : 'border-neutral-200 text-neutral-500 hover:border-brand-500/40'
                }`}
                onClick={() => toggleSeq(c.seq)}
                onDoubleClick={() => onLocate(c.seq)}
                title={`第${c.seq}章 ${c.title}（单击切换关联；双击跳转正文）`}
              >
                第{c.seq}章
              </span>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] text-neutral-400">涉及角色（关联角色卡）</div>
        <div className="flex flex-wrap gap-1">
          {characters.length === 0 && <span className="text-[11px] text-neutral-300">暂无角色卡，可在侧栏「角色」中创建</span>}
          {characters.map((n) => {
            const active = (draft.characterIds ?? []).includes(n.id)
            return (
              <span
                key={n.id}
                className={`cursor-pointer rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors duration-fast ${
                  active ? 'border-brand-500 bg-brand-50 text-brand-500' : 'border-neutral-200 text-neutral-500 hover:border-brand-500/40'
                }`}
                onClick={() => toggleChar(n.id)}
              >
                {n.title}
              </span>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] text-neutral-400">剧情梗概（Markdown）</div>
        <textarea
          value={draft.content}
          onChange={(e) => schedule({ content: e.target.value })}
          rows={10}
          placeholder="描述该节点的剧情走向、关键事件、角色成长等…"
          className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] leading-[1.7] text-neutral-700 outline-none focus:border-brand-500"
        />
      </div>
      <p className="text-right text-[10px] text-neutral-300">编辑后自动保存（输入暂停 400ms）</p>
    </div>
  )
}
