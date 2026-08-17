/**
 * 伏笔联动逻辑（M8 伏笔联动功能）。
 *
 * 数据模型：伏笔（clue 类 Note）通过 anchorText + chapterSeq 与编辑器原文建立唯一绑定。
 * 渲染层在章节加载 / 知识变更后扫描正文，将匹配文本以 foreshadow 标记高亮（含状态色），
 * 实现「编辑器标记 ↔ 伏笔卡片」双向定位。
 */

import type { Editor } from '@tiptap/react'
import type { Note } from '@shared/types'

/** 伏笔状态（由 tag 推断：已埋设 / 进行中 / 已回收）。 */
export type ClueStatus = 'buried' | 'active' | 'resolved' | 'other'

export function clueStatusOf(note: Note): ClueStatus {
  const tag = note.tag || ''
  if (tag.includes('已回收') || tag.includes('回收')) return 'resolved'
  if (tag.includes('进行中') || tag.includes('进行')) return 'active'
  if (tag.includes('已埋设') || tag.includes('埋设')) return 'buried'
  return 'other'
}

/** 在纯文本中查找某片段的所有出现位置（[start,end) 开区间，不重叠）。 */
export function findTextRanges(text: string, needle: string, limit = 50): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  if (!needle) return out
  let from = 0
  while (out.length < limit) {
    const idx = text.indexOf(needle, from)
    if (idx < 0) break
    out.push({ start: idx, end: idx + needle.length })
    from = idx + needle.length
  }
  return out
}

/** 将文本整体偏移区间换算为 PM 位置（跨文本节点边界时收敛到首个含起始的节点）。 */
export function findAnchorRanges(editor: Editor, text: string, limit = 50): { from: number; to: number }[] {
  const offsets: { pos: number; len: number }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.isText) offsets.push({ pos, len: node.text?.length ?? 0 })
  })
  const docText = editor.state.doc.textContent
  const out: { from: number; to: number }[] = []
  for (const hit of findTextRanges(docText, text, limit)) {
    let acc = 0
    let from = -1
    let to = -1
    for (const o of offsets) {
      if (from < 0 && hit.start < acc + o.len) from = o.pos + Math.max(hit.start - acc, 0)
      if (hit.end <= acc + o.len) {
        to = o.pos + Math.max(hit.end - acc, 0)
        break
      }
      acc += o.len
    }
    if (from >= 0) out.push({ from, to: to >= 0 ? to : from })
  }
  return out
}

/**
 * 定位伏笔在编辑器中的锚点区间：
 * 结合创建时记录的文本偏移（anchorOffset）做歧义消解——
 * 同一锚点文本多次出现时，优先选择距创建位置最近的一次，避免关联错位；
 * 未记录偏移或仅一处出现时退化为文本检索。返回 null 表示锚点已失效（可实时校验）。
 */
export function findClueAnchorRange(
  editor: Editor,
  note: Pick<Note, 'anchorText' | 'anchorOffset'>
): { from: number; to: number } | null {
  if (!note.anchorText) return null
  const ranges = findAnchorRanges(editor, note.anchorText)
  if (ranges.length === 0) return null
  if (ranges.length === 1 || note.anchorOffset == null) return ranges[0]
  let best = ranges[0]
  let bestDist = Infinity
  for (const r of ranges) {
    const dist = Math.abs(r.from - note.anchorOffset)
    if (dist < bestDist) {
      bestDist = dist
      best = r
    }
  }
  return best
}

/**
 * 将当前章节的伏笔锚点文本应用 foreshadow 标记（先清除旧标记再重建，保证状态同步）。
 * 仅处理活跃（未归档）伏笔；归档伏笔不再出现在正文标记中。
 * 先无条件清除旧标记再重建：删除全部伏笔（relevant 为空）时也能同步取消正文标识，
 * 避免残留无效引用标记。仅做装饰性标记，不改变正文文本；通过 applyingMarks 守卫避免触发保存。
 */
export function applyForeshadowMarks(editor: Editor, notes: Note[], seq: number): void {
  const markType = editor.schema.marks.foreshadow
  if (!markType) return
  const docSize = editor.state.doc.content.size
  if (docSize <= 1) return
  const { tr } = editor.state
  tr.removeMark(1, docSize, markType)
  const relevant = notes.filter(
    (n) => n.kind === 'clue' && !n.archived && n.anchorText && n.chapterSeq === seq
  )
  const covered: { from: number; to: number }[] = []
  for (const clue of relevant) {
    const range = findClueAnchorRange(editor, clue)
    if (!range) continue
    if (covered.some((c) => range.from < c.to && c.from < range.to)) continue
    covered.push(range)
    tr.addMark(range.from, range.to, markType.create({ noteId: clue.id, status: clueStatusOf(clue) }))
  }
  editor.view.dispatch(tr)
}

/** 选中并滚动定位到锚点区间（结合创建偏移消歧；返回是否成功）。 */
export function selectAnchorAndFlash(
  editor: Editor | null,
  text: string,
  offset?: number
): boolean {
  if (!editor || !text) return false
  const range = offset != null ? findClueAnchorRange(editor, { anchorText: text, anchorOffset: offset }) : null
  const target = range ?? findAnchorRanges(editor, text, 1)[0]
  if (!target) return false
  editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run()
  return true
}
