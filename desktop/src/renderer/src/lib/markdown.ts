import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'

/** markdown-it：加载章节时 Markdown → HTML（供 Tiptap setContent / 预览）。 */
export const markdownIt = new MarkdownIt({ html: false, linkify: true, breaks: false })

/** turndown：保存章节时 Tiptap HTML → Markdown（持久化载体）。 */
export const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
})

/** 中文字数（剔除空白字符）。 */
export function chineseCharCount(text: string): number {
  return text.replace(/\s/g, '').length
}

export interface OutlineHeading {
  level: number
  title: string
}

/** 从 Markdown 提取标题大纲（依据原型「大纲自动从标题提取」；跳过围栏代码块）。 */
export function extractOutline(markdown: string): OutlineHeading[] {
  const items: OutlineHeading[] = []
  let inFence = false
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (/^```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match) {
      items.push({ level: match[1].length, title: match[2].trim() })
    }
  }
  return items
}
