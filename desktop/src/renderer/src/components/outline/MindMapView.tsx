import React, { useMemo, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { PromptModal } from '../PromptModal'
import { ConfirmDialog } from '../ConfirmDialog'
import { useAppStore } from '../../stores/appStore'
import { useUiStore } from '../../stores/uiStore'
import { useToastStore } from '../../stores/toastStore'
import type { MindMapNode } from '@shared/types'

const H_GAP = 190
const V_GAP = 46
const NODE_W = 150
const NODE_H = 34

/** 思维导图视图（PRD v1.0 §8）：SVG 树状图（缩放/平移），增删改节点、XMind 文本导入、转大纲。 */
export function MindMapView(): React.JSX.Element {
  const mindMap = useAppStore((s) => s.mindMap)
  const createMindMap = useAppStore((s) => s.createMindMap)
  const saveMindMap = useAppStore((s) => s.saveMindMap)
  const importMindMap = useAppStore((s) => s.importMindMap)
  const convertMindMapToOutline = useAppStore((s) => s.convertMindMapToOutline)
  const setOutlineView = useUiStore((s) => s.setOutlineView)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<MindMapNode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MindMapNode | null>(null)
  const [noteTarget, setNoteTarget] = useState<MindMapNode | null>(null)
  const [noteText, setNoteText] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const drag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const selected = useMemo(
    () => (mindMap ? findNode(mindMap.root, selectedId) : null),
    [mindMap, selectedId]
  )

  if (!mindMap) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <span className="text-[26px] text-brand-500">·</span>
        <span className="text-[14px] font-semibold text-neutral-900">还没有思维导图</span>
        <span className="max-w-[360px] text-center text-[12px] text-neutral-500">
          用导图可视化搭建核心剧情线、人物关系网或世界观设定；也可导入 XMind 导出的文本大纲
        </span>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {(
            [
              ['story', '剧情线模板'],
              ['characters', '人物关系模板'],
              ['world', '世界观模板']
            ] as const
          ).map(([kind, label]) => (
            <button key={kind} className="btn-default !px-3 !py-1.5 text-[12px]" onClick={() => void createMindMap(kind)}>
              {label}
            </button>
          ))}
          <button className="btn-primary !px-3 !py-1.5 text-[12px]" onClick={() => setImportOpen(true)}>
            导入文本（XMind）
          </button>
        </div>
      </div>
    )
  }

  const update = (mutate: (root: MindMapNode) => MindMapNode): void => {
    const root = structuredClone(mindMap.root)
    const next = mutate(root)
    void saveMindMap({ ...mindMap, root: next })
  }

  const addChild = (): void => {
    if (!selected) return
    const id = `mm_${Date.now().toString(36)}`
    update((root) => {
      mutateNode(root, selected.id, (n) => n.children.push({ id, text: '新节点', children: [] }))
      return root
    })
    setSelectedId(id)
  }

  const addSibling = (): void => {
    if (!selected || selected.id === mindMap.root.id) return
    const parent = findParent(mindMap.root, selected.id)
    if (!parent) return
    const id = `mm_${Date.now().toString(36)}`
    update((root) => {
      mutateNode(root, parent.id, (n) => n.children.push({ id, text: '新节点', children: [] }))
      return root
    })
    setSelectedId(id)
  }

  const removeNode = (): void => {
    if (!deleteTarget) return
    update((root) => {
      if (root.id === deleteTarget.id) {
        root.children = []
        root.text = '作品总纲'
        root.note = undefined
      } else {
        pruneNode(root, deleteTarget.id)
      }
      return root
    })
    setDeleteTarget(null)
  }

  const doImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const res = await importMindMap(importText)
      useToastStore.getState().notify(
        'success',
        res ? `已导入思维导图${res.fixed > 0 ? `（自动修正 ${res.fixed} 处缩进）` : ''}` : '导入失败'
      )
      setImportOpen(false)
      setImportText('')
    } catch (err) {
      useToastStore.getState().notify('error', err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const doConvert = (): void => {
    void convertMindMapToOutline()
    setOutlineView('list')
    useToastStore.getState().notify('success', '已按导图分支生成大纲节点')
  }

  const positions = layout(mindMap.root)
  const totalW = Math.max(...positions.map((p) => p.x)) + NODE_W + pan.x * 2
  const totalH = Math.max(...positions.map((p) => p.y)) + NODE_H + pan.y * 2

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 px-4 py-2 text-[12px] text-neutral-500">
        <button className="btn-default !px-2 !py-1 text-[11px]" disabled={!selected} onClick={addChild} title="为选中节点添加子节点">
          + 子节点
        </button>
        <button className="btn-default !px-2 !py-1 text-[11px]" disabled={!selected || selected.id === mindMap.root.id} onClick={addSibling} title="为选中节点添加同级节点">
          + 同级
        </button>
        <button className="btn-default !px-2 !py-1 text-[11px]" disabled={!selected} onClick={() => setRenameTarget(selected)}>
          重命名
        </button>
        <button
          className="btn-default !px-2 !py-1 text-[11px]"
          disabled={!selected}
          onClick={() => {
            setNoteTarget(selected)
            setNoteText(selected?.note ?? '')
          }}
        >
          备注
        </button>
        <button className="btn-default !px-2 !py-1 text-[11px]" disabled={!selected} onClick={() => setDeleteTarget(selected)}>
          删除
        </button>
        <span className="h-[16px] w-px bg-neutral-200" />
        <button className="btn-default !px-2 !py-1 text-[11px]" onClick={() => setImportOpen(true)}>
          导入文本
        </button>
        <button className="btn-default !px-2 !py-1 text-[11px]" onClick={doConvert}>
          转为大纲
        </button>
        <span className="ml-auto flex items-center gap-1">
          <button className="rounded px-1 hover:bg-neutral-100" title="缩小" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))}>
            −
          </button>
          <span className="w-[34px] text-center text-[11px] tabular-nums">{Math.round(scale * 100)}%</span>
          <button className="rounded px-1 hover:bg-neutral-100" title="放大" onClick={() => setScale((s) => Math.min(1.5, +(s + 0.1).toFixed(2)))}>
            ＋
          </button>
        </span>
      </div>

      {/* 画布 */}
      <div
        className="min-h-0 flex-1 overflow-auto bg-neutral-50/50"
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return
          e.preventDefault()
          const delta = e.deltaY > 0 ? -0.1 : 0.1
          setScale((s) => Math.min(1.5, Math.max(0.5, +(s + delta).toFixed(2))))
        }}
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return
          drag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
        }}
        onMouseMove={(e) => {
          if (!drag.current) return
          setPan({
            x: drag.current.panX + (e.clientX - drag.current.startX),
            y: drag.current.panY + (e.clientY - drag.current.startY)
          })
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      >
        <div style={{ width: totalW, height: totalH, position: 'relative' }}>
          <svg width={totalW} height={totalH} className="absolute inset-0">
            <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
              {/* 连线 */}
              {positions.map((p) =>
                p.parent ? (
                  <path
                    key={`l-${p.id}`}
                    d={`M ${p.parent.x + NODE_W} ${p.parent.y + NODE_H / 2} C ${(p.parent.x + p.x) / 2 + NODE_W / 2} ${p.parent.y + NODE_H / 2}, ${(p.parent.x + p.x) / 2 + NODE_W / 2} ${p.y + NODE_H / 2}, ${p.x} ${p.y + NODE_H / 2}`}
                    fill="none"
                    stroke="var(--neutral-200)"
                    strokeWidth={1.4}
                  />
                ) : null
              )}
              {/* 节点 */}
              {positions.map((p) => {
                const isSel = p.id === selectedId
                const isRoot = p.id === mindMap.root.id
                return (
                  <g
                    key={p.id}
                    transform={`translate(${p.x} ${p.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(p.id)
                    }}
                    onDoubleClick={() => setRenameTarget(p.node)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={7}
                      fill={isSel ? 'var(--brand-50)' : isRoot ? 'var(--neutral-900)' : 'var(--neutral-0)'}
                      stroke={isSel ? 'var(--brand-500)' : isRoot ? 'transparent' : 'var(--neutral-200)'}
                      strokeWidth={isSel ? 1.6 : 1}
                    />
                    <text
                      x={NODE_W / 2}
                      y={NODE_H / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fill={isRoot ? '#fff' : 'var(--neutral-700)'}
                      style={{ pointerEvents: 'none' }}
                    >
                      {truncate(p.node.text, 12)}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
      </div>

      {renameTarget && (
        <PromptModal
          title="重命名节点"
          placeholder="节点名称"
          initialValue={renameTarget.text}
          onConfirm={(v) => {
            update((root) => {
              mutateNode(root, renameTarget.id, (n) => {
                n.text = v
              })
              return root
            })
            setRenameTarget(null)
          }}
          onCancel={() => setRenameTarget(null)}
        />
      )}
      {noteTarget && (
        <NoteModal
          initial={noteText}
          onCancel={() => setNoteTarget(null)}
          onConfirm={(v) => {
            update((root) => {
              mutateNode(root, noteTarget.id, (n) => {
                n.note = v
              })
              return root
            })
            setNoteTarget(null)
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="删除导图节点"
          message={`确定要删除节点「${deleteTarget.text}」吗？其全部子节点将一并删除。`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeNode}
        />
      )}
      {importOpen && (
        <ImportModal
          value={importText}
          loading={importing}
          onChange={setImportText}
          onCancel={() => {
            setImportOpen(false)
            setImportText('')
          }}
          onConfirm={() => void doImport()}
        />
      )}
    </div>
  )
}

// ============================================================ 工具函数

function findNode(node: MindMapNode, id: string | null): MindMapNode | null {
  if (!id) return null
  if (node.id === id) return node
  for (const c of node.children) {
    const found = findNode(c, id)
    if (found) return found
  }
  return null
}

function findParent(node: MindMapNode, id: string): MindMapNode | null {
  if (node.children.some((c) => c.id === id)) return node
  for (const c of node.children) {
    const found = findParent(c, id)
    if (found) return found
  }
  return null
}

function mutateNode(node: MindMapNode, id: string, fn: (n: MindMapNode) => void): void {
  if (node.id === id) {
    fn(node)
    return
  }
  for (const c of node.children) mutateNode(c, id, fn)
}

function pruneNode(node: MindMapNode, id: string): void {
  node.children = node.children.filter((c) => c.id !== id)
  for (const c of node.children) pruneNode(c, id)
}

interface Positioned {
  id: string
  node: MindMapNode
  x: number
  y: number
  parent: Positioned | null
}

function layout(root: MindMapNode): Positioned[] {
  const out: Positioned[] = []
  let cursor = 0
  const dfs = (node: MindMapNode, depth: number, parent: Positioned | null): Positioned => {
    const pos: Positioned = { id: node.id, node, x: depth * H_GAP, y: 0, parent }
    if (node.children.length === 0) {
      pos.y = cursor
      cursor += V_GAP
    } else {
      const kids = node.children.map((c) => dfs(c, depth + 1, pos))
      pos.y = kids.length > 0 ? (kids[0].y + kids[kids.length - 1].y) / 2 : 0
    }
    out.push(pos)
    return pos
  }
  dfs(root, 0, null)
  return out
}

function truncate(text: string, n: number): string {
  return text.length > n ? text.slice(0, n) + '…' : text
}

function NoteModal({ initial, onConfirm, onCancel }: { initial: string; onConfirm: (v: string) => void; onCancel: () => void }): React.JSX.Element {
  const [value, setValue] = React.useState(initial)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onCancel}>
      <div className="w-[420px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-200 px-5 py-3 text-[14px] font-semibold text-neutral-900">节点备注（Markdown）</div>
        <div className="px-5 py-4">
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            placeholder="记录该节点的补充说明…"
            className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] leading-[1.7] text-neutral-700 outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button className="btn-default" onClick={onCancel}>
            取消
          </button>
          <button className="btn-primary" onClick={() => onConfirm(value)}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportModal({
  value,
  loading,
  onChange,
  onConfirm,
  onCancel
}: {
  value: string
  loading: boolean
  onChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onCancel}>
      <div className="w-[520px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-200 px-5 py-3 text-[14px] font-semibold text-neutral-900">导入思维导图文本</div>
        <div className="px-5 py-4">
          <p className="mb-2 text-[11px] leading-[1.6] text-neutral-400">
            支持 XMind 导出的大纲文本（Tab / 空格缩进）或 Markdown 列表 / 标题；首个非空行为根节点。
          </p>
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={10}
            placeholder={'主线剧情\n\t开篇\n\t\t获得金手指\n\t\t初遇女主\n\t发展\n\t高潮\n\t结局'}
            className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[12px] leading-[1.7] text-neutral-700 outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button className="btn-default" onClick={onCancel}>
            取消
          </button>
          <button className="btn-primary" disabled={loading || !value.trim()} onClick={onConfirm}>
            {loading ? '导入中…' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
