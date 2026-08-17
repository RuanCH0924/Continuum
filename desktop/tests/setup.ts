import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React 18 act 环境标志（React Testing Library 要求）
if (typeof window !== 'undefined') {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
}

// 每个测试后卸载组件树，避免多个 render 叠加导致查询命中多个元素
afterEach(() => {
  cleanup()
})
