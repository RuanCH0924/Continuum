import { create } from 'zustand'

export type ThemeId = 'light' | 'dark' | 'sepia' | 'sepia-dark' | 'high-contrast'

/** AI 面板 Tab（提升到全局以便快捷键驱动）。 */
export type AiTabId = 'chat' | 'polish' | 'continue' | 'kb' | 'extract'

/** 侧栏 Tab（提升到全局，供编辑器伏笔标记/时间线标注跳转控制）。 */
export type SidebarTabKey = 'works' | 'outline' | 'roles' | 'world' | 'clues' | 'materials' | 'timeline'

export const THEME_ORDER: ThemeId[] = ['light', 'dark', 'sepia', 'sepia-dark', 'high-contrast']

export const THEMES: { id: ThemeId; label: string; desc: string }[] = [
  { id: 'light', label: '浅色', desc: '默认明亮' },
  { id: 'dark', label: '深色', desc: '低光护眼' },
  { id: 'sepia', label: '护眼浅', desc: '米黄纸稿' },
  { id: 'sepia-dark', label: '护眼深', desc: '暗暖纸稿' },
  { id: 'high-contrast', label: '高对比', desc: '纯黑白' }
]

const THEME_KEY = 'theme'

interface UiState {
  theme: ThemeId
  immersed: boolean
  sidebarCollapsed: boolean
  aiCollapsed: boolean
  /** 左侧创作侧栏宽度（px，可拖拽调整；默认 280） */
  sidebarWidth: number
  /** 右侧 AI 面板宽度（px，可拖拽调整；默认 340） */
  aiWidth: number
  settingsOpen: boolean
  paletteOpen: boolean
  shortcutOpen: boolean
  toolsOpen: boolean
  /** 格式设置弹窗（A7） */
  formatOpen: boolean
  /** 通知中心抽屉开关（Ctrl+Shift+N） */
  notifyOpen: boolean
  /** 全局全文搜索（Ctrl+Shift+F） */
  searchOpen: boolean
  /** 历史版本弹窗 */
  versionsOpen: boolean
  /** AI 面板当前 Tab（Ctrl+Shift+K 直达知识库） */
  aiTab: AiTabId
  /** 全局新建作品/章节弹窗（顶栏菜单 / 命令面板 / 侧栏共用） */
  promptKind: 'work' | 'chapter' | null
  /** 侧栏当前 Tab（全局控制，供编辑器伏笔标记跳转） */
  sidebarTab: SidebarTabKey
  /** 伏笔卡片聚焦信号（编辑器标记点击后定位卡片） */
  clueFocus: { noteId: string; ts: number } | null
  /** 时间线条目聚焦信号（正文时间标注点击后定位条目） */
  timelineFocus: { entryId: string; ts: number } | null
  /** 中央区域模式：写作（编辑器）/ 大纲（大纲工作台） */
  centralMode: 'editor' | 'outline'
  /** 大纲节点聚焦信号（侧栏/工作台导航点击后定位高亮） */
  outlineFocus: { nodeId: string; ts: number } | null
  /** 大纲工作台当前视图（提取完成跳转等场景可直达章纲） */
  outlineView: 'list' | 'chapters' | 'mindmap'
  /** FTUE 首次启动引导是否已展示 */
  ftueDone: boolean

  initTheme: () => Promise<void>
  setTheme: (t: ThemeId) => Promise<void>
  cycleTheme: () => Promise<void>
  toggleImmersive: () => void
  toggleSidebar: () => void
  toggleAi: () => void
  setSidebarWidth: (w: number) => void
  setAiWidth: (w: number) => void
  /** 从 settings 恢复拖拽后的面板宽度（App 启动时调用） */
  initPanelSizes: () => Promise<void>
  /** 将当前面板宽度持久化（拖动结束时调用） */
  persistPanelSizes: () => Promise<void>
  setSettingsOpen: (v: boolean) => void
  setPaletteOpen: (v: boolean) => void
  setShortcutOpen: (v: boolean) => void
  setToolsOpen: (v: boolean) => void
  setFormatOpen: (v: boolean) => void
  setNotifyOpen: (v: boolean) => void
  setSearchOpen: (v: boolean) => void
  setVersionsOpen: (v: boolean) => void
  setAiTab: (t: AiTabId) => void
  setPromptKind: (v: 'work' | 'chapter' | null) => void
  setSidebarTab: (t: SidebarTabKey) => void
  setClueFocus: (v: { noteId: string; ts: number } | null) => void
  setTimelineFocus: (v: { entryId: string; ts: number } | null) => void
  setCentralMode: (v: 'editor' | 'outline') => void
  setOutlineFocus: (v: { nodeId: string; ts: number } | null) => void
  setOutlineView: (v: 'list' | 'chapters' | 'mindmap') => void
  initFtue: () => Promise<void>
  finishFtue: () => Promise<void>
}

