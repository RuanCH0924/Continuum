import { create } from 'zustand'
import type { ClipboardEntry, TyperOptions, TyperState } from '@shared/types'
import { useEditorStore } from './editorStore'

interface ToolsState {
  topmost: boolean
  typer: TyperState
  clipEnabled: boolean
  clipHistory: ClipboardEntry[]

  setTopmost: (v: boolean) => Promise<void>
  typerStart: (opts: TyperOptions) => Promise<void>
  typerStop: () => Promise<void>
  setClipEnabled: (v: boolean) => Promise<void>
  clearClip: () => void
  insertToEditor: (text: string) => boolean
  subscribe: () => () => void
}

/** 辅助工具状态（M6）：窗口置顶 / 跨窗口录入进度 / 剪贴板历史。 */
export const useToolsStore = create<ToolsState>((set, get) => ({
  topmost: false,
  typer: { running: false, pos: 0, total: 0, error: null },
  clipEnabled: false,
  clipHistory: [],

  setTopmost: async (v) => {
    await window.api.tools.setTopmost(v)
    set({ topmost: v })
  },

  typerStart: async (opts) => {
    const ok = await window.api.tools.typer.start(opts)
    if (ok) set({ typer: { running: true, pos: 0, total: opts.text.length, error: null } })
  },

  typerStop: async () => {
    await window.api.tools.typer.stop()
    set({ typer: { ...get().typer, running: false } })
  },

  setClipEnabled: async (v) => {
    await window.api.tools.clipboard.setEnabled(v)
    set({ clipEnabled: v })
  },

  clearClip: () => set({ clipHistory: [] }),

  insertToEditor: (text) => {
    const editor = useEditorStore.getState().editor
    if (!editor || !text.trim()) return false
    editor.chain().focus().insertContent(text.trim()).run()
    return true
  },

  subscribe: () => {
    const offState = window.api.tools.typer.onState((s) => set({ typer: s }))
    const offPush = window.api.tools.clipboard.onPush((entry) =>
      set((s) => ({ clipHistory: [entry, ...s.clipHistory].slice(0, 20) }))
    )
    return () => {
      offState()
      offPush()
    }
  }
}))
