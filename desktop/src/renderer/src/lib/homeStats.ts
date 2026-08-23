/**
 * 首页数据逻辑（纯函数，无 DOM / 无状态依赖，全部可单测）。
 *
 * 覆盖两个模块的纯计算：
 *   - 作品展览：题材解析（genre 字段 / 旧数据简介回退）、分类聚合、关键词+题材筛选、分页；
 *   - 数据统计：按周/月/年维度聚合每日字数记录为趋势点、区间求和、字数格式化。
 */

import type { DailyStats, WorkMeta } from '@shared/types'

/** 统计周期：周（近 7 天）/ 月（近 30 天）/ 年（近 12 个自然月）。 */
export type TrendPeriod = 'week' | 'month' | 'year'

/** 趋势图数据点。 */
export interface TrendPoint {
  /** 展示标签（周/月：M/D；年：M月） */
  label: string
  /** 聚合字数（缺省日期补 0） */
  value: number
  /** 唯一键（周/月：YYYY-MM-DD；年：YYYY-MM），用作图表 key */
  key: string
}

/**
 * 作品题材：优先 genre 字段；旧作品（向导时代将题材写入简介「题材：xxx」）回退解析。
 */
export function workGenre(w: WorkMeta): string {
  if (w.genre?.trim()) return w.genre.trim()
  const m = /题材[：:]\s*([^\n]+)/.exec(w.description || '')
  return m ? m[1].trim() : ''
}

/** 去重聚合全部作品题材（供分类筛选 chips）。 */
export function workGenres(works: WorkMeta[]): string[] {
  const set = new Set<string>()
  for (const w of works) {
    const g = workGenre(w)
    if (g) set.add(g)
  }
  return [...set]
}

export interface WorkFilterOptions {
  /** 关键词：匹配标题与简介（不区分大小写） */
  keyword?: string
  /** 题材（空串 = 全部） */
  genre?: string
}

/** 按关键词 + 题材筛选作品（保持原顺序：列表已按更新时间倒序）。 */
export function filterWorks(works: WorkMeta[], opts: WorkFilterOptions = {}): WorkMeta[] {
  const kw = (opts.keyword ?? '').trim().toLowerCase()
  const genre = (opts.genre ?? '').trim()
  return works.filter((w) => {
    if (genre && workGenre(w) !== genre) return false
    if (kw) {
      const hay = `${w.title} ${w.description}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
}

/** 分页切片（page 从 1 起；越界时回落到合法区间由调用方保证）。 */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

/** 分页页码窗口（首尾固定、当前页 ±1，超出部分以省略号折叠；total ≤ 7 时全量展示）。 */
export function visiblePages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 0) return []
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }
  return out
}

/** 本地日期 → YYYY-MM-DD。 */
function dateKeyOf(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * 构建统计周期趋势点：
 *   - week：近 7 天（含今天），逐日；
 *   - month：近 30 天，逐日；
 *   - year：近 12 个自然月，按月聚合（含本月）。
 * 缺失日期/月份补 0，保证图表刻度稳定。
 */
export function buildTrend(daily: DailyStats, period: TrendPeriod, now = new Date()): TrendPoint[] {
  if (period === 'year') {
    const points: TrendPoint[] = []
    const cur = new Date(now.getFullYear(), now.getMonth(), 1)
    for (let i = 11; i >= 0; i--) {
      const d = new Date(cur.getFullYear(), cur.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      let value = 0
      for (const [dk, v] of Object.entries(daily)) {
        if (dk.startsWith(key)) value += v
      }
      points.push({ label: `${d.getMonth() + 1}月`, key, value })
    }
    return points
  }

  const days = period === 'week' ? 7 : 30
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const points: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)
    const key = dateKeyOf(d)
    points.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, key, value: daily[key] ?? 0 })
  }
  return points
}

/** 趋势点求和（区间总字数）。 */
export function sumTrend(points: TrendPoint[]): number {
  return points.reduce((s, p) => s + p.value, 0)
}

/** 字数格式化：≥1 万 → x.x万 / x万，其余原样输出。 */
export function formatWordCount(n: number): string {
  if (n >= 10000) {
    const v = n / 10000
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}万`
  }
  return String(n)
}
