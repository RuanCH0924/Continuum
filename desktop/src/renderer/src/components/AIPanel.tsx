import React, { useEffect, useRef, useState } from 'react'
import { Icon, IconName } from './Icon'
import { KnowledgeBaseTab } from './KnowledgeBaseTab'
import { ConfirmDialog } from './ConfirmDialog'
import { useAiStore } from '../stores/aiStore'
import { useUiStore, type AiTabId } from '../stores/uiStore'
import { useToastStore } from '../stores/toastStore'
import { PROVIDER_PRESETS } from '../lib/ai/registry'

type AITab = AiTabId

const AI_TABS: { key: AITab; label: string; icon: IconName }[] = [
  { key: 'chat', label: '对话', icon: 'sparkle' },
  { key: 'polish', label: '润色', icon: 'text' },
  { key: 'continue', label: '续写', icon: 'code' },
  { key: 'kb', label: '知识库', icon: 'search' }
]

/** 润色 Tab 内的全部选区工具（A3：润色/改写/翻译/总结）。 */
const TOOL_BUTTONS: { kind: 'polish' | 'rewrite' | 'translate' | 'summary'; label: string; hint: string }[] = [
  { kind: 'polish', label: '润色', hint: 'Ctrl+R' },
  { kind: 'rewrite', label: '改写', hint: 'Ctrl+J' },
  { kind: 'translate', label: '翻译', hint: 'Ctrl+Shift+T' },
  { kind: 'summary', label: '总结', hint: '' }
]

