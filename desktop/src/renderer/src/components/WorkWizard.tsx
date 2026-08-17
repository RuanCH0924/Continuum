import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { useToastStore } from '../stores/toastStore'

const LENGTHS: { key: 'short' | 'medium' | 'long'; label: string; hint: string }[] = [
  { key: 'short', label: '短篇', hint: '< 5 万字' },
  { key: 'medium', label: '中篇', hint: '5–20 万字' },
  { key: 'long', label: '长篇', hint: '> 20 万字' }
]

/** 新建作品向导（A5）：作品名 / 副标题 / 题材 / 篇幅 / 目标字数 / 简介 / 卷名 / 立即建第一章。 */
export function WorkWizard({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [genre, setGenre] = useState('')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [goal, setGoal] = useState('2500')
  const [desc, setDesc] = useState('')
  const [volume, setVolume] = useState('第一卷')
  const [createFirst, setCreateFirst] = useState(true)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const submit = async (): Promise<void> => {
    if (!name.trim() || saving) return
    setSaving(true)
    const app = useAppStore.getState()
    const description = [subtitle.trim(), genre.trim() ? `题材：${genre.trim()}` : '', desc.trim()].filter(Boolean).join('\n')
    await app.createWork(name.trim(), description)
    const g = Number(goal)
    if (g > 0) await window.api.settings.set('dailyGoal', g)
    if (createFirst) {
      await app.createChapter(`${volume.trim() || '第一卷'} · 第一章`)
    }
    useToastStore.getState().notify('success', `已创建作品「${name.trim()}」`)
    onClose()
  }

  const inputCls =
    'w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        className="max-h-[88vh] w-[520px] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">新建作品</span>
          <span className="ml-2 text-[11px] text-neutral-500">填写创作规划，可稍后修改</span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-[12px]">
          <label className="block">
            <span className="mb-1 block text-neutral-500">作品名 *</span>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="如：雪山隐狐" className={inputCls} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-neutral-500">副标题</span>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="可选" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-neutral-500">题材</span>
              <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="如：武侠 / 都市 / 玄幻" className={inputCls} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-neutral-500">篇幅</span>
              <div className="flex gap-1.5">
                {LENGTHS.map((l) => (
                  <button
                    key={l.key}
                    title={l.hint}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors duration-fast ${
                      length === l.key
                        ? 'border-brand-500 bg-brand-50 font-medium text-brand-500'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300'
                    }`}
                    onClick={() => setLength(l.key)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-neutral-500">每日目标字数</span>
              <input value={goal} onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, ''))} placeholder="2500" className={inputCls} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-neutral-500">作品简介</span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="一句话简介（可选）"
              className="resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
              style={{ width: '100%' }}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-neutral-500">默认卷名</span>
            <input value={volume} onChange={(e) => setVolume(e.target.value)} className={inputCls} />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-neutral-700">
            <input
              type="checkbox"
              checked={createFirst}
              onChange={(e) => setCreateFirst(e.target.checked)}
              className="accent-[var(--brand-500)]"
            />
            创建后立即新建第一章
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button className="btn-default" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" disabled={!name.trim() || saving} onClick={() => void submit()}>
            {saving ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
