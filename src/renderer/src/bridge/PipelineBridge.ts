import type { RawSheet } from '../../../core/models/types'
import type { MappingResult, ColumnMapping } from '../../../core/mapping/AutoMapper'
import type { PipelineConfig, PipelineResult } from '../../../core/ConversionPipeline'
import { ConversionPipeline } from '../../../core/ConversionPipeline'
import { createDefaultRegistry } from '../../../core/readers/FileReaderRegistry'
import type { ParsedFile } from '../types'
import type { CompanyData, PeriodData } from '../stores/companyStore'
import type { FileProcessingResult, FileProcessingStatus } from './types'
import { validateFile, type ValidationReport } from '../utils/validator'
import { generateXmlForFile, type XmlExportResult } from '../utils/xmlExporter'

// Lazy singleton pipeline instance
let pipelineInstance: ConversionPipeline | null = null

function getPipeline(): ConversionPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new ConversionPipeline(createDefaultRegistry())
  }
  return pipelineInstance
}

/**
 * Convert a UI ParsedFile to a core RawSheet for the pipeline.
 * Shared between mappingStore and PipelineBridge.
 */
export function parsedFileToRawSheet(file: ParsedFile): RawSheet {
  return {
    name: file.filename,
    headers: file.headers,
    rows: file.rows.map((cells, index) => ({ index, cells })),
    metadata: {
      system: file.system,
      jpkType: file.jpkType,
      subType: file.subType
    }
  }
}

/**
 * Build a PipelineConfig from user mappings.
 */
export function buildPipelineConfig(
  file: ParsedFile,
  mappings: ColumnMapping[]
): PipelineConfig {
  const customMapping: MappingResult = {
    mappings,
    unmappedFields: [],
    unmappedColumns: []
  }

  return {
    jpkType: file.jpkType,
    subType: file.subType,
    customMapping
  }
}

/**
 * Run the core ConversionPipeline on a pre-parsed file.
 * Returns the raw PipelineResult (transformed rows + issues).
 */
export function runPipelineForFile(
  file: ParsedFile,
  mappings: ColumnMapping[]
): PipelineResult {
  const pipeline = getPipeline()
  const sheet = parsedFileToRawSheet(file)
  const config = buildPipelineConfig(file, mappings)
  return pipeline.runOnSheet(sheet, config)
}

export interface ProcessFileOptions {
  /** Skip XML generation even if validation passes */
  skipXml?: boolean
  /** Force XML generation even if there are errors */
  forceXml?: boolean
}

/**
 * Full processing for a single file:
 * 1. Run core pipeline (transform + validate)
 * 2. Run UI validator (structure/content/checksums with auto-fix)
 * 3. Generate XML (unless errors block or skipXml is set)
 */
export function processFile(
  file: ParsedFile,
  mappings: ColumnMapping[],
  company: CompanyData,
  period: PeriodData,
  options?: ProcessFileOptions
): FileProcessingResult {
  const { skipXml = false, forceXml = false } = options ?? {}

  try {
    // Step 1: Run core pipeline
    const pipelineResult = runPipelineForFile(file, mappings)

    // Step 2: Run UI validator
    const validationReport: ValidationReport = validateFile(file, mappings)

    // Count pipeline errors + validation errors
    const pipelineErrors = pipelineResult.issues.filter((i) => i.severity === 'error').length
    const pipelineWarnings = pipelineResult.issues.filter((i) => i.severity === 'warning').length
    const totalErrors = pipelineErrors + validationReport.errorCount
    const totalWarnings = pipelineWarnings + validationReport.warningCount
    const hasErrors = totalErrors > 0
    const hasWarnings = totalWarnings > 0

    // Step 3: Generate XML
    let xmlResult: XmlExportResult | null = null
    let status: FileProcessingStatus = 'validated'

    if (!skipXml && (!hasErrors || forceXml)) {
      xmlResult = generateXmlForFile(file, mappings, company, period)
      status = xmlResult ? 'success' : 'error'
    }

    return {
      fileId: file.id,
      status,
      pipelineResult,
      validationReport,
      xmlResult,
      hasErrors,
      hasWarnings,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      error: null
    }
  } catch (err) {
    return {
      fileId: file.id,
      status: 'error',
      pipelineResult: null,
      validationReport: null,
      xmlResult: null,
      hasErrors: true,
      hasWarnings: false,
      errorCount: 1,
      warningCount: 0,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
