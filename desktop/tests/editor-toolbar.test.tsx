// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorToolbar } from '../src/renderer/src/components/EditorToolbar'
import type { Editor } from '@tiptap/react'

/** 可变的工具栏测量宽度（模拟不同窗口/编辑区尺寸） */
let mockWidth = 1200
/** 捕获 ResizeObserver 回调，用于模拟窗口缩放触发重排 */
let roCallback: (() => void) | null = null

class FakeResizeObserver {
  constructor(cb: () => void) {
    roCallback = cb
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const mockEditor = {
  on: vi.fn(),
  off: vi.fn(),
  isActive: () => false,
  getAttributes: () => ({}),
  chain: () => ({ focus: () => ({ run: vi.fn() }) })
} as unknown as Editor

beforeEach(() => {
  mockWidth = 1200
  roCallback = null
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => mockWidth
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
})

describe('EditorToolbar（编辑菜单空间管控：不同窗口尺寸 / 侧栏拖拽后）', () => {
  it('宽屏（1200px）：全部工具内联显示，无「更多」入口', () => {
    render(<EditorToolbar editor={mockEditor} />)
    expect(screen.queryByText('⋯')).toBeNull()
    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('↶')).toBeInTheDocument() // 撤销
    expect(screen.getByText('☑')).toBeInTheDocument() // 任务列表
    expect(screen.getByText('—')).toBeInTheDocument() // 分隔线
  })

  it('窄屏（460px）：核心工具保留内联，低频工具折叠进「更多」并可访问', () => {
    mockWidth = 460
    render(<EditorToolbar editor={mockEditor} />)
    // 核心编辑功能完整可见
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('H3')).toBeInTheDocument()
    expect(screen.getByText('↶')).toBeInTheDocument()
    // 低频工具折叠，出现「更多」入口
    expect(screen.queryByText('—')).toBeNull() // 分隔线已折叠
    expect(screen.getByText('⋯')).toBeInTheDocument()
    // 「更多」悬浮菜单可访问全部折叠项
    fireEvent.click(screen.getByText('⋯'))
    expect(screen.getByText('分隔线')).toBeInTheDocument()
    expect(screen.getByText('任务列表')).toBeInTheDocument()
  })

  it('极端窄屏（200px）：回退横向滚动容器，核心与全部工具均完整展示', () => {
    mockWidth = 200
    render(<EditorToolbar editor={mockEditor} />)
    expect(screen.queryByText('⋯')).toBeNull()
    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('☑')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    // 容器具备横向滚动能力，不会挤压溢出
    expect(document.querySelector('.overflow-x-auto')).not.toBeNull()
  })

  it('窗口缩放动态重排：缩窄折叠低频工具，恢复后完整显示', () => {
    render(<EditorToolbar editor={mockEditor} />)
    expect(screen.queryByText('⋯')).toBeNull()
    // 模拟侧栏拖宽 / 窗口缩窄 → 编辑区变窄
    mockWidth = 460
    act(() => roCallback?.())
    expect(screen.getByText('⋯')).toBeInTheDocument()
    expect(screen.queryByText('—')).toBeNull()
    // 模拟侧栏收起 / 窗口恢复 → 编辑区变宽
    mockWidth = 1200
    act(() => roCallback?.())
    expect(screen.queryByText('⋯')).toBeNull()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('☑')).toBeInTheDocument()
  })
})
