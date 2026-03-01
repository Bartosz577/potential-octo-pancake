import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename } from 'path'
import { readFile, readFile as readFileAsync, writeFile, stat } from 'fs/promises'
import { readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createDefaultRegistry } from '../core/readers/FileReaderRegistry'
import { decodeBuffer } from '../core/encoding/EncodingDetector'
import type { FileEncoding } from '../core/models/types'
import { logError, logInfo } from './logger'
import { initAutoUpdater, installUpdate } from './updater'

const fileRegistry = createDefaultRegistry()

// ── Global error handlers (before app.whenReady) ──

process.on('uncaughtException', (error) => {
  logError('Nieobsługiwany wyjątek w procesie głównym', error)
  dialog.showErrorBox(
    'Błąd aplikacji',
    `Wystąpił nieoczekiwany błąd. Aplikacja może działać niestabilnie.\n\n${error.message}`
  )
})

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  logError('Nieobsłużone odrzucenie Promise', error)
})

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    autoHideMenuBar: true,
    backgroundColor: '#0C0E14',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Window control IPC handlers
  ipcMain.on('window:minimize', () => mainWindow.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow.close())
  ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized())

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-changed', false)
  })

  // ── Renderer error reporting IPC ──
  ipcMain.on('error:report', (_event, message: string, stack?: string) => {
    logError(`[Renderer] ${message}`, stack)
  })

  // ── Auto-update IPC ──
  ipcMain.on('update:install', () => {
    installUpdate()
  })

  // File dialog IPC handler
  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Wybierz pliki danych',
      filters: [
        {
          name: 'Pliki danych',
          extensions: ['txt', 'csv', 'xlsx', 'xls', 'json', 'xml', 'dat', 'tsv']
        }
      ],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  // Read file content IPC handler
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    const content = await readFile(filePath, 'utf-8')
    const stats = await stat(filePath)
    return { content, size: stats.size }
  })

  // Read file as buffer IPC handler (for binary files like xlsx)
  ipcMain.handle('file:readBuffer', async (_event, filePath: string) => {
    const buffer = await readFileAsync(filePath)
    const stats = await stat(filePath)
    return { buffer: Array.from(buffer), size: stats.size }
  })

  // Parse file in main process (avoids Node.js modules in renderer)
  ipcMain.handle('file:parse', async (_event, filePath: string, encoding?: string) => {
    let buffer = readFileSync(filePath)
    const filename = basename(filePath)
    const stats = await stat(filePath)

    let effectiveEncoding = ''

    // If custom encoding specified, re-decode text-based files
    if (encoding && encoding !== 'auto') {
      const ext = filename.split('.').pop()?.toLowerCase() || ''
      if (['txt', 'csv', 'tsv', 'dat'].includes(ext)) {
        const enc = (encoding === 'utf-8-bom' ? 'utf-8' : encoding) as FileEncoding
        const text = decodeBuffer(buffer, enc)
        buffer = Buffer.from(text, 'utf-8')
        effectiveEncoding = encoding
      }
    }

    const result = fileRegistry.read(buffer, filename)

    // Serialize to plain JSON (no Buffer, no class instances)
    return {
      sheets: result.sheets.map((sheet) => ({
        name: sheet.name,
        headers: sheet.headers,
        rows: sheet.rows.map((r) => r.cells),
        metadata: sheet.metadata
      })),
      encoding: effectiveEncoding || result.encoding,
      separator: result.separator,
      warnings: result.warnings.map((w) => w.message),
      fileSize: stats.size
    }
  })

  // Save XML file IPC handler
  ipcMain.handle(
    'dialog:saveFile',
    async (_event, defaultName: string, content: string) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Zapisz plik XML',
        defaultPath: defaultName,
        filters: [{ name: 'Pliki XML', extensions: ['xml'] }]
      })
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, content, 'utf-8')
      return result.filePath
    }
  )

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // ── Initialize auto-updater (production only) ──
  if (!is.dev) {
    initAutoUpdater(mainWindow)
  }

  logInfo('Aplikacja uruchomiona')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('pl.jpk.converter')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
