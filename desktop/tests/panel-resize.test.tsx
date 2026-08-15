// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResizeHandle } from '../src/renderer/src/components/ResizeHandle'
import { useUiStore } from '../src/renderer/src/stores/uiStore'

function stubSettingsApi(): { set: ReturnType<typeof vi.fn> } {
  const set = vi.fn(async () => true)
  ;(window as unknown as { api?: unknown }).api = { settings: { set, get: vi.fn(async () => null) } }
  return { set }
}

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
  useUiStore.setState({ sidebarWidth: 280, aiWidth: 340 })
})

describe('ResizeHandle（侧栏边界拖拽调整宽度）', () => {
  it('左侧面板：向右拖动增加宽度并触发 onChange / onDragEnd', () => {
    const onChange = vi.fn()
    const onDragEnd = vi.fn()
    render(<ResizeHandle direction="left" width={280} onChange={onChange} onDragEnd={onDragEnd} />)
    fireEvent.mouseDown(screen.getByRole('separator'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 130 })
    fireEvent.mouseUp(window)
    expect(onChange).toHaveBeenLastCalledWith(310)
    expect(onDragEnd).toHaveBeenCalled()
  })

  it('左侧面板：向左拖动减小宽度', () => {
    const onChange = vi.fn()
    render(<ResizeHandle direction="left" width={280} onChange={onChange} />)
    fireEvent.mouseDown(screen.getByRole('separator'), { clientX: 200 })
    fireEvent.mouseMove(window, { clientX: 160 })
    fireEvent.mouseUp(window)
    expect(onChange).toHaveBeenLastCalledWith(240)
  })

  it('右侧面板：向左拖动增加宽度（方向反转）', () => {
    const onChange = vi.fn()
    render(<ResizeHandle direction="right" width={340} onChange={onChange} />)
    fireEvent.mouseDown(screen.getByRole('separator'), { clientX: 300 })
    fireEvent.mouseMove(window, { clientX: 270 })
    fireEvent.mouseUp(window)
    expect(onChange).toHaveBeenLastCalledWith(370)
  })

  it('宽度被限制在 min / max 范围内', () => {
    const onChange = vi.fn()
    render(<ResizeHandle direction="left" width={100} min={200} max={600} onChange={onChange} />)
    fireEvent.mouseDown(screen.getByRole('separator'), { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: -500 })
    fireEvent.mouseUp(window)
    expect(onChange).toHaveBeenLastCalledWith(200)
  })
})

describe('uiStore（面板宽度持久化）', () => {
  it('setSidebarWidth / setAiWidth 更新宽度状态', () => {
    stubSettingsApi()
    useUiStore.getState().setSidebarWidth(360)
    useUiStore.getState().setAiWidth(420)
    expect(useUiStore.getState().sidebarWidth).toBe(360)
    expect(useUiStore.getState().aiWidth).toBe(420)
  })

  it('persistPanelSizes 将当前宽度写入 settings', async () => {
    const { set } = stubSettingsApi()
    useUiStore.setState({ sidebarWidth: 360, aiWidth: 420 })
    await useUiStore.getState().persistPanelSizes()
    expect(set).toHaveBeenCalledWith('ui.sidebarWidth', 360)
    expect(set).toHaveBeenCalledWith('ui.aiWidth', 420)
  })

  it('initPanelSizes 从 settings 恢复面板宽度', async () => {
    const get = vi.fn(async (key: string) => (key === 'ui.sidebarWidth' ? 360 : key === 'ui.aiWidth' ? 420 : null))
    ;(window as unknown as { api?: unknown }).api = { settings: { get, set: vi.fn(async () => true) } }
    await useUiStore.getState().initPanelSizes()
    expect(useUiStore.getState().sidebarWidth).toBe(360)
    expect(useUiStore.getState().aiWidth).toBe(420)
  })
})
