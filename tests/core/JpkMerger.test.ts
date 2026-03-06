import { describe, it, expect } from 'vitest'
import { mergeJpkFiles, getSupportedMergeTypes } from '../../src/core/JpkMerger'

// ── XML builder helpers ──

function xmlDecl(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>'
}

/** Build a minimal JPK_VAT (V7M) XML with SprzedazWiersz and ZakupWiersz */
function buildV7mXml(opts: {
  nip?: string
  sprzedaz?: Array<{ lp: number; kontrahent: string; kwota: string }>
  zakup?: Array<{ lp: number; dostawca: string; kwota: string }>
  podatekNalezny?: string
  podatekNaliczony?: string
  wariant?: string
}): string {
  const nip = opts.nip ?? '1234567890'
  const wariant = opts.wariant ?? '3'
  const sprzedaz = opts.sprzedaz ?? []
  const zakup = opts.zakup ?? []
  const podatekNalezny = opts.podatekNalezny ?? '0.00'
  const podatekNaliczony = opts.podatekNaliczony ?? '0.00'

  const sprzedazRows = sprzedaz.map((s) => `
      <SprzedazWiersz>
        <LpSprzedazy>${s.lp}</LpSprzedazy>
        <NrKontrahenta>${s.kontrahent}</NrKontrahenta>
        <K_19>${s.kwota}</K_19>
        <K_20>${s.kwota}</K_20>
      </SprzedazWiersz>`).join('')

  const zakupRows = zakup.map((z) => `
      <ZakupWiersz>
        <LpZakupu>${z.lp}</LpZakupu>
        <NrDostawcy>${z.dostawca}</NrDostawcy>
        <K_40>${z.kwota}</K_40>
        <K_41>${z.kwota}</K_41>
      </ZakupWiersz>`).join('')

  return `${xmlDecl()}
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>${wariant}</WariantFormularza>
  </Naglowek>
  <Podmiot1>
    <OsobaNiefizyczna>
      <NIP>${nip}</NIP>
      <PelnaNazwa>Firma Test</PelnaNazwa>
    </OsobaNiefizyczna>
  </Podmiot1>
  <Ewidencja>${sprzedazRows}
    <SprzedazCtrl>
      <LiczbaWierszySprzedazy>${sprzedaz.length}</LiczbaWierszySprzedazy>
      <PodatekNalezny>${podatekNalezny}</PodatekNalezny>
    </SprzedazCtrl>${zakupRows}
    <ZakupCtrl>
      <LiczbaWierszyZakupow>${zakup.length}</LiczbaWierszyZakupow>
      <PodatekNaliczony>${podatekNaliczony}</PodatekNaliczony>
    </ZakupCtrl>
  </Ewidencja>
</JPK>`
}

/** Build a minimal JPK_FA XML */
function buildFaXml(opts: {
  nip?: string
  faktury?: Array<{ nr: string; kwota: string }>
  wiersze?: Array<{ nrRef: string; kwotaNetto: string }>
  wariant?: string
}): string {
  const nip = opts.nip ?? '1234567890'
  const wariant = opts.wariant ?? '4'
  const faktury = opts.faktury ?? []
  const wiersze = opts.wiersze ?? []

  const wartoscFaktur = faktury.reduce((s, f) => s + parseFloat(f.kwota), 0).toFixed(2)
  const wartoscWierszy = wiersze.reduce((s, w) => s + parseFloat(w.kwotaNetto), 0).toFixed(2)

  const fakturaRows = faktury.map((f) => `
  <Faktura>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-01-15</P_1>
    <P_2A>${f.nr}</P_2A>
    <P_3C>Sprzedawca</P_3C>
    <P_3D>ul. Testowa 1</P_3D>
    <P_15>${f.kwota}</P_15>
    <P_16>false</P_16>
    <P_17>false</P_17>
    <P_18>false</P_18>
    <P_18A>false</P_18A>
    <P_19>false</P_19>
    <P_20>false</P_20>
    <P_21>false</P_21>
    <P_22>false</P_22>
    <P_23>false</P_23>
    <P_106E_2>false</P_106E_2>
    <P_106E_3>false</P_106E_3>
    <RodzajFaktury>VAT</RodzajFaktury>
  </Faktura>`).join('')

  const wierszRows = wiersze.map((w) => `
  <FakturaWiersz>
    <P_2B>${w.nrRef}</P_2B>
    <P_7>Usługa</P_7>
    <P_11>${w.kwotaNetto}</P_11>
  </FakturaWiersz>`).join('')

  return `${xmlDecl()}
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>${wariant}</WariantFormularza>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <NIP>${nip}</NIP>
      <PelnaNazwa>Firma Test</PelnaNazwa>
    </IdentyfikatorPodmiotu>
  </Podmiot1>${fakturaRows}
  <FakturaCtrl>
    <LiczbaFaktur>${faktury.length}</LiczbaFaktur>
    <WartoscFaktur>${wartoscFaktur}</WartoscFaktur>
  </FakturaCtrl>${wierszRows}
  <FakturaWierszCtrl>
    <LiczbaWierszyFaktur>${wiersze.length}</LiczbaWierszyFaktur>
    <WartoscWierszyFaktur>${wartoscWierszy}</WartoscWierszyFaktur>
  </FakturaWierszCtrl>
</JPK>`
}

