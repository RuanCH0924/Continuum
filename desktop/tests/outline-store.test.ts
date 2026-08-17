import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { WorksStore, type IWorksStore } from '../src/main/services/store'
import { SqliteWorksStore } from '../src/main/services/store-sqlite'
import type { OutlineNode } from '../src/shared/types'

type StoreFactory = () => Promise<IWorksStore>

function newNode(workId: string, parentId: string | null, title: string, order = 0): OutlineNode {
  return {
    id: '',
    workId,
    parentId,
    title,
    content: '',
    kind: 'story',
    beat: 'other',
    targetWords: 0,
    order,
    createdAt: 0,
    updatedAt: 0
  }
}

const engines: { name: string; make: (root: string) => StoreFactory }[] = [
  { name: 'file', make: (r) => async () => new WorksStore(r) },
  { name: 'sqlite', make: (r) => async () => SqliteWorksStore.open(r) }
]

describe.each(engines)('大纲/章纲/导图存储（$name 引擎）', ({ make }) => {
  let root: string
  let factory: StoreFactory

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'continuum-outline-'))
    factory = make(root)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('大纲节点 CRUD：新建（id 生成/排序）/更新/按序列表', async () => {
    const s = await factory()
    const w = s.createWork('测试')
    const a = s.saveOutlineNode(w.id, newNode(w.id, null, '总纲-开篇'))
    const b = s.saveOutlineNode(w.id, newNode(w.id, null, '总纲-结局'))
    expect(a.id).toMatch(/^ol_/)
    expect(a.order).toBe(0)
    expect(b.order).toBe(1)
    expect(s.listOutlineNodes(w.id).map((n) => n.title)).toEqual(['总纲-开篇', '总纲-结局'])

    const updated = s.saveOutlineNode(w.id, { ...a, title: '开篇-改', beat: 'climax', targetWords: 50000, chapterSeqs: [1, 2] })
    expect(updated.title).toBe('开篇-改')
    expect(updated.beat).toBe('climax')
    expect(updated.chapterSeqs).toEqual([1, 2])
    expect(s.listOutlineNodes(w.id)).toHaveLength(2)
  })

  it('大纲节点删除级联子节点', async () => {
    const s = await factory()
    const w = s.createWork('测试')
    const parent = s.saveOutlineNode(w.id, newNode(w.id, null, '卷'))
    const child = s.saveOutlineNode(w.id, newNode(w.id, parent.id, '子节点'))
    const grand = s.saveOutlineNode(w.id, newNode(w.id, child.id, '孙节点'))
    const other = s.saveOutlineNode(w.id, newNode(w.id, null, '其他'))

    expect(s.deleteOutlineNode(w.id, parent.id)).toBe(true)
    const remain = s.listOutlineNodes(w.id)
    expect(remain.map((n) => n.id)).toEqual([other.id])
    expect(remain).toHaveLength(1)
    expect(s.deleteOutlineNode(w.id, 'not-exist')).toBe(false)
    expect(s.listOutlineNodes(w.id).some((n) => n.id === grand.id)).toBe(false)
  })

  it('重排大纲节点（同级 order 归一化）', async () => {
    const s = await factory()
    const w = s.createWork('测试')
    const a = s.saveOutlineNode(w.id, newNode(w.id, null, 'A'))
    const b = s.saveOutlineNode(w.id, newNode(w.id, null, 'B'))
    const c = s.saveOutlineNode(w.id, newNode(w.id, null, 'C'))
    expect(s.reorderOutlineNodes(w.id, null, [c.id, a.id, b.id])).toBe(true)
    expect(s.listOutlineNodes(w.id).map((n) => n.title)).toEqual(['C', 'A', 'B'])
    expect(s.reorderOutlineNodes(w.id, null, [a.id])).toBe(false)
  })

  it('章纲 CRUD：按 chapterSeq upsert / 列表有序 / 删除', async () => {
    const s = await factory()
    const w = s.createWork('测试')
    s.createChapter(w.id, '第一章')
    s.createChapter(w.id, '第二章')
    const c1 = s.saveChapterOutline(w.id, {
      id: '', workId: w.id, chapterSeq: 1,
      corePlot: '入剑冢', characterScenes: '初遇苏雪', conflict: '残剑认主', hook: '',
      content: '', extracted: false, status: 'unwritten', updatedAt: 0
    })
    expect(c1.id).toMatch(/^co_/)
    // 同章覆盖不新增
    s.saveChapterOutline(w.id, { ...c1, corePlot: '入剑冢拔剑', extracted: true, status: 'writing' })
    const list = s.listChapterOutlines(w.id)
    expect(list).toHaveLength(1)
    expect(list[0].corePlot).toBe('入剑冢拔剑')
    expect(list[0].extracted).toBe(true)
    expect(list[0].status).toBe('writing')

    expect(s.deleteChapterOutline(w.id, 1)).toBe(true)
    expect(s.listChapterOutlines(w.id)).toHaveLength(0)
  })

  it('思维导图 save/get/覆盖', async () => {
    const s = await factory()
    const w = s.createWork('测试')
    expect(s.getMindMap(w.id)).toBeNull()
    const map = {
      workId: w.id,
      root: { id: 'r', text: '主线', children: [{ id: 'c', text: '开篇', children: [] }] },
      updatedAt: 0
    }
    s.saveMindMap(w.id, map)
    const got = s.getMindMap(w.id)
    expect(got?.root.children[0].text).toBe('开篇')
    s.saveMindMap(w.id, { ...map, root: { id: 'r', text: '新主线', children: [] } })
    expect(s.getMindMap(w.id)?.root.text).toBe('新主线')
  })

  it('删除章节级联清理章纲；删除作品清理全部', async () => {
    const s = await factory()
    const w = s.createWork('测试')
    const c = s.createChapter(w.id, '第一章')
    s.saveChapterOutline(w.id, {
      id: '', workId: w.id, chapterSeq: c.seq,
      corePlot: 'x', characterScenes: '', conflict: '', hook: '',
      content: '', extracted: false, status: 'unwritten', updatedAt: 0
    })
    s.saveOutlineNode(w.id, newNode(w.id, null, '节点'))
    s.saveMindMap(w.id, { workId: w.id, root: { id: 'r', text: 'root', children: [] }, updatedAt: 0 })

    expect(s.deleteChapter(w.id, c.seq)).toBe(true)
    expect(s.listChapterOutlines(w.id)).toHaveLength(0)
    // 大纲节点与导图保留（用户手动处理）
    expect(s.listOutlineNodes(w.id)).toHaveLength(1)

    expect(s.deleteWork(w.id)).toBe(true)
    expect(s.listOutlineNodes(w.id)).toHaveLength(0)
    expect(s.listChapterOutlines(w.id)).toHaveLength(0)
    expect(s.getMindMap(w.id)).toBeNull()
  })
})

