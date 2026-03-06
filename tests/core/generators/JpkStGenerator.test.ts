import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateJpkSt,
  ST_NAMESPACE,
  ETD_NAMESPACE,
  VALID_NABYCIA,
  VALID_WYKRESLENIE,
  VALID_METODA_AMORTYZACJI,
  VALID_ZNACZNIK_ST,
  isValidNabycia,
  isValidWykreslenie,
  isValidMetodaAmortyzacji,
  type StGeneratorInput,
  type StNaglowek,
  type StPodmiot,
  type StEwpWiersz,
  type StPkpirWiersz,
} from '../../../src/core/generators/JpkStGenerator'
import { generatorRegistry } from '../../../src/core/generators/XmlGeneratorEngine'

// ── Test data factories ──

function makeNaglowek(overrides: Partial<StNaglowek> = {}): StNaglowek {
  return {
    celZlozenia: 1,
    dataOd: '2025-01-01',
    dataDo: '2025-12-31',
    kodUrzedu: '1471',
    ...overrides,
  }
}

function makePodmiotFizyczna(overrides: Partial<StPodmiot> = {}): StPodmiot {
  return {
    typ: 'fizyczna',
    nip: '1234563218',
    imie: 'Jan',
    nazwisko: 'Kowalski',
    dataUrodzenia: '1985-03-15',
    znacznikSt: '1',
    ...overrides,
  }
}

function makePodmiotNiefizyczna(overrides: Partial<StPodmiot> = {}): StPodmiot {
  return {
    typ: 'niefizyczna',
    nip: '1234563218',
    pelnaNazwa: 'Firma ABC Sp. z o.o.',
    znacznikSt: '2',
    ...overrides,
  }
}

function makeEwpWiersz(overrides: Partial<StEwpWiersz> = {}): StEwpWiersz {
  return {
    F_1: 1,
    F_2: '2024-06-15',
    F_4: '2024-07-01',
    F_6: 'S',
    F_7: 'Laptop Dell Latitude',
    F_9: 20,
    F_10: 5000,
    F_16: 2,
    ...overrides,
  }
}

function makePkpirWiersz(overrides: Partial<StPkpirWiersz> = {}): StPkpirWiersz {
  return {
    G_1: 1,
    G_2: '2024-03-10',
    G_4: '2024-04-01',
    G_6: 'S',
    G_7: 'Samochód dostawczy',
    G_9: 'L',
    G_10: 20,
    G_12: 80000,
    G_14: 16000,
    G_15: 32000,
    G_22: 2,
    ...overrides,
  }
}

function makeInput(overrides: Partial<StGeneratorInput> = {}): StGeneratorInput {
  return {
    naglowek: makeNaglowek(),
    podmiot: makePodmiotNiefizyczna(),
    pkpirWiersze: [makePkpirWiersz()],
    ...overrides,
  }
}

// ── Tests ──

