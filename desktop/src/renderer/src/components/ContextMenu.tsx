import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ContextMenuItem =
  | { type: 'item'; label: string; danger?: boolean; disabled?: boolean; onClick?: () => void }
  | { type: 'separator' }
  | { type: 'header'; label: string }

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/** 距视窗边缘的最小留白（px） */
const EDGE_MARGIN = 8
/** jsdom 等无布局环境（offsetWidth/Height 为 0）下的尺寸兜底估算 */
const EST_WIDTH = 180
const EST_HEIGHT = 200

/**
 * 自定义上下文菜单（右键菜单）。
 *
 * - 通过 portal 渲染到 document.body，避免被父容器 overflow 裁剪；
 * - 定位跟随鼠标坐标，并在渲染后按实际尺寸自适应视窗边界，避免溢出；
 * - 支持 item / separator / header 三种条目，item 可标记 danger / disabled；
 * - 点击外部、按下 Esc、滚动或窗口缩放时自动关闭。
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // 渲染后测量实际尺寸并校正位置：优先贴向鼠标，越界时回收到视窗内
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const width = el.offsetWidth || EST_WIDTH
    const height = el.offsetHeight || EST_HEIGHT
    const maxX = window.innerWidth - width - EDGE_MARGIN
    const maxY = window.innerHeight - height - EDGE_MARGIN
    setPos({
      x: Math.max(EDGE_MARGIN, Math.min(x, maxX)),
      y: Math.max(EDGE_MARGIN, Math.min(y, maxY))
    })
  }, [x, y, items])

  // 关闭时机：点击外部（mousedown 捕获阶段）/ Esc / 任意滚动 / 窗口缩放
  useEffect(() => {
    const onPointerDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = (): void => onClose()
    window.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-testid="sidebar-context-menu"
      className="fixed z-[100] min-w-[168px] rounded-md border border-neutral-200 bg-neutral-0 py-1 shadow-1"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={i} role="separator" className="mx-2 my-1 h-px bg-neutral-100" />
        }
        if (item.type === 'header') {
          return (
            <div key={i} className="px-2.5 py-1 text-[10px] text-neutral-400">
              {item.label}
            </div>
          )
        }
        return (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            className={`flex w-full items-center px-2.5 py-1.5 text-left text-[12px] transition-colors duration-fast ${
              item.danger
                ? 'text-status-danger hover:bg-status-danger/10'
                : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
            } disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent`}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
