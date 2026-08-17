import React, { useState } from 'react'
import { Icon } from '../Icon'
import { PromptModal } from '../PromptModal'
import { OutlineTreeView } from './OutlineTreeView'
import { ChapterOutlineView } from './ChapterOutlineView'
import { MindMapView } from './MindMapView'
import { useAppStore } from '../../stores/appStore'
import { useUiStore } from '../../stores/uiStore'

/**
 * 大纲工作台（PRD v1.0 §6.1-6.2）：中央「大纲模式」容器。
 * 三种视图（大纲列表 / 章纲 / 思维导图）+ 粒度切换（仅核心节点 / 完整细纲）。
 */
export function OutlineWorkspace(): React.JSX.Element {
  const currentWorkId = useAppStore((s) => s.currentWorkId)
  const works = useAppStore((s) => s.works)
  const createOutlineNode = useAppStore((s) => s.createOutlineNode)
  const setCentralMode = useUiStore((s) => s.setCentralMode)
  const view = useUiStore((s) => s.outlineView)
  const setView = useUiStore((s) => s.setOutlineView)
  const [granular, setGranular] = useState<'core' | 'full'>('full')
  const [newRootOpen, setNewRootOpen] = useState(false)

  const workTitle = works.find((w) => w.id === currentWorkId)?.title ?? '未命名作品'

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-neutral-0">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
        <button
          className="btn-default !px-2.5 !py-1 text-[12px]"
          onClick={() => setCentralMode('editor')}
          title="返回正文写作"
        >
          ← 返回写作
        </button>
        <span className="text-[13px] font-semibold text-neutral-900">大纲工作台 · {workTitle}</span>
        <span className="mx-1 h-[16px] w-px bg-neutral-200" />
        <div className="flex overflow-hidden rounded-md border border-neutral-200">
          {(
            [
              ['list', '大纲列表'],
              ['chapters', '章纲'],
              ['mindmap', '思维导图']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`px-2.5 py-1 text-[12px] transition-colors duration-fast ${
                view === key ? 'bg-brand-50 font-medium text-brand-500' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <>
            <div className="flex overflow-hidden rounded-md border border-neutral-200">
              {(
                [
                  ['core', '仅核心节点'],
                  ['full', '完整细纲']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`px-2 py-1 text-[11px] transition-colors duration-fast ${
                    granular === key ? 'bg-neutral-100 font-medium text-neutral-700' : 'text-neutral-400 hover:bg-neutral-100'
                  }`}
                  onClick={() => setGranular(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="rounded-md px-2 py-1 text-[12px] text-brand-500 transition-colors duration-fast hover:bg-brand-50"
              onClick={() => setNewRootOpen(true)}
            >
              + 新建节点
            </button>
          </>
        )}
      </div>

      {view === 'list' && <OutlineTreeView granular={granular} />}
      {view === 'chapters' && <ChapterOutlineView />}
      {view === 'mindmap' && <MindMapView />}

      {newRootOpen && (
        <PromptModal
          title="新建总纲节点"
          placeholder="节点标题（如：第一卷 · 风起）"
          onConfirm={(v) => {
            void createOutlineNode(v, null)
            setNewRootOpen(false)
          }}
          onCancel={() => setNewRootOpen(false)}
        />
      )}
    </div>
  )
}
