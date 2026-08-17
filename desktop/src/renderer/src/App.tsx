import React, { useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { AIPanel } from './components/AIPanel'
import { ResizeHandle } from './components/ResizeHandle'
import { EditorArea } from './components/EditorArea'
import { OutlineWorkspace } from './components/outline/OutlineWorkspace'
import { WelcomeView } from './components/WelcomeView'
import { SettingsDialog } from './components/SettingsDialog'
import { CommandPalette } from './components/CommandPalette'
import { ShortcutHelp } from './components/ShortcutHelp'
import { ToolsDialog } from './components/ToolsDialog'
import { ToastViewport } from './components/ToastViewport'
import { PromptModal } from './components/PromptModal'
import { WorkWizard } from './components/WorkWizard'
import { FormatSettings } from './components/FormatSettings'
import { FTUEGuide } from './components/FTUEGuide'
import { SelectionToolbar } from './components/SelectionToolbar'
import { ToolDiffDialog } from './components/ToolDiffDialog'
import { FindReplaceDialog } from './components/FindReplaceDialog'
import { GlobalSearchDialog } from './components/GlobalSearchDialog'
import { VersionHistoryDialog } from './components/VersionHistoryDialog'
import { StatusBar } from './components/StatusBar'
import { useAppStore } from './stores/appStore'
import { useUiStore } from './stores/uiStore'
import { useEditorStore } from './stores/editorStore'
import { useAiStore } from './stores/aiStore'
import { useToastStore } from './stores/toastStore'
import { useToolsStore } from './stores/toolsStore'
import { useGlobalHotkeys } from './lib/hotkeys'
import { saveNow, exportWorkAs } from './lib/editorActions'
import {
  SIDEBAR_MIN,
  AI_MIN,
  maxSidebarWidth,
  maxAiWidth
} from './lib/editorLayout'

/**
 * 续言 Continuum · 三栏 AppShell。
 * 顶栏 / 侧栏 / 中央编辑区 / AI 面板 / 状态栏 + 主题 / 沉浸 / 命令面板 / 通知 / 引导 / 工具浮层。
 */
export default function App(): React.JSX.Element {
  const theme = useUiStore((s) => s.theme)
  const immersed = useUiStore((s) => s.immersed)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const aiCollapsed = useUiStore((s) => s.aiCollapsed)
  const centralMode = useUiStore((s) => s.centralMode)
  const sidebarWidth = useUiStore((s) => s.sidebarWidth)
  const aiWidth = useUiStore((s) => s.aiWidth)
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth)
  const setAiWidth = useUiStore((s) => s.setAiWidth)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const promptKind = useUiStore((s) => s.promptKind)
  const formatOpen = useUiStore((s) => s.formatOpen)
  const ftueDone = useUiStore((s) => s.ftueDone)
  const versionsOpen = useUiStore((s) => s.versionsOpen)

  const works = useAppStore((s) => s.works)
  const loadWorks = useAppStore((s) => s.loadWorks)
  const currentWorkId = useAppStore((s) => s.currentWorkId)
  const charCount = useAppStore((s) => s.charCount)
  const todayChars = useAppStore((s) => s.todayChars)
  const dailyGoal = useAppStore((s) => s.dailyGoal)
  const [ready, setReady] = React.useState(false)
  /** 当前窗口宽度：驱动侧栏拖拽上限与缩放钳制（编辑菜单最小安全宽度管控） */
  const [winW, setWinW] = useState(() => window.innerWidth)

  // 首屏：恢复主题 + 加载作品 + 统计 + 格式设置 + FTUE 状态
  useEffect(() => {
    void useUiStore.getState().initTheme()
    void useUiStore.getState().initPanelSizes()
    void useEditorStore.getState().loadFormat()
    void useUiStore.getState().initFtue()
    void loadWorks().finally(() => setReady(true))
    void useAppStore.getState().loadStats()
  }, [loadWorks])

  // 窗口缩放：同步窗口宽度，并钳制已保存的面板宽度，避免挤占编辑菜单最小安全宽度
  useEffect(() => {
    const onResize = (): void => {
      setWinW(window.innerWidth)
      const ui = useUiStore.getState()
      if (ui.sidebarWidth > maxSidebarWidth(window.innerWidth, ui.aiWidth)) {
        ui.setSidebarWidth(maxSidebarWidth(window.innerWidth, ui.aiWidth))
      }
      if (ui.aiWidth > maxAiWidth(window.innerWidth, ui.sidebarWidth)) {
        ui.setAiWidth(maxAiWidth(window.innerWidth, ui.sidebarWidth))
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 主题矩阵同步到 html[data-theme]（全部颜色走 CSS 变量，组件无需 dark: 类）
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // M6：订阅辅助工具事件（录入进度 / 剪贴板推送）
  useEffect(() => useToolsStore.getState().subscribe(), [])

  const heading = (level: 1 | 2 | 3): void => {
    useEditorStore.getState().editor?.chain().focus().toggleHeading({ level }).run()
  }

  // 全局快捷键（M5 集中注册表 + 本轮扩展：编辑 / 工具 / 导出 / 通知 / 设置）
  const hotkeys = useMemo(
    () => [
      {
        id: 'palette',
        keys: ['ctrl', 'k'],
        label: '命令面板',
        run: () => {
          const ui = useUiStore.getState()
          ui.setPaletteOpen(!ui.paletteOpen)
        }
      },
      {
        id: 'shortcuts',
        keys: ['ctrl', '/'],
        label: '快捷键速查',
        run: () => useUiStore.getState().setShortcutOpen(true)
      },
      {
        id: 'theme',
        keys: ['ctrl', 'alt', 't'],
        label: '循环主题',
        run: () => void useUiStore.getState().cycleTheme()
      },
      {
        id: 'immersive',
        keys: ['f11'],
        label: '沉浸模式',
        run: () => useUiStore.getState().toggleImmersive()
      },
      {
        id: 'polish',
        keys: ['ctrl', 'r'],
        label: '润色选中',
        allowInInput: true,
        run: () => void useAiStore.getState().runPolish()
      },
      {
        id: 'rewrite',
        keys: ['ctrl', 'j'],
        label: '改写选中',
        allowInInput: true,
        run: () => void useAiStore.getState().runRewrite()
      },
      {
        id: 'continue',
        keys: ['ctrl', 'enter'],
        label: '光标续写',
        allowInInput: true,
        run: () => void useAiStore.getState().runContinue()
      },
      {
        id: 'translate',
        keys: ['ctrl', 'shift', 't'],
        label: '翻译选中',
        allowInInput: true,
        run: () => void useAiStore.getState().runTranslate()
      },
      {
        id: 'save',
        keys: ['ctrl', 's'],
        label: '立即保存',
        allowInInput: true,
        run: () => saveNow()
      },
      {
        id: 'cycle-mode',
        keys: ['ctrl', '\\'],
        label: '切换编辑模式',
        allowInInput: true,
        run: () => useEditorStore.getState().cycleMode()
      },
      {
        id: 'h1',
        keys: ['ctrl', 'alt', '1'],
        label: '一级标题',
        allowInInput: true,
        run: () => heading(1)
      },
      {
        id: 'h2',
        keys: ['ctrl', 'alt', '2'],
        label: '二级标题',
        allowInInput: true,
        run: () => heading(2)
      },
      {
        id: 'h3',
        keys: ['ctrl', 'alt', '3'],
        label: '三级标题',
        allowInInput: true,
        run: () => heading(3)
      },
      {
        id: 'find',
        keys: ['ctrl', 'f'],
        label: '查找',
        allowInInput: true,
        run: () => useEditorStore.getState().setFindOpen(true)
      },
      {
        id: 'replace',
        keys: ['ctrl', 'h'],
        label: '替换',
        allowInInput: true,
        run: () => useEditorStore.getState().setFindOpen(true)
      },
      {
        id: 'settings',
        keys: ['ctrl', ','],
        label: 'AI 服务设置',
        run: () => useUiStore.getState().setSettingsOpen(true)
      },
      {
        id: 'export-work',
        keys: ['ctrl', 'shift', 'e'],
        label: '导出作品',
        allowInInput: true,
        run: () => void exportWorkAs('md')
      },
      {
        id: 'notify',
        keys: ['ctrl', 'shift', 'n'],
        label: '通知中心',
        run: () => {
          const ui = useUiStore.getState()
          ui.setNotifyOpen(!ui.notifyOpen)
        }
      },
      {
        id: 'global-search',
        keys: ['ctrl', 'shift', 'f'],
        label: '全局全文搜索',
        run: () => useUiStore.getState().setSearchOpen(true)
      },
      {
        id: 'ai-panel',
        keys: ['ctrl', 'shift', 'a'],
        label: 'AI 面板开关',
        run: () => useUiStore.getState().toggleAi()
      },
      {
        id: 'kb-search',
        keys: ['ctrl', 'shift', 'k'],
        label: '知识库检索',
        run: () => {
          const ui = useUiStore.getState()
          ui.setAiTab('kb')
          if (ui.aiCollapsed) ui.toggleAi()
        }
      }
    ],
    []
  )
  useGlobalHotkeys(hotkeys)

  return (
    <div className="flex h-full flex-col">
      {!immersed && <Header />}

      <div className="flex min-h-0 flex-1">
        {!immersed && (
          <div className="shrink-0" style={{ width: sidebarCollapsed ? 48 : sidebarWidth }}>
            <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => useUiStore.getState().toggleSidebar()} />
          </div>
        )}
        {!immersed && !sidebarCollapsed && (
          <ResizeHandle
            direction="left"
            width={sidebarWidth}
            min={SIDEBAR_MIN}
            max={maxSidebarWidth(winW, aiWidth)}
            onChange={setSidebarWidth}
            onDragEnd={() => void useUiStore.getState().persistPanelSizes()}
          />
        )}
        {ready && works.length === 0 ? <WelcomeView /> : centralMode === 'outline' && currentWorkId ? <OutlineWorkspace /> : <EditorArea />}
        {!immersed && !aiCollapsed && (
          <ResizeHandle
            direction="right"
            width={aiWidth}
            min={AI_MIN}
            max={maxAiWidth(winW, sidebarWidth)}
            onChange={setAiWidth}
            onDragEnd={() => void useUiStore.getState().persistPanelSizes()}
          />
        )}
        {!immersed && (
          <div className="shrink-0" style={{ width: aiCollapsed ? 48 : aiWidth }}>
            <AIPanel collapsed={aiCollapsed} onToggleCollapse={() => useUiStore.getState().toggleAi()} />
          </div>
        )}
      </div>

      {!immersed && <StatusBar />}

      {/* 沉浸模式悬浮工具条（B 组细节）：退出 / 主题 / 字数 / 目标进度 */}
      {immersed && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neutral-200 bg-neutral-0 px-4 py-1.5 text-[11px] text-neutral-500 shadow-2">
          <span>沉浸模式</span>
          <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5">F11</kbd>
          <span>退出</span>
          <button
            className="pointer-events-auto text-brand-500 hover:text-brand-300"
            onClick={() => useUiStore.getState().toggleImmersive()}
          >
            立即退出
          </button>
          <span className="h-[12px] w-px bg-neutral-200" />
          <button
            className="pointer-events-auto text-neutral-500 hover:text-brand-500"
            title="循环主题"
            onClick={() => void useUiStore.getState().cycleTheme()}
          >
            主题
          </button>
          <span className="h-[12px] w-px bg-neutral-200" />
          <span>
            字数 <b className="text-neutral-900">{charCount.toLocaleString('zh-CN')}</b>
          </span>
          <span>
            目标{' '}
            <b className={todayChars >= dailyGoal && dailyGoal > 0 ? 'text-status-success' : 'text-neutral-900'}>
              {Math.min(100, Math.round((todayChars / dailyGoal) * 100))}%
            </b>
          </span>
        </div>
      )}

      {settingsOpen && <SettingsDialog onClose={() => useUiStore.getState().setSettingsOpen(false)} />}
      {formatOpen && <FormatSettings onClose={() => useUiStore.getState().setFormatOpen(false)} />}
      {versionsOpen && <VersionHistoryDialog onClose={() => useUiStore.getState().setVersionsOpen(false)} />}
      {promptKind === 'work' && <WorkWizard onClose={() => useUiStore.getState().setPromptKind(null)} />}
      {promptKind === 'chapter' && (
        <PromptModal
          title="新建章节"
          placeholder="章节标题"
          onConfirm={(v) => {
            void useAppStore.getState().createChapter(v)
            useToastStore.getState().notify('success', `已创建章节「${v}」`)
            useUiStore.getState().setPromptKind(null)
          }}
          onCancel={() => useUiStore.getState().setPromptKind(null)}
        />
      )}
      {ready && !ftueDone && (
        <FTUEGuide onFinish={() => void useUiStore.getState().finishFtue()} />
      )}

      <SelectionToolbar />
      <ToolDiffDialog />
      <FindReplaceDialog />
      <GlobalSearchDialog />
      <ToolsDialog />
      <CommandPalette />
      <ShortcutHelp />
      <ToastViewport />
    </div>
  )
}