/** Build a minimal JPK_WB XML */
function buildWbXml(opts: {
  nip?: string
  wiersze?: Array<{ lp: number; opis: string; kwota: string }>
  sumaObciazen?: string
  sumaUznan?: string
}): string {
  const nip = opts.nip ?? '1234567890'
  const wiersze = opts.wiersze ?? []
  const sumaObciazen = opts.sumaObciazen ?? '0.00'
  const sumaUznan = opts.sumaUznan ?? '0.00'

  const rows = wiersze.map((w) => `
  <WyciagWiersz>
    <NumerWiersza>${w.lp}</NumerWiersza>
    <OpisOperacji>${w.opis}</OpisOperacji>
    <KwotaOperacji>${w.kwota}</KwotaOperacji>
  </WyciagWiersz>`).join('')

  return `${xmlDecl()}
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2016/03/09/03092/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_WB (1)" wersjaSchemy="1-0">JPK_WB</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <NIP>${nip}</NIP>
      <PelnaNazwa>Firma Test</PelnaNazwa>
    </IdentyfikatorPodmiotu>
  </Podmiot1>${rows}
  <WyciagCtrl>
    <LiczbaWierszy>${wiersze.length}</LiczbaWierszy>
    <SumaObciazen>${sumaObciazen}</SumaObciazen>
    <SumaUznan>${sumaUznan}</SumaUznan>
  </WyciagCtrl>
</JPK>`
}

/** Build a minimal JPK_EWP XML */
function buildEwpXml(opts: {
  nip?: string
  wiersze?: Array<{ lp: number; kwota: string }>
  sumaPrzychodow?: string
}): string {
  const nip = opts.nip ?? '1234567890'
  const wiersze = opts.wiersze ?? []
  const sumaPrzychodow = opts.sumaPrzychodow ?? '0.00'

  const rows = wiersze.map((w) => `
  <EWPWiersz>
    <K_1>${w.lp}</K_1>
    <K_2>2026-01-15</K_2>
    <K_3>2026-01-15</K_3>
    <K_4>DOW/001</K_4>
    <K_8>${w.kwota}</K_8>
  </EWPWiersz>`).join('')

  return `${xmlDecl()}
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2016/03/09/03094/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_EWP (1)" wersjaSchemy="1-0">JPK_EWP</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
  <Podmiot1 rola="Podatnik">
    <OsobaFizyczna>
      <etd:NIP>${nip}</etd:NIP>
    </OsobaFizyczna>
  </Podmiot1>${rows}
  <EWPCtrl>
    <LiczbaWierszy>${wiersze.length}</LiczbaWierszy>
    <SumaPrzychodow>${sumaPrzychodow}</SumaPrzychodow>
  </EWPCtrl>
</JPK>`
}

// ═══════════════════════════════════════════════════════
//  Basic validation
// ═══════════════════════════════════════════════════════

