import type { ParsedFile, JpkType, SubType, ErpSystem } from '../types'

const META_COLUMNS = 6

let idCounter = 0

function generateId(): string {
  return `file_${Date.now()}_${++idCounter}`
}

/** Normalize JPK type aliases to canonical unprefixed form */
function normalizeJpkType(raw: string): JpkType {
  const upper = raw.toUpperCase().trim()
  if (upper === 'JPK_V7M' || upper === 'JPK_V7K' || upper === 'JPK_VDEK' || upper === 'VDEK') return 'V7M'
  const stripped = upper.startsWith('JPK_') ? upper.slice(4) : upper
  const valid: JpkType[] = ['V7M', 'FA', 'MAG', 'WB', 'PKPIR', 'EWP', 'KR_PD', 'ST', 'ST_KR', 'FA_RR', 'KR']
  if (valid.includes(stripped as JpkType)) return stripped as JpkType
  return stripped as JpkType
}

export function parseTxtFile(content: string, filename: string, fileSize = 0): ParsedFile {
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
  const jpkType = normalizeJpkType(firstRow[2])
  const subType = firstRow[3] as SubType
  const dateFrom = firstRow[4]
  const dateTo = firstRow[5]

  if (!['NAMOS', 'ESO'].includes(system)) {
    throw new Error(`Nieznany system ERP: ${system}`)
  }

  if (!['V7M', 'FA', 'MAG', 'WB'].includes(jpkType)) {
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
    columnCount,
    fileSize
  }
}

export function detectFileType(filename: string): { jpkType: JpkType; subType: SubType } | null {
  const upper = filename.toUpperCase()

  if (upper.includes('JPK_VDEK') || upper.includes('JPK_V7M')) {
    return { jpkType: 'V7M', subType: 'SprzedazWiersz' }
  }
  if (upper.includes('JPK_FA')) {
    return { jpkType: 'FA', subType: 'Faktura' }
  }
  if (upper.includes('JPK_MAG') && upper.includes('_WZ')) {
    return { jpkType: 'MAG', subType: 'WZ' }
  }
  if (upper.includes('JPK_MAG') && upper.includes('_RW')) {
    return { jpkType: 'MAG', subType: 'RW' }
  }

  return null
}
