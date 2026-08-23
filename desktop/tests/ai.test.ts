import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChat, validateConfig, AIError } from '../src/renderer/src/lib/ai/openaiCompat'
import { apiFormatOf, isCustomProvider, isLocalProvider, loadAIConfig, PROVIDER_PRESETS } from '../src/renderer/src/lib/ai/registry'
import { chatOnce, normalizeApiFormat } from '../src/shared/aiClient'
import type { AIConfig } from '../src/renderer/src/lib/ai/types'

const CFG: AIConfig = {
  provider: 'deepseek',
  apiFormat: 'openai',
  apiKey: 'sk-test',
  baseUrl: 'https://api.example.com/v1',
  model: 'model-x',
  temperature: 0.7
}

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    }
  })
}

function mockFetchResponse(body: ReadableStream<Uint8Array> | null, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      body,
      text: async () => 'mock-body'
    })
  )
}

/** 非流式响应（含 json 方法）。 */
function mockJsonResponse(data: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      body: sseBody([]),
      text: async () => JSON.stringify(data),
      json: async () => data
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('openaiCompat（OpenAI 兼容流式客户端）', () => {
  it('解析 SSE 增量并逐块回调 onDelta', async () => {
    mockFetchResponse(
      sseBody([
        'data: {"choices":[{"delta":{"content":"你"}}]}\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n',
        'data: {"choices":[{"delta":{"content":"！"}}]}\n',
        'data: [DONE]\n'
      ])
    )
    const deltas: string[] = []
    const full = await streamChat(CFG, [{ role: 'user', content: 'hi' }], {
      onDelta: (d) => deltas.push(d)
    })
    expect(full).toBe('你好！')
    expect(deltas).toEqual(['你', '好', '！'])
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
        body: expect.stringContaining('"stream":true')
      })
    )
  })

  it('缺少 API Key 且非本地服务时抛 AIError', async () => {
    await expect(streamChat({ ...CFG, apiKey: '' }, [])).rejects.toThrow(/API Key/)
  })

  it('HTTP 非 200 抛出携带状态码的 AIError', async () => {
    mockFetchResponse(null, false, 401)
    await expect(streamChat(CFG, [])).rejects.toMatchObject({ name: 'AIError', status: 401 })
  })

  it('AbortSignal 中断抛出「已取消」', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          })
      )
    )
    const p = streamChat(CFG, [], { signal: controller.signal })
    controller.abort()
    await expect(p).rejects.toThrow('已取消')
  })

  it('validateConfig：200 / 400 视为协议可达', async () => {
    mockFetchResponse(null, true, 200)
    expect((await validateConfig(CFG)).ok).toBe(true)
    vi.unstubAllGlobals()
    mockFetchResponse(null, false, 400)
    expect((await validateConfig(CFG)).ok).toBe(true)
  })

  it('validateConfig：401 返回错误信息', async () => {
    mockFetchResponse(null, false, 401)
    const res = await validateConfig(CFG)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('401')
  })
})

