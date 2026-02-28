// ── Auto-updater — electron-updater integration ──

import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import { logInfo, logError } from './logger'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    logInfo('Sprawdzanie aktualizacji...')
  })

  autoUpdater.on('update-available', (info) => {
    logInfo(`Dostępna aktualizacja: v${info.version}`)
    mainWindow.webContents.send('update:available', {
      version: info.version
    })
  })

  autoUpdater.on('update-not-available', () => {
    logInfo('Brak nowych aktualizacji')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:progress', {
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    logInfo(`Aktualizacja pobrana: v${info.version}`)
    mainWindow.webContents.send('update:downloaded', {
      version: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    logError('Błąd aktualizacji', err)
  })

  // Check on startup (delay 10s to not block app init)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 10_000)

  // Periodic check
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, CHECK_INTERVAL_MS)
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
