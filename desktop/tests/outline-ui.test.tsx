import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { OutlineTreeView } from '../src/renderer/src/components/outline/OutlineTreeView'
import { ExtractTab } from '../src/renderer/src/components/ExtractTab'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import { useAiStore } from '../src/renderer/src/stores/aiStore'
import type { ChapterMeta, OutlineNode } from '../src/shared/types'

const nodes: OutlineNode[] = [
  {
    id: 'p1', workId: 'w1', parentId: null, title: '第一卷 · 风起',
    content: '', kind: 'volume', beat: 'opening', targetWords: 50000,
    order: 0, createdAt: 0, updatedAt: 0
  },
  {
    id: 'c1', workId: 'w1', parentId: 'p1', title: '北境初雪',
    content: '顾青舟拔剑', kind: 'story', beat: 'climax', targetWords: 0,
    order: 0, createdAt: 0, updatedAt: 0
  }
]

const chapters: ChapterMeta[] = Array.from({ length: 12 }, (_, i) => ({
  workId: 'w1',
  seq: i + 1,
  title: `第${i + 1}章`,
  file: `${String(i + 1).padStart(3, '0')}_x.md`
}))

beforeEach(() => {
  ;(window as unknown as { api?: unknown }).api = {
    outlines: {
      list: async () => nodes,
      save: async (_w: string, n: OutlineNode) => ({ ...n, id: n.id || 'ol_new' }),
      delete: async () => true,
      reorder: async () => true
    },
    quota: { get: async () => ({ date: '2026-08-16', used: 0, budget: 100 }) }
  }
  useAppStore.setState({
    outlineNodes: nodes,
    chapters,
    notes: [],
    currentChapter: { workId: 'w1', seq: 8, title: '第八章', file: '008_x.md' }
  })
  useAiStore.setState({
    extractScope: 'current',
    extractCustom: [],
    extractRunning: false,
    extractProgress: null,
    extractResult: null,
    extractError: null,
    quota: { used: 0, budget: 100 }
  })
})

describe('OutlineTreeView（大纲树交互）', () => {
  it('折叠图标独立展开/折叠子节点（S4 交互职责分离）', () => {
    render(<OutlineTreeView granular="full" />)
    // 子节点初始隐藏
    expect(screen.queryByText('北境初雪')).toBeNull()
    // 点击行首折叠图标（title=展开）展开
    const expandBtn = screen.getByTitle('展开')
    fireEvent.click(expandBtn)
    expect(screen.getByText('北境初雪')).not.toBeNull()
    // 再次点击折叠
    fireEvent.click(screen.getByTitle('折叠'))
    expect(screen.queryByText('北境初雪')).toBeNull()
  })

  it('双击行体弹出重命名弹窗（兜底 dblclick）', () => {
    render(<OutlineTreeView granular="full" />)
    fireEvent.doubleClick(screen.getByText('第一卷 · 风起'))
    expect(screen.getByText('重命名节点')).not.toBeNull()
    expect(screen.getByDisplayValue('第一卷 · 风起')).not.toBeNull()
  })

  it('点击节点行展示右侧编辑面板（节奏标签/预估字数）', () => {
    render(<OutlineTreeView granular="full" />)
    fireEvent.click(screen.getByTitle('展开'))
    fireEvent.click(screen.getByText('北境初雪'))
    expect(screen.getByLabelText('节奏标签')).not.toBeNull()
    expect(screen.getByLabelText('预估字数')).not.toBeNull()
  })
})

describe('ExtractTab（智能章纲提取）', () => {
  it('当前章节范围：提取 1 章、消耗 1 次、配额展示', async () => {
    render(<ExtractTab />)
    expect(screen.getByText(/智能章纲提取/)).not.toBeNull()
    expect(screen.getByTestId('extract-preview').textContent).toContain('将提取 1 章')
    expect(await screen.findByText(/今日剩余配额：100 \/ 100/)).not.toBeNull()
  })

  it('切换最近 20 章：按锚点向前计算（不足 20 按实际）', () => {
    render(<ExtractTab />)
    fireEvent.click(screen.getByLabelText(/最近 20 章/))
    // 锚点第 8 章 → 提取 1..8 共 8 章
    expect(screen.getByTestId('extract-preview').textContent).toContain('将提取 8 章')
  })

  it('自定义范围：勾选章节后计算并过滤', () => {
    render(<ExtractTab />)
    fireEvent.click(screen.getByLabelText(/自定义范围/))
    const firstCheck = screen.getAllByRole('checkbox')[0]
    fireEvent.click(firstCheck)
    expect(screen.getByTestId('extract-preview').textContent).toContain('将提取 1 章')
  })
})
