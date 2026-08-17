import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteWorksStore } from '../src/main/services/store-sqlite'

describe('SqliteWorksStore（SQLite 存储实现，sql.js）', () => {
  let root: string
  let store: SqliteWorksStore

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'continuum-sqlite-'))
    store = await SqliteWorksStore.open(root)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('作品创建 / 列出 / 重命名 / 删除', () => {
    const w = store.createWork('雪山隐狐', '一只狐的故事')
    expect(store.listWorks()[0].title).toBe('雪山隐狐')
    expect(store.getWork(w.id)?.description).toBe('一只狐的故事')
    expect(store.renameWork(w.id, '新名')).toBe(true)
    expect(store.deleteWork(w.id)).toBe(true)
    expect(store.listWorks()).toHaveLength(0)
  })

  it('章节 CRUD，正文落盘为 Markdown 文件', () => {
    const w = store.createWork('测试')
    const c1 = store.createChapter(w.id, '第一章')
    const c2 = store.createChapter(w.id, '第二章')
    expect(c1.seq).toBe(1)
    expect(c2.seq).toBe(2)
    store.saveChapter(w.id, 1, '第一章', '# 第一章\n\n正文内容')
    const meta = store.getChapter(w.id, 1)
    expect(meta).not.toBeNull()
    expect(store.readChapter(meta!)).toContain('正文内容')
    expect(existsSync(join(store.worksDirOf(w.id), 'chapters', meta!.file))).toBe(true)
    expect(store.deleteChapter(w.id, 2)).toBe(true)
    expect(store.listChapters(w.id)).toHaveLength(1)
  })

  it('创作知识 notes CRUD（角色 / 设定 / 伏笔 / 素材）', () => {
    const w = store.createWork('测试')
    const n = store.saveNote(w.id, { id: '', kind: 'character', title: '顾青舟', tag: '主角', content: '冷峻', updatedAt: 0 })
    expect(n.id).toMatch(/^note_/)
    store.saveNote(w.id, { id: '', kind: 'world', title: '北境', tag: '地理', content: '积雪', updatedAt: 0 })
    expect(store.listNotes(w.id, 'character')).toHaveLength(1)
    expect(store.listNotes(w.id)).toHaveLength(2)
    // 编辑（同 id 不新增）
    store.saveNote(w.id, { ...n, content: '更新内容' })
    expect(store.listNotes(w.id)).toHaveLength(2)
    expect(store.deleteNote(w.id, n.id)).toBe(true)
    expect(store.listNotes(w.id)).toHaveLength(1)
  })

  it('伏笔锚点持久化：SQLite 表含 anchor_text / anchor_offset 列，落盘重开保留', async () => {
    const w = store.createWork('测试')
    store.saveNote(w.id, {
      id: '', kind: 'clue', title: '神秘的手链', tag: '已埋设', content: '',
      chapterSeq: 3, anchorText: '神秘的手链', anchorOffset: 42, updatedAt: 0
    })
    const back = store.listNotes(w.id, 'clue')[0]
    expect(back.anchorText).toBe('神秘的手链')
    expect(back.anchorOffset).toBe(42)
    // 重新打开（落盘）后锚点仍保留 —— 修复 SQLite 模式锚点丢失问题
    const reopened = await SqliteWorksStore.open(root)
    const back2 = reopened.listNotes(w.id, 'clue')[0]
    expect(back2.anchorText).toBe('神秘的手链')
    expect(back2.anchorOffset).toBe(42)
  })

  it('创作知识归档：归档池与活跃列表隔离，可检索回溯', () => {
    const w = store.createWork('测试')
    const clue = store.saveNote(w.id, {
      id: '', kind: 'clue', title: '旧车票', tag: '已回收', content: '回收伏笔',
      chapterSeq: 2, anchorText: '旧车票', anchorOffset: 8, updatedAt: 0
    })
    store.saveNote(w.id, { id: '', kind: 'material', title: '灵感片段', tag: '描写', content: '风雪夜', updatedAt: 0 })

    store.saveNote(w.id, { ...clue, archived: true, archivedAt: 123 })
    expect(store.listNotes(w.id)).toHaveLength(1)
    expect(store.listNotes(w.id, 'clue', { archived: true })).toHaveLength(1)
    const archived = store.listNotes(w.id, undefined, { archived: true })[0]
    expect(archived.archivedAt).toBe(123)
    expect(archived.anchorText).toBe('旧车票')

    store.saveNote(w.id, { ...archived, archived: false, archivedAt: undefined })
    expect(store.listNotes(w.id)).toHaveLength(2)
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
    expect(store.listNotes(w.id)).toHaveLength(0)

    const logs = store.listNoteDeleteLogs(w.id)
    expect(logs).toHaveLength(2)
    expect(logs.every((l) => l.deletedAt > 0)).toBe(true)
  })

  it('设置读写与落盘持久化', () => {
    store.setSetting('theme', 'dark')
    expect(store.getSetting('theme')).toBe('dark')
    expect(store.getSetting('缺失', 'fb')).toBe('fb')
  })

  it('历史版本快照保存 / 列表 / 读取', () => {
    const w = store.createWork('测试')
    const c = store.createChapter(w.id, '第一章')
    store.saveVersion(w.id, c.seq, 'v1 内容')
    store.saveVersion(w.id, c.seq, 'v2 内容', '第二稿')
    const list = store.listVersions(w.id, c.seq)
    expect(list).toHaveLength(2)
    expect(list[0].note).toBe('第二稿')
    expect(store.readVersion(list[1])).toContain('v1 内容')
  })

  it('落盘后重新打开数据完整保留', async () => {
    const w = store.createWork('持久作品')
    store.setSetting('dailyGoal', 2500)
    store.saveNote(w.id, { id: '', kind: 'material', title: '灵感', tag: '', content: '一段素材', updatedAt: 0 })
    const reopened = await SqliteWorksStore.open(root)
    expect(reopened.listWorks()[0].title).toBe('持久作品')
    expect(reopened.getSetting('dailyGoal')).toBe(2500)
    expect(reopened.listNotes(w.id)).toHaveLength(1)
    // 数据库文件存在
    expect(existsSync(join(root, 'continuum.db'))).toBe(true)
  })

  it('卷 CRUD / 排序 / 章节关联（单归属）/ 持久化', async () => {
    const w = store.createWork('测试')
    const c1 = store.createChapter(w.id, '第一章')
    const c2 = store.createChapter(w.id, '第二章')
    const c3 = store.createChapter(w.id, '第三章')
    const v1 = store.createVolume(w.id, '第一卷')
    const v2 = store.createVolume(w.id, '第二卷')
    const v3 = store.createVolume(w.id, '第三卷')
    expect(store.listVolumes(w.id).map((v) => v.title)).toEqual(['第一卷', '第二卷', '第三卷'])

    // 重命名 / 删除
    expect(store.renameVolume(w.id, v2.id, '第二卷·改')).toBe(true)
    expect(store.getVolume(w.id, v2.id)?.title).toBe('第二卷·改')
    expect(store.deleteVolume(w.id, v3.id)).toBe(true)
    expect(store.listVolumes(w.id)).toHaveLength(2)

    // 排序
    expect(store.reorderVolumes(w.id, [v2.id, v1.id])).toBe(true)
    expect(store.listVolumes(w.id).map((v) => v.id)).toEqual([v2.id, v1.id])
    expect(store.reorderVolumes(w.id, [v1.id])).toBe(false)

    // 关联 + 单归属
    store.setVolumeChapters(w.id, v1.id, [c1.seq, c2.seq])
    expect(store.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([1, 2])
    store.setVolumeChapters(w.id, v2.id, [c2.seq])
    expect(store.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([1])
    expect(store.getVolume(w.id, v2.id)?.chapterSeqs).toEqual([2])

    // 级联清理：删除章节后卷关联移除
    store.deleteChapter(w.id, c1.seq)
    expect(store.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([])

    // 删除卷保留章节
    expect(store.listChapters(w.id)).toHaveLength(2)
    store.deleteVolume(w.id, v2.id)
    expect(store.listChapters(w.id)).toHaveLength(2)

    // 关联不存在的卷返回 false
    expect(store.setVolumeChapters(w.id, 'missing', [2])).toBe(false)

    // 持久化：重新打开后卷数据保留
    store.setVolumeChapters(w.id, v1.id, [c3.seq])
    const reopened = await SqliteWorksStore.open(root)
    expect(reopened.listVolumes(w.id)).toHaveLength(1)
    expect(reopened.getVolume(w.id, v1.id)?.chapterSeqs).toEqual([c3.seq])
  })

  it('时间线 CRUD / 排序 / 持久化', async () => {
    const w = store.createWork('测试')
    const e1 = store.saveTimelineEntry(w.id, { id: '', workId: w.id, time: '第三年·春', summary: '顾青舟下山', order: 0, createdAt: 0, updatedAt: 0 })
    const e2 = store.saveTimelineEntry(w.id, { id: '', workId: w.id, time: '第三年·夏', summary: '北境初遇', order: 0, createdAt: 0, updatedAt: 0 })
    expect(store.listTimeline(w.id).map((e) => e.time)).toEqual(['第三年·春', '第三年·夏'])

    // 编辑（upsert 同 id）
    store.saveTimelineEntry(w.id, { ...e1, summary: '顾青舟下山 · 遇见老者' })
    expect(store.listTimeline(w.id)).toHaveLength(2)
    expect(store.listTimeline(w.id).find((e) => e.id === e1.id)?.summary).toContain('老者')

    // 排序
    expect(store.reorderTimeline(w.id, [e2.id, e1.id])).toBe(true)
    expect(store.listTimeline(w.id).map((e) => e.id)).toEqual([e2.id, e1.id])
    expect(store.reorderTimeline(w.id, [e1.id])).toBe(false)

    // 删除
    expect(store.deleteTimelineEntry(w.id, e2.id)).toBe(true)
    expect(store.listTimeline(w.id)).toHaveLength(1)
    expect(store.deleteTimelineEntry(w.id, 'missing')).toBe(false)

    // 删除作品级联清理
    const w2 = store.createWork('待删')
    store.saveTimelineEntry(w2.id, { id: '', workId: w2.id, time: '第一幕', summary: 'x', order: 0, createdAt: 0, updatedAt: 0 })
    store.deleteWork(w2.id)
    expect(store.listTimeline(w2.id)).toHaveLength(0)

    // 持久化：重新打开后保留
    const reopened = await SqliteWorksStore.open(root)
    expect(reopened.listTimeline(w.id)).toHaveLength(1)
    expect(reopened.listTimeline(w.id)[0].time).toBe('第三年·春')
  })
})