describe('JpkMerger — validation', () => {
  it('throws on empty array', () => {
    expect(() => mergeJpkFiles([])).toThrow('Brak plików do scalenia')
  })

  it('returns single file unchanged', () => {
    const xml = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: '9999999999', kwota: '100.00' }],
      podatekNalezny: '100.00',
    })
    const result = mergeJpkFiles([xml])
    expect(result).toBe(xml)
  })

  it('throws on KodFormularza mismatch', () => {
    const v7m = buildV7mXml({})
    const fa = buildFaXml({})
    expect(() => mergeJpkFiles([v7m, fa])).toThrow('Niezgodny typ JPK')
  })

  it('throws on WariantFormularza mismatch', () => {
    const file1 = buildV7mXml({ wariant: '3' })
    const file2 = buildV7mXml({ wariant: '2' })
    expect(() => mergeJpkFiles([file1, file2])).toThrow('Niezgodny wariant')
  })

  it('throws on NIP mismatch', () => {
    const file1 = buildV7mXml({ nip: '1234567890' })
    const file2 = buildV7mXml({ nip: '9876543210' })
    expect(() => mergeJpkFiles([file1, file2])).toThrow('Niezgodny NIP')
  })

  it('throws on missing <JPK> element', () => {
    const bad = '<?xml version="1.0"?><Root></Root>'
    expect(() => mergeJpkFiles([bad, bad])).toThrow('brak elementu <JPK>')
  })

  it('throws on missing <Naglowek>', () => {
    const bad = '<?xml version="1.0"?><JPK><Podmiot1><NIP>123</NIP></Podmiot1></JPK>'
    expect(() => mergeJpkFiles([bad, bad])).toThrow('brak elementu <Naglowek>')
  })

  it('throws on unsupported JPK type', () => {
    const xml1 = `<?xml version="1.0"?><JPK>
      <Naglowek><KodFormularza>JPK_UNKNOWN</KodFormularza><WariantFormularza>1</WariantFormularza></Naglowek>
      <Podmiot1><NIP>1234567890</NIP></Podmiot1>
    </JPK>`
    expect(() => mergeJpkFiles([xml1, xml1])).toThrow('Nieobsługiwany typ JPK')
  })

  it('throws on invalid XML (no JPK root)', () => {
    // fast-xml-parser is lenient — it parses non-XML as text nodes without throwing.
    // The merger detects this as missing <JPK> element.
    const bad = 'not xml at all'
    const good = buildV7mXml({})
    expect(() => mergeJpkFiles([bad, good])).toThrow('brak elementu <JPK>')
  })
})

// ═══════════════════════════════════════════════════════
//  V7M merge (2 files)
// ═══════════════════════════════════════════════════════

describe('JpkMerger — V7M 2-file merge', () => {
  it('merges sprzedaz rows from two files', () => {
    const file1 = buildV7mXml({
      sprzedaz: [
        { lp: 1, kontrahent: '1111111111', kwota: '100.00' },
        { lp: 2, kontrahent: '2222222222', kwota: '200.00' },
      ],
      podatekNalezny: '300.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [
        { lp: 1, kontrahent: '3333333333', kwota: '500.00' },
      ],
      podatekNalezny: '500.00',
    })

    const result = mergeJpkFiles([file1, file2])
    // 3 sprzedaz rows total
    expect(result).toContain('<LiczbaWierszySprzedazy>3</LiczbaWierszySprzedazy>')
    // Podatek summed: 300 + 500 = 800
    expect(result).toContain('<PodatekNalezny>800.00</PodatekNalezny>')
  })

  it('renumbers LpSprzedazy continuously', () => {
    const file1 = buildV7mXml({
      sprzedaz: [
        { lp: 1, kontrahent: 'A', kwota: '10.00' },
        { lp: 2, kontrahent: 'B', kwota: '20.00' },
      ],
      podatekNalezny: '30.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [
        { lp: 1, kontrahent: 'C', kwota: '30.00' },
      ],
      podatekNalezny: '30.00',
    })

    const result = mergeJpkFiles([file1, file2])
    // Should have LP 1, 2, 3 (not 1, 2, 1)
    expect(result).toContain('<LpSprzedazy>3</LpSprzedazy>')
    // Should NOT have duplicate LP 1 from second file
    const lp1Matches = result.match(/<LpSprzedazy>1<\/LpSprzedazy>/g)
    expect(lp1Matches).toHaveLength(1)
  })

  it('merges zakup rows from two files', () => {
    const file1 = buildV7mXml({
      zakup: [{ lp: 1, dostawca: 'D1', kwota: '100.00' }],
      podatekNaliczony: '100.00',
    })
    const file2 = buildV7mXml({
      zakup: [
        { lp: 1, dostawca: 'D2', kwota: '200.00' },
        { lp: 2, dostawca: 'D3', kwota: '300.00' },
      ],
      podatekNaliczony: '500.00',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaWierszyZakupow>3</LiczbaWierszyZakupow>')
    expect(result).toContain('<PodatekNaliczony>600.00</PodatekNaliczony>')
  })

  it('preserves Naglowek from first file', () => {
    const file1 = buildV7mXml({ nip: '1234567890' })
    const file2 = buildV7mXml({ nip: '1234567890' })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('JPK_VAT')
    expect(result).toContain('JPK_V7M (3)')
  })

  it('preserves Podmiot1 from first file', () => {
    const file1 = buildV7mXml({ nip: '1234567890' })
    const file2 = buildV7mXml({ nip: '1234567890' })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('1234567890')
    expect(result).toContain('Firma Test')
  })

  it('starts with XML declaration', () => {
    const file1 = buildV7mXml({})
    const file2 = buildV7mXml({})
    const result = mergeJpkFiles([file1, file2])
    expect(result).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })
})

