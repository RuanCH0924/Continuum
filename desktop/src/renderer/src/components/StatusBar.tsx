import React from 'react'
import { useAppStore } from '../stores/appStore'
import { useAiStore } from '../stores/aiStore'

function fmtTime(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
}

/** 底部状态栏：实时字数 / 今日净增 / 目标进度 / 模型 / 保存状态。 */
export function StatusBar(): React.JSX.Element {
  const model = useAiStore((s) => s.config.model)
  const charCount = useAppStore((s) => s.charCount)
  const todayChars = useAppStore((s) => s.todayChars)
  const dailyGoal = useAppStore((s) => s.dailyGoal)
  const lastSavedAt = useAppStore((s) => s.lastSavedAt)

  const pct = dailyGoal > 0 ? Math.min(100, Math.round((todayChars / dailyGoal) * 100)) : 0
  const reached = pct >= 100

  return (
    <footer className="flex h-[30px] shrink-0 items-center gap-4 border-t border-neutral-200 bg-neutral-50 px-3 text-[11px] text-neutral-500 select-none">
      <span>
        字数{' '}
        <b key={charCount} className="char-pop font-medium text-neutral-900">
          {charCount.toLocaleString('zh-CN')}
        </b>
      </span>
      <span>
        今日{' '}
        <b key={todayChars} className="char-pop font-medium text-status-success">
          +{todayChars.toLocaleString('zh-CN')}
        </b>
      </span>
      <span className="flex items-center gap-1.5">
        目标 {dailyGoal.toLocaleString('zh-CN')}
        <span className="h-1 w-[90px] overflow-hidden rounded-full bg-neutral-100">
          <span
            className={`block h-full rounded-full transition-all duration-base ${
              reached ? 'bg-gradient-to-r from-status-success to-status-success/60' : 'bg-gradient-to-r from-brand-500 to-brand-300'
            }`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <b className={reached ? 'font-medium text-status-success' : 'font-medium text-neutral-900'}>{pct}%</b>
      </span>
      <span>
        模型 <b className="font-medium text-neutral-900">{model}</b>
      </span>

      <span className="ml-auto flex items-center gap-4">
        <span>自动保存 {fmtTime(lastSavedAt)}</span>
        <span>UTF-8</span>
        <span>MD · GFM</span>
        <span className="text-neutral-300">v0.1 · 数据本地</span>
      </span>
    </footer>
  )
}
