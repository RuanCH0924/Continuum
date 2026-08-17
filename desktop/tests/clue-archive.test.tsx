// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../src/renderer/src/components/Sidebar'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import { useUiStore } from '../src/renderer/src/stores/uiStore'
import type { DeleteNotesResult, Note, NoteKind, NoteListOptions } from '@shared/types'

const CLUE1: Note = { id: 'c1', kind: 'clue', title: '旧车票', tag: '已埋设', content: '第二章出现', chapterSeq: 2, anchorText: '旧车票', updatedAt: 10 }
const CLUE2: Note = { id: 'c2', kind: 'clue', title: '神秘的手链', tag: '进行中', content: '', anchorText: '神秘的手链', updatedAt: 9 }
const MAT1: Note = { id: 'm1', kind: 'material', title: '灵感片段', tag: '描写', content: '风雪夜', updatedAt: 8 }
const ARCHIVED: Note = { id: 'c3', kind: 'clue', title: '已回收的伏笔', tag: '已回收', content: '闭环', chapterSeq: 1, anchorText: '已回收的伏笔', archived: true, archivedAt: 500, updatedAt: 7 }

function stubApi(api: unknown): void {
  ;(window as unknown as { api?: unknown }).api = api
}

/** 内存态 notes API stub：归档/恢复/删除实时生效，模拟双列表（活跃 + 归档池）。 */
function makeNotesStub(initial: Note[]): {
  all: Note[]
  list: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  deleteBatch: ReturnType<typeof vi.fn>
} {
  let all = [...initial]
  const list = vi.fn(async (_w: string, kind?: NoteKind, opts?: NoteListOptions) => {
    let out = all.filter((n) => (n.archived === true) === (opts?.archived === true))
    if (kind) out = out.filter((n) => n.kind === kind)
    return [...out].sort((a, b) => b.updatedAt - a.updatedAt)
  })
  const save = vi.fn(async (_w: string, note: Note) => {
    const merged: Note = { ...note, id: note.id || `note_${Date.now()}` }
    const idx = all.findIndex((n) => n.id === merged.id)
    if (idx >= 0) all[idx] = merged
    else all.push(merged)
    return merged
  })
  const deleteBatch = vi.fn(async (w: string, ids: string[]): Promise<DeleteNotesResult> => {
    const doomed = all.filter((n) => ids.includes(n.id))
    all = all.filter((n) => !ids.includes(n.id))
    return {
      deleted: doomed.map((n) => n.id),
      missing: ids.filter((id) => !doomed.some((n) => n.id === id)),
      log: doomed.map((n) => ({ id: n.id, workId: w, kind: n.kind, title: n.title, tag: n.tag, content: n.content, chapterSeq: n.chapterSeq, anchorText: n.anchorText, deletedAt: Date.now() }))
    }
  })
  return { all, list, save, deleteBatch }
}

function setCluesState(): void {
  useAppStore.setState({
    works: [{ id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }],
    chapters: [
      { workId: 'w1', seq: 1, title: '第一章', file: '001_第一章.md' },
      { workId: 'w1', seq: 2, title: '第二章', file: '002_第二章.md' }
    ],
    currentWorkId: 'w1',
    notes: [CLUE1, CLUE2],
    archivedNotes: [ARCHIVED]
  })
  useUiStore.setState({ sidebarTab: 'clues', clueFocus: null, timelineFocus: null })
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
  useAppStore.setState({ notes: [], archivedNotes: [] })
})