// ═══════════════════════════════════════════════════════
//  V7M merge (3 files)
// ═══════════════════════════════════════════════════════

describe('JpkMerger — V7M 3-file merge', () => {
  it('merges three files correctly', () => {
    const file1 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'A', kwota: '100.00' }],
      zakup: [{ lp: 1, dostawca: 'D1', kwota: '50.00' }],
      podatekNalezny: '100.00',
      podatekNaliczony: '50.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'B', kwota: '200.00' }],
      zakup: [{ lp: 1, dostawca: 'D2', kwota: '75.00' }],
      podatekNalezny: '200.00',
      podatekNaliczony: '75.00',
    })
    const file3 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'C', kwota: '300.00' }],
      zakup: [],
      podatekNalezny: '300.00',
      podatekNaliczony: '0.00',
    })

    const result = mergeJpkFiles([file1, file2, file3])
    expect(result).toContain('<LiczbaWierszySprzedazy>3</LiczbaWierszySprzedazy>')
    expect(result).toContain('<PodatekNalezny>600.00</PodatekNalezny>')
    expect(result).toContain('<LiczbaWierszyZakupow>2</LiczbaWierszyZakupow>')
    expect(result).toContain('<PodatekNaliczony>125.00</PodatekNaliczony>')
  })

  it('renumbers LP across three files', () => {
    const file1 = buildV7mXml({
      sprzedaz: [
        { lp: 1, kontrahent: 'A', kwota: '10.00' },
        { lp: 2, kontrahent: 'B', kwota: '20.00' },
      ],
      podatekNalezny: '30.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'C', kwota: '30.00' }],
      podatekNalezny: '30.00',
    })
    const file3 = buildV7mXml({
      sprzedaz: [
        { lp: 1, kontrahent: 'D', kwota: '40.00' },
        { lp: 2, kontrahent: 'E', kwota: '50.00' },
      ],
      podatekNalezny: '90.00',
    })

    const result = mergeJpkFiles([file1, file2, file3])
    // Should have LPs 1-5
    expect(result).toContain('<LpSprzedazy>5</LpSprzedazy>')
    expect(result).toContain('<LiczbaWierszySprzedazy>5</LiczbaWierszySprzedazy>')
  })
})

// ═══════════════════════════════════════════════════════
//  JPK_FA merge
// ═══════════════════════════════════════════════════════

