import React, { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { KIND_LABEL } from '../lib/retrieval'
import { useAppStore } from '../stores/appStore'
import { useUiStore } from '../stores/uiStore'
import { useToastStore } from '../stores/toastStore'
import type { SearchResult } from '@shared/types'

type GlobalHit = SearchResult & { workId: string; workTitle: string }

/** 全局全文搜索（Ctrl+Shift+F）：跨全部作品检索章节正文 + 创作知识，结果可跳转。 */
export function GlobalSearchDialog(): React.JSX.Element | null {
  const open = useUiStore((s) => s.searchOpen)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [open])

  if (!open) return null

  const run = async (): Promise<void> => {
    const q = query.trim()
    if (!q) return
    const app = useAppStore.getState()
    if (app.works.length === 0) {
      setError('还没有作品，请先创建或导入')
      return
    }
    setLoading(true)
    setError('')
    try {
      const all: GlobalHit[] = []
      for (const w of app.works) {
        const hits = await window.api.search.query({ workId: w.id, query: q.slice(0, 200), limit: 5, embedding: null })
        for (const h of hits) all.push({ ...h, workId: w.id, workTitle: w.title })
      }
      all.sort((a, b) => b.score - a.score)
      setResults(all.slice(0, 30))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const jump = async (h: GlobalHit): Promise<void> => {
    const app = useAppStore.getState()
    await app.selectWork(h.workId)
    if (h.kind === 'chapter' && h.chapterSeq != null) {
      await app.selectChapter(h.chapterSeq)
      setSearchOpen(false)
    } else {
      useToastStore.getState().notify('info', `「${h.title}」为创作知识，请在左侧「角色 / 设定 / 伏笔 / 素材」查看`)
      setSearchOpen(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={() => setSearchOpen(false)}>
      <div
        className="w-[640px] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3">
          <Icon name="search" size={16} className="text-neutral-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setResults([])
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void run()
              }
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            placeholder="跨作品搜索章节正文与创作知识…（Ctrl+Shift+F）"
            className="h-[44px] flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-300"
          />
          <button className="btn-primary !px-3 !py-1 text-[12px]" onClick={() => void run()} disabled={loading || !query.trim()}>
            {loading ? '检索中…' : '搜索'}
          </button>
          <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 text-[10px] text-neutral-500">Esc</kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-2">
          {error && <div className="px-3 py-6 text-center text-[12px] text-status-danger">{error}</div>}
          {!loading && results.length === 0 && !error && (
            <div className="px-3 py-8 text-center text-[12px] text-neutral-300">
              {query.trim() ? '无匹配结果' : '输入关键词后回车，检索全部作品的正文与创作知识'}
            </div>
          )}
          {results.map((h, i) => (
            <button
              key={`${h.workId}-${h.kind}-${h.id}-${i}`}
              onClick={() => void jump(h)}
              className="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors duration-fast hover:bg-neutral-50"
            >
              <span className="flex items-center gap-1.5 text-[12px]">
                <span className="shrink-0 rounded-sm bg-brand-50 px-1 py-px text-[10px] text-brand-500">{KIND_LABEL[h.kind]}</span>
                <span className="truncate font-medium text-neutral-900">{h.title}</span>
                <span className="shrink-0 text-[10px] text-neutral-300">《{h.workTitle}》</span>
                <span className="ml-auto shrink-0 text-[10px] text-neutral-300">{h.score}%</span>
              </span>
              <span className="line-clamp-1 text-[11px] text-neutral-500">{h.snippet}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
