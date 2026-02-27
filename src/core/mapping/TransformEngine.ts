// ── TransformEngine — transforms raw cell values to canonical JPK format ──

import type { JpkFieldType } from './JpkFieldDefinitions'

/** Result of transforming a single value */
export interface TransformResult {
  /** Transformed value (canonical format) */
  value: string
  /** Was the value actually changed? */
  changed: boolean
  /** Warning if transform was lossy or uncertain */
  warning?: string
}

/** Options for the transform engine */
export interface TransformOptions {
  /** Decimal places for amounts (default: 2) */
  decimalPlaces?: number
  /** Accept dates in the future (default: false) */
  allowFutureDates?: boolean
}

// ── Date transforms ──

const DATE_PATTERNS: Array<{
  pattern: RegExp
  extract: (m: RegExpMatchArray) => { y: string; m: string; d: string }
}> = [
  // YYYY-MM-DD (already canonical)
  { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, extract: (m) => ({ y: m[1], m: m[2], d: m[3] }) },
  // DD.MM.YYYY
  { pattern: /^(\d{2})\.(\d{2})\.(\d{4})$/, extract: (m) => ({ y: m[3], m: m[2], d: m[1] }) },
  // DD-MM-YYYY
  { pattern: /^(\d{2})-(\d{2})-(\d{4})$/, extract: (m) => ({ y: m[3], m: m[2], d: m[1] }) },
  // DD/MM/YYYY
  { pattern: /^(\d{2})\/(\d{2})\/(\d{4})$/, extract: (m) => ({ y: m[3], m: m[2], d: m[1] }) },
  // YYYY.MM.DD
  { pattern: /^(\d{4})\.(\d{2})\.(\d{2})$/, extract: (m) => ({ y: m[1], m: m[2], d: m[3] }) },
  // YYYY/MM/DD
  { pattern: /^(\d{4})\/(\d{2})\/(\d{2})$/, extract: (m) => ({ y: m[1], m: m[2], d: m[3] }) },
  // YYYYMMDD (compact)
  { pattern: /^(\d{4})(\d{2})(\d{2})$/, extract: (m) => ({ y: m[1], m: m[2], d: m[3] }) },
]

/**
 * Transform a date value to YYYY-MM-DD canonical format.
 */
export function transformDate(raw: string, options?: TransformOptions): TransformResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: '', changed: false }

  for (const { pattern, extract } of DATE_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const { y, m, d } = extract(match)
      const year = parseInt(y, 10)
      const month = parseInt(m, 10)
      const day = parseInt(d, 10)

      // Basic validation
      if (month < 1 || month > 12) {
        return { value: trimmed, changed: false, warning: `Nieprawidłowy miesiąc: ${month}` }
      }
      if (day < 1 || day > 31) {
        return { value: trimmed, changed: false, warning: `Nieprawidłowy dzień: ${day}` }
      }

      const canonical = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

      // Check for future dates
      if (!options?.allowFutureDates) {
        const date = new Date(year, month - 1, day)
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        if (date > today) {
          return { value: canonical, changed: canonical !== trimmed, warning: `Data z przyszłości: ${canonical}` }
        }
      }

      return { value: canonical, changed: canonical !== trimmed }
    }
  }

  return { value: trimmed, changed: false, warning: `Nierozpoznany format daty: ${trimmed}` }
}

// ── Decimal transforms ──

/**
 * Transform a decimal/amount value to canonical format:
 * - Replace comma with dot
 * - Remove spaces and thousand separators
 * - Format to N decimal places (default 2)
 */
export function transformDecimal(raw: string, options?: TransformOptions): TransformResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: '', changed: false }

  const places = options?.decimalPlaces ?? 2

  // Remove spaces (thousand separators)
  let cleaned = trimmed.replace(/\s/g, '')

  // Detect format: if both comma and dot present, last one is decimal separator
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // "1.234,56" → comma is decimal, dots are thousands
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // "1,234.56" → dot is decimal, commas are thousands
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (lastComma > -1) {
    // Only commas — last comma is decimal separator if digits after are ≤ 6
    // (handles "102,95" and "80,000000")
    const afterComma = cleaned.substring(lastComma + 1)
    if (/^\d+$/.test(afterComma)) {
      cleaned = cleaned.replace(',', '.')
    }
  }
  // If only dots, assume dot is decimal separator (standard)

  const num = parseFloat(cleaned)
  if (isNaN(num)) {
    return { value: trimmed, changed: false, warning: `Nieprawidłowa kwota: ${trimmed}` }
  }

  const canonical = num.toFixed(places)
  return { value: canonical, changed: canonical !== trimmed }
}

// ── Integer transforms ──

/**
 * Transform an integer value — strip spaces, validate digits-only.
 */
