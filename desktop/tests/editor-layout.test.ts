import { describe, expect, it } from 'vitest'
import {
  computeToolbarLayout,
  maxSidebarWidth,
  maxAiWidth,
  EDITOR_TOOLBAR_MIN,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
  AI_MIN,
  AI_MAX,
  type ToolbarLayoutItem
} from '../src/renderer/src/lib/editorLayout'

/** 与 EditorToolbar.makeTools 一致的工具栏条目（含估算宽度与核心标记）。 */
function toolbarItems(): ToolbarLayoutItem[] {
  const btn = (key: string, core = false): ToolbarLayoutItem => ({ key, width: 34, core })
  const div = (key: string): ToolbarLayoutItem => ({ key, width: 15 })
  return [
    btn('bold', true), btn('italic', true), btn('underline', true), btn('strike', true),
    div('d1'),
    btn('h1', true), btn('h2', true), btn('h3', true),
    div('d2'),
    btn('quote'), btn('ul'), btn('ol'), btn('task'),
    div('d3'),
    btn('table'), btn('link'), btn('image'), btn('code'), btn('hr'),
    div('d4'),
    btn('undo', true), btn('redo', true)
  ]
}

const CORE = ['bold', 'italic', 'underline', 'strike', 'h1', 'h2', 'h3', 'undo', 'redo']

describe('computeToolbarLayout（编辑菜单溢出折叠）', () => {
  it('宽屏：全部工具内联展示，无折叠无滚动', () => {
    const items = toolbarItems()
    const layout = computeToolbarLayout(1200, items)
    expect(layout.scrollable).toBe(false)
    expect(layout.moreKeys).toEqual([])
    expect(layout.inlineKeys).toEqual(items.map((i) => i.key))
  })

  it('窄屏：核心工具常驻内联，低频工具从末尾优先折叠', () => {
    const layout = computeToolbarLayout(460, toolbarItems())
    expect(layout.scrollable).toBe(false)
    expect(layout.moreKeys.length).toBeGreaterThan(0)
    // 核心工具永不折叠
    for (const k of CORE) expect(layout.inlineKeys).toContain(k)
    // 高频可选项保留内联，低频项（分隔线 / 列表等）折叠
    expect(layout.inlineKeys).toContain('quote')
    expect(layout.inlineKeys).toContain('ul')
    expect(layout.moreKeys).toContain('hr')
    expect(layout.moreKeys).toContain('ol')
    expect(layout.inlineKeys).not.toContain('hr')
  })

  it('出现「更多」时预留入口宽度，内联内容 + 入口不溢出容器', () => {
    const layout = computeToolbarLayout(465, toolbarItems())
    expect(layout.moreKeys.length).toBeGreaterThan(0)
    const inlineSum = layout.inlineKeys.reduce(
      (s, k) => s + (toolbarItems().find((i) => i.key === k)?.width ?? 0),
      0
    )
    // 内联内容(24 内边距 + 32 更多入口) ≤ 可用宽度
    expect(inlineSum + 24 + 32).toBeLessThanOrEqual(465)
  })

  it('极端窄屏：核心无法容纳时回退横向滚动，完整展示全部工具', () => {
    const items = toolbarItems()
    const layout = computeToolbarLayout(300, items)
    expect(layout.scrollable).toBe(true)
    expect(layout.moreKeys).toEqual([])
    expect(layout.inlineKeys).toEqual(items.map((i) => i.key))
  })
})

describe('侧栏拖拽宽度上限（编辑菜单最小安全宽度管控）', () => {
  it('宽屏（1920）：侧栏可拖至自身最大宽度', () => {
    expect(maxSidebarWidth(1920, 340)).toBe(SIDEBAR_MAX)
    expect(maxAiWidth(1920, 280)).toBe(AI_MAX)
  })

  it('常规屏（1280）：上限为编辑区预留最小安全宽度', () => {
    const side = maxSidebarWidth(1280, 340)
    expect(side).toBe(1280 - 340 - EDITOR_TOOLBAR_MIN - 10)
    // 拖到临界值时编辑区仍 ≥ 最小安全宽度
    expect(1280 - side - 340 - 10).toBeGreaterThanOrEqual(EDITOR_TOOLBAR_MIN)
  })

  it('小屏（900）：回退到面板自身最小宽度', () => {
    expect(maxSidebarWidth(900, 340)).toBe(SIDEBAR_MIN)
    expect(maxAiWidth(900, 280)).toBe(AI_MIN)
  })

  it('一侧面板较宽时，另一侧拖拽上限相应收紧', () => {
    // AI 面板 400 时，左侧侧栏上限更低
    const side = maxSidebarWidth(1200, 400)
    expect(side).toBe(1200 - 400 - EDITOR_TOOLBAR_MIN - 10)
    expect(side).toBeLessThan(SIDEBAR_MAX)
  })
})
