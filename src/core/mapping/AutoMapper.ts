import type { JpkFieldDef } from './JpkFieldDefinitions'
import type { RawSheet } from '../models/types'

/** A single column-to-field mapping with confidence score */
export interface ColumnMapping {
  /** Source column index in the RawSheet */
  sourceColumn: number
  /** Source column header (if available) */
  sourceHeader?: string
  /** Target JPK field name */
  targetField: string
  /** Confidence score 0.0–1.0 */
  confidence: number
  /** How the mapping was determined */
  method: 'exact' | 'synonym' | 'pattern' | 'position' | 'manual'
}

/** Result of auto-mapping a sheet to JPK fields */
export interface MappingResult {
  /** All determined column mappings */
  mappings: ColumnMapping[]
  /** Fields that could not be mapped */
  unmappedFields: string[]
  /** Source columns that were not mapped to any field */
  unmappedColumns: number[]
}

/**
 * Normalize a string for fuzzy matching:
 * lowercase, strip diacritics, replace separators with underscore, trim.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[ł]/g, 'l')
    .replace(/[\s\-./]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Try to match a header string against a field definition.
 * Returns confidence 0.0–1.0.
 */
function matchHeaderToField(header: string, field: JpkFieldDef): { confidence: number; method: ColumnMapping['method'] } {
  const normHeader = normalize(header)
  const normFieldName = normalize(field.name)

  // Exact match on field name
  if (normHeader === normFieldName) {
    return { confidence: 1.0, method: 'exact' }
  }

  // Exact match on label
  if (normalize(field.label) === normHeader) {
    return { confidence: 0.95, method: 'exact' }
  }

  // Synonym match
  if (field.synonyms) {
    for (const syn of field.synonyms) {
      if (normalize(syn) === normHeader) {
        return { confidence: 0.9, method: 'synonym' }
      }
    }
  }

  // Partial match: header contains field name or vice versa
  if (normHeader.includes(normFieldName) || normFieldName.includes(normHeader)) {
    if (normHeader.length > 2 && normFieldName.length > 2) {
      return { confidence: 0.7, method: 'pattern' }
    }
  }

  // Partial synonym match
  if (field.synonyms) {
    for (const syn of field.synonyms) {
      const normSyn = normalize(syn)
      if (normHeader.includes(normSyn) || normSyn.includes(normHeader)) {
        if (normHeader.length > 2 && normSyn.length > 2) {
          return { confidence: 0.6, method: 'pattern' }
        }
      }
    }
  }

  return { confidence: 0, method: 'pattern' }
}

/**
 * Try to infer field type from sample cell values.
 * Returns the most likely JpkFieldType.
 */
function inferTypeFromValues(values: string[]): JpkFieldDef['type'] | null {
  const nonEmpty = values.filter((v) => v.trim().length > 0)
  if (nonEmpty.length === 0) return null

  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
  const NIP_PATTERN = /^(\d{10}|\d{3}-\d{3}-\d{2}-\d{2})$/
  const DECIMAL_PATTERN = /^-?\d+[.,]\d+$/
  const INTEGER_PATTERN = /^\d+$/
  const BOOL_PATTERN = /^(true|false|1|0|tak|nie)$/i
  const COUNTRY_PATTERN = /^[A-Z]{2}$/

  const sampleSize = Math.min(nonEmpty.length, 10)
  const sample = nonEmpty.slice(0, sampleSize)

  const dateCount = sample.filter((v) => DATE_PATTERN.test(v)).length
  if (dateCount >= sampleSize * 0.8) return 'date'

  const nipCount = sample.filter((v) => NIP_PATTERN.test(v.replace(/\s/g, ''))).length
  if (nipCount >= sampleSize * 0.8) return 'nip'

  const countryCount = sample.filter((v) => COUNTRY_PATTERN.test(v.trim())).length
  if (countryCount >= sampleSize * 0.8) return 'country'

  const boolCount = sample.filter((v) => BOOL_PATTERN.test(v.trim())).length
  if (boolCount >= sampleSize * 0.8) return 'boolean'

  const decimalCount = sample.filter((v) => DECIMAL_PATTERN.test(v.trim())).length
  if (decimalCount >= sampleSize * 0.5) return 'decimal'

  const intCount = sample.filter((v) => INTEGER_PATTERN.test(v.trim())).length
  if (intCount >= sampleSize * 0.8) return 'integer'

  return 'string'
}

/**
 * AutoMapper — heuristically map source columns to JPK field definitions.
 *
 * Strategy (in priority order):
 * 1. If headers exist: match headers against field names/synonyms/labels
 * 2. If no headers: infer field types from sample values, then match by type + position
 * 3. Apply greedy assignment: each column maps to at most one field, highest confidence first
 */
