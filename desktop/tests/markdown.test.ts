import { describe, expect, it } from 'vitest'
import { chineseCharCount, extractOutline, markdownIt, turndown } from '../src/renderer/src/lib/markdown'

describe('markdown 工具（M3 大纲提取 / 字数 / 往返序列化）', () => {
  it('extractOutline 按标题层级提取大纲', () => {
    const md = [
      '# 第一章 · 序章',
      '',
      '正文内容',
      '',
      '## 出城',
      '正文',
      '',
      '### 疑点',
      '',
      '### 伏笔',
      '## 入城'
    ].join('\n')
    const outline = extractOutline(md)
    expect(outline).toEqual([
      { level: 1, title: '第一章 · 序章' },
      { level: 2, title: '出城' },
      { level: 3, title: '疑点' },
      { level: 3, title: '伏笔' },
      { level: 2, title: '入城' }
    ])
  })

  it('extractOutline 忽略代码块中的井号行', () => {
    const md = ['# 真标题', '', '```', '# 不是标题', '```', '## 二级'].join('\n')
    const outline = extractOutline(md)
    expect(outline.map((o) => o.title)).toEqual(['真标题', '二级'])
  })

  it('extractOutline 空文本返回空数组', () => {
    expect(extractOutline('')).toEqual([])
  })

  it('chineseCharCount 剔除空白统计字数', () => {
    expect(chineseCharCount('夜色如墨，\n街灯 长街。')).toBe(10)
  })

  it('markdown-it 与 turndown 往返保持标题结构', () => {
    const md = '# 标题\n\n正文段落\n\n## 小节\n\n- 甲\n- 乙\n\n> 引用'
    const html = markdownIt.render(md)
    const back = turndown.turndown(html)
    expect(extractOutline(back).map((o) => o.title)).toEqual(['标题', '小节'])
    expect(back).toContain('正文段落')
    expect(back).toContain('> 引用')
  })
})
