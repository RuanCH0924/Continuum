import React from 'react'
import { useToastStore } from '../stores/toastStore'
import type { ToastKind } from '../stores/toastStore'

const KIND_STYLE: Record<ToastKind, string> = {
  info: 'border-neutral-200 bg-neutral-0 text-neutral-900',
  success: 'border-status-success/40 bg-status-success/10 text-status-success',
  warning: 'border-status-warning/40 bg-status-warning/10 text-status-warning',
  error: 'border-status-danger/40 bg-status-danger/10 text-status-danger'
}

/** 全局 Toast 浮层（右下角自动消失，点击即关）。 */
export function ToastViewport(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-12 right-4 z-[70] flex w-[300px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto cursor-pointer rounded-lg border px-3 py-2 text-[12px] leading-[1.6] shadow-2 ${KIND_STYLE[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
