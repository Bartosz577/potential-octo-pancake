import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateJpkStKr,
  ST_KR_NAMESPACE,
  ETD_NAMESPACE,
  VALID_NABYCIA,
  VALID_WYKRESLENIE_KR,
  VALID_METODA_AMORTYZACJI,
  VALID_ODPIS,
  isValidNabycia,
  isValidWykreslenieKr,
  isValidMetodaAmortyzacji,
  isValidOdpis,
  type StKrGeneratorInput,
  type StKrNaglowek,
  type StKrPodmiot,
  type StKrAdres,
  type StKrWiersz,
} from '../../../src/core/generators/JpkStKrGenerator'
import { generatorRegistry } from '../../../src/core/generators/XmlGeneratorEngine'

// ── Test data factories ──

function makeNaglowek(overrides: Partial<StKrNaglowek> = {}): StKrNaglowek {
  return {
    celZlozenia: 1,
    rokDataOd: '2025-01-01',
    rokDataDo: '2025-12-31',
    kodUrzedu: '1471',
    ...overrides,
  }
}

function makeAdres(overrides: Partial<StKrAdres> = {}): StKrAdres {
  return {
    kodKraju: 'PL',
    wojewodztwo: 'mazowieckie',
    miejscowosc: 'Warszawa',
    nrDomu: '10',
    kodPocztowy: '00-001',
    ...overrides,
  }
}

function makePodmiot(overrides: Partial<StKrPodmiot> = {}): StKrPodmiot {
  return {
    nip: '1234563218',
    pelnaNazwa: 'Firma XYZ Sp. z o.o.',
    adres: makeAdres(),
    ...overrides,
  }
}

function makeWiersz(overrides: Partial<StKrWiersz> = {}): StKrWiersz {
  return {
    E_1: 'INW/001',
    E_2: '2024-03-15',
    E_4: '2024-04-01',
    E_5: 'OT/2024/001',
    E_6: 'S',
    E_7: 'Serwer Dell PowerEdge',
    E_9_1: 'L',
    E_10A: 14,
    E_10B: 7000,
    E_12: 50000,
    E_17: 'M',
    E_19: 7000,
    E_20: 14000,
    E_21: 50000,
    E_25A: 14,
    E_25B: 7000,
    E_26: 7000,
    E_27: 14000,
    E_32: 2,
    ...overrides,
  }
}

function makeInput(overrides: Partial<StKrGeneratorInput> = {}): StKrGeneratorInput {
  return {
    naglowek: makeNaglowek(),
    podmiot: makePodmiot(),
    wiersze: [makeWiersz()],
    ...overrides,
  }
}

// ── Tests ──

