import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { computeToolbarLayout, type ToolbarLayoutItem } from '../lib/editorLayout'

type ToolSpec = {
  key: string
  label: string
  tip: string
  action: () => void
  active?: () => boolean
}

function makeTools(editor: Editor, onLink: () => void, onImage: () => void): ToolSpec[] {
  const chain = (): ReturnType<typeof editor.chain> => editor.chain().focus()
  return [
    { key: 'bold', label: 'B', tip: '加粗 (Ctrl+B)', action: () => void chain().toggleBold().run(), active: () => editor.isActive('bold') },
    { key: 'italic', label: 'I', tip: '斜体 (Ctrl+I)', action: () => void chain().toggleItalic().run(), active: () => editor.isActive('italic') },
    { key: 'underline', label: 'U', tip: '下划线 (Ctrl+U)', action: () => void chain().toggleUnderline().run(), active: () => editor.isActive('underline') },
    { key: 'strike', label: 'S', tip: '删除线', action: () => void chain().toggleStrike().run(), active: () => editor.isActive('strike') },
    { key: 'd1', label: '|', tip: '', action: () => undefined },
    { key: 'h1', label: 'H1', tip: '一级标题', action: () => void chain().toggleHeading({ level: 1 }).run(), active: () => editor.isActive('heading', { level: 1 }) },
    { key: 'h2', label: 'H2', tip: '二级标题', action: () => void chain().toggleHeading({ level: 2 }).run(), active: () => editor.isActive('heading', { level: 2 }) },
    { key: 'h3', label: 'H3', tip: '三级标题', action: () => void chain().toggleHeading({ level: 3 }).run(), active: () => editor.isActive('heading', { level: 3 }) },
    { key: 'd2', label: '|', tip: '', action: () => undefined },
    { key: 'quote', label: '❝', tip: '引用', action: () => void chain().toggleBlockquote().run(), active: () => editor.isActive('blockquote') },
    { key: 'ul', label: '•', tip: '无序列表', action: () => void chain().toggleBulletList().run(), active: () => editor.isActive('bulletList') },
    { key: 'ol', label: '1.', tip: '有序列表', action: () => void chain().toggleOrderedList().run(), active: () => editor.isActive('orderedList') },
    { key: 'task', label: '☑', tip: '任务列表', action: () => void chain().toggleTaskList().run(), active: () => editor.isActive('taskList') },
    { key: 'd3', label: '|', tip: '', action: () => undefined },
    { key: 'table', label: '▦', tip: '插入表格', action: () => void chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: 'link', label: '⛓', tip: '插入链接', action: onLink, active: () => editor.isActive('link') },
    { key: 'image', label: '▧', tip: '插入图片', action: onImage },
    { key: 'code', label: '</>', tip: '代码块', action: () => void chain().toggleCodeBlock().run(), active: () => editor.isActive('codeBlock') },
    { key: 'hr', label: '—', tip: '分隔线', action: () => void chain().setHorizontalRule().run() },
    { key: 'd4', label: '|', tip: '', action: () => undefined },
    { key: 'undo', label: '↶', tip: '撤销 (Ctrl+Z)', action: () => void chain().undo().run() },
    { key: 'redo', label: '↷', tip: '重做 (Ctrl+Y)', action: () => void chain().redo().run() }
  ]
}

/** 核心常驻工具：空间不足时优先完整显示，绝不折叠。 */
const CORE_KEYS = new Set(['bold', 'italic', 'underline', 'strike', 'h1', 'h2', 'h3', 'undo', 'redo'])

/** 估算单个工具宽度（px，含项间距）：按钮 ~34，分隔条 ~15。 */
const toolWidth = (t: ToolSpec): number => (t.key.startsWith('d') ? 15 : 34)