export function transformInteger(raw: string): TransformResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: '', changed: false }

  const cleaned = trimmed.replace(/\s/g, '')

  if (/^\d+$/.test(cleaned)) {
    const canonical = String(parseInt(cleaned, 10))
    return { value: canonical, changed: canonical !== trimmed }
  }

  return { value: trimmed, changed: false, warning: `Nieprawidłowa liczba całkowita: ${trimmed}` }
}

// ── NIP transforms ──

/**
 * Normalize NIP: strip dashes, spaces, country prefix → 10 digits.
 * Validates checksum (weights: 6,5,7,2,3,4,5,6,7).
 */
export function transformNip(raw: string): TransformResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: '', changed: false }

  // Strip PL prefix, dashes, spaces
  let cleaned = trimmed.replace(/^PL/i, '').replace(/[\s\-]/g, '')

  if (!/^\d{10}$/.test(cleaned)) {
    return { value: trimmed, changed: false, warning: `NIP musi mieć 10 cyfr: ${trimmed}` }
  }

  // Validate checksum
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const digits = cleaned.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i]
  }
  const checkDigit = sum % 11
  if (checkDigit === 10 || checkDigit !== digits[9]) {
    return { value: cleaned, changed: cleaned !== trimmed, warning: `Nieprawidłowa suma kontrolna NIP: ${cleaned}` }
  }

  return { value: cleaned, changed: cleaned !== trimmed }
}

// ── Boolean transforms ──

const TRUE_VALUES = new Set(['1', 'true', 'tak', 'yes', 'y', 't'])
const FALSE_VALUES = new Set(['0', 'false', 'nie', 'no', 'n', 'f'])

/**
 * Normalize boolean: TAK/NIE/1/0/true/false → "true"/"false".
 * Empty string remains empty (field not present in XML).
 */
export function transformBoolean(raw: string): TransformResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: '', changed: false }

  const lower = trimmed.toLowerCase()
  if (TRUE_VALUES.has(lower)) {
    return { value: 'true', changed: trimmed !== 'true' }
  }
  if (FALSE_VALUES.has(lower)) {
    return { value: 'false', changed: trimmed !== 'false' }
  }

  return { value: trimmed, changed: false, warning: `Nierozpoznana wartość logiczna: ${trimmed}` }
}

// ── Country code transforms ──

/**
 * Normalize country code: uppercase, validate 2 letters.
 */
export function transformCountry(raw: string): TransformResult {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: '', changed: false }

  const upper = trimmed.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) {
    return { value: upper, changed: upper !== trimmed }
  }

  return { value: trimmed, changed: false, warning: `Nieprawidłowy kod kraju: ${trimmed}` }
}

// ── String transforms ──

/**
 * Basic string transform: trim whitespace, collapse internal whitespace.
 */
export function transformString(raw: string): TransformResult {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  return { value: trimmed, changed: trimmed !== raw }
}

// ── Universal transform dispatcher ──

/**
 * Transform a raw cell value based on field type.
 */
export function transformValue(
  raw: string,
  fieldType: JpkFieldType,
  options?: TransformOptions,
): TransformResult {
  switch (fieldType) {
    case 'date': return transformDate(raw, options)
    case 'decimal': return transformDecimal(raw, options)
    case 'integer': return transformInteger(raw)
    case 'nip': return transformNip(raw)
    case 'boolean': return transformBoolean(raw)
    case 'country': return transformCountry(raw)
    case 'string': return transformString(raw)
    default: return transformString(raw)
  }
}

/** A single transformed row */
export interface TransformedRow {
  /** Original row index */
  index: number
  /** Field name → transformed value */
  values: Record<string, string>
  /** Warnings from transforms */
  warnings: string[]
}

/**
 * Transform all rows using a mapping result.
 * Maps source columns to target fields, applying type-specific transforms.
 */
export function transformRows(
  rows: Array<{ index: number; cells: string[] }>,
  mappings: Array<{ sourceColumn: number; targetField: string }>,
  fieldTypes: Record<string, JpkFieldType>,
  options?: TransformOptions,
): TransformedRow[] {
  return rows.map((row) => {
    const values: Record<string, string> = {}
    const warnings: string[] = []

    for (const mapping of mappings) {
      const rawValue = row.cells[mapping.sourceColumn] ?? ''
      const fieldType = fieldTypes[mapping.targetField] ?? 'string'
      const result = transformValue(rawValue, fieldType, options)

      values[mapping.targetField] = result.value
      if (result.warning) {
        warnings.push(`Wiersz ${row.index + 1}, ${mapping.targetField}: ${result.warning}`)
      }
    }

    return { index: row.index, values, warnings }
  })
}
