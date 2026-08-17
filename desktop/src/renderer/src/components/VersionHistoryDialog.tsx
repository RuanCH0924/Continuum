import React, { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { useEditorStore } from '../stores/editorStore'
import { useToastStore } from '../stores/toastStore'
import { markdownIt } from '../lib/markdown'
import type { VersionSnapshot } from '@shared/types'

/** 章节历史版本（P2）：手动保存生成的快照列表，可预览并恢复。 */
export function VersionHistoryDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const currentWorkId = useAppStore((s) => s.currentWorkId)
  const currentChapter = useAppStore((s) => s.currentChapter)
  const [versions, setVersions] = useState<VersionSnapshot[]>([])
  const [preview, setPreview] = useState<{ meta: VersionSnapshot; content: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentWorkId || !currentChapter) return
    void window.api.history.list(currentWorkId, currentChapter.seq).then(setVersions)
  }, [currentWorkId, currentChapter])

  if (!currentWorkId || !currentChapter) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
        <div className="rounded-lg border border-neutral-200 bg-neutral-0 px-8 py-6 text-[13px] text-neutral-500 shadow-3">
          请先打开一个章节
        </div>
      </div>
    )
  }

  const showPreview = async (v: VersionSnapshot): Promise<void> => {
    setLoading(true)
    const content = await window.api.history.read(v)
    setPreview({ meta: v, content })
    setLoading(false)
  }

  const restore = async (): Promise<void> => {
    if (!preview) return
    const editor = useEditorStore.getState().editor
    if (!editor) return
    editor.commands.setContent(markdownIt.render(preview.content), { emitUpdate: false })
    await useAppStore.getState().saveChapter(preview.content)
    useToastStore.getState().notify('success', `已恢复 ${fmt(preview.meta.ts)} 的版本`)
    onClose()
  }

  const fmt = (ts: number): string =>
    new Date(ts).toLocaleString('zh-CN', { hour12: false })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        className="flex h-[560px] w-[760px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">历史版本</span>
          <span className="ml-2 text-[11px] text-neutral-500">
            《{currentChapter.title}》 · 手动保存时生成快照（Ctrl+S）
          </span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* 版本列表 */}
          <div className="w-[260px] shrink-0 overflow-y-auto border-r border-neutral-200">
            {versions.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-neutral-300">
                暂无版本
                <div className="mt-1 text-[11px]">按 Ctrl+S 手动保存会生成一份快照</div>
              </div>
            ) : (
              versions.map((v) => (
                <button
                  key={v.ts}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-neutral-100 px-3 py-2.5 text-left transition-colors duration-fast ${
                    preview?.meta.ts === v.ts ? 'bg-brand-50' : 'hover:bg-neutral-50'
                  }`}
                  onClick={() => void showPreview(v)}
                >
                  <span className="text-[12px] font-medium text-neutral-900">{fmt(v.ts)}</span>
                  <span className="text-[11px] text-neutral-400">
                    {v.charCount.toLocaleString('zh-CN')} 字
                    {v.note ? ` · ${v.note}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* 预览区 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
              <span className="text-[11px] text-neutral-400">
                {preview ? `预览：${fmt(preview.meta.ts)}` : '选择左侧版本查看内容'}
              </span>
              {loading && <span className="text-[11px] text-brand-500">读取中…</span>}
              <div className="ml-auto flex gap-2">
                {preview && (
                  <button className="btn-primary !px-3 !py-1 text-[12px]" onClick={() => void restore()}>
                    恢复此版本
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {preview ? (
                <div className="md-prose" dangerouslySetInnerHTML={{ __html: markdownIt.render(preview.content) }} />
              ) : (
                <div className="pt-16 text-center text-[12px] text-neutral-300">选择版本后在此预览</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
