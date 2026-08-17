import { useAppStore } from '../stores/appStore'
import { useToastStore } from '../stores/toastStore'

/** 导入 Markdown 为「新作品 + 第一章」。返回是否成功。 */
export async function importAsWork(): Promise<boolean> {
  const file = await window.api.files.importMarkdown()
  if (!file) return false
  const app = useAppStore.getState()
  await app.createWork(file.name)
  await app.createChapter(file.name || '第一章')
  await app.saveChapter(file.content)
  useToastStore.getState().notify('success', `已导入作品「${file.name}」`)
  return true
}

/** 导入 Markdown 为「当前作品的章节」。返回是否成功。 */
export async function importAsChapter(): Promise<boolean> {
  const file = await window.api.files.importMarkdown()
  if (!file) return false
  const app = useAppStore.getState()
  if (!app.currentWorkId) {
    useToastStore.getState().notify('warning', '请先选择要导入的作品')
    return false
  }
  await app.createChapter(file.name || '导入章节')
  await app.saveChapter(file.content)
  useToastStore.getState().notify('success', `已导入章节「${file.name}」`)
  return true
}
