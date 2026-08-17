// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor as TiptapEditor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { chapterTitleAction } from '../src/renderer/src/lib/chapterTitle'
import { applyForeshadowMarks, clueStatusOf, findAnchorRanges, findClueAnchorRange, findTextRanges } from '../src/renderer/src/lib/clueLink'
import { ForeshadowMark } from '../src/renderer/src/lib/tiptapExts'
import { SelectionToolbar } from '../src/renderer/src/components/SelectionToolbar'
import { Sidebar } from '../src/renderer/src/components/Sidebar'
import { useEditorStore } from '../src/renderer/src/stores/editorStore'
import { useAppStore } from '../src/renderer/src/stores/appStore'
import type { Editor } from '@tiptap/react'
import type { Note } from '@shared/types'

function stubApi(api: unknown): void {
  ;(window as unknown as { api?: unknown }).api = api
}

afterEach(() => {
  cleanup()
  useEditorStore.setState({ editor: null })
  delete (window as unknown as { api?: unknown }).api
})

describe('M8 编辑器初始化：章节标题块插入决策', () => {
  it('首块已是标题块 → exists（不重复插入）', () => {
    expect(chapterTitleAction('chapterTitle', '第一章', '第一章')).toBe('exists')
  })
  it('首块为普通段落且文本等于章节名 → rebind（此前保存的标题块重新绑定）', () => {
    expect(chapterTitleAction('paragraph', '第一章', '第一章')).toBe('rebind')
  })
  it('空文档 / 首块文本不符 → insert（内容开头插入标题块）', () => {
    expect(chapterTitleAction(null, '', '第一章')).toBe('insert')
    expect(chapterTitleAction('paragraph', '风雪夜', '第一章')).toBe('insert')
  })
})

describe('M8 伏笔联动：锚点检索与状态推断', () => {
  it('findTextRanges：查找全部出现位置（不重叠）', () => {
    expect(findTextRanges('a-b-a-c-a', 'a')).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
      { start: 8, end: 9 }
    ])
    expect(findTextRanges('中文的锚点很中文', '中文')).toEqual([
      { start: 0, end: 2 },
      { start: 6, end: 8 }
    ])
    expect(findTextRanges('没有任何匹配', '不存在')).toEqual([])
    expect(findTextRanges('abc', '')).toEqual([])
  })

  it('findAnchorRanges：文本整体偏移换算为 PM 位置', () => {
    const textNode = { isText: true, text: '寒风呼啸，神秘的手链静静躺在雪地。' }
    const fakeDoc = {
      textContent: '寒风呼啸，神秘的手链静静躺在雪地。',
      descendants(cb: (n: unknown, pos: number) => void): void {
        cb(textNode, 1)
      }
    }
    const fakeEditor = { state: { doc: fakeDoc } } as unknown as Editor
    expect(findAnchorRanges(fakeEditor, '神秘的手链')).toEqual([{ from: 6, to: 11 }])
    expect(findAnchorRanges(fakeEditor, '雪地')).toEqual([{ from: 15, to: 17 }])
    expect(findAnchorRanges(fakeEditor, '不存在')).toEqual([])
  })

  it('clueStatusOf：按 tag 推断伏笔状态', () => {
    const note = (tag: string): Note =>
      ({ id: 'n', kind: 'clue', title: 't', tag, content: '', updatedAt: 0 }) as Note
    expect(clueStatusOf(note('已埋设'))).toBe('buried')
    expect(clueStatusOf(note('进行中'))).toBe('active')
    expect(clueStatusOf(note('已回收'))).toBe('resolved')
    expect(clueStatusOf(note('伏笔·伏'))).toBe('other')
  })

  it('findClueAnchorRange：同文多出现时按创建偏移消歧（精准关联，避免关联错位）', () => {
    const textNode = { isText: true, text: '手链出现了两次，第一次在开头，手链第二次在结尾。' }
    const fakeDoc = {
      textContent: textNode.text,
      descendants(cb: (n: unknown, pos: number) => void): void {
        cb(textNode, 1)
      }
    }
    const fakeEditor = { state: { doc: fakeDoc } } as unknown as Editor
    // 无偏移 → 取首次出现
    expect(findClueAnchorRange(fakeEditor, { anchorText: '手链' })).toEqual({ from: 1, to: 3 })
    // 有偏移且靠近第二次出现 → 取第二次（距 offset=20 最近）
    expect(findClueAnchorRange(fakeEditor, { anchorText: '手链', anchorOffset: 20 })).toEqual({ from: 16, to: 18 })
    // 锚点已失效 → null（可实时校验）
    expect(findClueAnchorRange(fakeEditor, { anchorText: '不存在的锚点' })).toBeNull()
  })

  it('applyForeshadowMarks：删除伏笔后正文标识同步取消（含删除当前章节最后一个伏笔）', () => {
    const editor = new TiptapEditor({
      extensions: [StarterKit, ForeshadowMark],
      content: '<p>旧车票与神秘的手链都在这里。</p>'
    })
    const clueA: Note = { id: 'c1', kind: 'clue', title: '旧车票', tag: '已埋设', content: '', chapterSeq: 1, anchorText: '旧车票', updatedAt: 0 }
    const clueB: Note = { id: 'c2', kind: 'clue', title: '神秘的手链', tag: '进行中', content: '', chapterSeq: 1, anchorText: '神秘的手链', updatedAt: 0 }

    // 初始：两个伏笔均被标记
    applyForeshadowMarks(editor, [clueA, clueB], 1)
    expect(editor.getHTML()).toContain('data-foreshadow')

    // 删除其中一个 → 该伏笔标识消失，另一个保留
    applyForeshadowMarks(editor, [clueB], 1)
    const htmlAfterPartial = editor.getHTML()
    expect(htmlAfterPartial).toContain('data-foreshadow')
    expect(htmlAfterPartial).not.toContain('data-note-id="c1"')

    // 删除全部伏笔 → 正文中所有伏笔标识同步取消（回归：此前 relevant 为空时提前 return 导致残留）
    applyForeshadowMarks(editor, [], 1)
    expect(editor.getHTML()).not.toContain('data-foreshadow')
    editor.destroy()
  })

  it('applyForeshadowMarks：归档全部伏笔后正文标识同步取消', () => {
    const editor = new TiptapEditor({
      extensions: [StarterKit, ForeshadowMark],
      content: '<p>旧车票仍在。</p>'
    })
    const clue: Note = { id: 'c1', kind: 'clue', title: '旧车票', tag: '已回收', content: '', chapterSeq: 1, anchorText: '旧车票', updatedAt: 0 }
    applyForeshadowMarks(editor, [clue], 1)
    expect(editor.getHTML()).toContain('data-foreshadow')
    // 归档后不再标记
    applyForeshadowMarks(editor, [{ ...clue, archived: true }], 1)
    expect(editor.getHTML()).not.toContain('data-foreshadow')
    editor.destroy()
  })
})

