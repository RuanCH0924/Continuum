import React, { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useToastStore } from '../stores/toastStore'

/** 查找 / 替换（Ctrl+F / Ctrl+H）：在 Tiptap 文档中查找定位，支持替换与全部替换。 */
export function FindReplaceDialog(): React.JSX.Element | null {
  const open = useEditorStore((s) => s.findOpen)
  const setFindOpen = useEditorStore((s) => s.setFindOpen)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [match, setMatch] = useState<{ from: number; to: number } | null>(null)
  const findRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      findRef.current?.focus()
      findRef.current?.select()
    }
  }, [open])

  if (!open) return null

  const editor = useEditorStore.getState().editor
  if (!editor) return null

  /** 从当前位置向后查找下一个匹配。 */
  const findNext = (wrap = true): boolean => {
    const { from } = editor.state.selection
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
    const q = find
    if (!q) return false
    let idx = text.indexOf(q, from + 1)
    if (idx === -1 && wrap) idx = text.indexOf(q)
    if (idx === -1) {
      setMatch(null)
      return false
    }
    setMatch({ from: idx, to: idx + q.length })
    editor.chain().focus().setTextSelection({ from: idx, to: idx + q.length }).scrollIntoView().run()
    return true
  }

  const replaceOne = (): void => {
    if (!match || !find) return
    editor.chain().focus().deleteRange(match).insertContent(replace).run()
    setMatch(null)
    findNext()
  }

  const replaceAll = (): void => {
    if (!find) return
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
    const count = text.split(find).length - 1
    if (count === 0) return
    // 从文档末尾向前替换，避免游标错位
    let remaining = count
    while (remaining > 0) {
      const t = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
      const idx = t.lastIndexOf(find)
      if (idx === -1) break
      editor.chain().focus().setTextSelection({ from: idx, to: idx + find.length }).deleteSelection().insertContent(replace).run()
      remaining--
      if (remaining > 50) break // 安全上限
    }
    setMatch(null)
    useToastStore.getState().notify('success', `已替换 ${count} 处`)
  }

  const inputCls =
    'rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[12px] text-neutral-900 outline-none focus:border-brand-500'

  return (
    <div className="fixed right-4 top-12 z-[55] w-[380px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3">
      <div className="flex items-center border-b border-neutral-200 px-3 py-2">
        <span className="text-[12px] font-semibold text-neutral-900">查找替换</span>
        <span className="ml-2 text-[10px] text-neutral-400">Ctrl+F 查找 · Ctrl+H 替换</span>
        <button className="ml-auto rounded p-0.5 text-neutral-500 hover:bg-neutral-100" onClick={() => setFindOpen(false)}>
          ✕
        </button>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="flex gap-2">
          <input
            ref={findRef}
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                findNext()
              }
            }}
            placeholder="查找…"
            className={`${inputCls} flex-1`}
          />
          <button className="btn-default !py-1.5 text-[12px]" onClick={() => findNext()}>
            下一个
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="替换为…"
            className={`${inputCls} flex-1`}
          />
          <button className="btn-default !py-1.5 text-[12px]" onClick={replaceOne}>
            替换
          </button>
          <button className="btn-primary !py-1.5 text-[12px]" onClick={replaceAll}>
            全部
          </button>
        </div>
        {match && <div className="text-[11px] text-brand-500">已定位第 {match.from + 1} 个字符处</div>}
      </div>
    </div>
  )
}
