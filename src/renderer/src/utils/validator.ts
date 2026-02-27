import type { ParsedFile, JpkType } from '../types'
import type { ColumnMapping } from '../../../core/mapping/AutoMapper'
import { getFieldDefinitions } from '../../../core/mapping/JpkFieldDefinitions'
import { validatePolishNip, normalizeNip } from './nipValidator'

export type Severity = 'error' | 'warning' | 'info'
export type ValidationCategory = 'STRUKTURA' | 'MERYTORYKA' | 'SUMY_KONTROLNE'

export interface AutoFix {
  rowIndex: number
  colIndex: number
  oldValue: string
  newValue: string
}

export interface ValidationItem {
  id: string
  category: ValidationCategory
  severity: Severity
  message: string
  details?: string
  autoFixable: boolean
  fixes: AutoFix[]
}

export interface ValidationGroup {
  category: ValidationCategory
  title: string
  items: ValidationItem[]
}

export interface ValidationReport {
  groups: ValidationGroup[]
  errorCount: number
  warningCount: number
  infoCount: number
  autoFixCount: number
}

// --- Helpers ---

function parseDecimal(value: string): number {
  if (!value || value.trim() === '') return 0
  return parseFloat(value.replace(',', '.')) || 0
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const DATE_FIXABLE_REGEX = /^(\d{2})[./](\d{2})[./](\d{4})$/

interface MappedColumns {
  nip: number[]
  nipCountryCol: number | null  // KodKontrahenta column index (if mapped)
  date: number[]
  decimal: number[]
}

function getMappedColumnsByType(
  mappings: ColumnMapping[],
  jpkType: string,
  subType: string
): MappedColumns {
  const fields = getFieldDefinitions(jpkType, subType)
  const fieldMap = new Map(fields.map((f) => [f.name, f]))

  const nip: number[] = []
  let nipCountryCol: number | null = null
  const date: number[] = []
  const decimal: number[] = []

  for (const m of mappings) {
    const field = fieldMap.get(m.targetField)
    if (!field) continue
    switch (field.type) {
      case 'nip':
        nip.push(m.sourceColumn)
        break
      case 'country':
        nipCountryCol = m.sourceColumn
        break
      case 'date':
        date.push(m.sourceColumn)
        break
      case 'decimal':
        decimal.push(m.sourceColumn)
        break
    }
  }

  return { nip, nipCountryCol, date, decimal }
}

// Key sum fields per JPK type
const KEY_SUM_FIELDS: Record<JpkType, string[]> = {
  JPK_VDEK: ['K_19', 'K_20'],
  JPK_FA: ['P_15'],
  JPK_MAG: ['WartoscPozycji'],
  JPK_WB: ['KwotaOperacji']
}

// --- STRUKTURA ---

function validateStruktura(
  file: ParsedFile,
  mappings: ColumnMapping[],
  jpkType: string,
  subType: string
): ValidationItem[] {
  const items: ValidationItem[] = []

  // Column count consistency
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
      id: 'str-columns',
      category: 'STRUKTURA',
      severity: 'info',
      message: `Spójna liczba kolumn: ${expected} we wszystkich ${file.rowCount} wierszach`,
      autoFixable: false,
      fixes: []
    })
  } else {
    items.push({
      id: 'str-columns',
      category: 'STRUKTURA',
      severity: 'error',
      message: `Niespójna liczba kolumn w ${bad} wierszach`,
      details: `Oczekiwano ${expected} kolumn. Wiersze: ${badRows.join(', ')}${bad > 10 ? '\u2026' : ''}`,
      autoFixable: false,
      fixes: []
    })
  }

  // Required fields mapping
  const fields = getFieldDefinitions(jpkType, subType)
  const requiredFields = fields.filter((f) => f.required)
  const mappedTargets = new Set(mappings.map((m) => m.targetField))
  const unmapped = requiredFields.filter((f) => !mappedTargets.has(f.name))

  if (unmapped.length === 0 && requiredFields.length > 0) {
    items.push({
      id: 'str-required',
      category: 'STRUKTURA',
      severity: 'info',
      message: `Wszystkie wymagane pola JPK mają przypisane kolumny (${requiredFields.length})`,
      autoFixable: false,
      fixes: []
    })
  } else if (unmapped.length > 0) {
    items.push({
      id: 'str-required',
      category: 'STRUKTURA',
      severity: 'error',
      message: `${unmapped.length} wymaganych pól bez przypisania`,
      details: unmapped.map((f) => f.name).join(', '),
      autoFixable: false,
      fixes: []
    })
  }

  // Format info
  if (file.format) {
    items.push({
      id: 'str-format',
      category: 'STRUKTURA',
      severity: 'info',
      message: `Format: ${file.format.toUpperCase()}${file.encoding ? `, kodowanie: ${file.encoding}` : ''}`,
      autoFixable: false,
      fixes: []
    })
  }

  return items
}

// --- MERYTORYKA ---

