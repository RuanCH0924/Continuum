// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../src/renderer/src/components/Sidebar'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import { useUiStore } from '../src/renderer/src/stores/uiStore'

const W1 = { id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }
const W2 = { id: 'w2', title: '作品B', description: '', createdAt: 0, updatedAt: 0 }
const C1 = { workId: 'w1', seq: 1, title: '第一章', file: '001_第一章.md' }
const C2 = { workId: 'w1', seq: 2, title: '第二章', file: '002_第二章.md' }
const VOL1 = {
  id: 'vol1',
  workId: 'w1',
  title: '第一卷',
  chapterSeqs: [1],
  order: 0,
  createdAt: 0,
  updatedAt: 0
}
const VOL2 = {
  id: 'vol2',
  workId: 'w1',
  title: '第二卷',
  chapterSeqs: [],
  order: 1,
  createdAt: 0,
  updatedAt: 0
}

function stubApi(api: unknown): void {
  ;(window as unknown as { api?: unknown }).api = api
}

function baseApi(): Record<string, unknown> {
  return {
    works: { list: vi.fn(async () => []) },
    chapters: { list: vi.fn(async () => []) },
    volumes: { list: vi.fn(async () => []) },
    notes: { list: vi.fn(async () => []) },
    settings: { get: vi.fn(async () => null) }
  }
}

function resetStores(): void {
  useAppStore.setState({
    works: [],
    chapters: [],
    volumes: [],
    notes: [],
    timeline: [],
    currentWorkId: null,
    currentChapter: null,
    unassignedLabel: ''
  })
  useUiStore.setState({ sidebarTab: 'works', clueFocus: null, timelineFocus: null })
}

function renderSidebar(): void {
  render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
  resetStores()
})

describe('侧栏操作重构：顶部「删除」按钮移除', () => {
  it('顶部操作行不再渲染「删除」按钮（删除仅通过右键菜单触发）', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    // 顶部仅保留 新建作品 / 新建章节 / 新建卷 与折叠
    expect(screen.getByRole('button', { name: '+ 作品' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 章节' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 卷' })).toBeInTheDocument()
    // 不存在任何名为「删除」的按钮
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull()
  })
})

describe('侧栏操作重构：作品节点右键菜单', () => {
  it('右键作品行 → 弹出「重命名作品 / 删除作品」菜单', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1, W2], chapters: [], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('作品B'), { clientX: 100, clientY: 100 })
    expect(screen.getByRole('menuitem', { name: '重命名作品' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '删除作品' })).toBeInTheDocument()
  })

  it('菜单「重命名作品」→ 弹出重命名弹窗', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('作品A'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名作品' }))
    expect(screen.getByText('重命名作品')).toBeInTheDocument()
    expect(screen.getByDisplayValue('作品A')).toBeInTheDocument()
  })

  it('菜单「删除作品」→ 二次确认 → works.delete 使用右键目标作品', async () => {
    const del = vi.fn(async () => true)
    stubApi({ ...baseApi(), works: { delete: del, list: vi.fn(async () => [W1, W2]) } })
    useAppStore.setState({ works: [W1, W2], chapters: [], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('作品B'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '删除作品' }))
    // 弹出二次确认（标题 = 删除作品）
    expect(screen.getByText('删除作品')).toBeInTheDocument()
    fireEvent.click(document.querySelector('button.bg-status-danger') as HTMLElement)
    await waitFor(() => expect(del).toHaveBeenCalledWith('w2'))
  })
})

describe('侧栏操作重构：卷节点右键菜单', () => {
  it('右键卷行 → 菜单含 重命名 / 上移 / 下移 / 删除，边界禁用正确', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [C1], volumes: [VOL1, VOL2], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('第一卷'), { clientX: 100, clientY: 100 })
    expect(screen.getByRole('menuitem', { name: '重命名卷' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '上移（卷排序）' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: '下移（卷排序）' })).not.toBeDisabled()
    expect(screen.getByRole('menuitem', { name: '删除卷' })).toBeInTheDocument()
  })

  it('菜单「重命名卷」→ 弹出重命名弹窗', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [C1], volumes: [VOL1], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('第一卷'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名卷' }))
    expect(screen.getByText('重命名卷')).toBeInTheDocument()
    expect(screen.getByDisplayValue('第一卷')).toBeInTheDocument()
  })

  it('菜单「删除卷」→ 二次确认 → volumes.delete', async () => {
    const delVol = vi.fn(async () => true)
    stubApi({ ...baseApi(), volumes: { delete: delVol, list: vi.fn(async () => []) } })
    useAppStore.setState({ works: [W1], chapters: [C1], volumes: [VOL1], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('第一卷'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '删除卷' }))
    expect(screen.getByText('删除卷')).toBeInTheDocument()
    fireEvent.click(document.querySelector('button.bg-status-danger') as HTMLElement)
    await waitFor(() => expect(delVol).toHaveBeenCalledWith('w1', 'vol1'))
  })
})

