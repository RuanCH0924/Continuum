/**
 * 智能章纲提取服务（PRD v1.0 §9）。
 *
 * 主进程排队执行（并发 1），逐章调用 OpenAI 兼容接口（默认 DeepSeek），
 * 解析结构化章纲并写入存储；每成功 1 章经 AiQuotaService 消耗 1 次配额。
 * 失败 / 跳过 / 取消均不消耗配额。
 */

import type {
  ChapterOutline,
  OutlineExtractProgress,
  OutlineExtractRequest,
  OutlineExtractResult
} from '../../shared/types'
import type { IWorksStore } from './store'
import type { AiQuotaService } from './quota'

/** 主进程侧 AI 配置形态（与渲染层 lib/ai/types.ts 的 AIConfig 语义一致）。 */
export interface MainAIConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
}

const CONFIG_DEFAULTS: MainAIConfig = {
  provider: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  temperature: 0.3
}

/** 本地 Provider（Ollama 等）无需 API Key。 */
function isLocalProvider(config: MainAIConfig): boolean {
  return config.provider === 'ollama'
}

const EXTRACT_SYSTEM =
  '你是一名资深网文编辑。请根据给定的章节正文，提取该章的章纲，要求简明、贴合剧情实际。' +
  '只输出严格 JSON（不要输出任何多余文字、不要使用 Markdown 代码块包裹）：\n' +
  '{"corePlot":"本章核心剧情（≤120字）","characterScenes":"本章角色互动场景（≤120字）",' +
  '"conflict":"本章关键冲突点（≤80字）","hook":"章末钩子/悬念（≤60字，无则空字符串）"}'

/** 单次非流式 chat 调用（OpenAI 兼容 /chat/completions）。 */
async function chatOnce(config: MainAIConfig, system: string, user: string): Promise<string> {
  if (!config.apiKey && !isLocalProvider(config)) {
    throw new Error('未配置 API Key，请先在「设置 → AI 服务」中填写')
  }
  const url = config.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      stream: false,
      temperature: config.temperature
    }),
    signal: AbortSignal.timeout(60000)
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`AI 请求失败（HTTP ${resp.status}）：${text.slice(0, 200)}`)
  }
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

/** 从模型输出中提取 JSON 对象（容忍前后缀文本与代码块包裹）。 */
export function parseChapterOutlineJson(raw: string): {
  corePlot: string
  characterScenes: string
  conflict: string
  hook: string
} | null {
  const text = raw.trim()
  // 去除 Markdown 代码块包裹（```json ... ```）
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    const str = (v: unknown): string => (typeof v === 'string' ? v : '')
    return {
      corePlot: str(parsed.corePlot),
      characterScenes: str(parsed.characterScenes),
      conflict: str(parsed.conflict),
      hook: str(parsed.hook)
    }
  } catch {
    return null
  }
}

export class ExtractService {
  private running = false

  constructor(
    private readonly store: IWorksStore,
    private readonly quota: AiQuotaService
  ) {}

  get busy(): boolean {
    return this.running
  }

  private loadConfig(): MainAIConfig {
    const saved = this.store.getSetting('ai') as Partial<MainAIConfig> | null | undefined
    if (!saved || typeof saved !== 'object') return CONFIG_DEFAULTS
    return { ...CONFIG_DEFAULTS, ...saved }
  }

  /**
   * 执行一批章纲提取（并发 1，逐章处理）。
   * @param onProgress 进度回调（主进程向渲染层推送事件）
   */
  async extract(
    req: OutlineExtractRequest,
    onProgress: (p: OutlineExtractProgress) => void
  ): Promise<OutlineExtractResult> {
    if (this.running) {
      return { success: [], failed: [{ seq: 0, reason: '已有提取任务进行中，请等待完成或取消' }], quotaUsed: 0 }
    }
    const seqs = Array.from(new Set(req.seqs))
      .filter((s) => Number.isFinite(s))
      .sort((a, b) => a - b)
      .slice(0, 50)
    if (seqs.length === 0) {
      return { success: [], failed: [{ seq: 0, reason: '未选择有效章节' }], quotaUsed: 0 }
    }
    if (!this.quota.canOccupy(seqs.length)) {
      return {
        success: [],
        failed: [{ seq: 0, reason: `配额不足，今日剩余 ${this.quota.remaining()} 次` }],
        quotaUsed: 0
      }
    }

    const config = this.loadConfig()
    this.running = true
    const success: number[] = []
    const failed: { seq: number; reason: string }[] = []
    try {
      for (const [i, seq] of seqs.entries()) {
        onProgress({ done: i, total: seqs.length, currentSeq: seq })
        try {
          const meta = this.store.getChapter(req.workId, seq)
          if (!meta) {
            failed.push({ seq, reason: '章节不存在' })
            continue
          }
          const content = this.store.readChapter(meta)
          if (content.replace(/\s/g, '').length < 100) {
            failed.push({ seq, reason: '正文过短（<100 字），跳过' })
            continue
          }
          const user = `章节标题：《${meta.title}》\n章节正文（已截断）：\n${content.slice(0, 8000)}`
          const raw = await this.extractOnceWithRetry(config, user)
          const parsed = parseChapterOutlineJson(raw)
          if (!parsed) {
            failed.push({ seq, reason: 'AI 输出解析失败' })
            continue
          }
          const existing = this.store.listChapterOutlines(req.workId).find((o) => o.chapterSeq === seq)
          const outline: ChapterOutline = {
            id: existing?.id ?? '',
            workId: req.workId,
            chapterSeq: seq,
            corePlot: parsed.corePlot,
            characterScenes: parsed.characterScenes,
            conflict: parsed.conflict,
            hook: parsed.hook,
            content: existing?.content ?? '',
            extracted: true,
            status: existing?.status ?? 'unwritten',
            updatedAt: 0
          }
          this.store.saveChapterOutline(req.workId, outline)
          this.quota.record(1)
          success.push(seq)
        } catch (err) {
          failed.push({ seq, reason: err instanceof Error ? err.message : String(err) })
        }
      }
    } finally {
      this.running = false
      onProgress({ done: seqs.length, total: seqs.length, currentSeq: null })
    }
    return { success, failed, quotaUsed: success.length }
  }

  /** 单章提取，解析失败时重试 1 次（网络/流异常直接抛给外层）。 */
  private async extractOnceWithRetry(config: MainAIConfig, user: string): Promise<string> {
    let lastRaw = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      lastRaw = await chatOnce(config, EXTRACT_SYSTEM, user)
      if (parseChapterOutlineJson(lastRaw)) return lastRaw
    }
    throw new Error('章纲解析失败（输出不符合 JSON 格式）')
  }
}
