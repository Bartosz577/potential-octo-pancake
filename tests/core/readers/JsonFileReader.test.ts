import { describe, it, expect, beforeAll } from 'vitest'
import { JsonFileReader } from '../../../src/core/readers/JsonFileReader'

describe('JsonFileReader', () => {
  let reader: JsonFileReader

  beforeAll(() => {
    reader = new JsonFileReader()
  })

  describe('canRead', () => {
    it('accepts .json files starting with {', () => {
      const buf = Buffer.from('{"data": []}')
      expect(reader.canRead(buf, 'data.json')).toBe(true)
    })

    it('accepts .json files starting with [', () => {
      const buf = Buffer.from('[{"a": 1}]')
      expect(reader.canRead(buf, 'data.json')).toBe(true)
    })

    it('rejects .csv files', () => {
      const buf = Buffer.from('a,b,c')
      expect(reader.canRead(buf, 'data.csv')).toBe(false)
    })

    it('rejects .json files with non-JSON content', () => {
      const buf = Buffer.from('not json at all')
      expect(reader.canRead(buf, 'data.json')).toBe(false)
    })
  })

  describe('read — array of objects', () => {
    it('parses flat array of objects', () => {
      const json = JSON.stringify([
        { nazwa: 'Młotek', cena: 25.5, ilość: 10 },
        { nazwa: 'Śruba', cena: 0.5, ilość: 100 }
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'products.json')

      expect(result.sheets).toHaveLength(1)
      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['nazwa', 'cena', 'ilość'])
      expect(sheet.rows).toHaveLength(2)
      expect(sheet.rows[0].cells).toEqual(['Młotek', '25.5', '10'])
      expect(sheet.rows[1].cells).toEqual(['Śruba', '0.5', '100'])
    })

    it('handles objects with different keys (union of all keys)', () => {
      const json = JSON.stringify([
        { a: 1, b: 2 },
        { b: 3, c: 4 },
        { a: 5, c: 6 }
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'mixed-keys.json')

      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['a', 'b', 'c'])
      // First object: a=1, b=2, c=missing
      expect(sheet.rows[0].cells).toEqual(['1', '2', ''])
      // Second object: a=missing, b=3, c=4
      expect(sheet.rows[1].cells).toEqual(['', '3', '4'])
    })

    it('handles null and undefined values', () => {
      const json = JSON.stringify([
        { name: 'A', value: null },
        { name: 'B', value: 0 },
        { name: null, value: 'test' }
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'nulls.json')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells).toEqual(['A', ''])
      expect(sheet.rows[1].cells).toEqual(['B', '0'])
      expect(sheet.rows[2].cells).toEqual(['', 'test'])
    })

    it('handles boolean values', () => {
      const json = JSON.stringify([
        { name: 'A', active: true },
        { name: 'B', active: false }
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'booleans.json')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells).toEqual(['A', 'true'])
      expect(sheet.rows[1].cells).toEqual(['B', 'false'])
    })

    it('serializes nested objects as JSON strings', () => {
      const json = JSON.stringify([
        { name: 'A', address: { city: 'Warszawa', zip: '00-001' } }
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'nested-val.json')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells[0]).toBe('A')
      // Nested object should be serialized as JSON string
      const addressCell = sheet.rows[0].cells[1]
      expect(JSON.parse(addressCell)).toEqual({ city: 'Warszawa', zip: '00-001' })
    })
  })

  describe('read — array of arrays', () => {
    it('parses array of arrays without headers', () => {
      const json = JSON.stringify([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'matrix.json')

      const sheet = result.sheets[0]
      expect(sheet.headers).toBeUndefined()
      expect(sheet.rows).toHaveLength(3)
      expect(sheet.rows[0].cells).toEqual(['1', '2', '3'])
    })

    it('detects string first row as headers', () => {
      const json = JSON.stringify([
        ['Name', 'Age', 'City'],
        ['Alice', 30, 'Warsaw'],
        ['Bob', 25, 'Kraków']
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'with-headers.json')

      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['Name', 'Age', 'City'])
      expect(sheet.rows).toHaveLength(2)
      expect(sheet.rows[0].cells).toEqual(['Alice', '30', 'Warsaw'])
    })
  })

  describe('read — nested object with data array', () => {
    it('finds data in "data" key', () => {
      const json = JSON.stringify({
        data: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' }
        ],
        totalCount: 2
      })
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'nested.json')

      expect(result.sheets).toHaveLength(1)
      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['id', 'name'])
      expect(sheet.rows).toHaveLength(2)
      // info warning about the key path
      expect(result.warnings.some((w) => w.message.includes('"data"'))).toBe(true)
    })

    it('finds data in "rows" key', () => {
      const json = JSON.stringify({
        rows: [{ x: 1 }, { x: 2 }],
        count: 2
      })
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'rows-key.json')

      expect(result.sheets[0].rows).toHaveLength(2)
      expect(result.warnings.some((w) => w.message.includes('"rows"'))).toBe(true)
    })

    it('finds data in "records" key', () => {
      const json = JSON.stringify({
        records: [{ a: 1 }],
        meta: { source: 'test' }
      })
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'records-key.json')

      expect(result.sheets[0].rows).toHaveLength(1)
    })

    it('falls back to first array property if no preferred key matches', () => {
      const json = JSON.stringify({
        version: '1.0',
        faktury: [
          { numer: 'FV/001', kwota: 100 },
          { numer: 'FV/002', kwota: 200 }
        ]
      })
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'custom-key.json')

      expect(result.sheets[0].rows).toHaveLength(2)
      expect(result.warnings.some((w) => w.message.includes('"faktury"'))).toBe(true)
    })

    it('extracts scalar metadata from top-level object', () => {
      const json = JSON.stringify({
        version: '2.0',
        source: 'NAMOS',
        data: [{ id: 1 }]
      })
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'meta.json')

      const sheet = result.sheets[0]
      expect(sheet.metadata.version).toBe('2.0')
      expect(sheet.metadata.source).toBe('NAMOS')
    })
  })

  describe('read — edge cases', () => {
    it('handles empty file', () => {
      const buf = Buffer.from('', 'utf-8')
      const result = reader.read(buf, 'empty.json')
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('pusty'))).toBe(true)
    })

    it('handles invalid JSON', () => {
      const buf = Buffer.from('{ invalid json }', 'utf-8')
      const result = reader.read(buf, 'invalid.json')
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('Błąd parsowania JSON'))).toBe(true)
    })

    it('handles JSON with no array data', () => {
      const json = JSON.stringify({ key: 'value', number: 42 })
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'no-array.json')
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('Nie znaleziono'))).toBe(true)
    })

    it('handles empty array', () => {
      const json = JSON.stringify([])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'empty-array.json')
      expect(result.sheets).toHaveLength(0)
    })

    it('handles array of primitives', () => {
      const json = JSON.stringify(['hello', 'world', 'test'])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'primitives.json')

      const sheet = result.sheets[0]
      expect(sheet.rows).toHaveLength(3)
      expect(sheet.rows[0].cells).toEqual(['hello'])
      expect(sheet.rows[2].cells).toEqual(['test'])
    })

    it('handles deeply nested data', () => {
      const json = JSON.stringify({
        response: {
          data: [{ a: 1 }, { a: 2 }]
        }
      })
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'deep.json')
      // Only searches first level — response.data won't be found
      // But response is an object, not an array, so nothing matches
      // The first array found would be in response.data but we only search top-level
      expect(result.sheets).toHaveLength(0)
    })

    it('preserves row indices', () => {
      const json = JSON.stringify([{ a: 1 }, { a: 2 }, { a: 3 }])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'indexed.json')
      const rows = result.sheets[0].rows
      expect(rows[0].index).toBe(0)
      expect(rows[1].index).toBe(1)
      expect(rows[2].index).toBe(2)
    })

    it('handles Polish characters in JSON values', () => {
      const json = JSON.stringify([
        { miasto: 'Łódź', firma: 'Zielińscy Sp. z o.o.' },
        { miasto: 'Świętokrzyskie', firma: 'Śrubex S.A.' }
      ])
      const buf = Buffer.from(json, 'utf-8')
      const result = reader.read(buf, 'polish.json')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells[0]).toBe('Łódź')
      expect(sheet.rows[1].cells[1]).toBe('Śrubex S.A.')
    })
  })
})
