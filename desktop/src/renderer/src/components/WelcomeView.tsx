import React, { useState } from 'react'
import { Icon, LogoIcon } from './Icon'
import { PromptModal } from './PromptModal'
import { useAppStore } from '../stores/appStore'
import { importAsWork } from '../lib/importers'

/** 「打开示例」预置正文（演示大纲提取 / 富文本能力）。 */
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
      className="flex w-[170px] flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-0 p-5 shadow-1 transition-all duration-base hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-2"
      onClick={onClick}
    >
      <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon name={icon} size={20} />
      </span>
      <span className="text-[13px] font-medium text-neutral-900">{title}</span>
      <span className="text-[11px] text-neutral-500">{desc}</span>
    </button>
  )
}

/** 无作品欢迎页：新建 / 导入 / 示例 三入口（数据化落地 M0 原型欢迎态）。 */
export function WelcomeView(): React.JSX.Element {
  const [prompt, setPrompt] = useState(false)
  const createWork = useAppStore((s) => s.createWork)
  const createChapter = useAppStore((s) => s.createChapter)
  const saveChapter = useAppStore((s) => s.saveChapter)

  const createExample = async (): Promise<void> => {
    await createWork('示例作品')
    await createChapter('第一章 · 序章')
    await saveChapter(EXAMPLE_MD)
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto bg-[var(--editor-bg)] px-6">
      <div className="flex flex-col items-center gap-3">
        <LogoIcon size={56} />
        <h1 className="text-[22px] font-semibold text-neutral-900">续言 Continuum</h1>
        <p className="text-[13px] text-neutral-500">中文网文创作助手 · 自由书写，随处连载</p>
      </div>

      <div className="flex gap-4">
        <EntryCard
          icon="plus"
          title="新建作品"
          desc="从零开始创作"
          onClick={() => setPrompt(true)}
        />
        <EntryCard
          icon="folder"
          title="导入作品"
          desc="导入本地 Markdown"
          onClick={() => void importAsWork()}
        />
        <EntryCard
          icon="sparkle"
          title="打开示例"
          desc="体验编辑器全流程"
          onClick={() => void createExample()}
        />
      </div>

      {prompt && (
        <PromptModal
          title="新建作品"
          placeholder="作品名称"
          onConfirm={(v) => void createWork(v)}
          onCancel={() => setPrompt(false)}
        />
      )}
    </section>
  )
}
