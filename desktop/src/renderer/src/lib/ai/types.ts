/** AI 领域类型（渲染进程内使用）。 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** OpenAI 兼容三段式配置（与旧版 continuum.ai.base.ProviderConfig 语义对齐）。 */
export interface AIConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  /** 语义检索 Embedding 模型名；留空则知识库仅关键词检索（RAG 可选增强） */
  embeddingModel?: string
}

export interface ProviderPreset {
  key: string
  label: string
  baseUrl: string
  model: string
  /** 本地服务（Ollama 等）无需 API Key */
  needsKey: boolean
}
