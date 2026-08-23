import React, { useEffect, useMemo, useState } from 'react'
import type { WorkMeta } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import { useUiStore } from '../../stores/uiStore'
import { useToastStore } from '../../stores/toastStore'
import { Icon, LogoIcon } from '../Icon'
import { WorkCard } from './WorkCard'
import { StatsSection } from './StatsSection'
import { filterWorks, paginate, visiblePages, workGenres } from '../../lib/homeStats'
import { importAsWork } from '../../lib/importers'

const PAGE_SIZE = 8

/** 「打开示例」预置正文（与欢迎页一致，便于首次体验全流程）。 */
const EXAMPLE_MD = `# 第一章 · 序章

夜色如墨，街灯将长街裁成明暗交错的格子。

他站在巷口，手中攥着一张泛黄的车票，目的地一栏早已模糊。

> 一切故事，都始于一次没有归途的出发。

## 出城

列车在黎明前驶出站台。窗外的灯火一盏盏退后，像被风翻过的书页。

## 疑点

车厢尽头，有人正低声念着他的名字。

- 车票的年份是十年前
- 列车时刻表上并不存在这趟班次
`

/** 无作品时的书架空态入口卡（新建 / 导入 / 示例）。 */
function EntryCard({
  icon,
  title,
  desc,
  onClick
}: {
  icon: 'plus' | 'folder' | 'sparkle'
  title: string
  desc: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      className="flex w-[150px] flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-4 shadow-1 transition-all duration-base hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-2 active:scale-[0.98]"
      style={{ touchAction: 'manipulation' }}
      onClick={onClick}
    >
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon name={icon} size={19} />
      </span>
      <span className="text-[13px] font-medium text-neutral-900">{title}</span>
      <span className="text-[11px] text-neutral-500">{desc}</span>
    </button>
  )
}

/**
 * 首页（数据仪表台）：数据统计模块（指标卡 + 周/月/年趋势图）+
 * 作品展览模块（卡片化展示 / 搜索 / 题材分类筛选 / 分页加载，点击卡片进入作品详情）。
 */
