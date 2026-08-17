import { describe, expect, it } from 'vitest'
import { parseMindMapText, mindMapTemplate } from '../src/shared/mindmap-parse'

describe('mindmap 文本导入解析（XMind/缩进/Markdown）', () => {
  it('Tab 缩进文本（XMind 大纲导出）', () => {
    const text = '主线剧情\n\t开篇\n\t\t获得金手指\n\t\t初遇女主\n\t发展\n\t高潮'
    const { root, fixed } = parseMindMapText(text)
    expect(fixed).toBe(0)
    expect(root?.text).toBe('主线剧情')
    expect(root?.children.map((c) => c.text)).toEqual(['开篇', '发展', '高潮'])
    expect(root?.children[0].children.map((c) => c.text)).toEqual(['获得金手指', '初遇女主'])
  })

  it('空格缩进（2 空格）', () => {
    const text = '主线\n  分支1\n    子分支1\n  分支2'
    const { root } = parseMindMapText(text)
    expect(root?.children.map((c) => c.text)).toEqual(['分支1', '分支2'])
    expect(root?.children[0].children[0].text).toBe('子分支1')
  })

  it('Markdown 无序列表（- + 缩进）', () => {
    const text = '- 主线\n  - 分支1\n    - 子分支1\n- 分支2'
    const { root } = parseMindMapText(text)
    expect(root?.text).toBe('主线')
    expect(root?.children[0].text).toBe('分支1')
    expect(root?.children[0].children[0].text).toBe('子分支1')
    // 第二个顶层项挂到根下
    expect(root?.children.some((c) => c.text === '分支2')).toBe(true)
  })

  it('Markdown 标题（# 层级）', () => {
    const text = '# 主线\n## 分支1\n### 子分支1\n## 分支2'
    const { root } = parseMindMapText(text)
    expect(root?.children.map((c) => c.text)).toEqual(['分支1', '分支2'])
    expect(root?.children[0].children[0].text).toBe('子分支1')
  })

  it('深度跳变自动修正并计数', () => {
    const text = '主线\n\t分支1\n\t\t\t子分支跳级（实际应 2 级）'
    const { root, fixed } = parseMindMapText(text)
    expect(fixed).toBeGreaterThan(0)
    expect(root?.children[0].children.length).toBe(1)
  })

  it('空文本 / 无层级返回 null', () => {
    expect(parseMindMapText('').root).toBeNull()
    expect(parseMindMapText('   \n\t\n  ').root).toBeNull()
  })

  it('模板：剧情线 / 人物关系 / 世界观', () => {
    expect(mindMapTemplate('story').text).toBe('作品总纲')
    expect(mindMapTemplate('story').children.map((c) => c.text)).toContain('开篇')
    expect(mindMapTemplate('characters').children.map((c) => c.text)).toContain('主角')
    expect(mindMapTemplate('world').children.map((c) => c.text)).toContain('世界观')
  })
})
