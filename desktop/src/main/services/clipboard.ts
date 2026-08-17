/**
 * 剪贴板监听（M6）。轮询变化并回调；标记自身写入以忽略（录入器粘贴时避免回环）。
 */

import { clipboard } from 'electron'

export class ClipboardMonitor {
  private timer: NodeJS.Timeout | null = null
  private last = ''
  private enabled = false
  private selfWrites = new Set<string>()

  constructor(
    private readonly intervalMs: number,
    private readonly onChange: (text: string) => void
  ) {}

  setEnabled(value: boolean): void {
    this.enabled = value
    if (value && !this.timer) {
      this.last = clipboard.readText()
      this.timer = setInterval(() => this.check(), this.intervalMs)
    } else if (!value && this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  markSelfWrite(text: string): void {
    this.selfWrites.add(text)
    setTimeout(() => this.selfWrites.delete(text), 2000)
  }

  private check(): void {
    if (!this.enabled) return
    try {
      const text = clipboard.readText()
      if (text && text !== this.last && !this.selfWrites.has(text)) {
        this.last = text
        this.onChange(text)
      }
    } catch {
      // 剪贴板被其他应用占用时跳过本轮
    }
  }
}
