import type { Config } from 'tailwindcss'

/**
 * 续言 Design Tokens → Tailwind theme 映射。
 * 依据《GUI设计规范.md》§2 与《技术路线评估与迁移方案.md》§7。
 * 颜色引用 CSS 变量，实现浅/深主题自动切换。
 */
export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)',
          300: 'var(--brand-300)',
          500: 'var(--brand-500)'
        },
        neutral: {
          0: 'var(--neutral-0)',
          50: 'var(--neutral-50)',
          100: 'var(--neutral-100)',
          200: 'var(--neutral-200)',
          300: 'var(--neutral-300)',
          500: 'var(--neutral-500)',
          700: 'var(--neutral-700)',
          900: 'var(--neutral-900)'
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          danger: 'var(--status-danger)'
        }
      },
      fontFamily: {
        ui: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', 'sans-serif'],
        prose: [
          '"Source Han Serif SC"',
          '"Noto Serif CJK SC"',
          '"Songti SC"',
          '"SimSun"',
          'serif'
        ],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace']
      },
      boxShadow: {
        1: '0 1px 2px rgb(16 24 40 / 6%)',
        2: '0 4px 12px rgb(16 24 40 / 10%)',
        3: '0 12px 32px rgb(16 24 40 / 16%)'
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(.4,0,.2,1)'
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms'
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '10px'
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px'
      }
    }
  },
  plugins: []
} satisfies Config
