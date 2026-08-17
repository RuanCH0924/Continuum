import { useAppStore } from '../stores/appStore'
import { useAiStore } from '../stores/aiStore'
import type { SearchResult, SearchSourceKind } from '@shared/types'

export const KIND_LABEL: Record<SearchSourceKind, string> = {
  chapter: '章节',
  character: '角色',
  world: '设定',
  clue: '伏笔',
  material: '素材'
}

/** 检索命中 → 注入上下文文本（供 AI 对话参考）。 */
export function formatKnowledgeContext(hits: SearchResult[]): string {
  if (!hits.length) return ''
  return hits.map((h) => `- [${KIND_LABEL[h.kind]}] ${h.title}：${h.snippet}`).join('\n')
}

/**
 * 检索当前作品知识库（章节正文 + 角色/设定/伏笔/素材），返回格式化上下文。
 * 检索失败静默返回空串（不阻塞对话）。
 */
export async function retrieveKnowledge(query: string, limit = 5): Promise<string> {
  const { currentWorkId } = useAppStore.getState()
  const { config } = useAiStore.getState()
  if (!currentWorkId || !query.trim()) return ''
  const embedding =
    config.embeddingModel?.trim() && config.apiKey
      ? { baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.embeddingModel }
      : null
  try {
    const hits = await window.api.search.query({
      workId: currentWorkId,
      query: query.trim().slice(0, 200),
      limit,
      embedding
    })
    return formatKnowledgeContext(hits)
  } catch {
    return ''
  }
}