describe('大纲存储落盘重开持久化', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'continuum-outline-persist-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('文件引擎：重开 WorksStore 后数据仍在', () => {
    const w = new WorksStore(root)
    const work = w.createWork('持久化')
    w.saveOutlineNode(work.id, newNode(work.id, null, '总纲'))
    w.saveChapterOutline(work.id, {
      id: '', workId: work.id, chapterSeq: 1,
      corePlot: 'p', characterScenes: '', conflict: '', hook: '',
      content: '', extracted: true, status: 'written', updatedAt: 0
    })
    w.saveMindMap(work.id, { workId: work.id, root: { id: 'r', text: 'root', children: [] }, updatedAt: 0 })

    const w2 = new WorksStore(root)
    expect(w2.listOutlineNodes(work.id)).toHaveLength(1)
    expect(w2.listChapterOutlines(work.id)[0].extracted).toBe(true)
    expect(w2.getMindMap(work.id)?.root.text).toBe('root')
  })

  it('SQLite 引擎：重开数据库后数据仍在', async () => {
    const store = await SqliteWorksStore.open(root)
    const work = store.createWork('持久化')
    store.saveOutlineNode(work.id, newNode(work.id, null, '总纲'))
    const reopened = await SqliteWorksStore.open(root)
    expect(reopened.listOutlineNodes(work.id)).toHaveLength(1)
  })
})
