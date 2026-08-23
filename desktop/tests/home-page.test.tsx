// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../src/renderer/src/components/home/HomePage'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import { useUiStore } from '../src/renderer/src/stores/uiStore'
import type { WorkMeta } from '../src/shared/types'

const mk = (i: number, genre?: string): WorkMeta => ({
  id: `w${i}`,
  title: `作品${i}`,
  description: genre ? `第${i}号作品简介` : `第${i}号作品简介`,
  genre,
  createdAt: 1700000000000 + i * 1000,
  updatedAt: 1700000000000 + i * 1000
})

/** 9 部作品：武侠 ×3、都市 ×3、无题材 ×3（用于分类 / 分页测试）。 */
const NINE_WORKS = [
  ...Array.from({ length: 3 }, (_, i) => mk(i + 1, '武侠')),
  ...Array.from({ length: 3 }, (_, i) => mk(i + 4, '都市')),
  ...Array.from({ length: 3 }, (_, i) => mk(i + 7))
]

/** 最小 IPC stub：覆盖 HomePage 挂载时触发的统计刷新与卡片跳转所需的全部通道。 */
function stubApi(opts: {
  todayChars?: number
  totalChars?: number
  dailyStats?: Record<string, number>
} = {}): void {
  const today = new Date().toISOString().slice(0, 10)
  ;(window as unknown as { api?: unknown }).api = {
    stats: { totals: async () => ({ workChars: 0, totalChars: opts.totalChars ?? 0 }) },
    settings: {
      get: async (key: string) => {
        if (key === 'stats') return { todayChars: opts.todayChars ?? 0, todayDate: today, goalNotified: false }
        if (key === 'dailyGoal') return 2500
        if (key === 'dailyStats') return opts.dailyStats ?? {}
        return null
      },
      set: async () => true
    },
    works: { list: async () => [] },
    chapters: {
      list: async () => [{ workId: 'w1', seq: 1, title: '第一章', file: '001.md' }],
      read: async () => '第一章正文'
    },
    notes: { list: async () => [] },
    volumes: { list: async () => [] },
    timeline: { list: async () => [] },
    outlines: { list: async () => [] },
    chapterOutlines: { list: async () => [] },
    mindmap: { get: async () => null }
  }
}

const seed = (works: WorkMeta[]): void => {
  useAppStore.setState({
    works,
    chapters: [],
    volumes: [],
    currentWorkId: null,
    currentChapter: null,
    totalChars: 0,
    todayChars: 0,
    dailyGoal: 2500,
    dailyStats: {}
  })
  useUiStore.setState({ centralMode: 'home' })
}

/** 统计卡片 / 图表柱子数量（data-testid 前缀查询）。 */
function trendBars(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid^="trend-bar-"]').length
}

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
  useAppStore.setState({ works: [], totalChars: 0, todayChars: 0, dailyStats: {} })
  useUiStore.setState({ centralMode: 'home' })
})

describe('HomePage · 作品展览模块', () => {
  it('渲染作品卡片：标题 / 题材 / 创建时间', () => {
    stubApi()
    seed([mk(1, '武侠')])
    render(<HomePage />)
    expect(screen.getAllByText('作品1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('武侠').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/创建于/).length).toBe(1)
    expect(screen.getByText('我的书架')).toBeInTheDocument()
  })

  it('搜索框按关键词过滤作品（标题命中）', () => {
    stubApi()
    seed(NINE_WORKS)
    render(<HomePage />)
    fireEvent.change(screen.getByLabelText('搜索作品'), { target: { value: '作品5' } })
    expect(screen.getAllByText('作品5').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('作品1')).toHaveLength(0)
  })

  it('题材分类筛选：点击「武侠」仅展示武侠作品', () => {
    stubApi()
    seed(NINE_WORKS)
    render(<HomePage />)
    fireEvent.click(screen.getByTestId('genre-chip-武侠'))
    expect(screen.getAllByText('作品1').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('作品4')).toHaveLength(0) // 都市作品被过滤
    // 再次点击取消筛选
    fireEvent.click(screen.getByTestId('genre-chip-武侠'))
    expect(screen.queryAllByText('作品4').length).toBeGreaterThan(0)
  })

  it('分页：第一页 8 张卡片，下一页展示剩余 1 张', () => {
    stubApi()
    seed(NINE_WORKS)
    render(<HomePage />)
    // 每张卡片标题出现 2 次（封面题词 + 正文行）
    expect(screen.queryAllByText('作品1').length).toBe(2)
    expect(screen.queryAllByText('作品9')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.queryAllByText('作品9').length).toBe(2)
    expect(screen.queryAllByText('作品1')).toHaveLength(0)
    expect(screen.getByRole('button', { name: '上一页' })).not.toBeDisabled()
  })

  it('点击卡片：进入作品详情（selectWork + 中央模式切到编辑器）', async () => {
    stubApi()
    seed([mk(1, '武侠')])
    render(<HomePage />)
    fireEvent.click(screen.getAllByText('作品1')[0])
    await waitFor(() => expect(useAppStore.getState().currentWorkId).toBe('w1'))
    await waitFor(() => expect(useUiStore.getState().centralMode).toBe('editor'))
  })

  it('书架为空时展示新建 / 导入 / 示例入口', () => {
    stubApi()
    seed([])
    render(<HomePage />)
    expect(screen.getByText('新建作品')).toBeInTheDocument()
    expect(screen.getByText('导入作品')).toBeInTheDocument()
    expect(screen.getByText('打开示例')).toBeInTheDocument()
  })
})

describe('HomePage · 数据统计模块', () => {
  it('渲染指标卡与周（7 根）柱状图，支持切到年（12 根）', () => {
    stubApi({ todayChars: 300, totalChars: 12000, dailyStats: { '2026-08-23': 300 } })
    seed(NINE_WORKS)
    // 预置与 stub 一致的统计值，避免挂载刷新触发数字动画（保证断言即时稳定）
    useAppStore.setState({ totalChars: 12000, todayChars: 300, dailyStats: { '2026-08-23': 300 } })
    const { container } = render(<HomePage />)
    // 指标卡数值
    expect(screen.getAllByText('9').length).toBeGreaterThan(0) // 作品总数
    expect(screen.getAllByText('12,000').length).toBeGreaterThan(0) // 累计总字数
    expect(screen.getAllByText('300').length).toBeGreaterThan(0) // 今日字数
    expect(trendBars(container)).toBe(7)
    // 切换周期：年 → 12 个月柱子
    fireEvent.click(screen.getByRole('button', { name: '年' }))
    expect(trendBars(container)).toBe(12)
    fireEvent.click(screen.getByRole('button', { name: '月' }))
    expect(trendBars(container)).toBe(30)
  })

  it('今日字数达到目标后展示进度提示', () => {
    stubApi({ todayChars: 2500 })
    seed(NINE_WORKS)
    render(<HomePage />)
    expect(screen.getByText(/目标 2,?500/)).toBeInTheDocument()
  })
})
