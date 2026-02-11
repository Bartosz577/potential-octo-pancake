import type { ParsedFile, JpkType, SubType, ErpSystem } from '../types'

const META_COLUMNS = 6

let idCounter = 0

function generateId(): string {
  return `file_${Date.now()}_${++idCounter}`
}

export function parseTxtFile(content: string, filename: string): ParsedFile {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    throw new Error('Plik jest pusty')
  }

  const firstRow = lines[0].split('|')

  if (firstRow.length <= META_COLUMNS) {
    throw new Error(
      `Nieprawidłowy format pliku: oczekiwano więcej niż ${META_COLUMNS} kolumn, znaleziono ${firstRow.length}`
    )
  }

  const pointCode = firstRow[0]
  const system = firstRow[1] as ErpSystem
  const jpkType = firstRow[2] as JpkType
  const subType = firstRow[3] as SubType
  const dateFrom = firstRow[4]
  const dateTo = firstRow[5]

  if (!['NAMOS', 'ESO'].includes(system)) {
    throw new Error(`Nieznany system ERP: ${system}`)
  }

  if (!['JPK_VDEK', 'JPK_FA', 'JPK_MAG'].includes(jpkType)) {
    throw new Error(`Nieznany typ JPK: ${jpkType}`)
  }

  // Determine expected column count from first row
  const totalColumns = firstRow.length
  const columnCount = totalColumns - META_COLUMNS

  const rows: string[][] = []

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('|')
    const dataCols = cols.slice(META_COLUMNS, META_COLUMNS + columnCount)
    rows.push(dataCols)
  }

  return {
    id: generateId(),
    filename,
    system,
    jpkType,
    subType,
    pointCode,
    dateFrom,
    dateTo,
    rows,
    rowCount: rows.length,
    columnCount
  }
}

export function detectFileType(filename: string): { jpkType: JpkType; subType: SubType } | null {
  const upper = filename.toUpperCase()

  if (upper.includes('JPK_VDEK') || upper.includes('JPK_V7M')) {
    return { jpkType: 'JPK_VDEK', subType: 'SprzedazWiersz' }
  }
  if (upper.includes('JPK_FA')) {
    return { jpkType: 'JPK_FA', subType: 'Faktura' }
  }
  if (upper.includes('JPK_MAG') && upper.includes('_WZ')) {
    return { jpkType: 'JPK_MAG', subType: 'WZ' }
  }
  if (upper.includes('JPK_MAG') && upper.includes('_RW')) {
    return { jpkType: 'JPK_MAG', subType: 'RW' }
  }

  return null
}
