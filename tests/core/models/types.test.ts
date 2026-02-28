import { describe, it, expect } from 'vitest'
import type {
  RawSheet,
  ParsedRow,
  FileReadResult,
  FileEncoding,
  JpkType,
  ErpSystem
} from '../../../src/core/models/types'

describe('Core type definitions', () => {
  it('ParsedRow holds index and cells', () => {
    const row: ParsedRow = { index: 0, cells: ['a', 'b', 'c'] }
    expect(row.index).toBe(0)
    expect(row.cells).toEqual(['a', 'b', 'c'])
  })

  it('RawSheet holds name, rows, and metadata', () => {
    const sheet: RawSheet = {
      name: 'test.txt',
      rows: [{ index: 0, cells: ['val1', 'val2'] }],
      metadata: { system: 'NAMOS' }
    }
    expect(sheet.name).toBe('test.txt')
    expect(sheet.rows).toHaveLength(1)
    expect(sheet.metadata.system).toBe('NAMOS')
  })

  it('RawSheet supports optional headers', () => {
    const sheet: RawSheet = {
      name: 'data.csv',
      headers: ['col1', 'col2'],
      rows: [],
      metadata: {}
    }
    expect(sheet.headers).toEqual(['col1', 'col2'])
  })

  it('FileReadResult contains sheets, encoding, and warnings', () => {
    const result: FileReadResult = {
      sheets: [],
      encoding: 'utf-8',
      separator: '|',
      warnings: []
    }
    expect(result.encoding).toBe('utf-8')
    expect(result.separator).toBe('|')
  })

  it('JpkType includes all supported types', () => {
    const types: JpkType[] = ['JPK_VDEK', 'JPK_FA', 'JPK_MAG', 'JPK_WB']
    expect(types).toHaveLength(4)
  })

  it('ErpSystem includes UNKNOWN', () => {
    const systems: ErpSystem[] = ['NAMOS', 'ESO', 'UNKNOWN']
    expect(systems).toContain('UNKNOWN')
  })

  it('FileEncoding covers all supported encodings', () => {
    const encodings: FileEncoding[] = ['utf-8', 'windows-1250', 'iso-8859-2', 'cp852']
    expect(encodings).toHaveLength(4)
  })
})
