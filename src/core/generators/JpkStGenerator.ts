// ── JPK_ST(1) XML Generator ──
// Ewidencja/wykaz środków trwałych oraz wartości niematerialnych i prawnych
// For EWP (flat-rate) and PKPIR (revenue/expense book) entities
// Schema: http://jpk.mf.gov.pl/wzor/2024/11/26/11262/

import {
  escapeXml,
  formatAmount,
  formatDateTime,
  buildElement,
  XmlGenerator,
  generatorRegistry,
} from './XmlGeneratorEngine'
import { validateGeneratorInput } from '../utils/inputValidator'

// ── Constants ──

export const ST_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2024/11/26/11262/'
export const ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-2'
const KOD_SYSTEMOWY = 'JPK_ST (1)'
const WARIANT = '1'

// ── Enums per XSD ──

export const VALID_NABYCIA = ['S', 'D', 'N', 'W', 'F', 'I'] as const
export type TNabycia = typeof VALID_NABYCIA[number]

export const VALID_WYKRESLENIE = ['S', 'X', 'K', 'D', 'N', 'I'] as const
export type TWykreslenie = typeof VALID_WYKRESLENIE[number]

export const VALID_METODA_AMORTYZACJI = ['D', 'L', 'J', 'I', 'X'] as const
export type TMetodaAmortyzacji = typeof VALID_METODA_AMORTYZACJI[number]

export const VALID_ZNACZNIK_ST = ['1', '2'] as const
export type TZnacznikST = typeof VALID_ZNACZNIK_ST[number]

// ── Input types ──

export interface StNaglowek {
  celZlozenia: number   // 0, 1, or 2
  dataOd: string        // YYYY-MM-DD
  dataDo: string        // YYYY-MM-DD
  kodUrzedu: string
}

export interface StPodmiot {
  typ: 'fizyczna' | 'niefizyczna'
  nip: string
  imie?: string
  nazwisko?: string
  dataUrodzenia?: string
  pelnaNazwa?: string
  email?: string
  telefon?: string
  znacznikSt: TZnacznikST  // '1' = EWP, '2' = PKPIR
}

// EWP variant row (F_ fields)
export interface StEwpWiersz {
  F_1: number                    // Lp (integer > 0)
  F_2?: string                   // Date: acquisition of fixed asset (choice with F_3)
  F_3?: string                   // Date: acquisition of intangible (choice with F_2)
  F_4: string                    // Date accepted for use
  F_5?: string                   // Acceptance document number
  F_6: TNabycia                  // Acquisition type
  F_7: string                    // Asset name
  F_8?: string                   // KST classification symbol
  F_9: string | number           // Base tax depreciation rate (%)
  F_10: string | number          // Initial tax value
  F_11?: string | number         // Updated initial tax value
  F_12?: string                  // Deregistration date
  F_13?: TWykreslenie            // Deregistration reason
  F_14?: string                  // Deregistration document number
  KSeF?: string[]                // KSeF numbers for disposal
  F_16: number                   // Reclassification: 1=yes, 2=no
}

// PKPIR variant row (G_ fields)
export interface StPkpirWiersz {
  G_1: number                    // Lp (integer > 0)
  G_2?: string                   // Date: acquisition of fixed asset (choice with G_3)
  G_3?: string                   // Date: acquisition of intangible (choice with G_2)
  G_4: string                    // Date accepted for use
  G_5?: string                   // Acceptance document number
  G_6: TNabycia                  // Acquisition type
  G_7: string                    // Asset name
  G_8?: string                   // KST classification symbol
  G_9: TMetodaAmortyzacji        // Depreciation method
  G_10: string | number          // Base tax depreciation rate (%)
  G_11?: string | number         // Corrected tax depreciation rate (%)
  G_12: string | number          // Initial tax value
  G_13?: string | number         // Updated initial value
  G_14: string | number          // Sum of tax depreciation for current year
  G_15: string | number          // Cumulative tax depreciation (total)
  G_16?: string | number         // Updated tax depreciation amount
  G_17?: string | number         // Change in initial tax value (+/-)
  G_18?: string                  // Deregistration date
  G_19?: TWykreslenie            // Deregistration reason
  G_20?: string                  // Deregistration document number
  KSeF?: string[]                // KSeF numbers for disposal
  G_22: number                   // Reclassification: 1=yes, 2=no
}