export function autoMap(sheet: RawSheet, fields: JpkFieldDef[]): MappingResult {
  const columnCount = sheet.rows.length > 0 ? sheet.rows[0].cells.length : 0
  const mappings: ColumnMapping[] = []

  if (columnCount === 0 || fields.length === 0) {
    return {
      mappings: [],
      unmappedFields: fields.map((f) => f.name),
      unmappedColumns: Array.from({ length: columnCount }, (_, i) => i),
    }
  }

  // Collect sample values per column (first 10 rows)
  const sampleValues: string[][] = []
  for (let col = 0; col < columnCount; col++) {
    sampleValues.push(
      sheet.rows.slice(0, 10).map((r) => r.cells[col] ?? '')
    )
  }

  // Phase 1: Header-based matching
  if (sheet.headers && sheet.headers.length > 0) {
    const candidates: Array<{ col: number; fieldIdx: number; confidence: number; method: ColumnMapping['method'] }> = []

    for (let col = 0; col < sheet.headers.length; col++) {
      const header = sheet.headers[col]
      if (!header || header.trim().length === 0) continue

      for (let fi = 0; fi < fields.length; fi++) {
        const { confidence, method } = matchHeaderToField(header, fields[fi])
        if (confidence > 0.5) {
          candidates.push({ col, fieldIdx: fi, confidence, method })
        }
      }
    }

    // Sort by confidence descending, assign greedily
    candidates.sort((a, b) => b.confidence - a.confidence)
    const usedCols = new Set<number>()
    const usedFields = new Set<number>()

    for (const c of candidates) {
      if (usedCols.has(c.col) || usedFields.has(c.fieldIdx)) continue

      mappings.push({
        sourceColumn: c.col,
        sourceHeader: sheet.headers![c.col],
        targetField: fields[c.fieldIdx].name,
        confidence: c.confidence,
        method: c.method,
      })

      usedCols.add(c.col)
      usedFields.add(c.fieldIdx)
    }
  }

  // Phase 2: Type-based matching for remaining columns
  const mappedCols = new Set(mappings.map((m) => m.sourceColumn))
  const mappedFields = new Set(mappings.map((m) => m.targetField))

  const remainingFields = fields.filter((f) => !mappedFields.has(f.name))
  const remainingCols = Array.from({ length: columnCount }, (_, i) => i).filter((i) => !mappedCols.has(i))

  if (remainingFields.length > 0 && remainingCols.length > 0) {
    const typeCandidates: Array<{ col: number; fieldIdx: number; confidence: number }> = []

    for (const col of remainingCols) {
      const inferredType = inferTypeFromValues(sampleValues[col])
      if (!inferredType) continue

      for (let fi = 0; fi < remainingFields.length; fi++) {
        if (remainingFields[fi].type === inferredType) {
          // Lower confidence for type-only matching
          typeCandidates.push({ col, fieldIdx: fi, confidence: 0.4 })
        }
      }
    }

    typeCandidates.sort((a, b) => b.confidence - a.confidence)
    const usedCols2 = new Set(mappedCols)
    const usedFields2 = new Set<number>()

    for (const c of typeCandidates) {
      if (usedCols2.has(c.col) || usedFields2.has(c.fieldIdx)) continue

      mappings.push({
        sourceColumn: c.col,
        sourceHeader: sheet.headers?.[c.col],
        targetField: remainingFields[c.fieldIdx].name,
        confidence: c.confidence,
        method: 'pattern',
      })

      usedCols2.add(c.col)
      usedFields2.add(c.fieldIdx)
    }
  }

  // Compute unmapped
  const finalMappedCols = new Set(mappings.map((m) => m.sourceColumn))
  const finalMappedFields = new Set(mappings.map((m) => m.targetField))

  return {
    mappings: mappings.sort((a, b) => a.sourceColumn - b.sourceColumn),
    unmappedFields: fields.filter((f) => !finalMappedFields.has(f.name)).map((f) => f.name),
    unmappedColumns: Array.from({ length: columnCount }, (_, i) => i).filter((i) => !finalMappedCols.has(i)),
  }
}

/**
 * Apply a pre-defined positional mapping (from SystemProfiles).
 * Each entry maps sourceColumn → targetField with high confidence.
 */
export function applyPositionalMapping(
  columnCount: number,
  positionMap: Record<number, string>,
  fields: JpkFieldDef[]
): MappingResult {
  const fieldNames = new Set(fields.map((f) => f.name))
  const mappings: ColumnMapping[] = []

  for (const [colStr, fieldName] of Object.entries(positionMap)) {
    const col = Number(colStr)
    if (col < 0 || col >= columnCount) continue
    if (!fieldNames.has(fieldName)) continue

    mappings.push({
      sourceColumn: col,
      targetField: fieldName,
      confidence: 1.0,
      method: 'position',
    })
  }

  const mappedFields = new Set(mappings.map((m) => m.targetField))

  return {
    mappings: mappings.sort((a, b) => a.sourceColumn - b.sourceColumn),
    unmappedFields: fields.filter((f) => !mappedFields.has(f.name)).map((f) => f.name),
    unmappedColumns: Array.from({ length: columnCount }, (_, i) => i).filter(
      (i) => !mappings.some((m) => m.sourceColumn === i)
    ),
  }
}
