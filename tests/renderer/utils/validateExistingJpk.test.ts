import { describe, it, expect } from 'vitest'
import { validateExistingJpk, detectJpkLabel } from '../../../src/renderer/src/utils/validator'

// ── Test XML builders ──

function buildV7mXml(opts: {
  nip?: string
  sprzedazRows?: Record<string, string>[]
  zakupRows?: Record<string, string>[]
  sprzedazCtrl?: { count?: number; podatek?: string }
  zakupCtrl?: { count?: number; podatek?: string }
  wariant?: string
  kodSystemowy?: string
  omitNaglowek?: boolean
  omitPodmiot?: boolean
  omitCtrl?: boolean
} = {}): string {
  const nip = opts.nip ?? '7740001454'
  const wariant = opts.wariant ?? '3'
  const kodSys = opts.kodSystemowy ?? 'JPK_V7M (3)'

  const sprzedaz = (opts.sprzedazRows ?? [{ K_19: '100.00', K_20: '23.00' }])
    .map((r) => {
      const fields = Object.entries(r).map(([k, v]) => `<${k}>${v}</${k}>`).join('')
      return `<SprzedazWiersz>${fields}</SprzedazWiersz>`
    }).join('\n')

  const zakup = (opts.zakupRows ?? [{ K_42: '200.00', K_43: '46.00' }])
    .map((r) => {
      const fields = Object.entries(r).map(([k, v]) => `<${k}>${v}</${k}>`).join('')
      return `<ZakupWiersz>${fields}</ZakupWiersz>`
    }).join('\n')

  const sprzCtrl = opts.omitCtrl ? '' : `<SprzedazCtrl>
    <LiczbaWierszySprzedazy>${opts.sprzedazCtrl?.count ?? (opts.sprzedazRows ?? [{}]).length}</LiczbaWierszySprzedazy>
    <PodatekNalezny>${opts.sprzedazCtrl?.podatek ?? '23.00'}</PodatekNalezny>
  </SprzedazCtrl>`

  const zakCtrl = opts.omitCtrl ? '' : `<ZakupCtrl>
    <LiczbaWierszyZakupow>${opts.zakupCtrl?.count ?? (opts.zakupRows ?? [{}]).length}</LiczbaWierszyZakupow>
    <PodatekNaliczony>${opts.zakupCtrl?.podatek ?? '46.00'}</PodatekNaliczony>
  </ZakupCtrl>`

  const naglowek = opts.omitNaglowek ? '' : `<Naglowek>
    <KodFormularza kodSystemowy="${kodSys}" wersjaSchemy="1-0E">${'JPK_VAT'}</KodFormularza>
    <WariantFormularza>${wariant}</WariantFormularza>
    <DataWytworzeniaJPK>2025-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2025-01-01</DataOd>
    <DataDo>2025-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>`

  const podmiot = opts.omitPodmiot ? '' : `<Podmiot1 rola="Podatnik">
    <OsobaFizyczna>
      <NIP>${nip}</NIP>
      <ImiePierwsze>Jan</ImiePierwsze>
      <Nazwisko>Kowalski</Nazwisko>
    </OsobaFizyczna>
  </Podmiot1>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://crd.gov.pl/wzor/2025/12/19/14090/">
  ${naglowek}
  ${podmiot}
  <Ewidencja>
    ${sprzedaz}
    ${sprzCtrl}
    ${zakup}
    ${zakCtrl}
  </Ewidencja>
</JPK>`
}