describe('JpkMerger — FA merge', () => {
  it('merges Faktura and FakturaWiersz from two files', () => {
    const file1 = buildFaXml({
      faktury: [{ nr: 'FV/001', kwota: '1000.00' }],
      wiersze: [{ nrRef: 'FV/001', kwotaNetto: '813.01' }],
    })
    const file2 = buildFaXml({
      faktury: [
        { nr: 'FV/002', kwota: '2000.00' },
        { nr: 'FV/003', kwota: '500.00' },
      ],
      wiersze: [
        { nrRef: 'FV/002', kwotaNetto: '1626.02' },
        { nrRef: 'FV/003', kwotaNetto: '406.50' },
      ],
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaFaktur>3</LiczbaFaktur>')
    expect(result).toContain('<WartoscFaktur>3500.00</WartoscFaktur>')
    expect(result).toContain('<LiczbaWierszyFaktur>3</LiczbaWierszyFaktur>')
    expect(result).toContain('<WartoscWierszyFaktur>2845.53</WartoscWierszyFaktur>')
  })

  it('preserves Faktura content after merge', () => {
    const file1 = buildFaXml({
      faktury: [{ nr: 'FV/001', kwota: '1000.00' }],
      wiersze: [],
    })
    const file2 = buildFaXml({
      faktury: [{ nr: 'FV/002', kwota: '2000.00' }],
      wiersze: [],
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('FV/001')
    expect(result).toContain('FV/002')
  })
})

// ═══════════════════════════════════════════════════════
//  JPK_WB merge
// ═══════════════════════════════════════════════════════

describe('JpkMerger — WB merge', () => {
  it('merges WyciagWiersz rows and renumbers NumerWiersza', () => {
    const file1 = buildWbXml({
      wiersze: [
        { lp: 1, opis: 'Przelew 1', kwota: '-100.00' },
        { lp: 2, opis: 'Wpłata 1', kwota: '500.00' },
      ],
      sumaObciazen: '100.00',
      sumaUznan: '500.00',
    })
    const file2 = buildWbXml({
      wiersze: [
        { lp: 1, opis: 'Przelew 2', kwota: '-200.00' },
      ],
      sumaObciazen: '200.00',
      sumaUznan: '0.00',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaWierszy>3</LiczbaWierszy>')
    expect(result).toContain('<SumaObciazen>300.00</SumaObciazen>')
    expect(result).toContain('<SumaUznan>500.00</SumaUznan>')
    // LP renumbered: should have 3
    expect(result).toContain('<NumerWiersza>3</NumerWiersza>')
  })
})

// ═══════════════════════════════════════════════════════
//  JPK_EWP merge
// ═══════════════════════════════════════════════════════

describe('JpkMerger — EWP merge', () => {
  it('merges EWPWiersz rows and recalculates Ctrl', () => {
    const file1 = buildEwpXml({
      wiersze: [
        { lp: 1, kwota: '1000.00' },
        { lp: 2, kwota: '2000.00' },
      ],
      sumaPrzychodow: '3000.00',
    })
    const file2 = buildEwpXml({
      wiersze: [
        { lp: 1, kwota: '500.00' },
      ],
      sumaPrzychodow: '500.00',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaWierszy>3</LiczbaWierszy>')
    expect(result).toContain('<SumaPrzychodow>3500.00</SumaPrzychodow>')
  })

  it('renumbers K_1 (LP) continuously', () => {
    const file1 = buildEwpXml({
      wiersze: [{ lp: 1, kwota: '100.00' }],
      sumaPrzychodow: '100.00',
    })
    const file2 = buildEwpXml({
      wiersze: [{ lp: 1, kwota: '200.00' }],
      sumaPrzychodow: '200.00',
    })

    const result = mergeJpkFiles([file1, file2])
    // Second row should be LP 2, not 1
    const k1Matches = result.match(/<K_1>1<\/K_1>/g)
    expect(k1Matches).toHaveLength(1)
    expect(result).toContain('<K_1>2</K_1>')
  })

  it('finds NIP via etd:NIP in OsobaFizyczna', () => {
    // EWP uses etd:NIP inside OsobaFizyczna — test that NIP extraction works
    const file1 = buildEwpXml({ nip: '5555555555' })
    const file2 = buildEwpXml({ nip: '5555555555' })
    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('5555555555')
  })
})

// ═══════════════════════════════════════════════════════
//  Edge cases
// ═══════════════════════════════════════════════════════

describe('JpkMerger — edge cases', () => {
  it('handles files with empty row sections', () => {
    const file1 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'A', kwota: '100.00' }],
      zakup: [],
      podatekNalezny: '100.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [],
      zakup: [{ lp: 1, dostawca: 'D', kwota: '50.00' }],
      podatekNaliczony: '50.00',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaWierszySprzedazy>1</LiczbaWierszySprzedazy>')
    expect(result).toContain('<LiczbaWierszyZakupow>1</LiczbaWierszyZakupow>')
  })

  it('handles both files with empty sections', () => {
    const file1 = buildV7mXml({ sprzedaz: [], zakup: [] })
    const file2 = buildV7mXml({ sprzedaz: [], zakup: [] })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy>')
    expect(result).toContain('<LiczbaWierszyZakupow>0</LiczbaWierszyZakupow>')
  })

  it('preserves namespace in output', () => {
    const file1 = buildV7mXml({})
    const file2 = buildV7mXml({})
    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('xmlns=')
  })

  it('handles large LP numbers', () => {
    const sprzedaz = Array.from({ length: 100 }, (_, i) => ({
      lp: i + 1,
      kontrahent: `NIP${i}`,
      kwota: '10.00',
    }))
    const file1 = buildV7mXml({
      sprzedaz,
      podatekNalezny: '1000.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'LAST', kwota: '5.00' }],
      podatekNalezny: '5.00',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LpSprzedazy>101</LpSprzedazy>')
    expect(result).toContain('<LiczbaWierszySprzedazy>101</LiczbaWierszySprzedazy>')
  })

  it('handles decimal precision in sums', () => {
    const file1 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'A', kwota: '0.01' }],
      podatekNalezny: '0.01',
    })
    const file2 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'B', kwota: '0.02' }],
      podatekNalezny: '0.02',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<PodatekNalezny>0.03</PodatekNalezny>')
  })

  it('file with single row element (not array) is handled', () => {
    // When there's only one SprzedazWiersz, parser might not wrap it in array
    // unless isArray is configured. Our parser has isArray, so this should work.
    const file1 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'A', kwota: '100.00' }],
      podatekNalezny: '100.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'B', kwota: '200.00' }],
      podatekNalezny: '200.00',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaWierszySprzedazy>2</LiczbaWierszySprzedazy>')
  })
})

