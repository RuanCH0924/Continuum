import { describe, expect, it } from 'vitest'
import { formatKnowledgeContext, KIND_LABEL } from '../src/renderer/src/lib/retrieval'
import type { SearchResult } from '../src/shared/types'

describe('retrieval（知识库注入上下文）', () => {
  it('KIND_LABEL 覆盖全部来源类型', () => {
    expect(KIND_LABEL.chapter).toBe('章节')
    expect(KIND_LABEL.character).toBe('角色')
    expect(KIND_LABEL.world).toBe('设定')
    expect(KIND_LABEL.clue).toBe('伏笔')
    expect(KIND_LABEL.material).toBe('素材')
  })

  it('formatKnowledgeContext 空结果返回空串', () => {
    expect(formatKnowledgeContext([])).toBe('')
  })

  it('formatKnowledgeContext 组装带来源标签的上下文', () => {
    const hits: SearchResult[] = [
      { kind: 'character', id: 'n1', title: '顾青舟', snippet: '冷峻剑客，左肩有旧伤', score: 92 },
      { kind: 'world', id: 'n2', title: '北境', snippet: '常年积雪，剑冢所在', score: 70 },
      { kind: 'chapter', id: 'ch-3', title: '第三章', snippet: '顾青舟在剑冢拔剑', score: 88, chapterSeq: 3 }
    ]
    const text = formatKnowledgeContext(hits)
    expect(text).toContain('[角色] 顾青舟：冷峻剑客，左肩有旧伤')
    expect(text).toContain('[设定] 北境：常年积雪，剑冢所在')
    expect(text).toContain('[章节] 第三章：顾青舟在剑冢拔剑')
    expect(text.split('\n')).toHaveLength(3)
  })
})