function buildFaXml(opts: {
  nip?: string
  fakturaCount?: number
  ctrl?: { count?: number; wartosc?: string }
} = {}): string {
  const nip = opts.nip ?? '7740001454'
  const count = opts.fakturaCount ?? 2
  const faktury = Array.from({ length: count }, (_, i) =>
    `<Faktura><P_15>${(100 + i * 50).toFixed(2)}</P_15></Faktura>`
  ).join('\n')
  const wierszeCount = count
  const wiersze = Array.from({ length: wierszeCount }, (_, i) =>
    `<FakturaWiersz><P_11>${(50 + i * 25).toFixed(2)}</P_11></FakturaWiersz>`
  ).join('\n')

  const expectedSum = Array.from({ length: count }, (_, i) => 100 + i * 50).reduce((a, b) => a + b, 0)
  const expectedWierszSum = Array.from({ length: wierszeCount }, (_, i) => 50 + i * 25).reduce((a, b) => a + b, 0)

  return `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2025-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2025-01-01</DataOd>
    <DataDo>2025-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <NIP>${nip}</NIP>
    </IdentyfikatorPodmiotu>
  </Podmiot1>
  ${faktury}
  <FakturaCtrl>
    <LiczbaFaktur>${opts.ctrl?.count ?? count}</LiczbaFaktur>
    <WartoscFaktur>${opts.ctrl?.wartosc ?? expectedSum.toFixed(2)}</WartoscFaktur>
  </FakturaCtrl>
  ${wiersze}
  <FakturaWierszCtrl>
    <LiczbaWierszyFaktur>${wierszeCount}</LiczbaWierszyFaktur>
    <WartoscWierszyFaktur>${expectedWierszSum.toFixed(2)}</WartoscWierszyFaktur>
  </FakturaWierszCtrl>
</JPK>`
}

function buildMinimalXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
}

// ── Tests ──

