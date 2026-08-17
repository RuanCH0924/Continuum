/**
 * 跨窗口文本录入（M6）。
 *
 * 零原生依赖方案：Electron clipboard 逐块写入 + PowerShell WScript.Shell
 * 发送 Ctrl+V（兼容中文等任意字符，规避 SendKeys 仅 ASCII 限制）。
 * 可选 AppActivate 目标窗口标题；快/慢节奏由 typer-core 的 RATE 控制。
 */

import { clipboard } from 'electron'
import { exec } from 'child_process'
import type { TyperOptions, TyperState } from '../../shared/types'
import { RATE, progressAt, splitChunks } from './typer-core'

function runPs(command: string): void {
  exec(`powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`, () => undefined)
}

function sendPaste(): void {
  runPs("(New-Object -ComObject WScript.Shell).SendKeys('^v')")
}

function activateWindow(title: string): Promise<void> {
  const esc = title.replace(/'/g, "''")
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).AppActivate('${esc}')"`,
      () => resolve()
    )
  })
}

export class Typer {
  private chunks: string[] = []
  private idx = 0
  private timer: NodeJS.Timeout | null = null
  private running = false
  private options: TyperOptions | null = null
  private state: TyperState = { running: false, pos: 0, total: 0, error: null }

  constructor(
    private readonly onState: (s: TyperState) => void,
    private readonly onSelfWrite: (text: string) => void
  ) {}

  start(options: TyperOptions): boolean {
    if (this.running || !options.text.trim()) return false
    this.options = options
    this.running = true
    this.chunks = splitChunks(options.text, RATE[options.fast ? 'fast' : 'slow'].chunk)
    this.idx = 0
    this.state = { running: true, pos: 0, total: options.text.length, error: null }
    this.onState(this.state)

    const begin = (delay: number): void => this.schedule(delay)
    if (options.targetWindowTitle?.trim()) {
      void activateWindow(options.targetWindowTitle.trim()).then(() => begin(1000))
    } else {
      begin(1200)
    }
    return true
  }

  stop(error: string | null = null): void {
    if (!this.running && !this.timer) return
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.state = { ...this.state, running: false, error }
    this.onState(this.state)
  }

  isRunning(): boolean {
    return this.running
  }

  private schedule(delay: number): void {
    if (!this.running) return
    this.timer = setTimeout(() => this.step(), delay)
  }

  private step(): void {
    if (!this.running || !this.options) return
    const rate = RATE[this.options.fast ? 'fast' : 'slow']
    if (this.idx >= this.chunks.length) {
      this.stop()
      return
    }
    const chunk = this.chunks[this.idx]
    this.idx++
    try {
      clipboard.writeText(chunk)
      this.onSelfWrite(chunk) // 剪贴板监听忽略自身写入
      sendPaste()
      this.state = {
        ...this.state,
        pos: progressAt(this.idx, rate.chunk, this.state.total)
      }
      this.onState(this.state)
    } catch (err) {
      this.stop(`写入剪贴板失败：${err instanceof Error ? err.message : String(err)}`)
      return
    }
    this.schedule(this.idx >= this.chunks.length ? 0 : rate.pauseMs + rate.stepDelayMs)
  }
}
