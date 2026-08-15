import React, { useEffect, useRef, useState } from 'react'
import { Icon, LogoIcon } from './Icon'
import { useUiStore } from '../stores/uiStore'
import { useToastStore } from '../stores/toastStore'
import { useAiStore } from '../stores/aiStore'
import { useAppStore } from '../stores/appStore'
import { useEditorStore } from '../stores/editorStore'
import { saveNow, editorUndo, editorRedo, exportWorkAs } from '../lib/editorActions'
import { mdToPlain } from '../lib/exporters'
import { importAsWork, importAsChapter } from '../lib/importers'
import { turndown } from '../lib/markdown'
import type { ToastKind } from '../stores/toastStore'
import type { Editor } from '@tiptap/react'

const MENU_LABELS = ['文件', '编辑', '插入', '视图', '工具'] as const

interface MenuItem {
  label?: string
  hint?: string
  separator?: boolean
  run?: () => void
}

const KIND_DOT: Record<ToastKind, string> = {
  info: 'bg-neutral-300',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  error: 'bg-status-danger'
}

/** 顶栏：品牌 / 下拉菜单 / 全局工具 + 面包屑（作品 ▸ 章节）。 */
export function Header(): React.JSX.Element {
  const theme = useUiStore((s) => s.theme)
  const immersed = useUiStore((s) => s.immersed)
  const cycleTheme = useUiStore((s) => s.cycleTheme)
  const toggleImmersive = useUiStore((s) => s.toggleImmersive)
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const setShortcutOpen = useUiStore((s) => s.setShortcutOpen)
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)
  const setToolsOpen = useUiStore((s) => s.setToolsOpen)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const setPromptKind = useUiStore((s) => s.setPromptKind)

  const history = useToastStore((s) => s.history)
  const clearAll = useToastStore((s) => s.clearAll)
  const notifyOpen = useUiStore((s) => s.notifyOpen)
  const setNotifyOpen = useUiStore((s) => s.setNotifyOpen)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const headerRef = useRef<HTMLElement>(null)

  const works = useAppStore((s) => s.works)
  const currentWorkId = useAppStore((s) => s.currentWorkId)
  const currentChapter = useAppStore((s) => s.currentChapter)
  const lastSavedAt = useAppStore((s) => s.lastSavedAt)

  const workTitle = works.find((w) => w.id === currentWorkId)?.title ?? ''

  // 点击外部关闭下拉菜单 / 通知中心
  useEffect(() => {
    if (!openMenu && !notifyOpen) return
    const onDown = (e: MouseEvent): void => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setNotifyOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [openMenu, notifyOpen])

  const ai = useAiStore.getState
  const toast = (kind: ToastKind, text: string): void => useToastStore.getState().notify(kind, text)

  /** 对编辑器执行命令（无编辑器时提示）。 */
  const withEditor = (fn: (e: Editor) => void): void => {
    const ed = useEditorStore.getState().editor
    if (!ed) toast('warning', '请先打开一个章节')
    else fn(ed)
  }

  const exportChapter = async (kind: 'md' | 'txt'): Promise<void> => {
    const app = useAppStore.getState()
    if (!app.currentChapter) {
      toast('warning', '请先选择要导出的章节')
      return
    }
    const editor = useEditorStore.getState().editor
    const md = editor ? turndown.turndown(editor.getHTML()) : app.chapterContent
    const content = kind === 'md' ? md : mdToPlain(md)
    const res = await window.api.files.exportSave({
      defaultName: `${app.currentChapter.title}.${kind}`,
      content,
      kind
    })
    if (!res.canceled && res.path) toast('success', `已导出章节：${res.path}`)
  }

  const exportWork = (kind: 'md' | 'txt' | 'pdf' | 'epub' | 'docx'): void => {
    void exportWorkAs(kind)
  }

  const menus: Record<string, MenuItem[]> = {
    文件: [
      { label: '新建作品', run: () => setPromptKind('work') },
      { label: '新建章节', run: () => setPromptKind('chapter') },
      { label: '导入作品（Markdown）', run: () => void importAsWork() },
      { label: '导入章节到当前作品', run: () => void importAsChapter() },
      { label: '立即保存', hint: 'Ctrl+S', run: () => saveNow() },
      { separator: true },
      { label: '导出章节（Markdown）', run: () => void exportChapter('md') },
      { label: '导出章节（TXT）', run: () => void exportChapter('txt') },
      { label: '导出作品（Markdown）', hint: 'Ctrl+Shift+E', run: () => void exportWork('md') },
      { label: '导出作品（TXT）', run: () => void exportWork('txt') },
      { label: '导出作品（PDF）', run: () => void exportWork('pdf') },
      { label: '导出作品（EPUB）', run: () => void exportWork('epub') },
      { label: '导出作品（DOCX）', run: () => void exportWork('docx') },
      { separator: true },
      { label: '历史版本', hint: 'Ctrl+S 生成快照', run: () => useUiStore.getState().setVersionsOpen(true) },
      { separator: true },
      { label: '退出', run: () => window.close() }
    ],
    编辑: [
      { label: '撤销', hint: 'Ctrl+Z', run: () => editorUndo() },
      { label: '重做', hint: 'Ctrl+Y', run: () => editorRedo() },
      { label: '查找 / 替换', hint: 'Ctrl+F', run: () => useEditorStore.getState().setFindOpen(true) },
      { separator: true },
      { label: '润色选中', hint: 'Ctrl+R', run: () => void ai().runPolish() },
      { label: '改写选中', hint: 'Ctrl+J', run: () => void ai().runRewrite() },
      { label: '从光标处续写', hint: 'Ctrl+Enter', run: () => void ai().runContinue() },
      { label: '翻译选中', hint: 'Ctrl+Shift+T', run: () => void ai().runTranslate() }
    ],
    插入: [
      { label: '一级标题', run: () => withEditor((e) => e.chain().focus().toggleHeading({ level: 1 }).run()) },
      { label: '二级标题', run: () => withEditor((e) => e.chain().focus().toggleHeading({ level: 2 }).run()) },
      { label: '三级标题', run: () => withEditor((e) => e.chain().focus().toggleHeading({ level: 3 }).run()) },
      { separator: true },
      { label: '插入表格', run: () => withEditor((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()) },
      { label: '插入分隔线', run: () => withEditor((e) => e.chain().focus().setHorizontalRule().run()) },
      { label: '插入代码块', run: () => withEditor((e) => e.chain().focus().toggleCodeBlock().run()) },
      { separator: true },
      {
        label: '插入图片…',
        run: () =>
          withEditor((e) => {
            const url = window.prompt('图片 URL：')
            if (url?.trim()) e.chain().focus().setImage({ src: url.trim() }).run()
          })
      },
      {
        label: '插入链接…',
        run: () =>
          withEditor((e) => {
            const url = window.prompt('链接地址：')
            if (url?.trim()) e.chain().focus().setLink({ href: url.trim() }).run()
          })
      }
    ],
    视图: [{ label: immersed ? '退出沉浸模式' : '沉浸模式', hint: 'F11', run: () => toggleImmersive() }],
    工具: [{ label: '打开辅助工具', run: () => setToolsOpen(true) }]
    // 「设置」为单击直达按钮：点击直接打开设置弹窗，不展开下拉菜单。
  }

  const themeIcon = theme === 'dark' || theme === 'sepia-dark' ? 'sun' : theme === 'high-contrast' ? 'moon' : 'sun'

  const copyText = (text: string): void => {
    void navigator.clipboard.writeText(text)
    toast('success', '已复制通知内容')
  }

  return (
    <header ref={headerRef} className="flex shrink-0 flex-col border-b border-neutral-200 bg-neutral-50 select-none">
      {/* 第一行：品牌 / 菜单 / 全局工具 */}
      <div className="flex h-[42px] items-center gap-2 px-3">
        <div className="flex items-center gap-2 pr-2">
          <LogoIcon size={22} />
          <span className="text-[14px] font-semibold tracking-[0.5px] text-neutral-900">
            续言 <span className="font-normal text-neutral-500">Continuum</span>
          </span>
        </div>

        <nav className="flex flex-1 items-center gap-0.5">
          {MENU_LABELS.map((label) => (
            <div key={label} className="relative">
              <button
                className={`top-menu-btn ${openMenu === label ? 'bg-neutral-100' : ''}`}
                onClick={() => setOpenMenu((m) => (m === label ? null : label))}
              >
                {label}
              </button>
              {openMenu === label && (
                <div className="absolute left-0 top-full z-50 mt-0.5 w-[200px] rounded-md border border-neutral-200 bg-neutral-0 py-1 shadow-3">
                  {menus[label].map((item, i) =>
                    item.separator ? (
                      <div key={`sep-${i}`} className="my-1 h-px bg-neutral-200" />
                    ) : (
                      <button
                        key={i}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-neutral-900 transition-colors duration-fast hover:bg-neutral-100"
                        onClick={() => {
                          item.run?.()
                          setOpenMenu(null)
                        }}
                      >
                        <span>{item.label}</span>
                        {item.hint && <span className="ml-3 text-[10px] text-neutral-300">{item.hint}</span>}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
          {/* 「设置」单击直达：点击直接打开设置中心弹窗，无下拉菜单。 */}
          <button
            className="top-menu-btn"
            title="设置中心（Ctrl+,）"
            onClick={() => setSettingsOpen(true)}
          >
            设置
          </button>
        </nav>

        <div className="flex items-center gap-1">
          <button className="icon-btn" title="全局全文搜索（Ctrl+Shift+F）" onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={18} />
          </button>
          <button className="icon-btn" title="循环切换主题（Ctrl+Alt+T）" onClick={() => void cycleTheme()}>
            <Icon name={themeIcon} size={18} />
          </button>
          <button className="icon-btn" title="命令面板（Ctrl+K）" onClick={() => setPaletteOpen(true)}>
            <Icon name="command" size={18} />
          </button>

          <div className="relative">
            <button className="icon-btn relative" title="通知中心（Ctrl+Shift+N）" onClick={() => setNotifyOpen(!notifyOpen)}>
              <Icon name="bell" size={18} />
              {history.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-status-danger px-1 text-[9px] font-medium leading-none text-white">
                  {history.length > 99 ? '99+' : history.length}
                </span>
              )}
            </button>
            {notifyOpen && (
              <div className="absolute right-0 top-[38px] z-50 w-[300px] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-3">
                <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
                  <span className="text-[12px] font-medium text-neutral-900">通知</span>
                  {history.length > 0 && (
                    <button className="text-[11px] text-neutral-500 hover:text-neutral-900" onClick={clearAll}>
                      清空
                    </button>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1.5">
                  {history.length === 0 ? (
                    <div className="px-3 py-8 text-center text-[12px] text-neutral-300">暂无通知</div>
                  ) : (
                    history.map((t) => (
                      <div key={t.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100">
                        <span className={`mt-1.5 h-[6px] w-[6px] shrink-0 rounded-full ${KIND_DOT[t.kind]}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] leading-[1.6] text-neutral-900">{t.text}</div>
                          <div className="text-[10px] text-neutral-300">
                            {new Date(t.createdAt).toLocaleTimeString('zh-CN', { hour12: false })}
                          </div>
                        </div>
                        <button
                          className="shrink-0 rounded px-1 py-0.5 text-[10px] text-brand-500 hover:bg-brand-50"
                          onClick={() => copyText(t.text)}
                        >
                          复制
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="icon-btn" title="沉浸模式（F11）" onClick={toggleImmersive}>
            <Icon name="immersive" size={18} />
          </button>
          <button className="icon-btn" title="快捷键速查（Ctrl+/）" onClick={() => setShortcutOpen(true)}>
            <Icon name="help" size={18} />
          </button>
        </div>
      </div>

      {/* 第二行：面包屑 */}
      <div className="flex h-[30px] items-center gap-2 border-t border-neutral-200 px-4 text-[11px] text-neutral-500">
        <span className="text-neutral-400">我的书架</span>
        {workTitle && (
          <>
            <span className="text-neutral-300">▸</span>
            <span>{workTitle}</span>
          </>
        )}
        {currentChapter && (
          <>
            <span className="text-neutral-300">▸</span>
            <span className="font-medium text-neutral-900">{currentChapter.title}</span>
          </>
        )}
        <span className="ml-auto flex items-center gap-3">
          {lastSavedAt && (
            <span>
              已保存{' '}
              {new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
          )}
          <span className="text-neutral-300">本地 · 纯 Markdown</span>
        </span>
      </div>
    </header>
  )
}