function validateMerytoryka(
  file: ParsedFile,
  mappings: ColumnMapping[],
  jpkType: string,
  subType: string
): ValidationItem[] {
  const items: ValidationItem[] = []
  const { nip, nipCountryCol, date, decimal } = getMappedColumnsByType(mappings, jpkType, subType)

  // NIP validation
  for (const colIdx of nip) {
    let valid = 0
    let pesel = 0
    let foreign = 0
    let brak = 0
    let invalid = 0
    const invalidSamples: { row: number; nip: string }[] = []

    for (let i = 0; i < file.rows.length; i++) {
      const raw = file.rows[i][colIdx] || ''
      const normalized = normalizeNip(raw)

      // Check country code if mapped
      const countryCode = nipCountryCol !== null
        ? (file.rows[i][nipCountryCol] || '').trim().toUpperCase()
        : ''

      if (raw === 'brak' || raw.trim() === '') {
        // Empty or "brak" — warning, not error
        brak++
      } else if (countryCode && countryCode !== 'PL' && countryCode !== '') {
        // Foreign NIP — accept any format
        foreign++
      } else if (normalized.length === 11 && /^\d{11}$/.test(normalized)) {
        // 11 digits = PESEL (osoby fizyczne), not a NIP — valid
        pesel++
      } else if (normalized.length === 10 && validatePolishNip(normalized)) {
        // 10-digit Polish NIP with valid checksum
        valid++
      } else {
        invalid++
        if (invalidSamples.length < 5) invalidSamples.push({ row: i + 1, nip: raw })
      }
    }

    if (valid > 0) {
      items.push({
        id: `mer-nip-ok-${colIdx}`,
        category: 'MERYTORYKA',
        severity: 'info',
        message: `${valid} poprawnych NIP-ów`,
        autoFixable: false,
        fixes: []
      })
    }
    if (pesel > 0) {
      items.push({
        id: `mer-nip-pesel-${colIdx}`,
        category: 'MERYTORYKA',
        severity: 'info',
        message: `${pesel}\u00d7 PESEL (osoby fizyczne)`,
        autoFixable: false,
        fixes: []
      })
    }
    if (foreign > 0) {
      items.push({
        id: `mer-nip-foreign-${colIdx}`,
        category: 'MERYTORYKA',
        severity: 'info',
        message: `${foreign}\u00d7 NIP zagraniczny`,
        autoFixable: false,
        fixes: []
      })
    }
    if (brak > 0) {
      items.push({
        id: `mer-nip-brak-${colIdx}`,
        category: 'MERYTORYKA',
        severity: 'warning',
        message: `${brak}\u00d7 NIP \u201ebrak\u201d lub pusty`,
        details: 'Dopuszczalne dla osób fizycznych, ale wymaga weryfikacji',
        autoFixable: false,
        fixes: []
      })
    }
    if (invalid > 0) {
      items.push({
        id: `mer-nip-err-${colIdx}`,
        category: 'MERYTORYKA',
        severity: 'error',
        message: `${invalid} nieprawidłowych NIP-ów`,
        details: invalidSamples.map((s) => `Wiersz ${s.row}: \u201e${s.nip}\u201d`).join(', '),
        autoFixable: false,
        fixes: []
      })
    }
  }

  // Date validation with auto-fix
  {
    let validDates = 0
    let invalidDates = 0
    const fixes: AutoFix[] = []
    const badSamples: { row: number; value: string }[] = []

    for (const colIdx of date) {
      for (let i = 0; i < file.rows.length; i++) {
        const val = (file.rows[i][colIdx] || '').trim()
        if (val === '') continue

        if (DATE_REGEX.test(val)) {
          validDates++
        } else {
          invalidDates++
          const fixMatch = val.match(DATE_FIXABLE_REGEX)
          if (fixMatch) {
            fixes.push({
              rowIndex: i,
              colIndex: colIdx,
              oldValue: val,
              newValue: `${fixMatch[3]}-${fixMatch[2]}-${fixMatch[1]}`
            })
          }
          if (badSamples.length < 5) badSamples.push({ row: i + 1, value: val })
        }
      }
    }

    if (invalidDates === 0 && validDates > 0) {
      items.push({
        id: 'mer-dates-ok',
        category: 'MERYTORYKA',
        severity: 'info',
        message: `Wszystkie daty w formacie YYYY-MM-DD (${validDates})`,
        autoFixable: false,
        fixes: []
      })
    } else if (invalidDates > 0) {
      items.push({
        id: 'mer-dates-err',
        category: 'MERYTORYKA',
        severity: 'error',
        message: `${invalidDates} dat w nieprawidłowym formacie`,
        details:
          badSamples.map((s) => `Wiersz ${s.row}: \u201e${s.value}\u201d`).join(', ') +
          (fixes.length > 0 ? ` \u2014 ${fixes.length} do auto-naprawy` : ''),
        autoFixable: fixes.length > 0,
        fixes
      })
    }
  }

  // Decimal validation with auto-fix
  {
    let validDecimals = 0
    let invalidDecimals = 0
    const commaFixes: AutoFix[] = []
    const badSamples: { row: number; value: string }[] = []

    for (const colIdx of decimal) {
      for (let i = 0; i < file.rows.length; i++) {
        const val = (file.rows[i][colIdx] || '').trim()
        if (val === '') continue

        if (!isNaN(parseFloat(val)) && !val.includes(',')) {
          validDecimals++
        } else {
          const commaFixed = val.replace(',', '.')
          if (!isNaN(parseFloat(commaFixed))) {
            commaFixes.push({
              rowIndex: i,
              colIndex: colIdx,
              oldValue: val,
              newValue: commaFixed
            })
          } else {
            invalidDecimals++
            if (badSamples.length < 5) badSamples.push({ row: i + 1, value: val })
          }
        }
      }
    }

    if (commaFixes.length > 0) {
      items.push({
        id: 'mer-dec-comma',
        category: 'MERYTORYKA',
        severity: 'warning',
        message: `${commaFixes.length} kwot z przecinkiem zamiast kropki`,
        details: 'Można naprawić automatycznie (zamiana , \u2192 .)',
        autoFixable: true,
        fixes: commaFixes
      })
    }

    if (invalidDecimals === 0 && validDecimals > 0 && commaFixes.length === 0) {
      items.push({
        id: 'mer-dec-ok',
        category: 'MERYTORYKA',
        severity: 'info',
        message: `Kwoty parsowalne poprawnie (${validDecimals} wartości)`,
        autoFixable: false,
        fixes: []
      })
    } else if (invalidDecimals > 0) {
      items.push({
        id: 'mer-dec-err',
        category: 'MERYTORYKA',
        severity: 'error',
        message: `${invalidDecimals} nieprawidłowych kwot`,
        details: badSamples.map((s) => `Wiersz ${s.row}: \u201e${s.value}\u201d`).join(', '),
        autoFixable: false,
        fixes: []
      })
    }
  }

  return items
}

