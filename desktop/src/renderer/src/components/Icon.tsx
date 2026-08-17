import React from 'react'

/** 续言线性图标集（SVG path 移植自 Python 版 icons.py，stroke 走 currentColor）。 */
export type IconName =
  | 'logo'
  | 'search'
  | 'sun'
  | 'moon'
  | 'command'
  | 'bell'
  | 'immersive'
  | 'help'
  | 'book'
  | 'folder'
  | 'plus'
  | 'trash'
  | 'sparkle'
  | 'chevron-down'
  | 'send'
  | 'text'
  | 'heading'
  | 'quote'
  | 'list'
  | 'list-ol'
  | 'undo'
  | 'redo'
  | 'link'
  | 'image'
  | 'code'
  | 'table'
  | 'user'
  | 'globe'
  | 'flag'
  | 'grid'
  | 'check'
  | 'close'
  | 'settings'

const PATHS: Record<IconName, string> = {
  logo: '<path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.2 4.4-3 5.8V19h-8v-4.2C6.2 13.4 5 11.5 5 9a7 7 0 0 1 7-7z"/><path d="M9.5 22h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  command:
    '<path d="M18 9a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  immersive:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  folder: '<path d="M2 4h6l2 3h12v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  quote: '<path d="M3 21c3-1 5-4 5-8V5H3v8h4"/><path d="M15 21c3-1 5-4 5-8V5h-5v8h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  'list-ol': '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2M4 12h3l-3 4h3"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  user: '<path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  settings:
    '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

export function Icon({
  name,
  size = 18,
  className
}: {
  name: IconName
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      className={className}
      aria-hidden="true"
    >
      <g dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
    </svg>
  )
}

/** 品牌 LOGO：渐变圆角方块 + 笔锋（依据原型 C-1）。 */
export function LogoIcon({ size = 22, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2D7FF9" />
          <stop offset="1" stopColor="#5A9DFF" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#brandGrad)" />
      <path
        d="M12 6a4.5 4.5 0 0 1 4.5 4.5c0 1.8-.9 3.1-2.2 4V17h-4.6v-2.5C8.4 13.6 7.5 12.3 7.5 10.5A4.5 4.5 0 0 1 12 6z"
        fill="#fff"
      />
      <path d="M9.7 20h4.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