export interface StGeneratorInput {
  naglowek: StNaglowek
  podmiot: StPodmiot
  ewpWiersze?: StEwpWiersz[]     // when znacznikSt = '1'
  pkpirWiersze?: StPkpirWiersz[] // when znacznikSt = '2'
}

// ── XML helpers ──

function tag(name: string, value: string): string {
  return buildElement(name, value)
}

function optionalTag(name: string, value: string | undefined, indent: string): string {
  if (!value || value === '') return ''
  return `${indent}${tag(name, value)}`
}

function percentTag(name: string, value: string | number | undefined): string {
  if (value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (isNaN(num)) return ''
  return `<${name}>${escapeXml(num)}</${name}>`
}

// ── Main generator function ──

export function generateJpkSt(input: StGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${ST_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  if (input.podmiot.znacznikSt === '1' && input.ewpWiersze) {
    lines.push(generateEwpSection(input.ewpWiersze))
  } else if (input.podmiot.znacznikSt === '2' && input.pkpirWiersze) {
    lines.push(generatePkpirSection(input.pkpirWiersze))
  }

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: StNaglowek): string {
  const iso = formatDateTime()

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_ST</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push(`    <CelZlozenia>${n.celZlozenia}</CelZlozenia>`)
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('DataOd', n.dataOd)}`)
  lines.push(`    ${tag('DataDo', n.dataDo)}`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: StPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1 rola="Podatnik">')

  if (p.typ === 'fizyczna') {
    lines.push('    <OsobaFizyczna>')
    lines.push(`      ${tag('etd:NIP', p.nip)}`)
    if (p.imie) lines.push(`      ${tag('etd:ImiePierwsze', p.imie)}`)
    if (p.nazwisko) lines.push(`      ${tag('etd:Nazwisko', p.nazwisko)}`)
    if (p.dataUrodzenia) lines.push(`      ${tag('etd:DataUrodzenia', p.dataUrodzenia)}`)
    if (p.email) lines.push(`      ${tag('Email', p.email)}`)
    if (p.telefon) lines.push(`      ${tag('Telefon', p.telefon)}`)
    lines.push('    </OsobaFizyczna>')
  } else {
    lines.push('    <OsobaNiefizyczna>')
    lines.push(`      ${tag('NIP', p.nip)}`)
    lines.push(`      ${tag('PelnaNazwa', p.pelnaNazwa || '')}`)
    if (p.email) lines.push(`      ${tag('Email', p.email)}`)
    if (p.telefon) lines.push(`      ${tag('Telefon', p.telefon)}`)
    lines.push('    </OsobaNiefizyczna>')
  }

  lines.push(`    ${tag('ZnacznikST', p.znacznikSt)}`)
  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateEwpSection(wiersze: StEwpWiersz[]): string {
  const lines: string[] = []
  lines.push('  <EWP>')

  for (const w of wiersze) {
    lines.push('    <Wiersz>')
    const ind = '      '
    lines.push(`${ind}<F_1>${escapeXml(w.F_1)}</F_1>`)

    // Choice: F_2 (fixed asset) or F_3 (intangible)
    if (w.F_2) {
      lines.push(`${ind}${tag('F_2', w.F_2)}`)
    } else if (w.F_3) {
      lines.push(`${ind}${tag('F_3', w.F_3)}`)
    }

    lines.push(`${ind}${tag('F_4', w.F_4)}`)

    const f5 = optionalTag('F_5', w.F_5, ind)
    if (f5) lines.push(f5)

    lines.push(`${ind}${tag('F_6', w.F_6)}`)
    lines.push(`${ind}${tag('F_7', w.F_7)}`)

    const f8 = optionalTag('F_8', w.F_8, ind)
    if (f8) lines.push(f8)

    lines.push(`${ind}${percentTag('F_9', w.F_9)}`)
    lines.push(`${ind}<F_10>${escapeXml(formatAmount(w.F_10))}</F_10>`)

    if (w.F_11 !== undefined && w.F_11 !== '') {
      lines.push(`${ind}<F_11>${escapeXml(formatAmount(w.F_11))}</F_11>`)
    }

    // Deregistration group (all three or none)
    if (w.F_12 && w.F_13 && w.F_14) {
      lines.push(`${ind}${tag('F_12', w.F_12)}`)
      lines.push(`${ind}${tag('F_13', w.F_13)}`)
      lines.push(`${ind}${tag('F_14', w.F_14)}`)
    }

    // KSeF numbers
    if (w.KSeF) {
      for (const ksef of w.KSeF) {
        lines.push(`${ind}${tag('KSeF', ksef)}`)
      }
    }

    lines.push(`${ind}<F_16>${escapeXml(w.F_16)}</F_16>`)
    lines.push('    </Wiersz>')
  }

  lines.push('  </EWP>')
  return lines.join('\n')
}

function generatePkpirSection(wiersze: StPkpirWiersz[]): string {
  const lines: string[] = []
  lines.push('  <PKPIR>')

  for (const w of wiersze) {
    lines.push('    <Wiersz>')
    const ind = '      '
    lines.push(`${ind}<G_1>${escapeXml(w.G_1)}</G_1>`)

    // Choice: G_2 (fixed asset) or G_3 (intangible)
    if (w.G_2) {
      lines.push(`${ind}${tag('G_2', w.G_2)}`)
    } else if (w.G_3) {
      lines.push(`${ind}${tag('G_3', w.G_3)}`)
    }

    lines.push(`${ind}${tag('G_4', w.G_4)}`)

    const g5 = optionalTag('G_5', w.G_5, ind)
    if (g5) lines.push(g5)

    lines.push(`${ind}${tag('G_6', w.G_6)}`)
    lines.push(`${ind}${tag('G_7', w.G_7)}`)

    const g8 = optionalTag('G_8', w.G_8, ind)
    if (g8) lines.push(g8)

    lines.push(`${ind}${tag('G_9', w.G_9)}`)
    lines.push(`${ind}${percentTag('G_10', w.G_10)}`)

    if (w.G_11 !== undefined && w.G_11 !== '') {
      lines.push(`${ind}${percentTag('G_11', w.G_11)}`)
    }

    lines.push(`${ind}<G_12>${escapeXml(formatAmount(w.G_12))}</G_12>`)

    if (w.G_13 !== undefined && w.G_13 !== '') {
      lines.push(`${ind}<G_13>${escapeXml(formatAmount(w.G_13))}</G_13>`)
    }

    lines.push(`${ind}<G_14>${escapeXml(formatAmount(w.G_14))}</G_14>`)
    lines.push(`${ind}<G_15>${escapeXml(formatAmount(w.G_15))}</G_15>`)

    if (w.G_16 !== undefined && w.G_16 !== '') {
      lines.push(`${ind}<G_16>${escapeXml(formatAmount(w.G_16))}</G_16>`)
    }

    if (w.G_17 !== undefined && w.G_17 !== '') {
      lines.push(`${ind}<G_17>${escapeXml(formatAmount(w.G_17))}</G_17>`)
    }

    // Deregistration group (all three or none)
    if (w.G_18 && w.G_19 && w.G_20) {
      lines.push(`${ind}${tag('G_18', w.G_18)}`)
      lines.push(`${ind}${tag('G_19', w.G_19)}`)
      lines.push(`${ind}${tag('G_20', w.G_20)}`)
    }

    // KSeF numbers
    if (w.KSeF) {
      for (const ksef of w.KSeF) {
        lines.push(`${ind}${tag('KSeF', ksef)}`)
      }
    }

    lines.push(`${ind}<G_22>${escapeXml(w.G_22)}</G_22>`)
    lines.push('    </Wiersz>')
  }

  lines.push('  </PKPIR>')
  return lines.join('\n')
}

// ── Validation helpers ──

export function isValidNabycia(value: string): boolean {
  return (VALID_NABYCIA as readonly string[]).includes(value)
}

export function isValidWykreslenie(value: string): boolean {
  return (VALID_WYKRESLENIE as readonly string[]).includes(value)
}

export function isValidMetodaAmortyzacji(value: string): boolean {
  return (VALID_METODA_AMORTYZACJI as readonly string[]).includes(value)
}

// ── XmlGenerator implementation ──

export const jpkStGenerator: XmlGenerator = {
  jpkType: 'JPK_ST',
  version: WARIANT,
  namespace: ST_NAMESPACE,
  generate: (input: unknown) => {
    const data = validateGeneratorInput<StGeneratorInput>(
      input,
      ['naglowek', 'podmiot'],
      'JPK_ST',
    )
    return generateJpkSt(data)
  },
}

generatorRegistry.register(jpkStGenerator)

export { escapeXml, formatAmount }