describe('M8 伏笔联动：选区「创建伏笔」交互', () => {
  it('选中文本后出现「创建伏笔」按钮，点击弹出锚点绑定的伏笔表单', () => {
    const fakeEditor = {
      state: {
        selection: { from: 2, to: 8, empty: false },
        doc: { textBetween: () => '神秘的手链' }
      },
      on: vi.fn(),
      off: vi.fn(),
      view: { coordsAtPos: () => ({ top: 40, left: 30 }) }
    }
    useEditorStore.setState({ editor: fakeEditor as unknown as Editor })
    useAppStore.setState({
      currentChapter: { workId: 'w1', seq: 3, title: '第三章', file: '003_第三章.md' }
    })

    render(<SelectionToolbar />)
    const btn = screen.getByRole('button', { name: '创建伏笔' })
    expect(btn).toBeInTheDocument()

    fireEvent.click(btn)
    // 弹出表单：锚点绑定说明 + 原文片段 + 标题预填
    expect(screen.getByText(/原文锚点/)).toBeInTheDocument()
    expect(screen.getByText(/神秘的手链/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('神秘的手链')).toBeInTheDocument()
  })

  it('未选中文本（空选区）时不渲染悬浮条', () => {
    const fakeEditor = {
      state: { selection: { from: 2, to: 2, empty: true } },
      on: vi.fn(),
      off: vi.fn(),
      view: { coordsAtPos: () => ({ top: 40, left: 30 }) }
    }
    useEditorStore.setState({ editor: fakeEditor as unknown as Editor })
    const { container } = render(<SelectionToolbar />)
    expect(container.firstChild).toBeNull()
  })
})

describe('M8 章节管理：卷名重命名（编辑卷名）', () => {
  it('卷行「重命名」按钮 → 弹出重命名弹窗，确认后调用 volumes.rename', async () => {
    const rename = vi.fn(async () => true)
    const list = vi.fn(async () => [
      { id: 'vol1', workId: 'w1', title: '第一卷', chapterSeqs: [], order: 0, createdAt: 0, updatedAt: 0 }
    ])
    stubApi({
      volumes: { rename, list },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      notes: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null) }
    })
    useAppStore.setState({
      works: [{ id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }],
      chapters: [],
      volumes: [
        { id: 'vol1', workId: 'w1', title: '第一卷', chapterSeqs: [], order: 0, createdAt: 0, updatedAt: 0 }
      ],
      currentWorkId: 'w1'
    })

    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)
    // 右键卷行 → 上下文菜单「重命名卷」→ 弹出重命名弹窗
    fireEvent.contextMenu(screen.getByTitle(/双击重命名；/), { clientX: 120, clientY: 80 })
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名卷' }))
    expect(screen.getByText('重命名卷')).toBeInTheDocument()
    const input = screen.getByDisplayValue('第一卷')
    fireEvent.change(input, { target: { value: '第一卷 · 风起' } })
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    await vi.waitFor(() => expect(rename).toHaveBeenCalledWith('w1', 'vol1', '第一卷 · 风起'))
    // 保存后刷新卷列表
    expect(list).toHaveBeenCalled()
  })

  it('双击卷名（点击配对，不依赖原生 dblclick）→ 弹出重命名弹窗，且不触发展开/折叠', () => {
    stubApi({
      volumes: { rename: vi.fn(async () => true), list: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      notes: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null) }
    })
    useAppStore.setState({
      works: [{ id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }],
      chapters: [{ workId: 'w1', seq: 1, title: '第一章', file: '001_第一章.md' }],
      volumes: [
        { id: 'vol1', workId: 'w1', title: '第一卷', chapterSeqs: [1], order: 0, createdAt: 0, updatedAt: 0 }
      ],
      currentWorkId: 'w1'
    })

    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)
    // 模拟浏览器真实双击：连续两次 click（原生 dblclick 可能不触发，故不依赖它）
    const row = screen.getByTitle(/双击重命名；/)
    fireEvent.click(row)
    fireEvent.click(row)
    // 弹出重命名弹窗
    expect(screen.getByText('重命名卷')).toBeInTheDocument()
    expect(screen.getByDisplayValue('第一卷')).toBeInTheDocument()
    // 未触发展开/折叠：卷内章节行不应渲染
    expect(screen.queryByText('第一章')).toBeNull()
  })

  it('单击卷行不展开；点击折叠图标展开/折叠卷', () => {
    stubApi({
      volumes: { rename: vi.fn(async () => true), list: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      notes: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null) }
    })
    useAppStore.setState({
      works: [{ id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }],
      chapters: [{ workId: 'w1', seq: 1, title: '第一章', file: '001_第一章.md' }],
      volumes: [
        { id: 'vol1', workId: 'w1', title: '第一卷', chapterSeqs: [1], order: 0, createdAt: 0, updatedAt: 0 }
      ],
      currentWorkId: 'w1'
    })

    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)
    // 单击卷行不触发展开
    fireEvent.click(screen.getByTitle(/双击重命名；/))
    expect(screen.queryByText('第一章')).toBeNull()
    // 点击展开箭头 → 卷内章节出现
    fireEvent.click(screen.getByTitle('展开卷'))
    expect(screen.getByText('第一章')).toBeInTheDocument()
    // 点击折叠箭头 → 卷内章节收起
    fireEvent.click(screen.getByTitle('折叠卷'))
    expect(screen.queryByText('第一章')).toBeNull()
  })

  it('双击「未分卷」分组 → 弹出重命名分组弹窗并持久化', async () => {
    const settingsSet = vi.fn(async () => true)
    stubApi({
      volumes: { rename: vi.fn(async () => true), list: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      notes: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null), set: settingsSet }
    })
    useAppStore.setState({
      works: [{ id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }],
      chapters: [{ workId: 'w1', seq: 1, title: '第一章', file: '001_第一章.md' }],
      volumes: [],
      currentWorkId: 'w1',
      unassignedLabel: ''
    })

    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)
    // 双击「未分卷」分组（点击配对）
    const row = screen.getByText('未分卷')
    fireEvent.click(row)
    fireEvent.click(row)
    expect(screen.getByText('重命名分组')).toBeInTheDocument()
    const input = screen.getByDisplayValue('未分卷')
    fireEvent.change(input, { target: { value: '支线剧情' } })
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    await vi.waitFor(() => expect(settingsSet).toHaveBeenCalledWith('unassignedLabel_w1', '支线剧情'))
  })

  it('自定义分组名显示生效', () => {
    stubApi({
      volumes: { rename: vi.fn(async () => true), list: vi.fn(async () => []) },
      works: { list: vi.fn(async () => []) },
      chapters: { list: vi.fn(async () => []) },
      notes: { list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => '支线剧情'), set: vi.fn(async () => true) }
    })
    useAppStore.setState({
      works: [{ id: 'w1', title: '作品A', description: '', createdAt: 0, updatedAt: 0 }],
      chapters: [{ workId: 'w1', seq: 1, title: '第一章', file: '001_第一章.md' }],
      volumes: [],
      currentWorkId: 'w1',
      unassignedLabel: '支线剧情'
    })

    render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />)
    expect(screen.getByText('支线剧情')).toBeInTheDocument()
    expect(screen.queryByText('未分卷')).toBeNull()
  })
})
