// ── Core data models for JPK Universal Converter ──

/** Supported JPK structure types */
export type JpkType = 'JPK_VDEK' | 'JPK_FA' | 'JPK_MAG' | 'JPK_WB'

/** Sub-type within a JPK structure */
export type SubType = 'SprzedazWiersz' | 'ZakupWiersz' | 'Faktura' | 'FakturaWiersz' | 'WZ' | 'PZ' | 'RW' | 'MM'

/** Known ERP systems */
export type ErpSystem = 'NAMOS' | 'ESO' | 'UNKNOWN'

/** Detected file encoding */
export type FileEncoding = 'utf-8' | 'windows-1250' | 'iso-8859-2' | 'cp852'

// ── File Reader interfaces ──

/** A single row of raw data parsed from a source file */
export interface ParsedRow {
  /** Original row number in the source file (0-based) */
  index: number
  /** Raw cell values as strings */
  cells: string[]
}

/** A sheet/section of raw parsed data */
export interface RawSheet {
  /** Sheet or section name (e.g. filename, Excel sheet name) */
  name: string
  /** Column headers, if detected */
  headers?: string[]
  /** Data rows */
  rows: ParsedRow[]
  /** File-level metadata extracted during parsing */
  metadata: Record<string, string>
}

/** Result of encoding detection */
export interface EncodingResult {
  /** Detected encoding */
  encoding: FileEncoding
  /** Confidence score 0.0–1.0 */
  confidence: number
}

/** Result of separator detection */
export interface SeparatorResult {
  /** Detected separator character */
  separator: string
  /** Confidence score 0.0–1.0 */
  confidence: number
}

/** Warnings generated during file parsing */
export interface ParseWarning {
  /** Warning severity */
  level: 'info' | 'warning'
  /** Human-readable message (Polish) */
  message: string
  /** Row number where the issue was found (0-based), if applicable */
  row?: number
}

/** Result returned by a FileReaderPlugin */
export interface FileReadResult {
  /** Parsed sheets/sections */
  sheets: RawSheet[]
  /** Detected encoding used for decoding */
  encoding: FileEncoding
  /** Separator used (for delimited formats) */
  separator?: string
  /** Warnings encountered during parsing */
  warnings: ParseWarning[]
}

/** Plugin interface that all file readers must implement */
export interface FileReaderPlugin {
  /** Unique reader name */
  readonly name: string
  /** File extensions this reader supports (lowercase, without dot) */
  readonly supportedExtensions: string[]
  /** Check if this reader can handle the given file */
  canRead(buffer: Buffer, filename: string): boolean
  /** Parse the file and return structured data */
  read(buffer: Buffer, filename: string): FileReadResult
}
