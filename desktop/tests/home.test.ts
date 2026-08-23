import { describe, expect, it } from 'vitest'
import {
  buildTrend,
  filterWorks,
  formatWordCount,
  paginate,
  sumTrend,
  visiblePages,
  workGenre,
  workGenres
} from '../src/renderer/src/lib/homeStats'
import type { DailyStats, WorkMeta } from '../src/shared/types'

const work = (p: Partial<WorkMeta>): WorkMeta => ({
  id: 'w1',
  title: '未命名',
  description: '',
  createdAt: 0,
  updatedAt: 0,
  ...p
})

describe('首页 · 作品展览（题材解析 / 分类聚合 / 筛选 / 分页）', () => {
  it('workGenre 优先 genre 字段，缺失时回退解析简介「题材：xxx」', () => {
    expect(workGenre(work({ genre: '武侠' }))).toBe('武侠')
    expect(workGenre(work({ description: '副标题\n题材：都市\n简介' }))).toBe('都市')
    expect(workGenre(work({ description: '题材:玄幻 高武' }))).toBe('玄幻 高武')
    expect(workGenre(work({ description: '没有任何题材行' }))).toBe('')
  })

  it('workGenres 去重聚合全部题材', () => {
    const list = [
      work({ id: 'a', genre: '武侠' }),
      work({ id: 'b', description: '题材：都市' }),
      work({ id: 'c', genre: '武侠' }),
      work({ id: 'd' })
    ]
    expect(workGenres(list).sort()).toEqual(['武侠', '都市'].sort())
  })

  it('filterWorks 支持标题关键词、简介关键词与题材组合筛选', () => {
    const list = [
      work({ id: 'a', title: '雪山隐狐', genre: '武侠' }),
      work({ id: 'b', title: '都市夜行', description: '题材：都市' }),
      work({ id: 'c', title: '星海', description: '关于科幻的构想', genre: '科幻' })
    ]
    expect(filterWorks(list, { keyword: '雪山' }).map((w) => w.id)).toEqual(['a'])
    expect(filterWorks(list, { keyword: '科幻' }).map((w) => w.id)).toEqual(['c'])
    expect(filterWorks(list, { genre: '武侠' }).map((w) => w.id)).toEqual(['a'])
    expect(filterWorks(list, { keyword: 'x', genre: '武侠' })).toEqual([])
    expect(filterWorks(list, { keyword: '  ' })).toHaveLength(3)
  })

  it('paginate 按页切片，page 从 1 起', () => {
    const items = [1, 2, 3, 4, 5]
    expect(paginate(items, 1, 2)).toEqual([1, 2])
    expect(paginate(items, 3, 2)).toEqual([5])
    expect(paginate(items, 4, 2)).toEqual([])
  })

  it('visiblePages：小页码全量展示，大页码窗口折叠并保留首尾', () => {
    expect(visiblePages(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(visiblePages(3, 5)).toEqual([1, 2, 3, 4, 5])
    // total 10、当前 5：1 … 4 5 6 … 10
    expect(visiblePages(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
    expect(visiblePages(1, 10)).toEqual([1, 2, 'ellipsis', 10])
    expect(visiblePages(0, 0)).toEqual([])
  })
})

describe('首页 · 数据统计（周 / 月 / 年趋势聚合）', () => {
  const now = new Date(2026, 7, 23) // 2026-08-23

  const daily: DailyStats = {
    '2026-08-20': 1000,
    '2026-08-21': 2000,
    '2026-08-23': 500
  }

  it('buildTrend week 返回近 7 天（含今天），缺失日期补 0', () => {
    const points = buildTrend(daily, 'week', now)
    expect(points).toHaveLength(7)
    expect(points[0]).toEqual({ label: '8/17', key: '2026-08-17', value: 0 })
    expect(points[3]).toEqual({ label: '8/20', key: '2026-08-20', value: 1000 })
    expect(points[5]).toEqual({ label: '8/22', key: '2026-08-22', value: 0 })
    expect(points[6]).toEqual({ label: '8/23', key: '2026-08-23', value: 500 })
  })

  it('buildTrend month 返回近 30 天', () => {
    const points = buildTrend(daily, 'month', now)
    expect(points).toHaveLength(30)
    expect(points[29]).toEqual({ label: '8/23', key: '2026-08-23', value: 500 })
  })

  it('buildTrend year 按自然月聚合近 12 个月（含本月）', () => {
    const points = buildTrend(daily, 'year', now)
    expect(points).toHaveLength(12)
    expect(points[0].label).toBe('9月')
    expect(points[0].key).toBe('2025-09')
    expect(points[11]).toEqual({ label: '8月', key: '2026-08', value: 3500 })
  })

  it('sumTrend 求和区间字数', () => {
    expect(sumTrend(buildTrend(daily, 'week', now))).toBe(3500)
    expect(sumTrend([])).toBe(0)
  })

  it('formatWordCount 万字格式化', () => {
    expect(formatWordCount(9999)).toBe('9999')
    expect(formatWordCount(15000)).toBe('1.5万')
    expect(formatWordCount(120000)).toBe('12万')
    expect(formatWordCount(0)).toBe('0')
  })
})
