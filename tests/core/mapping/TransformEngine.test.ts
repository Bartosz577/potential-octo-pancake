import { describe, it, expect } from 'vitest'
import {
  transformDate,
  transformDecimal,
  transformInteger,
  transformNip,
  transformBoolean,
  transformCountry,
  transformString,
  transformValue,
  transformRows,
} from '../../../src/core/mapping/TransformEngine'

describe('TransformEngine', () => {
  // ── Date transforms ──
  describe('transformDate', () => {
    it('passes through YYYY-MM-DD unchanged', () => {
      const r = transformDate('2026-01-15')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(false)
      expect(r.warning).toBeUndefined()
    })

    it('converts DD.MM.YYYY → YYYY-MM-DD', () => {
      const r = transformDate('15.01.2026')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(true)
    })

    it('converts DD-MM-YYYY → YYYY-MM-DD', () => {
      const r = transformDate('15-01-2026')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(true)
    })

    it('converts DD/MM/YYYY → YYYY-MM-DD', () => {
      const r = transformDate('15/01/2026')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(true)
    })

    it('converts YYYY.MM.DD → YYYY-MM-DD', () => {
      const r = transformDate('2026.01.15')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(true)
    })

    it('converts YYYY/MM/DD → YYYY-MM-DD', () => {
      const r = transformDate('2026/01/15')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(true)
    })

    it('converts YYYYMMDD → YYYY-MM-DD', () => {
      const r = transformDate('20260115')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(true)
    })

    it('returns empty for empty input', () => {
      const r = transformDate('')
      expect(r.value).toBe('')
      expect(r.changed).toBe(false)
    })

    it('trims whitespace', () => {
      const r = transformDate('  15.01.2026  ')
      expect(r.value).toBe('2026-01-15')
      expect(r.changed).toBe(true)
    })

    it('warns on unrecognized format', () => {
      const r = transformDate('January 15, 2026')
      expect(r.warning).toContain('Nierozpoznany format daty')
    })

    it('warns on invalid month', () => {
      const r = transformDate('15.13.2026')
      expect(r.warning).toContain('Nieprawidłowy miesiąc')
    })

    it('warns on invalid day', () => {
      const r = transformDate('32.01.2026')
      expect(r.warning).toContain('Nieprawidłowy dzień')
    })

    it('warns on future date', () => {
      const r = transformDate('01.01.2099')
      expect(r.warning).toContain('Data z przyszłości')
    })

    it('allows future date when option set', () => {
      const r = transformDate('01.01.2099', { allowFutureDates: true })
      expect(r.value).toBe('2099-01-01')
      expect(r.warning).toBeUndefined()
    })
  })

  // ── Decimal transforms ──
  describe('transformDecimal', () => {
    it('converts comma decimal to dot', () => {
      const r = transformDecimal('102,95')
      expect(r.value).toBe('102.95')
      expect(r.changed).toBe(true)
    })

    it('passes through dot decimal', () => {
      const r = transformDecimal('102.95')
      expect(r.value).toBe('102.95')
    })

    it('formats to 2 decimal places by default', () => {
      const r = transformDecimal('100')
      expect(r.value).toBe('100.00')
    })

    it('rounds to specified decimal places', () => {
      const r = transformDecimal('1.2345', { decimalPlaces: 2 })
      expect(r.value).toBe('1.23')
    })

    it('handles 6 decimal places', () => {
      const r = transformDecimal('80,000000', { decimalPlaces: 6 })
      expect(r.value).toBe('80.000000')
    })

    it('removes spaces (thousand separators)', () => {
      const r = transformDecimal('1 234,56')
      expect(r.value).toBe('1234.56')
    })

    it('handles European thousand separators (dot as thousand, comma as decimal)', () => {
      const r = transformDecimal('1.234,56')
      expect(r.value).toBe('1234.56')
    })

    it('handles US thousand separators (comma as thousand, dot as decimal)', () => {
      const r = transformDecimal('1,234.56')
      expect(r.value).toBe('1234.56')
    })

    it('handles negative numbers', () => {
      const r = transformDecimal('-50,00')
      expect(r.value).toBe('-50.00')
    })

    it('returns empty for empty input', () => {
      const r = transformDecimal('')
      expect(r.value).toBe('')
      expect(r.changed).toBe(false)
    })

    it('warns on invalid number', () => {
      const r = transformDecimal('abc')
      expect(r.warning).toContain('Nieprawidłowa kwota')
    })

    it('trims whitespace', () => {
      const r = transformDecimal('  100,50  ')
      expect(r.value).toBe('100.50')
    })
  })

  // ── Integer transforms ──
  describe('transformInteger', () => {
    it('passes through valid integer', () => {
      const r = transformInteger('42')
      expect(r.value).toBe('42')
    })

    it('strips leading zeros', () => {
      const r = transformInteger('007')
      expect(r.value).toBe('7')
      expect(r.changed).toBe(true)
    })

    it('strips spaces', () => {
      const r = transformInteger(' 1 234 ')
      expect(r.value).toBe('1234')
    })

    it('returns empty for empty input', () => {
      const r = transformInteger('')
      expect(r.value).toBe('')
    })

    it('warns on non-integer', () => {
      const r = transformInteger('12.5')
      expect(r.warning).toContain('Nieprawidłowa liczba całkowita')
    })
  })

  // ── NIP transforms ──
  describe('transformNip', () => {
    it('passes through valid 10-digit NIP', () => {
      // Valid NIP: 5261040828 (Ministerstwo Finansów)
      const r = transformNip('5261040828')
      expect(r.value).toBe('5261040828')
      expect(r.changed).toBe(false)
      expect(r.warning).toBeUndefined()
    })

    it('strips dashes from formatted NIP', () => {
      const r = transformNip('526-104-08-28')
      expect(r.value).toBe('5261040828')
      expect(r.changed).toBe(true)
    })

    it('strips spaces', () => {
      const r = transformNip('526 104 08 28')
      expect(r.value).toBe('5261040828')
    })

    it('strips PL prefix', () => {
      const r = transformNip('PL5261040828')
      expect(r.value).toBe('5261040828')
    })

    it('strips PL prefix case-insensitive', () => {
      const r = transformNip('pl5261040828')
      expect(r.value).toBe('5261040828')
    })

    it('returns empty for empty input', () => {
      const r = transformNip('')
      expect(r.value).toBe('')
    })

    it('warns when not 10 digits', () => {
      const r = transformNip('123')
      expect(r.warning).toContain('NIP musi mieć 10 cyfr')
    })

    it('warns on invalid checksum', () => {
      const r = transformNip('1234567890')
      expect(r.warning).toContain('Nieprawidłowa suma kontrolna NIP')
    })

    it('valid NIP: 7680002466', () => {
      // Verify: 7*6+6*5+8*7+0*2+0*3+0*4+2*1+4*6+6*7 → check
      // Actually let's compute: 7*6=42, 6*5=30, 8*7=56, 0*2=0, 0*3=0, 0*4=0, 2*5=10, 4*6=24, 6*7=42
      // sum=204, 204%11=6 — last digit is 6 ✓
      const r = transformNip('7680002466')
      expect(r.value).toBe('7680002466')
      expect(r.warning).toBeUndefined()
    })
  })

  // ── Boolean transforms ──
  describe('transformBoolean', () => {
    it('converts "1" → "true"', () => {
      expect(transformBoolean('1').value).toBe('true')
    })

    it('converts "0" → "false"', () => {
      expect(transformBoolean('0').value).toBe('false')
    })

    it('converts "TAK" → "true"', () => {
      expect(transformBoolean('TAK').value).toBe('true')
    })

    it('converts "NIE" → "false"', () => {
      expect(transformBoolean('NIE').value).toBe('false')
    })

    it('converts "true" → "true" (unchanged)', () => {
      const r = transformBoolean('true')
      expect(r.value).toBe('true')
      expect(r.changed).toBe(false)
    })

    it('converts "false" → "false" (unchanged)', () => {
      const r = transformBoolean('false')
      expect(r.value).toBe('false')
      expect(r.changed).toBe(false)
    })

    it('converts "yes" → "true"', () => {
      expect(transformBoolean('yes').value).toBe('true')
    })

    it('converts "no" → "false"', () => {
      expect(transformBoolean('no').value).toBe('false')
    })

    it('returns empty for empty input', () => {
      expect(transformBoolean('').value).toBe('')
    })

    it('warns on unknown value', () => {
      const r = transformBoolean('maybe')
      expect(r.warning).toContain('Nierozpoznana wartość logiczna')
    })
  })

  // ── Country transforms ──
  describe('transformCountry', () => {
    it('passes through valid uppercase code', () => {
      const r = transformCountry('PL')
      expect(r.value).toBe('PL')
      expect(r.changed).toBe(false)
    })

    it('uppercases lowercase code', () => {
      const r = transformCountry('de')
      expect(r.value).toBe('DE')
      expect(r.changed).toBe(true)
    })

    it('returns empty for empty input', () => {
      expect(transformCountry('').value).toBe('')
    })

    it('warns on invalid code', () => {
      const r = transformCountry('Poland')
      expect(r.warning).toContain('Nieprawidłowy kod kraju')
    })
  })

  // ── String transforms ──
  describe('transformString', () => {
    it('trims whitespace', () => {
      const r = transformString('  hello  ')
      expect(r.value).toBe('hello')
      expect(r.changed).toBe(true)
    })

    it('collapses internal whitespace', () => {
      const r = transformString('Jan   Kowalski')
      expect(r.value).toBe('Jan Kowalski')
    })

    it('leaves clean string unchanged', () => {
      const r = transformString('clean')
      expect(r.value).toBe('clean')
      expect(r.changed).toBe(false)
    })
  })

  // ── transformValue dispatcher ──
  describe('transformValue', () => {
    it('dispatches date type', () => {
      expect(transformValue('15.01.2026', 'date').value).toBe('2026-01-15')
    })

    it('dispatches decimal type', () => {
      expect(transformValue('100,50', 'decimal').value).toBe('100.50')
    })

    it('dispatches integer type', () => {
      expect(transformValue('007', 'integer').value).toBe('7')
    })

    it('dispatches nip type', () => {
      expect(transformValue('526-104-08-28', 'nip').value).toBe('5261040828')
    })

    it('dispatches boolean type', () => {
      expect(transformValue('TAK', 'boolean').value).toBe('true')
    })

    it('dispatches country type', () => {
      expect(transformValue('pl', 'country').value).toBe('PL')
    })

    it('dispatches string type', () => {
      expect(transformValue('  abc  ', 'string').value).toBe('abc')
    })
  })

  // ── transformRows ──
  describe('transformRows', () => {
    it('transforms all rows using mapping', () => {
      const rows = [
        { index: 0, cells: ['1', '15.01.2026', 'FV/001', '100,50'] },
        { index: 1, cells: ['2', '16.01.2026', 'FV/002', '200,00'] },
      ]
      const mappings = [
        { sourceColumn: 0, targetField: 'LpSprzedazy' },
        { sourceColumn: 1, targetField: 'DataWystawienia' },
        { sourceColumn: 2, targetField: 'DowodSprzedazy' },
        { sourceColumn: 3, targetField: 'K_10' },
      ]
      const fieldTypes: Record<string, import('../../../src/core/mapping/JpkFieldDefinitions').JpkFieldType> = {
        LpSprzedazy: 'integer',
        DataWystawienia: 'date',
        DowodSprzedazy: 'string',
        K_10: 'decimal',
      }

      const result = transformRows(rows, mappings, fieldTypes)

      expect(result).toHaveLength(2)
      expect(result[0].values['LpSprzedazy']).toBe('1')
      expect(result[0].values['DataWystawienia']).toBe('2026-01-15')
      expect(result[0].values['DowodSprzedazy']).toBe('FV/001')
      expect(result[0].values['K_10']).toBe('100.50')

      expect(result[1].values['K_10']).toBe('200.00')
    })

    it('collects warnings from transforms', () => {
      const rows = [
        { index: 0, cells: ['not-a-number'] },
      ]
      const mappings = [
        { sourceColumn: 0, targetField: 'K_10' },
      ]
      const fieldTypes = { K_10: 'decimal' as const }

      const result = transformRows(rows, mappings, fieldTypes)
      expect(result[0].warnings.length).toBeGreaterThan(0)
      expect(result[0].warnings[0]).toContain('K_10')
    })

    it('handles missing source column gracefully', () => {
      const rows = [
        { index: 0, cells: ['a'] },
      ]
      const mappings = [
        { sourceColumn: 5, targetField: 'test' },
      ]
      const fieldTypes = { test: 'string' as const }

      const result = transformRows(rows, mappings, fieldTypes)
      expect(result[0].values['test']).toBe('')
    })
  })
})
