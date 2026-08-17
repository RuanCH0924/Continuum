/** 应用版本更新信息（设置 →「关于」展示；按发布日期倒序排列，最新在前）。 */

export interface ChangelogEntry {
  /** 版本号（与 package.json version 对应） */
  version: string
  /** 发布日期 YYYY-MM-DD */
  date: string
  /** 是否当前版本（列表顶部高亮） */
  latest?: boolean
  /** 新增功能描述 */
  features: string[]
  /** 问题修复记录 */
  fixes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2026-08-14',
    latest: true,
    features: [
      '单栏所见即所得编辑器：废弃双栏对比模式，编辑 / 预览 / 源码三模式切换',
      '时间线模块：剧情时间节点增改删与排序，正文高亮标注 ↔ 侧栏条目双向联动',
      '卷层级管理：作品 → 卷 → 章节三级结构，卷增改删 / 排序 / 章节一键归属',
      '伏笔联动：选区创建伏笔，正文标注双向定位与状态同步',
      '多格式导出（PDF / EPUB / DOCX）与插件机制',
      'SQLite 存储引擎（sql.js，与文件引擎接口一致可互换）',
      '全局全文搜索（Ctrl+Shift+F）与章节历史版本管理（每章 50 份快照）',
      'RAG 混合语义检索与 AI 对话知识注入'
    ],
    fixes: [
      '移除双栏对比模式，解决双栏视图下标注与滚动不同步的问题',
      '修复侧栏拖拽调宽与工具栏溢出折叠问题'
    ]
  },
  {
    version: '0.1.0-rc',
    date: '2026-08-13',
    features: [
      'M7 验收：数据化收口、导入（Markdown）与导出（Markdown / TXT）',
      '创作知识数据模型：角色 / 设定 / 伏笔 / 素材四类结构化记录',
      '新增一键启动脚本与中英双语 README'
    ],
    fixes: []
  },
  {
    version: '0.1.0-beta',
    date: '2026-08-11',
    features: [
      '技术路线迁移至 Electron + React + TypeScript（M0–M3 里程碑）',
      '应用骨架、数据存储层（文件引擎）与统一 IPC 协议',
      'Tiptap 块级编辑器与作品 / 章节管理',
      '统一 AI 适配层（OpenAI 兼容：DeepSeek / OpenAI / 硅基流动 / Ollama）'
    ],
    fixes: []
  }
]
