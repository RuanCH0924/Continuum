/**
 * Tiptap 自定义扩展（M8）：
 * - ChapterTitle：章节标题块（编辑器初始化自动插入的章节名文本块，带 seq 绑定）
 * - ForeshadowMark：伏笔标记（高亮绑定的原文片段，带 noteId 与状态色）
 * - TimelineMark：时间线标注（高亮正文中与时间线条目 time 一致的文本，带 entryId）
 */

import { Mark, mergeAttributes, Node } from '@tiptap/core'

/** 章节标题块节点：渲染为带 data-chapter-title 的段落，文本块可正常编辑。 */
export const ChapterTitle = Node.create({
  name: 'chapterTitle',
  group: 'block',
  content: 'inline*',
  defining: true,
  selectable: true,

  addAttributes() {
    return {
      /** 绑定章节序号（用于章节重命名时同步标题块） */
      seq: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-seq'),
        renderHTML: (attrs) => ({ 'data-seq': attrs.seq ?? null })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'p[data-chapter-title]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      mergeAttributes(HTMLAttributes, { 'data-chapter-title': 'true', class: 'chapter-title-block' }),
      0
    ]
  }
})

/** 伏笔标记：以 mark 包裹绑定的原文片段，颜色随状态（已埋设/进行中/已回收）变化。 */
export const ForeshadowMark = Mark.create({
  name: 'foreshadow',
  inclusive: false,

  addAttributes() {
    return {
      noteId: { default: null },
      status: { default: 'other' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-foreshadow]',
        getAttrs: (el) => ({
          noteId: (el as HTMLElement).getAttribute('data-note-id'),
          status: (el as HTMLElement).getAttribute('data-status') ?? 'other'
        })
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const status = HTMLAttributes.status ?? 'other'
    return [
      'mark',
      mergeAttributes(HTMLAttributes, {
        'data-foreshadow': 'true',
        'data-note-id': HTMLAttributes.noteId ?? '',
        'data-status': status,
        class: `foreshadow-mark foreshadow-${status}`
      }),
      0
    ]
  }
})

/** 时间线标注：以 mark 包裹正文中与时间线条目 time 一致的文本，点击可定位到时间线条目。 */
export const TimelineMark = Mark.create({
  name: 'timeline',
  inclusive: false,

  addAttributes() {
    return {
      entryId: { default: null },
      time: { default: '' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-timeline]',
        getAttrs: (el) => ({
          entryId: (el as HTMLElement).getAttribute('data-timeline-id'),
          time: (el as HTMLElement).getAttribute('data-time') ?? ''
        })
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const time = HTMLAttributes.time ?? ''
    return [
      'mark',
      mergeAttributes(HTMLAttributes, {
        'data-timeline': 'true',
        'data-timeline-id': HTMLAttributes.entryId ?? '',
        'data-time': time,
        title: `时间线：${time}`,
        class: 'timeline-mark'
      }),
      0
    ]
  }
})
