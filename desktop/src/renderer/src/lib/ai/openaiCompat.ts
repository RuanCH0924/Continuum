import type { AIConfig, ChatMessage } from './types'
import { isLocalProvider } from './registry'

/** OpenAI 兼容 /chat/completions 流式客户端（纯 fetch + SSE，零原生依赖）。 */

export class AIError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AIError'
    this.status = status
  }
}

function endpoint(config: AIConfig): string {
  return config.baseUrl.replace(/\/+$/, '') + '/chat/completions'
}

function headers(config: AIConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) h.Authorization = `Bearer ${config.apiKey}`
  return h
}

/**
 * 流式对话（SSE 增量解析），逐块回调 onDelta，返回完整回复。
 * 失败抛 AIError；外部可通过 AbortSignal 中断。
 */
export async function streamChat(
  config: AIConfig,
  messages: ChatMessage[],
  opts: { onDelta?: (delta: string) => void; signal?: AbortSignal } = {}
): Promise<string> {
  if (!config.apiKey && !isLocalProvider(config)) {
    throw new AIError('未配置 API Key，请先在「设置 → AI 服务」中填写')
  }

  let resp: Response
  try {
    resp = await fetch(endpoint(config), {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        temperature: config.temperature
      }),
      signal: opts.signal
    })
  } catch (err) {
    if (opts.signal?.aborted) throw new AIError('已取消')
    throw new AIError(`AI 网络异常：${err instanceof Error ? err.message : String(err)}`)
  }

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    throw new AIError(`AI 请求失败（HTTP ${resp.status}）：${text.slice(0, 300)}`, resp.status)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  let done = false
  try {
    while (!done) {
      const { done: isDone, value } = await reader.read()
      if (isDone) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          done = true
          break
        }
        try {
          const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            full += delta
            opts.onDelta?.(delta)
          }
        } catch {
          // 忽略无法解析的 keep-alive 数据
        }
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) throw new AIError('已取消')
    throw new AIError(`AI 流读取失败：${err instanceof Error ? err.message : String(err)}`)
  }
  return full
}

/** 配置有效性校验（发起一次最小请求；400 视为协议可达即通过）。 */
export async function validateConfig(config: AIConfig): Promise<{ ok: boolean; error: string }> {
  try {
    const resp = await fetch(endpoint(config), {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        temperature: config.temperature
      }),
      signal: AbortSignal.timeout(15000)
    })
    if (resp.ok || resp.status === 400) return { ok: true, error: '' }
    const text = await resp.text().catch(() => '')
    return { ok: false, error: `HTTP ${resp.status}：${text.slice(0, 200)}` }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, error: '连接超时（15s）' }
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
