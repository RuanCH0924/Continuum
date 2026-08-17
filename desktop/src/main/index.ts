import { join } from 'path'
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { WorksStore, type IWorksStore } from './services/store'
import { SqliteWorksStore } from './services/store-sqlite'
import { registerIpc } from './ipc'
import { registerToolsIpc } from './ipc/tools'
import { registerFilesIpc } from './ipc/files'
import { Typer } from './services/typer'
import { ClipboardMonitor } from './services/clipboard'
import { PluginManager } from './services/plugins'
import { IPC } from '../shared/ipc'
import type { ClipboardEntry } from '../shared/types'

/** 数据根目录：开发期用项目内 data/，打包后用 userData。 */
function getDataDir(): string {
  return is.dev
    ? join(app.getAppPath(), 'data')
    : join(app.getPath('userData'), 'data')
}

let mainWindow: BrowserWindow | null = null

function createWindow(store: IWorksStore): void {
  // 窗口状态恢复（几何持久化，M5）
  const saved = store.getSetting('window') as
    | { width?: number; height?: number; x?: number; y?: number }
    | null
    | undefined
  const hasBounds = saved && typeof saved === 'object' && saved.width && saved.height

  const window = new BrowserWindow({
    ...(hasBounds
      ? { width: saved!.width, height: saved!.height, x: saved!.x, y: saved!.y }
      : { width: 1280, height: 820 }),
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: '续言 Continuum',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = window

  const saveBounds = (): void => {
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return
    store.setSetting('window', window.getBounds())
  }

  // 防抖落盘（resize/move 高频事件）
  let boundsTimer: NodeJS.Timeout | undefined
  window.on('resize', () => {
    clearTimeout(boundsTimer)
    boundsTimer = setTimeout(saveBounds, 500)
  })
  window.on('move', () => {
    clearTimeout(boundsTimer)
    boundsTimer = setTimeout(saveBounds, 500)
  })
  window.on('close', saveBounds)
  window.on('closed', () => {
    mainWindow = null
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  // 外部链接交给系统浏览器
  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // localhost 在部分 Windows 网络环境下被代理拦截，固定走 127.0.0.1
    window.loadURL(process.env['ELECTRON_RENDERER_URL'].replace('localhost', '127.0.0.1'))
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.continuum.desktop')

  // M1：初始化数据存储并注册 IPC。
  // 存储引擎：设置环境变量 CONTINUUM_STORAGE=sqlite 启用 SQLite 实现（默认文件实现，接口一致可互换）。
  const store =
    process.env.CONTINUUM_STORAGE === 'sqlite'
      ? await SqliteWorksStore.open(getDataDir())
      : new WorksStore(getDataDir())
  registerIpc(store, { getWindow: () => mainWindow })

  // P2：插件机制（扫描 <data>/plugins/*.js）
  const plugins = new PluginManager(getDataDir())
  plugins.loadAll()
  ipcMain.handle(IPC.PluginsList, () => plugins.list())

  // M6：辅助工具（剪贴板监听 + 跨窗口录入 + 窗口唤起/置顶）
  const clipboardMonitor = new ClipboardMonitor(1000, (text) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const entry: ClipboardEntry = { text, at: Date.now() }
    mainWindow.webContents.send(IPC.ClipboardPush, entry)
  })
  const typer = new Typer(
    (s) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(IPC.TyperState, s)
    },
    (text) => clipboardMonitor.markSelfWrite(text)
  )
  registerToolsIpc({ getWindow: () => mainWindow, typer, monitor: clipboardMonitor })
  registerFilesIpc(() => mainWindow)

  // 全局热键：Ctrl+G 唤起主窗口
  globalShortcut.register('CommandOrControl+G', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // 开发模式 F12 打开 DevTools；生产禁用快捷键
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow(store)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(store)
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
