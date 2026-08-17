import type { ChapterMeta, WorkMeta } from '@shared/types'
import { markdownIt } from './markdown'

/** Markdown → 纯文本（去掉标题/引用/列表等行首标记，TXT 导出用）。 */
export function mdToPlain(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      const t = line.trim()
      if (/^#{1,6}\s+/.test(t)) return t.replace(/^#{1,6}\s+/, '')
      if (/^>\s?/.test(t)) return t.replace(/^>\s?/, '')
      if (/^[-*]\s+/.test(t)) return t.replace(/^[-*]\s+/, '· ')
      if (/^```/.test(t)) return ''
      return line
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export interface ChapterExportItem {
  meta: ChapterMeta
  content: string
}

/** 作品级 Markdown：书名 + 各章节（章节标题 + 正文）。 */
export function buildWorkMarkdown(work: WorkMeta, chapters: ChapterExportItem[]): string {
  const parts = [`# 《${work.title}》`, '']
  for (const c of chapters) {
    parts.push(`## ${c.meta.title}`, '', c.content.trim(), '')
  }
  return parts.join('\n').replace(/\n{3,}$/, '\n')
}

/** 多格式导出（PDF/EPUB/DOCX）的章节数据：Markdown 正文 + HTML/XHTML 渲染片段。 */
export interface ExportBookChapter {
  title: string
  content: string
  html: string
  xhtml: string
}

export interface ExportBookData {
  defaultName: string
  title: string
  chapters: ExportBookChapter[]
}

/** 构建作品多格式导出数据（标题 + 章节 Markdown/HTML/XHTML）。 */
export function buildWorkBookData(work: WorkMeta, chapters: ChapterExportItem[]): ExportBookData {
  return {
    defaultName: `${work.title}.pdf`,
    title: work.title,
    chapters: chapters.map((c) => ({
      title: c.meta.title,
      content: c.content,
      html: markdownIt.render(c.content),
      xhtml: markdownIt.render(c.content)
    }))
  }
}
