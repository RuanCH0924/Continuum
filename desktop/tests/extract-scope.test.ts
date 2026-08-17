import { describe, expect, it } from 'vitest'
import { resolveExtractSeqs, outlineFilled } from '../src/renderer/src/lib/outline/extractScope'
import type { ChapterMeta } from '../src/shared/types'

const chapters: ChapterMeta[] = Array.from({ length: 30 }, (_, i) => ({
  workId: 'w1',
  seq: i + 1,
  title: `第${i + 1}章`,
  file: `${String(i + 1).padStart(3, '0')}_x.md`
}))

describe('章纲提取范围解析', () => {
  it('当前章节：锚点章节', () => {
    const { seqs, error } = resolveExtractSeqs(chapters, 5, 'current', [])
    expect(error).toBeNull()
    expect(seqs).toEqual([5])
  })

  it('当前章节：未指定锚点时取最后一章', () => {
    const { seqs } = resolveExtractSeqs(chapters, null, 'current', [])
    expect(seqs).toEqual([30])
  })

  it('最近 20 章：自锚点向前 20 章', () => {
    const { seqs } = resolveExtractSeqs(chapters, 25, 'recent20', [])
    expect(seqs).toHaveLength(20)
    expect(seqs[0]).toBe(6)
    expect(seqs[19]).toBe(25)
  })

  it('最近 20 章：不足 20 章按实际（锚点在前部）', () => {
    const { seqs } = resolveExtractSeqs(chapters, 5, 'recent20', [])
    expect(seqs).toEqual([1, 2, 3, 4, 5])
  })

  it('自定义范围：过滤无效章节并排序去重', () => {
    const { seqs } = resolveExtractSeqs(chapters, null, 'custom', [30, 3, 3, 999, 7])
    expect(seqs).toEqual([3, 7, 30])
  })

  it('自定义范围超过 50 章拒绝', () => {
    const many: ChapterMeta[] = Array.from({ length: 60 }, (_, i) => ({
      workId: 'w1',
      seq: i + 1,
      title: `第${i + 1}章`,
      file: `${String(i + 1).padStart(3, '0')}_x.md`
    }))
    const big = Array.from({ length: 51 }, (_, i) => i + 1)
    const { error } = resolveExtractSeqs(many, null, 'custom', big)
    expect(error).toContain('最多提取 50 章')
  })

  it('空章节作品提示', () => {
    const { error } = resolveExtractSeqs([], null, 'current', [])
    expect(error).toContain('还没有章节')
  })

  it('自定义范围未选择有效章节', () => {
    const { error } = resolveExtractSeqs(chapters, null, 'custom', [])
    expect(error).toContain('未选择有效章节')
  })
})

describe('章纲填写状态', () => {
  it('任一结构化字段非空即视为已填写', () => {
    expect(outlineFilled({ corePlot: 'a', characterScenes: '', conflict: '', hook: '' })).toBe(true)
    expect(outlineFilled({ corePlot: '  ', characterScenes: '', conflict: '', hook: '' })).toBe(false)
    expect(outlineFilled({ corePlot: '', characterScenes: '', conflict: '', hook: '悬念' })).toBe(true)
  })
})
