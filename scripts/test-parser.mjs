import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const META_COLUMNS = 6

function parseTxtFile(content, filename) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) throw new Error('Plik jest pusty')

  const firstRow = lines[0].split('|')
  const pointCode = firstRow[0]
  const system = firstRow[1]
  const jpkType = firstRow[2]
  const subType = firstRow[3]
  const dateFrom = firstRow[4]
  const dateTo = firstRow[5]

  const totalColumns = firstRow.length
  const columnCount = totalColumns - META_COLUMNS

  const rows = []
  for (const line of lines) {
    const cols = line.split('|')
    const dataCols = cols.slice(META_COLUMNS, META_COLUMNS + columnCount)
    rows.push(dataCols)
  }

  return {
    filename, system, jpkType, subType, pointCode, dateFrom, dateTo,
    rows, rowCount: rows.length, columnCount
  }
}

// Run tests
const testDataDir = join(import.meta.dirname, '..', 'test-data')
const files = readdirSync(testDataDir).filter((f) => f.endsWith('.txt'))

const expected = {
  'JPK_VDEK': { rows: 1107, cols: 64 },
  'JPK_FA':   { rows: 1107, cols: 56 },
  'JPK_MAG':  { rows: 171,  cols: 15 }
}

let allPassed = true

for (const file of files) {
  const content = readFileSync(join(testDataDir, file), 'utf-8')
  const parsed = parseTxtFile(content, file)

  const exp = expected[parsed.jpkType]
  const rowOk = exp && parsed.rowCount === exp.rows
  const colOk = exp && parsed.columnCount === exp.cols

  const status = rowOk && colOk ? '✅' : '❌'
  if (!rowOk || !colOk) allPassed = false

  console.log(`${status} ${file}`)
  console.log(`   System: ${parsed.system} | Typ: ${parsed.jpkType} | Podtyp: ${parsed.subType}`)
  console.log(`   Punkt: ${parsed.pointCode} | Okres: ${parsed.dateFrom} – ${parsed.dateTo}`)
  console.log(`   Wierszy: ${parsed.rowCount} (oczekiwano: ${exp?.rows}) | Kolumn danych: ${parsed.columnCount} (oczekiwano: ${exp?.cols})`)
  console.log()
}

console.log(allPassed ? '✅ Wszystkie testy przeszły!' : '❌ Niektóre testy nie przeszły!')
process.exit(allPassed ? 0 : 1)
