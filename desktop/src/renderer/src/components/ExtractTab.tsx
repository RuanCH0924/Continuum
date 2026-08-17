import React, { useEffect, useMemo } from 'react'
import { useAiStore } from '../stores/aiStore'
import { useAppStore } from '../stores/appStore'
import { useUiStore } from '../stores/uiStore'
import { resolveExtractSeqs, type ExtractScope } from '../lib/outline/extractScope'

const SCOPE_OPTIONS: { key: ExtractScope; label: string; hint: string }[] = [
  { key: 'current', label: '当前章节', hint: '仅提取当前打开的章节' },
  { key: 'recent20', label: '最近 20 章', hint: '自当前章节起向前 20 章（不足按实际）' },
  { key: 'custom', label: '自定义范围', hint: '勾选章节，单批最多 50 章' }
]

/** AI「提取」Tab（PRD v1.0 §9）：智能章纲提取（范围选择 + 配额 + 进度 + 结果）。 */
export function ExtractTab(): React.JSX.Element {
  const chapters = useAppStore((s) => s.chapters)
  const currentChapter = useAppStore((s) => s.currentChapter)
  const extractScope = useAiStore((s) => s.extractScope)
  const setExtractScope = useAiStore((s) => s.setExtractScope)
  const extractCustom = useAiStore((s) => s.extractCustom)
  const setExtractCustom = useAiStore((s) => s.setExtractCustom)
  const extractRunning = useAiStore((s) => s.extractRunning)
  const extractProgress = useAiStore((s) => s.extractProgress)
  const extractResult = useAiStore((s) => s.extractResult)
  const extractError = useAiStore((s) => s.extractError)
  const quota = useAiStore((s) => s.quota)
  const loadQuota = useAiStore((s) => s.loadQuota)
  const runExtract = useAiStore((s) => s.runExtract)
  const setCentralMode = useUiStore((s) => s.setCentralMode)
  const setOutlineView = useUiStore((s) => s.setOutlineView)

  useEffect(() => {
    void loadQuota()
  }, [loadQuota])

  const preview = useMemo(
    () => resolveExtractSeqs(chapters, currentChapter?.seq ?? null, extractScope, extractCustom),
    [chapters, currentChapter, extractScope, extractCustom]
  )
  const remaining = quota ? Math.max(0, quota.budget - quota.used) : null
  const quotaOk = remaining != null && preview.seqs.length <= remaining
  const toggleSeq = (seq: number): void => {
    setExtractCustom(
      extractCustom.includes(seq) ? extractCustom.filter((s) => s !== seq) : [...extractCustom, seq]
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
      <div className="rounded-md border border-neutral-200 bg-neutral-0 px-3 py-2 text-[12px] text-neutral-500">
        智能章纲提取
        <p className="mt-1 text-[11px] leading-[1.6] text-neutral-300">
          为缺乏章纲思路的章节自动生成核心剧情 / 角色互动 / 冲突点 / 章末钩子，写入章纲。
          每成功提取 1 章消耗 1 次配额（每日 100 次，AI 功能全局共享）；失败与跳过不消耗。
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {SCOPE_OPTIONS.map((o) => (
          <label
            key={o.key}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition-colors duration-fast ${
              extractScope === o.key ? 'border-brand-500 bg-brand-50/40' : 'border-neutral-200 hover:border-brand-500/40'
            }`}
          >
            <input
              type="radio"
              name="extract-scope"
              checked={extractScope === o.key}
              onChange={() => setExtractScope(o.key)}
              className="mt-0.5 accent-[var(--brand-500)]"
            />
            <span>
              <span className="block text-[12px] font-medium text-neutral-900">{o.label}</span>
              <span className="block text-[10.5px] text-neutral-400">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {extractScope === 'custom' && (
        <div className="mt-2 max-h-[160px] overflow-y-auto rounded-md border border-neutral-200 p-2">
          {chapters.length === 0 && <div className="py-4 text-center text-[11px] text-neutral-300">暂无章节</div>}
          {chapters.map((c) => {
            const checked = extractCustom.includes(c.seq)
            return (
              <label key={c.seq} className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-100">
                <input type="checkbox" checked={checked} onChange={() => toggleSeq(c.seq)} className="accent-[var(--brand-500)]" />
                <span className="truncate">第{c.seq}章 · {c.title}</span>
              </label>
            )
          })}
        </div>
      )}

      <div data-testid="extract-preview" className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-[11px] leading-[1.7] text-neutral-500">
        本次将提取 <b className="text-neutral-900">{preview.seqs.length}</b> 章 → 消耗配额{' '}
        <b className="text-neutral-900">{preview.seqs.length}</b> 次
        <div className="text-neutral-400">
          今日剩余配额：{remaining ?? '—'} / {quota?.budget ?? 100}
        </div>
      </div>

      <button
        className="btn-primary mt-3 w-full"
        disabled={extractRunning || preview.seqs.length === 0 || !!preview.error || (remaining != null && !quotaOk)}
        onClick={() => void runExtract()}
      >
        {extractRunning ? '提取中…' : '开始提取'}
      </button>

      {preview.error && !extractRunning && (
        <div className="mt-2 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-[11px] text-status-warning">
          {preview.error}
        </div>
      )}
      {!preview.error && remaining != null && !quotaOk && (
        <div className="mt-2 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-[11px] text-status-warning">
          配额不足（剩余 {remaining} 次），请分批提取或明日再试
        </div>
      )}

      {extractRunning && extractProgress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
            <span>
              进度 {extractProgress.done} / {extractProgress.total}
            </span>
            {extractProgress.currentSeq != null && <span>第 {extractProgress.currentSeq} 章…</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-base"
              style={{ width: `${Math.round((extractProgress.done / Math.max(1, extractProgress.total)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {extractResult && !extractRunning && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-0 px-3 py-2 text-[11px] leading-[1.7] text-neutral-600">
          完成：成功 <b className="text-status-success">{extractResult.success.length}</b> · 失败{' '}
          <b className="text-status-danger">{extractResult.failed.length}</b> · 消耗配额 {extractResult.quotaUsed} 次
          {extractResult.failed.map((f) => (
            <div key={f.seq} className="text-neutral-400">
              第{f.seq}章：{f.reason}
            </div>
          ))}
          <button
            className="mt-1 text-brand-500 transition-colors duration-fast hover:text-brand-300"
            onClick={() => {
              setCentralMode('outline')
              setOutlineView('chapters')
            }}
          >
            去大纲工作台查看章纲 →
          </button>
        </div>
      )}

      {extractError && !extractRunning && (
        <div className="mt-3 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-[11px] text-status-danger">
          {extractError}
        </div>
      )}
    </div>
  )
}
