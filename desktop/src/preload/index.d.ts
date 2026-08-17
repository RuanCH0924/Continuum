import { ContinuumApi } from './index'

declare global {
  interface Window {
    api: ContinuumApi
  }
}

export {}
