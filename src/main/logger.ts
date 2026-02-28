// ── Logger — file-based error logging with rotation (max 5MB) ──

import { app } from 'electron'
import { join } from 'path'
import {
  appendFileSync,
  statSync,
  renameSync,
  existsSync,
  mkdirSync,
  unlinkSync
} from 'fs'

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB

let logFilePath: string | null = null

function getLogPath(): string {
  if (!logFilePath) {
    const logsDir = app.getPath('logs')
    mkdirSync(logsDir, { recursive: true })
    logFilePath = join(logsDir, 'error.log')
  }
  return logFilePath
}

function rotateIfNeeded(path: string): void {
  try {
    if (!existsSync(path)) return
    const stats = statSync(path)
    if (stats.size > MAX_LOG_SIZE) {
      const backupPath = path + '.old'
      if (existsSync(backupPath)) {
        unlinkSync(backupPath)
      }
      renameSync(path, backupPath)
    }
  } catch {
    // Ignore rotation errors
  }
}

function writeLog(level: string, message: string, details?: string): void {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] [${level}] ${message}${details ? '\n  ' + details : ''}\n`

  try {
    const path = getLogPath()
    rotateIfNeeded(path)
    appendFileSync(path, line)
  } catch {
    // Fallback to console if file logging fails
    console.error(line)
  }
}

export function logError(message: string, error?: Error | string): void {
  const details =
    error instanceof Error
      ? `${error.message}\n  ${error.stack || ''}`
      : error
  writeLog('ERROR', message, details)
}

export function logWarn(message: string): void {
  writeLog('WARN', message)
}

export function logInfo(message: string): void {
  writeLog('INFO', message)
}
