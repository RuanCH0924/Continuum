/**
 * 大纲挂载问答「本书内容」知识库组装（PRD v1.0 §10.2）。
 *
 * 显式引用（大纲节点 / 章节正文）优先；未显式引用时按
 * 「章节正文 → 章纲 → 大纲」优先级全量收集，截断至 maxLen 窗口。
 */

import type { ChapterOutline, Note, OutlineNode } from '@shared/types'
import { useAppStore } from '../../stores/appStore'

/** 引用上下文条目（问答输入区胶囊的数据形态）。 */
export interface ChatScopeRef {
  kind: 'outline' | 'chapter'
  /** outline: 大纲节点 id；chapter: 章节 seq 字符串 */
  id: string
  label: string
}

export interface BookContext {
  /** 注入文本（不含包裹说明，由调用方拼接） */
  content: string
  /** 来源摘要（透明 AI 徽标用，如「本书内容（大纲 ×1 · 章节 ×1）」） */
  sourceSummary: string
}

function section(title: string, lines: string[]): string[] {
  return lines.length > 0 ? [`${title}`, ...lines] : []
}

function sliceTo(texts: string[], maxLen: number): string {
  let out = ''
  for (const t of texts) {
    if (out.length >= maxLen) break
    const remain = maxLen - out.length
    out += (out ? '\n' : '') + (t.length > remain ? t.slice(0, remain) : t)
  }
  return out
}

/**
 * 组装「本书内容」参考上下文。
 * @param refs 显式引用（可空）
 * @param maxLen 注入窗口上限（默认 6000 字）
 */
export async function assembleBookContent(opts: {
  workId: string | null
  outlineNodes: OutlineNode[]
  chapterOutlines: ChapterOutline[]
  notes: Note[]
  refs: ChatScopeRef[]
  maxLen?: number
}): Promise<BookContext> {
  const { workId, outlineNodes, chapterOutlines, notes, refs } = opts
  const maxLen = opts.maxLen ?? 6000
  if (!workId) return { content: '', sourceSummary: '本书内容（无作品上下文）' }

  const refOutline = new Set(refs.filter((r) => r.kind === 'outline').map((r) => r.id))
  const refChapters = new Set(refs.filter((r) => r.kind === 'chapter').map((r) => Number(r.id)))

  // ---- 大纲 / 章纲 / 创作知识（同步可得的本地数据）----
  const outlineLines: string[] = []
  for (const n of outlineNodes) {
    if (refs.length > 0 && !refOutline.has(n.id)) continue
    const content = (n.content ?? '').trim()
    outlineLines.push(`- [大纲] ${n.title}${content ? `：${content}` : ''}`)
  }
  const chapterOutlineLines: string[] = []
  for (const co of chapterOutlines) {
    if (refs.length > 0 && !refChapters.has(co.chapterSeq)) continue
    const fields = [
      co.corePlot ? `核心剧情：${co.corePlot}` : '',
      co.characterScenes ? `角色互动：${co.characterScenes}` : '',
      co.conflict ? `冲突点：${co.conflict}` : '',
      co.hook ? `钩子：${co.hook}` : ''
    ].filter(Boolean)
    chapterOutlineLines.push(`- [章纲] 第${co.chapterSeq}章${fields.length > 0 ? `：${fields.join('；')}` : ''}`)
  }
  const noteLines = notes.map((n) => `- [${noteKindLabel(n.kind)}] ${n.title}：${(n.content ?? '').slice(0, 80)}`)

  // ---- 章节正文（异步读取）----
  const chapterLines: string[] = []
  if (refs.length > 0) {
    for (const seq of Array.from(refChapters).sort((a, b) => a - b)) {
      const content = await window.api.chapters.read(workId, seq).catch(() => '')
      chapterLines.push(`- [章节] 第${seq}章：${(content ?? '').trim().slice(0, 2000)}`)
    }
  } else {
    // 未显式引用：取当前章节正文（若有）
    const meta = useAppStore.getState().currentChapter
    if (meta) {
      const content = await window.api.chapters.read(workId, meta.seq).catch(() => '')
      chapterLines.push(`- [章节] 第${meta.seq}章《${meta.title}》：${(content ?? '').trim().slice(0, 3000)}`)
    }
  }

  // 优先级：章节正文 → 章纲 → 大纲 → 创作知识
  const text = sliceTo([...chapterLines, ...chapterOutlineLines, ...outlineLines, ...noteLines], maxLen)
  const parts: string[] = []
  if (refs.length > 0) parts.push(`引用 ×${refs.length}`)
  else if (outlineNodes.length > 0 || chapterOutlines.length > 0) parts.push('大纲+章纲')
  if (chapterLines.length > 0) parts.push(`章节 ×${chapterLines.length}`)
  return {
    content: text,
    sourceSummary: parts.length > 0 ? `本书内容（${parts.join(' · ')}）` : '本书内容（无匹配内容）'
  }
}

function noteKindLabel(kind: Note['kind']): string {
  return { character: '角色', world: '设定', clue: '伏笔', material: '素材' }[kind] ?? kind
}
