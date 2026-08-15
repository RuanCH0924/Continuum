// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Header } from '../src/renderer/src/components/Header'
import { SettingsDialog } from '../src/renderer/src/components/SettingsDialog'
import { FormatSettings } from '../src/renderer/src/components/FormatSettings'
import { useUiStore } from '../src/renderer/src/stores/uiStore'
import { useAiStore } from '../src/renderer/src/stores/aiStore'
import { useAppStore } from '../src/renderer/src/stores/appStore'

function stubApi(api: unknown): void {
  ;(window as unknown as { api?: unknown }).api = api
}

function stubSettingsApi(overrides: Record<string, unknown> = {}): {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
} {
  const get = vi.fn(async () => null)
  const set = vi.fn(async () => true)
  stubApi({ settings: { get, set }, ...overrides })
  return { get, set }
}

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
  useUiStore.setState({ settingsOpen: false, formatOpen: false, theme: 'light', aiCollapsed: false })
  useAiStore.setState({ configLoaded: false })
  useAppStore.setState({ todayChars: 0, dailyGoal: 2500, charCount: 0, lastSavedAt: null })
})

describe('菜单栏调整：AI 条目移除 / 视图精简 / 设置菜单保留入口', () => {
  it('菜单栏不再显示「AI」菜单条目', () => {
    stubSettingsApi()
    render(<Header />)
    expect(screen.queryByRole('button', { name: 'AI' })).toBeNull()
    // 其余菜单仍存在
    expect(screen.getByRole('button', { name: '文件' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '视图' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument()
  })

  it('视图菜单仅保留「沉浸模式」，不再含 循环切换主题 / 格式设置', () => {
    stubSettingsApi()
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: '视图' }))
    expect(screen.getByText('沉浸模式')).toBeInTheDocument()
    expect(screen.queryByText('循环切换主题')).toBeNull()
    expect(screen.queryByText('格式设置')).toBeNull()
  })

  it('设置菜单保留入口：单击「设置」直接打开整合后的设置弹窗（无二级菜单）', () => {
    stubSettingsApi()
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    // 单击直达：不展开下拉菜单，直接置位 settingsOpen
    expect(useUiStore.getState().settingsOpen).toBe(true)
    expect(screen.queryByText('设置中心')).toBeNull()
  })
})

describe('设置弹窗：左右分栏（左侧固定侧边栏 + 右侧内容区）', () => {
  it('左侧侧边栏集中展示全部设置大类（AI 服务 / 格式 / 写作目标）', () => {
    stubSettingsApi()
    render(<SettingsDialog onClose={() => {}} />)
    // 全部分类同时展示在侧边栏，默认选中「AI 服务」
    expect(screen.getByRole('button', { name: 'AI 服务' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '格式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '写作目标' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI 服务' }).className).toContain('brand-50')
  })

  it('打开后默认展示 AI 服务全部设置项', () => {
    stubSettingsApi()
    render(<SettingsDialog onClose={() => {}} />)
    expect(screen.getByText('服务商')).toBeInTheDocument()
    expect(screen.getByText(/API Key/)).toBeInTheDocument()
    expect(screen.getByText('Base URL')).toBeInTheDocument()
    expect(screen.getByText('模型')).toBeInTheDocument()
    expect(screen.getByText('温度（随机性）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '校验连接' })).toBeInTheDocument()
    // 格式设置项不在 AI 分类
    expect(screen.queryByText('正文字号（100%）')).toBeNull()
  })

  it('切换到格式分类：格式设置项完整展示（字号/行距/缩进/打字机/行号）', () => {
    stubSettingsApi()
    render(<SettingsDialog onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '格式' }))
    expect(screen.getByText('正文字号（100%）')).toBeInTheDocument()
    expect(screen.getByText('行距（1.9）')).toBeInTheDocument()
    expect(screen.getByText('首行缩进（2em）')).toBeInTheDocument()
    expect(screen.getByText('打字机模式（光标垂直居中）')).toBeInTheDocument()
    expect(screen.getByText('源码模式显示行号')).toBeInTheDocument()
    // AI 设置项不在格式分类
    expect(screen.queryByText('服务商')).toBeNull()
  })

  it('格式分类：保存设置项 → 写入 settings 并关闭弹窗', async () => {
    const { set } = stubSettingsApi()
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '格式' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(set).toHaveBeenCalledWith('format', expect.any(Object)))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('AI 服务分类：修改并保存设置项 → 持久化 ai 配置并关闭弹窗', async () => {
    const { set } = stubSettingsApi()
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)
    const modelInput = screen.getByDisplayValue('deepseek-chat')
    fireEvent.change(modelInput, { target: { value: 'deepseek-coder' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith('ai', expect.objectContaining({ model: 'deepseek-coder' }))
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('写作目标分类：展示今日已写 / 今日目标 / 完成进度等字数指标', async () => {
    const get = vi.fn(async (key: string) => {
      if (key === 'stats') return { todayChars: 1000, todayDate: new Date().toISOString().slice(0, 10), goalNotified: false }
      if (key === 'dailyGoal') return 2500
      return null
    })
    stubApi({ settings: { get, set: vi.fn(async () => true) } })
    render(<SettingsDialog onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '写作目标' }))
    // 等待 loadStats 异步刷新完成
    await screen.findByText('1,000')
    // 指标看板
    expect(screen.getByText('今日已写')).toBeInTheDocument()
    expect(screen.getByText('今日目标')).toBeInTheDocument()
    expect(screen.getByText('完成进度')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument() // 1000 / 2500
    expect(screen.getByText('还差 1,500 字')).toBeInTheDocument()
    // 当前章节字数 + 目标输入
    expect(screen.getByText('当前章节字数')).toBeInTheDocument()
    expect(screen.getByText('每日目标字数')).toBeInTheDocument()
  })

  it('写作目标分类：修改并保存每日目标 → 写入 settings dailyGoal 并关闭弹窗', async () => {
    const { set } = stubSettingsApi()
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '写作目标' }))
    fireEvent.change(screen.getByLabelText('每日目标字数'), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(set).toHaveBeenCalledWith('dailyGoal', 3000))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('点击 ✕ 与点击遮罩均可关闭设置弹窗', () => {
    stubSettingsApi()
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledTimes(1)

    const overlay = document.querySelector('[class*="bg-black"]') as HTMLElement
    fireEvent.mouseDown(overlay)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('格式设置功能保留（独立弹窗与设置中心双入口可用）', () => {
  it('独立格式设置弹窗仍可正常打开并保存（原实现逻辑保留）', async () => {
    const set = vi.fn(async () => true)
    stubApi({ settings: { set } })
    const onClose = vi.fn()
    render(<FormatSettings onClose={onClose} />)
    expect(screen.getByText('格式设置')).toBeInTheDocument()
    fireEvent.click(screen.getByText('保存'))
    expect(set).toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
