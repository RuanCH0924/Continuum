/**
 * AI 多协议统一客户端（主进程 / 渲染进程共享，零依赖：纯 fetch + SSE）。
 *
 * 支持三种接口格式（随配置 apiFormat 自动切换）：
 *   - openai     ：POST {baseUrl}/chat/completions（OpenAI 兼容生态：DeepSeek / 硅基流动 / Ollama 等）
 *   - anthropic  ：POST {baseUrl}/messages（x-api-key + anthropic-version，SSE content_block_delta）
 *   - coze       ：POST {baseUrl}/chat（扣子原生 v3，bot_id 承载于 model 字段，SSE conversation.message.delta）
 */

export type ApiFormat = 'openai' | 'anthropic' | 'coze'

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiClientConfig {
  provider: string
  /** 接口格式；缺省时按 provider 推断（anthropic/coze → 对应格式，其余 → openai） */
  apiFormat?: ApiFormat
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  /** 本地服务（Ollama 等）无需 API Key */
  local?: boolean
}

export class AIError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AIError'
    this.status = status
  }
}

/** 旧配置归一化：显式格式优先，其次按 provider 推断，兜底 openai。 */
export function normalizeApiFormat(provider: string, format?: ApiFormat): ApiFormat {
  if (format === 'openai' || format === 'anthropic' || format === 'coze') return format
  if (provider === 'anthropic') return 'anthropic'
  if (provider === 'coze') return 'coze'
  return 'openai'
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function requireKey(config: AiClientConfig): void {
  if (!config.apiKey && !config.local) {
    throw new AIError('未配置 API Key，请先在「设置 → AI 服务」中填写')
  }
}

// ============================================================ 请求构造（按格式分发）

interface BuiltRequest {
  url: string
  headers: Record<string, string>
  body: string
}

function buildRequest(fmt: ApiFormat, config: AiClientConfig, messages: AiChatMessage[], stream: boolean): BuiltRequest {
  if (fmt === 'anthropic') {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: 4096,
      messages: rest,
      stream,
      temperature: config.temperature
    }
    if (system) body.system = system
    return {
      url: stripSlash(config.baseUrl) + '/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    }
  }

  if (fmt === 'coze') {
    // Coze 机器人人格在平台侧配置：系统消息不参与发送（仅 user/assistant 进入 additional_messages）
    const additional = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content, content_type: 'text' }))
    return {
      url: stripSlash(config.baseUrl) + '/chat',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        bot_id: config.model, // model 字段承载 Coze Bot ID
        user_id: getCozeUserId(),
        stream,
        auto_save_history: !stream, // 官方约束：stream=true 时 auto_save_history 必须为 false
        additional_messages: additional
      })
    }
  }

  // openai（默认）
  return {
    url: stripSlash(config.baseUrl) + '/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream,
      temperature: config.temperature
    })
  }
}

