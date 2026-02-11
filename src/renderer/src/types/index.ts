export type JpkType = 'JPK_VDEK' | 'JPK_FA' | 'JPK_MAG'
export type SubType = 'SprzedazWiersz' | 'Faktura' | 'WZ' | 'RW'
export type ErpSystem = 'NAMOS' | 'ESO'

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
}
