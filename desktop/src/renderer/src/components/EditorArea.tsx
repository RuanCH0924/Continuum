import React, { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import { useAppStore } from '../stores/appStore'
import { useEditorStore, type EditorMode } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import { useToastStore } from '../stores/toastStore'
import { chineseCharCount, extractOutline, markdownIt, turndown } from '../lib/markdown'
import { ChapterTitle, ForeshadowMark, TimelineMark } from '../lib/tiptapExts'
import { ensureChapterTitle } from '../lib/chapterTitle'
import { applyForeshadowMarks, selectAnchorAndFlash } from '../lib/clueLink'
import { applyTimelineMarks } from '../lib/timelineLink'
import { EditorToolbar } from './EditorToolbar'

const MODES: { key: EditorMode; label: string }[] = [
  { key: 'edit', label: '编辑' },
  { key: 'preview', label: '预览' },
  { key: 'source', label: '源码' }
]

/** 中央编辑区：Tiptap 块级编辑 + 实时预览 + Markdown 源码模式 + 自动保存 + 大纲 + 打字机。 */
export function EditorArea(): React.JSX.Element {
  const mode = useEditorStore((s) => s.mode)
  const format = useEditorStore((s) => s.format)
  const [previewHtml, setPreviewHtml] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [sourceText, setSourceText] = useState('')
  const saveTimer = useRef<number | undefined>(undefined)
  const loadedSeq = useRef<number | null>(null)
  const prevMode = useRef<EditorMode>(mode)
  const previewScrollerRef = useRef<HTMLDivElement>(null)
  /** 装饰性事务守卫（伏笔标记重建不触发保存 / 统计） */
  const applyingMarks = useRef(false)

  const currentChapter = useAppStore((s) => s.currentChapter)
  const chapterContent = useAppStore((s) => s.chapterContent)
  const notes = useAppStore((s) => s.notes)
  const timeline = useAppStore((s) => s.timeline)
  const pendingAnchor = useAppStore((s) => s.pendingAnchor)
  const saveChapterFor = useAppStore((s) => s.saveChapterFor)
  const updateCharCount = useAppStore((s) => s.updateCharCount)
  const setOutline = useAppStore((s) => s.setOutline)
  const jumpTarget = useAppStore((s) => s.jumpTarget)
  const consumeJump = useAppStore((s) => s.consumeJump)
  const consumeAnchor = useAppStore((s) => s.consumeAnchor)

  const scheduleSave = (markdown: string): void => {
    // 捕获调度时的章节身份：防抖窗口内切换章节时，旧章节待保存内容仍写入原章节（避免误存）
    const app = useAppStore.getState()
    if (!app.currentWorkId || !app.currentChapter) return
    const seq = app.currentChapter.seq
    const title = app.currentChapter.title
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveChapterFor(seq, title, markdown)
    }, 800)
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      ChapterTitle,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      CharacterCount,
      Placeholder.configure({ placeholder: '开始创作…' }),
      Link.configure({ openOnClick: false, autolink: true }),
      ForeshadowMark,
      TimelineMark
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // 伏笔标记等装饰性事务不触发保存与统计
      if (applyingMarks.current) return
      const count = chineseCharCount(editor.state.doc.textContent)
      setCharCount(count)
      updateCharCount(count)
      setPreviewHtml(editor.getHTML())
      setOutline(extractOutline(turndown.turndown(editor.getHTML())))
      scheduleSave(turndown.turndown(editor.getHTML()))
    },
    // 打字机模式：光标始终垂直居中
    onSelectionUpdate: () => scrollToCursor(),
    onTransaction: () => scrollToCursor()
  })

  /** 打字机滚动：将光标滚动到滚动容器垂直中心。 */
  const scrollToCursor = (): void => {
    const ed = useEditorStore.getState().editor
    if (!ed || !useEditorStore.getState().format.typewriter) return
    const { from } = ed.state.selection
    const coords = ed.view.coordsAtPos(from)
    const scroller = ed.view.dom.closest('.md-prose-scroller') as HTMLElement | null
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    const target = scroller.scrollTop + (coords.top - rect.top) - rect.height / 2
    scroller.scrollTo({ top: target, behavior: 'smooth' })
  }

  // 编辑器实例注册到共享桥（AI 面板 / 命令面板跨组件读写选区）
  useEffect(() => {
    useEditorStore.getState().setEditor(editor)
    return () => useEditorStore.getState().setEditor(null)
  }, [editor])

  // 章节切换 → Markdown → HTML → Tiptap（emitUpdate=false 避免触发保存）
  useEffect(() => {
    if (!editor || !currentChapter) return
    if (loadedSeq.current === currentChapter.seq) return
    loadedSeq.current = currentChapter.seq
    const md = chapterContent || ''
    const html = markdownIt.render(md)
    editor.commands.setContent(html, { emitUpdate: false })
    const count = chineseCharCount(editor.state.doc.textContent)
    setPreviewHtml(editor.getHTML())
    setCharCount(count)
    updateCharCount(count)
    setOutline(extractOutline(md))
    setSourceText(md)
    // 编辑器初始化：内容开头自动插入章节名标题块（保留绑定，可编辑）
    ensureChapterTitle(editor, currentChapter.seq, currentChapter.title)
    // 伏笔联动：扫描正文为锚点文本应用伏笔标记；时间线：标注正文中的时间节点
    applyingMarks.current = true
    applyForeshadowMarks(editor, notes, currentChapter.seq)
    applyTimelineMarks(editor, timeline)
    applyingMarks.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter?.seq, editor, chapterContent])

  // 创作知识 / 时间线变化（新建/编辑/删除）→ 重建编辑器标注，两端状态同步
  useEffect(() => {
    if (!editor || !currentChapter) return
    if (loadedSeq.current !== currentChapter.seq) return
    applyingMarks.current = true
    applyForeshadowMarks(editor, notes, currentChapter.seq)
    applyTimelineMarks(editor, timeline)
    applyingMarks.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, notes, timeline, currentChapter?.seq])

  // 伏笔卡片「定位原文」→ 回溯定位到编辑器内锚点选区（结合创建偏移消歧）
  useEffect(() => {
    if (!pendingAnchor || !editor) return
    const ok = selectAnchorAndFlash(editor, pendingAnchor.text, pendingAnchor.offset)
    if (!ok) {
      useToastStore.getState().notify('warning', '未在当前章节找到原文锚点（可能已被修改或删除）')
    }
    consumeAnchor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAnchor?.ts, editor])

  // 点击编辑器内伏笔标记 / 时间线标注 → 跳转定位到侧栏对应卡片 / 时间线条目
  useEffect(() => {
    if (!editor) return
    const onEditorClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      const ui = useUiStore.getState()
      // 时间线标注：定位到侧栏时间线条目
      const tMark = target.closest('mark[data-timeline]') as HTMLElement | null
      if (tMark) {
        const entryId = tMark.getAttribute('data-timeline-id')
        if (!entryId) return
        if (ui.sidebarCollapsed) ui.toggleSidebar()
        ui.setSidebarTab('timeline')
        ui.setTimelineFocus({ entryId, ts: Date.now() })
        return
      }
      // 伏笔标记：定位到侧栏伏笔卡片
      const mark = target.closest('mark[data-foreshadow]') as HTMLElement | null
      if (!mark) return
      const noteId = mark.getAttribute('data-note-id')
      if (!noteId) return
      const note = useAppStore.getState().notes.find((n) => n.id === noteId)
      if (!note) return
      if (ui.sidebarCollapsed) ui.toggleSidebar()
      ui.setSidebarTab('clues')
      ui.setClueFocus({ noteId, ts: Date.now() })
    }
    editor.view.dom.addEventListener('click', onEditorClick)
    return () => editor.view.dom.removeEventListener('click', onEditorClick)
  }, [editor])

  // 大纲跳转：滚动到第 index 个标题
  useEffect(() => {
    if (!jumpTarget || !editor) return
    let n = 0
    let foundPos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        if (n === jumpTarget.index) {
          foundPos = pos
          return false
        }
        n++
      }
    })
    if (foundPos !== null) {
      editor.chain().focus().setTextSelection(foundPos).scrollIntoView().run()
    }
    consumeJump()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget?.ts])

  // 模式切换（含 Ctrl+\ 快捷键）：切入源码同步当前 MD；切出源码回写 Tiptap
  useEffect(() => {
    if (prevMode.current === mode) return
    if (mode === 'source' && editor) {
      setSourceText(turndown.turndown(editor.getHTML()))
    }
    if (prevMode.current === 'source' && editor) {
      const md = sourceText
      editor.commands.setContent(markdownIt.render(md), { emitUpdate: false })
      setPreviewHtml(editor.getHTML())
      setCharCount(chineseCharCount(editor.state.doc.textContent))
      setOutline(extractOutline(md))
      if (currentChapter) {
        ensureChapterTitle(editor, currentChapter.seq, currentChapter.title)
        applyingMarks.current = true
        applyForeshadowMarks(editor, notes, currentChapter.seq)
        applyTimelineMarks(editor, timeline)
        applyingMarks.current = false
      }
    }
    prevMode.current = mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const onSourceInput = (value: string): void => {
    setSourceText(value)
    const count = chineseCharCount(value)
    setCharCount(count)
    updateCharCount(count)
    setOutline(extractOutline(value))
    scheduleSave(value)
  }

  // 格式设置样式（字号 / 行距 / 首行缩进）
  const proseStyle: React.CSSProperties = {
    fontSize: `${format.fontSize}%`,
    lineHeight: format.lineHeight,
    paddingInlineStart: format.indent ? '2em' : undefined
  }
  const sourceLines = format.lineNumbers ? sourceText.split('\n').length : 0

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-[var(--editor-bg)]">
      {mode !== 'source' && <EditorToolbar editor={editor} />}

      {/* 编辑区主体（单栏：编辑即 Markdown 实时渲染预览） */}
      <div className="relative flex min-h-0 flex-1">
        {mode === 'edit' && (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-[26px] shrink-0 items-center border-b border-neutral-200 bg-neutral-50 px-3 text-[11px] text-neutral-300">
              <span>编辑区</span>
              <span className="ml-auto text-[10px]">
                {currentChapter ? `${currentChapter.title} · 字数 ${charCount}` : '未选择章节'}
              </span>
            </div>
            <div className="md-prose-scroller min-h-0 flex-1 overflow-y-auto px-8 pb-[40vh] pt-8">
              <div className="md-prose" style={proseStyle}>
                {editor && <EditorContent editor={editor} />}
              </div>
              {!currentChapter && (
                <div className="pointer-events-none absolute inset-x-0 top-14 text-center text-[13px] text-neutral-300">
                  请在左侧选择或新建作品 / 章节，开始创作
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'preview' && (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-[26px] shrink-0 items-center border-b border-neutral-200 bg-neutral-50 px-3 text-[11px] text-neutral-300">
              <span>预览</span>
              <span className="ml-auto text-[10px]">{charCount > 0 ? `字数 ${charCount}` : ''}</span>
            </div>
            <div ref={previewScrollerRef} className="md-prose-scroller min-h-0 flex-1 overflow-y-auto px-8 pb-[40vh] pt-8">
              {previewHtml ? (
                <div className="md-prose" style={proseStyle} dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <div className="text-center text-[13px] text-neutral-300">暂无预览内容</div>
              )}
            </div>
          </div>
        )}

        {mode === 'source' && (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-[26px] shrink-0 items-center border-b border-neutral-200 bg-neutral-50 px-3 text-[11px] text-neutral-300">
              <span>Markdown 源码</span>
              <span className="ml-auto text-[10px]">
                {currentChapter ? `字数 ${charCount}` : ''}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 overflow-y-auto">
              {format.lineNumbers && (
                <div
                  aria-hidden
                  className="select-none border-r border-neutral-200 bg-neutral-50 px-2 py-8 text-right font-mono text-[12px] leading-[1.7] text-neutral-300"
                >
                  {Array.from({ length: sourceLines }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
              )}
              <textarea
                value={sourceText}
                onChange={(e) => onSourceInput(e.target.value)}
                spellCheck={false}
                placeholder="# 章节标题"
                className="min-h-0 flex-1 resize-none bg-[var(--editor-bg)] px-8 py-8 font-mono text-[13px] leading-[1.7] text-neutral-900 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 模式切换（右下角悬浮胶囊） */}
      <div className="absolute bottom-2 right-3 z-10">
        <div className="flex rounded-md bg-neutral-100/90 p-0.5 shadow-1 backdrop-blur">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`rounded-sm px-3 py-0.5 text-[12px] transition-colors duration-fast ${
                mode === m.key
                  ? 'border border-neutral-200 bg-neutral-0 font-medium text-neutral-900 shadow-1'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
              onClick={() => useEditorStore.getState().setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
