/**
 * 章节标题块绑定（M8 编辑器初始化优化）。
 *
 * 编辑器加载章节时自动在内容开头插入「章节标题块」（chapterTitle 节点，默认文本块、
 * 可编辑）。标题块携带 seq 属性与章节元数据绑定：章节重命名时若标题块未被用户编辑
 * （文本仍等于旧标题），则自动同步为最新章节名——保留原始数据绑定，便于后续扩展
 * （如全局章节名批量同步 / 导出时剔除标题块）。
 */

import type { Editor } from '@tiptap/react'
import type { Node as PmNode } from '@tiptap/pm/model'

export type TitleBlockAction = 'exists' | 'rebind' | 'insert'

/**
 * 标题块处理决策（纯函数，便于测试）：
 * - exists：首块已是章节标题块
 * - rebind：首块为普通段落且文本与章节名一致（此前保存的标题块，重新绑定）
 * - insert：需在开头插入章节标题块
 */
export function chapterTitleAction(
  firstType: string | null,
  firstText: string,
  title: string
): TitleBlockAction {
  if (firstType === 'chapterTitle') return 'exists'
  if (firstType === 'paragraph' && firstText === title) return 'rebind'
  return 'insert'
}

/** 文档首块（无内容返回 null）。 */
export function firstBlock(editor: Editor): PmNode | null {
  return editor.state.doc.firstChild
}

/** 将首块标记为章节标题块并写入文本（保留绑定 seq）。 */
function setTitleBlock(editor: Editor, seq: number, text: string): void {
  const first = firstBlock(editor)
  if (!first) return
  const { tr } = editor.state
  tr.setNodeMarkup(0, undefined, { seq })
  const start = 1
  const end = start + first.content.size
  if (text !== first.textContent) {
    tr.delete(start, end)
    tr.insertText(text, start)
  }
  editor.view.dispatch(tr)
}

/**
 * 章节加载后调用：确保内容开头存在与章节名绑定的标题块。
 * 通过 emitUpdate=false 的 setContent 已避免触发保存，此处事务仅补标题块。
 */
export function ensureChapterTitle(editor: Editor, seq: number, title: string): void {
  if (!title) return
  const first = firstBlock(editor)
  const action = chapterTitleAction(first?.type.name ?? null, first?.textContent ?? '', title)
  if (action === 'exists') return
  if (action === 'rebind') {
    setTitleBlock(editor, seq, title)
    return
  }
  editor
    .chain()
    .insertContentAt(0, {
      type: 'chapterTitle',
      attrs: { seq },
      content: [{ type: 'text', text: title }]
    })
    .run()
}

/**
 * 章节重命名后调用：若首块（标题块或与旧名一致的段落）未被用户编辑，则同步为新名称。
 * 用户已修改标题块文本时不覆盖（尊重编辑）。
 */
export function syncChapterTitleBlock(
  editor: Editor | null,
  seq: number,
  oldTitle: string,
  newTitle: string
): void {
  if (!editor || !newTitle || newTitle === oldTitle) return
  const first = firstBlock(editor)
  if (first && first.textContent === oldTitle) {
    setTitleBlock(editor, seq, newTitle)
  }
}