export function EditorToolbar({ editor }: { editor: Editor | null }): React.JSX.Element {
  const [input, setInput] = useState<{ type: 'link' | 'image'; value: string } | null>(null)
  const [dimmed, setDimmed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  /** 工具栏可用宽度（px）；null 表示尚未完成首次测量 */
  const [width, setWidth] = useState<number | null>(null)
  const [morePos, setMorePos] = useState<{ left: number; top: number } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)

  // 失焦自动降透明（hover 恢复）；聚焦恢复全透明
  useEffect(() => {
    if (!editor) return
    const onFocus = (): void => setDimmed(false)
    const onBlur = (): void => setDimmed(true)
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    return () => {
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
    }
  }, [editor])

  // 测量工具栏可用宽度：窗口缩放 / 侧栏拖拽 / 折叠展开均经 ResizeObserver 驱动重排
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const measure = (): void => setWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  if (!editor) return <div className="flex h-[40px] shrink-0 border-b border-neutral-200 bg-neutral-50" />

  const openLink = (): void => setInput({ type: 'link', value: editor.isActive('link') ? (editor.getAttributes('link').href as string) ?? '' : '' })
  const openImage = (): void => setInput({ type: 'image', value: '' })

  const confirmInput = (): void => {
    if (!input) return
    if (input.type === 'link') {
      if (input.value.trim()) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: input.value.trim() }).run()
      } else {
        editor.chain().focus().unsetLink().run()
      }
    } else {
      const url = input.value.trim()
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    }
    setInput(null)
  }

  const tools = makeTools(editor, openLink, openImage)
  const items: ToolbarLayoutItem[] = tools.map((t) => ({
    key: t.key,
    width: toolWidth(t),
    core: CORE_KEYS.has(t.key)
  }))
  // 未完成首次测量前默认完整展示并允许横向滚动，避免闪烁
  const layout =
    width == null
      ? { inlineKeys: tools.map((t) => t.key), moreKeys: [] as string[], scrollable: true }
      : computeToolbarLayout(width, items)

  const inlineSet = new Set(layout.inlineKeys)
  const moreTools = tools.filter((t) => layout.moreKeys.includes(t.key) && !t.key.startsWith('d'))

  const toggleMore = (): void => {
    const next = !moreOpen
    if (next && moreBtnRef.current) {
      const r = moreBtnRef.current.getBoundingClientRect()
      setMorePos({ left: r.right, top: r.bottom + 4 })
    }
    setMoreOpen(next)
  }

  return (
    <div
      ref={barRef}
      className={`relative flex h-[40px] shrink-0 items-center border-b border-neutral-200 bg-neutral-50 transition-opacity duration-base select-none ${
        dimmed ? 'opacity-35 hover:opacity-100' : ''
      }`}
    >
      {/* 可滚动工具条：正常态横向不裁剪，核心放不下时才出现横向滚动 */}
      <div
        className={`flex h-full min-w-0 flex-1 items-center gap-0.5 px-3 ${
          layout.scrollable ? 'overflow-x-auto' : ''
        }`}
      >
        {tools.map((t) => {
          if (!inlineSet.has(t.key)) return null
          if (t.key.startsWith('d')) {
            return <span key={t.key} className="mx-1.5 h-[18px] w-px shrink-0 bg-neutral-200" />
          }
          return (
            <button
              key={t.key}
              title={t.tip}
              onClick={t.action}
              className={`flex h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-sm px-1 text-[13px] transition-colors duration-fast ${
                t.active?.()
                  ? 'bg-brand-50 font-semibold text-brand-500'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </button>
          )
        })}

        {/* 优先级折叠：低频工具收纳于「更多」悬浮入口 */}
        {moreTools.length > 0 && (
          <button
            ref={moreBtnRef}
            className={`ml-1 flex h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-sm px-1 text-[13px] transition-colors duration-fast ${
              moreOpen
                ? 'bg-neutral-100 font-semibold text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
            title="更多工具（低频操作已折叠）"
            onClick={toggleMore}
          >
            ⋯
          </button>
        )}
      </div>

      {/* 悬浮式「更多」菜单（portal 到 body，避免被工具条裁剪） */}
      {moreOpen &&
        morePos &&
        moreTools.length > 0 &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div
              className="fixed z-50 max-h-[260px] w-[172px] overflow-y-auto rounded-md border border-neutral-200 bg-neutral-0 py-1 shadow-3"
              style={{ left: Math.max(8, morePos.left - 172), top: morePos.top }}
            >
              {moreTools.map((t) => (
                <button
                  key={t.key}
                  title={t.tip}
                  onClick={() => {
                    t.action()
                    setMoreOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-neutral-900 transition-colors duration-fast hover:bg-neutral-100"
                >
                  <span className="w-[22px] shrink-0 text-[13px] text-neutral-500">{t.label}</span>
                  <span className="truncate">{t.tip}</span>
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

      {/* 链接 / 图片 URL 输入浮层（portal 到 body） */}
      {input &&
        createPortal(
          <div className="fixed z-50 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-2 shadow-3">
            <input
              autoFocus
              value={input.value}
              onChange={(e) => setInput({ ...input, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmInput()
                if (e.key === 'Escape') setInput(null)
              }}
              placeholder={input.type === 'link' ? 'https://…' : '图片 URL'}
              className="w-[240px] rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[12px] text-neutral-900 outline-none focus:border-brand-500"
            />
            <button className="btn-primary !px-2.5 !py-1 text-[12px]" onClick={confirmInput}>
              确定
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}
