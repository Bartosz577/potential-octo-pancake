// ── JPK Version Converter ──
// Converts older JPK XML files to the latest version.
// Supported: FA(2/3) → FA(4), V7M(2) → V7M(3).

import { XMLParser, XMLBuilder } from 'fast-xml-parser'

// ── Types ──

export interface ConversionResult {
  result: string
  changes: string[]
}

interface VersionInfo {
  kodFormularza: string    // e.g. 'JPK_VAT', 'JPK_FA'
  kodSystemowy: string     // e.g. 'JPK_FA (3)'
  wariant: string          // e.g. '3'
}

// ── Target versions (latest) ──

const LATEST_VERSIONS: Record<string, { wariant: string; kodSystemowy: string; namespace: string }> = {
  JPK_FA: {
    wariant: '4',
    kodSystemowy: 'JPK_FA (4)',
    namespace: 'http://jpk.mf.gov.pl/wzor/2022/02/17/02171/',
  },
  JPK_VAT: {
    wariant: '3',
    kodSystemowy: 'JPK_V7M (3)',
    namespace: 'http://crd.gov.pl/wzor/2025/12/19/14090/',
  },
}

// ── Supported upgrade paths ──

const UPGRADE_PATHS: Record<string, string[]> = {
  JPK_FA: ['2', '3'],     // FA(2) and FA(3) can be upgraded to FA(4)
  JPK_VAT: ['2'],          // V7M(2) can be upgraded to V7M(3)
}

// ── Row elements that must be parsed as arrays ──

const ROW_ELEMENTS = new Set([
  'SprzedazWiersz', 'ZakupWiersz',
  'Faktura', 'FakturaWiersz',
])

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

// ── Helpers ──

function getTextContent(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object' && '#text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)['#text'])
  }
  return String(val)
}

function extractVersionInfo(jpk: Record<string, unknown>): VersionInfo {
  const naglowek = jpk['Naglowek'] as Record<string, unknown> | undefined
  if (!naglowek) throw new Error('Brak elementu <Naglowek> w pliku JPK')

  const kodFormularzaRaw = naglowek['KodFormularza']
  let kodFormularza = ''
  let kodSystemowy = ''

  if (typeof kodFormularzaRaw === 'object' && kodFormularzaRaw !== null) {
    const attrs = kodFormularzaRaw as Record<string, unknown>
    kodFormularza = getTextContent(attrs['#text'] ?? attrs)
    kodSystemowy = String(attrs['@_kodSystemowy'] ?? '')
  } else {
    kodFormularza = getTextContent(kodFormularzaRaw)
  }

  if (!kodFormularza) throw new Error('Brak KodFormularza w <Naglowek>')

  const wariant = getTextContent(naglowek['WariantFormularza'])
  if (!wariant) throw new Error('Brak WariantFormularza w <Naglowek>')

  return { kodFormularza, kodSystemowy, wariant }
}

function ensureArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (val === undefined || val === null) return []
  return [val]
}

// ── Conversion: Add OznaczenieKSeF="BFK" to row elements ──

function addBfkToRows(
  container: Record<string, unknown>,
  elementName: string,
  changes: string[]
): void {
  const rows = ensureArray(container[elementName])
  if (rows.length === 0) return

  let added = 0
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    // Only add BFK if no KSeF marking exists
    if (!r['NrKSeF'] && !r['OFF'] && !r['BFK'] && !r['DI'] && !r['OznaczenieKSeF']) {
      r['BFK'] = '1'
      added++
    }
  }

  container[elementName] = rows

  if (added > 0) {
    changes.push(`Dodano BFK=1 do ${added} wierszy ${elementName}`)
  }
}

// ── Update Naglowek: WariantFormularza, KodFormularza attributes ──

function updateNaglowek(
  naglowek: Record<string, unknown>,
  target: { wariant: string; kodSystemowy: string },
  changes: string[]
): void {
  const oldWariant = getTextContent(naglowek['WariantFormularza'])
  naglowek['WariantFormularza'] = target.wariant
  changes.push(`WariantFormularza: ${oldWariant} → ${target.wariant}`)

  const kodFormularza = naglowek['KodFormularza']
  if (typeof kodFormularza === 'object' && kodFormularza !== null) {
    const attrs = kodFormularza as Record<string, unknown>
    const oldKodSys = String(attrs['@_kodSystemowy'] ?? '')
    attrs['@_kodSystemowy'] = target.kodSystemowy
    if (oldKodSys !== target.kodSystemowy) {
      changes.push(`kodSystemowy: ${oldKodSys} → ${target.kodSystemowy}`)
    }
  }
}

// ── Update namespace on JPK root ──

