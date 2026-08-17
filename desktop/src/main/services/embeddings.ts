/**
 * OpenAI 兼容 /embeddings 客户端（远程向量增强，复用 AI 设置）。
 */

export interface EmbeddingConfig {
  baseUrl: string
  apiKey: string
  model: string
}

function endpoint(config: EmbeddingConfig): string {
  return config.baseUrl.replace(/\/+$/, '') + '/embeddings'
}

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingError'
  }
}

/** 批量文本 → 向量（按 index 排序返回）。 */
export async function embedTexts(config: EmbeddingConfig, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  let resp: Response
  try {
    resp = await fetch(endpoint(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({ model: config.model, input: texts }),
      signal: AbortSignal.timeout(60000)
    })
  } catch (err) {
    throw new EmbeddingError(`Embedding 网络异常：${err instanceof Error ? err.message : String(err)}`)
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new EmbeddingError(`Embedding 请求失败（HTTP ${resp.status}）：${text.slice(0, 200)}`)
  }
  const data = (await resp.json()) as {
    data?: { index: number; embedding: number[] }[]
  }
  if (!data.data) throw new EmbeddingError('Embedding 响应格式异常')
  return [...data.data]
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}
