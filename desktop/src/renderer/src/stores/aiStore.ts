import { create } from 'zustand'
import { streamChat } from '../lib/ai/openaiCompat'
import { loadAIConfig, saveAIConfig } from '../lib/ai/registry'
import type { AIConfig, ChatMessage } from '../lib/ai/types'
import { useEditorStore } from './editorStore'
import { useAppStore } from './appStore'
import { retrieveKnowledge } from '../lib/retrieval'
import { resolveExtractSeqs, type ExtractScope } from '../lib/outline/extractScope'
import { assembleBookContent, type ChatScopeRef } from '../lib/outline/chatScope'
import type { OutlineExtractProgress, OutlineExtractResult } from '@shared/types'

const POLISH_SYSTEM =
  '你是资深中文网文编辑。对用户提供的段落进行润色：保持情节、人物设定与视角不变，优化文笔、节奏与画面感。直接输出润色后的正文，不要添加任何解释或前后缀。'
const REWRITE_SYSTEM =
  '你是资深中文网文编辑。对用户提供的段落进行改写：调整句式、表达方式与用词，使文笔更精炼生动、层次更分明，但保持情节、人物设定与视角完全不变。直接输出改写后的正文，不要添加任何解释。'
const CONTINUE_SYSTEM =
  '你是中文网文续写引擎。基于用户提供的前文，以相同的人称、风格与节奏续写后续内容，自然衔接。直接输出续写正文，不要添加任何解释。'
const TRANSLATE_SYSTEM =
  '你是专业文学译者。将用户提供的文本译为另一种语言（中文段落译为英文，英文段落译为中文），保持网文语感与叙事节奏，专有名词保留音译。直接输出译文，不要添加任何解释。'
const SUMMARY_SYSTEM =
  '你是资深中文网文编辑。用 3-5 句话总结用户提供文本的要点（情节进展、关键信息、伏笔与线索），简明清晰。直接输出总结，不要添加任何解释。'
const CHAT_SYSTEM =
  '你是「续言 Continuum」内置的网文写作助手，熟悉中文网文创作、人设与剧情结构。回答简洁、实用，可直接引用正文中的设定。'

/** 写作工具（A3）：选区润色 / 改写 / 光标续写 / 选区翻译 / 选区总结。 */
export type ToolKind = 'polish' | 'rewrite' | 'continue' | 'translate' | 'summary'

const TOOL_SYSTEM: Record<ToolKind, string> = {
  polish: POLISH_SYSTEM,
  rewrite: REWRITE_SYSTEM,
  continue: CONTINUE_SYSTEM,
  translate: TRANSLATE_SYSTEM,
  summary: SUMMARY_SYSTEM
}

interface AiState {
  config: AIConfig
  configLoaded: boolean
  chatMessages: ChatMessage[]
  streaming: boolean
  chatError: string | null
  tool: ToolKind | null
  toolOriginal: string
  toolRange: { from: number; to: number } | null
  toolResult: string
  toolError: string | null
  /** 写作工具是否生成中（Diff 浮窗展示进度用） */
  toolStreaming: boolean
  abortRef: AbortController | null

  /** 智能章纲提取（AI「提取」Tab） */
  extractScope: ExtractScope
  extractCustom: number[]
  extractRunning: boolean
  extractProgress: OutlineExtractProgress | null
  extractResult: OutlineExtractResult | null
  extractError: string | null
  /** AI 配额（今日已用 / 总额度） */
  quota: { used: number; budget: number } | null

  /** 问答知识库来源：rag（RAG 检索注入）/ book（本书内容） */
  chatSource: 'rag' | 'book'
  /** 问答显式引用（大纲节点 / 章节） */
  chatRefs: ChatScopeRef[]
  /** 透明 AI：最近一次请求实际注入的上下文来源说明 */
  lastInjected: string | null

  loadConfig: () => Promise<void>
  saveConfig: (cfg: AIConfig) => Promise<boolean>
  sendChat: (text: string, withContext: boolean, withKnowledge?: boolean) => Promise<void>
  stopStream: () => void
  runPolish: () => Promise<void>
  runRewrite: () => Promise<void>
  runContinue: () => Promise<void>
  runTranslate: () => Promise<void>
  runSummary: () => Promise<void>
  /** 内部统一工具执行入口（润色/改写/续写/翻译）。 */
  runTool: (kind: ToolKind) => Promise<void>
  applyToolResult: () => void
  clearTool: () => void
  /** 清空对话（A4 二次确认后调用）。 */
  clearChat: () => void
  /** 将最后一条 AI 回复插入编辑器光标处（气泡操作行）。返回是否成功。 */
  insertAssistantToEditor: () => boolean
  /** 重新生成最后一条回复（气泡操作行）。 */
  regenerateLast: () => Promise<void>

