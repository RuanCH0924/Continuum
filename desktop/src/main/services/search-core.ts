/**
 * 本地语义检索核心（纯逻辑，无 Electron 依赖，供单测与主进程服务复用）。
 *
 * 检索语料：章节正文（按段分块）+ 全部创作知识实体（角色/设定/伏笔/素材）。
 * 本地算法：中文 n-gram（单字 + 相邻二字）+ BM25 打分。
 */

import type { SearchSourceKind } from '../../shared/types'

export interface SearchDoc {
  id: string
  kind: SearchSourceKind
  title: string
  text: string
  chapterSeq?: number
}

/** 长文本按块切分（保留重叠，保证跨块上下文召回）。 */
export function chunkText(text: string, size = 500, overlap = 50): string[] {
  const trimmed = (text || '').trim()
  if (!trimmed) return []
  if (trimmed.length <= size) return [trimmed]
  const chunks: string[] = []
  let i = 0
  while (i < trimmed.length) {
    chunks.push(trimmed.slice(i, i + size))
    i += size - overlap
  }
  return chunks
}

/** 中文 n-gram + 英文/数字词切分（可重复，用于词频统计）。 */
export function tokenize(text: string): string[] {
  const t = (text || '').toLowerCase()
  const tokens: string[] = []
  const cjk = t.match(/[\u4e00-\u9fff]/g) ?? []
  for (const ch of cjk) tokens.push(ch)
  for (let i = 0; i < cjk.length - 1; i++) tokens.push(cjk[i] + cjk[i + 1])
  const words = t.match(/[a-z0-9]+/g) ?? []
  tokens.push(...words)
  return tokens
}

export interface Bm25Index {
  docs: SearchDoc[]
  docLengths: number[]
  avgLen: number
  df: Map<string, number>
  tf: Map<number, Map<string, number>>
}

export function buildBm25(docs: SearchDoc[]): Bm25Index {
  const docLengths = docs.map((d) => tokenize(d.text).length)
  const df = new Map<string, number>()
  const tf = new Map<number, Map<string, number>>()
  docs.forEach((doc, idx) => {
    const terms = tokenize(doc.text)
    const counts = new Map<string, number>()
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1)
    tf.set(idx, counts)
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  })
  const avgLen = docs.length > 0 ? docLengths.reduce((a, b) => a + b, 0) / docs.length : 0
  return { docs, docLengths, avgLen, df, tf }
}

/** BM25 检索，返回按得分降序的文档下标与原始得分。 */
export function searchBm25(index: Bm25Index, query: string, k1 = 1.5, b = 0.75): { docIdx: number; score: number }[] {
  const { docs, docLengths, avgLen, df, tf } = index
  if (docs.length === 0) return []
  const qTerms = [...new Set(tokenize(query))]
  const n = docs.length
  const scores: number[] = new Array(n).fill(0)
  for (const term of qTerms) {
    const docFreq = df.get(term) ?? 0
    if (docFreq === 0) continue
    const idf = Math.log((n - docFreq + 0.5) / (docFreq + 0.5) + 1)
    for (let i = 0; i < n; i++) {
      const freq = tf.get(i)?.get(term) ?? 0
      if (freq === 0) continue
      const dl = docLengths[i] || 1
      const denom = freq + k1 * (1 - b + (b * dl) / (avgLen || 1))
      scores[i] += idf * ((freq * (k1 + 1)) / denom)
    }
  }
  return scores
    .map((score, docIdx) => ({ docIdx, score }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
}

/** 余弦相似度。 */
export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** 命中片段：取命中文本前段（正文块本身已是窗口）。 */
export function snippetOf(text: string, max = 120): string {
  return (text || '').trim().slice(0, max)
}
