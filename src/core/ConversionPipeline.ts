// ── ConversionPipeline — orchestrator: parse → map → transform → validate ──

import type { FileReadResult, RawSheet } from './models/types'
import type { FileReaderRegistry } from './readers/FileReaderRegistry'
import type { JpkFieldDef, JpkFieldType } from './mapping/JpkFieldDefinitions'
import { getFieldDefinitions } from './mapping/JpkFieldDefinitions'
import { autoMap, type MappingResult } from './mapping/AutoMapper'
import { applyProfile } from './mapping/SystemProfiles'
import { transformRows, type TransformedRow, type TransformOptions } from './mapping/TransformEngine'

/** Severity level for pipeline issues */
export type IssueSeverity = 'error' | 'warning' | 'info'

/** A single issue detected during pipeline processing */
export interface PipelineIssue {
  /** Issue severity */
  severity: IssueSeverity
  /** Pipeline stage where issue was found */
  stage: 'parse' | 'map' | 'transform' | 'validate'
  /** Human-readable message (Polish) */
  message: string
  /** Row index (0-based), if applicable */
  row?: number
  /** Field name, if applicable */
  field?: string
}

/** Result of the conversion pipeline */
export interface PipelineResult {
  /** Transformed rows ready for XML generation */
  transformedRows: TransformedRow[]
  /** All issues found during processing */
  issues: PipelineIssue[]
  /** The mapping used */
  mapping: MappingResult | null
  /** Source sheet used */
  sheet: RawSheet | null
  /** File read result */
  fileResult: FileReadResult | null
}

/** Configuration for a pipeline run */
export interface PipelineConfig {
  /** JPK type to convert to */
  jpkType: string
  /** JPK sub-type */
  subType: string
  /** Transform options */
  transformOptions?: TransformOptions
  /** Skip validation step */
  skipValidation?: boolean
  /** Override mapping (instead of auto-detect) */
  customMapping?: MappingResult
}

/**
 * ConversionPipeline — the main orchestrator for file conversion.
 *
 * Flow:
 * 1. Parse: read file using FileReaderRegistry
 * 2. Map: apply system profile or autoMap
 * 3. Transform: convert raw values to canonical format
 * 4. Validate: check required fields, NIP checksums, date ranges
 */
export class ConversionPipeline {
  constructor(private registry: FileReaderRegistry) {}

  /**
   * Run the full pipeline on a file buffer.
   */
  run(buffer: Buffer, filename: string, config: PipelineConfig): PipelineResult {
    const issues: PipelineIssue[] = []

    // ── Stage 1: Parse ──
    let fileResult: FileReadResult
    try {
      fileResult = this.registry.read(buffer, filename)
    } catch (err) {
      issues.push({
        severity: 'error',
        stage: 'parse',
        message: `Błąd parsowania pliku: ${err instanceof Error ? err.message : String(err)}`,
      })
      return { transformedRows: [], issues, mapping: null, sheet: null, fileResult: null }
    }

    // Convert parse warnings to issues
    for (const w of fileResult.warnings) {
      issues.push({
        severity: w.level === 'warning' ? 'warning' : 'info',
        stage: 'parse',
        message: w.message,
        row: w.row,
      })
    }

    // Select first sheet (or sheet matching subType)
    const sheet = this.selectSheet(fileResult, config)
    if (!sheet) {
      issues.push({
        severity: 'error',
        stage: 'parse',
        message: 'Brak danych w pliku — nie znaleziono arkusza z danymi.',
      })
      return { transformedRows: [], issues, mapping: null, sheet: null, fileResult }
    }

    if (sheet.rows.length === 0) {
      issues.push({
        severity: 'error',
        stage: 'parse',
        message: 'Arkusz nie zawiera wierszy danych.',
      })
      return { transformedRows: [], issues, mapping: null, sheet, fileResult }
    }

    // ── Stage 2: Map ──
    const fields = getFieldDefinitions(config.jpkType, config.subType)
    let mapping: MappingResult

    if (config.customMapping) {
      mapping = config.customMapping
    } else {
      // Try system profile first
      const profileMapping = applyProfile(sheet)
      if (profileMapping) {
        mapping = profileMapping
      } else {
        mapping = autoMap(sheet, fields)
      }
    }

    if (mapping.mappings.length === 0) {
      issues.push({
        severity: 'error',
        stage: 'map',
        message: 'Nie udało się zmapować żadnej kolumny na pola JPK.',
      })
      return { transformedRows: [], issues, mapping, sheet, fileResult }
    }

    // Warn about unmapped required fields
    const requiredFields = fields.filter((f) => f.required).map((f) => f.name)
    const mappedFields = new Set(mapping.mappings.map((m) => m.targetField))
    const missingRequired = requiredFields.filter((f) => !mappedFields.has(f))

    for (const field of missingRequired) {
      issues.push({
        severity: 'warning',
        stage: 'map',
        message: `Wymagane pole "${field}" nie zostało zmapowane.`,
        field,
      })
    }

    // ── Stage 3: Transform ──
    const fieldTypeMap: Record<string, JpkFieldType> = {}
    for (const f of fields) {
      fieldTypeMap[f.name] = f.type
    }

    const transformedRows = transformRows(
      sheet.rows,
      mapping.mappings,
      fieldTypeMap,
      config.transformOptions,
    )

    // Collect transform warnings
    for (const row of transformedRows) {
      for (const warning of row.warnings) {
        issues.push({
          severity: 'warning',
          stage: 'transform',
          message: warning,
          row: row.index,
        })
      }
    }

    // ── Stage 4: Validate ──
    if (!config.skipValidation) {
      this.validate(transformedRows, fields, issues)
    }

    return { transformedRows, issues, mapping, sheet, fileResult }
  }

