import { describe, it, expect } from 'vitest'
import { parseTxtFile, detectFileType } from '../../../src/renderer/src/utils/fileParser'
import type { ParsedFile } from '../../../src/renderer/src/types/index'

// ── Test data ──

// A valid NAMOS VDEK SprzedazWiersz line with 6 meta cols + many data cols (pipe-delimited)
const VALID_NAMOS_LINE =
  'PP01|NAMOS|JPK_VDEK|SprzedazWiersz|2024-01|2024-01|1|PL|1234567890|Firma|FV/1|2024-01-15|2024-01-15||||||||||||||||||||||||||100.00|23.00||||||||||||||||||||||||'

// ── parseTxtFile ──

describe('parseTxtFile', () => {
  it('parses a valid NAMOS VDEK line correctly', () => {
    const result: ParsedFile = parseTxtFile(VALID_NAMOS_LINE, 'test_JPK_VDEK.txt', 1024)

    expect(result.system).toBe('NAMOS')
    expect(result.jpkType).toBe('JPK_VDEK')
    expect(result.subType).toBe('SprzedazWiersz')
    expect(result.pointCode).toBe('PP01')
    expect(result.dateFrom).toBe('2024-01')
    expect(result.dateTo).toBe('2024-01')
    expect(result.filename).toBe('test_JPK_VDEK.txt')
    expect(result.fileSize).toBe(1024)
    expect(result.rowCount).toBe(1)
    expect(result.rows).toHaveLength(1)
    // First data column should be "1" (LpSprzedazy)
    expect(result.rows[0][0]).toBe('1')
    // id should be a non-empty string
    expect(result.id).toBeTruthy()
  })

  it('parses multiple lines', () => {
    const multiLine = VALID_NAMOS_LINE + '\n' + VALID_NAMOS_LINE
    const result = parseTxtFile(multiLine, 'multi.txt')

    expect(result.rowCount).toBe(2)
    expect(result.rows).toHaveLength(2)
  })

  it('ignores empty lines (\\r\\n and blank)', () => {
    const withBlanks = VALID_NAMOS_LINE + '\n\n\r\n' + VALID_NAMOS_LINE + '\n'
    const result = parseTxtFile(withBlanks, 'blanks.txt')

    expect(result.rowCount).toBe(2)
  })

  it('throws on empty content', () => {
    expect(() => parseTxtFile('', 'empty.txt')).toThrow('Plik jest pusty')
  })

  it('throws on whitespace-only content', () => {
    expect(() => parseTxtFile('   \n  \n  ', 'whitespace.txt')).toThrow('Plik jest pusty')
  })

  it('throws on row with too few columns (<=6)', () => {
    const shortLine = 'PP01|NAMOS|JPK_VDEK|SprzedazWiersz|2024-01|2024-01'
    expect(() => parseTxtFile(shortLine, 'short.txt')).toThrow('Nieprawidłowy format pliku')
  })

  it('throws on unknown system (not NAMOS/ESO)', () => {
    const unknownSystem =
      'PP01|SAP|JPK_VDEK|SprzedazWiersz|2024-01|2024-01|1|PL|1234567890|Firma'
    expect(() => parseTxtFile(unknownSystem, 'sap.txt')).toThrow('Nieznany system ERP: SAP')
  })

  it('throws on unknown jpkType', () => {
    const unknownType =
      'PP01|NAMOS|JPK_UNKNOWN|SprzedazWiersz|2024-01|2024-01|1|PL|1234567890|Firma'
    expect(() => parseTxtFile(unknownType, 'unknown.txt')).toThrow(
      'Nieznany typ JPK: JPK_UNKNOWN'
    )
  })

  it('accepts ESO as a valid system', () => {
    const esoLine = VALID_NAMOS_LINE.replace('NAMOS', 'ESO')
    const result = parseTxtFile(esoLine, 'eso.txt')
    expect(result.system).toBe('ESO')
  })

  it('defaults fileSize to 0 when not provided', () => {
    const result = parseTxtFile(VALID_NAMOS_LINE, 'nosize.txt')
    expect(result.fileSize).toBe(0)
  })

  it('computes columnCount from total columns minus meta columns', () => {
    const result = parseTxtFile(VALID_NAMOS_LINE, 'cols.txt')
    const totalCols = VALID_NAMOS_LINE.split('|').length
    expect(result.columnCount).toBe(totalCols - 6)
  })
})

// ── detectFileType ──

describe('detectFileType', () => {
  it('detects JPK_VDEK from filename containing JPK_VDEK', () => {
    const result = detectFileType('PP01_JPK_VDEK_SprzedazWiersz_2024.txt')
    expect(result).toEqual({ jpkType: 'JPK_VDEK', subType: 'SprzedazWiersz' })
  })

  it('detects JPK_VDEK from filename containing JPK_V7M', () => {
    const result = detectFileType('export_JPK_V7M_2024.txt')
    expect(result).toEqual({ jpkType: 'JPK_VDEK', subType: 'SprzedazWiersz' })
  })

  it('detects JPK_FA from filename', () => {
    const result = detectFileType('invoices_JPK_FA_2024.txt')
    expect(result).toEqual({ jpkType: 'JPK_FA', subType: 'Faktura' })
  })

  it('detects JPK_MAG WZ from filename containing both JPK_MAG and _WZ', () => {
    const result = detectFileType('warehouse_JPK_MAG_WZ_2024.txt')
    expect(result).toEqual({ jpkType: 'JPK_MAG', subType: 'WZ' })
  })

  it('detects JPK_MAG RW from filename containing both JPK_MAG and _RW', () => {
    const result = detectFileType('internal_JPK_MAG_RW_2024.txt')
    expect(result).toEqual({ jpkType: 'JPK_MAG', subType: 'RW' })
  })

  it('is case-insensitive', () => {
    const result = detectFileType('export_jpk_vdek_2024.TXT')
    expect(result).toEqual({ jpkType: 'JPK_VDEK', subType: 'SprzedazWiersz' })
  })

  it('returns null for unrecognized filename', () => {
    expect(detectFileType('random_file.txt')).toBeNull()
    expect(detectFileType('report_2024.xlsx')).toBeNull()
  })
})
