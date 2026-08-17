import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { WorksStore } from '../src/main/services/store'

describe('WorksStore（作品/章节/设置 CRUD）', () => {
  let root: string
  let store: WorksStore

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'continuum-test-'))
    store = new WorksStore(root)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('创建并列出作品', () => {
    const w = store.createWork('雪山隐狐')
    const works = store.listWorks()
    expect(works).toHaveLength(1)
    expect(works[0].title).toBe('雪山隐狐')
    expect(w.id).toMatch(/^work_/)
  })

  it('作品按更新时间倒序排列', () => {
    store.createWork('A')
    const b = store.createWork('B')
    expect(store.listWorks()[0].title).toBe('B')
    store.renameWork(b.id, 'B2')
    expect(store.getWork(b.id)?.title).toBe('B2')
  })

  it('章节创建 / 保存 / 读取 / 删除', () => {
    const w = store.createWork('测试')
    const c1 = store.createChapter(w.id, '第一章')
    const c2 = store.createChapter(w.id, '第二章')
    expect(c1.seq).toBe(1)
    expect(c2.seq).toBe(2)

    store.saveChapter(w.id, c1.seq, '第一章', '# 第一章\n\n内容一')
    const meta = store.getChapter(w.id, 1)
    expect(meta).not.toBeNull()
    expect(store.readChapter(meta!)).toBe('# 第一章\n\n内容一')

    expect(store.deleteChapter(w.id, 2)).toBe(true)
    expect(store.listChapters(w.id)).toHaveLength(1)
  })

  it('删除作品级联删除章节文件', () => {
    const w = store.createWork('待删')
    store.createChapter(w.id, '唯一章节')
    expect(store.deleteWork(w.id)).toBe(true)
    expect(store.listWorks()).toHaveLength(0)
    expect(store.listChapters(w.id)).toHaveLength(0)
  })

  it('重命名章节保留正文', () => {
    const w = store.createWork('测试')
    const c = store.createChapter(w.id, '旧标题')
    store.saveChapter(w.id, c.seq, '旧标题', '# 旧标题\n\n正文保持')
    const renamed = store.renameChapter(w.id, c.seq, '新标题')
    expect(renamed?.title).toBe('新标题')
    expect(store.getChapter(w.id, c.seq)?.title).toBe('新标题')
    expect(store.readChapter(renamed!)).toContain('正文保持')
  })

  it('创作知识 notes CRUD（角色/设定/伏笔/素材）', () => {
    const w = store.createWork('测试')
    const c1 = store.saveNote(w.id, { id: '', kind: 'character', title: '顾青舟', tag: '主角', content: '冷峻剑客', updatedAt: 0 })
    expect(c1.id).toMatch(/^note_/)
    store.saveNote(w.id, { id: '', kind: 'world', title: '北境', tag: '地理', content: '常年积雪', updatedAt: 0 })
    store.saveNote(w.id, { id: '', kind: 'clue', title: '旧车票', tag: '已埋设', content: '第二章出现', chapterSeq: 2, updatedAt: 0 })
    expect(store.listNotes(w.id, 'character')).toHaveLength(1)
    expect(store.listNotes(w.id, 'clue')[0].chapterSeq).toBe(2)
    expect(store.listNotes(w.id)).toHaveLength(3)

    // 编辑（同 id 不新增）
    store.saveNote(w.id, { ...c1, content: '冷峻剑客 · 左肩有旧伤' })
    expect(store.listNotes(w.id)).toHaveLength(3)
    expect(store.listNotes(w.id, 'character')[0].content).toContain('旧伤')

    // 删除
    expect(store.deleteNote(w.id, c1.id)).toBe(true)
    expect(store.listNotes(w.id)).toHaveLength(2)
    expect(store.deleteNote(w.id, '不存在')).toBe(false)
  })

  it('伏笔锚点完整持久化（anchorText / anchorOffset）', () => {
    const w = store.createWork('测试')
    const clue = store.saveNote(w.id, {
      id: '',
      kind: 'clue',
      title: '神秘的手链',
      tag: '已埋设',
      content: '',
      chapterSeq: 3,
      anchorText: '神秘的手链',
      anchorOffset: 42,
      updatedAt: 0
    })
    const back = store.listNotes(w.id, 'clue')[0]
    expect(back.anchorText).toBe('神秘的手链')
    expect(back.anchorOffset).toBe(42)
    expect(back.chapterSeq).toBe(3)
    // 重新实例化（落盘）后仍保留
    const store2 = new WorksStore(root)
    expect(store2.listNotes(w.id, 'clue')[0].anchorText).toBe('神秘的手链')
  })

  it('创作知识归档：归档项移入独立池，不污染活跃列表，可检索回溯', () => {
    const w = store.createWork('测试')
    const clue = store.saveNote(w.id, {
      id: '', kind: 'clue', title: '旧车票', tag: '已回收', content: '回收伏笔',
      chapterSeq: 2, anchorText: '旧车票', anchorOffset: 8, updatedAt: 0
    })
    const mat = store.saveNote(w.id, { id: '', kind: 'material', title: '灵感片段', tag: '描写', content: '风雪夜', updatedAt: 0 })

    // 归档伏笔
    store.saveNote(w.id, { ...clue, archived: true, archivedAt: 123 })
    expect(store.listNotes(w.id)).toHaveLength(1) // 仅活跃素材
    expect(store.listNotes(w.id, 'clue')).toHaveLength(0)
    expect(store.listNotes(w.id, 'clue', { archived: true })).toHaveLength(1)
    const archived = store.listNotes(w.id, undefined, { archived: true })[0]
    expect(archived.archivedAt).toBe(123)
    expect(archived.anchorText).toBe('旧车票')
    expect(archived.anchorOffset).toBe(8)

    // 恢复：回到活跃列表，数据完整
    store.saveNote(w.id, { ...archived, archived: false, archivedAt: undefined })
    expect(store.listNotes(w.id)).toHaveLength(2)
    expect(store.listNotes(w.id, 'clue')[0].archived).toBe(false)
    void mat
  })

  it('批量删除：留存删除操作日志（数据快照），可追溯核验', () => {
    const w = store.createWork('测试')
    const c1 = store.saveNote(w.id, {
      id: '', kind: 'clue', title: '旧车票', tag: '已埋设', content: '第二章出现',
      chapterSeq: 2, anchorText: '旧车票', updatedAt: 0
    })
    const m1 = store.saveNote(w.id, { id: '', kind: 'material', title: '灵感', tag: '', content: '素材内容', updatedAt: 0 })

    const res = store.deleteNotes(w.id, [c1.id, m1.id, '不存在'])
    expect(res.deleted.sort()).toEqual([c1.id, m1.id].sort())
    expect(res.missing).toEqual(['不存在'])
    expect(res.log).toHaveLength(2)
    const clueLog = res.log.find((l) => l.kind === 'clue')
    expect(clueLog?.title).toBe('旧车票')
    expect(clueLog?.anchorText).toBe('旧车票')
    expect(clueLog?.chapterSeq).toBe(2)
    expect(clueLog?.deletedAt).toBeGreaterThan(0)
    expect(store.listNotes(w.id)).toHaveLength(0)

    // 日志可检索（按时间倒序）
    const logs = store.listNoteDeleteLogs(w.id)
    expect(logs).toHaveLength(2)
    expect(logs.every((l) => l.deletedAt > 0)).toBe(true)
    // 删除归档条目同样留存日志
    const c2 = store.saveNote(w.id, { id: '', kind: 'clue', title: '归档伏笔', tag: '', content: '', archived: true, archivedAt: 5, updatedAt: 0 })
    const res2 = store.deleteNotes(w.id, [c2.id])
    expect(res2.deleted).toEqual([c2.id])
    expect(store.listNoteDeleteLogs(w.id)).toHaveLength(3)
  })

  it('历史版本快照：保存 / 列表 / 读取 / 上限 50', () => {
    const w = store.createWork('测试')
    const c = store.createChapter(w.id, '第一章')
    store.saveVersion(w.id, c.seq, '# 第一章\n\nv1 内容')
    store.saveVersion(w.id, c.seq, '# 第一章\n\nv2 内容', '第二稿')
    const list = store.listVersions(w.id, c.seq)
    expect(list).toHaveLength(2)
    expect(list[0].note).toBe('第二稿')
    expect(store.readVersion(list[1])).toContain('v1 内容')

    for (let i = 0; i < 55; i++) store.saveVersion(w.id, c.seq, `内容${i}`)
    expect(store.listVersions(w.id, c.seq)).toHaveLength(50)
  })

  it('设置读写与持久化', () => {
    store.setSetting('theme', 'dark')
    expect(store.getSetting('theme')).toBe('dark')
    expect(store.getSetting('不存在', 'fallback')).toBe('fallback')
    // 重新实例化后仍可读（落盘）
    const store2 = new WorksStore(root)
    expect(store2.getSetting('theme')).toBe('dark')
  })

  it('卷 CRUD：新增 / 编辑 / 删除 / 排序', () => {
    const w = store.createWork('测试')
    const v1 = store.createVolume(w.id, '第一卷')
    const v2 = store.createVolume(w.id, '第二卷')
    const v3 = store.createVolume(w.id, '第三卷')
    expect(store.listVolumes(w.id).map((v) => v.title)).toEqual(['第一卷', '第二卷', '第三卷'])
    expect(v1.order).toBe(0)
    expect(v3.order).toBe(2)

    // 重命名
    expect(store.renameVolume(w.id, v2.id, '第二卷·修订')).toBe(true)
    expect(store.getVolume(w.id, v2.id)?.title).toBe('第二卷·修订')
    // 重命名不存在的卷
    expect(store.renameVolume(w.id, 'missing', 'x')).toBe(false)

    // 排序：第二卷提到最前
    expect(store.reorderVolumes(w.id, [v2.id, v1.id, v3.id])).toBe(true)
    expect(store.listVolumes(w.id).map((v) => v.id)).toEqual([v2.id, v1.id, v3.id])
    // 排序 id 数量不符 / 含不存在 id 时拒绝
    expect(store.reorderVolumes(w.id, [v1.id])).toBe(false)
    expect(store.reorderVolumes(w.id, [v1.id, 'bad', v3.id])).toBe(false)

    // 删除
    expect(store.deleteVolume(w.id, v3.id)).toBe(true)
    expect(store.listVolumes(w.id)).toHaveLength(2)
    expect(store.deleteVolume(w.id, 'missing')).toBe(false)
  })

  it('卷与章节关联：单归属约束 / 级联清理 / 删除卷保留章节', () => {
    const w = store.createWork('测试')
    const c1 = store.createChapter(w.id, '第一章')
    const c2 = store.createChapter(w.id, '第二章')
    const c3 = store.createChapter(w.id, '第三章')
    const v1 = store.createVolume(w.id, '第一卷')
    const v2 = store.createVolume(w.id, '第二卷')

    // 第一卷关联 1、2 章
    store.setVolumeChapters(w.id, v1.id, [c1.seq, c2.seq])
    expect(store.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([1, 2])

    // 第二章移入第二卷 → 自动从第一卷移除（单归属）
    store.setVolumeChapters(w.id, v2.id, [c2.seq])
    expect(store.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([1])
    expect(store.getVolume(w.id, v2.id)?.chapterSeqs).toEqual([2])

    // 关联去重 + 过滤不存在的章节
    store.setVolumeChapters(w.id, v1.id, [c1.seq, c1.seq, c3.seq, 999])
    expect(store.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([1, 3])

    // 删除章节 → 卷关联级联清理
    store.deleteChapter(w.id, c3.seq)
    expect(store.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([1])

    // 删除卷 → 章节保留（未分卷）
    expect(store.listChapters(w.id)).toHaveLength(2)
    store.deleteVolume(w.id, v2.id)
    expect(store.getVolume(w.id, v2.id)).toBeNull()
    expect(store.listChapters(w.id)).toHaveLength(2)

    // 卷不存在的关联操作返回 false
    expect(store.setVolumeChapters(w.id, 'missing', [1])).toBe(false)
  })

  it('卷数据持久化：重新实例化后仍可读', () => {
    const w = store.createWork('测试')
    const c = store.createChapter(w.id, '第一章')
    const v = store.createVolume(w.id, '第一卷')
    store.setVolumeChapters(w.id, v.id, [c.seq])
    const store2 = new WorksStore(root)
    expect(store2.listVolumes(w.id)).toHaveLength(1)
    expect(store2.getVolume(w.id, v.id)?.chapterSeqs).toEqual([1])
  })

  it('时间线 CRUD / 排序 / 持久化', () => {
    const w = store.createWork('测试')
    const e1 = store.saveTimelineEntry(w.id, { id: '', workId: w.id, time: '第三年·春', summary: '顾青舟下山', order: 0, createdAt: 0, updatedAt: 0 })
    const e2 = store.saveTimelineEntry(w.id, { id: '', workId: w.id, time: '第三年·夏', summary: '北境初遇', order: 0, createdAt: 0, updatedAt: 0 })
    const e3 = store.saveTimelineEntry(w.id, { id: '', workId: w.id, time: '第三年·秋', summary: '旧车票之谜', order: 0, createdAt: 0, updatedAt: 0 })
    expect(e1.id).toMatch(/^tl_/)
    expect(store.listTimeline(w.id)).toHaveLength(3)
    // 新建自动追加到末尾（order 递增，按时间顺序）
    expect(store.listTimeline(w.id).map((e) => e.time)).toEqual(['第三年·春', '第三年·夏', '第三年·秋'])

    // 编辑（upsert 同 id 不新增）
    store.saveTimelineEntry(w.id, { ...e2, summary: '北境初遇 · 埋下伏笔' })
    expect(store.listTimeline(w.id)).toHaveLength(3)
    expect(store.listTimeline(w.id).find((e) => e.id === e2.id)?.summary).toContain('伏笔')

    // 排序：秋提到最前
    expect(store.reorderTimeline(w.id, [e3.id, e1.id, e2.id])).toBe(true)
    expect(store.listTimeline(w.id).map((e) => e.id)).toEqual([e3.id, e1.id, e2.id])
    // 排序 id 数量不符 / 含不存在 id 时拒绝
    expect(store.reorderTimeline(w.id, [e1.id])).toBe(false)
    expect(store.reorderTimeline(w.id, [e1.id, 'bad', e3.id])).toBe(false)

    // 删除
    expect(store.deleteTimelineEntry(w.id, e3.id)).toBe(true)
    expect(store.listTimeline(w.id)).toHaveLength(2)
    expect(store.deleteTimelineEntry(w.id, 'missing')).toBe(false)

    // 持久化：重新实例化后仍可读
    const store2 = new WorksStore(root)
    expect(store2.listTimeline(w.id)).toHaveLength(2)
  })
})
