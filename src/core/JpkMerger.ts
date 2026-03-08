// ── JPK Merger ──
// Merges multiple same-type JPK XML files into a single file.
// Validates matching KodFormularza, WariantFormularza, and NIP.
// Concatenates row sections, renumbers LP fields, recalculates Ctrl sums.

import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { sumAmounts } from './utils/mathUtils'

// ── Merge configuration types ──

interface RowSection {
  element: string
  lpField?: string
}

interface CtrlSection {
  element: string
  countField: string
  sumFields: string[]
}

interface MergeGroup {
  rows: RowSection
  ctrl: CtrlSection
}

interface MergeConfig {
  container?: string   // nested container element (e.g. 'Ewidencja' for V7M/V7K)
  groups: MergeGroup[]
}

// ── All row element names (for isArray in parser) ──

const ROW_ELEMENTS = new Set([
  'SprzedazWiersz', 'ZakupWiersz',
  'Faktura', 'FakturaWiersz',
  'FakturaRR', 'FakturaRRWiersz', 'Oswiadczenie',
  'WyciagWiersz',
  'EWPWiersz',
  'PKPIRWiersz',
  'Dziennik', 'KontoZapis',
])

// ── Merge configs per JPK KodFormularza text ──

const MERGE_CONFIGS: Record<string, MergeConfig> = {
  'JPK_VAT': {
    container: 'Ewidencja',
    groups: [
      {
        rows: { element: 'SprzedazWiersz', lpField: 'LpSprzedazy' },
        ctrl: { element: 'SprzedazCtrl', countField: 'LiczbaWierszySprzedazy', sumFields: ['PodatekNalezny'] },
      },
      {
        rows: { element: 'ZakupWiersz', lpField: 'LpZakupu' },
        ctrl: { element: 'ZakupCtrl', countField: 'LiczbaWierszyZakupow', sumFields: ['PodatekNaliczony'] },
      },
    ],
  },
  'JPK_FA': {
    groups: [
      {
        rows: { element: 'Faktura' },
        ctrl: { element: 'FakturaCtrl', countField: 'LiczbaFaktur', sumFields: ['WartoscFaktur'] },
      },
      {
        rows: { element: 'FakturaWiersz' },
        ctrl: { element: 'FakturaWierszCtrl', countField: 'LiczbaWierszyFaktur', sumFields: ['WartoscWierszyFaktur'] },
      },
    ],
  },
  'JPK_WB': {
    groups: [
      {
        rows: { element: 'WyciagWiersz', lpField: 'NumerWiersza' },
        ctrl: { element: 'WyciagCtrl', countField: 'LiczbaWierszy', sumFields: ['SumaObciazen', 'SumaUznan'] },
      },
    ],
  },
  'JPK_EWP': {
    groups: [
      {
        rows: { element: 'EWPWiersz', lpField: 'K_1' },
        ctrl: { element: 'EWPCtrl', countField: 'LiczbaWierszy', sumFields: ['SumaPrzychodow'] },
      },
    ],
  },
  'JPK_PKPIR': {
    groups: [
      {
        rows: { element: 'PKPIRWiersz', lpField: 'K_1' },
        ctrl: { element: 'PKPIRCtrl', countField: 'LiczbaWierszy', sumFields: ['SumaPrzychodow'] },
      },
    ],
  },
  'JPK_KR': {
    groups: [
      {
        rows: { element: 'Dziennik', lpField: 'LpZapisuDziennika' },
        ctrl: { element: 'DziennikCtrl', countField: 'LiczbaWierszyDziennika', sumFields: ['SumaKwotOperacji'] },
      },
      {
        rows: { element: 'KontoZapis', lpField: 'LpZapisu' },
        ctrl: { element: 'KontoZapisCtrl', countField: 'LiczbaWierszyKontoZapisj', sumFields: ['SumaWinien', 'SumaMa'] },
      },
    ],
  },
  'JPK_FA_RR': {
    groups: [
      {
        rows: { element: 'FakturaRR' },
        ctrl: { element: 'FakturaRRCtrl', countField: 'LiczbaFakturRR', sumFields: ['WartoscFakturRR'] },
      },
      {
        rows: { element: 'FakturaRRWiersz' },
        ctrl: { element: 'FakturaRRWierszCtrl', countField: 'LiczbaWierszyFakturRR', sumFields: ['WartoscWierszyFakturRR'] },
      },
      {
        rows: { element: 'Oswiadczenie' },
        ctrl: { element: 'OswiadczenieCtrl', countField: 'LiczbaOswiadczen', sumFields: [] },
      },
    ],
  },
}

// ── Helper functions ──

function getTextContent(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object' && '#text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)['#text'])
  }
  return String(val)
}

function findNipInObject(obj: Record<string, unknown>): string | null {
  if ('NIP' in obj) return getTextContent(obj['NIP'])
  if ('etd:NIP' in obj) return getTextContent(obj['etd:NIP'])

  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const found = findNipInObject(val as Record<string, unknown>)
      if (found) return found
    }
  }
  return null
}

interface JpkHeader {
  kodFormularza: string
  wariant: string
}

function extractHeader(jpk: Record<string, unknown>, fileIdx: number): JpkHeader {
  const naglowek = jpk['Naglowek'] as Record<string, unknown> | undefined
  if (!naglowek) throw new Error(`Plik #${fileIdx + 1}: brak elementu <Naglowek>`)

  const kodFormularza = getTextContent(naglowek['KodFormularza'])
  if (!kodFormularza) throw new Error(`Plik #${fileIdx + 1}: brak KodFormularza`)

  const wariant = getTextContent(naglowek['WariantFormularza'])
  if (!wariant) throw new Error(`Plik #${fileIdx + 1}: brak WariantFormularza`)

  return { kodFormularza, wariant }
}

