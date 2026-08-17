import type { AIConfig, ProviderPreset } from './types'

/** 内置 Provider 预设（统一 OpenAI 兼容协议，经 settings IPC 持久化）。 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', needsKey: true },
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  { key: 'siliconflow', label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', needsKey: true },
  { key: 'ollama', label: 'Ollama（本地）', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b', needsKey: false }
]

export const DEFAULT_CONFIG: AIConfig = {
  provider: 'deepseek',
  apiKey: '',
  baseUrl: PROVIDER_PRESETS[0].baseUrl,
  model: PROVIDER_PRESETS[0].model,
  temperature: 0.7,
  embeddingModel: ''
}

/** 配置在 settings.json 中的键（复用既有 settings IPC，无需新增通道）。 */
const SETTINGS_KEY = 'ai'

export function isLocalProvider(config: AIConfig): boolean {
  return PROVIDER_PRESETS.some((p) => p.key === config.provider && !p.needsKey)
}

export function presetByKey(key: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.key === key)
}

export async function loadAIConfig(): Promise<AIConfig> {
  const saved = await window.api.settings.get(SETTINGS_KEY)
  if (saved && typeof saved === 'object') {
    return { ...DEFAULT_CONFIG, ...(saved as Partial<AIConfig>) }
  }
  return DEFAULT_CONFIG
}

export async function saveAIConfig(config: AIConfig): Promise<boolean> {
  return window.api.settings.set(SETTINGS_KEY, config)
}
