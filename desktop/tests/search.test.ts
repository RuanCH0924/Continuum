import { describe, expect, it } from 'vitest'
import { buildBm25, chunkText, cosine, searchBm25, tokenize, type SearchDoc } from '../src/main/services/search-core'

describe('search-core（本地 BM25 语义检索核心）', () => {
  it('chunkText 按块切分并保留重叠窗口', () => {
    const text = '甲'.repeat(1000)
    const chunks = chunkText(text, 500, 50)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].length).toBe(500)
    expect(chunks.join('').length).toBeGreaterThan(1000) // 重叠使总长增加
    expect(chunkText('短文本')).toEqual(['短文本'])
    expect(chunkText('')).toEqual([])
  })

  it('tokenize 中文单字 + 相邻二字 + 英文词', () => {
    const tokens = tokenize('顾青舟，剑客 sword 123')
    expect(tokens).toContain('顾')
    expect(tokens).toContain('青')
    expect(tokens).toContain('顾青')
    expect(tokens).toContain('青舟')
    expect(tokens).toContain('剑客') // 剑客二字相邻
    expect(tokens).toContain('sword')
    expect(tokens).toContain('123')
    expect(tokens).not.toContain('，')
  })

  it('BM25 将含查询词更多的文档排在更前', () => {
    const docs: SearchDoc[] = [
      { id: 'a', kind: 'character', title: '无关', text: '天气晴朗 阳光明媚 海风习习' },
      { id: 'b', kind: 'character', title: '命中', text: '主角顾青舟 顾青舟的剑 顾青舟性格冷峻' },
      { id: 'c', kind: 'world', title: '部分', text: '顾青舟偶尔出现一次' }
    ]
    const index = buildBm25(docs)
    const hits = searchBm25(index, '顾青舟')
    expect(hits[0].docIdx).toBe(1)
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
    expect(hits.map((h) => h.docIdx).sort()).toEqual([1, 2])
  })

  it('BM25 空语料与无命中返回空', () => {
    const empty = buildBm25([])
    expect(searchBm25(empty, '任意')).toEqual([])
    const index = buildBm25([{ id: 'a', kind: 'world', title: 'x', text: '纯正文' }])
    expect(searchBm25(index, '完全不存在词')).toEqual([])
  })

  it('cosine 余弦相似度', () => {
    expect(cosine([1, 0], [1, 0])).toBe(1)
    expect(cosine([1, 0], [0, 1])).toBe(0)
    expect(cosine([1, 2], [1, 2])).toBeCloseTo(1, 6)
    expect(cosine([], [])).toBe(0)
    expect(cosine([1], [1, 2])).toBe(0) // 维度不一致
  })
})