export function HomePage(): React.JSX.Element {
  const works = useAppStore((s) => s.works)
  const totalChars = useAppStore((s) => s.totalChars)
  const todayChars = useAppStore((s) => s.todayChars)
  const dailyGoal = useAppStore((s) => s.dailyGoal)
  const dailyStats = useAppStore((s) => s.dailyStats)
  const selectWork = useAppStore((s) => s.selectWork)
  const createWork = useAppStore((s) => s.createWork)
  const createChapter = useAppStore((s) => s.createChapter)
  const saveChapter = useAppStore((s) => s.saveChapter)

  const [keyword, setKeyword] = useState('')
  const [genre, setGenre] = useState('')
  const [page, setPage] = useState(1)

  // 首屏 / 回到首页时校准全库字数与今日统计（与编辑器保存路径共用同一数据源）
  useEffect(() => {
    void useAppStore.getState().refreshWordTotals()
    void useAppStore.getState().loadStats()
  }, [])

  const genres = useMemo(() => workGenres(works), [works])
  const filtered = useMemo(() => filterWorks(works, { keyword, genre }), [works, keyword, genre])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const pageItems = useMemo(() => paginate(filtered, current, PAGE_SIZE), [filtered, current])

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1)
  }, [keyword, genre])

  const openWork = async (w: WorkMeta): Promise<void> => {
    await selectWork(w.id)
    useUiStore.getState().setCentralMode('editor')
  }

  const createExample = async (): Promise<void> => {
    await createWork('示例作品')
    await createChapter('第一章 · 序章')
    await saveChapter(EXAMPLE_MD)
    useToastStore.getState().notify('success', '已创建示例作品')
  }

  // ---------- 书架空态（无任何作品） ----------
  if (works.length === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto bg-[var(--editor-bg)] px-6">
        <div className="flex flex-col items-center gap-2">
          <LogoIcon size={48} />
          <h1 className="text-[20px] font-semibold text-neutral-900">续言 Continuum</h1>
          <p className="text-[12px] text-neutral-500">中文网文创作助手 · 从创建你的第一部作品开始</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <EntryCard
            icon="plus"
            title="新建作品"
            desc="从零开始创作"
            onClick={() => useUiStore.getState().setPromptKind('work')}
          />
          <EntryCard icon="folder" title="导入作品" desc="导入本地 Markdown" onClick={() => void importAsWork()} />
          <EntryCard icon="sparkle" title="打开示例" desc="体验编辑器全流程" onClick={() => void createExample()} />
        </div>
      </section>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[var(--editor-bg)] px-6 py-5">
      {/* 顶部问候 + 快捷新建 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-neutral-900">我的书架</h1>
          <p className="mt-0.5 text-[11px] text-neutral-500">共 {works.length} 部作品 · 数据保存在本地</p>
        </div>
        <button className="btn-primary" onClick={() => useUiStore.getState().setPromptKind('work')}>
          <Icon name="plus" size={15} />
          新建作品
        </button>
      </div>

      {/* 数据统计模块 */}
      <StatsSection
        worksCount={works.length}
        totalChars={totalChars}
        todayChars={todayChars}
        dailyGoal={dailyGoal}
        dailyStats={dailyStats}
      />

      {/* 作品展览模块 */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[14px] font-semibold text-neutral-900">作品展览</h2>

          {/* 搜索 */}
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-300"
            />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索作品名称 / 简介…"
              className="h-[30px] w-[200px] rounded-md border border-neutral-200 bg-neutral-0 pl-8 pr-7 text-[12px] text-neutral-900 outline-none transition-colors duration-fast placeholder:text-neutral-300 focus:border-brand-500"
              aria-label="搜索作品"
            />
            {keyword && (
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-900"
                onClick={() => setKeyword('')}
                title="清除搜索"
                aria-label="清除搜索"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 题材分类筛选 */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-fast ${
              genre === ''
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-500'
                : 'border-neutral-200 bg-neutral-0 text-neutral-500 hover:border-neutral-300 hover:text-neutral-900'
            }`}
            onClick={() => setGenre('')}
            data-testid="genre-chip-all"
          >
            全部
          </button>
          {genres.map((g) => (
            <button
              key={g}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-fast ${
                genre === g
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-500'
                  : 'border-neutral-200 bg-neutral-0 text-neutral-500 hover:border-neutral-300 hover:text-neutral-900'
              }`}
              onClick={() => setGenre(genre === g ? '' : g)}
              data-testid={`genre-chip-${g}`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* 卡片网格（响应式：容器宽度自适应列数） */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 bg-neutral-0 py-14">
            <span className="text-[12px] text-neutral-500">未找到匹配的作品</span>
            <button
              className="text-[12px] text-brand-500 hover:underline"
              onClick={() => {
                setKeyword('')
                setGenre('')
              }}
            >
              清除筛选条件
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {pageItems.map((w) => (
              <WorkCard key={w.id} work={w} onOpen={(work) => void openWork(work)} />
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1">
            <button
              className="rounded-md border border-neutral-200 bg-neutral-0 px-2.5 py-1 text-[11px] text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-neutral-0"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              上一页
            </button>
            {visiblePages(current, totalPages).map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-1 text-[11px] text-neutral-300">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  className={`h-[26px] min-w-[26px] rounded-md border px-1.5 text-[11px] transition-colors duration-fast ${
                    p === current
                      ? 'border-brand-500 bg-brand-500 font-medium text-white'
                      : 'border-neutral-200 bg-neutral-0 text-neutral-500 hover:bg-neutral-100'
                  }`}
                  onClick={() => setPage(p)}
                  aria-current={p === current ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            )}
            <button
              className="rounded-md border border-neutral-200 bg-neutral-0 px-2.5 py-1 text-[11px] text-neutral-500 transition-colors duration-fast hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-neutral-0"
              disabled={current >= totalPages}
              onClick={() => setPage(current + 1)}
            >
              下一页
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
