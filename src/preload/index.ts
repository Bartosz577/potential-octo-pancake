import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

interface ParseFileResult {
  sheets: { name: string; headers?: string[]; rows: string[][]; metadata: Record<string, string> }[]
  encoding: string
  separator?: string
  warnings: string[]
  fileSize: number
}

const api = {
  platform: process.platform,
  openFileDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),
  readFile: (filePath: string): Promise<{ content: string; size: number }> =>
    ipcRenderer.invoke('file:read', filePath),
  readFileAsBuffer: (filePath: string): Promise<{ buffer: number[]; size: number }> =>
    ipcRenderer.invoke('file:readBuffer', filePath),
  parseFile: (filePath: string, encoding?: string): Promise<ParseFileResult> =>
    ipcRenderer.invoke('file:parse', filePath, encoding),
  saveFile: (defaultName: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, content),

  // Error reporting — renderer → main
  logError: (message: string, stack?: string): void =>
    ipcRenderer.send('error:report', message, stack),

  // Auto-update events — main → renderer
  update: {
    onAvailable: (callback: (info: { version: string }) => void): (() => void) => {
      const handler = (_: unknown, info: { version: string }): void => callback(info)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onProgress: (callback: (info: { percent: number }) => void): (() => void) => {
      const handler = (_: unknown, info: { percent: number }): void => callback(info)
      ipcRenderer.on('update:progress', handler)
      return () => ipcRenderer.removeListener('update:progress', handler)
    },
    onDownloaded: (callback: (info: { version: string }) => void): (() => void) => {
      const handler = (_: unknown, info: { version: string }): void => callback(info)
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    },
    installAndRestart: (): void => ipcRenderer.send('update:install')
  },

  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChanged: (callback: (maximized: boolean) => void): (() => void) => {
      const handler = (_: unknown, value: boolean): void => callback(value)
      ipcRenderer.on('window:maximized-changed', handler)
      return () => ipcRenderer.removeListener('window:maximized-changed', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