describe('JpkStGenerator', () => {
  describe('XML structure', () => {
    it('generates valid XML with declaration and root element', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${ST_NAMESPACE}"`)
      expect(xml).toContain(`xmlns:etd="${ETD_NAMESPACE}"`)
      expect(xml).toContain('</JPK>')
    })

    it('outputs sections in order: Naglowek, Podmiot1, data section', () => {
      const xml = generateJpkSt(makeInput())
      const nagIdx = xml.indexOf('<Naglowek>')
      const podIdx = xml.indexOf('<Podmiot1')
      const dataIdx = xml.indexOf('<PKPIR>')
      expect(nagIdx).toBeLessThan(podIdx)
      expect(podIdx).toBeLessThan(dataIdx)
    })

    it('has no control section (per XSD)', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).not.toContain('<Ctrl>')
      expect(xml).not.toContain('<STCtrl>')
    })
  })

  describe('Naglowek', () => {
    it('includes KodFormularza with correct attributes', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_ST (1)"')
      expect(xml).toContain('wersjaSchemy="1-2"')
      expect(xml).toContain('>JPK_ST</KodFormularza>')
    })

    it('includes WariantFormularza = 1', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toContain('<WariantFormularza>1</WariantFormularza>')
    })

    it('supports CelZlozenia 0, 1, and 2', () => {
      for (const cel of [0, 1, 2]) {
        const xml = generateJpkSt(makeInput({ naglowek: makeNaglowek({ celZlozenia: cel }) }))
        expect(xml).toContain(`<CelZlozenia>${cel}</CelZlozenia>`)
      }
    })

    it('includes DataOd, DataDo, KodUrzedu', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toContain('<DataOd>2025-01-01</DataOd>')
      expect(xml).toContain('<DataDo>2025-12-31</DataDo>')
      expect(xml).toContain('<KodUrzedu>1471</KodUrzedu>')
    })

    it('includes DataWytworzeniaJPK in ISO format', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/DataWytworzeniaJPK>/)
    })
  })

  describe('Podmiot1 — OsobaFizyczna', () => {
    it('generates OsobaFizyczna with etd: prefixed fields', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna(),
        ewpWiersze: [makeEwpWiersz()],
        pkpirWiersze: undefined,
      })
      const xml = generateJpkSt(input)
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<etd:NIP>1234563218</etd:NIP>')
      expect(xml).toContain('<etd:ImiePierwsze>Jan</etd:ImiePierwsze>')
      expect(xml).toContain('<etd:Nazwisko>Kowalski</etd:Nazwisko>')
      expect(xml).toContain('<etd:DataUrodzenia>1985-03-15</etd:DataUrodzenia>')
    })

    it('includes optional Email and Telefon', () => {
      const podmiot = makePodmiotFizyczna({ email: 'jan@example.com', telefon: '+48123456789' })
      const input = makeInput({ podmiot, ewpWiersze: [makeEwpWiersz()], pkpirWiersze: undefined })
      const xml = generateJpkSt(input)
      expect(xml).toContain('<Email>jan@example.com</Email>')
      expect(xml).toContain('<Telefon>+48123456789</Telefon>')
    })
  })

  describe('Podmiot1 — OsobaNiefizyczna', () => {
    it('generates OsobaNiefizyczna with NIP and PelnaNazwa', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toContain('<OsobaNiefizyczna>')
      expect(xml).toContain('<NIP>1234563218</NIP>')
      expect(xml).toContain('<PelnaNazwa>Firma ABC Sp. z o.o.</PelnaNazwa>')
    })
  })

  describe('Podmiot1 — ZnacznikST', () => {
    it('outputs ZnacznikST after person data', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toContain('<ZnacznikST>2</ZnacznikST>')
    })

    it('outputs ZnacznikST = 1 for EWP', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [makeEwpWiersz()],
        pkpirWiersze: undefined,
      })
      const xml = generateJpkSt(input)
      expect(xml).toContain('<ZnacznikST>1</ZnacznikST>')
    })

    it('includes rola="Podatnik" attribute', () => {
      const xml = generateJpkSt(makeInput())
      expect(xml).toContain('<Podmiot1 rola="Podatnik">')
    })
  })

  describe('EWP section (F_ fields)', () => {
    let xml: string

    beforeEach(() => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [makeEwpWiersz()],
        pkpirWiersze: undefined,
      })
      xml = generateJpkSt(input)
    })

    it('wraps rows in <EWP><Wiersz>', () => {
      expect(xml).toContain('<EWP>')
      expect(xml).toContain('<Wiersz>')
      expect(xml).toContain('</Wiersz>')
      expect(xml).toContain('</EWP>')
    })

    it('outputs required fields F_1, F_4, F_6, F_7, F_9, F_10, F_16', () => {
      expect(xml).toContain('<F_1>1</F_1>')
      expect(xml).toContain('<F_4>2024-07-01</F_4>')
      expect(xml).toContain('<F_6>S</F_6>')
      expect(xml).toContain('<F_7>Laptop Dell Latitude</F_7>')
      expect(xml).toContain('<F_9>20</F_9>')
      expect(xml).toContain('<F_10>5000.00</F_10>')
      expect(xml).toContain('<F_16>2</F_16>')
    })

    it('outputs F_2 for fixed asset date (choice)', () => {
      expect(xml).toContain('<F_2>2024-06-15</F_2>')
      expect(xml).not.toContain('<F_3>')
    })

    it('outputs F_3 for intangible date (choice)', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [makeEwpWiersz({ F_2: undefined, F_3: '2024-05-20' })],
        pkpirWiersze: undefined,
      })
      const result = generateJpkSt(input)
      expect(result).toContain('<F_3>2024-05-20</F_3>')
      expect(result).not.toContain('<F_2>')
    })

    it('includes optional fields when provided', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [makeEwpWiersz({ F_5: 'DOC/001', F_8: '491', F_11: 4500 })],
        pkpirWiersze: undefined,
      })
      const result = generateJpkSt(input)
      expect(result).toContain('<F_5>DOC/001</F_5>')
      expect(result).toContain('<F_8>491</F_8>')
      expect(result).toContain('<F_11>4500.00</F_11>')
    })

    it('omits optional fields when not provided', () => {
      expect(xml).not.toContain('<F_5>')
      expect(xml).not.toContain('<F_8>')
      expect(xml).not.toContain('<F_11>')
    })
  })

  describe('EWP — deregistration group', () => {
    it('includes deregistration fields when all three provided', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [makeEwpWiersz({ F_12: '2025-06-30', F_13: 'S', F_14: 'SPRZEDAZ/001' })],
        pkpirWiersze: undefined,
      })
      const xml = generateJpkSt(input)
      expect(xml).toContain('<F_12>2025-06-30</F_12>')
      expect(xml).toContain('<F_13>S</F_13>')
      expect(xml).toContain('<F_14>SPRZEDAZ/001</F_14>')
    })

    it('omits deregistration fields when incomplete', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [makeEwpWiersz({ F_12: '2025-06-30', F_13: undefined, F_14: undefined })],
        pkpirWiersze: undefined,
      })
      const xml = generateJpkSt(input)
      expect(xml).not.toContain('<F_12>')
      expect(xml).not.toContain('<F_13>')
    })
  })

  describe('EWP — KSeF numbers', () => {
    it('includes multiple KSeF numbers', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [makeEwpWiersz({ KSeF: ['1/2025/01/01/00001', '1/2025/01/01/00002'] })],
        pkpirWiersze: undefined,
      })
      const xml = generateJpkSt(input)
      expect(xml).toContain('<KSeF>1/2025/01/01/00001</KSeF>')
      expect(xml).toContain('<KSeF>1/2025/01/01/00002</KSeF>')
    })
  })

  describe('PKPIR section (G_ fields)', () => {
    let xml: string

    beforeEach(() => {
      xml = generateJpkSt(makeInput())
    })

    it('wraps rows in <PKPIR><Wiersz>', () => {
      expect(xml).toContain('<PKPIR>')
      expect(xml).toContain('<Wiersz>')
      expect(xml).not.toContain('<EWP>')
    })

    it('outputs required fields G_1, G_4, G_6, G_7, G_9, G_10, G_12, G_14, G_15, G_22', () => {
      expect(xml).toContain('<G_1>1</G_1>')
      expect(xml).toContain('<G_4>2024-04-01</G_4>')
      expect(xml).toContain('<G_6>S</G_6>')
      expect(xml).toContain('<G_7>Samochód dostawczy</G_7>')
      expect(xml).toContain('<G_9>L</G_9>')
      expect(xml).toContain('<G_10>20</G_10>')
      expect(xml).toContain('<G_12>80000.00</G_12>')
      expect(xml).toContain('<G_14>16000.00</G_14>')
      expect(xml).toContain('<G_15>32000.00</G_15>')
      expect(xml).toContain('<G_22>2</G_22>')
    })

    it('outputs G_2 for fixed asset date (choice)', () => {
      expect(xml).toContain('<G_2>2024-03-10</G_2>')
      expect(xml).not.toContain('<G_3>')
    })

    it('outputs G_3 for intangible date (choice)', () => {
      const result = generateJpkSt(makeInput({
        pkpirWiersze: [makePkpirWiersz({ G_2: undefined, G_3: '2024-02-28' })]
      }))
      expect(result).toContain('<G_3>2024-02-28</G_3>')
      expect(result).not.toContain('<G_2>')
    })

    it('includes optional fields when provided', () => {
      const result = generateJpkSt(makeInput({
        pkpirWiersze: [makePkpirWiersz({
          G_5: 'OT/001',
          G_8: '743',
          G_11: 15,
          G_13: 85000,
          G_16: 1000,
          G_17: 5000,
        })]
      }))
      expect(result).toContain('<G_5>OT/001</G_5>')
      expect(result).toContain('<G_8>743</G_8>')
      expect(result).toContain('<G_11>15</G_11>')
      expect(result).toContain('<G_13>85000.00</G_13>')
      expect(result).toContain('<G_16>1000.00</G_16>')
      expect(result).toContain('<G_17>5000.00</G_17>')
    })
  })

  describe('PKPIR — deregistration and KSeF', () => {
    it('includes deregistration group G_18, G_19, G_20', () => {
      const result = generateJpkSt(makeInput({
        pkpirWiersze: [makePkpirWiersz({ G_18: '2025-11-30', G_19: 'K', G_20: 'KRADZ/001' })]
      }))
      expect(result).toContain('<G_18>2025-11-30</G_18>')
      expect(result).toContain('<G_19>K</G_19>')
      expect(result).toContain('<G_20>KRADZ/001</G_20>')
    })

    it('includes KSeF numbers for PKPIR rows', () => {
      const result = generateJpkSt(makeInput({
        pkpirWiersze: [makePkpirWiersz({ KSeF: ['KSEF/2025/001'] })]
      }))
      expect(result).toContain('<KSeF>KSEF/2025/001</KSeF>')
    })
  })

  describe('multiple rows', () => {
    it('generates multiple EWP rows', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [
          makeEwpWiersz({ F_1: 1, F_7: 'Laptop' }),
          makeEwpWiersz({ F_1: 2, F_7: 'Drukarka' }),
          makeEwpWiersz({ F_1: 3, F_7: 'Monitor' }),
        ],
        pkpirWiersze: undefined,
      })
      const xml = generateJpkSt(input)
      expect(xml).toContain('<F_7>Laptop</F_7>')
      expect(xml).toContain('<F_7>Drukarka</F_7>')
      expect(xml).toContain('<F_7>Monitor</F_7>')
      const matches = xml.match(/<Wiersz>/g)
      expect(matches).toHaveLength(3)
    })

    it('generates multiple PKPIR rows', () => {
      const input = makeInput({
        pkpirWiersze: [
          makePkpirWiersz({ G_1: 1, G_7: 'Auto' }),
          makePkpirWiersz({ G_1: 2, G_7: 'Maszyna' }),
        ],
      })
      const xml = generateJpkSt(input)
      const matches = xml.match(/<Wiersz>/g)
      expect(matches).toHaveLength(2)
    })
  })

  describe('empty data sections', () => {
    it('generates empty EWP section when no rows', () => {
      const input = makeInput({
        podmiot: makePodmiotFizyczna({ znacznikSt: '1' }),
        ewpWiersze: [],
        pkpirWiersze: undefined,
      })
      const xml = generateJpkSt(input)
      expect(xml).toContain('<EWP>')
      expect(xml).toContain('</EWP>')
      expect(xml).not.toContain('<Wiersz>')
    })
  })

  describe('XML escaping', () => {
    it('escapes special characters in text fields', () => {
      const result = generateJpkSt(makeInput({
        pkpirWiersze: [makePkpirWiersz({ G_7: 'Maszyna "CNC" <XL> & Co' })]
      }))
      expect(result).toContain('Maszyna &quot;CNC&quot; &lt;XL&gt; &amp; Co')
    })
  })

  describe('enum validation helpers', () => {
    it('validates TNabycia enum values', () => {
      for (const v of VALID_NABYCIA) {
        expect(isValidNabycia(v)).toBe(true)
      }
      expect(isValidNabycia('Z')).toBe(false)
      expect(isValidNabycia('')).toBe(false)
    })

    it('validates TWykreslenie enum values (6 values for ST)', () => {
      expect(VALID_WYKRESLENIE).toHaveLength(6)
      for (const v of VALID_WYKRESLENIE) {
        expect(isValidWykreslenie(v)).toBe(true)
      }
      expect(isValidWykreslenie('A')).toBe(false) // A is only in ST_KR
    })

    it('validates TMetodaAmortyzacji enum values', () => {
      for (const v of VALID_METODA_AMORTYZACJI) {
        expect(isValidMetodaAmortyzacji(v)).toBe(true)
      }
      expect(isValidMetodaAmortyzacji('Z')).toBe(false)
    })

    it('validates TZnacznikST enum values', () => {
      expect(VALID_ZNACZNIK_ST).toEqual(['1', '2'])
    })
  })

  describe('generator registry', () => {
    it('is registered as JPK_ST', () => {
      const gen = generatorRegistry.get('JPK_ST')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_ST')
      expect(gen!.namespace).toBe(ST_NAMESPACE)
      expect(gen!.version).toBe('1')
    })

    it('generates XML through registry', () => {
      const gen = generatorRegistry.get('JPK_ST')!
      const xml = gen.generate(makeInput())
      expect(xml).toContain('<JPK')
      expect(xml).toContain('</JPK>')
    })
  })

  describe('full integration', () => {
    it('generates complete JPK_ST with EWP variant', () => {
      const input: StGeneratorInput = {
        naglowek: makeNaglowek({ celZlozenia: 0, dataOd: '2025-01-01', dataDo: '2025-12-31' }),
        podmiot: makePodmiotFizyczna({ znacznikSt: '1', email: 'jan@test.pl' }),
        ewpWiersze: [
          makeEwpWiersz({ F_1: 1, F_7: 'Komputer', F_10: 3000, F_5: 'FV/001', F_8: '491' }),
          makeEwpWiersz({ F_1: 2, F_7: 'Biurko', F_10: 1500, F_2: undefined, F_3: '2024-08-01' }),
        ],
      }
      const xml = generateJpkSt(input)

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain('<CelZlozenia>0</CelZlozenia>')
      expect(xml).toContain('<ZnacznikST>1</ZnacznikST>')
      expect(xml).toContain('<EWP>')
      expect(xml).toContain('<F_7>Komputer</F_7>')
      expect(xml).toContain('<F_7>Biurko</F_7>')
      expect(xml).toContain('</JPK>')
    })

    it('generates complete JPK_ST with PKPIR variant', () => {
      const input: StGeneratorInput = {
        naglowek: makeNaglowek({ celZlozenia: 2 }),
        podmiot: makePodmiotNiefizyczna({ znacznikSt: '2' }),
        pkpirWiersze: [
          makePkpirWiersz({ G_1: 1, G_12: 100000 }),
          makePkpirWiersz({ G_1: 2, G_12: 50000, G_18: '2025-10-15', G_19: 'S', G_20: 'SPRZEDAZ/002' }),
        ],
      }
      const xml = generateJpkSt(input)

      expect(xml).toContain('<CelZlozenia>2</CelZlozenia>')
      expect(xml).toContain('<ZnacznikST>2</ZnacznikST>')
      expect(xml).toContain('<PKPIR>')
      expect(xml).toContain('<G_12>100000.00</G_12>')
      expect(xml).toContain('<G_19>S</G_19>')
      expect(xml).not.toContain('<EWP>')
    })
  })
})
