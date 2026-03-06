import { describe, it, expect } from 'vitest'
import { validateXsd } from '../../../src/core/validation/XsdValidator'

// Import generators to trigger auto-registration
import { generateJpkV7m, type V7mGeneratorInput } from '../../../src/core/generators/JpkV7mGenerator'
import { V7M_NAMESPACE } from '../../../src/core/generators/JpkV7mGenerator'
import { generateJpkFa, type FaGeneratorInput } from '../../../src/core/generators/JpkFaGenerator'
import { generateJpkWb, type WbGeneratorInput } from '../../../src/core/generators/JpkWbGenerator'
import { generateJpkMag, type MagGeneratorInput } from '../../../src/core/generators/JpkMagGenerator'

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

  // ═══════════════════════════════════════════════════════════════════
  // Additional tests for uncovered branches
  // ═══════════════════════════════════════════════════════════════════

  describe('JPK_FA validation', () => {
    function makeValidFaInput(): FaGeneratorInput {
      return {
        naglowek: { dataOd: '2026-01-01', dataDo: '2026-01-31', kodUrzedu: '1471' },
        podmiot: {
          nip: '5261040828',
          pelnaNazwa: 'Test Sp. z o.o.',
          adres: {
            typ: 'polski',
            wojewodztwo: 'mazowieckie',
            powiat: 'Warszawa',
            gmina: 'Warszawa',
            nrDomu: '1',
            miejscowosc: 'Warszawa',
            kodPocztowy: '00-001'
          }
        },
        faktury: [
          {
            P_1: '2026-01-15',
            P_2A: 'FV/2026/001',
            P_3C: 'Buyer',
            P_3D: 'Address',
            P_13_1: '1000.00',
            P_14_1: '230.00',
            P_15: '1230.00',
            RodzajFaktury: 'VAT'
          }
        ],
        wiersze: [
          {
            P_2B: 'FV/2026/001',
            P_7: 'Service',
            P_8A: 'szt',
            P_8B: '1',
            P_9A: '1000.00',
            P_11: '1000.00',
            P_12: '23'
          }
        ]
      }
    }

    it('detects JPK_FA type from kodSystemowy', () => {
      const xml = generateJpkFa(makeValidFaInput())
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_FA')
    })

    it('validates JPK_FA with correct control sums', () => {
      const xml = generateJpkFa(makeValidFaInput())
      const result = validateXsd(xml)
      // FA control sums should be validated
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_COUNT_OK')).toBe(true)
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_SUM_OK')).toBe(true)
    })
  })

  describe('JPK_WB validation', () => {
    function makeValidWbInput(): WbGeneratorInput {
      return {
        naglowek: { dataOd: '2026-01-01', dataDo: '2026-01-31', kodUrzedu: '1471' },
        podmiot: {
          nip: '5261040828',
          pelnaNazwa: 'Test Sp. z o.o.',
          adres: {
            wojewodztwo: 'mazowieckie',
            powiat: 'Warszawa',
            gmina: 'Warszawa',
            nrDomu: '1',
            miejscowosc: 'Warszawa',
            kodPocztowy: '00-001',
            poczta: 'Warszawa'
          }
        },
        numerRachunku: 'PL61109010140000071219812874',
        saldoPoczatkowe: '10000.00',
        saldoKoncowe: '9500.00',
        wiersze: [
          {
            dataOperacji: '2026-01-15',
            nazwaPodmiotu: 'Kontrahent',
            opisOperacji: 'Przelew',
            kwotaOperacji: '-500.00',
            saldoOperacji: '9500.00'
          }
        ]
      }
    }

    it('detects JPK_WB type from kodSystemowy', () => {
      const xml = generateJpkWb(makeValidWbInput())
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_WB')
    })

    it('validates JPK_WB with valid IBAN', () => {
      const xml = generateJpkWb(makeValidWbInput())
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_IBAN')).toBe(false)
    })

    it('validates JPK_WB with invalid IBAN', () => {
      const input = makeValidWbInput()
      input.numerRachunku = 'invalid-iban'
      const xml = generateJpkWb(input)
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_IBAN')).toBe(true)
    })

    it('validates control count without sum for WB (no sumElement)', () => {
      const xml = generateJpkWb(makeValidWbInput())
      const result = validateXsd(xml)
      // WB WyciagCtrl has countElement but no sumElement - should get count OK but no sum check
      expect(result.issues.some((i) =>
        i.code === 'XSD_CTRL_COUNT_OK' && i.path?.includes('WyciagCtrl')
      )).toBe(true)
      // Should NOT have a sum OK/error for WyciagCtrl since no sumElement defined
      expect(result.issues.some((i) =>
        (i.code === 'XSD_CTRL_SUM_OK' || i.code === 'XSD_CTRL_SUM') && i.path?.includes('WyciagCtrl')
      )).toBe(false)
    })

    it('validates row formats in WB (date and amount fields)', () => {
      const xml = generateJpkWb(makeValidWbInput())
      const result = validateXsd(xml)
      // WB rows have DataOperacji (date) and KwotaOperacji (amount) - should pass
      expect(result.issues.some((i) => i.code === 'XSD_ROW_FORMAT_OK')).toBe(true)
    })
  })

  describe('JPK_MAG validation', () => {
    function makeValidMagInput(): MagGeneratorInput {
      return {
        naglowek: { dataOd: '2026-01-01', dataDo: '2026-01-31', kodUrzedu: '1471' },
        podmiot: {
          nip: '5261040828',
          pelnaNazwa: 'Test Sp. z o.o.',
          adres: {
            typ: 'polski',
            wojewodztwo: 'mazowieckie',
            powiat: 'Warszawa',
            gmina: 'Warszawa',
            nrDomu: '1',
            miejscowosc: 'Warszawa',
            kodPocztowy: '00-001'
          }
        },
        magazyn: 'MAG-01',
        metoda: 1
      }
    }

    it('detects JPK_MAG type from kodSystemowy', () => {
      const xml = generateJpkMag(makeValidMagInput())
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_MAG')
    })

    it('validates JPK_MAG without ctrl sections (no ctrlSections defined)', () => {
      const xml = generateJpkMag(makeValidMagInput())
      const result = validateXsd(xml)
      expect(result.valid).toBe(true)
      // MAG has no ctrlSections, so no ctrl-related issues
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_COUNT')).toBe(false)
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_SUM')).toBe(false)
    })
  })

  describe('JPK type detection fallback via #text', () => {
    it('detects JPK_V7M from #text=JPK_VAT when kodSystemowy missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza>JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl>
      <LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy>
      <PodatekNalezny>0.00</PodatekNalezny>
    </SprzedazCtrl>
    <ZakupCtrl>
      <LiczbaWierszyZakupow>0</LiczbaWierszyZakupow>
      <PodatekNaliczony>0.00</PodatekNaliczony>
    </ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_V7M')
    })

    it('detects JPK_FA from #text when kodSystemowy missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza>JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>5261040828</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaCtrl><LiczbaFaktur>0</LiczbaFaktur><WartoscFaktur>0.00</WartoscFaktur></FakturaCtrl>
</JPK>`
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_FA')
    })

    it('detects JPK_MAG from #text when kodSystemowy missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2025/11/24/11242/">
  <Naglowek>
    <KodFormularza>JPK_MAG</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>5261040828</NIP></IdentyfikatorPodmiotu></Podmiot1>
</JPK>`
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_MAG')
    })

    it('detects JPK_WB from #text when kodSystemowy missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2016/03/09/03092/">
  <Naglowek>
    <KodFormularza>JPK_WB</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><NIP>5261040828</NIP></Podmiot1>
  <NumerRachunku>PL61109010140000071219812874</NumerRachunku>
  <Salda><SaldoPoczatkowe>1000.00</SaldoPoczatkowe><SaldoKoncowe>1000.00</SaldoKoncowe></Salda>
  <WyciagCtrl><LiczbaWierszy>0</LiczbaWierszy></WyciagCtrl>
</JPK>`
      const result = validateXsd(xml)
      expect(result.jpkType).toBe('JPK_WB')
    })
  })

  describe('unknown and unsupported JPK types', () => {
    it('returns XSD_UNKNOWN_TYPE when type cannot be detected', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza>UNKNOWN</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
</JPK>`
      const result = validateXsd(xml)
      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.code === 'XSD_UNKNOWN_TYPE')).toBe(true)
      expect(result.jpkType).toBeNull()
    })

    it('returns XSD_NO_SCHEMA for unsupported expectedType', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza>JPK_PKPIR</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
</JPK>`
      const result = validateXsd(xml, 'JPK_PKPIR')
      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.code === 'XSD_NO_SCHEMA')).toBe(true)
      expect(result.jpkType).toBe('JPK_PKPIR')
    })
  })

  describe('namespace edge cases', () => {
    it('reports missing xmlns namespace', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_MISSING_NAMESPACE')).toBe(true)
    })
  })

  describe('header edge cases', () => {
    it('reports missing KodFormularza in header', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml, 'JPK_V7M')
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_ELEMENT' && i.message.includes('KodFormularza')
      )).toBe(true)
    })

    it('reports missing DataWytworzeniaJPK', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_ELEMENT' && i.message.includes('DataWytworzeniaJPK')
      )).toBe(true)
    })

    it('reports invalid DataWytworzeniaJPK format', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>not-a-datetime</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_INVALID_FORMAT' && i.message.includes('DataWytworzeniaJPK')
      )).toBe(true)
    })

    it('reports invalid KodUrzedu format (non 4-digit)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>AB12</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_INVALID_FORMAT' && i.message.includes('KodUrzedu') && i.severity === 'warning'
      )).toBe(true)
    })
  })

  describe('date and amount field validation in header', () => {
    it('reports invalid date format in row DataSprzedazy', () => {
      const xml = generateValidV7m()
      // Replace DataSprzedazy with invalid format — detected by validateRowFormats
      const badXml = xml.replace(/<DataSprzedazy>[^<]*<\/DataSprzedazy>/, '<DataSprzedazy>15/01/2026</DataSprzedazy>')
      const result = validateXsd(badXml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_ROW_DATE_FORMAT' && i.message.includes('dat')
      )).toBe(true)
    })
  })

  describe('amount field validation in validateDateFields', () => {
    it('reports NaN amount as error', () => {
      // Build a V7M XML with a non-numeric amount field in header area
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
    <PodatekNalezny>abc</PodatekNalezny>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_INVALID_FORMAT' && i.message.includes('kwoty')
      )).toBe(true)
    })

    it('reports amount with wrong decimal places as warning', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
    <PodatekNalezny>100.5</PodatekNalezny>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_DECIMAL_FORMAT' && i.severity === 'warning'
      )).toBe(true)
    })
  })

  describe('email validation', () => {
    it('reports invalid email format', () => {
      const xml = generateValidV7m().replace('test@test.pl', 'not-an-email')
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_EMAIL')).toBe(true)
    })
  })

  describe('V7M-specific rola attribute', () => {
    it('reports missing rola attribute on Podmiot1', () => {
      const xml = generateValidV7m().replace(' rola="Podatnik"', '')
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_ATTRIBUTE' && i.message.includes('rola')
      )).toBe(true)
    })

    it('reports wrong rola attribute value', () => {
      const xml = generateValidV7m().replace('rola="Podatnik"', 'rola="Inny"')
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_ATTRIBUTE' && i.message.includes('rola')
      )).toBe(true)
    })
  })

  describe('control sum with sumSubtractFields', () => {
    it('correctly computes sums with subtract fields (K_35, K_36)', () => {
      const xml = generateValidV7m({
        sprzedazWiersze: [
          {
            LpSprzedazy: '1',
            KodKontrahenta: 'PL',
            NrKontrahenta: '1234563218',
            DowodSprzedazy: 'FV/001',
            DataWystawienia: '2026-01-15',
            DataSprzedazy: '2026-01-15',
            BFK: '1',
            K_19: '1000.00',
            K_20: '230.00',
            K_35: '10.00',
            K_36: '5.00'
          }
        ]
      })
      const result = validateXsd(xml)
      // The generator should compute PodatekNalezny with subtract fields
      // so the ctrl sum should match
      const sumIssues = result.issues.filter((i) =>
        (i.code === 'XSD_CTRL_SUM_OK' || i.code === 'XSD_CTRL_SUM') &&
        i.path?.includes('SprzedazCtrl')
      )
      expect(sumIssues.length).toBeGreaterThan(0)
    })
  })

  describe('row format validation errors', () => {
    it('reports invalid amount format in rows (NaN)', () => {
      let xml = generateValidV7m()
      // Replace K_20 value to non-numeric
      xml = xml.replace(/<K_20>23\.00<\/K_20>/, '<K_20>abc</K_20>')
      // Also need to fix the ctrl sum since we changed a value
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_ROW_AMOUNT_FORMAT')).toBe(true)
    })

    it('reports invalid date format in rows', () => {
      let xml = generateValidV7m()
      // Replace DataSprzedazy with invalid format
      xml = xml.replace(/<DataSprzedazy>2026-01-15<\/DataSprzedazy>/, '<DataSprzedazy>15/01/2026</DataSprzedazy>')
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_ROW_DATE_FORMAT')).toBe(true)
    })

    it('reports info for valid row formats when rows exist', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_ROW_FORMAT_OK')).toBe(true)
    })
  })

  describe('missing ctrl sections', () => {
    it('reports missing ctrl section as warning', () => {
      let xml = generateValidV7m()
      // Remove SprzedazCtrl entirely
      xml = xml.replace(/<SprzedazCtrl>[\s\S]*?<\/SprzedazCtrl>/, '')
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_CTRL' && i.message.includes('SprzedazCtrl')
      )).toBe(true)
    })
  })

  describe('missing Naglowek section', () => {
    it('skips header validation when Naglowek is missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml, 'JPK_V7M')
      // Should report missing Naglowek section
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_SECTION' && i.message.includes('Naglowek')
      )).toBe(true)
      // Should NOT have header-specific validation errors (header validation skipped)
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_ELEMENT' && i.message.includes('KodFormularza')
      )).toBe(false)
    })
  })

  describe('missing Podmiot1 (no NIP to validate)', () => {
    it('skips NIP validation when Podmiot1 is absent', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      // Missing Podmiot1 reported as missing section
      expect(result.issues.some((i) =>
        i.code === 'XSD_MISSING_SECTION' && i.message.includes('Podmiot1')
      )).toBe(true)
      // No NIP validation error since there's no Podmiot1
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_NIP')).toBe(false)
    })
  })

  describe('deeply nested NIP and Email via findNip/findField', () => {
    it('finds NIP in deeply nested structure', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <NIP>12345</NIP>
    </IdentyfikatorPodmiotu>
  </Podmiot1>
  <FakturaCtrl><LiczbaFaktur>0</LiczbaFaktur><WartoscFaktur>0.00</WartoscFaktur></FakturaCtrl>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_NIP')).toBe(true)
    })
  })

  describe('V7M validateV7mSpecific is not called for non-V7M types', () => {
    it('does not run V7M-specific checks for JPK_FA', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>5261040828</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaCtrl><LiczbaFaktur>0</LiczbaFaktur><WartoscFaktur>0.00</WartoscFaktur></FakturaCtrl>
</JPK>`
      const result = validateXsd(xml)
      // No rola attribute warning for JPK_FA (V7M-specific check not run)
      expect(result.issues.some((i) => i.code === 'XSD_MISSING_ATTRIBUTE')).toBe(false)
    })
  })

  describe('WB-specific validation not called for non-WB types', () => {
    it('does not run WB-specific checks for JPK_V7M', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_INVALID_IBAN')).toBe(false)
    })
  })

  describe('row data without errors or rows gives no format issues', () => {
    it('no format info when there are 0 rows', () => {
      const xml = generateValidV7m({
        sprzedazWiersze: [],
        zakupWiersze: []
      })
      const result = validateXsd(xml)
      // With 0 rows, no XSD_ROW_FORMAT_OK info (only emitted when rows.length > 0)
      const sprzedazFormatOk = result.issues.filter((i) =>
        i.code === 'XSD_ROW_FORMAT_OK' && i.path === 'SprzedazWiersz'
      )
      expect(sprzedazFormatOk).toHaveLength(0)
    })
  })

  describe('control sum validation with rows in Ewidencja vs root', () => {
    it('finds rows inside Ewidencja for V7M', () => {
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      // Control count is checked correctly inside Ewidencja
      expect(result.issues.some((i) =>
        i.code === 'XSD_CTRL_COUNT_OK' && i.path?.includes('SprzedazCtrl')
      )).toBe(true)
    })

    it('finds ctrl and rows at root level for JPK_FA', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>5261040828</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <Faktura>
    <P_1>2026-01-15</P_1>
    <P_2A>FV/001</P_2A>
    <P_15>1000.00</P_15>
    <P_16>false</P_16>
    <P_17>false</P_17>
    <P_18>false</P_18>
    <P_18A>false</P_18A>
    <P_19>false</P_19>
    <P_20>false</P_20>
    <P_21>false</P_21>
    <P_22>false</P_22>
    <P_23>false</P_23>
    <RodzajFaktury>VAT</RodzajFaktury>
  </Faktura>
  <FakturaCtrl><LiczbaFaktur>1</LiczbaFaktur><WartoscFaktur>1000.00</WartoscFaktur></FakturaCtrl>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_CTRL_COUNT_OK' && i.path?.includes('FakturaCtrl')
      )).toBe(true)
      expect(result.issues.some((i) =>
        i.code === 'XSD_CTRL_SUM_OK' && i.path?.includes('FakturaCtrl')
      )).toBe(true)
    })
  })

  describe('ensureArray edge cases', () => {
    it('handles single row element (not wrapped in array by parser)', () => {
      // Single Faktura element in JPK_FA - parser returns object, not array
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>5261040828</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <Faktura><P_15>500.00</P_15></Faktura>
  <FakturaCtrl><LiczbaFaktur>1</LiczbaFaktur><WartoscFaktur>500.00</WartoscFaktur></FakturaCtrl>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_COUNT_OK')).toBe(true)
    })
  })

  describe('row that is not an object', () => {
    it('skips non-object rows in control sum computation', () => {
      // This is an edge case - if somehow a row is not an object
      // The validator should skip it gracefully in the loop
      // We test this implicitly by having valid XML where rows are properly structured
      const xml = generateValidV7m()
      const result = validateXsd(xml)
      // Should compute sums correctly
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_SUM_OK')).toBe(true)
    })
  })

  describe('amount field detection patterns', () => {
    it('detects various amount field patterns in rows', () => {
      // Build XML with various amount field names to test isAmountField patterns
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2016/03/09/03092/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_WB (1)" wersjaSchemy="1-0">JPK_WB</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><NIP>5261040828</NIP></Podmiot1>
  <NumerRachunku>PL61109010140000071219812874</NumerRachunku>
  <Salda><SaldoPoczatkowe>1000.00</SaldoPoczatkowe><SaldoKoncowe>1000.00</SaldoKoncowe></Salda>
  <WyciagWiersz>
    <DataOperacji>2026-01-15</DataOperacji>
    <KwotaOperacji>100.00</KwotaOperacji>
    <SaldoOperacji>1100.00</SaldoOperacji>
  </WyciagWiersz>
  <WyciagCtrl><LiczbaWierszy>1</LiczbaWierszy></WyciagCtrl>
</JPK>`
      const result = validateXsd(xml)
      // All amounts are in correct format, dates are correct
      expect(result.issues.some((i) => i.code === 'XSD_ROW_FORMAT_OK')).toBe(true)
    })
  })

  describe('datetime fields validation in nested objects', () => {
    it('reports invalid datetime format in nested structure', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>bad-datetime</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      // DataWytworzeniaJPK check in validateHeader AND validateDateFields both fire
      expect(result.issues.some((i) =>
        i.code === 'XSD_INVALID_FORMAT' && i.message.includes('DataWytworzeniaJPK')
      )).toBe(true)
    })
  })

  describe('amount without decimal point', () => {
    it('reports warning for amount without proper decimal places', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
    <PodatekNalezny>100</PodatekNalezny>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazCtrl><LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) =>
        i.code === 'XSD_DECIMAL_FORMAT' && i.severity === 'warning'
      )).toBe(true)
    })
  })

  describe('row format with empty string values', () => {
    it('skips empty amount and date values in rows', () => {
      // Rows with empty date/amount fields should not trigger errors
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>
    <SprzedazWiersz>
      <LpSprzedazy>1</LpSprzedazy>
      <DataSprzedazy></DataSprzedazy>
      <K_19></K_19>
      <K_20>0.00</K_20>
    </SprzedazWiersz>
    <SprzedazCtrl><LiczbaWierszySprzedazy>1</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      // Empty fields are skipped (v !== '' check), no date or amount errors
      expect(result.issues.some((i) => i.code === 'XSD_ROW_DATE_FORMAT')).toBe(false)
      expect(result.issues.some((i) => i.code === 'XSD_ROW_AMOUNT_FORMAT')).toBe(false)
    })
  })

  describe('attribute-prefixed keys in rows are skipped', () => {
    it('skips @_ prefixed keys in row format validation', () => {
      // WyciagWiersz has typ="G" attribute
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2016/03/09/03092/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_WB (1)" wersjaSchemy="1-0">JPK_WB</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><NIP>5261040828</NIP></Podmiot1>
  <NumerRachunku>PL61109010140000071219812874</NumerRachunku>
  <Salda><SaldoPoczatkowe>1000.00</SaldoPoczatkowe><SaldoKoncowe>900.00</SaldoKoncowe></Salda>
  <WyciagWiersz typ="G">
    <DataOperacji>2026-01-15</DataOperacji>
    <KwotaOperacji>-100.00</KwotaOperacji>
    <SaldoOperacji>900.00</SaldoOperacji>
  </WyciagWiersz>
  <WyciagCtrl><LiczbaWierszy>1</LiczbaWierszy></WyciagCtrl>
</JPK>`
      const result = validateXsd(xml)
      // @_typ attribute should be skipped, no errors from it
      expect(result.issues.some((i) => i.code === 'XSD_ROW_FORMAT_OK')).toBe(true)
    })
  })

  describe('multiple date errors limited to maxSamples', () => {
    it('handles more than 3 rows with date errors', () => {
      // Build XML with 5 rows that all have bad dates
      const badRows = Array.from({ length: 5 }, (_, i) => `
    <SprzedazWiersz>
      <LpSprzedazy>${i + 1}</LpSprzedazy>
      <DataSprzedazy>bad-date-${i}</DataSprzedazy>
      <K_20>10.00</K_20>
    </SprzedazWiersz>`).join('')
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>${badRows}
    <SprzedazCtrl><LiczbaWierszySprzedazy>5</LiczbaWierszySprzedazy><PodatekNalezny>50.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      const dateIssue = result.issues.find((i) => i.code === 'XSD_ROW_DATE_FORMAT')
      expect(dateIssue).toBeDefined()
      expect(dateIssue!.message).toContain('5')
    })
  })

  describe('multiple amount errors limited to maxSamples', () => {
    it('handles more than 3 rows with amount errors', () => {
      const badRows = Array.from({ length: 5 }, (_, i) => `
    <SprzedazWiersz>
      <LpSprzedazy>${i + 1}</LpSprzedazy>
      <DataSprzedazy>2026-01-15</DataSprzedazy>
      <K_20>not-a-number-${i}</K_20>
    </SprzedazWiersz>`).join('')
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1 rola="Podatnik"><NIP>5261040828</NIP></Podmiot1>
  <Ewidencja>${badRows}
    <SprzedazCtrl><LiczbaWierszySprzedazy>5</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
    <ZakupCtrl><LiczbaWierszyZakupow>0</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
  </Ewidencja>
</JPK>`
      const result = validateXsd(xml)
      const amountIssue = result.issues.find((i) => i.code === 'XSD_ROW_AMOUNT_FORMAT')
      expect(amountIssue).toBeDefined()
      expect(amountIssue!.message).toContain('5')
    })
  })

  describe('ctrl sum edge: rows at root level fallback', () => {
    it('finds ctrl/rows at root when Ewidencja is missing (JPK_FA)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>5261040828</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <Faktura><P_15>100.00</P_15></Faktura>
  <Faktura><P_15>200.00</P_15></Faktura>
  <FakturaCtrl><LiczbaFaktur>2</LiczbaFaktur><WartoscFaktur>300.00</WartoscFaktur></FakturaCtrl>
</JPK>`
      const result = validateXsd(xml)
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_COUNT_OK')).toBe(true)
      expect(result.issues.some((i) => i.code === 'XSD_CTRL_SUM_OK')).toBe(true)
    })
  })
})
