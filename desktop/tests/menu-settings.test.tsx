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

  it('设置菜单保留入口：点击「设置中心」打开整合后的设置弹窗', () => {
    stubSettingsApi()
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.click(screen.getByText('设置中心'))
    expect(useUiStore.getState().settingsOpen).toBe(true)
  })
})

describe('设置弹窗：整合 AI 服务与格式设置', () => {
  it('打开后默认展示 AI 服务全部设置项', () => {
    stubSettingsApi()
    render(<SettingsDialog onClose={() => {}} />)
    expect(screen.getByText('服务商')).toBeInTheDocument()
    expect(screen.getByText(/API Key/)).toBeInTheDocument()
    expect(screen.getByText('Base URL')).toBeInTheDocument()
    expect(screen.getByText('模型')).toBeInTheDocument()
    expect(screen.getByText('温度（随机性）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '校验连接' })).toBeInTheDocument()
    // 格式设置项不在 AI Tab
    expect(screen.queryByText('正文字号（100%）')).toBeNull()
  })

  it('切换到格式 Tab：格式设置项完整展示（字号/行距/缩进/打字机/行号）', () => {
    stubSettingsApi()
    render(<SettingsDialog onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '格式' }))
    expect(screen.getByText('正文字号（100%）')).toBeInTheDocument()
    expect(screen.getByText('行距（1.9）')).toBeInTheDocument()
    expect(screen.getByText('首行缩进（2em）')).toBeInTheDocument()
    expect(screen.getByText('打字机模式（光标垂直居中）')).toBeInTheDocument()
    expect(screen.getByText('源码模式显示行号')).toBeInTheDocument()
    // AI 设置项不在格式 Tab
    expect(screen.queryByText('服务商')).toBeNull()
  })

  it('格式 Tab：保存设置项 → 写入 settings 并关闭弹窗', async () => {
    const { set } = stubSettingsApi()
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '格式' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(set).toHaveBeenCalledWith('format', expect.any(Object)))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('AI 服务 Tab：修改并保存设置项 → 持久化 ai 配置并关闭弹窗', async () => {
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