/** 全局 UI 状态：主题矩阵 / 沉浸 / 面板折叠 / 弹层开关（命令面板、快捷键、设置）。 */
export const useUiStore = create<UiState>((set, get) => ({
  theme: 'light',
  immersed: false,
  sidebarCollapsed: false,
  aiCollapsed: false,
  sidebarWidth: 280,
  aiWidth: 340,
  settingsOpen: false,
  paletteOpen: false,
  shortcutOpen: false,
  toolsOpen: false,
  formatOpen: false,
  notifyOpen: false,
  searchOpen: false,
  versionsOpen: false,
  aiTab: 'chat',
  promptKind: null,
  sidebarTab: 'works',
  clueFocus: null,
  timelineFocus: null,
  centralMode: 'editor',
  outlineFocus: null,
  outlineView: 'list',
  ftueDone: true,

  initTheme: async () => {
    const saved = await window.api.settings.get(THEME_KEY)
    if (typeof saved === 'string' && (THEME_ORDER as string[]).includes(saved)) {
      set({ theme: saved as ThemeId })
    }
  },
  setTheme: async (t) => {
    set({ theme: t })
    await window.api.settings.set(THEME_KEY, t)
  },
  cycleTheme: async () => {
    const order = THEME_ORDER
    const idx = order.indexOf(get().theme)
    await get().setTheme(order[(idx + 1) % order.length])
  },
  toggleImmersive: () => set((s) => ({ immersed: !s.immersed })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleAi: () => set((s) => ({ aiCollapsed: !s.aiCollapsed })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setAiWidth: (w) => set({ aiWidth: w }),
  initPanelSizes: async () => {
    const [sw, aw] = await Promise.all([
      window.api.settings.get('ui.sidebarWidth'),
      window.api.settings.get('ui.aiWidth')
    ])
    if (typeof sw === 'number') set({ sidebarWidth: sw })
    if (typeof aw === 'number') set({ aiWidth: aw })
  },
  persistPanelSizes: async () => {
    const { sidebarWidth, aiWidth } = get()
    await Promise.all([
      window.api.settings.set('ui.sidebarWidth', sidebarWidth),
      window.api.settings.set('ui.aiWidth', aiWidth)
    ])
  },
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  setShortcutOpen: (v) => set({ shortcutOpen: v }),
  setToolsOpen: (v) => set({ toolsOpen: v }),
  setFormatOpen: (v) => set({ formatOpen: v }),
  setNotifyOpen: (v) => set({ notifyOpen: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
  setVersionsOpen: (v) => set({ versionsOpen: v }),
  setAiTab: (t) => set({ aiTab: t }),
  setPromptKind: (v) => set({ promptKind: v }),
  setSidebarTab: (t) => set({ sidebarTab: t }),
  setClueFocus: (v) => set({ clueFocus: v }),
  setTimelineFocus: (v) => set({ timelineFocus: v }),
  setCentralMode: (v) => set({ centralMode: v }),
  setOutlineFocus: (v) => set({ outlineFocus: v }),
  setOutlineView: (v) => set({ outlineView: v }),
  initFtue: async () => {
    const done = await window.api.settings.get('ftueDone')
    set({ ftueDone: done === true })
  },
  finishFtue: async () => {
    set({ ftueDone: true })
    await window.api.settings.set('ftueDone', true)
  }
}))