describe('伏笔归档：单条归档 / 归档池检索 / 恢复', () => {
  it('卡片「归档」→ 保存 archived 标志并移出活跃列表', async () => {
    const stub = makeNotesStub([CLUE1, CLUE2])
    stubApi({
      notes: { list: stub.list, save: stub.save, deleteBatch: stub.deleteBatch, deleteLogs: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null) }
    })
    setCluesState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    fireEvent.click(screen.getAllByTitle('归档（移入归档池，保留完整数据）')[0])
    await vi.waitFor(() =>
      expect(stub.save).toHaveBeenCalledWith('w1', expect.objectContaining({ id: 'c1', archived: true }))
    )
    // 归档后移出活跃列表（列表经 loadNotes 刷新）
    await vi.waitFor(() => expect(screen.queryByText('旧车票')).toBeNull())
    expect(screen.getByText('神秘的手链')).toBeInTheDocument()
  })

  it('打开归档池：显示归档项、按类型筛选、恢复回到活跃列表', async () => {
    const stub = makeNotesStub([CLUE1, CLUE2, MAT1, ARCHIVED])
    stubApi({
      notes: { list: stub.list, save: stub.save, deleteBatch: stub.deleteBatch, deleteLogs: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null) }
    })
    setCluesState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    // 进入归档池
    fireEvent.click(screen.getByTitle('打开归档池（伏笔 / 素材统一归档管理）'))
    expect(screen.getByText('归档池（1）')).toBeInTheDocument()
    expect(screen.getByText('已回收的伏笔')).toBeInTheDocument()
    expect(screen.getByText(/归档于/)).toBeInTheDocument()

    // 按内容类型筛选：切「素材」→ 归档伏笔隐藏
    fireEvent.click(screen.getByTitle('筛选：素材'))
    expect(screen.getByText('归档池（0）')).toBeInTheDocument()
    expect(screen.queryByText('已回收的伏笔')).toBeNull()

    // 切回「全部」→ 恢复单条
    fireEvent.click(screen.getByTitle('筛选：全部内容'))
    fireEvent.click(screen.getByTitle('恢复（回到活跃列表）'))
    await vi.waitFor(() =>
      expect(stub.save).toHaveBeenCalledWith('w1', expect.objectContaining({ id: 'c3', archived: false }))
    )
    // 恢复后归档池清空，活跃列表出现该伏笔
    await vi.waitFor(() => expect(screen.getByText('归档池（0）')).toBeInTheDocument())
  })

  it('归档池批量删除：勾选后确认 → 调用批量删除并留存日志', async () => {
    const stub = makeNotesStub([CLUE1, CLUE2, ARCHIVED])
    stubApi({
      notes: { list: stub.list, save: stub.save, deleteBatch: stub.deleteBatch, deleteLogs: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null) }
    })
    setCluesState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    fireEvent.click(screen.getByTitle('打开归档池（伏笔 / 素材统一归档管理）'))
    fireEvent.click(screen.getByTitle('选择（可批量恢复 / 删除）'))
    fireEvent.click(screen.getByTitle('批量删除选中项（留存删除日志快照）'))
    const confirmBtn = document.querySelector('button.bg-status-danger') as HTMLElement
    fireEvent.click(confirmBtn)
    await vi.waitFor(() => expect(stub.deleteBatch).toHaveBeenCalledWith('w1', ['c3']))
    await vi.waitFor(() => expect(screen.getByText('归档池（0）')).toBeInTheDocument())
  })
})

describe('伏笔批量删除：多选 → 二次确认 → 批量删除（正文关联同步清除）', () => {
  it('勾选两条伏笔 → 删除确认 → deleteBatch 携带全部选中 id', async () => {
    const stub = makeNotesStub([CLUE1, CLUE2])
    stubApi({
      notes: { list: stub.list, save: stub.save, deleteBatch: stub.deleteBatch, deleteLogs: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null) }
    })
    setCluesState()
    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)

    const boxes = screen.getAllByTitle('选择（可批量归档 / 删除）')
    fireEvent.click(boxes[0])
    fireEvent.click(boxes[1])
    expect(screen.getByText('已选 2 项')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('批量删除选中伏笔（留存删除日志快照）'))
    expect(screen.getByText(/确定要删除选中的 2 项吗/)).toBeInTheDocument()
    const confirmBtn = document.querySelector('button.bg-status-danger') as HTMLElement
    fireEvent.click(confirmBtn)

    await vi.waitFor(() =>
      expect(stub.deleteBatch).toHaveBeenCalledWith('w1', expect.arrayContaining(['c1', 'c2']))
    )
    await vi.waitFor(() => expect(screen.queryByText('旧车票')).toBeNull())
  })
})
