import React, { useEffect, useRef, useState } from 'react'
import type { DailyStats } from '@shared/types'
import { buildTrend, formatWordCount, sumTrend, type TrendPeriod, type TrendPoint } from '../../lib/homeStats'

const PERIODS: { key: TrendPeriod; label: string; hint: string }[] = [
  { key: 'week', label: '周', hint: '近 7 天' },
  { key: 'month', label: '月', hint: '近 30 天' },
  { key: 'year', label: '年', hint: '近 12 个月' }
]

/** 数字滚动动画：数据更新时从旧值平滑过渡到新值（cubic ease-out，约 500ms）。 */
function useAnimatedNumber(value: number, duration = 500): number {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    const start = performance.now()
    let raf = 0
    const tick = (t: number): void => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = value
    }
  }, [value, duration])
  return display
}

/** 指标卡：标签 + 滚动数字 + 附加说明。 */
function StatCard({
  label,
  value,
  accent,
  hint
}: {
  label: string
  value: number
  accent?: boolean
  hint?: string
}): React.JSX.Element {
  const animated = useAnimatedNumber(value)
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-1">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <span
        className={`text-[22px] font-semibold tabular-nums leading-none ${accent ? 'text-brand-500' : 'text-neutral-900'}`}
      >
        {animated.toLocaleString('zh-CN')}
      </span>
      {hint && <span className="truncate text-[10px] text-neutral-300">{hint}</span>}
    </div>
  )
}

/** 柱状趋势图：高度动画（周期切换重绘 / 数据更新平滑过渡）+ hover/触按高亮与数值浮层。 */
function TrendChart({ points, period }: { points: TrendPoint[]; period: TrendPeriod }): React.JSX.Element {
  const max = Math.max(1, ...points.map((p) => p.value))
  const [active, setActive] = useState<number | null>(null)
  const [grown, setGrown] = useState(false)

  // 周期切换时重放「从 0 生长」动效；同周期内数据更新则走 height 过渡平滑变化
  useEffect(() => {
    setGrown(false)
    const raf = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(raf)
  }, [period])

  // 标签稀疏显示：数据点较多时按步长取样，避免拥挤
  const labelVisible = (i: number): boolean => {
    if (points.length <= 8) return true
    const step = Math.ceil(points.length / 8)
    return i % step === 0 || i === points.length - 1
  }

  return (
    <div>
      <div className="relative h-[170px]">
        {/* 峰值刻度（右上角） */}
        <span className="pointer-events-none absolute right-0 top-0 text-[10px] text-neutral-300">
          峰值 {formatWordCount(max)} 字
        </span>
        <div className="flex h-full items-end gap-[3px] pt-5">
          {points.map((p, i) => {
            const pct = Math.round((p.value / max) * 100)
            const isActive = active === i
            return (
              <div
                key={p.key}
                className="group relative flex h-full min-w-0 flex-1 items-end"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(isActive ? null : i)}
                data-testid={`trend-bar-${p.key}`}
                role="img"
                aria-label={`${p.label} ${p.value} 字`}
              >
                {isActive && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-200 bg-neutral-900 px-2 py-1 text-[10px] leading-none text-neutral-0 shadow-2">
                    {p.label} · {p.value.toLocaleString('zh-CN')} 字
                  </div>
                )}
                <div
                  className="w-full rounded-t-[3px] transition-all duration-base"
                  style={{
                    height: grown ? `${pct}%` : '0%',
                    background: isActive ? 'var(--brand-500)' : 'var(--brand-300)',
                    opacity: p.value === 0 ? 0.25 : 1
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[9px] text-neutral-300">
        {points.map((p, i) => (
          <span
            key={p.key}
            className="min-w-0 flex-1 truncate text-center"
            style={{ visibility: labelVisible(i) ? 'visible' : 'hidden' }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * 数据统计模块：核心指标卡（作品总数 / 累计总字数 / 今日字数 / 周期字数）+
 * 周/月/年可切换的写作量柱状图（数据源 settings.dailyStats 每日净增字数）。
 */
export function StatsSection({
  worksCount,
  totalChars,
  todayChars,
  dailyGoal,
  dailyStats
}: {
  worksCount: number
  totalChars: number
  todayChars: number
  dailyGoal: number
  dailyStats: DailyStats
}): React.JSX.Element {
  const [period, setPeriod] = useState<TrendPeriod>('week')
  const points = buildTrend(dailyStats, period)
  const periodTotal = sumTrend(points)
  const periodHint = PERIODS.find((p) => p.key === period)?.hint ?? ''
  const goalPct = dailyGoal > 0 ? Math.min(100, Math.round((todayChars / dailyGoal) * 100)) : 0

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-semibold text-neutral-900">数据统计</h2>
          <span className="text-[11px] text-neutral-500">创作产出一览 · 数据本地</span>
        </div>
        {/* 周 / 月 / 年 周期切换 */}
        <div className="flex rounded-md border border-neutral-200 bg-neutral-0 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`rounded px-2.5 py-1 text-[11px] transition-colors duration-fast ${
                period === p.key
                  ? 'bg-brand-500 font-medium text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 指标卡：响应式 2 列 → 4 列 */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="作品总数" value={worksCount} hint="全部作品" />
        <StatCard label="累计总字数" value={totalChars} hint="正文 + 创作知识" />
        <StatCard
          label="今日字数"
          value={todayChars}
          accent
          hint={dailyGoal > 0 ? `目标 ${dailyGoal.toLocaleString('zh-CN')} · ${goalPct}%` : '今日净增'}
        />
        <StatCard label={`${periodHint}字数`} value={periodTotal} hint={`统计周期 · ${periodHint}`} />
      </div>

      {/* 趋势图卡片 */}
      <div className="rounded-md border border-neutral-200 bg-neutral-0 p-3">
        <TrendChart points={points} period={period} />
      </div>
    </section>
  )
}
