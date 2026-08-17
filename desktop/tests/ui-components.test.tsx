// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../src/renderer/src/components/ConfirmDialog'
import { StatusBar } from '../src/renderer/src/components/StatusBar'
import { FormatSettings } from '../src/renderer/src/components/FormatSettings'
import { WorkWizard } from '../src/renderer/src/components/WorkWizard'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import { useAiStore } from '../src/renderer/src/stores/aiStore'

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
  vi.unstubAllGlobals()
})

describe('ConfirmDialog（二次确认弹窗）', () => {
  it('渲染标题与警示文案', () => {
    render(<ConfirmDialog title="删除作品" message="确定要删除吗？此操作不可恢复。" confirmLabel="删除" onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.getByText('删除作品')).toBeInTheDocument()
    expect(screen.getByText('确定要删除吗？此操作不可恢复。')).toBeInTheDocument()
  })

  it('点击取消触发 onCancel，点击确认触发 onConfirm', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="删除" message="提示" onCancel={onCancel} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe('StatusBar（数据化状态栏）', () => {
  it('渲染字数 / 今日增量 / 目标 / 模型', () => {
    useAppStore.setState({
      charCount: 1234,
      todayChars: 300,
      dailyGoal: 2500,
      lastSavedAt: 0
    })
    useAiStore.setState({ config: { ...useAiStore.getState().config, model: 'deepseek-chat' } })
    render(<StatusBar />)
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('+300')).toBeInTheDocument()
    expect(screen.getByText(/目标 2,?500/)).toBeInTheDocument()
    expect(screen.getByText('deepseek-chat')).toBeInTheDocument()
  })
})

/** 直接给 jsdom 的 window 挂 api（不替换 window 对象，避免破坏 React DOM 环境）。 */
function stubApi(api: unknown): void {
  ;(window as unknown as { api?: unknown }).api = api
}

describe('FormatSettings（格式设置面板）', () => {
  it('恢复默认时写入 settings', async () => {
    const set = vi.fn(async () => true)
    stubApi({ settings: { set } })
    render(<FormatSettings onClose={() => {}} />)
    fireEvent.click(screen.getByText('恢复默认'))
    expect(set).toHaveBeenCalledWith('format', expect.objectContaining({ fontSize: 100, typewriter: false }))
  })

  it('保存时持久化当前格式', async () => {
    const set = vi.fn(async () => true)
    stubApi({ settings: { set } })
    const onClose = vi.fn()
    render(<FormatSettings onClose={onClose} />)
    fireEvent.click(screen.getByText('保存'))
    expect(set).toHaveBeenCalled()
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

describe('WorkWizard（新建作品向导）', () => {
  it('作品名为空时创建按钮禁用，填写后可用并提交', async () => {
    const create = vi.fn(async () => ({}))
    stubApi({
      works: { create, list: vi.fn(async () => []) },
      chapters: { create: vi.fn(async () => ({})), list: vi.fn(async () => []) },
      settings: { set: vi.fn(async () => true), get: vi.fn(async () => null) }
    })
    render(<WorkWizard onClose={() => {}} />)
    const btn = screen.getByRole('button', { name: '创建' })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('如：雪山隐狐'), { target: { value: '测试书' } })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    await vi.waitFor(() => expect(create).toHaveBeenCalled())
  })
})
