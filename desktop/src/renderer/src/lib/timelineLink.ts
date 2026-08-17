/**
 * 时间线联动逻辑（M8 时间线模块）。
 *
 * 数据模型：时间线条目（TimelineEntry）的 time 字段作为正文标注锚点。
 * 渲染层在章节加载 / 时间线变化后扫描正文，将匹配文本以 timeline 标记高亮，
 * 点击标记 → 侧栏时间线 Tab 定位对应条目；时间线增删改后全文重建标注，保持同步。
 */

import type { Editor } from '@tiptap/react'
import type { TimelineEntry } from '@shared/types'
import { findAnchorRanges } from './clueLink'

/**
 * 将正文中与时间线条目 time 一致的文本应用 timeline 标记。
 * 先清除旧标记再重建（时间线增删改后自动同步）；仅装饰性标记，不改变正文文本。
 */
export function applyTimelineMarks(editor: Editor, timeline: TimelineEntry[]): void {
  const markType = editor.schema.marks.timeline
  if (!markType) return
  const relevant = timeline
    .map((e) => ({ id: e.id, time: (e.time || '').trim() }))
    .filter((e) => e.time.length > 0)
  const docSize = editor.state.doc.content.size
  if (docSize <= 1) return
  const { tr } = editor.state
  tr.removeMark(1, docSize, markType)
  if (relevant.length === 0) {
    editor.view.dispatch(tr)
    return
  }
  const covered: { from: number; to: number }[] = []
  for (const entry of relevant) {
    for (const range of findAnchorRanges(editor, entry.time)) {
      if (covered.some((c) => range.from < c.to && c.from < range.to)) continue
      covered.push(range)
      tr.addMark(range.from, range.to, markType.create({ entryId: entry.id, time: entry.time }))
    }
  }
  editor.view.dispatch(tr)
}
