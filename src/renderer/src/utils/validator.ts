import type { ParsedFile, JpkType } from '../types'
import { validatePolishNip, normalizeNip } from './nipValidator'

export type Severity = 'error' | 'warning' | 'info'

export interface ValidationItem {
  id: string
  severity: Severity
  message: string
  details?: string
}

export interface ValidationLevel {
  level: number
  title: string
  items: ValidationItem[]
}

export interface ValidationReport {
  levels: ValidationLevel[]
  errorCount: number
  warningCount: number
  infoCount: number
}

// Per-type column config for validation
interface TypeValidationConfig {
  nipIndex: number | null
  dateIndices: number[]
  decimalIndices: number[]
}

const TYPE_CONFIGS: Record<JpkType, TypeValidationConfig> = {
  JPK_VDEK: {
    nipIndex: 2,
    dateIndices: [5],
    decimalIndices: [45, 46, 47]
  },
  JPK_FA: {
    nipIndex: 10,
    dateIndices: [1],
    decimalIndices: [12, 13, 27]
  },
  JPK_MAG: {
    nipIndex: null,
    dateIndices: [2, 4],
    decimalIndices: [3, 11, 13, 14]
  }
}

function parseDecimal(value: string): number {
  if (!value || value.trim() === '') return 0
  return parseFloat(value.replace(',', '.')) || 0
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// --- Level 1: File-level validation ---

function validateLevel1(file: ParsedFile): ValidationItem[] {
  const items: ValidationItem[] = []

  // Pipe separator — always true since our parser splits on |
  items.push({
    id: 'l1-separator',
    severity: 'info',
    message: 'Separator | wykryty poprawnie'
  })

  // Consistent column count
  const expected = file.columnCount
  let bad = 0
  const badRows: number[] = []

  for (let i = 0; i < file.rows.length; i++) {
    if (file.rows[i].length !== expected) {
      bad++
      if (badRows.length < 10) badRows.push(i + 1)
    }
  }

  if (bad === 0) {
    items.push({
      id: 'l1-columns',
      severity: 'info',
      message: `Spójna liczba kolumn: ${expected} we wszystkich ${file.rowCount} wierszach`
    })
  } else {
    items.push({
      id: 'l1-columns',
      severity: 'error',
      message: `Niespójna liczba kolumn w ${bad} wierszach`,
      details: `Oczekiwano ${expected} kolumn. Problematyczne wiersze: ${badRows.join(', ')}${bad > 10 ? '…' : ''}`
    })
  }

  return items
}

// --- Level 2: Data validation ---

function validateLevel2(file: ParsedFile): ValidationItem[] {
  const items: ValidationItem[] = []
  const config = TYPE_CONFIGS[file.jpkType]

  // NIP validation
  if (config.nipIndex !== null) {
    let valid = 0
    let brak = 0
    let invalid = 0
    const invalidSamples: { row: number; nip: string }[] = []

    for (let i = 0; i < file.rows.length; i++) {
      const raw = file.rows[i][config.nipIndex] || ''
      const normalized = normalizeNip(raw)

      if (raw === 'brak' || raw.trim() === '') {
        brak++
      } else if (normalized.length === 10 && validatePolishNip(normalized)) {
        valid++
      } else if (/^[A-Z]{2}\d+$/.test(raw.replace(/[\s-]/g, ''))) {
        // Foreign NIP (country prefix + digits)
        valid++
      } else {
        invalid++
        if (invalidSamples.length < 5) {
          invalidSamples.push({ row: i + 1, nip: raw })
        }
      }
    }

    if (valid > 0) {
      items.push({
        id: 'l2-nip-valid',
        severity: 'info',
        message: `${valid} poprawnych NIP-ów`
      })
    }

    if (brak > 0) {
      items.push({
        id: 'l2-nip-brak',
        severity: 'warning',
        message: `${brak}× NIP „brak" lub pusty`,
        details: 'Dopuszczalne dla osób fizycznych, ale wymaga weryfikacji'
      })
    }

    if (invalid > 0) {
      items.push({
        id: 'l2-nip-invalid',
        severity: 'error',
        message: `${invalid} nieprawidłowych NIP-ów`,
        details: invalidSamples.map((s) => `Wiersz ${s.row}: „${s.nip}"`).join(', ')
      })
    }
  }

  // Date validation
  if (config.dateIndices.length > 0) {
    let validDates = 0
    let invalidDates = 0
    const badSamples: { row: number; value: string }[] = []

    for (const colIdx of config.dateIndices) {
      for (let i = 0; i < file.rows.length; i++) {
        const val = (file.rows[i][colIdx] || '').trim()
        if (val === '') continue

        if (DATE_REGEX.test(val)) {
          validDates++
        } else {
          invalidDates++
          if (badSamples.length < 5) {
            badSamples.push({ row: i + 1, value: val })
          }
        }
      }
    }

    if (invalidDates === 0 && validDates > 0) {
      items.push({
        id: 'l2-dates',
        severity: 'info',
        message: `Wszystkie daty w formacie YYYY-MM-DD (${validDates})`
      })
    } else if (invalidDates > 0) {
      items.push({
        id: 'l2-dates',
        severity: 'error',
        message: `${invalidDates} dat w nieprawidłowym formacie`,
        details: badSamples.map((s) => `Wiersz ${s.row}: „${s.value}"`).join(', ')
      })
    }
  }

  // Decimal validation
  if (config.decimalIndices.length > 0) {
    let validDecimals = 0
    let invalidDecimals = 0
    const badSamples: { row: number; value: string }[] = []

    for (const colIdx of config.decimalIndices) {
      for (let i = 0; i < file.rows.length; i++) {
        const val = (file.rows[i][colIdx] || '').trim()
        if (val === '') continue

        const normalized = val.replace(',', '.')
        if (isNaN(parseFloat(normalized))) {
          invalidDecimals++
          if (badSamples.length < 5) {
            badSamples.push({ row: i + 1, value: val })
          }
        } else {
          validDecimals++
        }
      }
    }

    if (invalidDecimals === 0 && validDecimals > 0) {
      items.push({
        id: 'l2-decimals',
        severity: 'info',
        message: `Kwoty parsowalne poprawnie (${validDecimals} wartości)`
      })
    } else if (invalidDecimals > 0) {
      items.push({
        id: 'l2-decimals',
        severity: 'error',
        message: `${invalidDecimals} nieprawidłowych kwot`,
        details: badSamples.map((s) => `Wiersz ${s.row}: „${s.value}"`).join(', ')
      })
    }
  }

  return items
}

// --- Level 3: Control sums ---

function validateLevel3(file: ParsedFile): ValidationItem[] {
  const items: ValidationItem[] = []
  const fmt = (n: number): string =>
    n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  switch (file.jpkType) {
    case 'JPK_VDEK': {
      const sumK20 = file.rows.reduce((acc, row) => acc + parseDecimal(row[47] || ''), 0)
      items.push({
        id: 'l3-vdek-k20',
        severity: 'info',
        message: `Suma kontrolna K_20 (VAT): ${fmt(sumK20)}`,
        details: `Obliczona z ${file.rowCount} wierszy`
      })
      break
    }
    case 'JPK_FA': {
      const sumP15 = file.rows.reduce((acc, row) => acc + parseDecimal(row[27] || ''), 0)
      items.push({
        id: 'l3-fa-p15',
        severity: 'info',
        message: `Suma kontrolna P_15: ${fmt(sumP15)}`,
        details: `Obliczona z ${file.rowCount} wierszy`
      })
      break
    }
    case 'JPK_MAG': {
      const uniqueWZ = new Set(file.rows.map((row) => row[2] || '').filter(Boolean))
      items.push({
        id: 'l3-mag-wz',
        severity: 'info',
        message: `Unikalne dokumenty WZ: ${uniqueWZ.size}`,
        details: `Spośród ${file.rowCount} pozycji`
      })
      break
    }
  }

  return items
}

// --- Public API ---

export function validateFile(file: ParsedFile): ValidationReport {
  const level1 = validateLevel1(file)
  const level2 = validateLevel2(file)
  const level3 = validateLevel3(file)

  const all = [...level1, ...level2, ...level3]

  return {
    levels: [
      { level: 1, title: 'Plik', items: level1 },
      { level: 2, title: 'Dane', items: level2 },
      { level: 3, title: 'Sumy kontrolne', items: level3 }
    ],
    errorCount: all.filter((i) => i.severity === 'error').length,
    warningCount: all.filter((i) => i.severity === 'warning').length,
    infoCount: all.filter((i) => i.severity === 'info').length
  }
}

export function validateFiles(files: ParsedFile[]): {
  reports: Map<string, ValidationReport>
  totalErrors: number
  totalWarnings: number
} {
  const reports = new Map<string, ValidationReport>()
  let totalErrors = 0
  let totalWarnings = 0

  for (const file of files) {
    const report = validateFile(file)
    reports.set(file.id, report)
    totalErrors += report.errorCount
    totalWarnings += report.warningCount
  }

  return { reports, totalErrors, totalWarnings }
}
