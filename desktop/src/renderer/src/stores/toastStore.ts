import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
  createdAt: number
}

let toastSeq = 0

interface ToastState {
  /** 正在展示的浮层 */
  toasts: Toast[]
  /** 通知中心历史（铃铛角标计数来源） */
  history: Toast[]
  notify: (kind: ToastKind, text: string) => void
  dismiss: (id: number) => void
  clearAll: () => void
}

/** 轻量 Toast / 通知中心：全局调用 notify()，浮层自动消失，历史进入铃铛。 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  history: [],
  notify: (kind, text) => {
    const id = ++toastSeq
    const toast: Toast = { id, kind, text, createdAt: Date.now() }
    set((s) => ({ toasts: [...s.toasts, toast], history: [toast, ...s.history].slice(0, 50) }))
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ history: [] })
}))
