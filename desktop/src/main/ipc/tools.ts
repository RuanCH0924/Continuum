import { BrowserWindow, ipcMain, clipboard } from 'electron'
import { IPC } from '../../shared/ipc'
import type { TyperOptions } from '../../shared/types'
import { Typer } from '../services/typer'
import { ClipboardMonitor } from '../services/clipboard'

/** 注册辅助工具 IPC（M6：窗口唤起/置顶、跨窗口录入、剪贴板）。 */
export function registerToolsIpc(options: {
  getWindow: () => BrowserWindow | null
  typer: Typer
  monitor: ClipboardMonitor
}): void {
  const { getWindow, typer, monitor } = options

  ipcMain.handle(IPC.WindowShow, () => {
    const w = getWindow()
    if (w) {
      if (w.isMinimized()) w.restore()
      w.show()
      w.focus()
    }
    return true
  })

  ipcMain.handle(IPC.ToolsTopmostSet, (_e, value: boolean) => {
    getWindow()?.setAlwaysOnTop(value)
    return value
  })

  ipcMain.handle(IPC.TyperStart, (_e, opts: TyperOptions) => typer.start(opts))
  ipcMain.handle(IPC.TyperStop, () => {
    typer.stop()
    return true
  })

  ipcMain.handle(IPC.ClipboardSetEnabled, (_e, value: boolean) => {
    monitor.setEnabled(value)
    return value
  })
  ipcMain.handle(IPC.ClipboardRead, () => clipboard.readText())
}
