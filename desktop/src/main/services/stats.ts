/**
 * 作品字数统计服务（写作目标板块数据源）。
 *
 * 统计口径（与渲染层 chineseCharCount 完全一致，避免口径分叉）：
 *   - 字数 = 去除全部空白后的字符数（含中文 / 英文 / 标点与 Markdown 语法标记，
 *     与编辑器「当前章节字数」展示一致）；
 *   - 覆盖范围 = 作品内全部章节正文 + 创作知识（角色 / 设定 / 伏笔 / 素材）备注内容；
 *   - 归档知识实体计入累计（数据完整保留，属创作产出），且不重复计入。
 */

import type { IWorksStore } from './store'
import type { WordCountTotals } from '../../shared/types'

/** 与渲染层 markdown.chineseCharCount 对齐的字数口径。 */
export function charCountOf(text: string): number {
  return text.replace(/\s/g, '').length
}

/**
 * 计算字数统计：
 * - workChars：指定作品（缺省则 0）的正文 + 备注内容总字数；
 * - totalChars：全部作品累计总字数。
 * 单个作品统计在循环内聚合，避免章节 / 知识实体重复计数。
 */
export function computeWordTotals(store: IWorksStore, workId?: string | null): WordCountTotals {
  let totalChars = 0
  let workChars = 0
  for (const work of store.listWorks()) {
    let sum = 0
    for (const chapter of store.listChapters(work.id)) {
      sum += charCountOf(store.readChapter(chapter))
    }
    // 活跃 + 归档两条路径互斥，合计即全量备注内容
    for (const note of [...store.listNotes(work.id), ...store.listNotes(work.id, undefined, { archived: true })]) {
      sum += charCountOf(note.content ?? '')
    }
    totalChars += sum
    if (work.id === workId) workChars = sum
  }
  return { workChars, totalChars }
}