  /**
   * Run the pipeline on a pre-parsed sheet (skip parse step).
   */
  runOnSheet(sheet: RawSheet, config: PipelineConfig): PipelineResult {
    const issues: PipelineIssue[] = []

    if (sheet.rows.length === 0) {
      issues.push({
        severity: 'error',
        stage: 'parse',
        message: 'Arkusz nie zawiera wierszy danych.',
      })
      return { transformedRows: [], issues, mapping: null, sheet, fileResult: null }
    }

    // Map
    const fields = getFieldDefinitions(config.jpkType, config.subType)
    let mapping: MappingResult

    if (config.customMapping) {
      mapping = config.customMapping
    } else {
      const profileMapping = applyProfile(sheet)
      mapping = profileMapping ?? autoMap(sheet, fields)
    }

    if (mapping.mappings.length === 0) {
      issues.push({
        severity: 'error',
        stage: 'map',
        message: 'Nie udało się zmapować żadnej kolumny na pola JPK.',
      })
      return { transformedRows: [], issues, mapping, sheet, fileResult: null }
    }

    // Warn about unmapped required fields
    const requiredFields = fields.filter((f) => f.required).map((f) => f.name)
    const mappedFields = new Set(mapping.mappings.map((m) => m.targetField))
    const missingRequired = requiredFields.filter((f) => !mappedFields.has(f))

    for (const field of missingRequired) {
      issues.push({
        severity: 'warning',
        stage: 'map',
        message: `Wymagane pole "${field}" nie zostało zmapowane.`,
        field,
      })
    }

    // Transform
    const fieldTypeMap: Record<string, JpkFieldType> = {}
    for (const f of fields) {
      fieldTypeMap[f.name] = f.type
    }

    const transformedRows = transformRows(
      sheet.rows,
      mapping.mappings,
      fieldTypeMap,
      config.transformOptions,
    )

    for (const row of transformedRows) {
      for (const warning of row.warnings) {
        issues.push({
          severity: 'warning',
          stage: 'transform',
          message: warning,
          row: row.index,
        })
      }
    }

    // Validate
    if (!config.skipValidation) {
      this.validate(transformedRows, fields, issues)
    }

    return { transformedRows, issues, mapping, sheet, fileResult: null }
  }

  /**
   * Select the best sheet from a file result.
   */
  private selectSheet(fileResult: FileReadResult, config: PipelineConfig): RawSheet | null {
    if (fileResult.sheets.length === 0) return null

    // Try to find a sheet with matching metadata
    for (const sheet of fileResult.sheets) {
      if (sheet.metadata.subType === config.subType) {
        return sheet
      }
    }

    // Default to first sheet
    return fileResult.sheets[0]
  }

  /**
   * Validate transformed rows: required fields, NIP checksums, date consistency.
   */
  private validate(
    rows: TransformedRow[],
    fields: JpkFieldDef[],
    issues: PipelineIssue[],
  ): void {
    const requiredFields = fields.filter((f) => f.required)
    const nipFields = fields.filter((f) => f.type === 'nip')
    const dateFields = fields.filter((f) => f.type === 'date')
    const decimalFields = fields.filter((f) => f.type === 'decimal')

    for (const row of rows) {
      // Required field check
      for (const field of requiredFields) {
        const value = row.values[field.name]
        if (value === undefined || value === '') {
          issues.push({
            severity: 'error',
            stage: 'validate',
            message: `Wiersz ${row.index + 1}: brak wymaganego pola "${field.name}" (${field.label}).`,
            row: row.index,
            field: field.name,
          })
        }
      }

      // NIP checksum validation
      for (const field of nipFields) {
        const value = row.values[field.name]
        if (!value || value === '') continue

        const cleaned = value.replace(/[\s\-]/g, '').replace(/^PL/i, '')
        if (/^\d{10}$/.test(cleaned)) {
          const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
          const digits = cleaned.split('').map(Number)
          let sum = 0
          for (let i = 0; i < 9; i++) {
            sum += digits[i] * weights[i]
          }
          const checkDigit = sum % 11
          if (checkDigit === 10 || checkDigit !== digits[9]) {
            issues.push({
              severity: 'error',
              stage: 'validate',
              message: `Wiersz ${row.index + 1}: nieprawidłowa suma kontrolna NIP w polu "${field.name}": ${cleaned}.`,
              row: row.index,
              field: field.name,
            })
          }
        }
      }

      // Date validation: not in the future, valid format
      for (const field of dateFields) {
        const value = row.values[field.name]
        if (!value || value === '') continue

        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (!match) {
          issues.push({
            severity: 'error',
            stage: 'validate',
            message: `Wiersz ${row.index + 1}: nieprawidłowy format daty w polu "${field.name}": ${value}.`,
            row: row.index,
            field: field.name,
          })
        }
      }

      // Decimal validation: must be parseable
      for (const field of decimalFields) {
        const value = row.values[field.name]
        if (!value || value === '') continue

        if (isNaN(parseFloat(value))) {
          issues.push({
            severity: 'error',
            stage: 'validate',
            message: `Wiersz ${row.index + 1}: nieprawidłowa kwota w polu "${field.name}": ${value}.`,
            row: row.index,
            field: field.name,
          })
        }
      }
    }
  }
}
