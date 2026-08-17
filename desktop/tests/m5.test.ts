import { afterEach, describe, expect, it, vi } from 'vitest'
import { createKeyMatcher, formatKeys } from '../src/renderer/src/lib/hotkeys'
import { useToastStore } from '../src/renderer/src/stores/toastStore'
import { useUiStore, THEME_ORDER } from '../src/renderer/src/stores/uiStore'

function keyEvent(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return { key: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...partial } as KeyboardEvent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hotkeys（快捷键匹配）', () => {
  it('Ctrl+K 仅在按下 Ctrl 且键为 k 时匹配', () => {
    const match = createKeyMatcher(['ctrl', 'k'])
    expect(match(keyEvent({ key: 'k', ctrlKey: true }))).toBe(true)
    expect(match(keyEvent({ key: 'k', metaKey: true }))).toBe(true)
    expect(match(keyEvent({ key: 'j', ctrlKey: true }))).toBe(false)
    expect(match(keyEvent({ key: 'k' }))).toBe(false)
  })

  it('F11 无修饰键直接匹配', () => {
    const match = createKeyMatcher(['f11'])
    expect(match(keyEvent({ key: 'F11' }))).toBe(true)
    expect(match(keyEvent({ key: 'f1' }))).toBe(false)
  })

  it('Ctrl+Alt+T 需要双修饰键', () => {
    const match = createKeyMatcher(['ctrl', 'alt', 't'])
    expect(match(keyEvent({ key: 't', ctrlKey: true, altKey: true }))).toBe(true)
    expect(match(keyEvent({ key: 't', ctrlKey: true }))).toBe(false)
  })

  it('formatKeys 格式化为可读组合', () => {
    expect(formatKeys(['ctrl', 'alt', 't'])).toBe('Ctrl + Alt + T')
    expect(formatKeys(['f11'])).toBe('F11')
    expect(formatKeys(['ctrl', 'enter'])).toBe('Ctrl + Enter')
  })
})

describe('uiStore（主题矩阵）', () => {
  it('cycleTheme 沿主题顺序循环并持久化', async () => {
    let savedTheme: unknown = null
    vi.stubGlobal('window', {
      api: {
        settings: {
          get: vi.fn(async () => savedTheme),
          set: vi.fn(async (_k: string, v: unknown) => {
            savedTheme = v
            return true
          })
        }
      }
    })
    const ui = useUiStore.getState()
    await ui.setTheme('light')
    expect(THEME_ORDER).toContain(ui.theme)
    await ui.cycleTheme()
    expect(useUiStore.getState().theme).toBe(THEME_ORDER[1])
    expect(savedTheme).toBe(THEME_ORDER[1])
    // 循环回到起点
    await useUiStore.getState().setTheme(THEME_ORDER[THEME_ORDER.length - 1])
    await useUiStore.getState().cycleTheme()
    expect(useUiStore.getState().theme).toBe(THEME_ORDER[0])
  })
})

describe('toastStore（Toast / 通知）', () => {
  it('notify 加入浮层与历史，dismiss 移除浮层', () => {
    vi.useFakeTimers()
    useToastStore.getState().clearAll()
    useToastStore.getState().notify('success', '已保存')
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().history).toHaveLength(1)
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('clearAll 清空通知历史', () => {
    useToastStore.getState().notify('error', '失败')
    useToastStore.getState().clearAll()
    expect(useToastStore.getState().history).toHaveLength(0)
  })
})
