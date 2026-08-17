import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, IconName } from './Icon'
import { useUiStore, THEMES } from '../stores/uiStore'
import { useAiStore } from '../stores/aiStore'
import { useEditorStore } from '../stores/editorStore'
import { saveNow, exportWorkAs } from '../lib/editorActions'

interface Command {
  id: string
  label: string
  hint: string
  icon: IconName
  keywords: string
  run: () => void
}

/** 命令面板（Ctrl+K）：模糊过滤 + 键盘导航 + 最近使用置顶（B 组细节）。 */
const USAGE_KEY = 'command-usage'

function loadUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function touchUsage(id: string): void {
  const u = loadUsage()
  u[id] = (u[id] ?? 0) + 1
  localStorage.setItem(USAGE_KEY, JSON.stringify(u))
}

export function CommandPalette(): React.JSX.Element {
  const open = useUiStore((s) => s.paletteOpen)
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => {
    const ui = useUiStore.getState()
    const ai = useAiStore.getState()
    const close = (): void => ui.setPaletteOpen(false)
    const list: Command[] = [
      { id: 'settings', label: '打开 AI 服务设置', hint: 'API Key / 模型 / 温度', icon: 'settings', keywords: 'ai 设置 模型', run: () => { ui.setSettingsOpen(true); close() } },
      { id: 'tools', label: '打开辅助工具', hint: '录入 / 剪贴板 / 置顶', icon: 'grid', keywords: '工具 转写 剪贴板 置顶 录入', run: () => { ui.setToolsOpen(true); close() } },
      { id: 'palette', label: '打开快捷键速查', hint: '常用快捷键一览', icon: 'command', keywords: '快捷键 帮助 速查', run: () => { ui.setShortcutOpen(true); close() } },
      { id: 'immersive', label: ui.immersed ? '退出沉浸模式' : '进入沉浸模式', hint: 'F11', icon: 'immersive', keywords: '沉浸 全屏 专注', run: () => { ui.toggleImmersive(); close() } },
      { id: 'sidebar', label: ui.sidebarCollapsed ? '展开侧栏' : '折叠侧栏', hint: '', icon: 'book', keywords: '侧栏 折叠', run: () => { ui.toggleSidebar(); close() } },
      { id: 'ai', label: ui.aiCollapsed ? '展开 AI 面板' : '折叠 AI 面板', hint: '', icon: 'sparkle', keywords: 'ai 面板 折叠', run: () => { ui.toggleAi(); close() } },
      { id: 'theme', label: '循环切换主题', hint: 'Ctrl+Alt+T', icon: 'moon', keywords: '主题 皮肤 换肤', run: () => { void ui.cycleTheme(); close() } },
      { id: 'polish', label: '润色选中文本', hint: 'Ctrl+R', icon: 'text', keywords: '润色 改文 优化', run: () => { void ai.runPolish(); close() } },
      { id: 'rewrite', label: '改写选中文本', hint: 'Ctrl+J', icon: 'text', keywords: '改写 调整 表达', run: () => { void ai.runRewrite(); close() } },
      { id: 'continue', label: '从光标处续写', hint: 'Ctrl+Enter', icon: 'code', keywords: '续写 生成 接下文', run: () => { void ai.runContinue(); close() } },
      { id: 'translate', label: '翻译选中文本', hint: 'Ctrl+Shift+T', icon: 'text', keywords: '翻译 中英', run: () => { void ai.runTranslate(); close() } },
      { id: 'kb', label: '知识库检索', hint: 'Ctrl+Shift+K', icon: 'search', keywords: '知识库 检索 搜索 rag', run: () => { ui.setAiTab('kb'); if (ui.aiCollapsed) ui.toggleAi(); close() } },
      { id: 'find', label: '查找 / 替换', hint: 'Ctrl+F', icon: 'search', keywords: '查找 替换 搜索', run: () => { useEditorStore.getState().setFindOpen(true); close() } },
      { id: 'export', label: '导出作品（Markdown）', hint: 'Ctrl+Shift+E', icon: 'check', keywords: '导出 markdown 作品', run: () => { void exportWorkAs('md'); close() } },
      { id: 'format', label: '格式设置', hint: '', icon: 'settings', keywords: '格式 字号 行距 打字机', run: () => { ui.setFormatOpen(true); close() } },
      { id: 'save', label: '立即保存章节', hint: 'Ctrl+S', icon: 'check', keywords: '保存 落盘', run: () => { saveNow(); close() } }
    ]
    for (const t of THEMES) {
      list.push({
        id: `theme-${t.id}`,
        label: `主题：${t.label}`,
        hint: t.desc,
        icon: t.id === 'dark' || t.id === 'sepia-dark' ? 'moon' : 'sun',
        keywords: `主题 ${t.label} ${t.desc}`,
        run: () => { void ui.setTheme(t.id); close() }
      })
    }
    return list
  }, [])

  // 重置状态
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
    }
  }, [open])

  // 最近使用置顶：按使用次数降序（未使用过的保持原顺序）
  const sorted = useMemo(() => {
    const usage = loadUsage()
    return [...commands].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0))
  }, [commands, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q))
  }, [sorted, query])

  const run = (c: Command): void => {
    touchUsage(c.id)
    c.run()
  }
  const onRunActive = (): void => {
    const c = filtered[Math.min(active, filtered.length - 1)]
    if (c) run(c)
  }

  if (!open) return <></>

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 pt-[14vh]" onMouseDown={() => setPaletteOpen(false)}>
      <div
        className="w-[560px] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3">
          <Icon name="search" size={16} className="text-neutral-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                onRunActive()
              } else if (e.key === 'Escape') {
                setPaletteOpen(false)
              }
            }}
            placeholder="输入命令或搜索…"
            className="h-[42px] flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-300"
          />
          <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 text-[10px] text-neutral-500">Esc</kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-neutral-300">未找到匹配的命令</div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(c)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-fast ${
                i === active ? 'bg-brand-50 text-brand-500' : 'text-neutral-900'
              }`}
            >
              <Icon name={c.icon} size={16} className={i === active ? 'text-brand-500' : 'text-neutral-500'} />
              <span className="flex-1 truncate text-[13px]">{c.label}</span>
              {c.hint && <span className="shrink-0 text-[11px] text-neutral-300">{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
