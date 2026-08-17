import { app, ipcMain, type BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc'
import type {
  Note,
  NoteKind,
  NoteListOptions,
  OutlineExtractProgress,
  OutlineExtractRequest,
  SearchQueryRequest,
  TimelineEntry,
  VersionSnapshot
} from '../../shared/types'
import { CorpusSearch } from '../services/search'
import type { IWorksStore } from '../services/store'
import { AiQuotaService } from '../services/quota'
import { ExtractService } from '../services/extract'
import { computeWordTotals } from '../services/stats'
import { parseMindMapText } from '../../shared/mindmap-parse'

/** 注册全部业务 IPC 处理器（works / chapters / settings / 大纲 / 章纲 / 导图 / 配额）。 */
export function registerIpc(
  store: IWorksStore,
  opts: { getWindow: () => BrowserWindow | null }
): void {
  // ---------------- works ----------------
  ipcMain.handle(IPC.WorksList, () => store.listWorks())
  ipcMain.handle(IPC.WorksCreate, (_e, title: string, description?: string) =>
    store.createWork(title ?? '', description ?? '')
  )
  ipcMain.handle(IPC.WorksRename, (_e, id: string, title: string) =>
    store.renameWork(id, title)
  )
  ipcMain.handle(IPC.WorksDelete, (_e, id: string) => store.deleteWork(id))

  // ---------------- chapters ----------------
  ipcMain.handle(IPC.ChaptersList, (_e, workId: string) => store.listChapters(workId))
  ipcMain.handle(IPC.ChaptersCreate, (_e, workId: string, title: string) =>
    store.createChapter(workId, title ?? '未命名章节')
  )
  ipcMain.handle(
    IPC.ChaptersSave,
    (_e, workId: string, seq: number, title: string, content: string) =>
      store.saveChapter(workId, seq, title, content)
  )
  ipcMain.handle(IPC.ChaptersRename, (_e, workId: string, seq: number, title: string) =>
    store.renameChapter(workId, seq, title)
  )
  ipcMain.handle(IPC.ChaptersDelete, (_e, workId: string, seq: number) =>
    store.deleteChapter(workId, seq)
  )
  ipcMain.handle(
    IPC.ChaptersRead,
    (_e, workId: string, seq: number) => {
      const meta = store.getChapter(workId, seq)
      return meta ? store.readChapter(meta) : ''
    }
  )

  // ---------------- volumes（卷：章节层级容器） ----------------
  ipcMain.handle(IPC.VolumesList, (_e, workId: string) => store.listVolumes(workId))
  ipcMain.handle(IPC.VolumesCreate, (_e, workId: string, title: string) =>
    store.createVolume(workId, title ?? '未命名卷')
  )
  ipcMain.handle(IPC.VolumesRename, (_e, workId: string, id: string, title: string) =>
    store.renameVolume(workId, id, title)
  )
  ipcMain.handle(IPC.VolumesDelete, (_e, workId: string, id: string) =>
    store.deleteVolume(workId, id)
  )
  ipcMain.handle(IPC.VolumesReorder, (_e, workId: string, orderedIds: string[]) =>
    store.reorderVolumes(workId, orderedIds ?? [])
  )
  ipcMain.handle(IPC.VolumesSetChapters, (_e, workId: string, id: string, chapterSeqs: number[]) =>
    store.setVolumeChapters(workId, id, chapterSeqs ?? [])
  )

  // ---------------- timeline（时间线：剧情时间节点） ----------------
  ipcMain.handle(IPC.TimelineList, (_e, workId: string) => store.listTimeline(workId))
  ipcMain.handle(IPC.TimelineSave, (_e, workId: string, entry: TimelineEntry) =>
    store.saveTimelineEntry(workId, entry)
  )
  ipcMain.handle(IPC.TimelineDelete, (_e, workId: string, id: string) =>
    store.deleteTimelineEntry(workId, id)
  )
  ipcMain.handle(IPC.TimelineReorder, (_e, workId: string, orderedIds: string[]) =>
    store.reorderTimeline(workId, orderedIds ?? [])
  )

  // ---------------- notes（创作知识：角色/设定/伏笔/素材） ----------------
  ipcMain.handle(
    IPC.NotesList,
    (_e, workId: string, kind?: NoteKind, opts?: NoteListOptions) =>
      store.listNotes(workId, kind, opts)
  )
  ipcMain.handle(IPC.NotesSave, (_e, workId: string, note: Note) => store.saveNote(workId, note))
  ipcMain.handle(IPC.NotesDelete, (_e, workId: string, id: string) => store.deleteNote(workId, id))
  ipcMain.handle(IPC.NotesDeleteBatch, (_e, workId: string, ids: string[]) =>
    store.deleteNotes(workId, ids ?? [])
  )
  ipcMain.handle(IPC.NotesDeleteLogs, (_e, workId: string) => store.listNoteDeleteLogs(workId))

  // ---------------- search（混合 RAG：本地 BM25 + 可选 Embedding） ----------------
  const search = new CorpusSearch(store)
  ipcMain.handle(IPC.SearchQuery, (_e, req: SearchQueryRequest) =>
    search.search(req.workId, req.query, { limit: req.limit, embedding: req.embedding ?? null })
  )

  // ---------------- versions（历史版本快照：手动保存生成 / 列表 / 读取） ----------------
  ipcMain.handle(IPC.VersionsSave, (_e, workId: string, seq: number, content: string, note?: string) =>
    store.saveVersion(workId, seq, content ?? '', note ?? '')
  )
  ipcMain.handle(IPC.VersionsList, (_e, workId: string, seq: number) => store.listVersions(workId, seq))
  ipcMain.handle(IPC.VersionsRead, (_e, meta: VersionSnapshot) => store.readVersion(meta))

  // ---------------- settings ----------------
  ipcMain.handle(IPC.SettingsGet, (_e, key: string) => store.getSetting(key))
  ipcMain.handle(IPC.SettingsSet, (_e, key: string, value: unknown) => {
    store.setSetting(key, value)
    return true
  })

  // ---------------- 应用信息与字数统计（设置中心：关于 / 写作目标） ----------------
  ipcMain.handle(IPC.AppVersion, () => app.getVersion())
  ipcMain.handle(IPC.StatsTotals, (_e, workId: string | null) => computeWordTotals(store, workId))

  // ---------------- outlines（大纲树：总纲/卷纲/剧情节点） ----------------
  ipcMain.handle(IPC.OutlinesList, (_e, workId: string) => store.listOutlineNodes(workId))
  ipcMain.handle(IPC.OutlinesSave, (_e, workId: string, node: unknown) =>
    store.saveOutlineNode(workId, node as Parameters<IWorksStore['saveOutlineNode']>[1])
  )
  ipcMain.handle(IPC.OutlinesDelete, (_e, workId: string, id: string) =>
    store.deleteOutlineNode(workId, id)
  )
  ipcMain.handle(
    IPC.OutlinesReorder,
    (_e, workId: string, parentId: string | null, orderedIds: string[]) =>
      store.reorderOutlineNodes(workId, parentId, orderedIds ?? [])
  )

  // ---------------- chapter-outlines（章纲） ----------------
  ipcMain.handle(IPC.ChapterOutlinesList, (_e, workId: string) => store.listChapterOutlines(workId))
  ipcMain.handle(IPC.ChapterOutlinesSave, (_e, workId: string, outline: unknown) =>
    store.saveChapterOutline(workId, outline as Parameters<IWorksStore['saveChapterOutline']>[1])
  )
  ipcMain.handle(IPC.ChapterOutlinesDelete, (_e, workId: string, chapterSeq: number) =>
    store.deleteChapterOutline(workId, chapterSeq)
  )

  // ---------------- mindmap（思维导图） ----------------
  ipcMain.handle(IPC.MindMapGet, (_e, workId: string) => store.getMindMap(workId))
  ipcMain.handle(IPC.MindMapSave, (_e, workId: string, map: unknown) =>
    store.saveMindMap(workId, map as Parameters<IWorksStore['saveMindMap']>[1])
  )

  // ---------------- 智能章纲提取 + AI 配额 ----------------
  const quota = new AiQuotaService(store)
  const extract = new ExtractService(store, quota)
  ipcMain.handle(IPC.QuotaGet, () => quota.get())
  ipcMain.handle(IPC.ChapterOutlinesExtract, (_e, req: OutlineExtractRequest) => {
    const win = opts.getWindow()
    const pushProgress = (p: OutlineExtractProgress): void => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.ChapterOutlinesExtractProgress, p)
      }
    }
    return extract.extract(req, pushProgress)
  })
}