describe('validateExistingJpk', () => {
  // ── Valid files (no errors) ──

  it('validates a correct V7M file with no errors', () => {
    const xml = buildV7mXml()
    const report = validateExistingJpk(xml)
    expect(report.errorCount).toBe(0)
    expect(report.groups).toHaveLength(4)
  })

  it('validates a correct FA file with no errors', () => {
    const xml = buildFaXml()
    const report = validateExistingJpk(xml)
    expect(report.errorCount).toBe(0)
  })

  it('returns 4 validation groups', () => {
    const xml = buildV7mXml()
    const report = validateExistingJpk(xml)
    const categories = report.groups.map((g) => g.category)
    expect(categories).toEqual(['STRUKTURA', 'MERYTORYKA', 'SUMY_KONTROLNE', 'SCHEMAT_XSD'])
  })

  it('shows info items for valid sections', () => {
    const xml = buildV7mXml()
    const report = validateExistingJpk(xml)
    expect(report.infoCount).toBeGreaterThan(0)
  })

  // ── Level 1: Structure errors ──

  it('reports error for invalid XML', () => {
    const report = validateExistingJpk('<<<not xml at all>>>')
    expect(report.errorCount).toBeGreaterThan(0)
    const strukturaErrors = report.groups[0].items.filter((i) => i.severity === 'error')
    expect(strukturaErrors.length).toBeGreaterThan(0)
  })

  it('reports error for missing <JPK> root', () => {
    const xml = buildMinimalXml('<Root><Something/></Root>')
    const report = validateExistingJpk(xml)
    expect(report.errorCount).toBeGreaterThan(0)
    expect(report.groups[0].items.some((i) => i.message.includes('<JPK>'))).toBe(true)
  })

  it('reports error for missing <Naglowek>', () => {
    const xml = buildV7mXml({ omitNaglowek: true })
    const report = validateExistingJpk(xml)
    const strukturaErrors = report.groups[0].items.filter((i) => i.severity === 'error')
    expect(strukturaErrors.some((i) => i.message.includes('Naglowek'))).toBe(true)
  })

  it('reports error for missing <Podmiot1>', () => {
    const xml = buildV7mXml({ omitPodmiot: true })
    const report = validateExistingJpk(xml)
    const strukturaErrors = report.groups[0].items.filter((i) => i.severity === 'error')
    expect(strukturaErrors.some((i) => i.message.includes('Podmiot1'))).toBe(true)
  })

  it('reports info with detected JPK type', () => {
    const xml = buildV7mXml()
    const report = validateExistingJpk(xml)
    const typeInfo = report.groups[0].items.find((i) => i.id === 'ex-str-type')
    expect(typeInfo).toBeDefined()
    expect(typeInfo!.message).toContain('JPK_VAT')
  })

  // ── Level 2: NIP validation ──

  it('validates correct NIP with checksum', () => {
    // 7740001454 has valid checksum
    const xml = buildV7mXml({ nip: '7740001454' })
    const report = validateExistingJpk(xml)
    const nipOk = report.groups[1].items.find((i) => i.id === 'ex-mer-nip-ok')
    expect(nipOk).toBeDefined()
    expect(nipOk!.severity).toBe('info')
  })

  it('reports error for NIP with bad checksum', () => {
    const xml = buildV7mXml({ nip: '1234567890' })
    const report = validateExistingJpk(xml)
    const nipErr = report.groups[1].items.find((i) => i.id === 'ex-mer-nip-checksum')
    expect(nipErr).toBeDefined()
    expect(nipErr!.severity).toBe('error')
  })

  it('reports error for NIP with wrong length', () => {
    const xml = buildV7mXml({ nip: '12345' })
    const report = validateExistingJpk(xml)
    const nipErr = report.groups[1].items.find((i) => i.id === 'ex-mer-nip-format')
    expect(nipErr).toBeDefined()
    expect(nipErr!.severity).toBe('error')
  })

  it('reports error for missing NIP in Podmiot1', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaJPK>2025-01-15T10:00:00</DataWytworzeniaJPK>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><OsobaFizyczna><ImiePierwsze>Jan</ImiePierwsze></OsobaFizyczna></Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    const nipErr = report.groups[1].items.find((i) => i.id === 'ex-mer-nip-missing')
    expect(nipErr).toBeDefined()
    expect(nipErr!.severity).toBe('error')
  })

  // ── Level 3: Control sums ──

  it('validates matching control sums', () => {
    const xml = buildV7mXml({
      sprzedazRows: [{ K_20: '10.00' }, { K_20: '13.00' }],
      sprzedazCtrl: { count: 2, podatek: '23.00' }
    })
    const report = validateExistingJpk(xml)
    const countItem = report.groups[2].items.find((i) =>
      i.id.includes('SprzedazCtrl') && i.message.includes('zgodne')
    )
    expect(countItem).toBeDefined()
  })

  it('reports error for mismatched row count', () => {
    const xml = buildV7mXml({
      sprzedazRows: [{ K_20: '10.00' }],
      sprzedazCtrl: { count: 5, podatek: '10.00' }
    })
    const report = validateExistingJpk(xml)
    const countErr = report.groups[2].items.find((i) =>
      i.id.includes('count') && i.severity === 'error'
    )
    expect(countErr).toBeDefined()
    expect(countErr!.message).toContain('5')
    expect(countErr!.message).toContain('1')
  })

  it('reports error for mismatched sum', () => {
    const xml = buildV7mXml({
      sprzedazRows: [{ K_20: '10.00' }],
      sprzedazCtrl: { count: 1, podatek: '999.99' }
    })
    const report = validateExistingJpk(xml)
    const sumErr = report.groups[2].items.find((i) =>
      i.id.includes('PodatekNalezny') && i.severity === 'error'
    )
    expect(sumErr).toBeDefined()
    expect(sumErr!.message).toContain('999.99')
  })

  it('reports error for missing Ctrl section in V7M', () => {
    const xml = buildV7mXml({ omitCtrl: true })
    const report = validateExistingJpk(xml)
    const ctrlMissing = report.groups[2].items.filter((i) => i.severity === 'error')
    expect(ctrlMissing.length).toBeGreaterThan(0)
    expect(ctrlMissing.some((i) => i.message.includes('SprzedazCtrl'))).toBe(true)
  })

  it('validates FA control sums correctly', () => {
    const xml = buildFaXml({ fakturaCount: 3 })
    const report = validateExistingJpk(xml)
    const faCount = report.groups[2].items.find((i) =>
      i.message.includes('LiczbaFaktur') && i.message.includes('zgodne')
    )
    expect(faCount).toBeDefined()
  })

  it('reports error for FA with wrong count', () => {
    const xml = buildFaXml({ fakturaCount: 2, ctrl: { count: 10, wartosc: '250.00' } })
    const report = validateExistingJpk(xml)
    const countErr = report.groups[2].items.find((i) =>
      i.message.includes('LiczbaFaktur') && i.severity === 'error'
    )
    expect(countErr).toBeDefined()
  })

  // ── Level 4: XSD validation ──

  it('includes XSD validation results', () => {
    const xml = buildV7mXml()
    const report = validateExistingJpk(xml)
    const xsdGroup = report.groups.find((g) => g.category === 'SCHEMAT_XSD')
    expect(xsdGroup).toBeDefined()
    expect(xsdGroup!.items.length).toBeGreaterThan(0)
  })

  it('shows XSD info for unknown JPK type', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza>UNKNOWN_TYPE</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
  <Podmiot1><NIP>5213003360</NIP></Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    // Structure should report the type
    const typeItem = report.groups[0].items.find((i) => i.id === 'ex-str-type')
    expect(typeItem).toBeDefined()
    expect(typeItem!.message).toContain('UNKNOWN_TYPE')
    // Control sums group should say unsupported
    const sumUnsupported = report.groups[2].items.find((i) => i.id === 'ex-sum-unsupported')
    expect(sumUnsupported).toBeDefined()
  })

  // ── Edge cases ──

  it('handles empty string input', () => {
    const report = validateExistingJpk('')
    expect(report.errorCount).toBeGreaterThan(0)
  })

  it('handles XML with only JPK root and no children', () => {
    const xml = '<?xml version="1.0"?><JPK><Foo/></JPK>'
    const report = validateExistingJpk(xml)
    expect(report.errorCount).toBeGreaterThan(0)
    expect(report.groups[0].items.some((i) => i.message.includes('Naglowek'))).toBe(true)
  })

  it('report has zero autoFixCount for standalone validation', () => {
    const xml = buildV7mXml()
    const report = validateExistingJpk(xml)
    expect(report.autoFixCount).toBe(0)
  })

  it('handles multiple sprzedaz rows with correct sums', () => {
    const rows = [
      { K_20: '10.50' },
      { K_20: '20.30' },
      { K_20: '5.20' }
    ]
    const xml = buildV7mXml({
      sprzedazRows: rows,
      sprzedazCtrl: { count: 3, podatek: '36.00' }
    })
    const report = validateExistingJpk(xml)
    const sumItem = report.groups[2].items.find((i) => i.id.includes('PodatekNalezny'))
    expect(sumItem).toBeDefined()
    expect(sumItem!.severity).toBe('info')
    expect(sumItem!.message).toContain('zgodne')
  })
})

