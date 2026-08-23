/**
 * AI 客户端渲染层入口（薄封装）：保持既有导出签名（streamChat / validateConfig / AIError），
 * 实际能力由共享多协议客户端 `src/shared/aiClient.ts` 提供（OpenAI / Anthropic / Coze 三格式自动切换）。
 */
import { AIError, streamChat as sharedStreamChat, validateChatConfig } from '@shared/aiClient'
import type { AIConfig, ChatMessage } from './types'
import { isLocalProvider } from './registry'

export { AIError }

/** 流式对话（SSE 增量解析），按配置 apiFormat 自动选择 OpenAI / Anthropic / Coze 协议。 */
export async function streamChat(
  config: AIConfig,
  messages: ChatMessage[],
  opts: { onDelta?: (delta: string) => void; signal?: AbortSignal } = {}
): Promise<string> {
  return sharedStreamChat({ ...config, local: isLocalProvider(config) }, messages, opts)
}

/** 配置有效性校验（发起一次最小请求；400 视为协议可达即通过）。 */
export async function validateConfig(config: AIConfig): Promise<{ ok: boolean; error: string }> {
  return validateChatConfig({ ...config, local: isLocalProvider(config) })
}
