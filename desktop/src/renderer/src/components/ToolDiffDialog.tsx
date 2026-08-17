import React from 'react'
import { useAiStore } from '../stores/aiStore'
import { useToastStore } from '../stores/toastStore'

const TOOL_LABEL: Record<string, string> = {
  polish: '润色',
  rewrite: '改写',
  continue: '续写',
  translate: '翻译',
  summary: '总结'
}

/** 写作工具结果浮窗（A2）：原文 vs 结果并排对比，可应用到正文或取消。 */
export function ToolDiffDialog(): React.JSX.Element | null {
  const tool = useAiStore((s) => s.tool)
  const toolOriginal = useAiStore((s) => s.toolOriginal)
  const toolResult = useAiStore((s) => s.toolResult)
  const toolError = useAiStore((s) => s.toolError)
  const toolStreaming = useAiStore((s) => s.toolStreaming)
  const applyToolResult = useAiStore((s) => s.applyToolResult)
  const clearTool = useAiStore((s) => s.clearTool)

  if (!tool) return null
  const label = TOOL_LABEL[tool] ?? '写作工具'

  const apply = (): void => {
    if (!toolResult.trim()) return
    applyToolResult()
    useToastStore.getState().notify('success', `${label}已应用到正文`)
  }

  return (
    <div className="pointer-events-auto fixed bottom-16 right-4 z-50 flex w-[720px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-3">
      <div className="flex items-center border-b border-neutral-200 px-4 py-2.5">
        <span className="text-[13px] font-semibold text-neutral-900">{label}</span>
        <span className="ml-2 text-[11px] text-neutral-500">原文 vs 结果对比</span>
        {toolStreaming && (
          <span className="ml-2 flex items-center gap-1 text-[11px] text-brand-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            生成中…
          </span>
        )}
        <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={clearTool}>
          ✕
        </button>
      </div>

      {toolError && (
        <div className="border-b border-status-danger/30 bg-status-danger/10 px-4 py-2 text-[12px] text-status-danger">
          {toolError}
        </div>
      )}

      <div className="grid max-h-[46vh] grid-cols-2 gap-0 overflow-hidden">
        <div className="min-w-0 overflow-y-auto border-r border-neutral-200 px-4 py-3">
          <div className="mb-1.5 text-[11px] font-medium text-neutral-400">原文</div>
          <pre className="whitespace-pre-wrap text-[12px] leading-[1.7] text-neutral-500">{toolOriginal}</pre>
        </div>
        <div className="min-w-0 overflow-y-auto px-4 py-3">
          <div className="mb-1.5 text-[11px] font-medium text-neutral-400">结果</div>
          {toolResult ? (
            <pre className="whitespace-pre-wrap text-[12px] leading-[1.7] text-neutral-900">{toolResult}</pre>
          ) : (
            <div className="pt-6 text-center text-[12px] text-neutral-300">
              {toolStreaming ? '等待输出…' : '暂无结果'}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-2.5">
        <button className="btn-default" onClick={clearTool} disabled={toolStreaming}>
          取消
        </button>
        <button className="btn-primary" onClick={apply} disabled={toolStreaming || !toolResult.trim()}>
          应用到正文
        </button>
      </div>
    </div>
  )
}
