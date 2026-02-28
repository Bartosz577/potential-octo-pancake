import { describe, it, expect } from 'vitest'
import { generateVdekXml, getVdekSummary } from '../../../src/renderer/src/utils/xmlGenerator'
import type { ParsedFile } from '../../../src/renderer/src/types/index'
import type { CompanyData, PeriodData } from '../../../src/renderer/src/stores/companyStore'

// ── Fixtures ──

const company: CompanyData = {
  nip: '526-104-08-28',
  fullName: 'Test Sp. z o.o.',
  regon: '123456789',
  kodUrzedu: '1471',
  email: 'test@test.pl',
  phone: ''
}

const period: PeriodData = {
  year: 2024,
  month: 1,
  celZlozenia: 1 as const
}

/**
 * Build a minimal data row (63 columns: indices 0..62).
 * Columns:
 *   0  = LpSprzedazy
 *   1  = KodKrajuNadaniaTIN
 *   2  = NrKontrahenta
 *   3  = NazwaKontrahenta
 *   4  = DowodSprzedazy
 *   5  = DataWystawienia
 *   6  = DataSprzedazy
 *   7  = TypDokumentu
 *   8..20  = GTU_01..GTU_13
 *   21..35 = markers
 *   36..62 = K_10..K_36
 */
function makeRow(overrides: Record<number, string> = {}): string[] {
  const row = new Array(63).fill('')
  // Sensible defaults
  row[0] = '1'                   // LpSprzedazy
  row[1] = 'PL'                  // KodKrajuNadaniaTIN
  row[2] = '9876543210'          // NrKontrahenta
  row[3] = 'Kontrahent ABC'      // NazwaKontrahenta
  row[4] = 'FV/2024/001'         // DowodSprzedazy
  row[5] = '2024-01-15'          // DataWystawienia
  row[6] = '2024-01-15'          // DataSprzedazy

  for (const [idx, val] of Object.entries(overrides)) {
    row[Number(idx)] = val
  }
  return row
}

function makeParsedFile(rows: string[][]): ParsedFile {
  return {
    id: 'test-1',
    filename: 'test.txt',
    system: 'NAMOS',
    jpkType: 'JPK_VDEK',
    subType: 'SprzedazWiersz',
    pointCode: 'PP01',
    dateFrom: '2024-01',
    dateTo: '2024-01',
    rows,
    rowCount: rows.length,
    columnCount: 63,
    fileSize: 0
  }
}

// ── generateVdekXml ──

