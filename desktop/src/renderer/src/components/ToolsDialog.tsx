import React, { useEffect, useState } from 'react'
import { useToolsStore } from '../stores/toolsStore'
import { useToastStore } from '../stores/toastStore'
import { useEditorStore } from '../stores/editorStore'
import { useUiStore } from '../stores/uiStore'
import { turndown } from '../lib/markdown'

interface PluginInfo {
  name: string
  version: string
  description: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="border-b border-neutral-200 px-5 py-3.5">
      <h3 className="mb-2 text-[12px] font-semibold text-neutral-900">{title}</h3>
      {children}
    </section>
  )
}

/** 辅助工具（M6）：窗口置顶 / 跨窗口录入 / 剪贴板监听。Coze 与随机生成留待 P2。 */
export function ToolsDialog(): React.JSX.Element {
  const open = useUiStore((s) => s.toolsOpen)
  const setToolsOpen = useUiStore((s) => s.setToolsOpen)
  const topmost = useToolsStore((s) => s.topmost)
  const setTopmost = useToolsStore((s) => s.setTopmost)
  const typer = useToolsStore((s) => s.typer)
  const typerStart = useToolsStore((s) => s.typerStart)
  const typerStop = useToolsStore((s) => s.typerStop)
  const clipEnabled = useToolsStore((s) => s.clipEnabled)
  const setClipEnabled = useToolsStore((s) => s.setClipEnabled)
  const clipHistory = useToolsStore((s) => s.clipHistory)
  const clearClip = useToolsStore((s) => s.clearClip)
  const insertToEditor = useToolsStore((s) => s.insertToEditor)
  const notify = useToastStore((s) => s.notify)

  const [source, setSource] = useState<'chapter' | 'clipboard'>('chapter')
  const [targetTitle, setTargetTitle] = useState('')
  const [fast, setFast] = useState(true)
  const [plugins, setPlugins] = useState<PluginInfo[]>([])

  // 加载已启用插件列表
  useEffect(() => {
    void window.api.plugins.list().then(setPlugins)
  }, [])

  if (!open) return <></>

  const startTyper = async (): Promise<void> => {
    let text = ''
    if (source === 'chapter') {
      const editor = useEditorStore.getState().editor
      if (!editor) {
        notify('warning', '请先打开一个章节')
        return
      }
      text = turndown.turndown(editor.getHTML())
    } else {
      text = await window.api.tools.clipboard.read()
    }
    if (!text.trim()) {
      notify('warning', '没有可录入的内容')
      return
    }
    await typerStart({ text, targetWindowTitle: targetTitle.trim() || undefined, fast })
    notify('info', `已开始${fast ? '快速' : '慢速'}录入，请立即切到目标窗口`)
  }

  const insert = (text: string): void => {
    if (insertToEditor(text)) notify('success', '已插入到光标处')
    else notify('warning', '请先打开一个章节')
  }

  const pct = typer.total > 0 ? Math.round((typer.pos / typer.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onMouseDown={() => setToolsOpen(false)}>
      <div
        className="flex max-h-[85vh] w-[540px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">辅助工具</span>
          <span className="ml-2 text-[11px] text-neutral-500">跨窗口录入 · 剪贴板 · 置顶</span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={() => setToolsOpen(false)}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Section title="窗口置顶">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-neutral-700">
              <input
                type="checkbox"
                checked={topmost}
                onChange={(e) => void setTopmost(e.target.checked)}
                className="accent-[var(--brand-500)]"
              />
              保持窗口置顶（写作时浮在其他应用上方）
            </label>
          </Section>

          <Section title="跨窗口录入">
            <div className="mb-2 flex gap-4 text-[12px]">
              {(['chapter', 'clipboard'] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-1.5 text-neutral-700">
                  <input
                    type="radio"
                    checked={source === s}
                    onChange={() => setSource(s)}
                    className="accent-[var(--brand-500)]"
                  />
                  {s === 'chapter' ? '当前章节' : '剪贴板'}
                </label>
              ))}
            </div>
            <div className="mb-2 flex gap-2">
              <input
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                placeholder="目标窗口标题（留空 = 当前前台窗口）"
                className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[12px] text-neutral-900 outline-none focus:border-brand-500"
              />
              <select
                value={fast ? 'fast' : 'slow'}
                onChange={(e) => setFast(e.target.value === 'fast')}
                className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[12px] text-neutral-900 outline-none"
              >
                <option value="fast">快速（200字/0.5s）</option>
                <option value="slow">慢速（100字/5s）</option>
              </select>
            </div>

            {typer.running ? (
              <div className="mb-2">
                <div className="h-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all duration-base" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
                  <span>{typer.pos} / {typer.total} 字</span>
                  <span>{pct}%</span>
                </div>
              </div>
            ) : (
              <p className="mb-2 text-[11px] text-neutral-400">
                点击开始后立即切换到目标窗口并把光标放到输入位置；可随时停止。
              </p>
            )}

            <div className="flex gap-2">
              {typer.running ? (
                <button className="btn-primary flex-1 !py-1.5 text-[12px]" onClick={() => void typerStop()}>
                  停止录入
                </button>
              ) : (
                <button className="btn-primary flex-1 !py-1.5 text-[12px]" onClick={() => void startTyper()}>
                  开始录入
                </button>
              )}
            </div>
            {typer.error && (
              <div className="mt-2 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-[11px] text-status-danger">
                {typer.error}
              </div>
            )}
          </Section>

          <Section title="剪贴板监听">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-neutral-700">
              <input
                type="checkbox"
                checked={clipEnabled}
                onChange={(e) => void setClipEnabled(e.target.checked)}
                className="accent-[var(--brand-500)]"
              />
              监听剪贴板变化（每秒轮询，最近 20 条）
            </label>
            {clipHistory.length > 0 ? (
              <div className="mt-2">
                <div className="mb-1 flex justify-end">
                  <button className="text-[11px] text-neutral-500 hover:text-neutral-900" onClick={clearClip}>
                    清空
                  </button>
                </div>
                <div className="space-y-1">
                  {clipHistory.map((entry) => (
                    <div
                      key={entry.at}
                      className="group flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5"
                    >
                      <p className="min-w-0 flex-1 truncate text-[12px] text-neutral-700">{entry.text}</p>
                      <button
                        className="shrink-0 text-[11px] text-brand-500 hover:text-brand-300"
                        onClick={() => insert(entry.text)}
                      >
                        插入到光标处
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-neutral-400">
                {clipEnabled ? '等待剪贴板变化…' : '开启监听后，复制的内容会出现在这里'}
              </p>
            )}
          </Section>

          <Section title={`插件（${plugins.length}）`}>
            {plugins.length === 0 ? (
              <p className="text-[11px] text-neutral-400">
                暂无插件。将 `.js` 插件文件放入 <code className="rounded bg-neutral-100 px-1">data/plugins/</code> 目录后重启加载。
              </p>
            ) : (
              <div className="space-y-1">
                {plugins.map((p) => (
                  <div key={p.name} className="rounded-md border border-neutral-200 bg-neutral-0 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-medium text-neutral-900">{p.name}</span>
                      <span className="text-[10px] text-neutral-300">v{p.version}</span>
                    </div>
                    {p.description && <div className="mt-0.5 text-[11px] text-neutral-500">{p.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="更多（P2）">
            <p className="text-[11px] text-neutral-400">
              Coze 润色转写、随机生成等旧辅助工具将在 P2 决策后收敛进本面板。
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
