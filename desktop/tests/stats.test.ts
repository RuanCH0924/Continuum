import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../src/renderer/src/stores/appStore'

function stubApi(): {
  save: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  totals: ReturnType<typeof vi.fn>
} {
  const save = vi.fn(async () => ({}))
  const set = vi.fn(async () => true)
  const totals = vi.fn(async () => ({ workChars: 100, totalChars: 500 }))
  vi.stubGlobal('window', {
    api: {
      works: { list: vi.fn(async () => []) },
      chapters: { save, read: vi.fn(async () => ''), list: vi.fn(async () => []) },
      settings: { get: vi.fn(async () => null), set },
      stats: { totals }
    }
  })
  return { save, set, totals }
}

const today = () => new Date().toISOString().slice(0, 10)

beforeEach(() => {
  useAppStore.setState({
    currentWorkId: 'w1',
    currentChapter: { workId: 'w1', seq: 1, title: '第一章', file: '001_x.md' },
    prevSavedCount: 0,
    charCount: 0,
    todayChars: 0,
    todayDate: '',
    dailyGoal: 2500,
    lastSavedAt: null
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('appStore（写作统计：今日净增字数 / 目标 / 保存时间）', () => {
  it('saveChapter 累计今日净增字数并持久化', async () => {
    const { save, set } = stubApi()
    useAppStore.setState({ prevSavedCount: 100, todayChars: 10, todayDate: today(), dailyGoal: 2500 })
    await useAppStore.getState().saveChapter('x'.repeat(105))
    const s = useAppStore.getState()
    expect(s.todayChars).toBe(15) // 10 + (105-100)
    expect(s.charCount).toBe(105)
    expect(s.lastSavedAt).toBeTypeOf('number')
    expect(save).toHaveBeenCalledWith('w1', 1, '第一章', 'x'.repeat(105))
    expect(set).toHaveBeenCalledWith('stats', { todayChars: 15, todayDate: today(), goalNotified: false })
  })

  it('达到每日目标时推送一次目标达成通知', async () => {
    stubApi()
    useAppStore.setState({ prevSavedCount: 0, todayChars: 5, todayDate: today(), dailyGoal: 10, goalNotifiedToday: false })
    await useAppStore.getState().saveChapter('x'.repeat(10))
    const s = useAppStore.getState()
    expect(s.todayChars).toBe(15) // 5 + 10
    expect(s.goalNotifiedToday).toBe(true)
  })

  it('跨天保存时今日字数重置为增量', async () => {
    stubApi()
    useAppStore.setState({ prevSavedCount: 50, todayChars: 999, todayDate: '2020-01-01' })
    await useAppStore.getState().saveChapter('x'.repeat(60))
    expect(useAppStore.getState().todayChars).toBe(10)
  })

  it('删除内容不产生负增长', async () => {
    stubApi()
    useAppStore.setState({ prevSavedCount: 200, todayChars: 5, todayDate: today() })
    await useAppStore.getState().saveChapter('x'.repeat(100))
    expect(useAppStore.getState().todayChars).toBe(5)
  })

  it('loadStats 恢复今日字数与每日目标', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ todayChars: 321, todayDate: today() })
      .mockResolvedValueOnce(5000)
    vi.stubGlobal('window', { api: { settings: { get } } })
    await useAppStore.getState().loadStats()
    expect(useAppStore.getState().todayChars).toBe(321)
    expect(useAppStore.getState().todayDate).toBe(today())
    expect(useAppStore.getState().dailyGoal).toBe(5000)
  })

  it('updateCharCount 同步实时字数', () => {
    stubApi()
    useAppStore.getState().updateCharCount(88)
    expect(useAppStore.getState().charCount).toBe(88)
  })

  it('refreshWordTotals 拉取当前作品与全库累计字数', async () => {
    const { totals } = stubApi()
    useAppStore.setState({ currentWorkId: 'w1' })
    await useAppStore.getState().refreshWordTotals()
    expect(totals).toHaveBeenCalledWith('w1')
    const s = useAppStore.getState()
    expect(s.workChars).toBe(100)
    expect(s.totalChars).toBe(500)
  })

  it('saveChapter 后作品/全库字数随净增同步', async () => {
    stubApi()
    useAppStore.setState({ prevSavedCount: 100, workChars: 1000, totalChars: 3000 })
    await useAppStore.getState().saveChapter('x'.repeat(105))
    const s = useAppStore.getState()
    expect(s.workChars).toBe(1005) // 1000 + (105-100)
    expect(s.totalChars).toBe(3005)
  })

  it('删除内容不产生负增长（作品字数同样不受影响）', async () => {
    stubApi()
    useAppStore.setState({ prevSavedCount: 200, workChars: 500, totalChars: 900 })
    await useAppStore.getState().saveChapter('x'.repeat(100))
    expect(useAppStore.getState().workChars).toBe(500)
    expect(useAppStore.getState().totalChars).toBe(900)
  })
})
