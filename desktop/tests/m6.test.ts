import { describe, expect, it } from 'vitest'
import { RATE, progressAt, splitChunks } from '../src/main/services/typer-core'

describe('typer-core（跨窗口录入核心）', () => {
  it('splitChunks 按块切分并处理末尾余数', () => {
    expect(splitChunks('abcdef', 2)).toEqual(['ab', 'cd', 'ef'])
    expect(splitChunks('abcde', 2)).toEqual(['ab', 'cd', 'e'])
    expect(splitChunks('', 2)).toEqual([])
    expect(splitChunks('abc', 5)).toEqual(['abc'])
  })

  it('快慢节奏参数对齐旧版（200/0.5 与 100/5）', () => {
    expect(RATE.fast.chunk).toBe(200)
    expect(RATE.fast.pauseMs).toBe(500)
    expect(RATE.slow.chunk).toBe(100)
    expect(RATE.slow.pauseMs).toBe(5000)
  })

  it('progressAt 递增且不超过总长', () => {
    expect(progressAt(0, 200, 350)).toBe(0)
    expect(progressAt(1, 200, 350)).toBe(200)
    expect(progressAt(2, 200, 350)).toBe(350)
    expect(progressAt(5, 200, 350)).toBe(350)
  })

  it('中文字符按块切分不破坏字符', () => {
    const text = '夜风掠过长街，把一片枯叶卷上屋脊。'
    const chunks = splitChunks(text, 10)
    expect(chunks.join('')).toBe(text)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(10)
  })
})
