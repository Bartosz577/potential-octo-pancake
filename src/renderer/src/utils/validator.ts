import type { ParsedFile, JpkType } from '../types'
import type { ColumnMapping } from '../../../core/mapping/AutoMapper'
import { getFieldDefinitions } from '../../../core/mapping/JpkFieldDefinitions'
import { validatePolishNip, normalizeNip } from './nipValidator'
import { validateXsd } from '../../../core/validation/XsdValidator'
import { generateXmlForFile } from './xmlExporter'
import { XMLParser } from 'fast-xml-parser'

export type Severity = 'error' | 'warning' | 'info'
export type ValidationCategory = 'STRUKTURA' | 'MERYTORYKA' | 'SUMY_KONTROLNE' | 'SCHEMAT_XSD'

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
  V7M: ['K_19', 'K_20'],
  FA: ['P_15'],
  MAG: ['WartoscPozycji'],
  WB: ['KwotaOperacji'],
  PKPIR: ['K_9'],
  EWP: ['K_8'],
  KR_PD: ['D_11'],
  ST: [],
  ST_KR: [],
  FA_RR: ['P_12_1'],
  KR: ['DziennikKwotaOperacji']
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

// --- SCHEMAT XSD ---

function validateSchematXsd(
  file: ParsedFile,
  mappings: ColumnMapping[],
  company?: { nip: string; fullName: string; regon: string; kodUrzedu: string; email: string; phone: string },
  period?: { year: number; month: number; celZlozenia: 1 | 2 }
): ValidationItem[] {
  const items: ValidationItem[] = []

  if (!company || !period || !company.nip || !company.fullName) {
    items.push({
      id: 'xsd-skip',
      category: 'SCHEMAT_XSD',
      severity: 'info',
      message: 'Walidacja XSD pominięta — brak danych firmy/okresu',
      autoFixable: false,
      fixes: []
    })
    return items
  }

  // Generate XML to validate
  const xmlResult = generateXmlForFile(file, mappings, company, period)
  if (!xmlResult) {
    items.push({
      id: 'xsd-no-xml',
      category: 'SCHEMAT_XSD',
      severity: 'warning',
      message: 'Nie można wygenerować XML do walidacji — brak generatora dla tego typu JPK',
      autoFixable: false,
      fixes: []
    })
    return items
  }

  const result = validateXsd(xmlResult.xml)

  for (const issue of result.issues) {
    items.push({
      id: `xsd-${issue.code}-${issue.path || 'root'}`,
      category: 'SCHEMAT_XSD',
      severity: issue.severity,
      message: issue.message,
      details: issue.path ? `Ścieżka: ${issue.path}` : undefined,
      autoFixable: false,
      fixes: []
    })
  }

  if (result.valid && result.issues.filter((i) => i.severity === 'error').length === 0) {
    const infoCount = result.issues.filter((i) => i.severity === 'info').length
    if (infoCount === result.issues.length) {
      items.push({
        id: 'xsd-valid',
        category: 'SCHEMAT_XSD',
        severity: 'info',
        message: `Dokument zgodny ze schematem XSD ${result.jpkType || file.jpkType}`,
        autoFixable: false,
        fixes: []
      })
    }
  }

  return items
}

// --- Public API ---

export function validateFile(
  file: ParsedFile,
  mappings: ColumnMapping[],
  company?: { nip: string; fullName: string; regon: string; kodUrzedu: string; email: string; phone: string },
  period?: { year: number; month: number; celZlozenia: 1 | 2 }
): ValidationReport {
  const struktura = validateStruktura(file, mappings, file.jpkType, file.subType)
  const merytoryka = validateMerytoryka(file, mappings, file.jpkType, file.subType)
  const sumy = validateSumyKontrolne(file, mappings)
  const xsd = validateSchematXsd(file, mappings, company, period)

  const all = [...struktura, ...merytoryka, ...sumy, ...xsd]

  return {
    groups: [
      { category: 'STRUKTURA', title: 'Struktura pliku', items: struktura },
      { category: 'MERYTORYKA', title: 'Dane merytoryczne', items: merytoryka },
      { category: 'SUMY_KONTROLNE', title: 'Sumy kontrolne', items: sumy },
      { category: 'SCHEMAT_XSD', title: 'Zgodność ze schematem XSD', items: xsd }
    ],
    errorCount: all.filter((i) => i.severity === 'error').length,
    warningCount: all.filter((i) => i.severity === 'warning').length,
    infoCount: all.filter((i) => i.severity === 'info').length,
    autoFixCount: all.reduce((acc, i) => acc + i.fixes.length, 0)
  }
}

