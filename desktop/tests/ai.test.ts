import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChat, validateConfig, AIError } from '../src/renderer/src/lib/ai/openaiCompat'
import { isLocalProvider } from '../src/renderer/src/lib/ai/registry'
import type { AIConfig } from '../src/renderer/src/lib/ai/types'

const CFG: AIConfig = {
  provider: 'deepseek',
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
})

describe('AIError', () => {
  it('携带可选 status', () => {
    const e = new AIError('boom', 429)
    expect(e.status).toBe(429)
    expect(e.name).toBe('AIError')
  })
})
