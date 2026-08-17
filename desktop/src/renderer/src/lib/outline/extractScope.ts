/**
 * 智能章纲提取范围解析（PRD v1.0 §9.2，纯函数便于单测）。
 */

import type { ChapterMeta } from '@shared/types'

export type ExtractScope = 'current' | 'recent20' | 'custom'

/** 单批提取上限（对齐需求：单批次上限 50 章）。 */
export const MAX_BATCH = 50

export interface ExtractSeqsResult {
  seqs: number[]
  error: string | null
}

/**
 * 解析提取范围 → 章节序号列表（有序、去重、≤50）。
 * @param currentSeq 当前打开章节（current/recent20 的锚点；空则取最后一章）
 * @param custom 自定义勾选章节（custom 范围）
 */
export function resolveExtractSeqs(
  chapters: ChapterMeta[],
  currentSeq: number | null,
  scope: ExtractScope,
  custom: number[]
): ExtractSeqsResult {
  if (chapters.length === 0) return { seqs: [], error: '当前作品还没有章节，请先创建章节' }
  const anchor = currentSeq ?? chapters[chapters.length - 1].seq
  let seqs: number[]
  if (scope === 'current') {
    seqs = [anchor]
  } else if (scope === 'recent20') {
    const idx = chapters.findIndex((c) => c.seq === anchor)
    const from = Math.max(0, idx - 19)
    seqs = chapters.slice(from, idx + 1).map((c) => c.seq)
  } else {
    const valid = new Set(chapters.map((c) => c.seq))
    seqs = custom.filter((s) => valid.has(s))
  }
  const unique = Array.from(new Set(seqs)).sort((a, b) => a - b)
  if (unique.length === 0) return { seqs: [], error: '未选择有效章节' }
  if (unique.length > MAX_BATCH) {
    return { seqs: [], error: `单批最多提取 ${MAX_BATCH} 章，请分批进行` }
  }
  return { seqs: unique, error: null }
}

/** 章纲是否已填写（任一结构化字段非空即视为已填写）。 */
export function outlineFilled(co: { corePlot: string; characterScenes: string; conflict: string; hook: string }): boolean {
  return [co.corePlot, co.characterScenes, co.conflict, co.hook].some((s) => (s ?? '').trim().length > 0)
}
