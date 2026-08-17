/** 跨窗口录入核心逻辑（纯函数，供单测；主进程 Typer 依赖）。 */

export interface RateSpec {
  /** 每次粘贴的字数块 */
  chunk: number
  /** 块间暂停（ms） */
  pauseMs: number
  /** 粘贴后的缓冲（ms），等待目标应用接收 */
  stepDelayMs: number
}

/** 快 / 慢节奏（语义对齐旧版「每打 200 字暂停 0.5s」「每打 100 字暂停 5s」）。 */
export const RATE: Record<'fast' | 'slow', RateSpec> = {
  fast: { chunk: 200, pauseMs: 500, stepDelayMs: 120 },
  slow: { chunk: 100, pauseMs: 5000, stepDelayMs: 800 }
}

/** 按块切分文本（clipboard 逐块粘贴以兼容中文等任意字符）。 */
export function splitChunks(text: string, chunkSize: number): string[] {
  if (!text) return []
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

/** 进度位置（已粘贴字符数，不超过总长）。 */
export function progressAt(chunkIndex: number, chunkSize: number, total: number): number {
  return Math.min(total, chunkIndex * chunkSize)
}
