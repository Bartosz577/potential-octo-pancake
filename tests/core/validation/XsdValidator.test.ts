import { describe, it, expect } from 'vitest'
import { validateXsd } from '../../../src/core/validation/XsdValidator'

// Import generators to trigger auto-registration
import { generateJpkV7m, type V7mGeneratorInput } from '../../../src/core/generators/JpkV7mGenerator'
import { V7M_NAMESPACE } from '../../../src/core/generators/JpkV7mGenerator'

// Helper: minimal valid V7M XML
function makeV7mInput(overrides?: Partial<V7mGeneratorInput>): V7mGeneratorInput {
  return {
    naglowek: {
      celZlozenia: 1,
      kodUrzedu: '1471',
      rok: 2026,
      miesiac: 1,
      nazwaSystemu: 'Test'
    },
    podmiot: {
      typ: 'niefizyczna',
      nip: '5261040828',
      pelnaNazwa: 'Test Sp. z o.o.',
      email: 'test@test.pl'
    },
    sprzedazWiersze: [
      {
        LpSprzedazy: '1',
        KodKontrahenta: 'PL',
        NrKontrahenta: '1234563218',
        DowodSprzedazy: 'FV/2026/001',
        DataWystawienia: '2026-01-15',
        DataSprzedazy: '2026-01-15',
        BFK: '1',
        K_19: '100.00',
        K_20: '23.00'
      }
    ],
    zakupWiersze: [],
    ...overrides
  }
}

function generateValidV7m(overrides?: Partial<V7mGeneratorInput>): string {
  return generateJpkV7m(makeV7mInput(overrides))
}

