import React, { useEffect, useRef } from 'react'

/** 通用二次确认弹窗（删除 / 清空等破坏性操作；A4）。 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = '删除',
  onConfirm,
  onCancel
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    okRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onMouseDown={onCancel}>
      <div
        className="w-[380px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">{title}</span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="px-5 py-4 text-[12px] leading-[1.7] text-neutral-700">{message}</div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button className="btn-default" onClick={onCancel}>
            取消
          </button>
          <button
            ref={okRef}
            className="rounded-md border border-status-danger/40 bg-status-danger px-4 py-1.5 text-[12px] font-medium text-white transition-colors duration-fast hover:bg-status-danger/90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
