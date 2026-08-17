import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { useAiStore } from '../stores/aiStore'
import { KIND_LABEL } from '../lib/retrieval'
import type { SearchResult } from '@shared/types'

/** AI 面板「知识库」Tab：混合 RAG 检索（本地 BM25 + 可选远程 Embedding）+ 命中高亮 / 置信度色标。 */
export function KnowledgeBaseTab(): React.JSX.Element {
  const workId = useAppStore((s) => s.currentWorkId)
  const selectChapter = useAppStore((s) => s.selectChapter)
  const config = useAiStore((s) => s.config)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hybrid, setHybrid] = useState(false)
  const [error, setError] = useState('')

  const run = async (): Promise<void> => {
    if (!workId || !query.trim()) return
    setLoading(true)
    setError('')
    const embedding =
      config.embeddingModel?.trim() && config.apiKey
        ? { baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.embeddingModel }
        : null
    try {
      const res = await window.api.search.query({ workId, query: query.trim(), limit: 10, embedding })
      setResults(res)
      setHybrid(!!embedding)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const jump = (r: SearchResult): void => {
    if (r.kind === 'chapter' && r.chapterSeq != null) void selectChapter(r.chapterSeq)
  }

  /** 命中关键词高亮（B 组细节）。 */
  const highlight = (text: string): React.ReactNode => {
    const q = query.replace(/\s+/g, '')
    if (!q || !text) return text
    const term = q.length > 12 ? q.slice(0, 12) : q
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return parts.map((p, i) =>
      p.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="rounded-[2px] bg-brand-50 px-0.5 text-brand-500">
          {p}
        </mark>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      )
    )
  }

  const scoreCls = (score: number): string =>
    score >= 90 ? 'text-status-success' : score >= 70 ? 'text-neutral-500' : 'text-neutral-300'

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="rounded-md border border-neutral-200 bg-neutral-0 px-3 py-2 text-[11px] text-neutral-500">
        检索范围：章节正文 + 角色卡 + 设定 + 伏笔 + 素材
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
          }}
          placeholder="搜索知识库…（如：主角的性格设定）"
          className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-neutral-0 px-2.5 py-1.5 text-[12px] text-neutral-900 outline-none focus:border-brand-500"
        />
        <button
          className="btn-primary shrink-0 !px-3 !py-1.5 text-[12px]"
          onClick={() => void run()}
          disabled={loading}
        >
          {loading ? '检索中…' : '检索'}
        </button>
      </div>
      {hybrid && (
        <div className="mt-1 text-[10px] text-brand-500">混合检索（关键词 + Embedding）</div>
      )}
      {error && (
        <div className="mt-2 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-[11px] text-status-danger">
          {error}
        </div>
      )}

      <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto">
        {results.length === 0 && !loading && (
          <div className="pt-6 text-center text-[12px] text-neutral-300">输入关键词开始检索</div>
        )}
        {results.map((r, i) => (
          <button
            key={`${r.kind}-${r.id}-${i}`}
            onClick={() => jump(r)}
            className="w-full rounded-md border border-neutral-200 bg-neutral-0 p-2 text-left transition-colors duration-fast hover:border-brand-500/40 hover:bg-neutral-50"
          >
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 rounded-sm bg-brand-50 px-1 py-px text-[10px] text-brand-500">
                {KIND_LABEL[r.kind]}
              </span>
              <span className="truncate text-[12px] font-medium text-neutral-900">{r.title}</span>
              <span className={`ml-auto shrink-0 text-[10px] ${scoreCls(r.score)}`}>
                {r.score}%
                {r.score < 70 && <span className="text-neutral-300"> · 低置信</span>}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-[1.6] text-neutral-500">{highlight(r.snippet)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