/** 会话内稳定的 Coze user_id（必填字段；进程内惰性生成一次即可保证连续对话归属一致）。 */
let cozeUserId = ''
function getCozeUserId(): string {
  if (!cozeUserId) {
    cozeUserId = `continuum_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
  }
  return cozeUserId
}

// ============================================================ SSE 增量解析（按格式分发）

function parseDelta(fmt: ApiFormat, data: Record<string, unknown>): string | undefined {
  if (fmt === 'anthropic') {
    // {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
    if (data.type === 'content_block_delta') {
      const delta = data.delta as { type?: string; text?: string } | undefined
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') return delta.text
    }
    return undefined
  }
  if (fmt === 'coze') {
    // {"event":"conversation.message.delta","data":{"content":"..."}}
    if (data.event === 'conversation.message.delta') {
      const inner = data.data as { content?: unknown } | undefined
      if (inner && typeof inner.content === 'string') return inner.content
    }
    return undefined
  }
  // openai：{"choices":[{"delta":{"content":"..."}}]}
  const choices = data.choices as { delta?: { content?: string } }[] | undefined
  return choices?.[0]?.delta?.content
}

function isDoneEvent(fmt: ApiFormat, data: Record<string, unknown>): boolean {
  if (fmt === 'anthropic') return data.type === 'message_stop'
  if (fmt === 'coze') return data.event === 'conversation.chat.completed' || data.event === 'done'
  return false
}

function parseNonStreamText(fmt: ApiFormat, data: Record<string, unknown>): string {
  if (fmt === 'anthropic') {
    const content = data.content as { type?: string; text?: string }[] | undefined
    const block = content?.find((b) => b.type === 'text')
    return block?.text ?? ''
  }
  // openai
  const choices = data.choices as { message?: { content?: string } }[] | undefined
  return choices?.[0]?.message?.content ?? ''
}

// ============================================================ 统一请求

async function readSse(
  resp: Response,
  fmt: ApiFormat,
  onDelta: ((delta: string) => void) | undefined,
  signal?: AbortSignal
): Promise<string> {
  if (!resp.body) return ''
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
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          done = true
          break
        }
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(data) as Record<string, unknown>
        } catch {
          continue // 忽略无法解析的 keep-alive 数据
        }
        const delta = parseDelta(fmt, parsed)
        if (delta) {
          full += delta
          onDelta?.(delta)
        }
        if (isDoneEvent(fmt, parsed)) {
          done = true
          break
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) throw new AIError('已取消')
    throw new AIError(`AI 流读取失败：${err instanceof Error ? err.message : String(err)}`)
  }
  return full
}

/**
 * 统一对话请求：
 * - stream=true：SSE 增量解析，逐块回调 onDelta，返回完整回复；
 * - stream=false：直接解析响应 JSON。
 * Coze 例外：其非流式响应不含正文（需二次查询），故一律以流式请求 + SSE 聚合取回正文。
 * 失败抛 AIError；外部可通过 signal 中断。
 */
async function requestChat(
  config: AiClientConfig,
  messages: AiChatMessage[],
  opts: { stream: boolean; onDelta?: (delta: string) => void; signal?: AbortSignal; timeoutMs?: number } = { stream: false }
): Promise<string> {
  requireKey(config)
  const fmt = normalizeApiFormat(config.provider, config.apiFormat)
  const effectiveStream = opts.stream || fmt === 'coze'
  const { url, headers, body } = buildRequest(fmt, config, messages, effectiveStream)

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: opts.signal ?? (opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined)
    })
  } catch (err) {
    if (opts.signal?.aborted) throw new AIError('已取消')
    throw new AIError(`AI 网络异常：${err instanceof Error ? err.message : String(err)}`)
  }

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    throw new AIError(`AI 请求失败（HTTP ${resp.status}）：${text.slice(0, 300)}`, resp.status)
  }

  if (effectiveStream) {
    return readSse(resp, fmt, opts.onDelta, opts.signal)
  }

  const data = (await resp.json()) as Record<string, unknown>
  const text = parseNonStreamText(fmt, data)
  if (text) opts.onDelta?.(text)
  return text
}

/** 流式对话（渲染层 AI 面板 / 写作工具）。 */
export function streamChat(
  config: AiClientConfig,
  messages: AiChatMessage[],
  opts: { onDelta?: (delta: string) => void; signal?: AbortSignal } = {}
): Promise<string> {
  return requestChat(config, messages, { ...opts, stream: true })
}

/** 单次非流式对话（主进程智能章纲提取等）。 */
export function chatOnce(
  config: AiClientConfig,
  messages: AiChatMessage[],
  opts: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<string> {
  return requestChat(config, messages, { stream: false, ...opts })
}

/** 配置有效性校验（发起一次最小请求；HTTP 200 / 400 视为协议可达即通过）。 */
export async function validateChatConfig(config: AiClientConfig): Promise<{ ok: boolean; error: string }> {
  const ping: AiChatMessage[] = [{ role: 'user', content: 'ping' }]
  const fmt = normalizeApiFormat(config.provider, config.apiFormat)
  try {
    const req = buildRequest(fmt, config, ping, false)
    const resp = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: req.body,
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