describe('侧栏操作重构：章节节点右键菜单', () => {
  it('右键章节行 → 菜单含 重命名 / 移动到卷（含勾选当前卷）/ 未分卷 / 删除', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [C1, C2], volumes: [VOL1], currentWorkId: 'w1' })
    renderSidebar()

    // 展开第一卷使卷内章节可见（第一章归属第一卷）
    fireEvent.click(screen.getByTitle('展开卷'))
    fireEvent.contextMenu(screen.getByText('第一章'), { clientX: 100, clientY: 100 })

    expect(screen.getByRole('menuitem', { name: '重命名章节' })).toBeInTheDocument()
    expect(screen.getByText('移动到卷')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '✓ 第一卷' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '未分卷' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '删除章节' })).toBeInTheDocument()
  })

  it('菜单「移动到卷 → 第二卷」→ volumes.setChapters 单归属迁移', async () => {
    const setChapters = vi.fn(async () => true)
    stubApi({ ...baseApi(), volumes: { setChapters, list: vi.fn(async () => []) } })
    useAppStore.setState({ works: [W1], chapters: [C1], volumes: [VOL1, VOL2], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.click(screen.getAllByTitle('展开卷')[0])
    fireEvent.contextMenu(screen.getByText('第一章'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '第二卷' }))
    // 目标卷加入章节，原卷移除（保证单归属）
    await waitFor(() => expect(setChapters).toHaveBeenCalledWith('w1', 'vol2', [1]))
    await waitFor(() => expect(setChapters).toHaveBeenCalledWith('w1', 'vol1', []))
  })

  it('菜单「移动到卷 → 未分卷」→ volumes.setChapters 移出卷', async () => {
    const setChapters = vi.fn(async () => true)
    stubApi({ ...baseApi(), volumes: { setChapters, list: vi.fn(async () => []) } })
    useAppStore.setState({ works: [W1], chapters: [C1], volumes: [VOL1], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.click(screen.getByTitle('展开卷'))
    fireEvent.contextMenu(screen.getByText('第一章'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '未分卷' }))
    await waitFor(() => expect(setChapters).toHaveBeenCalledWith('w1', 'vol1', []))
  })

  it('菜单「删除章节」→ 二次确认 → chapters.delete', async () => {
    const delCh = vi.fn(async () => true)
    stubApi({ ...baseApi(), chapters: { delete: delCh, list: vi.fn(async () => []) } })
    useAppStore.setState({ works: [W1], chapters: [C1], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.click(screen.getByTitle('展开分组'))
    fireEvent.contextMenu(screen.getByText('第一章'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '删除章节' }))
    expect(screen.getByText('删除章节')).toBeInTheDocument()
    fireEvent.click(document.querySelector('button.bg-status-danger') as HTMLElement)
    await waitFor(() => expect(delCh).toHaveBeenCalledWith('w1', 1))
  })
})

describe('侧栏操作重构：右键菜单定位与关闭', () => {
  it('菜单定位跟随鼠标坐标', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('作品A'), { clientX: 120, clientY: 80 })
    const menu = screen.getByTestId('sidebar-context-menu') as HTMLElement
    expect(menu.style.left).toBe('120px')
    expect(menu.style.top).toBe('80px')
  })

  it('菜单自动适配视窗边界避免溢出', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [], volumes: [], currentWorkId: 'w1' })

    const origW = window.innerWidth
    const origH = window.innerHeight
    try {
      // 模拟极小视窗，右键位置贴近右下角
      Object.defineProperty(window, 'innerWidth', { value: 100, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true })
      renderSidebar()
      fireEvent.contextMenu(screen.getByText('作品A'), { clientX: 90, clientY: 90 })
      const menu = screen.getByTestId('sidebar-context-menu') as HTMLElement
      // 越界时回收到边缘留白（8px）内
      expect(parseInt(menu.style.left, 10)).toBe(8)
      expect(parseInt(menu.style.top, 10)).toBe(8)
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: origW, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: origH, configurable: true })
    }
  })

  it('点击外部关闭菜单；Esc 关闭菜单', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('作品A'), { clientX: 100, clientY: 100 })
    expect(screen.getByTestId('sidebar-context-menu')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('sidebar-context-menu')).toBeNull()

    fireEvent.contextMenu(screen.getByText('作品A'), { clientX: 100, clientY: 100 })
    expect(screen.getByTestId('sidebar-context-menu')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('sidebar-context-menu')).toBeNull()
  })

  it('点击菜单项后菜单自动关闭', () => {
    stubApi(baseApi())
    useAppStore.setState({ works: [W1], chapters: [], volumes: [], currentWorkId: 'w1' })
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('作品A'), { clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名作品' }))
    expect(screen.queryByTestId('sidebar-context-menu')).toBeNull()
  })
})
