import React, { useRef, useState } from 'react'

interface ResizeHandleProps {
  /** 拖动方向：left = 左侧面板右缘（向右拖变宽）；right = 右侧面板左缘（向左拖变宽） */
  direction: 'left' | 'right'
  /** 当前面板宽度（px） */
  width: number
  min?: number
  max?: number
  onChange: (width: number) => void
  /** 拖动结束回调（用于持久化宽度） */
  onDragEnd?: () => void
}

/**
 * 可拖拽分隔条：按住左右拖动调整相邻面板宽度。
 * 拖动期间将宽度变化实时回传给 onChange；松开鼠标时调用 onDragEnd 持久化。
 */
export function ResizeHandle({
  direction,
  width,
  min = 160,
  max = 640,
  onChange,
  onDragEnd
}: ResizeHandleProps): React.JSX.Element {
  const startX = useRef(0)
  const startWidth = useRef(0)
  const [dragging, setDragging] = useState(false)

  const clamp = (v: number): number => Math.max(min, Math.min(max, v))

  const onMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    startX.current = e.clientX
    startWidth.current = width
    setDragging(true)
    const onMove = (ev: MouseEvent): void => {
      const delta =
        direction === 'left' ? ev.clientX - startX.current : startX.current - ev.clientX
      onChange(clamp(startWidth.current + delta))
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDragging(false)
      onDragEnd?.()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="拖动调整宽度"
      className={`group relative w-[5px] shrink-0 cursor-col-resize ${
        dragging ? 'bg-brand-400/40' : 'hover:bg-brand-400/30'
      }`}
      onMouseDown={onMouseDown}
    >
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-neutral-200 group-hover:bg-brand-400" />
    </div>
  )
}
