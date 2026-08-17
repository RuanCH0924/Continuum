import React, { useRef, useState } from 'react'
import { Icon } from './Icon'
import { useAiStore } from '../stores/aiStore'
import { useAppStore } from '../stores/appStore'

/**
 * AI 问答「引用上下文 + 知识库来源」（PRD v1.0 §10）。
 * 知识库来源：RAG 检索注入 / 本书内容（大纲+章纲+正文+创作知识）；
 * 可选中大纲节点或指定章节作为显式引用（胶囊可删）。
 */
export function ChatScopePicker(): React.JSX.Element {
  const chatSource = useAiStore((s) => s.chatSource)
  const setChatSource = useAiStore((s) => s.setChatSource)
  const chatRefs = useAiStore((s) => s.chatRefs)
  const addChatRef = useAiStore((s) => s.addChatRef)
  const removeChatRef = useAiStore((s) => s.removeChatRef)
  const outlineNodes = useAppStore((s) => s.outlineNodes)
  const chapters = useAppStore((s) => s.chapters)
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  const roots = outlineNodes.filter((n) => n.parentId === null)

  return (
    <div className="relative">
      {/* 知识库来源 + 引用按钮 */}
      <div className="flex items-center gap-2 text-[10px] text-neutral-400">
        <span>知识库来源</span>
        <select
          value={chatSource}
          onChange={(e) => setChatSource(e.target.value as 'rag' | 'book')}
          className="rounded-sm border border-neutral-200 bg-neutral-0 px-1 py-0.5 text-[10px] text-neutral-600 outline-none"
        >
          <option value="rag">注入知识库（RAG 检索）</option>
          <option value="book">本书内容（大纲+章纲+正文+知识）</option>
        </select>
        <button
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-brand-500 transition-colors duration-fast hover:bg-brand-50"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="plus" size={11} />
          引用
        </button>
      </div>

      {/* 引用胶囊 */}
      {chatRefs.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {chatRefs.map((r) => (
            <span
              key={`${r.kind}-${r.id}`}
              className="flex items-center gap-1 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-500"
            >
              📎 {r.label}
              <button className="text-brand-300 transition-colors duration-fast hover:text-status-danger" onClick={() => removeChatRef(r.id)}>
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 引用选择弹层 */}
      {open && (
        <div
          ref={popRef}
          className="absolute bottom-full left-0 z-30 mb-1 max-h-[260px] w-[280px] overflow-y-auto rounded-md border border-neutral-200 bg-neutral-0 p-1.5 shadow-2"
        >
          <div className="px-1.5 py-1 text-[10px] font-medium text-neutral-400">大纲节点</div>
          {roots.length === 0 && <div className="px-1.5 py-1 text-[10px] text-neutral-300">暂无大纲节点</div>}
          {roots.map((n) => (
            <RefRow
              key={n.id}
              label={`${n.title}${n.content ? `：${n.content.slice(0, 20)}` : ''}`}
              indent={0}
              added={chatRefs.some((r) => r.kind === 'outline' && r.id === n.id)}
              onAdd={() => addChatRef({ kind: 'outline', id: n.id, label: `大纲《${n.title}》` })}
            />
          ))}
          <div className="mt-1 px-1.5 py-1 text-[10px] font-medium text-neutral-400">章节正文</div>
          {chapters.map((c) => (
            <RefRow
              key={c.seq}
              label={`第${c.seq}章 · ${c.title}`}
              indent={0}
              added={chatRefs.some((r) => r.kind === 'chapter' && r.id === String(c.seq))}
              onAdd={() => addChatRef({ kind: 'chapter', id: String(c.seq), label: `第${c.seq}章《${c.title}》` })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RefRow({
  label,
  indent,
  added,
  onAdd
}: {
  label: string
  indent: number
  added: boolean
  onAdd: () => void
}): React.JSX.Element {
  return (
    <button
      className={`flex w-full items-center gap-1 rounded-sm px-1.5 py-1 text-left text-[11px] transition-colors duration-fast hover:bg-neutral-100 ${
        added ? 'text-brand-500' : 'text-neutral-600'
      }`}
      style={{ paddingLeft: `${8 + indent * 12}px` }}
      disabled={added}
      onClick={onAdd}
      title={added ? '已引用' : '加入引用'}
    >
      <span className="truncate">{label}</span>
      {added && <Icon name="check" size={11} className="ml-auto shrink-0" />}
    </button>
  )
}
