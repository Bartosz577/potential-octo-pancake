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
})
