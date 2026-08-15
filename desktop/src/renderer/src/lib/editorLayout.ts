/**
 * 编辑区空间管控（editor layout）：
 * - 编辑工具栏最小安全宽度：中间编辑菜单必须完整显示的下限。
 * - 工具栏溢出折叠：核心工具常驻，低频工具按优先级折叠进「更多」入口。
 * - 侧栏拖拽宽度上限：左右侧栏的最大展开宽度不得侵占编辑菜单最小安全宽度。
 */

/** 编辑工具栏最小安全宽度（px）：核心编辑功能完整显示的下限。 */
export const EDITOR_TOOLBAR_MIN = 460

/** 侧栏分隔条宽度（px）：与 ResizeHandle 组件保持一致。 */
export const RESIZE_HANDLE_WIDTH = 5

export const SIDEBAR_MIN = 200
export const SIDEBAR_MAX = 520
export const AI_MIN = 240
export const AI_MAX = 600

/** 容器两侧内边距（px-3 = 12px × 2）。 */
const PADDING = 24
/** 「更多」入口按钮宽度（px）：出现折叠时需为其预留。 */
const MORE_BTN_WIDTH = 32

export interface ToolbarLayoutItem {
  key: string
  /** 估算宽度（px）：按钮 / 分隔条（已含项间距） */
  width: number
  /** 核心常驻项：空间不足时优先保证；仅当核心都放不下时回退横向滚动 */
  core?: boolean
}

export interface ToolbarLayout {
  /** 内联展示的条目 key（保持原始顺序） */
  inlineKeys: string[]
  /** 折叠进「更多」菜单的条目 key */
  moreKeys: string[]
  /** 核心项也无法容纳：回退为可横向滚动的完整展示 */
  scrollable: boolean
}

function pass(availableWidth: number, items: ToolbarLayoutItem[], reserveMore: boolean): ToolbarLayout {
  let budget = Math.max(0, availableWidth - PADDING - (reserveMore ? MORE_BTN_WIDTH : 0))
  const inline = new Set<string>()

  // 核心常驻项：依次占位，放不下则整体回退横向滚动
  for (const it of items) {
    if (!it.core) continue
    if (budget >= it.width) {
      inline.add(it.key)
      budget -= it.width
    } else {
      return { inlineKeys: items.map((i) => i.key), moreKeys: [], scrollable: true }
    }
  }

  // 可选工具：按数组顺序（优先保留高频项）尽量内联，超出部分折叠进「更多」
  const more: string[] = []
  for (const it of items) {
    if (it.core || inline.has(it.key)) continue
    if (budget >= it.width) {
      inline.add(it.key)
      budget -= it.width
    } else {
      more.push(it.key)
    }
  }
  return {
    inlineKeys: items.filter((i) => inline.has(i.key)).map((i) => i.key),
    moreKeys: more,
    scrollable: false
  }
}

/**
 * 计算工具栏布局：优先保证核心工具内联；低频工具按从后往前的顺序折叠进「更多」；
 * 出现「更多」时为其预留宽度重算，避免入口本身溢出；核心都无法容纳时回退横向滚动。
 */
export function computeToolbarLayout(
  availableWidth: number,
  items: ToolbarLayoutItem[]
): ToolbarLayout {
  const first = pass(availableWidth, items, false)
  if (first.moreKeys.length === 0) return first
  return pass(availableWidth, items, true)
}

/** 左侧创作侧栏可拖拽的最大宽度：不侵占编辑菜单最小安全宽度。 */
export function maxSidebarWidth(
  windowWidth: number,
  aiWidth: number,
  editorMin: number = EDITOR_TOOLBAR_MIN
): number {
  return Math.max(
    SIDEBAR_MIN,
    Math.min(SIDEBAR_MAX, windowWidth - aiWidth - editorMin - RESIZE_HANDLE_WIDTH * 2)
  )
}

/** 右侧 AI 面板可拖拽的最大宽度：不侵占编辑菜单最小安全宽度。 */
export function maxAiWidth(
  windowWidth: number,
  sidebarWidth: number,
  editorMin: number = EDITOR_TOOLBAR_MIN
): number {
  return Math.max(
    AI_MIN,
    Math.min(AI_MAX, windowWidth - sidebarWidth - editorMin - RESIZE_HANDLE_WIDTH * 2)
  )
}
