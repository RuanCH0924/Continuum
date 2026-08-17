import React, { useEffect, useState } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useAiStore } from '../stores/aiStore'
import { useAppStore } from '../stores/appStore'
import { NoteEditorDialog } from './NoteEditorDialog'

const ACTIONS: { kind: 'polish' | 'rewrite' | 'translate' | 'summary' | 'continue'; label: string }[] = [
  { kind: 'polish', label: '润色' },
  { kind: 'rewrite', label: '改写' },
  { kind: 'translate', label: '翻译' },
  { kind: 'summary', label: '总结' },
  { kind: 'continue', label: '续写' }
]

/** 选区悬浮操作条（A1）：选中正文后浮出 AI 动作 + 创建伏笔；触发后自动展开 AI 面板查看结果。 */
export function SelectionToolbar(): React.JSX.Element | null {
  const editor = useEditorStore((s) => s.editor)
  const currentChapter = useAppStore((s) => s.currentChapter)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  /** 选区「创建伏笔」弹窗（携带选中的原文文本 + 文本偏移，供精准关联） */
  const [creating, setCreating] = useState<{ text: string; chapterSeq: number; anchorOffset: number } | null>(null)

  useEffect(() => {
    if (!editor) {
      setPos(null)
      return
    }
    const update = (): void => {
      const { from, to, empty } = editor.state.selection
      if (empty) {
        setPos(null)
        return
      }
      const coords = editor.view.coordsAtPos(from)
      setPos({ top: coords.top, left: coords.left })
    }
    update()
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  // 创建伏笔弹窗打开时隐藏悬浮条
  if (!pos || creating) return creating ? <NoteEditorDialog kind="clue" note={null} preset={{
    title: creating.text.slice(0, 24),
    anchorText: creating.text,
    anchorOffset: creating.anchorOffset,
    chapterSeq: creating.chapterSeq
  }} onClose={() => setCreating(null)} /> : null

  const run = (kind: (typeof ACTIONS)[number]['kind']): void => {
    setPos(null)
    if (kind === 'continue') void useAiStore.getState().runContinue()
    else if (kind === 'polish') void useAiStore.getState().runPolish()
    else if (kind === 'rewrite') void useAiStore.getState().runRewrite()
    else if (kind === 'translate') void useAiStore.getState().runTranslate()
    else void useAiStore.getState().runSummary()
  }

  const createClue = (): void => {
    if (!editor || !currentChapter) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ').trim()
    if (!text) return
    // 记录选区起始在章节纯文本中的字符偏移：同文多出现时保证精准关联
    const anchorOffset = editor.state.doc.textBetween(0, from).length
    setCreating({ text, chapterSeq: currentChapter.seq, anchorOffset })
  }

  return (
    <div
      className="pointer-events-auto fixed z-50 flex -translate-x-2 -translate-y-full items-center gap-0.5 rounded-md border border-neutral-200 bg-neutral-0 px-1 py-1 shadow-2"
      style={{ top: pos.top - 8, left: pos.left }}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.kind}
          className="rounded-sm px-2 py-1 text-[12px] text-neutral-600 transition-colors duration-fast hover:bg-brand-50 hover:text-brand-500"
          onClick={() => run(a.kind)}
        >
          {a.label}
        </button>
      ))}
      {currentChapter && (
        <button
          className="rounded-sm border-l border-neutral-200 px-2 py-1 text-[12px] text-brand-500 transition-colors duration-fast hover:bg-brand-50"
          title="以选中的文本为锚点创建伏笔，并绑定原文定位"
          onClick={createClue}
        >
          创建伏笔
        </button>
      )}
    </div>
  )
}
