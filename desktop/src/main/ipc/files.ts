import { BrowserWindow, dialog, ipcMain } from 'electron'
import { basename } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import JSZip from 'jszip'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { IPC } from '../../shared/ipc'

export interface ImportedMarkdown {
  name: string
  content: string
}

export interface ExportResult {
  canceled: boolean
  path?: string
}

export interface ExportBookRequest {
  defaultName: string
  title: string
  /** 章节：PDF 用 html（完整片段）；DOCX 用 content（Markdown）；EPUB 用 xhtml（片段） */
  chapters: { title: string; html?: string; content?: string; xhtml?: string }[]
}

function saveDialog(
  win: BrowserWindow | null,
  options: Electron.SaveDialogOptions
): Promise<{ canceled: boolean; filePath?: string }> {
  return (win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)) as Promise<{
    canceled: boolean
    filePath?: string
  }>
}

/** 注册文件导入 / 多格式导出 IPC（Markdown 导入 + MD/TXT/PDF/EPUB/DOCX 导出）。 */
export function registerFilesIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.ImportMarkdown, async (): Promise<ImportedMarkdown | null> => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: '导入 Markdown',
      filters: [{ name: 'Markdown / 文本', extensions: ['md', 'markdown', 'txt'] }],
      properties: ['openFile']
    }
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (res.canceled || res.filePaths.length === 0) return null
    const file = res.filePaths[0]
    const name = basename(file).replace(/\.(md|markdown|txt)$/i, '')
    try {
      const content = readFileSync(file, 'utf-8')
      return { name, content }
    } catch (err) {
      return null
    }
  })

  ipcMain.handle(
    IPC.ExportSave,
    async (_e, opts: { defaultName: string; content: string; kind: 'md' | 'txt' }): Promise<ExportResult> => {
      const win = getWindow()
      const options: Electron.SaveDialogOptions = {
        title: '导出',
        defaultPath: opts.defaultName,
        filters:
          opts.kind === 'md'
            ? [{ name: 'Markdown', extensions: ['md'] }]
            : [{ name: '文本', extensions: ['txt'] }]
      }
      const res = await saveDialog(win, options)
      if (res.canceled || !res.filePath) return { canceled: true }
      try {
        writeFileSync(res.filePath, opts.content, 'utf-8')
        return { canceled: false, path: res.filePath }
      } catch (err) {
        return { canceled: true }
      }
    }
  )

  // ---------------- PDF：隐藏窗口渲染 HTML → printToPDF ----------------
  ipcMain.handle(IPC.ExportPdf, async (_e, req: ExportBookRequest): Promise<ExportResult> => {
    const win = getWindow()
    const options: Electron.SaveDialogOptions = {
      title: '导出 PDF',
      defaultPath: req.defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    }
    const res = await saveDialog(win, options)
    if (res.canceled || !res.filePath) return { canceled: true }
    try {
      const body = req.chapters
        .map((c) => `<h2>${c.title}</h2>${c.html ?? ''}`)
        .join('')
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:"Source Han Serif SC","SimSun",serif;font-size:12pt;line-height:1.9;color:#1a1d24;}
        h1{font-size:20pt;text-align:center;margin:24px 0;}h2{font-size:16pt;margin:20px 0 10px;}
        p{margin:0 0 10px;text-indent:2em;}pre{white-space:pre-wrap;background:#f7f8fa;padding:10px;}
        table{border-collapse:collapse;}td,th{border:1px solid #ccc;padding:4px 8px;}
        blockquote{border-left:3px solid #ccc;margin:0 0 10px;padding-left:10px;color:#555;}
      </style></head><body><h1>《${req.title}》</h1>${body}</body></html>`
      const hidden = new BrowserWindow({ show: false })
      await hidden.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      const data = await hidden.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
      })
      hidden.destroy()
      writeFileSync(res.filePath, data)
      return { canceled: false, path: res.filePath }
    } catch (err) {
      return { canceled: true }
    }
  })

  // ---------------- EPUB：jszip 组装 EPUB3 结构 ----------------
  ipcMain.handle(IPC.ExportEpub, async (_e, req: ExportBookRequest): Promise<ExportResult> => {
    const win = getWindow()
    const options: Electron.SaveDialogOptions = {
      title: '导出 EPUB',
      defaultPath: req.defaultName,
      filters: [{ name: 'EPUB', extensions: ['epub'] }]
    }
    const res = await saveDialog(win, options)
    if (res.canceled || !res.filePath) return { canceled: true }
    try {
      const zip = new JSZip()
      // mimetype 必须为 STORE 压缩且是首文件
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
      zip.folder('META-INF')!.file(
        'container.xml',
        `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
      )
      const items = req.chapters
        .map((c, i) => {
          const id = `ch${i + 1}`
          const href = `chapters/${String(i + 1).padStart(3, '0')}.xhtml`
          return { id, href, title: c.title }
        })
        .concat([{ id: 'nav', href: 'toc.xhtml', title: '目录' }])
      const manifest = items
        .map((it) => `<item id="${it.id}" href="${it.href}" media-type="application/xhtml+xml"${it.id === 'nav' ? ' properties="nav"' : ''}/>`)
        .join('\n')
      const spine = items.map((it) => `<itemref idref="${it.id}"/>`).join('\n')
      zip.folder('OEBPS')!.file(
        'content.opf',
        `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">continuum-${Date.now()}</dc:identifier><dc:title>${req.title}</dc:title><dc:language>zh-CN</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest>\n${manifest}\n</manifest><spine>\n${spine}\n</spine></package>`
      )
      zip.folder('OEBPS')!.file(
        'toc.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>目录</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>${items
          .filter((it) => it.id !== 'nav')
          .map((it) => `<li><a href="${it.href}">${it.title}</a></li>`)
          .join('')}</ol></nav></body></html>`
      )
      req.chapters.forEach((c, i) => {
        const name = `${String(i + 1).padStart(3, '0')}.xhtml`
        zip.folder('OEBPS')!.folder('chapters')!.file(
          name,
          `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${c.title}</title></head><body>${c.xhtml ?? c.html ?? ''}</body></html>`
        )
      })
      const buffer = await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' })
      writeFileSync(res.filePath, buffer)
      return { canceled: false, path: res.filePath }
    } catch (err) {
      return { canceled: true }
    }
  })

  // ---------------- DOCX：docx 库生成（Markdown 行解析） ----------------
  ipcMain.handle(IPC.ExportDocx, async (_e, req: ExportBookRequest): Promise<ExportResult> => {
    const win = getWindow()
    const options: Electron.SaveDialogOptions = {
      title: '导出 DOCX',
      defaultPath: req.defaultName,
      filters: [{ name: 'Word 文档', extensions: ['docx'] }]
    }
    const res = await saveDialog(win, options)
    if (res.canceled || !res.filePath) return { canceled: true }
    try {
      const children: Paragraph[] = [
        new Paragraph({ alignment: 'center', heading: HeadingLevel.TITLE, children: [new TextRun({ text: `《${req.title}》`, size: 36 })], spacing: { after: 320 } })
      ]
      for (const c of req.chapters) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(c.title)] }))
        for (const raw of (c.content ?? '').split('\n')) {
          const line = raw.trim()
          if (!line) continue
          if (/^###\s+/.test(line)) {
            children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(line.replace(/^###\s+/, ''))] }))
          } else if (/^##\s+/.test(line)) {
            children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.replace(/^##\s+/, ''))] }))
          } else if (/^#\s+/.test(line)) {
            children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.replace(/^#\s+/, ''))] }))
          } else if (/^[-*]\s+/.test(line)) {
            children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(line.replace(/^[-*]\s+/, ''))] }))
          } else {
            children.push(new Paragraph({ children: [new TextRun(line)] }))
          }
        }
      }
      const doc = new Document({ sections: [{ children }] })
      const buffer = await Packer.toBuffer(doc)
      writeFileSync(res.filePath, buffer)
      return { canceled: false, path: res.filePath }
    } catch (err) {
      return { canceled: true }
    }
  })
}