/** 右侧 AI 面板：对话流式 + 写作工具（润色/改写/续写/翻译/总结）+ 知识库检索。 */
export function AIPanel({
  collapsed,
  onToggleCollapse
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}): React.JSX.Element {
  const [input, setInput] = useState('')
  const [withContext, setWithContext] = useState(true)
  const [withKnowledge, setWithKnowledge] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)
  const aiTab = useUiStore((s) => s.aiTab)
  const setAiTab = useUiStore((s) => s.setAiTab)
  const tab = aiTab
  const setTab = setAiTab

  const config = useAiStore((s) => s.config)
  const loadConfig = useAiStore((s) => s.loadConfig)
  const saveConfig = useAiStore((s) => s.saveConfig)
  const chatMessages = useAiStore((s) => s.chatMessages)
  const streaming = useAiStore((s) => s.streaming)
  const chatError = useAiStore((s) => s.chatError)
  const tool = useAiStore((s) => s.tool)
  const toolOriginal = useAiStore((s) => s.toolOriginal)
  const toolResult = useAiStore((s) => s.toolResult)
  const toolError = useAiStore((s) => s.toolError)
  const sendChat = useAiStore((s) => s.sendChat)
  const stopStream = useAiStore((s) => s.stopStream)
  const runPolish = useAiStore((s) => s.runPolish)
  const runRewrite = useAiStore((s) => s.runRewrite)
  const runContinue = useAiStore((s) => s.runContinue)
  const runTranslate = useAiStore((s) => s.runTranslate)
  const runSummary = useAiStore((s) => s.runSummary)
  const applyToolResult = useAiStore((s) => s.applyToolResult)
  const clearTool = useAiStore((s) => s.clearTool)
  const clearChat = useAiStore((s) => s.clearChat)
  const insertAssistantToEditor = useAiStore((s) => s.insertAssistantToEditor)
  const regenerateLast = useAiStore((s) => s.regenerateLast)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  // 新消息自动滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chatMessages, toolResult])

  const send = (): void => {
    if (!input.trim() || streaming) return
    void sendChat(input.trim(), withContext, withKnowledge)
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const copyLast = (): void => {
    const last = [...chatMessages].reverse().find((m) => m.role === 'assistant')
    if (last?.content) {
      void navigator.clipboard.writeText(last.content)
      useToastStore.getState().notify('success', '已复制回复')
    }
  }

  // 模型下拉：预设模型 + 当前自定义模型
  const modelOptions = [...new Set([config.model, ...PROVIDER_PRESETS.map((p) => p.model)])]

  if (collapsed) {
    return (
      <aside className="flex h-full w-full shrink-0 flex-col items-center gap-1 border-l border-neutral-200 bg-neutral-50 pt-2">
        {AI_TABS.map((t) => (
          <button
            key={t.key}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded-md text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-900 ${
              tab === t.key ? 'bg-brand-50 text-brand-500' : ''
            }`}
            title={t.label}
            onClick={() => {
              setTab(t.key)
              onToggleCollapse()
            }}
          >
            <Icon name={t.icon} size={18} />
          </button>
        ))}
      </aside>
    )
  }

  const renderChat = (): React.JSX.Element => (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 text-[12px]">
        {chatMessages.length === 0 && !streaming ? (
          <div className="pt-8 text-center text-neutral-300">
            和 AI 助手聊聊大纲、人设或剧情走向
            <div className="mt-1 text-[11px]">开启「附带上文 / 注入知识库」可结合作品上下文回答</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chatMessages.map((m, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div
                  className={`max-w-[86%] whitespace-pre-wrap rounded-lg px-3 py-2 leading-[1.7] ${
                    m.role === 'user'
                      ? 'self-end rounded-tr-sm bg-brand-500 text-white'
                      : 'self-start rounded-tl-sm border border-neutral-200 bg-neutral-0 text-neutral-900'
                  } ${m.content === '' && streaming ? 'opacity-70' : ''}`}
                >
                  {m.content || (streaming ? '思考中…' : '')}
                </div>
                {/* 气泡操作行（B 组细节）：插入到光标 / 复制 / 重新生成 */}
                {m.role === 'assistant' && !streaming && m.content && (
                  <div className="self-start flex items-center gap-1 pl-1">
                    <button
                      className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-brand-500"
                      onClick={() => {
                        if (insertAssistantToEditor()) {
                          useToastStore.getState().notify('success', '已插入到光标处')
                        } else {
                          useToastStore.getState().notify('warning', '请先打开一个章节')
                        }
                      }}
                    >
                      插入到光标
                    </button>
                    <button
                      className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-brand-500"
                      onClick={copyLast}
                    >
                      复制
                    </button>
                    <button
                      className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-brand-500"
                      onClick={() => void regenerateLast()}
                    >
                      重新生成
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {chatError && <div className="mt-2 text-center text-[11px] text-status-danger">{chatError}</div>}
      </div>

      <div className="border-t border-neutral-200 p-3">
        <div className="flex items-end gap-2 rounded-lg border border-neutral-200 bg-neutral-0 px-2 py-1.5">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-[96px] flex-1 resize-none bg-transparent text-[12px] text-neutral-900 outline-none"
            placeholder="和 AI 助手对话…"
          />
          {streaming ? (
            <button
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors duration-fast hover:bg-neutral-200"
              title="停止生成"
              onClick={stopStream}
            >
              <Icon name="close" size={14} />
            </button>
          ) : (
            <button
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors duration-fast hover:bg-brand-300"
              title="发送"
              onClick={send}
            >
              <Icon name="send" size={15} />
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-300">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={withContext}
                onChange={(e) => setWithContext(e.target.checked)}
                className="accent-[var(--brand-500)]"
              />
              附带上文
            </label>
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={withKnowledge}
                onChange={(e) => setWithKnowledge(e.target.checked)}
                className="accent-[var(--brand-500)]"
              />
              注入知识库
            </label>
            {chatMessages.length > 0 && (
              <button
                className="text-neutral-400 transition-colors duration-fast hover:text-status-danger"
                title="清空对话"
                onClick={() => setConfirmClear(true)}
              >
                清空
              </button>
            )}
          </div>
          <span>Enter 发送 · Shift+Enter 换行</span>
        </div>
        {/* 透明 AI：注入说明（B 组细节） */}
        {(withContext || withKnowledge) && (
          <div className="mt-1.5 rounded-md bg-neutral-100 px-2 py-1 text-[10px] leading-[1.6] text-neutral-400">
            本次请求将注入：
            {withContext && <span className="ml-1 text-brand-500">当前章节</span>}
            {withContext && withKnowledge && <span> + </span>}
            {withKnowledge && <span className="text-brand-500">知识库参考片段（RAG）</span>}
          </div>
        )}
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="清空对话"
          message="确定要清空当前全部对话记录吗？此操作不可恢复。"
          confirmLabel="清空"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearChat()
            setConfirmClear(false)
          }}
        />
      )}
    </div>
  )

  const renderToolTab = (kind: 'polish' | 'continue'): React.JSX.Element => {
    const running = tool !== null
    const title = kind === 'polish' ? '选区写作工具' : '从光标处续写'
    const desc =
      kind === 'polish'
        ? '选中正文段落，选择润色 / 改写 / 翻译 / 总结，AI 结果可对比后应用'
        : '以光标处为断点，AI 依前文风格自然续写后续内容'
    const originalLabel = kind === 'polish' ? '原文' : '前文片段'
    return (
      <div className="flex h-full min-h-0 flex-col p-3">
        <div className="rounded-md border border-neutral-200 bg-neutral-0 px-3 py-2 text-[12px] text-neutral-500">
          {desc}
          <div className="mt-1 text-[11px] text-neutral-300">快捷键在正文任意位置可用</div>
        </div>

        {kind === 'polish' ? (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {TOOL_BUTTONS.map((b) => (
              <button
                key={b.kind}
                className="btn-default !px-1 !py-1.5 text-[12px]"
                disabled={running}
                title={b.hint}
                onClick={() => {
                  if (b.kind === 'polish') void runPolish()
                  else if (b.kind === 'rewrite') void runRewrite()
                  else if (b.kind === 'translate') void runTranslate()
                  else void runSummary()
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        ) : (
          <button className="btn-primary mt-3 w-full" disabled={running} onClick={() => void runContinue()}>
            {running ? '生成中…' : title}
          </button>
        )}

        {running && toolResult === '' && toolError === null && (
          <div className="mt-3 text-[11px] text-neutral-300">正在请求模型…</div>
        )}
        {toolError && (
          <div className="mt-3 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-[11px] text-status-danger">
            {toolError}
          </div>
        )}

        {(running || toolResult) && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            <div className="shrink-0">
              <div className="mb-1 text-[11px] text-neutral-400">{originalLabel}</div>
              <div className="max-h-[120px] overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-100 px-3 py-2 text-[12px] leading-[1.7] text-neutral-500">
                {kind === 'polish' ? toolOriginal : `…${toolOriginal}`}
              </div>
            </div>
            <div className="min-h-[40%] flex-1">
              <div className="mb-1 text-[11px] text-neutral-400">
                结果{running && <span className="ml-1 text-brand-500">●</span>}
              </div>
              <div className="min-h-[80px] whitespace-pre-wrap rounded-md border border-brand-500/30 bg-brand-50/40 px-3 py-2 text-[12px] leading-[1.7] text-neutral-900">
                {toolResult || '等待输出…'}
              </div>
            </div>
          </div>
        )}

        {(running || toolResult) && (
          <div className="mt-3 flex justify-end gap-2 border-t border-neutral-200 pt-2">
            <button className="btn-default !px-3 !py-1 text-[12px]" onClick={clearTool} disabled={!running}>
              取消
            </button>
            <button
              className="btn-primary !px-3 !py-1 text-[12px]"
              onClick={applyToolResult}
              disabled={running || !toolResult.trim()}
            >
              {kind === 'polish' ? '替换原文' : '插入到光标处'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderKb = (): React.JSX.Element => <KnowledgeBaseTab />

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-neutral-200 bg-neutral-50">
      {/* 配置行（B 组细节）：模型下拉 / 设置 / 折叠 */}
      <div className="flex items-center gap-1.5 border-b border-neutral-200 px-3 py-2 text-[11px] text-neutral-500">
        <span>模型</span>
        <select
          value={config.model}
          onChange={(e) => {
            void saveConfig({ ...config, model: e.target.value })
            useToastStore.getState().notify('success', `已切换模型：${e.target.value}`)
          }}
          className="flex-1 truncate rounded-sm border border-neutral-200 bg-neutral-0 px-1 py-0.5 text-[11px] text-neutral-900 outline-none"
        >
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          className="rounded px-1 text-[12px] text-neutral-500 hover:bg-neutral-100"
          title="AI 服务设置"
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" size={14} />
        </button>
        <button
          className="rounded px-1 text-[12px] text-neutral-500 hover:bg-neutral-100"
          title="折叠 AI 面板"
          onClick={onToggleCollapse}
        >
          ›
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-0.5 px-2 pt-1">
        {AI_TABS.map((t) => (
          <button
            key={t.key}
            className={`relative flex h-[30px] flex-1 items-center justify-center gap-1 rounded-t-md text-[12px] transition-colors duration-fast ${
              tab === t.key
                ? 'bg-neutral-0 font-medium text-brand-500'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
            {tab === t.key && (
              <span className="absolute inset-x-[20%] -bottom-px h-[2px] rounded-t bg-brand-500" />
            )}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="min-h-0 flex-1">
        {tab === 'chat' && renderChat()}
        {tab === 'polish' && renderToolTab('polish')}
        {tab === 'continue' && renderToolTab('continue')}
        {tab === 'kb' && renderKb()}
      </div>
    </aside>
  )
}
