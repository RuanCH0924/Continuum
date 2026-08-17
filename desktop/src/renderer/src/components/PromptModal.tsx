import React, { useEffect, useRef, useState } from 'react'

/** 简单标题输入弹窗（新建 / 重命名作品、章节；后续替换为完整向导）。 */
export function PromptModal({
  title,
  placeholder,
  initialValue = '',
  onConfirm,
  onCancel
}: {
  title: string
  placeholder: string
  initialValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    if (value.trim()) onConfirm(value.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[400px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3">
        <div className="border-b border-neutral-200 px-5 py-3 text-[14px] font-semibold text-neutral-900">
          {title}
        </div>
        <div className="px-5 py-4">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder={placeholder}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button className="btn-default" onClick={onCancel}>
            取消
          </button>
          <button className="btn-primary" disabled={!value.trim()} onClick={submit}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
