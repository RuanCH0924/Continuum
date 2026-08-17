import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { WorksStore } from '../src/main/services/store'
import { charCountOf, computeWordTotals } from '../src/main/services/stats'
import type { Note } from '../src/shared/types'

describe('字数统计服务（computeWordTotals：正文 + 备注内容，无重复/漏算）', () => {
  let root: string
  let store: WorksStore

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'continuum-stats-test-'))
    store = new WorksStore(root)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const note = (content: string, extra: Partial<Note> = {}): Note => ({
    id: '',
    kind: 'character',
    title: '备注',
    tag: '',
    content,
    updatedAt: 0,
    ...extra
  })

  it('charCountOf 去除全部空白后计字符数（含标点与 Markdown 标记）', () => {
    expect(charCountOf('第一章 正文内容')).toBe(7)
    expect(charCountOf('# 标题\n\n正文\n')).toBe(5)
    expect(charCountOf('')).toBe(0)
  })

  it('作品总字数 = 全部章节正文 + 全部备注内容', () => {
    const w = store.createWork('测试')
    store.saveChapter(w.id, 1, '第一章', '第一章正文内容')
    store.saveChapter(w.id, 2, '第二章', '第二章正文')
    store.saveNote(w.id, note('备注内容一'))
    store.saveNote(w.id, note('角色卡内容'))

    const totals = computeWordTotals(store, w.id)
    // 7 + 5 + 5 + 5
    expect(totals.workChars).toBe(22)
    expect(totals.totalChars).toBe(22)
  })

  it('归档知识实体计入累计（不遗漏）', () => {
    const w = store.createWork('测试')
    store.saveChapter(w.id, 1, '第一章', '正文内容')
    store.saveNote(w.id, note('活跃备注', { archived: false }))
    store.saveNote(w.id, note('归档备注', { archived: true, archivedAt: Date.now() }))

    const totals = computeWordTotals(store, w.id)
    // 4 + 4 + 4
    expect(totals.workChars).toBe(12)
  })

  it('多个作品：workChars 仅统计指定作品，totalChars 累计全库', () => {
    const a = store.createWork('作品A')
    const b = store.createWork('作品B')
    store.saveChapter(a.id, 1, '第一章', '甲正文') // 3
    store.saveNote(a.id, note('甲备注')) // 3
    store.saveChapter(b.id, 1, '第一章', '乙正文长内容') // 6

    const totals = computeWordTotals(store, a.id)
    expect(totals.workChars).toBe(6)
    expect(totals.totalChars).toBe(12)
  })

  it('未指定作品或作品不存在时 workChars 为 0，totalChars 正常累计', () => {
    store.createWork('作品')
    const totals = computeWordTotals(store, 'not-exist')
    expect(totals.workChars).toBe(0)
    expect(totals.totalChars).toBe(0)
  })
})