export function validateFiles(
  files: ParsedFile[],
  allMappings: Record<string, ColumnMapping[]>,
  company?: { nip: string; fullName: string; regon: string; kodUrzedu: string; email: string; phone: string },
  period?: { year: number; month: number; celZlozenia: 1 | 2 }
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
    const report = validateFile(file, mappings, company, period)
    reports.set(file.id, report)
    totalErrors += report.errorCount
    totalWarnings += report.warningCount
    totalAutoFixes += report.autoFixCount
  }

  return { reports, totalErrors, totalWarnings, totalAutoFixes }
}

export function applyFixes(file: ParsedFile, fixes: AutoFix[]): ParsedFile {
  if (fixes.length === 0) return file
  const fixMap = new Map<string, string>()
  for (const fix of fixes) {
    fixMap.set(`${fix.rowIndex}:${fix.colIndex}`, fix.newValue)
  }
  return {
    ...file,
    rows: file.rows.map((row, ri) => {
      const hasFixInRow = fixes.some((f) => f.rowIndex === ri)
      if (!hasFixInRow) return row
      return row.map((cell, ci) => fixMap.get(`${ri}:${ci}`) ?? cell)
    })
  }
}

// --- Standalone JPK XML Validator ---

/** Detect JPK type label from parsed XML Naglowek */
export function detectJpkLabel(xmlContent: string): string | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      trimValues: true
    })
    const parsed = parser.parse(xmlContent)
    const jpk = parsed?.['JPK'] as Record<string, unknown> | undefined
    if (!jpk) return null
    const naglowek = jpk['Naglowek'] as Record<string, unknown> | undefined
    if (!naglowek) return null

    const kodFormularza = naglowek['KodFormularza']
    let kodText = ''
    let kodSys = ''
    let wariant = ''

    if (typeof kodFormularza === 'object' && kodFormularza !== null) {
      const attrs = kodFormularza as Record<string, unknown>
      kodText = String(attrs['#text'] ?? '')
      kodSys = String(attrs['@_kodSystemowy'] ?? '')
    } else if (typeof kodFormularza === 'string') {
      kodText = kodFormularza
    }

    wariant = String(naglowek['WariantFormularza'] ?? '')

    if (kodSys) return `${kodSys}`
    if (kodText && wariant) return `${kodText}(${wariant})`
    if (kodText) return kodText
    return null
  } catch {
    return null
  }
}

// Control sum configuration for standalone validation
interface StandaloneCtrlSpec {
  ctrlElement: string
  countField: string
  rowElement: string
  sumFields?: { ctrlField: string; rowFields: string[]; subtractFields?: string[] }[]
  container?: string  // e.g. 'Ewidencja' for V7M
}

const STANDALONE_CTRL_CONFIGS: Record<string, StandaloneCtrlSpec[]> = {
  JPK_VAT: [
    {
      ctrlElement: 'SprzedazCtrl',
      countField: 'LiczbaWierszySprzedazy',
      rowElement: 'SprzedazWiersz',
      container: 'Ewidencja',
      sumFields: [{
        ctrlField: 'PodatekNalezny',
        rowFields: ['K_16', 'K_18', 'K_20', 'K_24', 'K_26', 'K_28', 'K_30', 'K_32', 'K_33', 'K_34'],
        subtractFields: ['K_35', 'K_36', 'K_360']
      }]
    },
    {
      ctrlElement: 'ZakupCtrl',
      countField: 'LiczbaWierszyZakupow',
      rowElement: 'ZakupWiersz',
      container: 'Ewidencja',
      sumFields: [{
        ctrlField: 'PodatekNaliczony',
        rowFields: ['K_41', 'K_43', 'K_44', 'K_45', 'K_46', 'K_47']
      }]
    }
  ],
  JPK_FA: [
    {
      ctrlElement: 'FakturaCtrl',
      countField: 'LiczbaFaktur',
      rowElement: 'Faktura',
      sumFields: [{ ctrlField: 'WartoscFaktur', rowFields: ['P_15'] }]
    },
    {
      ctrlElement: 'FakturaWierszCtrl',
      countField: 'LiczbaWierszyFaktur',
      rowElement: 'FakturaWiersz',
      sumFields: [{ ctrlField: 'WartoscWierszyFaktur', rowFields: ['P_11'] }]
    }
  ],
  JPK_WB: [
    {
      ctrlElement: 'WyciagCtrl',
      countField: 'LiczbaWierszy',
      rowElement: 'WyciagWiersz',
      sumFields: [
        { ctrlField: 'SumaObciazen', rowFields: ['KwotaOperacji'] },
        { ctrlField: 'SumaUznan', rowFields: ['KwotaOperacji'] }
      ]
    }
  ],
  JPK_EWP: [
    {
      ctrlElement: 'EWPCtrl',
      countField: 'LiczbaWierszy',
      rowElement: 'EWPWiersz',
      sumFields: [{ ctrlField: 'SumaPrzychodow', rowFields: ['K_8'] }]
    }
  ],
  JPK_PKPIR: [
    {
      ctrlElement: 'PKPIRCtrl',
      countField: 'LiczbaWierszy',
      rowElement: 'PKPIRWiersz',
      sumFields: [{ ctrlField: 'SumaPrzychodow', rowFields: ['K_9'] }]
    }
  ]
}

