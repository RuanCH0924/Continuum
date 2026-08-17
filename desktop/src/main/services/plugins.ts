/**
 * 最小插件机制（P2 骨架）：扫描 <data>/plugins/*.js，CommonJS 导出元数据与可选 onStart。
 *
 * 插件约定（示例）：
 *   module.exports = {
 *     name: '我的插件',
 *     version: '0.1.0',
 *     description: '示例插件',
 *     onStart(ctx) { ctx.log('插件已启动'); }
 *   }
 */

import fs from 'fs'
import path from 'path'

export interface PluginInfo {
  name: string
  version: string
  description: string
}

export interface PluginContext {
  /** 插件目录 */
  dir: string
  log: (msg: string) => void
}

export class PluginManager {
  private readonly dir: string
  private readonly loaded: PluginInfo[] = []

  constructor(root: string) {
    this.dir = path.join(root, 'plugins')
    fs.mkdirSync(this.dir, { recursive: true })
  }

  /** 加载全部插件（跳过加载失败的插件并记录警告）。 */
  loadAll(): PluginInfo[] {
    for (const name of fs.readdirSync(this.dir)) {
      if (!name.endsWith('.js')) continue
      try {
        // 运行时按绝对路径加载（打包后仍可用，CJS require 支持任意路径）
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(path.join(this.dir, name)) as {
          name?: string
          version?: string
          description?: string
          onStart?: (ctx: PluginContext) => void
        }
        const info: PluginInfo = {
          name: mod.name ?? name.replace(/\.js$/, ''),
          version: mod.version ?? '0.0.0',
          description: mod.description ?? ''
        }
        if (typeof mod.onStart === 'function') {
          mod.onStart({
            dir: this.dir,
            log: (msg) => console.log(`[plugin:${info.name}] ${msg}`)
          })
        }
        this.loaded.push(info)
      } catch (err) {
        console.warn(`[plugin] 加载失败 ${name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return this.list()
  }

  list(): PluginInfo[] {
    return [...this.loaded]
  }
}