describe('generateVdekXml', () => {
  it('starts with XML declaration', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })

  it('contains JPK root element with correct namespace', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('<JPK xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">')
  })

  it('contains Naglowek with WariantFormularza=3', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('<WariantFormularza>3</WariantFormularza>')
  })

  it('contains KodFormularza with correct attributes', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('kodSystemowy="JPK_V7M (3)"')
    expect(xml).toContain('wersjaSchemy="1-2E"')
    expect(xml).toContain('>JPK_VAT</KodFormularza>')
  })

  it('contains CelZlozenia with period value', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('poz="P_7"')
    expect(xml).toContain('>1</CelZlozenia>')
  })

  it('contains Rok and Miesiac from period', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('<Rok>2024</Rok>')
    expect(xml).toContain('<Miesiac>1</Miesiac>')
  })

  it('contains Podmiot1 with normalized NIP and PelnaNazwa', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('<NIP>5261040828</NIP>')
    expect(xml).toContain('<PelnaNazwa>Test Sp. z o.o.</PelnaNazwa>')
  })

  it('includes REGON when provided', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('<REGON>123456789</REGON>')
  })

  it('omits REGON when empty', () => {
    const noRegon = { ...company, regon: '' }
    const xml = generateVdekXml(makeParsedFile([makeRow()]), noRegon, period)
    expect(xml).not.toContain('<REGON>')
  })

  it('contains SprzedazWiersz for each row', () => {
    const rows = [makeRow(), makeRow({ 0: '2' })]
    const xml = generateVdekXml(makeParsedFile(rows), company, period)
    const matches = xml.match(/<SprzedazWiersz>/g)
    expect(matches).toHaveLength(2)
  })

  it('contains SprzedazCtrl with correct row count', () => {
    const rows = [makeRow(), makeRow({ 0: '2' }), makeRow({ 0: '3' })]
    const xml = generateVdekXml(makeParsedFile(rows), company, period)
    expect(xml).toContain('<LiczbaWierszySprzedazy>3</LiczbaWierszySprzedazy>')
  })

  it('escapes XML special characters in values', () => {
    const row = makeRow({ 3: 'Firma & "Synowie" <sp>' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&quot;')
    expect(xml).toContain('&lt;')
    expect(xml).toContain('&gt;')
  })

  it('escapes apostrophe in XML', () => {
    const row = makeRow({ 3: "Firma O'Brien" })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('&apos;')
  })

  it('skips NrKontrahenta when value is "brak"', () => {
    const row = makeRow({ 2: 'brak' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).not.toContain('<NrKontrahenta>')
  })

  it('skips NrKontrahenta when value is empty', () => {
    const row = makeRow({ 2: '' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).not.toContain('<NrKontrahenta>')
  })

  it('includes NrKontrahenta when value is a normal NIP', () => {
    const row = makeRow({ 2: '9876543210' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('<NrKontrahenta>9876543210</NrKontrahenta>')
  })

  it('skips optional GTU markers when not "1"', () => {
    const row = makeRow() // all GTU fields are empty
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).not.toContain('<GTU_01>')
    expect(xml).not.toContain('<GTU_13>')
  })

  it('includes GTU markers when value is "1"', () => {
    const row = makeRow({ 8: '1', 20: '1' }) // GTU_01=1, GTU_13=1
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('<GTU_01>1</GTU_01>')
    expect(xml).toContain('<GTU_13>1</GTU_13>')
  })

  it('outputs K_ fields only when non-zero', () => {
    // K_10 is at data index 36, K_11 at 37
    const row = makeRow({ 36: '100.00', 37: '0.00', 38: '' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('<K_10>100.00</K_10>')
    expect(xml).not.toContain('<K_11>')
    expect(xml).not.toContain('<K_12>')
  })

  it('calculates PodatekNalezny from VAT K fields', () => {
    // VAT_K_INDICES = [10, 12, 14, 16, 18, 20, 23] (offsets within K_FIELDS)
    // K_20 = data[46], K_22 = data[48], K_24 = data[50]
    // K_26 = data[52], K_28 = data[54], K_30 = data[56], K_33 = data[59]
    const row = makeRow({
      46: '23.00',  // K_20
      48: '8.00',   // K_22
      50: '5.00',   // K_24
    })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('<PodatekNalezny>36.00</PodatekNalezny>')
  })

  it('sums VAT across multiple rows', () => {
    const row1 = makeRow({ 46: '23.00' })  // K_20 = 23
    const row2 = makeRow({ 0: '2', 46: '10.00' })  // K_20 = 10
    const xml = generateVdekXml(makeParsedFile([row1, row2]), company, period)
    expect(xml).toContain('<PodatekNalezny>33.00</PodatekNalezny>')
  })

  it('includes KodUrzedu from company data', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml).toContain('<KodUrzedu>1471</KodUrzedu>')
  })

  it('includes DataSprzedazy when present', () => {
    const row = makeRow({ 6: '2024-01-20' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('<DataSprzedazy>2024-01-20</DataSprzedazy>')
  })

  it('skips DataSprzedazy when empty', () => {
    const row = makeRow({ 6: '' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).not.toContain('<DataSprzedazy>')
  })

  it('includes TypDokumentu when present', () => {
    const row = makeRow({ 7: 'FP' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).toContain('<TypDokumentu>FP</TypDokumentu>')
  })

  it('skips TypDokumentu when empty', () => {
    const row = makeRow({ 7: '' })
    const xml = generateVdekXml(makeParsedFile([row]), company, period)
    expect(xml).not.toContain('<TypDokumentu>')
  })

  it('ends with closing JPK tag', () => {
    const xml = generateVdekXml(makeParsedFile([makeRow()]), company, period)
    expect(xml.trimEnd()).toMatch(/<\/JPK>$/)
  })
})

// ── getVdekSummary ──

describe('getVdekSummary', () => {
  it('returns correct filename format: JPK_V7M_{NIP}_{YYYY-MM}.xml', () => {
    const summary = getVdekSummary(makeParsedFile([makeRow()]), company, period)
    expect(summary.filename).toBe('JPK_V7M_5261040828_2024-01.xml')
  })

  it('pads month to two digits in filename', () => {
    const summary = getVdekSummary(makeParsedFile([makeRow()]), company, period)
    // month=1 should be "01"
    expect(summary.filename).toContain('2024-01')
  })

  it('returns correct rowCount', () => {
    const rows = [makeRow(), makeRow({ 0: '2' }), makeRow({ 0: '3' })]
    const summary = getVdekSummary(makeParsedFile(rows), company, period)
    expect(summary.rowCount).toBe(3)
  })

  it('calculates vatTotal from VAT K fields', () => {
    const row = makeRow({
      46: '23.00',  // K_20
      48: '8.00',   // K_22
      50: '5.00',   // K_24
    })
    const summary = getVdekSummary(makeParsedFile([row]), company, period)
    expect(summary.vatTotal).toBeCloseTo(36.00, 2)
  })

  it('sums vatTotal across multiple rows', () => {
    const row1 = makeRow({ 46: '100.00' })
    const row2 = makeRow({ 0: '2', 48: '50.00' })
    const summary = getVdekSummary(makeParsedFile([row1, row2]), company, period)
    expect(summary.vatTotal).toBeCloseTo(150.00, 2)
  })

  it('returns vatTotal=0 when no K fields have values', () => {
    const summary = getVdekSummary(makeParsedFile([makeRow()]), company, period)
    expect(summary.vatTotal).toBe(0)
  })

  it('normalizes NIP with dashes for filename', () => {
    const dashCompany = { ...company, nip: '526-104-08-28' }
    const summary = getVdekSummary(makeParsedFile([makeRow()]), dashCompany, period)
    expect(summary.filename).toBe('JPK_V7M_5261040828_2024-01.xml')
  })

  it('returns fileSize as 0 (computed after generation)', () => {
    const summary = getVdekSummary(makeParsedFile([makeRow()]), company, period)
    expect(summary.fileSize).toBe(0)
  })
})
