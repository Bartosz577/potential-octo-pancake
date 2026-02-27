import { ElectronAPI } from '@electron-toolkit/preload'

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (maximized: boolean) => void) => () => void
}

interface SerializedSheet {
  name: string
  headers?: string[]
  rows: string[][]
  metadata: Record<string, string>
}

interface SerializedFileReadResult {
  sheets: SerializedSheet[]
  encoding: string
  separator?: string
  warnings: string[]
  fileSize: number
}

interface AppAPI {
  platform: string
  openFileDialog: () => Promise<string[]>
  readFile: (filePath: string) => Promise<{ content: string; size: number }>
  readFileAsBuffer: (filePath: string) => Promise<{ buffer: number[]; size: number }>
  parseFile: (filePath: string) => Promise<SerializedFileReadResult>
  saveFile: (defaultName: string, content: string) => Promise<string | null>
  window: WindowAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
