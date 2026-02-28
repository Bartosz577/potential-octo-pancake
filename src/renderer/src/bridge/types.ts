import type { PipelineResult } from '../../../core/ConversionPipeline'
import type { ValidationReport } from '../utils/validator'
import type { XmlExportResult } from '../utils/xmlExporter'

export type FileProcessingStatus =
  | 'idle'
  | 'validating'
  | 'validated'
  | 'generating'
  | 'success'
  | 'error'

export type BridgeStatus =
  | 'idle'
  | 'validating'
  | 'generating'
  | 'success'
  | 'error'

export interface FileProcessingResult {
  fileId: string
  status: FileProcessingStatus
  pipelineResult: PipelineResult | null
  validationReport: ValidationReport | null
  xmlResult: XmlExportResult | null
  hasErrors: boolean
  hasWarnings: boolean
  errorCount: number
  warningCount: number
  error: string | null
}

export interface BridgeSummary {
  status: BridgeStatus
  totalFiles: number
  processedFiles: number
  totalErrors: number
  totalWarnings: number
  canExport: boolean
}