// --- SUMY KONTROLNE ---

function validateSumyKontrolne(
  file: ParsedFile,
  mappings: ColumnMapping[]
): ValidationItem[] {
  const items: ValidationItem[] = []
  const fmt = (n: number): string =>
    n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const keyFields = KEY_SUM_FIELDS[file.jpkType] || []

  for (const fieldName of keyFields) {
    const mapping = mappings.find((m) => m.targetField === fieldName)
    if (!mapping) continue

    const sum = file.rows.reduce(
      (acc, row) => acc + parseDecimal(row[mapping.sourceColumn] || ''),
      0
    )

    items.push({
      id: `sum-${fieldName}`,
      category: 'SUMY_KONTROLNE',
      severity: 'info',
      message: `\u03a3 ${fieldName}: ${fmt(sum)}`,
      details: `Obliczona z ${file.rowCount} wierszy`,
      autoFixable: false,
      fixes: []
    })
  }

  // Row count
  items.push({
    id: 'sum-rows',
    category: 'SUMY_KONTROLNE',
    severity: 'info',
    message: `Liczba wierszy: ${file.rowCount.toLocaleString('pl-PL')}`,
    autoFixable: false,
    fixes: []
  })

  return items
}

// --- Public API ---

export function validateFile(file: ParsedFile, mappings: ColumnMapping[]): ValidationReport {
  const struktura = validateStruktura(file, mappings, file.jpkType, file.subType)
  const merytoryka = validateMerytoryka(file, mappings, file.jpkType, file.subType)
  const sumy = validateSumyKontrolne(file, mappings)

  const all = [...struktura, ...merytoryka, ...sumy]

  return {
    groups: [
      { category: 'STRUKTURA', title: 'Struktura pliku', items: struktura },
      { category: 'MERYTORYKA', title: 'Dane merytoryczne', items: merytoryka },
      { category: 'SUMY_KONTROLNE', title: 'Sumy kontrolne', items: sumy }
    ],
    errorCount: all.filter((i) => i.severity === 'error').length,
    warningCount: all.filter((i) => i.severity === 'warning').length,
    infoCount: all.filter((i) => i.severity === 'info').length,
    autoFixCount: all.reduce((acc, i) => acc + i.fixes.length, 0)
  }
}

export function validateFiles(
  files: ParsedFile[],
  allMappings: Record<string, ColumnMapping[]>
): {
  reports: Map<string, ValidationReport>
  totalErrors: number
  totalWarnings: number
  totalAutoFixes: number
} {
  const reports = new Map<string, ValidationReport>()
  let totalErrors = 0
  let totalWarnings = 0
  let totalAutoFixes = 0

  for (const file of files) {
    const mappings = allMappings[file.id] || []
    const report = validateFile(file, mappings)
    reports.set(file.id, report)
    totalErrors += report.errorCount
    totalWarnings += report.warningCount
    totalAutoFixes += report.autoFixCount
  }

  return { reports, totalErrors, totalWarnings, totalAutoFixes }
}

export function applyFixes(file: ParsedFile, fixes: AutoFix[]): void {
  for (const fix of fixes) {
    file.rows[fix.rowIndex][fix.colIndex] = fix.newValue
  }
}