function extractNip(jpk: Record<string, unknown>, fileIdx: number): string {
  const podmiot = jpk['Podmiot1'] as Record<string, unknown> | undefined
  if (!podmiot) throw new Error(`Plik #${fileIdx + 1}: brak elementu <Podmiot1>`)

  const nip = findNipInObject(podmiot)
  if (!nip) throw new Error(`Plik #${fileIdx + 1}: nie znaleziono NIP w <Podmiot1>`)
  return nip
}

function getContainer(jpk: Record<string, unknown>, config: MergeConfig): Record<string, unknown> | null {
  if (config.container) {
    return (jpk[config.container] as Record<string, unknown>) ?? null
  }
  return jpk
}

function ensureArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (val === undefined || val === null) return []
  return [val]
}

function formatSum(val: number): string {
  return val.toFixed(2)
}

// ── Parser & Builder options ──

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: false,
  isArray: (name: string) => ROW_ELEMENTS.has(name),
}

const BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
}

// ── Main merge function ──

export function mergeJpkFiles(xmlFiles: string[]): string {
  if (xmlFiles.length === 0) {
    throw new Error('Brak plików do scalenia')
  }
  if (xmlFiles.length === 1) {
    return xmlFiles[0]
  }

  // 1. Parse all files
  const parser = new XMLParser(PARSER_OPTIONS)
  const parsed = xmlFiles.map((xml, i) => {
    try {
      return parser.parse(xml)
    } catch (err) {
      throw new Error(
        `Błąd parsowania pliku #${i + 1}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  // 2. Extract JPK root from each
  const jpkRoots = parsed.map((p, i) => {
    const jpk = (p as Record<string, unknown>)['JPK']
    if (!jpk) throw new Error(`Plik #${i + 1}: brak elementu <JPK>`)
    return jpk as Record<string, unknown>
  })

  // 3. Validate: same KodFormularza and WariantFormularza
  const headers = jpkRoots.map((jpk, i) => extractHeader(jpk, i))
  for (let i = 1; i < headers.length; i++) {
    if (headers[i].kodFormularza !== headers[0].kodFormularza) {
      throw new Error(
        `Niezgodny typ JPK: plik #1 = ${headers[0].kodFormularza}, plik #${i + 1} = ${headers[i].kodFormularza}`
      )
    }
    if (headers[i].wariant !== headers[0].wariant) {
      throw new Error(
        `Niezgodny wariant: plik #1 = ${headers[0].wariant}, plik #${i + 1} = ${headers[i].wariant}`
      )
    }
  }

  // 4. Validate: same NIP
  const nips = jpkRoots.map((jpk, i) => extractNip(jpk, i))
  for (let i = 1; i < nips.length; i++) {
    if (nips[i] !== nips[0]) {
      throw new Error(
        `Niezgodny NIP: plik #1 = ${nips[0]}, plik #${i + 1} = ${nips[i]}`
      )
    }
  }

  // 5. Get merge config for this type
  const jpkType = headers[0].kodFormularza
  const config = MERGE_CONFIGS[jpkType]
  if (!config) {
    throw new Error(`Nieobsługiwany typ JPK do scalania: ${jpkType}`)
  }

  // 6. Clone first file as base result
  const result = structuredClone(parsed[0]) as Record<string, unknown>
  const resultJpk = result['JPK'] as Record<string, unknown>
  const resultContainer = getContainer(resultJpk, config)
  if (!resultContainer) {
    throw new Error(`Brak kontenera ${config.container} w pliku bazowym`)
  }

  // 7. Merge each group
  for (const group of config.groups) {
    // Collect all rows from all files
    const allRows: unknown[] = []
    for (const jpk of jpkRoots) {
      const container = getContainer(jpk, config)
      if (!container) continue
      const rows = ensureArray(container[group.rows.element])
      allRows.push(...rows)
    }

    // Renumber LP fields continuously
    if (group.rows.lpField) {
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i] as Record<string, unknown>
        row[group.rows.lpField] = String(i + 1)
      }
    }

    // Set merged rows in result
    resultContainer[group.rows.element] = allRows

    // Recalculate Ctrl section
    const existingCtrl = resultContainer[group.ctrl.element] as Record<string, unknown> | undefined
    const newCtrl: Record<string, unknown> = existingCtrl ? { ...existingCtrl } : {}

    // Update count
    newCtrl[group.ctrl.countField] = String(allRows.length)

    // Sum up sum fields from all files
    for (const sumField of group.ctrl.sumFields) {
      const values: number[] = []
      for (const jpk of jpkRoots) {
        const container = getContainer(jpk, config)
        if (!container) continue
        const ctrl = container[group.ctrl.element] as Record<string, unknown> | undefined
        if (ctrl && ctrl[sumField] !== undefined) {
          values.push(parseFloat(String(ctrl[sumField])) || 0)
        }
      }
      newCtrl[sumField] = formatSum(sumAmounts(values))
    }

    resultContainer[group.ctrl.element] = newCtrl
  }

  // 8. Build XML output
  delete result['?xml']
  const builder = new XMLBuilder(BUILDER_OPTIONS)
  const xmlBody = builder.build(result) as string

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlBody
}

/** Get the list of supported JPK types for merging */
export function getSupportedMergeTypes(): string[] {
  return Object.keys(MERGE_CONFIGS)
}
