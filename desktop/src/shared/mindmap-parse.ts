/**
 * 思维导图文本导入解析（PRD v1.0 §8.5）。
 *
 * 支持四种格式（主/渲染进程共用）：
 *  1. Tab 缩进纯文本（XMind「大纲」导出）：每 Tab 一级
 *  2. 空格缩进（2/4 空格）：连续空格数 ÷ 最小缩进单位取整为深度
 *  3. Markdown 无序列表（- / * / +，子项缩进 2/4 空格）
 *  4. Markdown 标题（# / ## / ### …）：标题级别 = 深度
 * 首个非空行 = 根；深度跳变 > 1 时自动修正（挂到最近可行父节点）并计数。
 */

import type { MindMapNode } from './types'

export interface MindMapParseResult {
  root: MindMapNode | null
  /** 深度跳变修正次数 */
  fixed: number
}

interface LineItem {
  depth: number
  text: string
}

/** 计算行的深度与文本（Tab 每级 +1；空格按最小缩进单位折算；标题级别减一归一化到根=0）。 */
function lineItemOf(line: string, spaceUnit: number): LineItem | null {
  const heading = /^(#{1,6})\s+(.*)$/.exec(line)
  if (heading) {
    const text = heading[2].trim()
    return text ? { depth: heading[1].length - 1, text } : null
  }
  let indent = 0
  let i = 0
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    if (line[i] === '\t') {
      indent += spaceUnit
      i++
    } else {
      indent++
      i++
    }
  }
  let rest = line.slice(i)
  const list = /^[-*+]\s+(.*)$/.exec(rest)
  if (list) rest = list[1]
  rest = rest.trim()
  if (!rest) return null
  const depth = indent === 0 ? 0 : Math.max(1, Math.round(indent / spaceUnit))
  return { depth, text: rest }
}

/** 计算最小缩进单位（出现空格缩进的行取最小正缩进，兜底 2）。 */
function detectSpaceUnit(lines: string[]): number {
  let unit = 2
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) continue
    const m = /^(\s*)[-*+]\s/.exec(line)
    const leading = m ? m[1].replace(/\t/g, '  ').length : /^[ \t]+/.exec(line)?.[0].replace(/\t/g, '  ').length ?? 0
    if (leading > 0) unit = Math.min(unit, leading)
  }
  return Math.max(1, unit)
}

/** 解析思维导图文本为树；无有效内容时 root 为 null。 */
export function parseMindMapText(text: string): MindMapParseResult {
  const lines = (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { root: null, fixed: 0 }

  const spaceUnit = detectSpaceUnit(lines)
  const items = lines
    .map((l) => lineItemOf(l, spaceUnit))
    .filter((item): item is LineItem => item !== null)
  if (items.length === 0) return { root: null, fixed: 0 }

  let fixed = 0
  let n = 0
  const makeNode = (text: string): MindMapNode => {
    n += 1
    return { id: `mm_${n}`, text, children: [] }
  }
  const root = makeNode(items[0].text)
  // 栈：{ depth, node }；根深度记为 0
  const stack: { depth: number; node: MindMapNode }[] = [{ depth: 0, node: root }]

  for (const item of items.slice(1)) {
    let depth = item.depth
    // 深度跳变修正：超过父节点 +1 时钳制（深度本身以 0 为根基准，但根不参与层级计算）
    const maxAllowed = stack[stack.length - 1].depth + 1
    if (depth > maxAllowed) {
      fixed += 1
      depth = maxAllowed
    }
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop()
    }
    const parent = stack[stack.length - 1].node
    const child = makeNode(item.text)
    parent.children.push(child)
    stack.push({ depth, node: child })
  }

  return { root, fixed }
}

/** 常用思维导图模板根结构（剧情线 / 人物关系 / 世界观）。 */
export function mindMapTemplate(kind: 'story' | 'characters' | 'world'): MindMapNode {
  const root: MindMapNode = { id: 'mm_root', text: '作品总纲', children: [] }
  const branches =
    kind === 'characters'
      ? ['核心人物', '主角', '配角', '反派', '关系网络']
      : kind === 'world'
        ? ['世界观', '地理', '势力', '力量体系', '关键设定']
        : ['主线剧情', '开篇', '发展', '高潮', '结局']
  root.children = branches.map((text, i) => ({
    id: `mm_b${i}`,
    text,
    children: []
  }))
  return root
}