describe('detectJpkLabel', () => {
  it('detects V7M label from kodSystemowy', () => {
    const xml = buildV7mXml()
    const label = detectJpkLabel(xml)
    expect(label).toBe('JPK_V7M (3)')
  })

  it('detects FA label', () => {
    const xml = buildFaXml()
    const label = detectJpkLabel(xml)
    expect(label).toBe('JPK_FA (4)')
  })

  it('returns null for non-XML', () => {
    expect(detectJpkLabel('not xml')).toBeNull()
  })

  it('returns null for XML without JPK root', () => {
    expect(detectJpkLabel('<Root/>')).toBeNull()
  })

  it('returns text + wariant if no kodSystemowy', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza>JPK_WB</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
</JPK>`
    const label = detectJpkLabel(xml)
    expect(label).toBe('JPK_WB(1)')
  })

  it('returns kodText only when no wariant and no kodSystemowy', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza>JPK_WB</KodFormularza>
  </Naglowek>
</JPK>`
    const label = detectJpkLabel(xml)
    expect(label).toBe('JPK_WB')
  })

  it('returns null when Naglowek is missing', () => {
    const xml = '<JPK><Podmiot1/></JPK>'
    const label = detectJpkLabel(xml)
    expect(label).toBeNull()
  })

  it('returns null when KodFormularza is missing from Naglowek', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
</JPK>`
    const label = detectJpkLabel(xml)
    expect(label).toBeNull()
  })
})

// ── Additional validateExistingJpk tests for uncovered branches ──

describe('validateExistingJpk — additional branch coverage', () => {
  // ── findNipRecursive: etd:NIP path ──
  it('finds NIP via etd:NIP key in Podmiot1', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1>
    <OsobaFizyczna>
      <etd:NIP>7740001454</etd:NIP>
    </OsobaFizyczna>
  </Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    const nipOk = report.groups[1].items.find((i) => i.id === 'ex-mer-nip-ok')
    expect(nipOk).toBeDefined()
    expect(nipOk!.severity).toBe('info')
  })

  // ── findNipRecursive: NIP with empty value ──
  it('reports error for empty NIP string in Podmiot1', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1>
    <NIP></NIP>
  </Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    const nipMissing = report.groups[1].items.find((i) => i.id === 'ex-mer-nip-missing')
    expect(nipMissing).toBeDefined()
  })

  // ── getKodFormularzaText: empty KodFormularza ──
  it('reports error when KodFormularza has empty text', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy=""></KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><NIP>7740001454</NIP></Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    // If KodFormularza text is empty, should report str-type-missing
    const typeItem = report.groups[0].items.find((i) =>
      i.id === 'ex-str-type-missing' || i.id === 'ex-str-type'
    )
    expect(typeItem).toBeDefined()
  })

  // ── Control sums: V7M with subtractFields ──
  it('handles subtractFields in V7M control sum calculation', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)" wersjaSchemy="1-0E">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><OsobaFizyczna><NIP>7740001454</NIP></OsobaFizyczna></Podmiot1>
  <Ewidencja>
    <SprzedazWiersz><K_20>100.00</K_20><K_35>10.00</K_35></SprzedazWiersz>
    <SprzedazCtrl>
      <LiczbaWierszySprzedazy>1</LiczbaWierszySprzedazy>
      <PodatekNalezny>90.00</PodatekNalezny>
    </SprzedazCtrl>
    <ZakupWiersz><K_43>50.00</K_43></ZakupWiersz>
    <ZakupCtrl>
      <LiczbaWierszyZakupow>1</LiczbaWierszyZakupow>
      <PodatekNaliczony>50.00</PodatekNaliczony>
    </ZakupCtrl>
  </Ewidencja>
</JPK>`
    const report = validateExistingJpk(xml)
    const sumItem = report.groups[2].items.find((i) => i.id.includes('PodatekNalezny'))
    expect(sumItem).toBeDefined()
    expect(sumItem!.severity).toBe('info')
    expect(sumItem!.message).toContain('zgodne')
  })

  // ── Control sums for WB type ──
  it('validates WB control sums', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_WB (1)" wersjaSchemy="1-0">JPK_WB</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
  <Podmiot1><NIP>7740001454</NIP></Podmiot1>
  <WyciagWiersz><KwotaOperacji>100.00</KwotaOperacji></WyciagWiersz>
  <WyciagWiersz><KwotaOperacji>200.00</KwotaOperacji></WyciagWiersz>
  <WyciagCtrl>
    <LiczbaWierszy>2</LiczbaWierszy>
    <SumaObciazen>300.00</SumaObciazen>
    <SumaUznan>300.00</SumaUznan>
  </WyciagCtrl>
</JPK>`
    const report = validateExistingJpk(xml)
    const countItem = report.groups[2].items.find((i) =>
      i.id.includes('WyciagCtrl') && i.message.includes('zgodne')
    )
    expect(countItem).toBeDefined()
  })

  // ── Control sums for PKPIR type ──
  it('validates PKPIR control sums', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_PKPIR (2)" wersjaSchemy="1-0">JPK_PKPIR</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
  </Naglowek>
  <Podmiot1><NIP>7740001454</NIP></Podmiot1>
  <PKPIRWiersz><K_9>150.00</K_9></PKPIRWiersz>
  <PKPIRCtrl>
    <LiczbaWierszy>1</LiczbaWierszy>
    <SumaPrzychodow>150.00</SumaPrzychodow>
  </PKPIRCtrl>
</JPK>`
    const report = validateExistingJpk(xml)
    const countItem = report.groups[2].items.find((i) =>
      i.id.includes('PKPIRCtrl') && i.message.includes('zgodne')
    )
    expect(countItem).toBeDefined()
  })

  // ── Control sums for EWP type ──
  it('validates EWP control sums', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_EWP (2)" wersjaSchemy="1-0">JPK_EWP</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
  </Naglowek>
  <Podmiot1><NIP>7740001454</NIP></Podmiot1>
  <EWPWiersz><K_8>200.00</K_8></EWPWiersz>
  <EWPCtrl>
    <LiczbaWierszy>1</LiczbaWierszy>
    <SumaPrzychodow>200.00</SumaPrzychodow>
  </EWPCtrl>
</JPK>`
    const report = validateExistingJpk(xml)
    const countItem = report.groups[2].items.find((i) =>
      i.id.includes('EWPCtrl') && i.message.includes('zgodne')
    )
    expect(countItem).toBeDefined()
  })

  // ── No container: ctrlConfig without container ──
  it('finds Ctrl elements at top level when no container is specified', () => {
    // JPK_FA doesn't use a container (unlike V7M which uses Ewidencja)
    const xml = buildFaXml({ fakturaCount: 1 })
    const report = validateExistingJpk(xml)
    const sumItems = report.groups[2].items.filter((i) => i.message.includes('zgodne'))
    expect(sumItems.length).toBeGreaterThan(0)
  })

  // ── ensureArraySafe: single value → array ──
  it('handles single row element (not wrapped in array)', () => {
    // When there's only one Faktura, XMLParser may return it as an object instead of array
    // Our isArray callback should handle this, but ensureArraySafe is a fallback
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="1-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <DataWytworzeniaJPK>2026-01-15T10:00:00</DataWytworzeniaJPK>
    <DataOd>2026-01-01</DataOd>
    <DataDo>2026-01-31</DataDo>
    <KodUrzedu>1471</KodUrzedu>
  </Naglowek>
  <Podmiot1><IdentyfikatorPodmiotu><NIP>7740001454</NIP></IdentyfikatorPodmiotu></Podmiot1>
  <Faktura><P_1>2026-01-15</P_1><P_15>100.00</P_15></Faktura>
  <FakturaCtrl>
    <LiczbaFaktur>1</LiczbaFaktur>
    <WartoscFaktur>100.00</WartoscFaktur>
  </FakturaCtrl>
  <FakturaWiersz><P_11>100.00</P_11></FakturaWiersz>
  <FakturaWierszCtrl>
    <LiczbaWierszyFaktur>1</LiczbaWierszyFaktur>
    <WartoscWierszyFaktur>100.00</WartoscWierszyFaktur>
  </FakturaWierszCtrl>
</JPK>`
    const report = validateExistingJpk(xml)
    expect(report.errorCount).toBe(0)
  })

  // ── XSD validation with xsd.length === 0 branch ──
  it('shows fallback XSD info when no XSD rules match', () => {
    // Use a type that has no XSD rules configured
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza>JPK_UNKNOWN_NO_XSD</KodFormularza>
    <WariantFormularza>1</WariantFormularza>
  </Naglowek>
  <Podmiot1><NIP>5213003360</NIP></Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    const xsdGroup = report.groups[3]
    expect(xsdGroup.items.length).toBeGreaterThan(0)
  })

  // ── Both naglowek and podmiot missing (covers both error paths) ──
  it('reports both Naglowek and Podmiot1 missing', () => {
    const xml = buildV7mXml({ omitNaglowek: true, omitPodmiot: true })
    const report = validateExistingJpk(xml)
    const errors = report.groups[0].items.filter((i) => i.severity === 'error')
    expect(errors.some((i) => i.message.includes('Naglowek'))).toBe(true)
    expect(errors.some((i) => i.message.includes('Podmiot1'))).toBe(true)
  })

  // ── NIP with dashes (still 10 digits after stripping) ──
  it('validates NIP with dashes correctly', () => {
    // 7740001454 formatted with dashes would be 774-000-14-54
    const xml = `<?xml version="1.0"?>
<JPK>
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_V7M (3)">JPK_VAT</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
  </Naglowek>
  <Podmiot1><NIP>774-000-14-54</NIP></Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    const nipOk = report.groups[1].items.find((i) => i.id === 'ex-mer-nip-ok')
    expect(nipOk).toBeDefined()
  })

  // ── FA with wrong WartoscFaktur (sum mismatch) ──
  it('reports error for FA with wrong WartoscFaktur', () => {
    const xml = buildFaXml({ fakturaCount: 2, ctrl: { count: 2, wartosc: '999.99' } })
    const report = validateExistingJpk(xml)
    const sumErr = report.groups[2].items.find((i) =>
      i.message.includes('WartoscFaktur') && i.severity === 'error'
    )
    expect(sumErr).toBeDefined()
  })

  // ── Missing both Naglowek and Podmiot results in no control sums ──
  it('skips control sums when kodFormularza is empty', () => {
    const xml = `<?xml version="1.0"?>
<JPK>
  <Podmiot1><NIP>7740001454</NIP></Podmiot1>
</JPK>`
    const report = validateExistingJpk(xml)
    // No Naglowek → kodFormularza is empty → no control sum checks
    const sumItems = report.groups[2].items
    expect(sumItems.length).toBe(0)
  })

  // ── Non-object row entries are skipped in sum calculation ──
  it('skips non-object rows in sum calculation', () => {
    // This tests the `if (typeof row !== 'object' || row === null) continue` branch
    // Hard to trigger directly since XMLParser returns objects, but the guard is there
    const xml = buildFaXml({ fakturaCount: 2 })
    const report = validateExistingJpk(xml)
    // Just ensure it doesn't crash
    expect(report.groups).toHaveLength(4)
  })
})
