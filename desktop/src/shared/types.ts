/** 续言领域类型（主进程 / 渲染进程共享）。 */

export interface WorkMeta {
  id: string
  title: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface ChapterMeta {
  workId: string
  seq: number
  title: string
  /** 相对 data/works/<workId>/chapters/ 的正文文件名 */
  file: string
}

/** 卷容器：作品下用于归组章节的层级单元（M8 章节管理优化）。 */
export interface Volume {
  id: string
  workId: string
  title: string
  /** 卷内章节序号（有序；未分卷章节不在此列） */
  chapterSeqs: number[]
  /** 卷在作品内的排序（升序） */
  order: number
  createdAt: number
  updatedAt: number
}

/** 时间线条目：剧情时间节点（时间描述 + 剧情梗概），正文按 time 文本高亮标注联动。 */
export interface TimelineEntry {
  id: string
  workId: string
  /** 时间描述（可编辑，如「第三年 · 春」；正文标注以此为锚点） */
  time: string
  /** 剧情梗概 */
  summary: string
  /** 条目排序（升序） */
  order: number
  createdAt: number
  updatedAt: number
}

export interface Chapter extends ChapterMeta {
  content: string
}

export interface Settings {
  [key: string]: unknown
}

/** 跨窗口录入参数（M6） */
export interface TyperOptions {
  text: string
  /** 目标窗口标题；留空则写入当前前台窗口 */
  targetWindowTitle?: string
  /** true=快速(200字/0.5s)，false=慢速(100字/5s) */
  fast: boolean
}

export interface TyperState {
  running: boolean
  pos: number
  total: number
  error: string | null
}

export interface ClipboardEntry {
  text: string
  at: number
}

/** 创作知识实体类型（RAG 前置数据层）：角色卡 / 设定 / 伏笔 / 素材。 */
export type NoteKind = 'character' | 'world' | 'clue' | 'material'

export interface Note {
  id: string
  kind: NoteKind
  title: string
  /** 自由标签：角色→身份、设定→分类、伏笔→状态、素材→类型 */
  tag: string
  /** 结构化正文（Markdown） */
  content: string
  /** 关联章节（可选，伏笔/素材常用） */
  chapterSeq?: number
  /** 伏笔锚点：创建时绑定的编辑器原文片段（clue 专用；用于双向联动定位） */
  anchorText?: string
  /** 伏笔锚点在关联章节纯文本中的起始偏移（创建选区时记录，用于歧义消解与实时校验） */
  anchorOffset?: number
  /** 已归档（移入归档池：不出现在活跃列表 / 编辑器标记 / 检索语料；数据完整保留） */
  archived?: boolean
  /** 归档时间戳（ms；恢复归档时清空） */
  archivedAt?: number
  updatedAt: number
}

/** 创作知识列表过滤选项（归档池检索）。 */
export interface NoteListOptions {
  /** true=仅归档；缺省/undefined=仅活跃 */
  archived?: boolean
}

/** 创作知识删除操作日志条目（删除时留存关联数据快照，保障删除可追溯、正文联动可核验）。 */
export interface NoteDeleteLogEntry {
  id: string
  workId: string
  kind: NoteKind
  title: string
  tag: string
  content: string
  chapterSeq?: number
  anchorText?: string
  deletedAt: number
}

/** 批量删除结果：实际删除 / 未找到 / 留存日志。 */
export interface DeleteNotesResult {
  deleted: string[]
  missing: string[]
  log: NoteDeleteLogEntry[]
}

/** 混合检索结果来源。 */
export type SearchSourceKind = 'chapter' | NoteKind

export interface SearchResult {
  kind: SearchSourceKind
  /** chapter: `ch-<seq>`；note: note.id */
  id: string
  title: string
  /** 命中上下文片段 */
  snippet: string
  /** 0-100 归一化相关度 */
  score: number
  chapterSeq?: number
}

export interface SearchQueryRequest {
  workId: string
  query: string
  limit?: number
  /** 启用远程 Embedding 时的配置；为空则纯本地 BM25 */
  embedding?: { baseUrl: string; apiKey: string; model: string } | null
}

/** 章节历史版本快照（手动保存时生成，P2 版本管理）。 */
export interface VersionSnapshot {
  workId: string
  chapterSeq: number
  /** 快照时间戳（ms） */
  ts: number
  /** 版本备注（可选，恢复时由用户填写） */
  note: string
  /** 快照中文字数 */
  charCount: number
  /** 快照正文文件名（相对 versions/<seq>/） */
  file: string
}

// ============================================================ 大纲模块（PRD v1.0）

/** 大纲节点节奏标签（服务故事节奏规划）。 */
export type OutlineBeat =
  | 'opening'
  | 'rising'
  | 'climax'
  | 'twist'
  | 'lull'
  | 'clue'
  | 'ending'
  | 'other'

/** 大纲树节点（总纲 / 卷纲 / 剧情节点，树形层级，数据落 outline.json / outline_nodes 表）。 */
export interface OutlineNode {
  id: string
  workId: string
  /** null = 总纲根节点 */
  parentId: string | null
  title: string
  /** 剧情梗概（Markdown） */
  content: string
  /** 剧情节点 / 卷纲 */
  kind: 'story' | 'volume'
  /** 节奏标签（other 时不展示色标） */
  beat: OutlineBeat
  /** 预估字数（篇幅管控；0 = 未填） */
  targetWords: number
  /** 关联卷（可选） */
  volumeId?: string
  /** 关联章节（点击跳转编辑器） */
  chapterSeqs?: number[]
  /** 涉及角色（关联创作知识 character 卡片 id） */
  characterIds?: string[]
  /** 同级排序（升序） */
  order: number
  createdAt: number
  updatedAt: number
}

/** 章纲：每章一条，承载逐章细纲（数据落 chapter_outlines.json / chapter_outlines 表）。 */
export interface ChapterOutline {
  id: string
  workId: string
  chapterSeq: number
  /** 核心剧情 */
  corePlot: string
  /** 角色互动场景 */
  characterScenes: string
  /** 关键冲突点 */
  conflict: string
  /** 章末钩子（悬念，可选） */
  hook: string
  /** 自由备注（Markdown，可选） */
  content: string
  /** 是否由 AI 提取生成 */
  extracted: boolean
  /** 章节写作状态 */
  status: 'unwritten' | 'writing' | 'written'
  updatedAt: number
}

/** 思维导图节点（树）。 */
export interface MindMapNode {
  id: string
  text: string
  note?: string
  children: MindMapNode[]
}

/** 思维导图（一个作品一张总导图，数据落 mindmap.json / mind_maps 表）。 */
export interface MindMap {
  workId: string
  root: MindMapNode
  updatedAt: number
}

/** 作品字数统计（写作目标板块）：当前作品总字数 / 全库累计总字数（正文 + 备注内容）。 */
export interface WordCountTotals {
  workChars: number
  totalChars: number
}

/** AI 配额账本（每日 100 次，AI 功能全局共享）。 */
export interface AiQuota {
  /** 账本日期 YYYY-MM-DD；跨天懒重置 */
  date: string
  used: number
  /** 每日预算（默认 100） */
  budget: number
}

/** 章纲提取请求（智能章纲提取：单批 ≤50 章）。 */
export interface OutlineExtractRequest {
  workId: string
  /** 提取的章节序号（有序、去重、≤50） */
  seqs: number[]
}

/** 章纲提取结果。 */
export interface OutlineExtractResult {
  /** 成功写入章纲的章节 */
  success: number[]
  /** 失败章节及原因 */
  failed: { seq: number; reason: string }[]
  /** 实际消耗配额次数（= success.length） */
  quotaUsed: number
}

/** 章纲提取进度事件（主→渲染推送）。 */
export interface OutlineExtractProgress {
  done: number
  total: number
  currentSeq: number | null
}
