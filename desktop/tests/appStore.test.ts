// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../src/renderer/src/stores/appStore'

function stubApi(api: unknown): void {
  ;(window as unknown as { api?: unknown }).api = api
}

describe('自动保存竞态修复：saveChapterFor 按捕获章节身份落盘', () => {
  it('防抖窗口内切换章节：旧章节待保存内容写入原章节，且不污染当前章节统计', async () => {
    const save = vi.fn(async () => ({}))
    const settingsSet = vi.fn(async () => true)
    stubApi({ chapters: { save }, settings: { set: settingsSet } })
    useAppStore.setState({
      currentWorkId: 'w1',
      currentChapter: { workId: 'w1', seq: 2, title: '第二章', file: '002_x.md' },
      prevSavedCount: 100,
      todayChars: 0,
      todayDate: '',
      dailyGoal: 0,
      goalNotifiedToday: false
    })

    // 用户已切到第二章，第一章（seq=1）的防抖保存此刻触发 → 必须写回第一章
    await useAppStore.getState().saveChapterFor(1, '第一章', '# 第一章 旧内容')
    expect(save).toHaveBeenCalledWith('w1', 1, '第一章', '# 第一章 旧内容')
    // 目标不是当前章节：不更新今日统计
    expect(settingsSet).not.toHaveBeenCalled()
  })

  it('目标为当前章节时正常持久化并更新统计基线', async () => {
    const save = vi.fn(async () => ({}))
    const settingsSet = vi.fn(async () => true)
    stubApi({ chapters: { save }, settings: { set: settingsSet } })
    useAppStore.setState({
      currentWorkId: 'w1',
      currentChapter: { workId: 'w1', seq: 2, title: '第二章', file: '002_x.md' },
      prevSavedCount: 0,
      todayChars: 0,
      todayDate: '',
      dailyGoal: 0,
      goalNotifiedToday: false
    })

    await useAppStore.getState().saveChapterFor(2, '第二章', '风雪夜归人')
    expect(save).toHaveBeenCalledWith('w1', 2, '第二章', '风雪夜归人')
    expect(settingsSet).toHaveBeenCalledWith('stats', expect.objectContaining({ todayChars: 5 }))
  })
})
