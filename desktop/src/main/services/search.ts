/**
 * 混合语义检索服务（本地 BM25 + 可选远程 Embedding）。
 *
 * 语料：章节正文（分块）+ 全部创作知识实体（角色/设定/伏笔/素材）。
 * 混合策略：BM25 归一化分数与 Embedding 余弦相似度各 50% 加权融合；
 * Embedding 未配置或失败时自动降级为纯本地关键词检索。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { IWorksStore } from './store'
import type { EmbeddingConfig } from './embeddings'
import { embedTexts } from './embeddings'
import { buildBm25, chunkText, cosine, searchBm25, snippetOf, type Bm25Index, type SearchDoc } from './search-core'
import type { SearchResult } from '../../shared/types'

const EMBEDDING_WEIGHT = 0.5

export class CorpusSearch {
  private readonly embeddingCacheFile: (workId: string) => string

  constructor(private readonly store: IWorksStore) {
    this.embeddingCacheFile = (workId) => join(this.store.worksDirOf(workId), 'embeddings.json')
  }

  /** 构建当前作品语料（正文分块 + 全部知识实体）。 */
  buildCorpus(workId: string): { docs: SearchDoc[]; index: Bm25Index } {
    const docs: SearchDoc[] = []
    for (const chapter of this.store.listChapters(workId)) {
      const content = this.store.readChapter(chapter)
      for (const seg of chunkText(content)) {
        docs.push({
          id: `ch-${chapter.seq}`,
          kind: 'chapter',
          title: chapter.title,
          text: seg,
          chapterSeq: chapter.seq
        })
      }
    }
    for (const note of this.store.listNotes(workId)) {
      docs.push({
        id: note.id,
        kind: note.kind,
        title: note.title,
        text: `${note.title} ${note.tag} ${note.content}`,
        chapterSeq: note.chapterSeq
      })
    }
    return { docs, index: buildBm25(docs) }
  }

  /** 混合检索。embedding 配置为 null/空 model 时纯本地。 */
  async search(
    workId: string,
    query: string,
    opts: { limit?: number; embedding?: EmbeddingConfig | null } = {}
  ): Promise<SearchResult[]> {
    const limit = opts.limit ?? 10
    const { docs, index } = this.buildCorpus(workId)
    const hits = searchBm25(index, query)
    const bm25Max = hits.length > 0 ? hits[0].score : 0

    let vectors: number[][] | null = null
    let queryVec: number[] | null = null
    if (opts.embedding && opts.embedding.model) {
      try {
        vectors = await this.loadVectors(workId, docs, opts.embedding)
        const qv = await embedTexts(opts.embedding, [query])
        queryVec = qv[0]
      } catch {
        // Embedding 失败 → 降级纯本地
        vectors = null
        queryVec = null
      }
    }

    const results: SearchResult[] = hits.map(({ docIdx, score }) => {
      const doc = docs[docIdx]
      let norm = bm25Max > 0 ? score / bm25Max : 0
      if (vectors && queryVec) {
        const cos = cosine(queryVec, vectors[docIdx] ?? [])
        norm = norm * (1 - EMBEDDING_WEIGHT) + cos * EMBEDDING_WEIGHT
      }
      return {
        kind: doc.kind,
        id: doc.id,
        title: doc.title,
        snippet: snippetOf(doc.text),
        score: Math.max(0, Math.min(100, Math.round(norm * 100))),
        chapterSeq: doc.chapterSeq
      }
    })
    return results.slice(0, limit)
  }

  /** 加载/构建 embedding 向量缓存（按 chunk 文本指纹失效）。 */
  private async loadVectors(workId: string, docs: SearchDoc[], config: EmbeddingConfig): Promise<number[][]> {
    const file = this.embeddingCacheFile(workId)
    const chunkTexts = docs.map((d) => d.text)
    let cached: { chunks: string[]; vectors: number[][] } | null = null
    if (existsSync(file)) {
      try {
        cached = JSON.parse(readFileSync(file, 'utf-8')) as { chunks: string[]; vectors: number[][] }
      } catch {
        cached = null
      }
    }
    const valid =
      cached && cached.chunks.length === chunkTexts.length && cached.chunks.every((c, i) => c === chunkTexts[i])
    if (valid && cached) return cached.vectors

    const vectors = await embedTexts(config, chunkTexts)
    try {
      mkdirSync(join(this.store.worksDirOf(workId)), { recursive: true })
      writeFileSync(file, JSON.stringify({ chunks: chunkTexts, vectors }), 'utf-8')
    } catch {
      // 缓存写失败不影响本次结果
    }
    return vectors
  }
}
