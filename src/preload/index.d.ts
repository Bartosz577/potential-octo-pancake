import { ElectronAPI } from '@electron-toolkit/preload'

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (maximized: boolean) => void) => () => void
}

interface AppAPI {
  platform: string
  window: WindowAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
