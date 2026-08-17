import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ChapterMeta,
  ChapterOutline,
  ClipboardEntry,
  DeleteNotesResult,
  MindMap,
  Note,
  NoteDeleteLogEntry,
  NoteKind,
  NoteListOptions,
  OutlineExtractProgress,
  OutlineExtractRequest,
  OutlineExtractResult,
  OutlineNode,
  SearchQueryRequest,
  SearchResult,
  Settings,
  TimelineEntry,
  TyperOptions,
  TyperState,
  VersionSnapshot,
  Volume,
  WorkMeta
} from '../shared/types'

export interface ExportBookRequest {
  defaultName: string
  title: string
  chapters: { title: string; html?: string; content?: string; xhtml?: string }[]
}

/** 主进程能力桥（安全白名单，M1 覆盖 works/chapters/settings；M6 覆盖辅助工具）。 */
const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node
  },
  app: {
    /** 应用版本号（package.json version，主进程读取） */
    version: (): Promise<string> => ipcRenderer.invoke(IPC.AppVersion)
  },
  stats: {
    /** 作品字数统计：当前作品总字数 / 全部作品累计总字数（正文 + 备注内容） */
    totals: (workId: string | null): Promise<{ workChars: number; totalChars: number }> =>
      ipcRenderer.invoke(IPC.StatsTotals, workId)
  },
  works: {
    list: (): Promise<WorkMeta[]> => ipcRenderer.invoke(IPC.WorksList),
    create: (title: string, description?: string): Promise<WorkMeta> =>
      ipcRenderer.invoke(IPC.WorksCreate, title, description),
    rename: (id: string, title: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.WorksRename, id, title),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.WorksDelete, id)
  },
  chapters: {
    list: (workId: string): Promise<ChapterMeta[]> => ipcRenderer.invoke(IPC.ChaptersList, workId),
    create: (workId: string, title: string): Promise<ChapterMeta> =>
      ipcRenderer.invoke(IPC.ChaptersCreate, workId, title),
    save: (workId: string, seq: number, title: string, content: string): Promise<ChapterMeta> =>
      ipcRenderer.invoke(IPC.ChaptersSave, workId, seq, title, content),
    rename: (workId: string, seq: number, title: string): Promise<ChapterMeta | null> =>
      ipcRenderer.invoke(IPC.ChaptersRename, workId, seq, title),
    delete: (workId: string, seq: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC.ChaptersDelete, workId, seq),
    read: (workId: string, seq: number): Promise<string> =>
      ipcRenderer.invoke(IPC.ChaptersRead, workId, seq)
  },
  volumes: {
    list: (workId: string): Promise<Volume[]> => ipcRenderer.invoke(IPC.VolumesList, workId),
    create: (workId: string, title: string): Promise<Volume> =>
      ipcRenderer.invoke(IPC.VolumesCreate, workId, title),
    rename: (workId: string, id: string, title: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.VolumesRename, workId, id, title),
    delete: (workId: string, id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.VolumesDelete, workId, id),
    reorder: (workId: string, orderedIds: string[]): Promise<boolean> =>
      ipcRenderer.invoke(IPC.VolumesReorder, workId, orderedIds),
    setChapters: (workId: string, id: string, chapterSeqs: number[]): Promise<boolean> =>
      ipcRenderer.invoke(IPC.VolumesSetChapters, workId, id, chapterSeqs)
  },
  timeline: {
    list: (workId: string): Promise<TimelineEntry[]> => ipcRenderer.invoke(IPC.TimelineList, workId),
    save: (workId: string, entry: TimelineEntry): Promise<TimelineEntry> =>
      ipcRenderer.invoke(IPC.TimelineSave, workId, entry),
    delete: (workId: string, id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.TimelineDelete, workId, id),
    reorder: (workId: string, orderedIds: string[]): Promise<boolean> =>
      ipcRenderer.invoke(IPC.TimelineReorder, workId, orderedIds)
  },
  settings: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke(IPC.SettingsGet, key),
    set: (key: string, value: unknown): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SettingsSet, key, value)
  },
  tools: {
    showWindow: (): Promise<boolean> => ipcRenderer.invoke(IPC.WindowShow),
    setTopmost: (value: boolean): Promise<boolean> => ipcRenderer.invoke(IPC.ToolsTopmostSet, value),
    typer: {
      start: (opts: TyperOptions): Promise<boolean> => ipcRenderer.invoke(IPC.TyperStart, opts),
      stop: (): Promise<boolean> => ipcRenderer.invoke(IPC.TyperStop),
      onState: (cb: (s: TyperState) => void): (() => void) => {
        const listener = (_e: Electron.IpcRendererEvent, s: TyperState): void => cb(s)
        ipcRenderer.on(IPC.TyperState, listener)
        return () => ipcRenderer.removeListener(IPC.TyperState, listener)
      }
    },
    clipboard: {
      setEnabled: (value: boolean): Promise<boolean> =>
        ipcRenderer.invoke(IPC.ClipboardSetEnabled, value),
      read: (): Promise<string> => ipcRenderer.invoke(IPC.ClipboardRead),
      onPush: (cb: (entry: ClipboardEntry) => void): (() => void) => {
        const listener = (_e: Electron.IpcRendererEvent, entry: ClipboardEntry): void => cb(entry)
        ipcRenderer.on(IPC.ClipboardPush, listener)
        return () => ipcRenderer.removeListener(IPC.ClipboardPush, listener)
      }
    }
  },
  files: {
    importMarkdown: (): Promise<{ name: string; content: string } | null> =>
      ipcRenderer.invoke(IPC.ImportMarkdown),
    exportSave: (opts: {
      defaultName: string
      content: string
      kind: 'md' | 'txt'
    }): Promise<{ canceled: boolean; path?: string }> => ipcRenderer.invoke(IPC.ExportSave, opts),
    exportPdf: (req: ExportBookRequest): Promise<{ canceled: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC.ExportPdf, req),
    exportEpub: (req: ExportBookRequest): Promise<{ canceled: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC.ExportEpub, req),
    exportDocx: (req: ExportBookRequest): Promise<{ canceled: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC.ExportDocx, req)
  },
  notes: {
    list: (workId: string, kind?: NoteKind, opts?: NoteListOptions): Promise<Note[]> =>
      ipcRenderer.invoke(IPC.NotesList, workId, kind, opts),
    save: (workId: string, note: Note): Promise<Note> => ipcRenderer.invoke(IPC.NotesSave, workId, note),
    delete: (workId: string, id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.NotesDelete, workId, id),
    /** 批量删除（含归档条目）：主进程留存删除操作日志（数据快照）。 */
    deleteBatch: (workId: string, ids: string[]): Promise<DeleteNotesResult> =>
      ipcRenderer.invoke(IPC.NotesDeleteBatch, workId, ids),
    /** 删除操作日志（按删除时间倒序，供追溯核验）。 */
    deleteLogs: (workId: string): Promise<NoteDeleteLogEntry[]> =>
      ipcRenderer.invoke(IPC.NotesDeleteLogs, workId)
  },
  search: {
    query: (req: SearchQueryRequest): Promise<SearchResult[]> => ipcRenderer.invoke(IPC.SearchQuery, req)
  },
  history: {
    save: (workId: string, seq: number, content: string, note?: string): Promise<VersionSnapshot> =>
      ipcRenderer.invoke(IPC.VersionsSave, workId, seq, content, note),
    list: (workId: string, seq: number): Promise<VersionSnapshot[]> =>
      ipcRenderer.invoke(IPC.VersionsList, workId, seq),
    read: (meta: VersionSnapshot): Promise<string> => ipcRenderer.invoke(IPC.VersionsRead, meta)
  },
  outlines: {
    list: (workId: string): Promise<OutlineNode[]> => ipcRenderer.invoke(IPC.OutlinesList, workId),
    save: (workId: string, node: OutlineNode): Promise<OutlineNode> =>
      ipcRenderer.invoke(IPC.OutlinesSave, workId, node),
    delete: (workId: string, id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.OutlinesDelete, workId, id),
    reorder: (workId: string, parentId: string | null, orderedIds: string[]): Promise<boolean> =>
      ipcRenderer.invoke(IPC.OutlinesReorder, workId, parentId, orderedIds)
  },
  chapterOutlines: {
    list: (workId: string): Promise<ChapterOutline[]> =>
      ipcRenderer.invoke(IPC.ChapterOutlinesList, workId),
    save: (workId: string, outline: ChapterOutline): Promise<ChapterOutline> =>
      ipcRenderer.invoke(IPC.ChapterOutlinesSave, workId, outline),
    delete: (workId: string, chapterSeq: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC.ChapterOutlinesDelete, workId, chapterSeq),
    extract: (req: OutlineExtractRequest): Promise<OutlineExtractResult> =>
      ipcRenderer.invoke(IPC.ChapterOutlinesExtract, req),
    onExtractProgress: (cb: (p: OutlineExtractProgress) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, p: OutlineExtractProgress): void => cb(p)
      ipcRenderer.on(IPC.ChapterOutlinesExtractProgress, listener)
      return () => ipcRenderer.removeListener(IPC.ChapterOutlinesExtractProgress, listener)
    }
  },
  mindmap: {
    get: (workId: string): Promise<MindMap | null> => ipcRenderer.invoke(IPC.MindMapGet, workId),
    save: (workId: string, map: MindMap): Promise<MindMap> =>
      ipcRenderer.invoke(IPC.MindMapSave, workId, map),
    import: (workId: string, text: string): Promise<{ map: MindMap; fixed: number }> =>
      ipcRenderer.invoke(IPC.MindMapImport, workId, text)
  },
  quota: {
    get: (): Promise<{ date: string; used: number; budget: number }> =>
      ipcRenderer.invoke(IPC.QuotaGet)
  },
  plugins: {
    list: (): Promise<{ name: string; version: string; description: string }[]> =>
      ipcRenderer.invoke(IPC.PluginsList)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ContinuumApi = typeof api
export type { Settings }