  setExtractScope: (s: ExtractScope) => void
  setExtractCustom: (seqs: number[]) => void
  loadQuota: () => Promise<void>
  runExtract: () => Promise<void>
  setChatSource: (v: 'rag' | 'book') => void
  addChatRef: (ref: ChatScopeRef) => void
  removeChatRef: (id: string) => void
}

/** AI 编排层：统一配置 + 对话流式 + 四种写作工具（供面板与快捷键共用）。 */
export const useAiStore = create<AiState>((set, get) => ({
  config: {
    provider: 'deepseek',
    apiFormat: 'openai',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    temperature: 0.7,
    embeddingModel: ''
  },
  configLoaded: false,
  chatMessages: [],
  streaming: false,
  chatError: null,
  tool: null,
  toolOriginal: '',
  toolRange: null,
  toolResult: '',
  toolError: null,
  toolStreaming: false,
  abortRef: null,
  extractScope: 'current',
  extractCustom: [],
  extractRunning: false,
  extractProgress: null,
  extractResult: null,
  extractError: null,
  quota: null,
  chatSource: 'rag',
  chatRefs: [],
  lastInjected: null,

  loadConfig: async () => {
    const config = await loadAIConfig()
    set({ config, configLoaded: true })
  },

  saveConfig: async (cfg) => {
    const ok = await saveAIConfig(cfg)
    if (ok) set({ config: cfg })
    return ok
  },

  sendChat: async (text, withContext, withKnowledge = false) => {
    const { config, chatMessages, streaming, abortRef } = get()
    if (streaming || abortRef || !text.trim()) return
    const userMsg: ChatMessage = { role: 'user', content: text }

    let promptContent = text
    if (withContext) {
      const chapter = useAppStore.getState().currentChapter
      const content = useAppStore.getState().chapterContent
      const ctx = chapter ? `当前章节：《${chapter.title}》\n${content.slice(0, 3000)}` : ''
      if (ctx) promptContent = `${ctx}\n\n${text}`
    }

    // 自动注入知识库上下文（章节正文 + 角色/设定/伏笔/素材，或「本书内容」）
    let systemContent = CHAT_SYSTEM
    if (withKnowledge) {
      const { chatSource, chatRefs } = get()
      if (chatSource === 'book') {
        const app = useAppStore.getState()
        const ctx = await assembleBookContent({
          workId: app.currentWorkId,
          outlineNodes: app.outlineNodes,
          chapterOutlines: app.chapterOutlines,
          notes: app.notes,
          refs: chatRefs
        })
        if (ctx.content) {
          systemContent += `\n\n【本书内容参考（回答创作问题时可参考，不必逐条引用）】\n${ctx.content}`
          set({ lastInjected: ctx.sourceSummary })
        }
      } else {
        const ctx = await retrieveKnowledge(text)
        if (ctx) {
          systemContent += `\n\n【作品知识库参考片段（回答时可参考，不必逐条引用）】\n${ctx}`
          set({ lastInjected: '知识库参考片段（RAG）' })
        }
      }
    }

    // 请求载荷：系统提示 + 历史对话 + 本次提问（历史不含本轮新增消息）
    const payload: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...chatMessages,
      { role: 'user', content: promptContent }
    ]

    set({ chatMessages: [...chatMessages, userMsg], chatError: null, streaming: true })
    const assistant: ChatMessage = { role: 'assistant', content: '' }
    set({ chatMessages: [...get().chatMessages, assistant] })
    const abort = new AbortController()
    set({ abortRef: abort })

    const append = (patch: Partial<ChatMessage>): void => {
      const list = get().chatMessages
      set({ chatMessages: [...list.slice(0, -1), { ...list[list.length - 1], ...patch }] })
    }

    try {
      const full = await streamChat(config, payload, {
        signal: abort.signal,
        onDelta: (d) => {
          const list = get().chatMessages
          append({ content: list[list.length - 1].content + d })
        }
      })
      append({ content: full })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (abort.signal.aborted) {
        append({ content: (get().chatMessages[get().chatMessages.length - 1].content || '') + '（已停止）' })
      } else {
        append({ content: `（发生错误：${msg}）` })
      }
      set({ chatError: msg })
    } finally {
      set({ streaming: false, abortRef: null })
    }
  },

  stopStream: () => {
    get().abortRef?.abort()
  },

  runPolish: () => get().runTool('polish'),
  runRewrite: () => get().runTool('rewrite'),
  runContinue: () => get().runTool('continue'),
  runTranslate: () => get().runTool('translate'),
  runSummary: () => get().runTool('summary'),

  runTool: async (kind) => {
    const { config, tool, abortRef } = get()
    if (tool || abortRef) return
    const editor = useEditorStore.getState().editor
    if (!editor) return
    const { from, to } = editor.state.selection

    let original: string
    if (kind === 'continue') {
      const before = editor.state.doc.textBetween(0, from, '\n')
      const tail = before.slice(-2000)
      if (!tail.trim()) {
        set({ toolError: '光标前没有可续写的内容' })
        return
      }
      original = tail.slice(-400)
      set({ tool: kind, toolOriginal: original, toolRange: { from, to: from }, toolResult: '', toolError: null })
    } else {
      if (from === to) {
        const action = { translate: '翻译', rewrite: '改写', summary: '总结', polish: '润色' }[kind]
        set({ toolError: `请先在正文中选中要${action}的文本` })
        return
      }
      original = editor.state.doc.textBetween(from, to, '\n')
      if (!original.trim()) return
      set({ tool: kind, toolOriginal: original, toolRange: { from, to }, toolResult: '', toolError: null })
    }

    const abort = new AbortController()
    set({ abortRef: abort, toolStreaming: true })
    try {
      const full = await streamChat(
        config,
        [
          { role: 'system', content: TOOL_SYSTEM[kind] },
          { role: 'user', content: original }
        ],
        { signal: abort.signal, onDelta: (d) => set({ toolResult: get().toolResult + d }) }
      )
      set({ toolResult: full })
    } catch (err) {
      if (!abort.signal.aborted) {
        set({ toolError: err instanceof Error ? err.message : String(err) })
      }
    } finally {
      set({ abortRef: null, toolStreaming: false })
    }
  },

  applyToolResult: () => {
    const { tool, toolResult, toolRange } = get()
    const editor = useEditorStore.getState().editor
    if (!editor || !tool || !toolRange || !toolResult.trim()) return
    if (tool === 'continue') {
      editor.chain().focus().insertContentAt(toolRange.to, `\n\n${toolResult.trim()}`).run()
    } else {
      editor.chain().focus().deleteRange(toolRange).insertContent(toolResult.trim()).run()
    }
    set({ tool: null, toolOriginal: '', toolRange: null, toolResult: '', toolError: null })
  },

  clearTool: () => {
    get().abortRef?.abort()
    set({ tool: null, toolOriginal: '', toolRange: null, toolResult: '', toolError: null, toolStreaming: false, abortRef: null })
  },

  clearChat: () => set({ chatMessages: [], chatError: null }),

  insertAssistantToEditor: () => {
    const { chatMessages } = get()
    const editor = useEditorStore.getState().editor
    const last = [...chatMessages].reverse().find((m) => m.role === 'assistant')
    if (!editor || !last || !last.content.trim()) return false
    const { from } = editor.state.selection
    editor.chain().focus().insertContentAt(from, `\n\n${last.content.trim()}`).run()
    return true
  },

  regenerateLast: async () => {
    const { chatMessages, streaming } = get()
    if (streaming || chatMessages.length < 2) return
    const last = chatMessages[chatMessages.length - 1]
    const prev = chatMessages[chatMessages.length - 2]
    if (last.role !== 'assistant' || prev.role !== 'user') return
    const prompt = prev.content
    set({ chatMessages: chatMessages.slice(0, -2) })
    await get().sendChat(prompt, true, true)
  },

  // ============================================================ 智能章纲提取
  setExtractScope: (s) => set({ extractScope: s }),
  setExtractCustom: (seqs) => set({ extractCustom: seqs }),

  loadQuota: async () => {
    try {
      const quota = await window.api.quota.get()
      set({ quota: { used: quota.used, budget: quota.budget } })
    } catch {
      set({ quota: null })
    }
  },

  runExtract: async () => {
    const { extractScope, extractCustom, extractRunning } = get()
    if (extractRunning) return
    const app = useAppStore.getState()
    const { seqs, error } = resolveExtractSeqs(app.chapters, app.currentChapter?.seq ?? null, extractScope, extractCustom)
    if (error) {
      set({ extractError: error, extractResult: null })
      return
    }
    if (!app.currentWorkId) return
    const unsubscribe = window.api.chapterOutlines.onExtractProgress((p) => {
      set({ extractProgress: p })
    })
    set({ extractRunning: true, extractProgress: null, extractResult: null, extractError: null })
    try {
      const result = await window.api.chapterOutlines.extract({ workId: app.currentWorkId, seqs })
      set({ extractResult: result })
      if (result.success.length > 0) {
        await app.loadChapterOutlines()
      }
      if (result.failed.length > 0 && result.success.length === 0) {
        set({ extractError: result.failed[0]?.reason ?? '提取失败' })
      }
      await get().loadQuota()
    } catch (err) {
      set({ extractError: err instanceof Error ? err.message : String(err) })
    } finally {
      unsubscribe()
      set({ extractRunning: false, extractProgress: null })
    }
  },

  setChatSource: (v) => set({ chatSource: v }),
  addChatRef: (ref) => {
    const { chatRefs } = get()
    if (chatRefs.some((r) => r.id === ref.id && r.kind === ref.kind)) return
    set({ chatRefs: [...chatRefs, ref] })
  },
  removeChatRef: (id) => set({ chatRefs: get().chatRefs.filter((r) => r.id !== id) })
}))