describe('XsdValidator', () => {
  describe('XML parsing', () => {
    it('rejects non-XML content (no JPK root)', () => {
      const result = validateXsd('not xml at all')
      expect(result.valid).toBe(false)
      // fast-xml-parser is lenient, so it parses but finds no JPK root
      expect(result.issues.some((i) => i.code === 'XSD_NO_ROOT')).toBe(true)
    })

    it('rejects XML without JPK root', () => {
      const result = validateXsd('<?xml version="1.0"?><root><child/></root>')
      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.code === 'XSD_NO_ROOT')).toBe(true)
    })
  })

  describe('JPK type detection', () => {
    it('detects JPK_V7M from kodSystemowy', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_V7M')
    })

    it('accepts expectedType override', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml, 'JPK_V7M')
      expect(result.jpkType).toBe('JPK_V7M')
    })
  })

  describe('namespace validation', () => {
    it('valid namespace passes', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      const nsIssue = result.issues.find((i) => i.code === 'XSD_NAMESPACE_OK')
      expect(nsIssue).toBeDefined()
    })

    it('wrong namespace is an error', () => {
      const xml = generateValidV7m().replace(V7M_NAMESPACE, 'http://wrong.namespace/')
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_WRONG_NAMESPACE')).toBe(true)
    })
  })

  describe('header validation', () => {
    it('valid header passes', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      // Should not have header-related errors
      const headerErrors = result.issues.filter(
        (i) => i.severity === 'error' && i.path?.startsWith('Naglowek')
      )
      expect(headerErrors).toHaveLength(0)
    })

    it('wrong kodSystemowy is an error', () => {
      const xml = generateValidV7m().replace('JPK_V7M (3)', 'JPK_V7M (2)')
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_ATTRIBUTE')).toBe(true)
    })

    it('wrong wersjaSchemy is an error', () => {
      const xml = generateValidV7m().replace('wersjaSchemy="1-0E"', 'wersjaSchemy="2-0"')
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_INVALID_ATTRIBUTE' && i.message.includes('wersjaSchemy')
      )).toBe(true)
    })

    it('wrong WariantFormularza is an error', () => {
      const xml = generateValidV7m().replace(
        '<WariantFormularza>3</WariantFormularza>',
        '<WariantFormularza>2</WariantFormularza>'
      )
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_VALUE')).toBe(true)
    })

    it('missing KodUrzedu is an error', () => {
      const xml = generateValidV7m().replace(/<KodUrzedu>.*?<\/KodUrzedu>/, '')
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_ELEMENT' && i.message.includes('KodUrzedu')
      )).toBe(true)
    })
  })

  describe('required sections', () => {
    it('reports missing Podmiot1', () => {
      let xml = generateValidV7m()
      // Remove Podmiot1 section
      xml = xml.replace(/<Podmiot1[\s\S]*?<\/Podmiot1>/, '')
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_SECTION' && i.message.includes('Podmiot1')
      )).toBe(true)
    })

    it('reports missing Ewidencja (V7M)', () => {
      let xml = generateValidV7m()
      xml = xml.replace(/<Ewidencja[\s\S]*?<\/Ewidencja>/, '')
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_SECTION' && i.message.includes('Ewidencja')
      )).toBe(true)
    })
  })

  describe('NIP validation', () => {
    it('valid 10-digit NIP passes', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_NIP')).toBe(false)
    })

    it('invalid NIP format is an error', () => {
      const xml = generateValidV7m().replace(
        '<NIP>5261040828</NIP>',
        '<NIP>12345</NIP>'
      )
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_NIP')).toBe(true)
    })
  })

  describe('control sum validation', () => {
    it('correct row count passes', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      const countOk = result.issues.find((i) => i.code === 'XSD_CTRL_COUNT_OK')
      expect(countOk).toBeDefined()
    })

    it('correct PodatekNalezny passes', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      const sumOk = result.issues.find((i) => i.code === 'XSD_CTRL_SUM_OK')
      expect(sumOk).toBeDefined()
    })

    it('wrong row count is an error', () => {
      let xml = generateValidV7m()
      // Change the count to something wrong
      xml = xml.replace(
        '<LiczbaWierszySprzedazy>1</LiczbaWierszySprzedazy>',
        '<LiczbaWierszySprzedazy>99</LiczbaWierszySprzedazy>'
      )
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_COUNT')).toBe(true)
    })

    it('wrong PodatekNalezny sum is an error', () => {
      let xml = generateValidV7m()
      xml = xml.replace(
        /<PodatekNalezny>[^<]*<\/PodatekNalezny>/,
        '<PodatekNalezny>999.99</PodatekNalezny>'
      )
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_SUM')).toBe(true)
    })
  })

  describe('V7M-specific', () => {
    it('validates Podmiot1 rola attribute', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      // Should not have rola warning (generator sets it correctly)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_ATTRIBUTE' && i.message.includes('rola')
      )).toBe(false)
    })
  })

  describe('row data format validation', () => {
    it('valid amount formats pass', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_ROW_AMOUNT_FORMAT')).toBe(false)
    })

    it('valid date formats pass', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_ROW_DATE_FORMAT')).toBe(false)
    })
  })

  describe('overall validation', () => {
    it('well-formed V7M XML is valid', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      expect(result.valid).toBe(true)
      expect(result.jpkType).toBe('JPK_V7M')
    })

    it('multi-row V7M XML is valid', () => {
      const xml = generateValidV7m({
        sprzedazWiersze: [
          {
            LpSprzedazy: '1',
            KodKontrahenta: 'PL',
            NrKontrahenta: '1234563218',
            DowodSprzedazy: 'FV/001',
            DataWystawienia: '2026-01-10',
            BFK: '1',
            K_19: '1000.00',
            K_20: '230.00'
          },
          {
            LpSprzedazy: '2',
            KodKontrahenta: 'PL',
            NrKontrahenta: '5261040828',
            DowodSprzedazy: 'FV/002',
            DataWystawienia: '2026-01-20',
            BFK: '1',
            K_19: '500.00',
            K_20: '115.00'
          }
        ]
      })
      const result = validateXsd(xml)
      expect(result.valid).toBe(true)
    })

    it('returns all issue types', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      const severities = new Set(result.issues.map((i) => i.severity))
      expect(severities.has('info')).toBe(true)
    })
  })
})
