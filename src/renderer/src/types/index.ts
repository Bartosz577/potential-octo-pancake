export type JpkType = 'JPK_VDEK' | 'JPK_FA' | 'JPK_MAG' | 'JPK_WB'
export type SubType = 'SprzedazWiersz' | 'Faktura' | 'WZ' | 'RW' | 'ZakupWiersz' | 'FakturaWiersz' | 'PZ' | 'MM'
export type ErpSystem = 'NAMOS' | 'ESO' | 'UNKNOWN'
export type FileFormat = 'txt' | 'csv' | 'xlsx' | 'json' | 'xml'

export interface ParsedFile {
  id: string
  filename: string
  system: ErpSystem
  jpkType: JpkType
  subType: SubType
  pointCode: string
  dateFrom: string
  dateTo: string
  rows: string[][]
  rowCount: number
  columnCount: number
  fileSize: number
  format?: FileFormat
  encoding?: string
  filePath?: string
  warnings?: string[]
  headers?: string[]
}
