import React from 'react'
import { SHORTCUTS, formatKeys } from '../lib/hotkeys'
import { useUiStore } from '../stores/uiStore'

/** 快捷键速查卡（帮助按钮 / Ctrl+/ 唤起）。 */
export function ShortcutHelp(): React.JSX.Element {
  const open = useUiStore((s) => s.shortcutOpen)
  const setShortcutOpen = useUiStore((s) => s.setShortcutOpen)

  if (!open) return <></>

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onMouseDown={() => setShortcutOpen(false)}>
      <div
        className="w-[460px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">快捷键</span>
          <span className="ml-2 text-[11px] text-neutral-500">常用快捷键一览</span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={() => setShortcutOpen(false)}>
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {SHORTCUTS.map((s) => (
            <div key={s.keys.join('+')} className="flex items-center justify-between py-[7px]">
              <span className="text-[12px] text-neutral-700">{s.label}</span>
              <kbd className="rounded border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                {formatKeys(s.keys)}
              </kbd>
            </div>
          ))}
        </div>
        <div className="border-t border-neutral-200 px-5 py-3 text-[11px] text-neutral-400">
          完整快捷键列表将在「设置」页可视化呈现
        </div>
      </div>
    </div>
  )
}
