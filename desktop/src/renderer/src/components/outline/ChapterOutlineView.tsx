import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useAiStore } from '../../stores/aiStore'
import { useUiStore } from '../../stores/uiStore'
import { useToastStore } from '../../stores/toastStore'
import { outlineFilled } from '../../lib/outline/extractScope'
import type { ChapterOutline } from '@shared/types'

/**
 * 章纲管理视图（PRD v1.0 §7）：每章一张卡片，内联编辑核心剧情 / 角色互动场景 /
 * 关键冲突点 / 章末钩子 + 备注 + 写作状态；支持定位正文、问 AI。
 */
export function ChapterOutlineView(): React.JSX.Element {
  const chapters = useAppStore((s) => s.chapters)
  const chapterOutlines = useAppStore((s) => s.chapterOutlines)
  const saveChapterOutline = useAppStore((s) => s.saveChapterOutline)
  const selectChapter = useAppStore((s) => s.selectChapter)
  const currentChapter = useAppStore((s) => s.currentChapter)

  const [search, setSearch] = useState('')
  const [onlyEmpty, setOnlyEmpty] = useState(false)
  const [onlyAi, setOnlyAi] = useState(false)

  const q = search.trim().toLowerCase()
  const visible = useMemo(
    () =>
      chapters.filter((c) => {
        if (q && !(c.title.toLowerCase().includes(q) || `第${c.seq}章`.includes(q))) return false
        const co = chapterOutlines.find((o) => o.chapterSeq === c.seq)
        if (onlyEmpty && co && outlineFilled(co)) return false
        if (onlyAi && !(co?.extracted === true)) return false
        return true
      }),
    [chapters, chapterOutlines, q, onlyEmpty, onlyAi]
  )

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <span className="text-[26px] text-brand-500">·</span>
        <span className="text-[14px] font-semibold text-neutral-900">还没有章节</span>
        <span className="text-[12px] text-neutral-500">先在「作品」Tab 中创建章节，再为每章填写章纲</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索章节…"
          className="h-[28px] w-[180px] rounded-md border border-neutral-200 bg-neutral-0 px-2 text-[12px] text-neutral-900 outline-none placeholder:text-neutral-300"
        />
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-neutral-500">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />
          仅显示未填写
        </label>
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-neutral-500">
          <input type="checkbox" checked={onlyAi} onChange={(e) => setOnlyAi(e.target.checked)} />
          仅 AI 提取
        </label>
        <span className="ml-auto text-[11px] text-neutral-300">
          已填写 {chapterOutlines.filter((o) => outlineFilled(o)).length} / {chapters.length} 章
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {visible.length === 0 && (
          <div className="py-10 text-center text-[12px] text-neutral-400">未找到匹配的章节</div>
        )}
        {visible.map((c) => {
          const co = chapterOutlines.find((o) => o.chapterSeq === c.seq)
          const isCurrent = currentChapter?.seq === c.seq
          return (
            <ChapterOutlineCard
              key={c.seq}
              chapter={{ seq: c.seq, title: c.title }}
              outline={co ?? null}
              isCurrent={isCurrent}
              onSave={(patch) => {
                const base: ChapterOutline = co ?? {
                  id: '',
                  workId: '',
                  chapterSeq: c.seq,
                  corePlot: '',
                  characterScenes: '',
                  conflict: '',
                  hook: '',
                  content: '',
                  extracted: false,
                  status: 'unwritten',
                  updatedAt: 0
                }
                void saveChapterOutline({ ...base, ...patch })
              }}
              onLocate={() => void selectChapter(c.seq)}
              onAsk={() => {
                const ai = useAiStore.getState()
                ai.addChatRef({ kind: 'chapter', id: String(c.seq), label: `第${c.seq}章《${c.title}》` })
                ai.setChatSource('book')
                const ui = useUiStore.getState()
                ui.setAiTab('chat')
                if (ui.aiCollapsed) ui.toggleAi()
                useToastStore.getState().notify('success', '已引用该章内容，可在 AI 问答中提问')
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function ChapterOutlineCard({
  chapter,
  outline,
  isCurrent,
  onSave,
  onLocate,
  onAsk
}: {
  chapter: { seq: number; title: string }
  outline: ChapterOutline | null
  isCurrent: boolean
  onSave: (patch: Partial<ChapterOutline>) => void
  onLocate: () => void
  onAsk: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<ChapterOutline>(
    outline ?? {
      id: '',
      workId: '',
      chapterSeq: chapter.seq,
      corePlot: '',
      characterScenes: '',
      conflict: '',
      hook: '',
      content: '',
      extracted: false,
      status: 'unwritten',
      updatedAt: 0
    }
  )
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (outline) setDraft(outline)
  }, [outline])

  const schedule = (patch: Partial<ChapterOutline>): void => {
    const next = { ...draft, ...patch }
    setDraft(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSave(next), 400)
  }

  const filled = outlineFilled(draft)
  const field = (label: string, value: string, onChange: (v: string) => void, rows: number): React.JSX.Element => (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="w-[76px] shrink-0 text-[11px] text-neutral-400">{label}</span>
        <span className="h-px flex-1 bg-neutral-100" />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholderOf(label)}
        className="w-full resize-none rounded-sm border border-transparent bg-transparent px-2 py-1 text-[12px] leading-[1.7] text-neutral-700 outline-none transition-colors duration-fast focus:border-brand-500 focus:bg-neutral-50"
      />
    </div>
  )

  return (
    <div
      className={`rounded-md border p-3 transition-colors duration-base ${
        isCurrent ? 'border-brand-500/50 bg-brand-50/30' : 'border-neutral-200 bg-neutral-0 hover:border-brand-500/30'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="truncate text-[13px] font-medium text-neutral-900">
          第{chapter.seq}章 · {chapter.title}
        </span>
        {!filled && (
          <span className="rounded-sm bg-neutral-100 px-1 py-px text-[10px] text-neutral-400">未填写</span>
        )}
        {draft.extracted && (
          <span className="rounded-sm bg-brand-50 px-1 py-px text-[10px] text-brand-500">AI 提取</span>
        )}
        <select
          value={draft.status}
          onChange={(e) => schedule({ status: e.target.value as ChapterOutline['status'] })}
          className="ml-auto rounded-sm border border-neutral-200 bg-neutral-0 px-1 py-0.5 text-[10px] text-neutral-500 outline-none"
          title="章节写作状态"
        >
          <option value="unwritten">未写</option>
          <option value="writing">写作中</option>
          <option value="written">已写</option>
        </select>
        <button
          className="text-[11px] text-brand-500 transition-colors duration-fast hover:text-brand-300"
          onClick={onLocate}
          title="切换到该章节正文"
        >
          定位正文
        </button>
        <button
          className="text-[11px] text-neutral-500 transition-colors duration-fast hover:text-neutral-900"
          onClick={onAsk}
          title="以本书内容为知识库提问"
        >
          问 AI
        </button>
      </div>
      {field('核心剧情', draft.corePlot, (v) => schedule({ corePlot: v }), 2)}
      {field('角色互动场景', draft.characterScenes, (v) => schedule({ characterScenes: v }), 2)}
      {field('关键冲突点', draft.conflict, (v) => schedule({ conflict: v }), 2)}
      {field('章末钩子', draft.hook, (v) => schedule({ hook: v }), 1)}
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-neutral-400 hover:text-neutral-600">备注 / 自由内容</summary>
        {field('', draft.content, (v) => schedule({ content: v }), 4)}
      </details>
      <p className="mt-1 text-right text-[10px] text-neutral-300">编辑后自动保存</p>
    </div>
  )
}

function placeholderOf(label: string): string {
  return { 核心剧情: '本章发生的关键剧情…', 角色互动场景: '涉及角色的互动与关系变化…', 关键冲突点: '本章的核心冲突…', 章末钩子: '章末留下的悬念…' }[label] ?? '自由填写…'
}
