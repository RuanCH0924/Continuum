import { useEffect } from 'react'

export interface ShortcutDef {
  id: string
  /** 组合键，如 ['ctrl','k']；修饰符 ctrl/shift/alt，其余为 key 的 toLowerCase() */
  keys: string[]
  label: string
  /** 输入框/编辑区聚焦时是否仍生效（默认仅当不在输入中） */
  allowInInput?: boolean
  run: () => void
}

function matchShortcut(e: KeyboardEvent, keys: string[]): boolean {
  if (keys.length === 0) return false
  const key = e.key.toLowerCase()
  let hasModifier = false
  for (const k of keys) {
    if (k === 'ctrl') {
      if (!(e.ctrlKey || e.metaKey)) return false
      hasModifier = true
    } else if (k === 'shift') {
      if (!e.shiftKey) return false
      hasModifier = true
    } else if (k === 'alt') {
      if (!e.altKey) return false
      hasModifier = true
    } else if (k === 'f11') {
      if (key !== 'f11') return false
    } else if (key !== k) {
      return false
    }
  }
  // 无修饰符的纯字母快捷键不在此注册（避免误触输入）
  return hasModifier || key === 'f11' || keys.some((k) => k === 'escape' || k === 'enter')
}

export function createKeyMatcher(keys: string[]): (e: KeyboardEvent) => boolean {
  return (e) => matchShortcut(e, keys)
}

/** 全局快捷键注册（渲染层）。每个快捷键在捕获后 preventDefault，支持 Esc/Enter 等无修饰键。 */
export function useGlobalHotkeys(defs: ShortcutDef[]): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const inInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      for (const d of defs) {
        if (!matchShortcut(e, d.keys)) continue
        if (inInput && !d.allowInInput) continue
        e.preventDefault()
        d.run()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [defs])
}

/** 快捷键速查卡数据（M5 常用集 + 本轮扩展；完整列表进入设置页可视化） */
export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['ctrl', 'k'], label: '命令面板' },
  { keys: ['ctrl', '/'], label: '快捷键速查' },
  { keys: ['ctrl', 'alt', 't'], label: '循环切换主题' },
  { keys: ['f11'], label: '沉浸模式' },
  { keys: ['ctrl', '\\'], label: '切换编辑模式（编辑 / 预览）' },
  { keys: ['ctrl', 'r'], label: '润色选中文本' },
  { keys: ['ctrl', 'j'], label: '改写选中文本' },
  { keys: ['ctrl', 'enter'], label: '从光标处续写' },
  { keys: ['ctrl', 'shift', 't'], label: '翻译选中文本' },
  { keys: ['ctrl', 'shift', 'k'], label: '知识库检索' },
  { keys: ['ctrl', 'shift', 'a'], label: 'AI 面板开关' },
  { keys: ['ctrl', 'f'], label: '查找 / 替换' },
  { keys: ['ctrl', 'shift', 'f'], label: '全局全文搜索' },
  { keys: ['ctrl', 'shift', 'e'], label: '导出作品（Markdown）' },
  { keys: ['ctrl', 'shift', 'n'], label: '通知中心' },
  { keys: ['ctrl', ','], label: 'AI 服务设置' },
  { keys: ['ctrl', 's'], label: '立即保存章节' },
  { keys: ['ctrl', 'z'], label: '撤销' },
  { keys: ['ctrl', 'y'], label: '重做' },
  { keys: ['ctrl', 'b'], label: '加粗' },
  { keys: ['ctrl', 'i'], label: '斜体' },
  { keys: ['ctrl', 'u'], label: '下划线' },
  { keys: ['ctrl', 'alt', '1'], label: '一级标题' },
  { keys: ['ctrl', 'alt', '2'], label: '二级标题' },
  { keys: ['ctrl', 'alt', '3'], label: '三级标题' },
  { keys: ['ctrl', 'g'], label: '唤起主窗口（全局）' }
]

export function formatKeys(keys: string[]): string {
  const map: Record<string, string> = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', enter: 'Enter', escape: 'Esc' }
  return keys.map((k) => map[k] ?? k.toUpperCase()).join(' + ')
}
