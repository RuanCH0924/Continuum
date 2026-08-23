import { normalizeApiFormat } from '@shared/aiClient'
import type { AIConfig, ProviderPreset } from './types'

/** 内置 Provider 预设（覆盖 OpenAI 兼容 / Anthropic / Coze 三种接口格式，经 settings IPC 持久化）。 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: 'deepseek', label: 'DeepSeek', apiFormat: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', needsKey: true },
  { key: 'openai', label: 'OpenAI', apiFormat: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  { key: 'anthropic', label: 'Anthropic', apiFormat: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5', needsKey: true },
  { key: 'coze', label: 'Coze（扣子）', apiFormat: 'coze', baseUrl: 'https://api.coze.cn/v3', model: '', needsKey: true },
  { key: 'minimax', label: 'MiniMax', apiFormat: 'openai', baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M3', needsKey: true },
  { key: 'moonshot', label: 'Kimi（月之暗面）', apiFormat: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', needsKey: true },
  { key: 'qwen', label: '通义千问（阿里云）', apiFormat: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', needsKey: true },
  { key: 'zhipu', label: '智谱 GLM', apiFormat: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', needsKey: true },
  { key: 'lingyi', label: '零一万物 Yi', apiFormat: 'openai', baseUrl: 'https://api.lingyiwanwu.com/v1', model: 'yi-lightning', needsKey: true },
  { key: 'siliconflow', label: '硅基流动', apiFormat: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', needsKey: true },
  { key: 'ollama', label: 'Ollama（本地）', apiFormat: 'openai', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b', needsKey: false }
]

/** 自定义服务商在下拉中的占位键（非内置预设即视为自定义，名称取自 config.provider）。 */
export const CUSTOM_PROVIDER_KEY = '__custom__'

export const DEFAULT_CONFIG: AIConfig = {
  provider: 'deepseek',
  apiFormat: 'openai',
  apiKey: '',
  baseUrl: PROVIDER_PRESETS[0].baseUrl,
  model: PROVIDER_PRESETS[0].model,
  temperature: 0.7,
  embeddingModel: ''
}

/** 配置在 settings.json 中的键（复用既有 settings IPC，无需新增通道）。 */
const SETTINGS_KEY = 'ai'

export function isLocalProvider(config: Pick<AIConfig, 'provider'>): boolean {
  return PROVIDER_PRESETS.some((p) => p.key === config.provider && !p.needsKey)
}

export function presetByKey(key: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.key === key)
}

/** 接口格式解析：显式格式优先，其次内置预设，兜底 OpenAI 兼容。 */
export function apiFormatOf(config: Pick<AIConfig, 'apiFormat' | 'provider'>): AIConfig['apiFormat'] {
  return normalizeApiFormat(config.provider, config.apiFormat)
}

/** 是否为自定义服务商（不在内置预设中）。 */
export function isCustomProvider(config: Pick<AIConfig, 'provider'>): boolean {
  return !presetByKey(config.provider)
}

export async function loadAIConfig(): Promise<AIConfig> {
  const saved = await window.api.settings.get(SETTINGS_KEY)
  const raw = saved && typeof saved === 'object' ? (saved as Partial<AIConfig>) : {}
  const merged: AIConfig = { ...DEFAULT_CONFIG, ...raw }
  // 旧配置（无 apiFormat 字段）按 provider 归一化；已显式保存的格式优先
  return { ...merged, apiFormat: normalizeApiFormat(merged.provider, raw.apiFormat) }
}

export async function saveAIConfig(config: AIConfig): Promise<boolean> {
  return window.api.settings.set(SETTINGS_KEY, config)
}
