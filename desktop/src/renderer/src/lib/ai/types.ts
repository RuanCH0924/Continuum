/** AI 领域类型（渲染进程内使用）。 */

/** 接口格式：OpenAI 兼容 / Anthropic Messages / Coze 扣子原生（与主进程共享的多协议客户端对齐）。 */
import type { ApiFormat } from '@shared/aiClient'

export type { ApiFormat } from '@shared/aiClient'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** AI 服务配置（三段式 + 接口格式；与旧版 continuum.ai.base.ProviderConfig 语义对齐）。 */
export interface AIConfig {
  provider: string
  /** 接口格式：OpenAI 兼容 / Anthropic Messages / Coze 扣子原生 */
  apiFormat: ApiFormat
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  /** 语义检索 Embedding 模型名；留空则知识库仅关键词检索（RAG 可选增强，走 OpenAI 兼容 embeddings 端点） */
  embeddingModel?: string
}

export interface ProviderPreset {
  key: string
  label: string
  apiFormat: ApiFormat
  baseUrl: string
  model: string
  /** 本地服务（Ollama 等）无需 API Key */
  needsKey: boolean
}
