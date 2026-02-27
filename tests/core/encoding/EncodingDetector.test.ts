import { describe, it, expect } from 'vitest'
import * as iconv from 'iconv-lite'
import { detectEncoding, decodeBuffer, autoDecodeBuffer } from '../../../src/core/encoding/EncodingDetector'

describe('EncodingDetector', () => {
  describe('detectEncoding', () => {
    it('detects empty buffer as UTF-8', () => {
      const result = detectEncoding(Buffer.alloc(0))
      expect(result.encoding).toBe('utf-8')
      expect(result.confidence).toBe(1.0)
    })

    it('detects UTF-8 BOM', () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f])
      const result = detectEncoding(bom)
      expect(result.encoding).toBe('utf-8')
      expect(result.confidence).toBe(1.0)
    })

    it('detects pure ASCII as UTF-8 with high confidence', () => {
      const ascii = Buffer.from('Hello world 12345!@#', 'ascii')
      const result = detectEncoding(ascii)
      expect(result.encoding).toBe('utf-8')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('detects UTF-8 encoded Polish text', () => {
      // "Zażółć gęślą jaźń" in UTF-8
      const utf8 = Buffer.from('Zażółć gęślą jaźń', 'utf-8')
      const result = detectEncoding(utf8)
      expect(result.encoding).toBe('utf-8')
      expect(result.confidence).toBeGreaterThanOrEqual(0.95)
    })

    it('detects windows-1250 encoded Polish text', () => {
      // Encode "Zażółć gęślą jaźń" in windows-1250
      const win1250 = iconv.encode('Zażółć gęślą jaźń', 'windows-1250')
      const result = detectEncoding(win1250)
      expect(result.encoding).toBe('windows-1250')
      expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('detects windows-1250 with typical ERP data', () => {
      // Simulate typical Polish ERP data in windows-1250
      const text = 'KURZĘTNIK|Sienkiewicza 4|Zielińscy|Świętokrzyskie'
      const win1250 = iconv.encode(text, 'windows-1250')
      const result = detectEncoding(win1250)
      expect(result.encoding).toBe('windows-1250')
    })

    it('handles pipe-separated ASCII data (no Polish chars)', () => {
      const ascii = Buffer.from('0P549|ESO|JPK_MAG|WZ|2026-01-31|100,00|Szt.', 'ascii')
      const result = detectEncoding(ascii)
      expect(result.encoding).toBe('utf-8') // ASCII is valid UTF-8
    })
  })

  describe('decodeBuffer', () => {
    it('decodes UTF-8 buffer', () => {
      const buf = Buffer.from('Zażółć gęślą jaźń', 'utf-8')
      const text = decodeBuffer(buf, 'utf-8')
      expect(text).toBe('Zażółć gęślą jaźń')
    })

    it('decodes windows-1250 buffer', () => {
      const buf = iconv.encode('Zażółć gęślą jaźń', 'windows-1250')
      const text = decodeBuffer(buf, 'windows-1250')
      expect(text).toBe('Zażółć gęślą jaźń')
    })

    it('strips UTF-8 BOM during decode', () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf])
      const content = Buffer.from('Hello', 'utf-8')
      const buf = Buffer.concat([bom, content])
      const text = decodeBuffer(buf, 'utf-8')
      expect(text).toBe('Hello')
      expect(text).not.toContain('\uFEFF')
    })

    it('decodes iso-8859-2 buffer', () => {
      const buf = iconv.encode('Łódź', 'iso-8859-2')
      const text = decodeBuffer(buf, 'iso-8859-2')
      expect(text).toBe('Łódź')
    })

    it('decodes cp852 buffer', () => {
      const buf = iconv.encode('Łódź', 'cp852')
      const text = decodeBuffer(buf, 'cp852')
      expect(text).toBe('Łódź')
    })
  })

  describe('autoDecodeBuffer', () => {
    it('auto-detects and decodes UTF-8 Polish text', () => {
      const buf = Buffer.from('Kraków|Wrocław|Gdańsk', 'utf-8')
      const { text, encoding } = autoDecodeBuffer(buf)
      expect(encoding).toBe('utf-8')
      expect(text).toContain('Kraków')
      expect(text).toContain('Gdańsk')
    })

    it('auto-detects and decodes windows-1250 Polish text', () => {
      const buf = iconv.encode('Kraków|Wrocław|Gdańsk', 'windows-1250')
      const { text, encoding } = autoDecodeBuffer(buf)
      expect(encoding).toBe('windows-1250')
      expect(text).toContain('Kraków')
      expect(text).toContain('Gdańsk')
    })
  })
})
