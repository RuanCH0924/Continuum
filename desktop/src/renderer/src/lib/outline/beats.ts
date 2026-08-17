/**
 * 大纲节点节奏标签（PRD v1.0 §6.3）：标签文案 + 徽标色（Design Tokens 语义色）。
 */

import type { OutlineBeat } from '@shared/types'

export const BEAT_LABELS: Record<OutlineBeat, string> = {
  opening: '开篇',
  rising: '发展',
  climax: '高潮',
  twist: '转折',
  lull: '低谷',
  clue: '伏笔',
  ending: '结局',
  other: '其他'
}

export const BEAT_CLS: Record<OutlineBeat, string> = {
  opening: 'bg-brand-50 text-brand-500',
  rising: 'bg-neutral-100 text-neutral-600',
  climax: 'bg-status-warning/15 text-status-warning',
  twist: 'bg-status-danger/10 text-status-danger',
  lull: 'bg-neutral-100 text-neutral-400',
  clue: 'bg-brand-50 text-brand-500',
  ending: 'bg-status-success/10 text-status-success',
  other: 'bg-neutral-100 text-neutral-400'
}

/** 非 other 标签视为「关键节点」：粒度切换「仅核心节点」时仅展示这些节点。 */
export function isKeyNode(beat: OutlineBeat): boolean {
  return beat !== 'other'
}
