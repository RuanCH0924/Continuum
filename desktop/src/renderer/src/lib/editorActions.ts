import { useEditorStore } from '../stores/editorStore'
import { useAppStore } from '../stores/appStore'
import { useToastStore } from '../stores/toastStore'
import { turndown } from './markdown'
import { buildWorkMarkdown, mdToPlain, buildWorkBookData } from './exporters'

/** 立即保存当前章节（编辑器 HTML → Markdown），并生成历史版本快照，弹出 Toast。 */
export function saveNow(): void {
  const editor = useEditorStore.getState().editor
  const app = useAppStore.getState()
  if (!editor || !app.currentWorkId || !app.currentChapter) return
  const md = turndown.turndown(editor.getHTML())
  void app.saveChapter(md)
  void window.api.history.save(app.currentWorkId, app.currentChapter.seq, md)
  useToastStore
    .getState()
    .notify('success', `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}（已生成版本快照）`)
}

export function editorUndo(): void {
  useEditorStore.getState().editor?.chain().focus().undo().run()
}

export function editorRedo(): void {
  useEditorStore.getState().editor?.chain().focus().redo().run()
}

/** 导出当前作品（Markdown / TXT / PDF / EPUB / DOCX），快捷键与命令面板共用。 */
export async function exportWorkAs(kind: 'md' | 'txt' | 'pdf' | 'epub' | 'docx'): Promise<void> {
  const app = useAppStore.getState()
  const work = app.works.find((w) => w.id === app.currentWorkId)
  if (!work) {
    useToastStore.getState().notify('warning', '请先选择要导出的作品')
    return
  }
  const items = await Promise.all(
    app.chapters.map(async (c) => ({ meta: c, content: await window.api.chapters.read(work.id, c.seq) }))
  )
  if (kind === 'md' || kind === 'txt') {
    const md = buildWorkMarkdown(work, items)
    const content = kind === 'md' ? md : mdToPlain(md)
    const res = await window.api.files.exportSave({ defaultName: `${work.title}.${kind}`, content, kind })
    if (!res.canceled && res.path) useToastStore.getState().notify('success', `已导出作品：${res.path}`)
    return
  }
  const data = buildWorkBookData(work, items)
  const final = { ...data, defaultName: `${work.title}.${kind}` }
  const res =
    kind === 'pdf'
      ? await window.api.files.exportPdf(final)
      : kind === 'epub'
        ? await window.api.files.exportEpub(final)
        : await window.api.files.exportDocx(final)
  if (!res.canceled && res.path) useToastStore.getState().notify('success', `已导出作品：${res.path}`)
}
