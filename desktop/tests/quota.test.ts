import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { WorksStore } from '../src/main/services/store'
import { AiQuotaService } from '../src/main/services/quota'
import { parseChapterOutlineJson } from '../src/main/services/extract'

describe('AI 配额账本', () => {
  let root: string
  let store: WorksStore
  let quota: AiQuotaService

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'continuum-quota-'))
    store = new WorksStore(root)
    quota = new AiQuotaService(store)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('初始账本：今日、used=0、预算 100', () => {
    const q = quota.get()
    expect(q.date).toBe(new Date().toISOString().slice(0, 10))
    expect(q.used).toBe(0)
    expect(q.budget).toBe(100)
    expect(quota.remaining()).toBe(100)
  })

  it('记录消耗并钳制到预算上限', () => {
    quota.record(3)
    expect(quota.get().used).toBe(3)
    expect(quota.remaining()).toBe(97)
    // 超额记录钳制到预算
    quota.record(999)
    expect(quota.get().used).toBe(100)
    expect(quota.remaining()).toBe(0)
  })

  it('canOccupy 边界：0 / 等于剩余 / 超出', () => {
    quota.record(40)
    expect(quota.canOccupy(60)).toBe(true)
    expect(quota.canOccupy(61)).toBe(false)
    expect(quota.canOccupy(0)).toBe(true)
  })

  it('跨天懒重置：旧日期账本自动清零', () => {
    store.setSetting('aiQuota', { date: '2000-01-01', used: 88, budget: 100 })
    const q = quota.get()
    expect(q.date).toBe(new Date().toISOString().slice(0, 10))
    expect(q.used).toBe(0)
  })
})

describe('章纲提取 JSON 解析', () => {
  it('解析纯 JSON 输出', () => {
    const r = parseChapterOutlineJson(
      '{"corePlot":"入剑冢拔剑","characterScenes":"初遇苏雪","conflict":"残剑认主","hook":"剑身浮现文字"}'
    )
    expect(r?.corePlot).toBe('入剑冢拔剑')
    expect(r?.hook).toBe('剑身浮现文字')
  })

  it('容忍 Markdown 代码块包裹与前缀文本', () => {
    const r = parseChapterOutlineJson(
      '好的，以下是提取结果：\n```json\n{"corePlot":"a","characterScenes":"b","conflict":"c","hook":"d"}\n```'
    )
    expect(r?.corePlot).toBe('a')
  })

  it('字段缺失返回空串而非失败', () => {
    const r = parseChapterOutlineJson('{"corePlot":"a"}')
    expect(r?.characterScenes).toBe('')
  })

  it('非 JSON 输出返回 null', () => {
    expect(parseChapterOutlineJson('抱歉，我无法提取')).toBeNull()
    expect(parseChapterOutlineJson('')).toBeNull()
  })
})