function updateNamespace(
  jpk: Record<string, unknown>,
  targetNs: string,
  changes: string[]
): void {
  const currentNs = jpk['@_xmlns'] as string | undefined
  if (currentNs && currentNs !== targetNs) {
    jpk['@_xmlns'] = targetNs
    changes.push(`Namespace: ${currentNs} → ${targetNs}`)
  } else if (!currentNs) {
    jpk['@_xmlns'] = targetNs
    changes.push(`Dodano namespace: ${targetNs}`)
  }
}

// ── FA-specific conversion ──

function convertFa(
  jpk: Record<string, unknown>,
  changes: string[]
): void {
  const target = LATEST_VERSIONS['JPK_FA']

  // Update Naglowek
  const naglowek = jpk['Naglowek'] as Record<string, unknown>
  updateNaglowek(naglowek, target, changes)

  // Update namespace
  updateNamespace(jpk, target.namespace, changes)

  // Add BFK to FakturaWiersz rows
  addBfkToRows(jpk, 'FakturaWiersz', changes)
}

// ── V7M-specific conversion ──

function convertV7m(
  jpk: Record<string, unknown>,
  changes: string[]
): void {
  const target = LATEST_VERSIONS['JPK_VAT']

  // Update Naglowek
  const naglowek = jpk['Naglowek'] as Record<string, unknown>
  updateNaglowek(naglowek, target, changes)

  // Update namespace
  updateNamespace(jpk, target.namespace, changes)

  // V7M rows are inside <Ewidencja>
  const ewidencja = jpk['Ewidencja'] as Record<string, unknown> | undefined
  const container = ewidencja ?? jpk

  // Add BFK to SprzedazWiersz and ZakupWiersz
  addBfkToRows(container, 'SprzedazWiersz', changes)
  addBfkToRows(container, 'ZakupWiersz', changes)
}

// ── Main entry point ──

export function convertJpkVersion(xmlContent: string): ConversionResult {
  // 1. Parse XML
  const parser = new XMLParser(PARSER_OPTIONS)
  let parsed: Record<string, unknown>
  try {
    parsed = parser.parse(xmlContent) as Record<string, unknown>
  } catch (err) {
    throw new Error(
      `Błąd parsowania XML: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const jpk = parsed['JPK'] as Record<string, unknown> | undefined
  if (!jpk) throw new Error('Brak elementu <JPK> w dokumencie')

  // 2. Extract version info
  const info = extractVersionInfo(jpk)
  const latest = LATEST_VERSIONS[info.kodFormularza]

  if (!latest) {
    throw new Error(
      `Nieobsługiwana konwersja: ${info.kodFormularza}(${info.wariant}) → brak ścieżki upgrade`
    )
  }

  // 3. Check if already latest
  if (info.wariant === latest.wariant) {
    return { result: xmlContent, changes: ['Plik jest już w najnowszej wersji'] }
  }

  // 4. Check if upgrade path exists
  const paths = UPGRADE_PATHS[info.kodFormularza]
  if (!paths || !paths.includes(info.wariant)) {
    throw new Error(
      `Nieobsługiwana konwersja: ${info.kodFormularza}(${info.wariant}) → brak ścieżki upgrade`
    )
  }

  // 5. Apply conversion
  const changes: string[] = []

  if (info.kodFormularza === 'JPK_FA') {
    convertFa(jpk, changes)
  } else if (info.kodFormularza === 'JPK_VAT') {
    convertV7m(jpk, changes)
  }

  // 6. Build output XML
  delete parsed['?xml']
  const builder = new XMLBuilder(BUILDER_OPTIONS)
  const xmlBody = builder.build(parsed) as string

  return {
    result: '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlBody,
    changes,
  }
}

/** Detect if an XML file needs version upgrade. Returns info or null. */
export function detectUpgradeNeeded(xmlContent: string): {
  kodFormularza: string
  currentWariant: string
  targetWariant: string
  label: string
} | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      trimValues: true,
    })
    const parsed = parser.parse(xmlContent)
    const jpk = parsed?.['JPK'] as Record<string, unknown> | undefined
    if (!jpk) return null

    const info = extractVersionInfo(jpk)
    const latest = LATEST_VERSIONS[info.kodFormularza]
    if (!latest) return null
    if (info.wariant === latest.wariant) return null

    const paths = UPGRADE_PATHS[info.kodFormularza]
    if (!paths || !paths.includes(info.wariant)) return null

    const label = info.kodSystemowy || `${info.kodFormularza}(${info.wariant})`
    return {
      kodFormularza: info.kodFormularza,
      currentWariant: info.wariant,
      targetWariant: latest.wariant,
      label,
    }
  } catch {
    return null
  }
}
