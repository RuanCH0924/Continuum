import React, { useMemo } from 'react'
import type { WorkMeta } from '@shared/types'
import { workGenre } from '../../lib/homeStats'

/** 封面渐变色板：按作品 id 哈希稳定取色，同作品恒定、不同作品可区分（无封面图资源时的本地封面方案）。 */
const COVER_PALETTE: [string, string][] = [
  ['#2D7FF9', '#5A9DFF'],
  ['#8B5CF6', '#B48CFF'],
  ['#0EA5A4', '#4ECDC4'],
  ['#F59E0B', '#FBBF24'],
  ['#EF4444', '#F87171'],
  ['#10B981', '#34D399'],
  ['#6366F1', '#818CF8'],
  ['#EC4899', '#F472B6']
]

function paletteOf(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COVER_PALETTE[h % COVER_PALETTE.length]
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 从简介中剔除「题材：xxx」行（题材已独立展示，避免卡片摘要重复）。 */
function stripGenreLine(description: string): string {
  return (description || '')
    .replace(/题材[：:]\s*[^\n]+\n?/g, '')
    .trim()
}

/**
 * 作品卡片：渐变封面（作品名题词）+ 标题 / 题材 / 简介摘要 / 创建时间。
 * PC：hover 上浮 + 封面微放大 + 阴影加深；触屏：点击进入详情（按压轻微缩放反馈）。
 */
export function WorkCard({
  work,
  onOpen
}: {
  work: WorkMeta
  onOpen: (w: WorkMeta) => void
}): React.JSX.Element {
  const [from, to] = useMemo(() => paletteOf(work.id), [work.id])
  const genre = workGenre(work)
  const summary = stripGenreLine(work.description).slice(0, 80)

  return (
    <button
      type="button"
      onClick={() => onOpen(work)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 text-left shadow-1 transition-all duration-base hover:-translate-y-1 hover:border-brand-500 hover:shadow-2 active:scale-[0.98]"
      style={{ touchAction: 'manipulation' }}
      title={`${work.title}（点击进入作品）`}
    >
      {/* 封面：渐变 + 题词 + 题材角标 */}
      <div
        className="relative flex h-[120px] items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        <span className="px-4 text-center text-[20px] font-semibold tracking-wide text-white drop-shadow-sm transition-transform duration-base group-hover:scale-[1.05]">
          {work.title}
        </span>
        {genre && (
          <span className="absolute bottom-2 right-3 max-w-[60%] truncate rounded-sm bg-black/20 px-1.5 py-0.5 text-[10px] text-white/90">
            {genre}
          </span>
        )}
      </div>

      <div className="flex min-h-[110px] flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-neutral-900">{work.title}</span>
          {genre && <span className="shrink-0 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-500">{genre}</span>}
        </div>
        <p className="line-clamp-2 min-h-[33px] text-[11px] leading-[1.5] text-neutral-500">
          {summary || '暂无简介'}
        </p>
        <span className="mt-auto text-[10px] text-neutral-300">创建于 {fmtDate(work.createdAt)}</span>
      </div>
    </button>
  )
}