describe('registry（Provider 预设）', () => {
  it('本地 Provider（Ollama）免 API Key 判定', () => {
    expect(isLocalProvider({ ...CFG, provider: 'ollama' })).toBe(true)
    expect(isLocalProvider(CFG)).toBe(false)
  })

  it('apiFormatOf：显式格式优先，其次按 provider 推断，兜底 openai', () => {
    expect(apiFormatOf({ provider: 'deepseek', apiFormat: 'openai' })).toBe('openai')
    expect(apiFormatOf({ provider: 'anthropic' })).toBe('anthropic')
    expect(apiFormatOf({ provider: 'coze' })).toBe('coze')
    expect(apiFormatOf({ provider: 'custom-x' })).toBe('openai')
    expect(apiFormatOf({ provider: 'anthropic', apiFormat: 'openai' })).toBe('openai') // 显式覆盖
  })

  it('normalizeApiFormat 与自定义服务商判定', () => {
    expect(normalizeApiFormat('coze', undefined)).toBe('coze')
    expect(normalizeApiFormat('anything', 'anthropic')).toBe('anthropic')
    expect(isCustomProvider({ provider: 'custom-x' })).toBe(true)
    expect(isCustomProvider({ provider: 'moonshot' })).toBe(false) // 已内置预设
  })

  it('内置主流服务商预设齐全（MiniMax / Kimi / 通义千问 / 智谱 / 零一万物，均 OpenAI 兼容）', () => {
    expect(PROVIDER_PRESETS.find((p) => p.key === 'minimax')).toMatchObject({
      apiFormat: 'openai',
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'MiniMax-M3'
    })
    expect(PROVIDER_PRESETS.find((p) => p.key === 'moonshot')?.baseUrl).toBe('https://api.moonshot.cn/v1')
    expect(PROVIDER_PRESETS.find((p) => p.key === 'qwen')?.model).toBe('qwen-plus')
    expect(PROVIDER_PRESETS.find((p) => p.key === 'zhipu')?.baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4')
    expect(PROVIDER_PRESETS.find((p) => p.key === 'lingyi')?.model).toBe('yi-lightning')
    // 全部新增预设均为 OpenAI 兼容格式，直接可用
    for (const key of ['minimax', 'moonshot', 'qwen', 'zhipu', 'lingyi']) {
      expect(PROVIDER_PRESETS.find((p) => p.key === key)?.apiFormat).toBe('openai')
    }
  })

  it('loadAIConfig：旧配置（无 apiFormat）按 provider 归一化', async () => {
    vi.stubGlobal('window', {
      api: {
        settings: {
          get: vi.fn(async () => ({
            provider: 'anthropic',
            apiKey: 'x',
            baseUrl: 'https://api.anthropic.com/v1',
            model: 'claude-x',
            temperature: 0.5
          }))
        }
      }
    })
    const cfg = await loadAIConfig()
    expect(cfg.apiFormat).toBe('anthropic')
    expect(cfg.provider).toBe('anthropic')
  })
})

describe('Anthropic 协议（/v1/messages）', () => {
  const ANTH: AIConfig = {
    ...CFG,
    provider: 'anthropic',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5'
  }

  it('解析 content_block_delta 流式增量，并携带 x-api-key / anthropic-version 请求头', async () => {
    mockFetchResponse(
      sseBody([
        'event: message_start\ndata: {"type":"message_start"}\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你好"}}\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"世界"}}\n',
        'data: {"type":"message_stop"}\n'
      ])
    )
    const deltas: string[] = []
    const full = await streamChat(ANTH, [{ role: 'user', content: 'hi' }], { onDelta: (d) => deltas.push(d) })
    expect(full).toBe('你好世界')
    expect(deltas).toEqual(['你好', '世界'])
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01'
        }),
        body: expect.stringContaining('"max_tokens":4096')
      })
    )
  })

  it('system 消息移出 messages 数组、放入 system 字段', async () => {
    mockFetchResponse(sseBody(['data: {"type":"message_stop"}\n']))
    await streamChat(ANTH, [
      { role: 'system', content: '你是助手' },
      { role: 'user', content: 'hi' }
    ])
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    const body = String(init.body)
    expect(body).toContain('"system":"你是助手"')
    expect(body).not.toContain('"role":"system"')
  })
})

describe('Coze 协议（/v3/chat）', () => {
  const COZE: AIConfig = {
    ...CFG,
    provider: 'coze',
    apiFormat: 'coze',
    baseUrl: 'https://api.coze.cn/v3',
    model: 'bot-123'
  }

  it('解析 conversation.message.delta 流式增量，请求携带 bot_id 与 auto_save_history=false', async () => {
    mockFetchResponse(
      sseBody([
        'data: {"event":"conversation.message.delta","data":{"content":"你"}}\n',
        'data: {"event":"conversation.message.delta","data":{"content":"好"}}\n',
        'data: {"event":"conversation.chat.completed","data":{}}\n'
      ])
    )
    const full = await streamChat(COZE, [{ role: 'user', content: 'hi' }])
    expect(full).toBe('你好')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.coze.cn/v3/chat',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
        body: expect.stringContaining('"bot_id":"bot-123"')
      })
    )
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    const body = String(init.body)
    expect(body).toContain('"auto_save_history":false')
    expect(body).toContain('"content_type":"text"')
    expect(body).not.toContain('"role":"system"') // 系统消息不发送给 Coze 机器人
  })
})

describe('chatOnce（非流式单次调用）', () => {
  it('OpenAI 格式解析 choices[0].message.content', async () => {
    mockJsonResponse({ choices: [{ message: { content: '章纲结果' } }] })
    const text = await chatOnce(
      { ...CFG, local: false },
      [{ role: 'user', content: 'ping' }]
    )
    expect(text).toBe('章纲结果')
  })

  it('Anthropic 格式解析 content[0].text', async () => {
    mockJsonResponse({ content: [{ type: 'text', text: '章纲结果' }] })
    const text = await chatOnce(
      { ...CFG, provider: 'anthropic', apiFormat: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
      [{ role: 'user', content: 'ping' }]
    )
    expect(text).toBe('章纲结果')
  })

  it('Coze 非流式响应不含正文，内部强制流式聚合（请求 stream=true）', async () => {
    mockFetchResponse(
      sseBody([
        'data: {"event":"conversation.message.delta","data":{"content":"逐字"}}\n',
        'data: {"event":"conversation.message.delta","data":{"content":"返回"}}\n',
        'data: {"event":"done"}\n'
      ])
    )
    const text = await chatOnce(
      { ...CFG, provider: 'coze', apiFormat: 'coze', baseUrl: 'https://api.coze.cn/v3', model: 'bot-9' },
      [{ role: 'user', content: 'ping' }]
    )
    expect(text).toBe('逐字返回')
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    const body = String(init.body)
    expect(body).toContain('"stream":true')
    expect(body).toContain('"auto_save_history":false')
  })
})

describe('AIError', () => {
  it('携带可选 status', () => {
    const e = new AIError('boom', 429)
    expect(e.status).toBe(429)
    expect(e.name).toBe('AIError')
  })
})