describe('JpkStKrGenerator', () => {
  describe('XML structure', () => {
    it('generates valid XML with declaration and root element', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${ST_KR_NAMESPACE}"`)
      expect(xml).toContain(`xmlns:etd="${ETD_NAMESPACE}"`)
      expect(xml).toContain('</JPK>')
    })

    it('outputs sections in order: Naglowek, Podmiot1, ST_KR rows', () => {
      const xml = generateJpkStKr(makeInput())
      const nagIdx = xml.indexOf('<Naglowek>')
      const podIdx = xml.indexOf('<Podmiot1>')
      const dataIdx = xml.indexOf('<ST_KR>')
      expect(nagIdx).toBeLessThan(podIdx)
      expect(podIdx).toBeLessThan(dataIdx)
    })

    it('has no control section (per XSD)', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).not.toContain('<Ctrl>')
      expect(xml).not.toContain('<STCtrl>')
    })
  })

  describe('Naglowek', () => {
    it('uses KodFormularza JPK_ST (not JPK_ST_KR) per XSD', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).toContain('>JPK_ST</KodFormularza>')
    })

    it('includes correct kodSystemowy and wersjaSchemy', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_ST_KR (1)"')
      expect(xml).toContain('wersjaSchemy="1-0"')
    })

    it('uses fiscal year dates (RokDataOd/RokDataDo) not period dates', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).toContain('<RokDataOd>2025-01-01</RokDataOd>')
      expect(xml).toContain('<RokDataDo>2025-12-31</RokDataDo>')
      expect(xml).not.toContain('<DataOd>')
      expect(xml).not.toContain('<DataDo>')
    })

    it('includes optional tax year dates when provided', () => {
      const xml = generateJpkStKr(makeInput({
        naglowek: makeNaglowek({ rokPdDataOd: '2025-04-01', rokPdDataDo: '2026-03-31' })
      }))
      expect(xml).toContain('<RokPdDataOd>2025-04-01</RokPdDataOd>')
      expect(xml).toContain('<RokPdDataDo>2026-03-31</RokPdDataDo>')
    })

    it('omits tax year dates when not provided', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).not.toContain('<RokPdDataOd>')
      expect(xml).not.toContain('<RokPdDataDo>')
    })

    it('includes DomyslnyKodWaluty defaulting to PLN', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).toContain('<DomyslnyKodWaluty>PLN</DomyslnyKodWaluty>')
    })

    it('uses custom DomyslnyKodWaluty when provided', () => {
      const xml = generateJpkStKr(makeInput({
        naglowek: makeNaglowek({ domyslnyKodWaluty: 'EUR' })
      }))
      expect(xml).toContain('<DomyslnyKodWaluty>EUR</DomyslnyKodWaluty>')
    })

    it('supports only CelZlozenia 1 and 2 (no 0)', () => {
      for (const cel of [1, 2]) {
        const xml = generateJpkStKr(makeInput({ naglowek: makeNaglowek({ celZlozenia: cel }) }))
        expect(xml).toContain(`<CelZlozenia>${cel}</CelZlozenia>`)
      }
    })
  })

  describe('Podmiot1', () => {
    it('uses IdentyfikatorPodmiotu with etd: namespace (no OsobaFizyczna)', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).toContain('<IdentyfikatorPodmiotu>')
      expect(xml).toContain('<etd:NIP>1234563218</etd:NIP>')
      expect(xml).toContain('<etd:PelnaNazwa>Firma XYZ Sp. z o.o.</etd:PelnaNazwa>')
      expect(xml).not.toContain('<OsobaFizyczna>')
      expect(xml).not.toContain('<OsobaNiefizyczna>')
    })

    it('includes optional REGON', () => {
      const xml = generateJpkStKr(makeInput({
        podmiot: makePodmiot({ regon: '123456789' })
      }))
      expect(xml).toContain('<etd:REGON>123456789</etd:REGON>')
    })

    it('does not have ZnacznikST or rola attribute', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).not.toContain('ZnacznikST')
      expect(xml).not.toContain('rola=')
    })
  })

  describe('Podmiot1 — AdresPol', () => {
    it('generates Polish address with etd: prefixed fields', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).toContain('<AdresPol>')
      expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
      expect(xml).toContain('<etd:Wojewodztwo>mazowieckie</etd:Wojewodztwo>')
      expect(xml).toContain('<etd:Miejscowosc>Warszawa</etd:Miejscowosc>')
      expect(xml).toContain('<etd:NrDomu>10</etd:NrDomu>')
      expect(xml).toContain('<etd:KodPocztowy>00-001</etd:KodPocztowy>')
    })

    it('provides defaults for required address fields', () => {
      const xml = generateJpkStKr(makeInput({
        podmiot: makePodmiot({ adres: {} })
      }))
      expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
      expect(xml).toContain('<etd:NrDomu>-</etd:NrDomu>')
      expect(xml).toContain('<etd:Miejscowosc>-</etd:Miejscowosc>')
      expect(xml).toContain('<etd:KodPocztowy>00-000</etd:KodPocztowy>')
    })
  })

  describe('Podmiot1 — AdresZagr', () => {
    it('generates foreign address when adresTyp is zagraniczny', () => {
      const xml = generateJpkStKr(makeInput({
        podmiot: makePodmiot({
          adresTyp: 'zagraniczny',
          adres: { kodKraju: 'DE', ulica: 'Berliner Str.', nrDomu: '5', miejscowosc: 'Berlin', kodPocztowy: '10115' }
        })
      }))
      expect(xml).toContain('<AdresZagr>')
      expect(xml).toContain('<etd:KodKraju>DE</etd:KodKraju>')
      expect(xml).toContain('<etd:Ulica>Berliner Str.</etd:Ulica>')
      expect(xml).not.toContain('<AdresPol>')
    })
  })

  describe('ST_KR rows (E_ fields)', () => {
    let xml: string

    beforeEach(() => {
      xml = generateJpkStKr(makeInput())
    })

    it('wraps each row in <ST_KR> element (not nested Wiersz)', () => {
      expect(xml).toContain('<ST_KR>')
      expect(xml).toContain('</ST_KR>')
      expect(xml).not.toContain('<Wiersz>')
    })

    it('outputs inventory number E_1 as string', () => {
      expect(xml).toContain('<E_1>INW/001</E_1>')
    })

    it('outputs E_2 for fixed asset date (choice)', () => {
      expect(xml).toContain('<E_2>2024-03-15</E_2>')
      expect(xml).not.toContain('<E_3>')
    })

    it('outputs E_3 for intangible date (choice)', () => {
      const result = generateJpkStKr(makeInput({
        wiersze: [makeWiersz({ E_2: undefined, E_3: '2024-02-20' })]
      }))
      expect(result).toContain('<E_3>2024-02-20</E_3>')
      expect(result).not.toContain('<E_2>')
    })

    it('outputs required fields E_4, E_5, E_6, E_7', () => {
      expect(xml).toContain('<E_4>2024-04-01</E_4>')
      expect(xml).toContain('<E_5>OT/2024/001</E_5>')
      expect(xml).toContain('<E_6>S</E_6>')
      expect(xml).toContain('<E_7>Serwer Dell PowerEdge</E_7>')
    })

    it('outputs depreciation methods E_9_1 (required) and optional E_9_2, E_9_3', () => {
      expect(xml).toContain('<E_9_1>L</E_9_1>')
      expect(xml).not.toContain('<E_9_2>')

      const result = generateJpkStKr(makeInput({
        wiersze: [makeWiersz({ E_9_2: 'D', E_9_3: 'J' })]
      }))
      expect(result).toContain('<E_9_2>D</E_9_2>')
      expect(result).toContain('<E_9_3>J</E_9_3>')
    })

    it('outputs paired tax rates E_10A and E_10B', () => {
      expect(xml).toContain('<E_10A>14</E_10A>')
      expect(xml).toContain('<E_10B>7000.00</E_10B>')
    })

    it('outputs tax value and depreciation fields E_12, E_19, E_20', () => {
      expect(xml).toContain('<E_12>50000.00</E_12>')
      expect(xml).toContain('<E_19>7000.00</E_19>')
      expect(xml).toContain('<E_20>14000.00</E_20>')
    })

    it('outputs write-off frequency E_17', () => {
      expect(xml).toContain('<E_17>M</E_17>')
    })

    it('outputs accounting fields E_21, E_25A, E_25B, E_26, E_27', () => {
      expect(xml).toContain('<E_21>50000.00</E_21>')
      expect(xml).toContain('<E_25A>14</E_25A>')
      expect(xml).toContain('<E_25B>7000.00</E_25B>')
      expect(xml).toContain('<E_26>7000.00</E_26>')
      expect(xml).toContain('<E_27>14000.00</E_27>')
    })

    it('outputs reclassification E_32', () => {
      expect(xml).toContain('<E_32>2</E_32>')
    })
  })

  describe('ST_KR — optional fields', () => {
    it('includes optional fields when provided', () => {
      const result = generateJpkStKr(makeInput({
        wiersze: [makeWiersz({
          E_8: '491',
          E_11: 10,
          E_13: 55000,
          E_14: 1500,
          E_15: 5000,
          E_16: 7000,
          E_18: 500,
          E_22: 55000,
          E_23: 1500,
          E_24: 5000,
        })]
      }))
      expect(result).toContain('<E_8>491</E_8>')
      expect(result).toContain('<E_11>10</E_11>')
      expect(result).toContain('<E_13>55000.00</E_13>')
      expect(result).toContain('<E_14>1500.00</E_14>')
      expect(result).toContain('<E_15>5000.00</E_15>')
      expect(result).toContain('<E_16>7000.00</E_16>')
      expect(result).toContain('<E_18>500.00</E_18>')
      expect(result).toContain('<E_22>55000.00</E_22>')
      expect(result).toContain('<E_23>1500.00</E_23>')
      expect(result).toContain('<E_24>5000.00</E_24>')
    })

    it('omits optional fields when not provided', () => {
      const xml = generateJpkStKr(makeInput())
      expect(xml).not.toContain('<E_8>')
      expect(xml).not.toContain('<E_11>')
      expect(xml).not.toContain('<E_13>')
      expect(xml).not.toContain('<E_14>')
      expect(xml).not.toContain('<E_15>')
      expect(xml).not.toContain('<E_16>')
      expect(xml).not.toContain('<E_18>')
    })
  })

  describe('ST_KR — deregistration group', () => {
    it('includes deregistration fields when all three provided', () => {
      const result = generateJpkStKr(makeInput({
        wiersze: [makeWiersz({ E_28: '2025-09-30', E_29: 'A', E_30: 'PRZEKLASYF/001' })]
      }))
      expect(result).toContain('<E_28>2025-09-30</E_28>')
      expect(result).toContain('<E_29>A</E_29>')
      expect(result).toContain('<E_30>PRZEKLASYF/001</E_30>')
    })

    it('omits deregistration fields when incomplete', () => {
      const result = generateJpkStKr(makeInput({
        wiersze: [makeWiersz({ E_28: '2025-09-30' })]
      }))
      expect(result).not.toContain('<E_28>')
      expect(result).not.toContain('<E_29>')
    })
  })

  describe('ST_KR — KSeF numbers', () => {
    it('includes multiple KSeF numbers', () => {
      const result = generateJpkStKr(makeInput({
        wiersze: [makeWiersz({ KSeF: ['KSEF/2025/A1', 'KSEF/2025/A2'] })]
      }))
      expect(result).toContain('<KSeF>KSEF/2025/A1</KSeF>')
      expect(result).toContain('<KSeF>KSEF/2025/A2</KSeF>')
    })
  })

  describe('multiple rows', () => {
    it('generates multiple ST_KR elements', () => {
      const input = makeInput({
        wiersze: [
          makeWiersz({ E_1: 'INW/001', E_7: 'Serwer' }),
          makeWiersz({ E_1: 'INW/002', E_7: 'Klimatyzacja' }),
          makeWiersz({ E_1: 'INW/003', E_7: 'Oprogramowanie', E_2: undefined, E_3: '2024-06-01' }),
        ],
      })
      const xml = generateJpkStKr(input)
      const matches = xml.match(/<ST_KR>/g)
      expect(matches).toHaveLength(3)
      expect(xml).toContain('<E_7>Serwer</E_7>')
      expect(xml).toContain('<E_7>Klimatyzacja</E_7>')
      expect(xml).toContain('<E_7>Oprogramowanie</E_7>')
    })
  })

  describe('XML escaping', () => {
    it('escapes special characters in text fields', () => {
      const result = generateJpkStKr(makeInput({
        wiersze: [makeWiersz({ E_7: 'System ERP "SAP" <S/4HANA> & BW' })]
      }))
      expect(result).toContain('System ERP &quot;SAP&quot; &lt;S/4HANA&gt; &amp; BW')
    })

    it('escapes company name in Podmiot1', () => {
      const result = generateJpkStKr(makeInput({
        podmiot: makePodmiot({ pelnaNazwa: 'A & B "Partners" <Ltd>' })
      }))
      expect(result).toContain('A &amp; B &quot;Partners&quot; &lt;Ltd&gt;')
    })
  })

  describe('enum validation helpers', () => {
    it('validates TNabycia enum values', () => {
      expect(VALID_NABYCIA).toEqual(['S', 'D', 'N', 'W', 'F', 'I'])
      for (const v of VALID_NABYCIA) {
        expect(isValidNabycia(v)).toBe(true)
      }
      expect(isValidNabycia('Z')).toBe(false)
    })

    it('validates TWykreslenieKr enum values (7 values, includes A)', () => {
      expect(VALID_WYKRESLENIE_KR).toHaveLength(7)
      expect(isValidWykreslenieKr('A')).toBe(true) // Unique to ST_KR
      expect(isValidWykreslenieKr('S')).toBe(true)
      expect(isValidWykreslenieKr('Z')).toBe(false)
    })

    it('validates TMetodaAmortyzacji enum values', () => {
      expect(VALID_METODA_AMORTYZACJI).toEqual(['D', 'L', 'J', 'I', 'X'])
      for (const v of VALID_METODA_AMORTYZACJI) {
        expect(isValidMetodaAmortyzacji(v)).toBe(true)
      }
    })

    it('validates TOdpis enum values (unique to ST_KR)', () => {
      expect(VALID_ODPIS).toEqual(['M', 'K', 'R', 'J', 'S', 'I', 'X'])
      for (const v of VALID_ODPIS) {
        expect(isValidOdpis(v)).toBe(true)
      }
      expect(isValidOdpis('Z')).toBe(false)
    })
  })

  describe('generator registry', () => {
    it('is registered as JPK_ST_KR', () => {
      const gen = generatorRegistry.get('JPK_ST_KR')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_ST_KR')
      expect(gen!.namespace).toBe(ST_KR_NAMESPACE)
      expect(gen!.version).toBe('1')
    })

    it('generates XML through registry', () => {
      const gen = generatorRegistry.get('JPK_ST_KR')!
      const xml = gen.generate(makeInput())
      expect(xml).toContain('<JPK')
      expect(xml).toContain('</JPK>')
    })
  })

  describe('full integration', () => {
    it('generates complete JPK_ST_KR with all features', () => {
      const input: StKrGeneratorInput = {
        naglowek: makeNaglowek({
          celZlozenia: 2,
          rokDataOd: '2025-01-01',
          rokDataDo: '2025-12-31',
          rokPdDataOd: '2025-04-01',
          rokPdDataDo: '2026-03-31',
          domyslnyKodWaluty: 'EUR',
        }),
        podmiot: makePodmiot({ regon: '987654321' }),
        wiersze: [
          makeWiersz({
            E_1: 'ST/2025/001',
            E_7: 'Hala produkcyjna',
            E_9_1: 'L',
            E_9_2: 'D',
            E_10A: 2.5,
            E_10B: 25000,
            E_12: 1000000,
            E_17: 'R',
            E_19: 25000,
            E_20: 75000,
            E_21: 1200000,
            E_25A: 2,
            E_25B: 24000,
            E_26: 24000,
            E_27: 72000,
            E_28: '2025-12-15',
            E_29: 'S',
            E_30: 'SPRZEDAZ/2025/001',
            KSeF: ['KSEF/2025/HALA'],
            E_32: 1,
          }),
        ],
      }
      const xml = generateJpkStKr(input)

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain('kodSystemowy="JPK_ST_KR (1)"')
      expect(xml).toContain('<CelZlozenia>2</CelZlozenia>')
      expect(xml).toContain('<RokPdDataOd>2025-04-01</RokPdDataOd>')
      expect(xml).toContain('<DomyslnyKodWaluty>EUR</DomyslnyKodWaluty>')
      expect(xml).toContain('<etd:REGON>987654321</etd:REGON>')
      expect(xml).toContain('<E_7>Hala produkcyjna</E_7>')
      expect(xml).toContain('<E_9_2>D</E_9_2>')
      expect(xml).toContain('<E_17>R</E_17>')
      expect(xml).toContain('<E_29>S</E_29>')
      expect(xml).toContain('<KSeF>KSEF/2025/HALA</KSeF>')
      expect(xml).toContain('<E_32>1</E_32>')
      expect(xml).toContain('</JPK>')
    })
  })
})
