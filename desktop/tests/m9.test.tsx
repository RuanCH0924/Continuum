// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../src/renderer/src/components/Sidebar'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import { useUiStore } from '../src/renderer/src/stores/uiStore'
import type { TimelineEntry } from '@shared/types'

const TL1: TimelineEntry = { id: 'tl1', workId: 'w1', time: '第三年·春', summary: '顾青舟下山', order: 0, createdAt: 1, updatedAt: 1 }
const TL2: TimelineEntry = { id: 'tl2', workId: 'w1', time: '第三年·夏', summary: '北境初遇', order: 1, createdAt: 2, updatedAt: 2 }

function stubApi(api: unknown): void {
  ;(window as unknown as { api?: unknown }).api = api
}

function stubTimelineApi(): {
  save: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
  reorder: ReturnType<typeof vi.fn>
} {
  const save = vi.fn(async (_w: string, e: TimelineEntry) => ({ ...e, id: e.id || 'new-tl' }))
  const list = vi.fn(async () => [TL1, TL2])
  const del = vi.fn(async () => true)
  const reorder = vi.fn(async () => true)
  stubApi({
    timeline: { list, save, delete: del, reorder },
    works: { list: vi.fn(async () => []) },
    chapters: { list: vi.fn(async () => []) },
    notes: { list: vi.fn(async () => []) },
    settings: { get: vi.fn(async () => null) }
  })
  return { save, list, del, reorder }
}

function setTimelineState(): void {
  useAppStore.setState({
    works: [{ id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }],
    chapters: [],
    timeline: [TL1, TL2],
    currentWorkId: 'w1'
  })
  useUiStore.setState({ sidebarTab: 'timeline', timelineFocus: null, clueFocus: null })
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
})

describe('M8 时间线：新建 / 内联编辑 / 排序 / 删除', () => {
  it('「+ 新建」→ 输入时间 → 确认后调用 timeline.save 并刷新列表', async () => {
    const { save, list } = stubTimelineApi()
    setTimelineState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '+ 新建' }))
    expect(screen.getByText('新建时间线')).toBeInTheDocument()
    const input = screen.getByPlaceholderText('时间描述（如：第三年 · 春）')
    fireEvent.change(input, { target: { value: '第三年·冬' } })
    fireEvent.click(screen.getByRole('button', { name: '确定' }))

    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith('w1', expect.objectContaining({ time: '第三年·冬' }))
    )
    expect(list).toHaveBeenCalled()
  })

  it('内联编辑时间输入框并失焦 → 防抖立即落盘', async () => {
    const { save } = stubTimelineApi()
    setTimelineState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    const timeInput = screen.getByDisplayValue('第三年·春')
    fireEvent.change(timeInput, { target: { value: '第三年·冬' } })
    fireEvent.blur(timeInput)
    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith('w1', expect.objectContaining({ id: 'tl1', time: '第三年·冬' }))
    )
  })

  it('内联编辑剧情梗概文本框并失焦 → 保存', async () => {
    const { save } = stubTimelineApi()
    setTimelineState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    const summaryBox = screen.getByDisplayValue('顾青舟下山')
    fireEvent.change(summaryBox, { target: { value: '顾青舟下山 · 遇见神秘老者' } })
    fireEvent.blur(summaryBox)
    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ id: 'tl1', summary: '顾青舟下山 · 遇见神秘老者' })
      )
    )
  })

  it('排序：第二条目点「上移」→ 交换顺序调用 timeline.reorder', async () => {
    const { reorder } = stubTimelineApi()
    setTimelineState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    const tl2El = document.querySelector('[data-timeline-id="tl2"]') as HTMLElement
    fireEvent.click(within(tl2El).getByTitle('上移（时间线排序）'))
    await vi.waitFor(() => expect(reorder).toHaveBeenCalledWith('w1', ['tl2', 'tl1']))
  })

  it('删除：条目 ✕ → 二次确认 → 调用 timeline.delete', async () => {
    const { del } = stubTimelineApi()
    setTimelineState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    const tl1El = document.querySelector('[data-timeline-id="tl1"]') as HTMLElement
    fireEvent.click(within(tl1El).getByTitle('删除时间线条目'))
    // 确认框的「删除」按钮（bg-status-danger，与侧栏时间线删除操作区分）
    const confirmBtn = document.querySelector('button.bg-status-danger') as HTMLElement
    fireEvent.click(confirmBtn)
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith('w1', 'tl1'))
  })
})

describe('M8 时间线：联动聚焦与侧栏状态适配', () => {
  it('timelineFocus 信号 → 目标条目临时高亮', () => {
    stubTimelineApi()
    setTimelineState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    act(() => {
      useUiStore.setState({ timelineFocus: { entryId: 'tl2', ts: Date.now() } })
    })
    const tl2El = document.querySelector('[data-timeline-id="tl2"]') as HTMLElement
    expect(tl2El.className).toContain('ring-brand-500')
  })

  it('侧栏收起态：点击时间线图标 → 展开并切换到时间线 Tab（功能稳定）', () => {
    stubTimelineApi()
    setTimelineState()
    const onToggleCollapse = vi.fn()
    render(<Sidebar collapsed onToggleCollapse={onToggleCollapse} />)

    fireEvent.click(screen.getByTitle('时间线'))
    expect(onToggleCollapse).toHaveBeenCalled()
    expect(useUiStore.getState().sidebarTab).toBe('timeline')
  })

  it('展开态下时间线条目完整渲染（含时间输入与梗概文本框）', () => {
    stubTimelineApi()
    setTimelineState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)
    expect(screen.getByDisplayValue('第三年·春')).toBeInTheDocument()
    expect(screen.getByDisplayValue('第三年·夏')).toBeInTheDocument()
    expect(screen.getByDisplayValue('顾青舟下山')).toBeInTheDocument()
    expect(screen.getByDisplayValue('北境初遇')).toBeInTheDocument()
  })
})
