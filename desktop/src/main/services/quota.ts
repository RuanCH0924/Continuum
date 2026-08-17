/**
 * AI 配额账本（PRD v1.0 §9.4）。
 *
 * 每日 100 次，AI 功能全局共享；跨天懒重置；扣减在主进程原子完成。
 * 当前仅「智能章纲提取」实际消耗（每成功 1 章 = 1 次），其余 AI 功能
 * 共用同一账本结构，未来可扩展计费策略。
 */

import type { AiQuota } from '../../shared/types'
import type { IWorksStore } from './store'

const QUOTA_KEY = 'aiQuota'
const DEFAULT_BUDGET = 100

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export class AiQuotaService {
  constructor(private readonly store: IWorksStore) {}

  /** 读取账本（跨天懒重置：date ≠ 今日 → used = 0 并落盘）。 */
  get(): AiQuota {
    const saved = this.store.getSetting(QUOTA_KEY) as Partial<AiQuota> | null | undefined
    const date = today()
    if (!saved || typeof saved !== 'object' || saved.date !== date) {
      const quota: AiQuota = { date, used: 0, budget: DEFAULT_BUDGET }
      this.store.setSetting(QUOTA_KEY, quota)
      return quota
    }
    return {
      date,
      used: typeof saved.used === 'number' ? saved.used : 0,
      budget: typeof saved.budget === 'number' && saved.budget > 0 ? saved.budget : DEFAULT_BUDGET
    }
  }

  /** 今日剩余次数。 */
  remaining(): number {
    const q = this.get()
    return Math.max(0, q.budget - q.used)
  }

  /** 预检：剩余配额是否 ≥ n。 */
  canOccupy(n: number): boolean {
    return this.remaining() >= n
  }

  /** 记录成功消耗 n 次（钳制不超过预算，防止异常越界）。 */
  record(n: number): AiQuota {
    const q = this.get()
    const next: AiQuota = {
      ...q,
      used: Math.min(q.budget, q.used + Math.max(0, n))
    }
    this.store.setSetting(QUOTA_KEY, next)
    return next
  }
}
