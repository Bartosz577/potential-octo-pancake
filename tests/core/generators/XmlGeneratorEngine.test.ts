import { describe, it, expect, beforeEach } from 'vitest'
import {
  escapeXml,
  formatAmount,
  formatDeclAmount,
  formatQuantity,
  parseAmount,
  formatDateTime,
  buildElement,
  buildAmountElement,
  buildQuantityElement,
  XML_DECLARATION,
  XmlGeneratorRegistry,
  generatorRegistry,
} from '../../../src/core/generators/XmlGeneratorEngine'

// Import generators to trigger their self-registration
import '../../../src/core/generators/JpkV7mGenerator'
import '../../../src/core/generators/JpkFaGenerator'
import '../../../src/core/generators/JpkMagGenerator'
import '../../../src/core/generators/JpkWbGenerator'

describe('XmlGeneratorEngine', () => {
  // ── escapeXml ──

  describe('escapeXml', () => {
    it('escapes ampersand', () => {
      expect(escapeXml('A & B')).toBe('A &amp; B')
    })

    it('escapes less-than', () => {
      expect(escapeXml('a < b')).toBe('a &lt; b')
    })

    it('escapes greater-than', () => {
      expect(escapeXml('a > b')).toBe('a &gt; b')
    })

    it('escapes double quotes', () => {
      expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;')
    })

    it('escapes single quotes', () => {
      expect(escapeXml("it's")).toBe('it&apos;s')
    })

    it('escapes all special characters together', () => {
      expect(escapeXml('<a & "b" \'c\'>')).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;')
    })

    it('returns empty string unchanged', () => {
      expect(escapeXml('')).toBe('')
    })

    it('returns normal text unchanged', () => {
      expect(escapeXml('Hello World 123')).toBe('Hello World 123')
    })

    it('handles Polish characters', () => {
      expect(escapeXml('ąćęłńóśźż')).toBe('ąćęłńóśźż')
    })
  })

  // ── formatAmount ──

  describe('formatAmount', () => {
    it('formats number to 2 decimal places', () => {
      expect(formatAmount(100)).toBe('100.00')
    })

    it('formats string number', () => {
      expect(formatAmount('1234.5')).toBe('1234.50')
    })

    it('formats zero', () => {
      expect(formatAmount(0)).toBe('0.00')
    })

    it('returns 0.00 for undefined', () => {
      expect(formatAmount(undefined)).toBe('0.00')
    })

    it('returns 0.00 for empty string', () => {
      expect(formatAmount('')).toBe('0.00')
    })

    it('returns 0.00 for NaN', () => {
      expect(formatAmount('abc')).toBe('0.00')
    })

    it('formats negative amount', () => {
      expect(formatAmount(-123.456)).toBe('-123.46')
    })

    it('rounds properly', () => {
      expect(formatAmount('99.999')).toBe('100.00')
    })
  })

  // ── formatDeclAmount ──

  describe('formatDeclAmount', () => {
    it('rounds to integer', () => {
      expect(formatDeclAmount(100.49)).toBe('100')
    })

    it('rounds up at .5', () => {
      expect(formatDeclAmount(100.5)).toBe('101')
    })

    it('returns 0 for undefined', () => {
      expect(formatDeclAmount(undefined)).toBe('0')
    })

    it('returns 0 for empty string', () => {
      expect(formatDeclAmount('')).toBe('0')
    })

    it('returns 0 for NaN', () => {
      expect(formatDeclAmount('xyz')).toBe('0')
    })

    it('handles string input', () => {
      expect(formatDeclAmount('1234.7')).toBe('1235')
    })
  })

  // ── formatQuantity ──

  describe('formatQuantity', () => {
    it('formats integer without trailing zeros', () => {
      expect(formatQuantity(10)).toBe('10')
    })

    it('formats with necessary decimal places', () => {
      expect(formatQuantity(1.5)).toBe('1.5')
    })

    it('strips trailing zeros', () => {
      expect(formatQuantity('3.140000')).toBe('3.14')
    })

    it('keeps up to 6 decimal places', () => {
      expect(formatQuantity('1.123456')).toBe('1.123456')
    })

    it('rounds at 6 decimal places', () => {
      expect(formatQuantity('1.1234567')).toBe('1.123457')
    })

    it('returns 0 for undefined', () => {
      expect(formatQuantity(undefined)).toBe('0')
    })

    it('returns 0 for empty string', () => {
      expect(formatQuantity('')).toBe('0')
    })

    it('returns 0 for NaN', () => {
      expect(formatQuantity('abc')).toBe('0')
    })
  })

  // ── parseAmount ──

  describe('parseAmount', () => {
    it('parses valid number string', () => {
      expect(parseAmount('123.45')).toBe(123.45)
    })

    it('returns 0 for undefined', () => {
      expect(parseAmount(undefined)).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(parseAmount('')).toBe(0)
    })

    it('returns 0 for NaN', () => {
      expect(parseAmount('not-a-number')).toBe(0)
    })

    it('parses negative number', () => {
      expect(parseAmount('-50.00')).toBe(-50)
    })
  })

  // ── formatDateTime ──

  describe('formatDateTime', () => {
    it('formats date without milliseconds', () => {
      const date = new Date('2026-02-27T10:30:00.000Z')
      expect(formatDateTime(date)).toBe('2026-02-27T10:30:00Z')
    })

    it('uses current date when no argument', () => {
      const result = formatDateTime()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    })

    it('strips milliseconds from ISO string', () => {
      const date = new Date('2026-01-15T08:45:30.123Z')
      expect(formatDateTime(date)).toBe('2026-01-15T08:45:30Z')
    })
  })

  // ── buildElement ──

  describe('buildElement', () => {
    it('creates simple element', () => {
      expect(buildElement('Name', 'value')).toBe('<Name>value</Name>')
    })

    it('escapes value', () => {
      expect(buildElement('Name', 'A & B')).toBe('<Name>A &amp; B</Name>')
    })

    it('includes attributes', () => {
      expect(buildElement('Tag', 'val', { type: 'G' })).toBe('<Tag type="G">val</Tag>')
    })

    it('includes multiple attributes', () => {
      const result = buildElement('KodFormularza', 'JPK_WB', {
        kodSystemowy: 'JPK_WB (1)',
        wersjaSchemy: '1-0',
      })
      expect(result).toBe('<KodFormularza kodSystemowy="JPK_WB (1)" wersjaSchemy="1-0">JPK_WB</KodFormularza>')
    })

    it('escapes attribute values', () => {
      expect(buildElement('Tag', 'val', { attr: 'a "b" c' }))
        .toBe('<Tag attr="a &quot;b&quot; c">val</Tag>')
    })

    it('handles empty value', () => {
      expect(buildElement('Empty', '')).toBe('<Empty></Empty>')
    })
  })

  // ── buildAmountElement ──

  describe('buildAmountElement', () => {
    it('creates element with formatted amount', () => {
      expect(buildAmountElement('Kwota', '1234.5')).toBe('<Kwota>1234.50</Kwota>')
    })

    it('handles undefined', () => {
      expect(buildAmountElement('Kwota', undefined)).toBe('<Kwota>0.00</Kwota>')
    })

    it('handles number input', () => {
      expect(buildAmountElement('Kwota', 99.9)).toBe('<Kwota>99.90</Kwota>')
    })
  })

  // ── buildQuantityElement ──

  describe('buildQuantityElement', () => {
    it('creates element with formatted quantity', () => {
      expect(buildQuantityElement('Ilosc', '10.5')).toBe('<Ilosc>10.5</Ilosc>')
    })

    it('handles undefined', () => {
      expect(buildQuantityElement('Ilosc', undefined)).toBe('<Ilosc>0</Ilosc>')
    })

    it('strips trailing zeros', () => {
      expect(buildQuantityElement('Ilosc', '3.14')).toBe('<Ilosc>3.14</Ilosc>')
    })
  })

  // ── XML_DECLARATION ──

  describe('XML_DECLARATION', () => {
    it('is the standard XML declaration', () => {
      expect(XML_DECLARATION).toBe('<?xml version="1.0" encoding="UTF-8"?>')
    })
  })

  // ── XmlGeneratorRegistry ──

  describe('XmlGeneratorRegistry', () => {
    let registry: XmlGeneratorRegistry

    beforeEach(() => {
      registry = new XmlGeneratorRegistry()
    })

    it('registers and retrieves a generator', () => {
      const gen = {
        jpkType: 'JPK_TEST',
        version: '1',
        namespace: 'http://test.example.com',
        generate: () => '<test/>',
      }
      registry.register(gen)
      expect(registry.get('JPK_TEST')).toBe(gen)
    })

    it('returns undefined for unregistered type', () => {
      expect(registry.get('JPK_UNKNOWN')).toBeUndefined()
    })

    it('getAll returns all registered generators', () => {
      const gen1 = { jpkType: 'A', version: '1', namespace: '', generate: () => '' }
      const gen2 = { jpkType: 'B', version: '2', namespace: '', generate: () => '' }
      registry.register(gen1)
      registry.register(gen2)
      expect(registry.getAll()).toHaveLength(2)
    })

    it('getAvailableTypes returns type names', () => {
      const gen = { jpkType: 'JPK_TEST', version: '1', namespace: '', generate: () => '' }
      registry.register(gen)
      expect(registry.getAvailableTypes()).toContain('JPK_TEST')
    })

    it('overwrites on duplicate registration', () => {
      const gen1 = { jpkType: 'X', version: '1', namespace: '', generate: () => 'v1' }
      const gen2 = { jpkType: 'X', version: '2', namespace: '', generate: () => 'v2' }
      registry.register(gen1)
      registry.register(gen2)
      expect(registry.get('X')?.version).toBe('2')
      expect(registry.getAll()).toHaveLength(1)
    })
  })

  // ── Singleton registry with auto-registered generators ──

  describe('generatorRegistry (singleton)', () => {
    it('has JPK_V7M registered', () => {
      const gen = generatorRegistry.get('JPK_V7M')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_V7M')
      expect(gen!.version).toBe('3')
    })

    it('has JPK_FA registered', () => {
      const gen = generatorRegistry.get('JPK_FA')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_FA')
      expect(gen!.version).toBe('4')
    })

    it('has JPK_MAG registered', () => {
      const gen = generatorRegistry.get('JPK_MAG')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_MAG')
      expect(gen!.version).toBe('2')
    })

    it('has JPK_WB registered', () => {
      const gen = generatorRegistry.get('JPK_WB')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_WB')
      expect(gen!.version).toBe('1')
    })

    it('lists all 4 generator types', () => {
      const types = generatorRegistry.getAvailableTypes()
      expect(types).toContain('JPK_V7M')
      expect(types).toContain('JPK_FA')
      expect(types).toContain('JPK_MAG')
      expect(types).toContain('JPK_WB')
      expect(types.length).toBeGreaterThanOrEqual(4)
    })

    it('JPK_V7M generator produces valid XML via registry', () => {
      const gen = generatorRegistry.get('JPK_V7M')!
      const xml = gen.generate({
        naglowek: { celZlozenia: 1, kodUrzedu: '0271', rok: 2026, miesiac: 1 },
        podmiot: { typ: 'niefizyczna', nip: '5261040828', pelnaNazwa: 'Test', email: 'test@test.com' },
        sprzedazWiersze: [],
        zakupWiersze: [],
      })
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain('<JPK')
      expect(xml).toContain('JPK_V7M (3)')
    })

    it('JPK_WB generator produces valid XML via registry', () => {
      const gen = generatorRegistry.get('JPK_WB')!
      const xml = gen.generate({
        naglowek: { dataOd: '2026-01-01', dataDo: '2026-01-31', kodUrzedu: '0271' },
        podmiot: {
          nip: '5261040828',
          pelnaNazwa: 'Test',
          adres: {
            wojewodztwo: 'MAZOWIECKIE', powiat: 'Warszawa', gmina: 'Warszawa',
            nrDomu: '1', miejscowosc: 'Warszawa', kodPocztowy: '00-001', poczta: 'Warszawa',
          },
        },
        numerRachunku: 'PL61109010140000071219812874',
        saldoPoczatkowe: '1000.00',
        saldoKoncowe: '2000.00',
        wiersze: [{
          dataOperacji: '2026-01-15',
          nazwaPodmiotu: 'Test',
          opisOperacji: 'Test op',
          kwotaOperacji: '1000.00',
          saldoOperacji: '2000.00',
        }],
      })
      expect(xml).toContain('JPK_WB (1)')
      expect(xml).toContain('<WyciagWiersz typ="G">')
    })
  })
})
