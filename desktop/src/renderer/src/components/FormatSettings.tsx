import React from 'react'
import { useEditorStore, DEFAULT_FORMAT } from '../stores/editorStore'
import { useToastStore } from '../stores/toastStore'

/**
 * 格式设置表单区（A7）：字号 / 行距 / 首行缩进 / 打字机 / 源码行号，持久化到 settings。
 * 供独立格式设置弹窗与设置中心「格式」Tab 复用，保存/恢复逻辑与原实现完全一致。
 */
export function FormatSettingsSection({
  onSaved,
  onCancel
}: {
  onSaved?: () => void
  onCancel?: () => void
}): React.JSX.Element {
  const format = useEditorStore((s) => s.format)
  const setFormat = useEditorStore((s) => s.setFormat)

  const save = async (): Promise<void> => {
    await window.api.settings.set('format', useEditorStore.getState().format)
    useToastStore.getState().notify('success', '格式设置已保存')
    onSaved?.()
  }

  const restore = async (): Promise<void> => {
    setFormat(DEFAULT_FORMAT)
    await window.api.settings.set('format', DEFAULT_FORMAT)
    useToastStore.getState().notify('success', '已恢复默认格式')
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element => (
    <div className="flex items-center justify-between py-2">
      <span className="text-[12px] text-neutral-700">{label}</span>
      {children}
    </div>
  )

  return (
    <>
      <div className="px-5 py-3">
        <Row label={`正文字号（${format.fontSize}%）`}>
          <input
            type="range"
            min={90}
            max={130}
            step={5}
            value={format.fontSize}
            onChange={(e) => setFormat({ fontSize: Number(e.target.value) })}
            className="w-[200px] accent-[var(--brand-500)]"
          />
        </Row>
        <Row label={`行距（${format.lineHeight.toFixed(1)}）`}>
          <input
            type="range"
            min={1.5}
            max={2.2}
            step={0.1}
            value={format.lineHeight}
            onChange={(e) => setFormat({ lineHeight: Number(e.target.value) })}
            className="w-[200px] accent-[var(--brand-500)]"
          />
        </Row>
        <Row label="首行缩进（2em）">
          <input
            type="checkbox"
            checked={format.indent}
            onChange={(e) => setFormat({ indent: e.target.checked })}
            className="accent-[var(--brand-500)]"
          />
        </Row>
        <Row label="打字机模式（光标垂直居中）">
          <input
            type="checkbox"
            checked={format.typewriter}
            onChange={(e) => setFormat({ typewriter: e.target.checked })}
            className="accent-[var(--brand-500)]"
          />
        </Row>
        <Row label="源码模式显示行号">
          <input
            type="checkbox"
            checked={format.lineNumbers}
            onChange={(e) => setFormat({ lineNumbers: e.target.checked })}
            className="accent-[var(--brand-500)]"
          />
        </Row>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3">
        <button className="text-[12px] text-neutral-500 hover:text-brand-500" onClick={() => void restore()}>
          恢复默认
        </button>
        <div className="flex gap-2">
          {onCancel && (
            <button className="btn-default" onClick={onCancel}>
              取消
            </button>
          )}
          <button className="btn-primary" onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </>
  )
}

/** 独立格式设置弹窗（A7；仍可由命令面板等预留入口打开）。 */
export function FormatSettings({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        className="w-[440px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">格式设置</span>
          <span className="ml-2 text-[11px] text-neutral-500">编辑区排版与写作体验</span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={onClose}>
            ✕
          </button>
        </div>
        <FormatSettingsSection onSaved={onClose} onCancel={onClose} />
      </div>
    </div>
  )
}
