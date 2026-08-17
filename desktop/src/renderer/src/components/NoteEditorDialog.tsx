import React, { useEffect, useRef, useState } from 'react'
import type { Note, NoteKind } from '@shared/types'
import { useAppStore } from '../stores/appStore'
import { useToastStore } from '../stores/toastStore'
import { ConfirmDialog } from './ConfirmDialog'

export const KIND_LABEL: Record<NoteKind, string> = {
  character: '角色',
  world: '设定',
  clue: '伏笔',
  material: '素材'
}

const TAG_PLACEHOLDER: Record<NoteKind, string> = {
  character: '身份：主角 / 配角 / 反派…',
  world: '分类：地理 / 社会 / 规则 / 历史…',
  clue: '状态：已埋设 / 进行中 / 已回收…',
  material: '类型：灵感 / 描写 / 对话…'
}

/** 创作知识实体编辑弹窗（新建 / 编辑；角色卡、设定、伏笔、素材共用）。 */
export function NoteEditorDialog({
  kind,
  note,
  onClose,
  preset
}: {
  kind: NoteKind
  note: Note | null
  onClose: () => void
  /** 选区「创建伏笔」预设：预填标题 / 绑定原文锚点与章节 / 记录锚点偏移供精准关联 */
  preset?: { title?: string; anchorText?: string; anchorOffset?: number; chapterSeq?: number }
}): React.JSX.Element {
  const [title, setTitle] = useState(note?.title ?? preset?.title ?? '')
  const [tag, setTag] = useState(note?.tag ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [chapterSeq, setChapterSeq] = useState(
    note?.chapterSeq != null ? String(note.chapterSeq) : preset?.chapterSeq != null ? String(preset.chapterSeq) : ''
  )
  const [confirmDel, setConfirmDel] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const saveNote = useAppStore((s) => s.saveNote)
  const deleteNote = useAppStore((s) => s.deleteNote)
  const chapters = useAppStore((s) => s.chapters)
  const notify = useToastStore((s) => s.notify)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  /** 关联章节标题（解析 seq → 标题；章节已删除时回退占位）。 */
  const chapterTitle = chapterSeq
    ? chapters.find((c) => c.seq === Number(chapterSeq))?.title ?? `第${chapterSeq}章（已删除）`
    : ''

  /** 创建页 → 编辑页：跳转到关联章节（含锚点时定位闪烁），实现双向合规跳转。 */
  const jumpToChapter = (): void => {
    const seq = Number(chapterSeq)
    if (!chapterSeq.trim() || !Number.isFinite(seq) || seq <= 0) {
      notify('warning', '请先关联章节后再定位正文')
      return
    }
    onClose()
    void (async () => {
      const app = useAppStore.getState()
      await app.selectChapter(seq)
      if (preset?.anchorText) {
        // 通过 pendingAnchor 信号定位：编辑器加载后自动选中并滚动（含实时校验提示）
        void app.locateClue({
          id: '',
          kind: 'clue',
          title: title.trim() || (preset.title ?? ''),
          tag,
          content,
          chapterSeq: seq,
          anchorText: preset.anchorText,
          anchorOffset: preset.anchorOffset,
          updatedAt: 0
        } as Note)
      }
    })()
  }

  const save = async (): Promise<void> => {
    if (!title.trim()) {
      notify('warning', '请输入标题')
      return
    }
    const seq = chapterSeq.trim() ? Number(chapterSeq.trim()) : undefined
    const saved = await saveNote({
      id: note?.id ?? '',
      kind,
      title: title.trim(),
      tag: tag.trim(),
      content,
      chapterSeq: seq && seq > 0 ? seq : undefined,
      // 选区创建伏笔：携带原文锚点与偏移，与编辑器选中文本建立唯一绑定
      ...(preset?.anchorText ? { anchorText: preset.anchorText, anchorOffset: preset.anchorOffset } : {}),
      updatedAt: note?.updatedAt ?? 0
    })
    notify('success', `已保存${KIND_LABEL[kind]}「${title.trim()}」`)
    // 正文编辑场景创建伏笔：保存后跳转编辑器并实时校验锚点关联（可追溯、可校验）
    if (kind === 'clue' && preset?.anchorText && saved.anchorText) {
      onClose()
      void useAppStore.getState().locateClue(saved)
      return
    }
    onClose()
  }

  const remove = async (): Promise<void> => {
    if (!note) return
    setConfirmDel(false)
    await deleteNote(note.id)
    notify('info', `已删除「${note.title}」`)
    onClose()
  }

  const seqInputDisabled = preset?.chapterSeq != null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        className="w-[520px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">
            {note ? `编辑${KIND_LABEL[kind]}` : `新建${KIND_LABEL[kind]}`}
          </span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-[12px]">
          <label className="block">
            <span className="mb-1 block text-neutral-500">标题</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${KIND_LABEL[kind]}名称`}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-neutral-500">标签</span>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder={TAG_PLACEHOLDER[kind]}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-neutral-500">
                关联章节{kind === 'clue' && preset?.chapterSeq != null ? '（由选区自动绑定）' : '（可选）'}
              </span>
              <select
                value={chapterSeq}
                onChange={(e) => setChapterSeq(e.target.value)}
                disabled={seqInputDisabled}
                title={seqInputDisabled ? '选区创建时自动绑定当前章节' : '选择关联章节（点击定位正文）'}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500 disabled:text-neutral-400"
              >
                <option value="">未关联</option>
                {!chapters.some((c) => c.seq === Number(chapterSeq)) && chapterSeq && (
                  <option value={chapterSeq}>{chapterTitle}</option>
                )}
                {chapters.map((c) => (
                  <option key={c.seq} value={c.seq}>
                    第{c.seq}章 · {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {kind === 'clue' && (preset?.anchorText || note?.anchorText) && (
            <div className="rounded-md border border-brand-500/30 bg-brand-50/60 px-3 py-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-brand-500">
                  {preset?.anchorText ? '原文锚点（已与编辑器选中文本绑定）' : '原文锚点'}
                  {chapterTitle ? ` · ${chapterTitle}` : ''}
                </span>
                {chapterSeq && (
                  <button
                    className="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] text-brand-500 transition-colors duration-fast hover:bg-brand-50"
                    onClick={jumpToChapter}
                    title="跳转到关联章节正文（选中锚点）"
                  >
                    定位到正文 →
                  </button>
                )}
              </div>
              <p className="line-clamp-3 text-[12px] leading-[1.7] text-neutral-700">
                「{preset?.anchorText ?? note?.anchorText}」
              </p>
            </div>
          )}

          {kind !== 'clue' && chapterSeq && (
            <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-[11px] text-neutral-500">关联章节：{chapterTitle}</span>
              <button
                className="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] text-brand-500 transition-colors duration-fast hover:bg-brand-50"
                onClick={jumpToChapter}
                title="跳转到关联章节正文"
              >
                定位到正文 →
              </button>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-neutral-500">内容（支持 Markdown）</span>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`${KIND_LABEL[kind]}详细内容…`}
              className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] leading-[1.7] text-neutral-900 outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3">
          {note ? (
            <button
              className="rounded-md px-3 py-1.5 text-[12px] text-status-danger hover:bg-status-danger/10"
              onClick={() => setConfirmDel(true)}
            >
              删除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-default" onClick={onClose}>
              取消
            </button>
            <button className="btn-primary" onClick={() => void save()}>
              保存
            </button>
          </div>
        </div>
      </div>

      {confirmDel && note && (
        <ConfirmDialog
          title={`删除${KIND_LABEL[kind]}`}
          message={`确定要删除「${note.title}」吗？删除后将同步清除正文中对应的伏笔标记（已留存删除日志快照）。此操作不可恢复。`}
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  )
}