// Row elements that should always be parsed as arrays
const STANDALONE_ROW_ELEMENTS = new Set([
  'SprzedazWiersz', 'ZakupWiersz', 'Faktura', 'FakturaWiersz',
  'FakturaRR', 'FakturaRRWiersz', 'Oswiadczenie',
  'WyciagWiersz', 'EWPWiersz', 'PKPIRWiersz', 'Dziennik', 'KontoZapis'
])

function ensureArraySafe(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (val === undefined || val === null) return []
  return [val]
}

function findNipRecursive(obj: unknown): string | null {
  if (obj == null || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>
  if (typeof record['NIP'] === 'string') return record['NIP']
  if (typeof record['etd:NIP'] === 'string') return record['etd:NIP']
  for (const val of Object.values(record)) {
    if (typeof val === 'object' && val !== null) {
      const found = findNipRecursive(val)
      if (found) return found
    }
  }
  return null
}

function getKodFormularzaText(naglowek: Record<string, unknown>): string {
  const kf = naglowek['KodFormularza']
  if (typeof kf === 'string') return kf
  if (typeof kf === 'object' && kf !== null) {
    return String((kf as Record<string, unknown>)['#text'] ?? '')
  }
  return ''
}

/**
 * Validate an existing JPK XML file (standalone mode).
 * Returns a ValidationReport with 4 groups: STRUKTURA, MERYTORYKA, SUMY_KONTROLNE, SCHEMAT_XSD.
 */
export function validateExistingJpk(xmlContent: string): ValidationReport {
  const struktura: ValidationItem[] = []
  const merytoryka: ValidationItem[] = []
  const sumy: ValidationItem[] = []
  const xsd: ValidationItem[] = []

  // ── Level 1: Structure ──
  let jpk: Record<string, unknown> | null = null
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      trimValues: true,
      isArray: (name: string) => STANDALONE_ROW_ELEMENTS.has(name)
    })
    const parsed = parser.parse(xmlContent)
    jpk = (parsed?.['JPK'] as Record<string, unknown>) ?? null
  } catch (err) {
    struktura.push({
      id: 'ex-str-parse',
      category: 'STRUKTURA',
      severity: 'error',
      message: `Błąd parsowania XML: ${err instanceof Error ? err.message : String(err)}`,
      autoFixable: false,
      fixes: []
    })
  }

  if (!jpk) {
    if (struktura.length === 0) {
      struktura.push({
        id: 'ex-str-no-jpk',
        category: 'STRUKTURA',
        severity: 'error',
        message: 'Brak elementu głównego <JPK> w dokumencie',
        autoFixable: false,
        fixes: []
      })
    }
    return buildReport(struktura, merytoryka, sumy, xsd)
  }

  // Required sections
  const naglowek = jpk['Naglowek'] as Record<string, unknown> | undefined
  const podmiot1 = jpk['Podmiot1'] as Record<string, unknown> | undefined

  if (!naglowek) {
    struktura.push({
      id: 'ex-str-naglowek',
      category: 'STRUKTURA',
      severity: 'error',
      message: 'Brak wymaganej sekcji <Naglowek>',
      autoFixable: false,
      fixes: []
    })
  } else {
    struktura.push({
      id: 'ex-str-naglowek-ok',
      category: 'STRUKTURA',
      severity: 'info',
      message: 'Sekcja <Naglowek> obecna',
      autoFixable: false,
      fixes: []
    })
  }

  if (!podmiot1) {
    struktura.push({
      id: 'ex-str-podmiot',
      category: 'STRUKTURA',
      severity: 'error',
      message: 'Brak wymaganej sekcji <Podmiot1>',
      autoFixable: false,
      fixes: []
    })
  } else {
    struktura.push({
      id: 'ex-str-podmiot-ok',
      category: 'STRUKTURA',
      severity: 'info',
      message: 'Sekcja <Podmiot1> obecna',
      autoFixable: false,
      fixes: []
    })
  }

  // Detect JPK type from Naglowek
  let kodFormularza = ''
  if (naglowek) {
    kodFormularza = getKodFormularzaText(naglowek)
    const wariant = String(naglowek['WariantFormularza'] ?? '')
    if (kodFormularza) {
      struktura.push({
        id: 'ex-str-type',
        category: 'STRUKTURA',
        severity: 'info',
        message: `Typ: ${kodFormularza}, wariant: ${wariant || 'brak'}`,
        autoFixable: false,
        fixes: []
      })
    } else {
      struktura.push({
        id: 'ex-str-type-missing',
        category: 'STRUKTURA',
        severity: 'error',
        message: 'Brak KodFormularza w <Naglowek>',
        autoFixable: false,
        fixes: []
      })
    }
  }

  // ── Level 2: Podmiot1 — NIP ──
  if (podmiot1) {
    const nip = findNipRecursive(podmiot1)
    if (!nip || nip.trim() === '') {
      merytoryka.push({
        id: 'ex-mer-nip-missing',
        category: 'MERYTORYKA',
        severity: 'error',
        message: 'Brak NIP w <Podmiot1>',
        autoFixable: false,
        fixes: []
      })
    } else {
      const digits = nip.replace(/[^0-9]/g, '')
      if (digits.length !== 10) {
        merytoryka.push({
          id: 'ex-mer-nip-format',
          category: 'MERYTORYKA',
          severity: 'error',
          message: `NIP "${nip}" nie jest 10-cyfrowy`,
          autoFixable: false,
          fixes: []
        })
      } else if (!validatePolishNip(digits)) {
        merytoryka.push({
          id: 'ex-mer-nip-checksum',
          category: 'MERYTORYKA',
          severity: 'error',
          message: `NIP "${nip}" — nieprawidłowa suma kontrolna`,
          autoFixable: false,
          fixes: []
        })
      } else {
        merytoryka.push({
          id: 'ex-mer-nip-ok',
          category: 'MERYTORYKA',
          severity: 'info',
          message: `NIP: ${nip} — poprawny`,
          autoFixable: false,
          fixes: []
        })
      }
    }
  }

  // ── Level 3: Control sums ──
  if (kodFormularza) {
    const ctrlConfigs = STANDALONE_CTRL_CONFIGS[kodFormularza]
    if (ctrlConfigs) {
      for (const ctrlConfig of ctrlConfigs) {
        const searchIn = ctrlConfig.container
          ? (jpk[ctrlConfig.container] as Record<string, unknown> | undefined) ?? jpk
          : jpk

        const ctrlObj = searchIn[ctrlConfig.ctrlElement] as Record<string, unknown> | undefined
        if (!ctrlObj) {
          sumy.push({
            id: `ex-sum-missing-${ctrlConfig.ctrlElement}`,
            category: 'SUMY_KONTROLNE',
            severity: 'error',
            message: `Brak sekcji <${ctrlConfig.ctrlElement}>`,
            autoFixable: false,
            fixes: []
          })
          continue
        }

        // Row count
        const declaredCount = parseInt(String(ctrlObj[ctrlConfig.countField] ?? '0'), 10)
        const rows = ensureArraySafe(searchIn[ctrlConfig.rowElement] ?? jpk[ctrlConfig.rowElement])
        const actualCount = rows.length

        if (declaredCount !== actualCount) {
          sumy.push({
            id: `ex-sum-count-${ctrlConfig.ctrlElement}`,
            category: 'SUMY_KONTROLNE',
            severity: 'error',
            message: `${ctrlConfig.countField}: zadeklarowano ${declaredCount}, faktycznie ${actualCount}`,
            autoFixable: false,
            fixes: []
          })
        } else {
          sumy.push({
            id: `ex-sum-count-${ctrlConfig.ctrlElement}`,
            category: 'SUMY_KONTROLNE',
            severity: 'info',
            message: `${ctrlConfig.countField}: ${actualCount} — zgodne`,
            autoFixable: false,
            fixes: []
          })
        }

        // Sum fields
        if (ctrlConfig.sumFields) {
          for (const sf of ctrlConfig.sumFields) {
            const declaredSum = parseFloat(String(ctrlObj[sf.ctrlField] ?? '0'))

            let computedSum = 0
            for (const row of rows) {
              if (typeof row !== 'object' || row === null) continue
              const r = row as Record<string, unknown>
              for (const field of sf.rowFields) {
                const val = parseFloat(String(r[field] ?? '0'))
                if (!isNaN(val)) computedSum += val
              }
              if (sf.subtractFields) {
                for (const field of sf.subtractFields) {
                  const val = parseFloat(String(r[field] ?? '0'))
                  if (!isNaN(val)) computedSum -= val
                }
              }
            }

            computedSum = Math.round(computedSum * 100) / 100

            if (Math.abs(declaredSum - computedSum) > 0.01) {
              sumy.push({
                id: `ex-sum-val-${sf.ctrlField}`,
                category: 'SUMY_KONTROLNE',
                severity: 'error',
                message: `${sf.ctrlField}: zadeklarowano ${declaredSum.toFixed(2)}, obliczono ${computedSum.toFixed(2)}`,
                autoFixable: false,
                fixes: []
              })
            } else {
              sumy.push({
                id: `ex-sum-val-${sf.ctrlField}`,
                category: 'SUMY_KONTROLNE',
                severity: 'info',
                message: `${sf.ctrlField}: ${declaredSum.toFixed(2)} — zgodne`,
                autoFixable: false,
                fixes: []
              })
            }
          }
        }
      }
    } else {
      sumy.push({
        id: 'ex-sum-unsupported',
        category: 'SUMY_KONTROLNE',
        severity: 'info',
        message: `Walidacja sum kontrolnych niedostępna dla typu ${kodFormularza}`,
        autoFixable: false,
        fixes: []
      })
    }
  }

  // ── Level 4: XSD validation ──
  const xsdResult = validateXsd(xmlContent)
  for (const issue of xsdResult.issues) {
    xsd.push({
      id: `ex-xsd-${issue.code}-${issue.path || 'root'}`,
      category: 'SCHEMAT_XSD',
      severity: issue.severity as Severity,
      message: issue.message,
      details: issue.path ? `Ścieżka: ${issue.path}` : undefined,
      autoFixable: false,
      fixes: []
    })
  }

  if (xsdResult.valid && xsdResult.issues.filter((i) => i.severity === 'error').length === 0) {
    const alreadyHasOk = xsd.some((i) => i.id.includes('XSD_NAMESPACE_OK') || i.id.includes('XSD_CTRL_SUM_OK'))
    if (!alreadyHasOk || xsd.every((i) => i.severity !== 'error')) {
      // Don't duplicate — XSD issues already contain info items
    }
  }

  if (xsd.length === 0) {
    xsd.push({
      id: 'ex-xsd-skip',
      category: 'SCHEMAT_XSD',
      severity: 'info',
      message: 'Brak reguł XSD dla tego typu JPK',
      autoFixable: false,
      fixes: []
    })
  }

  return buildReport(struktura, merytoryka, sumy, xsd)
}

function buildReport(
  struktura: ValidationItem[],
  merytoryka: ValidationItem[],
  sumy: ValidationItem[],
  xsd: ValidationItem[]
): ValidationReport {
  const all = [...struktura, ...merytoryka, ...sumy, ...xsd]
  return {
    groups: [
      { category: 'STRUKTURA', title: 'Struktura dokumentu', items: struktura },
      { category: 'MERYTORYKA', title: 'Dane merytoryczne', items: merytoryka },
      { category: 'SUMY_KONTROLNE', title: 'Sumy kontrolne', items: sumy },
      { category: 'SCHEMAT_XSD', title: 'Zgodność ze schematem XSD', items: xsd }
    ],
    errorCount: all.filter((i) => i.severity === 'error').length,
    warningCount: all.filter((i) => i.severity === 'warning').length,
    infoCount: all.filter((i) => i.severity === 'info').length,
    autoFixCount: 0
  }
}
