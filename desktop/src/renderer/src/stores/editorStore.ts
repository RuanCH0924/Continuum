import { create } from 'zustand'
import type { Editor } from '@tiptap/react'

export type EditorMode = 'edit' | 'preview' | 'source'

/** 编辑器格式设置（格式设置面板，持久化于 settings.json 的 format 键）。 */
export interface EditorFormat {
  /** 正文字号百分比（100 = 基准） */
  fontSize: number
  /** 行距倍数 */
  lineHeight: number
  /** 首行缩进 2em */
  indent: boolean
  /** 打字机模式（光标垂直居中） */
  typewriter: boolean
  /** 显示行号（源码模式） */
  lineNumbers: boolean
}

export const DEFAULT_FORMAT: EditorFormat = {
  fontSize: 100,
  lineHeight: 1.9,
  indent: true,
  typewriter: false,
  lineNumbers: false
}

const MODE_ORDER: EditorMode[] = ['edit', 'preview']

interface EditorState {
  editor: Editor | null
  mode: EditorMode
  findOpen: boolean
  format: EditorFormat
  setEditor: (editor: Editor | null) => void
  setMode: (m: EditorMode) => void
  /** Ctrl+\：循环切换编辑 / 预览（源码模式不参与循环） */
  cycleMode: () => void
  setFindOpen: (v: boolean) => void
  setFormat: (patch: Partial<EditorFormat>) => void
  loadFormat: () => Promise<void>
}

/** 中央编辑器的 Tiptap 实例桥（AI 面板 / 快捷键跨组件读取选区与写回正文）。 */
export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  mode: 'edit',
  findOpen: false,
  format: DEFAULT_FORMAT,
  setEditor: (editor) => set({ editor }),
  setMode: (mode) => set({ mode }),
  cycleMode: () => {
    const { mode } = get()
    const idx = MODE_ORDER.indexOf(mode)
    set({ mode: MODE_ORDER[(idx + 1) % MODE_ORDER.length] })
  },
  setFindOpen: (findOpen) => set({ findOpen }),
  setFormat: (patch) => set({ format: { ...get().format, ...patch } }),
  loadFormat: async () => {
    const saved = (await window.api.settings.get('format')) as Partial<EditorFormat> | null
    if (saved && typeof saved === 'object') {
      set({ format: { ...DEFAULT_FORMAT, ...saved } })
    }
  }
}))
