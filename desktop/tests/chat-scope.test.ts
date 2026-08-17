import { beforeEach, describe, expect, it } from 'vitest'
import { assembleBookContent } from '../src/renderer/src/lib/outline/chatScope'
import type { OutlineNode, ChapterOutline, Note } from '../src/shared/types'

// 模拟 window.api（jsdom 环境下渲染层 IPC 桥）
beforeEach(() => {
  ;(window as unknown as { api?: unknown }).api = {
    chapters: {
      read: async (_workId: string, seq: number) => `第${seq}章正文内容……`
    }
  }
})

const outlineNodes: OutlineNode[] = [
  {
    id: 'n1', workId: 'w1', parentId: null, title: '北境风云', content: '顾青舟入剑冢拔剑',
    kind: 'story', beat: 'climax', targetWords: 50000, order: 0, createdAt: 0, updatedAt: 0
  }
]
const chapterOutlines: ChapterOutline[] = [
  {
    id: 'c1', workId: 'w1', chapterSeq: 3,
    corePlot: '初遇苏雪', characterScenes: '交手试探', conflict: '残剑认主', hook: '剑身文字',
    content: '', extracted: true, status: 'writing', updatedAt: 0
  }
]
const notes: Note[] = [
  { id: 'ch1', kind: 'character', title: '顾青舟', tag: '主角', content: '冷峻剑客', updatedAt: 0 },
  { id: 'w1n', kind: 'world', title: '北境', tag: '地理', content: '常年积雪', updatedAt: 0 }
]

describe('大纲挂载问答「本书内容」组装', () => {
  it('显式引用大纲节点：仅注入被引用内容', async () => {
    const ctx = await assembleBookContent({
      workId: 'w1',
      outlineNodes,
      chapterOutlines,
      notes,
      refs: [{ kind: 'outline', id: 'n1', label: '大纲《北境风云》' }]
    })
    expect(ctx.content).toContain('[大纲] 北境风云：顾青舟入剑冢拔剑')
    expect(ctx.content).not.toContain('[章纲]')
    expect(ctx.sourceSummary).toContain('引用 ×1')
  })

  it('显式引用章节：读取正文并注入', async () => {
    const ctx = await assembleBookContent({
      workId: 'w1',
      outlineNodes,
      chapterOutlines,
      notes,
      refs: [{ kind: 'chapter', id: '3', label: '第3章' }]
    })
    expect(ctx.content).toContain('[章节] 第3章')
    expect(ctx.content).toContain('第3章正文内容')
  })

  it('无显式引用：全量组装（大纲+章纲+创作知识）', async () => {
    const ctx = await assembleBookContent({ workId: 'w1', outlineNodes, chapterOutlines, notes, refs: [] })
    expect(ctx.content).toContain('[大纲] 北境风云')
    expect(ctx.content).toContain('[章纲] 第3章')
    expect(ctx.content).toContain('[角色] 顾青舟')
    expect(ctx.sourceSummary).toContain('大纲+章纲')
  })

  it('注入窗口截断（maxLen）', async () => {
    const ctx = await assembleBookContent({
      workId: 'w1',
      outlineNodes,
      chapterOutlines,
      notes,
      refs: [{ kind: 'outline', id: 'n1', label: 'x' }],
      maxLen: 20
    })
    expect(ctx.content.length).toBeLessThanOrEqual(20)
  })

  it('无作品上下文返回空', async () => {
    const ctx = await assembleBookContent({ workId: null, outlineNodes, chapterOutlines, notes, refs: [] })
    expect(ctx.content).toBe('')
  })
})
