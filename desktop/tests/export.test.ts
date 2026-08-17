import { describe, expect, it } from 'vitest'
import { buildWorkMarkdown, mdToPlain } from '../src/renderer/src/lib/exporters'
import type { ChapterMeta, WorkMeta } from '../src/shared/types'

const WORK: WorkMeta = {
  id: 'w1',
  title: '雪山隐狐',
  description: '',
  createdAt: 0,
  updatedAt: 0
}

const CH1: ChapterMeta = { workId: 'w1', seq: 1, title: '第一章 · 序章', file: '001_x.md' }
const CH2: ChapterMeta = { workId: 'w1', seq: 2, title: '第二章', file: '002_y.md' }

describe('exporters（导出内容构建）', () => {
  it('mdToPlain 去除标题/引用/列表/代码块标记', () => {
    const md = ['# 第一章', '', '> 引言', '', '- 甲', '- 乙', '', '```', 'code', '```', '', '普通段落'].join('\n')
    const plain = mdToPlain(md)
    expect(plain).toContain('第一章')
    expect(plain).toContain('引言')
    expect(plain).toContain('· 甲')
    expect(plain).not.toContain('```')
    expect(plain).not.toContain('# 第一章')
    expect(plain).toContain('普通段落')
  })

  it('mdToPlain 折叠连续空行', () => {
    expect(mdToPlain('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('buildWorkMarkdown 组装书名与章节', () => {
    const md = buildWorkMarkdown(WORK, [
      { meta: CH1, content: '# 第一章 · 序章\n\n正文一' },
      { meta: CH2, content: '正文二' }
    ])
    expect(md).toContain('# 《雪山隐狐》')
    expect(md).toContain('## 第一章 · 序章')
    expect(md).toContain('正文一')
    expect(md).toContain('## 第二章')
    expect(md).toContain('正文二')
    // 标题应在正文之前
    expect(md.indexOf('## 第一章')).toBeLessThan(md.indexOf('正文一'))
  })

  it('buildWorkMarkdown 空章节列表仅含书名', () => {
    expect(buildWorkMarkdown(WORK, [])).toContain('# 《雪山隐狐》')
  })
})
