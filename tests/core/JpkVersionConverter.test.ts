import { describe, it, expect } from 'vitest'
import { convertJpkVersion, detectUpgradeNeeded } from '../../src/core/JpkVersionConverter'

// ── Test XML builders ──

function buildFaXml(opts: {
  wariant?: string
  kodSystemowy?: string
  namespace?: string
  fakturaCount?: number
  wierszCount?: number
  wierszHasBfk?: boolean
} = {}): string {
  const wariant = opts.wariant ?? '3'
  const kodSys = opts.kodSystemowy ?? `JPK_FA (${wariant})`
  const ns = opts.namespace ?? 'http://jpk.mf.gov.pl/wzor/2019/12/15/12151/'

  const count = opts.fakturaCount ?? 1
  const faktury = Array.from({ length: count }, (_, i) =>
    `<Faktura><P_2A>FA/${i + 1}</P_2A><P_15>${(100 + i * 50).toFixed(2)}</P_15></Faktura>`
  ).join('\n')

  const wCount = opts.wierszCount ?? 2
  const wiersze = Array.from({ length: wCount }, (_, i) => {
    const bfk = opts.wierszHasBfk ? '<BFK>1</BFK>' : ''
    return `<FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar ${i + 1}</P_7>${bfk}</FakturaWiersz>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="${ns}">
  <Naglowek>
    <KodFormularza kodSystemowy="${kodSys}" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>${wariant}</WariantFormularza>
    <DataWytworzeniaJPK>2025-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2025-01-01</DataOd>
    <DataDo>2025-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <NIP>7740001454</NIP>
      <PelnaNazwa>Test Sp. z o.o.</PelnaNazwa>
    </IdentyfikatorPodmiotu>
  </Podmiot1>
  ${faktury}
  <FakturaCtrl>
    <LiczbaFaktur>${count}</LiczbaFaktur>
    <WartoscFaktur>100.00</WartoscFaktur>
  </FakturaCtrl>
  ${wiersze}
  <FakturaWierszCtrl>
    <LiczbaWierszyFaktur>${wCount}</LiczbaWierszyFaktur>
    <WartoscWierszyFaktur>200.00</WartoscWierszyFaktur>
  </FakturaWierszCtrl>
</JPK>`
}

function buildV7mXml(opts: {
  wariant?: string
  kodSystemowy?: string
  namespace?: string
  sprzedazCount?: number
  zakupCount?: number
  rowsHaveBfk?: boolean
} = {}): string {
  const wariant = opts.wariant ?? '2'
  const kodSys = opts.kodSystemowy ?? `JPK_V7M (${wariant})`
  const ns = opts.namespace ?? 'http://crd.gov.pl/wzor/2021/12/27/11148/'

  const sprzCount = opts.sprzedazCount ?? 3
  const zakCount = opts.zakupCount ?? 2
  const bfk = opts.rowsHaveBfk ? '<BFK>1</BFK>' : ''

  const sprzedaz = Array.from({ length: sprzCount }, (_, i) =>
    `<SprzedazWiersz><LpSprzedazy>${i + 1}</LpSprzedazy><K_19>100.00</K_19>${bfk}</SprzedazWiersz>`
  ).join('\n')

  const zakup = Array.from({ length: zakCount }, (_, i) =>
    `<ZakupWiersz><LpZakupu>${i + 1}</LpZakupu><K_42>50.00</K_42>${bfk}</ZakupWiersz>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="${ns}">
  <Naglowek>
    <KodFormularza kodSystemowy="${kodSys}" wersjaSchemy="1-0">JPK_VAT</KodFormularza>
    <WariantFormularza>${wariant}</WariantFormularza>
    <DataWytworzeniaJPK>2025-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
    <Rok>2025</Rok>
    <Miesiac>1</Miesiac>
  </Naglowek>
  <Podmiot1 rola="Podatnik">
    <OsobaFizyczna>
      <NIP>7740001454</NIP>
      <ImiePierwsze>Jan</ImiePierwsze>
      <Nazwisko>Kowalski</Nazwisko>
    </OsobaFizyczna>
  </Podmiot1>
  <Ewidencja>
    ${sprzedaz}
    <SprzedazCtrl>
      <LiczbaWierszySprzedazy>${sprzCount}</LiczbaWierszySprzedazy>
      <PodatekNalezny>0.00</PodatekNalezny>
    </SprzedazCtrl>
    ${zakup}
    <ZakupCtrl>
      <LiczbaWierszyZakupow>${zakCount}</LiczbaWierszyZakupow>
      <PodatekNaliczony>0.00</PodatekNaliczony>
    </ZakupCtrl>
  </Ewidencja>
</JPK>`
}

// ── Tests ──

describe('convertJpkVersion', () => {
  // ── FA(2) → FA(4) ──

  it('converts FA(2) to FA(4): updates WariantFormularza', () => {
    const xml = buildFaXml({ wariant: '2', kodSystemowy: 'JPK_FA (2)' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toContain('WariantFormularza')
    expect(result).toContain('>4<')
    expect(changes.some((c) => c.includes('WariantFormularza') && c.includes('2') && c.includes('4'))).toBe(true)
  })

  it('converts FA(2) to FA(4): updates kodSystemowy', () => {
    const xml = buildFaXml({ wariant: '2', kodSystemowy: 'JPK_FA (2)' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toContain('JPK_FA (4)')
    expect(changes.some((c) => c.includes('kodSystemowy'))).toBe(true)
  })

  it('converts FA(2) to FA(4): updates namespace', () => {
    const xml = buildFaXml({ wariant: '2', namespace: 'http://jpk.mf.gov.pl/wzor/2016/03/09/03091/' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toContain('http://jpk.mf.gov.pl/wzor/2022/02/17/02171/')
    expect(changes.some((c) => c.includes('Namespace'))).toBe(true)
  })

  it('converts FA(2) to FA(4): adds BFK to FakturaWiersz', () => {
    const xml = buildFaXml({ wariant: '2', wierszCount: 5 })
    const { result, changes } = convertJpkVersion(xml)
    // Should contain BFK elements
    const bfkMatches = result.match(/<BFK>1<\/BFK>/g) || []
    expect(bfkMatches.length).toBe(5)
    expect(changes.some((c) => c.includes('BFK') && c.includes('5') && c.includes('FakturaWiersz'))).toBe(true)
  })

  // ── FA(3) → FA(4) ──

  it('converts FA(3) to FA(4): updates WariantFormularza', () => {
    const xml = buildFaXml({ wariant: '3' })
    const { result } = convertJpkVersion(xml)
    expect(result).toContain('>4<')
  })

  it('converts FA(3) to FA(4): adds BFK to wiersze', () => {
    const xml = buildFaXml({ wariant: '3', wierszCount: 3 })
    const { result, changes } = convertJpkVersion(xml)
    const bfkMatches = result.match(/<BFK>1<\/BFK>/g) || []
    expect(bfkMatches.length).toBe(3)
    expect(changes.some((c) => c.includes('BFK') && c.includes('3'))).toBe(true)
  })

  it('converts FA(3) to FA(4): preserves existing data', () => {
    const xml = buildFaXml({ wariant: '3', fakturaCount: 2 })
    const { result } = convertJpkVersion(xml)
    expect(result).toContain('FA/1')
    expect(result).toContain('FA/2')
    expect(result).toContain('7740001454')
    expect(result).toContain('Test Sp. z o.o.')
  })

  // ── V7M(2) → V7M(3) ──

  it('converts V7M(2) to V7M(3): updates WariantFormularza', () => {
    const xml = buildV7mXml({ wariant: '2' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toContain('>3<')
    expect(changes.some((c) => c.includes('WariantFormularza') && c.includes('2') && c.includes('3'))).toBe(true)
  })

  it('converts V7M(2) to V7M(3): updates namespace', () => {
    const xml = buildV7mXml({ wariant: '2' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toContain('http://crd.gov.pl/wzor/2025/12/19/14090/')
    expect(changes.some((c) => c.includes('Namespace'))).toBe(true)
  })

  it('converts V7M(2) to V7M(3): adds BFK to SprzedazWiersz', () => {
    const xml = buildV7mXml({ wariant: '2', sprzedazCount: 4 })
    const { changes } = convertJpkVersion(xml)
    expect(changes.some((c) => c.includes('BFK') && c.includes('4') && c.includes('SprzedazWiersz'))).toBe(true)
  })

  it('converts V7M(2) to V7M(3): adds BFK to ZakupWiersz', () => {
    const xml = buildV7mXml({ wariant: '2', zakupCount: 3 })
    const { changes } = convertJpkVersion(xml)
    expect(changes.some((c) => c.includes('BFK') && c.includes('3') && c.includes('ZakupWiersz'))).toBe(true)
  })

  it('converts V7M(2) to V7M(3): adds BFK to both row types', () => {
    const xml = buildV7mXml({ wariant: '2', sprzedazCount: 2, zakupCount: 1 })
    const { result } = convertJpkVersion(xml)
    const bfkMatches = result.match(/<BFK>1<\/BFK>/g) || []
    expect(bfkMatches.length).toBe(3) // 2 sprzedaz + 1 zakup
  })

  it('converts V7M(2) to V7M(3): preserves Podmiot1 data', () => {
    const xml = buildV7mXml({ wariant: '2' })
    const { result } = convertJpkVersion(xml)
    expect(result).toContain('7740001454')
    expect(result).toContain('Jan')
    expect(result).toContain('Kowalski')
  })

  it('converts V7M(2) to V7M(3): updates kodSystemowy', () => {
    const xml = buildV7mXml({ wariant: '2', kodSystemowy: 'JPK_V7M (2)' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toContain('JPK_V7M (3)')
    expect(changes.some((c) => c.includes('kodSystemowy'))).toBe(true)
  })

  // ── Already latest version ──

  it('returns unchanged XML for FA(4)', () => {
    const xml = buildFaXml({ wariant: '4', kodSystemowy: 'JPK_FA (4)' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toBe(xml)
    expect(changes).toEqual(['Plik jest już w najnowszej wersji'])
  })

  it('returns unchanged XML for V7M(3)', () => {
    const xml = buildV7mXml({ wariant: '3', kodSystemowy: 'JPK_V7M (3)' })
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toBe(xml)
    expect(changes).toEqual(['Plik jest już w najnowszej wersji'])
  })

  // ── Unsupported conversions ──

  it('throws for unsupported JPK type', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_MAG (2)">JPK_MAG</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
  </Naglowek>
</JPK>`
    expect(() => convertJpkVersion(xml)).toThrow('Nieobsługiwana konwersja')
    expect(() => convertJpkVersion(xml)).toThrow('brak ścieżki upgrade')
  })

  it('throws for unsupported wariant', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (1)">JPK_FA</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
</JPK>`
    expect(() => convertJpkVersion(xml)).toThrow('Nieobsługiwana konwersja')
  })

  // ── Edge cases ──

  it('throws for invalid XML', () => {
    expect(() => convertJpkVersion('<<<not xml>>>')).toThrow()
  })

  it('throws for missing JPK root', () => {
    expect(() => convertJpkVersion('<?xml version="1.0"?><Root/>')).toThrow('Brak elementu <JPK>')
  })

  it('throws for missing Naglowek', () => {
    expect(() => convertJpkVersion('<?xml version="1.0"?><JPK><Foo/></JPK>')).toThrow('Brak elementu <Naglowek>')
  })

  it('does not add BFK to rows that already have it', () => {
    const xml = buildFaXml({ wariant: '3', wierszCount: 2, wierszHasBfk: true })
    const { changes } = convertJpkVersion(xml)
    // Should NOT have a BFK change since rows already have BFK
    expect(changes.some((c) => c.includes('BFK') && c.includes('FakturaWiersz'))).toBe(false)
  })

  it('changes[] contains correct row counts', () => {
    const xml = buildV7mXml({ wariant: '2', sprzedazCount: 15, zakupCount: 7 })
    const { changes } = convertJpkVersion(xml)
    expect(changes.some((c) => c.includes('15') && c.includes('SprzedazWiersz'))).toBe(true)
    expect(changes.some((c) => c.includes('7') && c.includes('ZakupWiersz'))).toBe(true)
  })

  it('output starts with XML declaration', () => {
    const xml = buildFaXml({ wariant: '3' })
    const { result } = convertJpkVersion(xml)
    expect(result.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  })
})

describe('convertJpkVersion — additional branch coverage', () => {
  it('handles KodFormularza as plain text (not object with attributes)', () => {
    // When KodFormularza is a plain string (no attributes), extractVersionInfo
    // takes the else branch at line 91-92
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2019/12/15/12151/">
  <Naglowek>
    <KodFormularza>JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar</P_7></FakturaWiersz>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>1</LiczbaWierszyFaktur><WartoscWierszyFaktur>100.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { result, changes } = convertJpkVersion(xml)
    // Should still upgrade to FA(4)
    expect(result).toContain('>4<')
    expect(changes.some((c) => c.includes('WariantFormularza'))).toBe(true)
    // BFK should be added to FakturaWiersz
    expect(result).toContain('<BFK>1</BFK>')
  })

  it('handles V7M without <Ewidencja> wrapper (rows at JPK root)', () => {
    // convertV7m takes ewidencja ?? jpk when Ewidencja is missing
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2021/12/27/11148/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (2)" wersjaSchemy="1-0">JPK_VAT</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
  </Naglowek>
  <Podmiot1><OsobaFizyczna><NIP>7740001454</NIP></OsobaFizyczna></Podmiot1>
  <SprzedazWiersz><LpSprzedazy>1</LpSprzedazy><K_19>100.00</K_19></SprzedazWiersz>
  <SprzedazCtrl><LiczbaWierszySprzedazy>1</LiczbaWierszySprzedazy><PodatekNalezny>0.00</PodatekNalezny></SprzedazCtrl>
  <ZakupWiersz><LpZakupu>1</LpZakupu><K_42>50.00</K_42></ZakupWiersz>
  <ZakupCtrl><LiczbaWierszyZakupow>1</LiczbaWierszyZakupow><PodatekNaliczony>0.00</PodatekNaliczony></ZakupCtrl>
</JPK>`
    const { result, changes } = convertJpkVersion(xml)
    expect(result).toContain('>3<')
    // BFK should be added when rows are at JPK root
    expect(changes.some((c) => c.includes('BFK') && c.includes('SprzedazWiersz'))).toBe(true)
    expect(changes.some((c) => c.includes('BFK') && c.includes('ZakupWiersz'))).toBe(true)
  })

  it('adds namespace when none exists (updateNamespace !currentNs branch)', () => {
    // XML without xmlns attribute on JPK root
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (3)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar</P_7></FakturaWiersz>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>1</LiczbaWierszyFaktur><WartoscWierszyFaktur>100.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { changes } = convertJpkVersion(xml)
    expect(changes.some((c) => c.includes('Dodano namespace'))).toBe(true)
  })

  it('does not add BFK when rows have NrKSeF marking', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2019/12/15/12151/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (3)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar</P_7><NrKSeF>KSeF-123</NrKSeF></FakturaWiersz>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>1</LiczbaWierszyFaktur><WartoscWierszyFaktur>100.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { changes } = convertJpkVersion(xml)
    // Should NOT add BFK since row already has NrKSeF
    expect(changes.some((c) => c.includes('BFK') && c.includes('FakturaWiersz'))).toBe(false)
  })

  it('does not add BFK when rows have OFF marking', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2019/12/15/12151/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (3)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar</P_7><OFF>1</OFF></FakturaWiersz>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>1</LiczbaWierszyFaktur><WartoscWierszyFaktur>100.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { changes } = convertJpkVersion(xml)
    expect(changes.some((c) => c.includes('BFK') && c.includes('FakturaWiersz'))).toBe(false)
  })

  it('does not add BFK when rows have DI marking', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2019/12/15/12151/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (3)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar</P_7><DI>1</DI></FakturaWiersz>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>1</LiczbaWierszyFaktur><WartoscWierszyFaktur>100.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { changes } = convertJpkVersion(xml)
    expect(changes.some((c) => c.includes('BFK') && c.includes('FakturaWiersz'))).toBe(false)
  })

  it('does not add BFK when rows have OznaczenieKSeF', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2019/12/15/12151/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (3)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar</P_7><OznaczenieKSeF>BFK</OznaczenieKSeF></FakturaWiersz>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>1</LiczbaWierszyFaktur><WartoscWierszyFaktur>100.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { changes } = convertJpkVersion(xml)
    expect(changes.some((c) => c.includes('BFK') && c.includes('FakturaWiersz'))).toBe(false)
  })

  it('handles FA with empty FakturaWiersz (no rows to add BFK)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2019/12/15/12151/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (3)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaCtrl><LiczbaFaktur>0</LiczbaFaktur><WartoscFaktur>0.00</WartoscFaktur></FakturaCtrl>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>0</LiczbaWierszyFaktur><WartoscWierszyFaktur>0.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { changes } = convertJpkVersion(xml)
    // No BFK changes because there are no rows
    expect(changes.some((c) => c.includes('BFK'))).toBe(false)
    // But other changes should still be made
    expect(changes.some((c) => c.includes('WariantFormularza'))).toBe(true)
  })

  it('handles missing KodFormularza', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
</JPK>`
    expect(() => convertJpkVersion(xml)).toThrow('Brak KodFormularza')
  })

  it('handles missing WariantFormularza', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (3)">JPK_FA</KodFormularza>
  </Naglowek>
</JPK>`
    expect(() => convertJpkVersion(xml)).toThrow('Brak WariantFormularza')
  })

  it('does not log kodSystemowy change when value is already the same', () => {
    // Set kodSystemowy to JPK_FA (4) but wariant to 3 so conversion still runs
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <FakturaWiersz><P_2B>FA/1</P_2B><P_7>Towar</P_7></FakturaWiersz>
  <FakturaWierszCtrl><LiczbaWierszyFaktur>1</LiczbaWierszyFaktur><WartoscWierszyFaktur>100.00</WartoscWierszyFaktur></FakturaWierszCtrl>
</JPK>`
    const { changes } = convertJpkVersion(xml)
    // kodSystemowy is already JPK_FA (4), so no kodSystemowy change should be logged
    expect(changes.filter((c) => c.includes('kodSystemowy'))).toHaveLength(0)
    // But WariantFormularza change should still be logged
    expect(changes.some((c) => c.includes('WariantFormularza'))).toBe(true)
    // Namespace is already the target — no namespace change either
    expect(changes.filter((c) => c.includes('Namespace'))).toHaveLength(0)
  })
})

describe('detectUpgradeNeeded', () => {
  it('detects FA(3) needs upgrade', () => {
    const xml = buildFaXml({ wariant: '3' })
    const info = detectUpgradeNeeded(xml)
    expect(info).not.toBeNull()
    expect(info!.currentWariant).toBe('3')
    expect(info!.targetWariant).toBe('4')
    expect(info!.kodFormularza).toBe('JPK_FA')
  })

  it('detects V7M(2) needs upgrade', () => {
    const xml = buildV7mXml({ wariant: '2' })
    const info = detectUpgradeNeeded(xml)
    expect(info).not.toBeNull()
    expect(info!.currentWariant).toBe('2')
    expect(info!.targetWariant).toBe('3')
  })

  it('returns null for FA(4) (already latest)', () => {
    const xml = buildFaXml({ wariant: '4', kodSystemowy: 'JPK_FA (4)' })
    expect(detectUpgradeNeeded(xml)).toBeNull()
  })

  it('returns null for V7M(3) (already latest)', () => {
    const xml = buildV7mXml({ wariant: '3', kodSystemowy: 'JPK_V7M (3)' })
    expect(detectUpgradeNeeded(xml)).toBeNull()
  })

  it('returns null for non-XML', () => {
    expect(detectUpgradeNeeded('not xml')).toBeNull()
  })

  it('returns null for unsupported type', () => {
    const xml = `<?xml version="1.0"?><JPK><Naglowek>
      <KodFormularza>JPK_WB</KodFormularza>
      <WariantFormularza>1</WariantFormularza>
    </Naglowek></JPK>`
    expect(detectUpgradeNeeded(xml)).toBeNull()
  })

  it('uses fallback label when kodSystemowy is empty (line 305)', () => {
    // KodFormularza without attributes (plain text) → kodSystemowy will be empty
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza>JPK_FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
</JPK>`
    const info = detectUpgradeNeeded(xml)
    expect(info).not.toBeNull()
    // Fallback label should be "JPK_FA(3)" since kodSystemowy is empty
    expect(info!.label).toBe('JPK_FA(3)')
    expect(info!.currentWariant).toBe('3')
    expect(info!.targetWariant).toBe('4')
  })

  it('returns null for unsupported wariant in upgrade paths', () => {
    // FA(1) has no upgrade path
    const xml = `<?xml version="1.0"?><JPK><Naglowek>
      <KodFormularza kodSystemowy="JPK_FA (1)">JPK_FA</KodFormularza>
      <WariantFormularza>1</WariantFormularza>
    </Naglowek></JPK>`
    expect(detectUpgradeNeeded(xml)).toBeNull()
  })

  it('returns null when extractVersionInfo throws (catch block line 312-314)', () => {
    // Missing Naglowek will cause extractVersionInfo to throw
    const xml = `<?xml version="1.0"?><JPK><Data>test</Data></JPK>`
    // extractVersionInfo throws 'Brak elementu <Naglowek>', but detectUpgradeNeeded catches it
    expect(detectUpgradeNeeded(xml)).toBeNull()
  })

  it('returns null when missing JPK root element', () => {
    const xml = `<?xml version="1.0"?><Root><Child>text</Child></Root>`
    expect(detectUpgradeNeeded(xml)).toBeNull()
  })

  it('detects FA(2) needs upgrade', () => {
    const xml = buildFaXml({ wariant: '2', kodSystemowy: 'JPK_FA (2)' })
    const info = detectUpgradeNeeded(xml)
    expect(info).not.toBeNull()
    expect(info!.currentWariant).toBe('2')
    expect(info!.targetWariant).toBe('4')
    expect(info!.label).toBe('JPK_FA (2)')
  })
})