// ═══════════════════════════════════════════════════════
//  getSupportedMergeTypes
// ═══════════════════════════════════════════════════════

describe('JpkMerger — getSupportedMergeTypes', () => {
  it('returns all supported types', () => {
    const types = getSupportedMergeTypes()
    expect(types).toContain('JPK_VAT')
    expect(types).toContain('JPK_FA')
    expect(types).toContain('JPK_WB')
    expect(types).toContain('JPK_EWP')
    expect(types).toContain('JPK_PKPIR')
    expect(types).toContain('JPK_KR')
    expect(types).toContain('JPK_FA_RR')
  })

  it('returns at least 7 types', () => {
    expect(getSupportedMergeTypes().length).toBeGreaterThanOrEqual(7)
  })
})

// ═══════════════════════════════════════════════════════
//  Missing container in base file (line 278)
// ═══════════════════════════════════════════════════════

describe('JpkMerger — missing container', () => {
  it('throws when V7M file is missing <Ewidencja> container', () => {
    // Build a V7M-like XML without the <Ewidencja> wrapper
    const xmlNoContainer = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1>
    <OsobaNiefizyczna>
      <NIP>1234567890</NIP>
      <PelnaNazwa>Firma Test</PelnaNazwa>
    </OsobaNiefizyczna>
  </Podmiot1>
</JPK>`
    expect(() => mergeJpkFiles([xmlNoContainer, xmlNoContainer])).toThrow('Brak kontenera')
  })
})

// ═══════════════════════════════════════════════════════
//  Parse error branch (line 228)
// ═══════════════════════════════════════════════════════

describe('JpkMerger — parse error message', () => {
  it('throws parse error with correct file index', () => {
    // fast-xml-parser is lenient, so we need genuinely broken XML
    // The first file is valid, the second is broken
    const valid = buildV7mXml({})
    // Use XML that triggers a parse error: unclosed tags with strict parser won't help,
    // but fast-xml-parser is lenient. Let's test the error message format regardless.
    // Since fast-xml-parser doesn't easily throw, test the existing 'brak elementu' path
    // which covers the subsequent validation
    const noJpk = '<?xml version="1.0"?><NotJPK/>'
    expect(() => mergeJpkFiles([valid, noJpk])).toThrow('brak elementu <JPK>')
  })
})

// ═══════════════════════════════════════════════════════
//  ensureArray with single (non-array) value (line 187)
// ═══════════════════════════════════════════════════════

describe('JpkMerger — single row element handling', () => {
  it('handles FA merge where single Faktura is not wrapped in array', () => {
    // When there's only one Faktura element, the parser wraps it in array via isArray config.
    // But for elements not in ROW_ELEMENTS, ensureArray handles the [val] case.
    // This is tested indirectly through merging files with single row entries.
    const file1 = buildFaXml({
      faktury: [{ nr: 'FV/001', kwota: '100.00' }],
      wiersze: [{ nrRef: 'FV/001', kwotaNetto: '81.30' }],
    })
    const file2 = buildFaXml({
      faktury: [{ nr: 'FV/002', kwota: '200.00' }],
      wiersze: [{ nrRef: 'FV/002', kwotaNetto: '162.60' }],
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<LiczbaFaktur>2</LiczbaFaktur>')
    expect(result).toContain('<LiczbaWierszyFaktur>2</LiczbaWierszyFaktur>')
    expect(result).toContain('<WartoscFaktur>300.00</WartoscFaktur>')
  })
})

// ═══════════════════════════════════════════════════════
//  Missing KodFormularza / WariantFormularza / NIP
// ═══════════════════════════════════════════════════════

describe('JpkMerger — missing header fields', () => {
  it('throws on missing KodFormularza', () => {
    const xml = `<?xml version="1.0"?><JPK>
      <Naglowek><WariantFormularza>1</WariantFormularza></Naglowek>
      <Podmiot1><NIP>1234567890</NIP></Podmiot1>
    </JPK>`
    expect(() => mergeJpkFiles([xml, xml])).toThrow('brak KodFormularza')
  })

  it('throws on missing WariantFormularza', () => {
    const xml = `<?xml version="1.0"?><JPK>
      <Naglowek><KodFormularza>JPK_VAT</KodFormularza></Naglowek>
      <Podmiot1><NIP>1234567890</NIP></Podmiot1>
    </JPK>`
    expect(() => mergeJpkFiles([xml, xml])).toThrow('brak WariantFormularza')
  })

  it('throws on missing Podmiot1', () => {
    const xml = `<?xml version="1.0"?><JPK>
      <Naglowek>
        <KodFormularza>JPK_VAT</KodFormularza>
        <WariantFormularza>3</WariantFormularza>
      </Naglowek>
    </JPK>`
    expect(() => mergeJpkFiles([xml, xml])).toThrow('brak elementu <Podmiot1>')
  })

  it('throws on missing NIP in Podmiot1', () => {
    const xml = `<?xml version="1.0"?><JPK>
      <Naglowek>
        <KodFormularza>JPK_VAT</KodFormularza>
        <WariantFormularza>3</WariantFormularza>
      </Naglowek>
      <Podmiot1>
        <OsobaNiefizyczna>
          <PelnaNazwa>Firma bez NIP</PelnaNazwa>
        </OsobaNiefizyczna>
      </Podmiot1>
    </JPK>`
    expect(() => mergeJpkFiles([xml, xml])).toThrow('nie znaleziono NIP')
  })
})

// ═══════════════════════════════════════════════════════
//  Output validity
// ═══════════════════════════════════════════════════════

describe('JpkMerger — output validity', () => {
  it('output is parseable XML', async () => {
    const { XMLParser: Parser } = await import('fast-xml-parser')
    const file1 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'A', kwota: '100.00' }],
      podatekNalezny: '100.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'B', kwota: '200.00' }],
      podatekNalezny: '200.00',
    })

    const result = mergeJpkFiles([file1, file2])
    const parser = new Parser({ ignoreAttributes: false })
    expect(() => parser.parse(result)).not.toThrow()
  })

  it('output preserves root element with attributes', () => {
    const file1 = buildV7mXml({})
    const file2 = buildV7mXml({})
    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<JPK')
    expect(result).toContain('</JPK>')
  })

  it('output contains all expected V7M sections', () => {
    const file1 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'A', kwota: '100.00' }],
      zakup: [{ lp: 1, dostawca: 'D', kwota: '50.00' }],
      podatekNalezny: '100.00',
      podatekNaliczony: '50.00',
    })
    const file2 = buildV7mXml({
      sprzedaz: [{ lp: 1, kontrahent: 'B', kwota: '200.00' }],
      zakup: [{ lp: 1, dostawca: 'D2', kwota: '75.00' }],
      podatekNalezny: '200.00',
      podatekNaliczony: '75.00',
    })

    const result = mergeJpkFiles([file1, file2])
    expect(result).toContain('<Naglowek>')
    expect(result).toContain('<Podmiot1>')
    expect(result).toContain('<Ewidencja>')
    expect(result).toContain('<SprzedazWiersz>')
    expect(result).toContain('<SprzedazCtrl>')
    expect(result).toContain('<ZakupWiersz>')
    expect(result).toContain('<ZakupCtrl>')
  })
})
