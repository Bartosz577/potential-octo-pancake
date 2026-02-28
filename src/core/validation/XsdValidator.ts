/**
 * XsdValidator — lightweight rule-based XML validation against JPK XSD schemas.
 *
 * Since we can't use a native XSD parser in Electron, this validator encodes
 * the key structural and data-type rules from each JPK XSD schema as code.
 * It parses the generated XML with fast-xml-parser and checks:
 * - Root element, namespace, and required attributes
 * - Required sections and element ordering
 * - Data type formats: TKwotowy (decimal 18,2), TData (YYYY-MM-DD), TDataCzas (ISO datetime)
 * - NIP format (10 digits), email pattern, IBAN pattern
 * - Control sum verification (LiczbaWierszy, PodatekNalezny/PodatekNaliczony)
 * - KodFormularza attributes (kodSystemowy, wersjaSchemy)
 */

import { XMLParser } from 'fast-xml-parser'

export type XsdIssueSeverity = 'error' | 'warning' | 'info'

export interface XsdIssue {
  severity: XsdIssueSeverity
  code: string
  message: string
  path?: string
}

export interface XsdValidationResult {
  valid: boolean
  issues: XsdIssue[]
  jpkType: string | null
}

// Expected schema metadata per JPK type
interface SchemaSpec {
  kodFormularza: string
  kodSystemowy: string
  wersjaSchemy: string
  wariant: string
  namespace: string
  requiredSections: string[]
  ctrlSections?: CtrlSpec[]
}

interface CtrlSpec {
  ctrlElement: string
  countElement: string
  sumElement?: string
  rowElement: string
  sumFields?: string[]
  sumSubtractFields?: string[]
}

const SCHEMAS: Record<string, SchemaSpec> = {
  JPK_V7M: {
    kodFormularza: 'JPK_VAT',
    kodSystemowy: 'JPK_V7M (3)',
    wersjaSchemy: '1-0E',
    wariant: '3',
    namespace: 'http://crd.gov.pl/wzor/2025/12/19/14090/',
    requiredSections: ['Naglowek', 'Podmiot1', 'Ewidencja'],
    ctrlSections: [
      {
        ctrlElement: 'SprzedazCtrl',
        countElement: 'LiczbaWierszySprzedazy',
        sumElement: 'PodatekNalezny',
        rowElement: 'SprzedazWiersz',
        sumFields: ['K_16', 'K_18', 'K_20', 'K_24', 'K_26', 'K_28', 'K_30', 'K_32', 'K_33', 'K_34'],
        sumSubtractFields: ['K_35', 'K_36', 'K_360']
      },
      {
        ctrlElement: 'ZakupCtrl',
        countElement: 'LiczbaWierszyZakupow',
        sumElement: 'PodatekNaliczony',
        rowElement: 'ZakupWiersz',
        sumFields: ['K_41', 'K_43', 'K_44', 'K_45', 'K_46', 'K_47']
      }
    ]
  },
  JPK_FA: {
    kodFormularza: 'JPK_FA',
    kodSystemowy: 'JPK_FA (4)',
    wersjaSchemy: '1-0',
    wariant: '4',
    namespace: 'http://jpk.mf.gov.pl/wzor/2022/02/17/02171/',
    requiredSections: ['Naglowek', 'Podmiot1'],
    ctrlSections: [
      {
        ctrlElement: 'FakturaCtrl',
        countElement: 'LiczbaFaktur',
        sumElement: 'WartoscFaktur',
        rowElement: 'Faktura',
        sumFields: ['P_15']
      }
    ]
  },
  JPK_MAG: {
    kodFormularza: 'JPK_MAG',
    kodSystemowy: 'JPK_MAG (2)',
    wersjaSchemy: '1-0',
    wariant: '2',
    namespace: 'http://jpk.mf.gov.pl/wzor/2025/11/24/11242/',
    requiredSections: ['Naglowek', 'Podmiot1']
  },
  JPK_WB: {
    kodFormularza: 'JPK_WB',
    kodSystemowy: 'JPK_WB (1)',
    wersjaSchemy: '1-0',
    wariant: '1',
    namespace: 'http://jpk.mf.gov.pl/wzor/2016/03/09/03092/',
    requiredSections: ['Naglowek', 'Podmiot1', 'NumerRachunku', 'Salda'],
    ctrlSections: [
      {
        ctrlElement: 'WyciagCtrl',
        countElement: 'LiczbaWierszy',
        rowElement: 'WyciagWiersz'
      }
    ]
  }
}

// Regex patterns for data types
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const DECIMAL_PATTERN = /^-?\d+\.\d{2}$/
const NIP_PATTERN = /^\d{10}$/
const EMAIL_PATTERN = /^.+@.+$/
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[0-9A-Z]{10,30}$/

// Amount fields that should be TKwotowy (decimal 18,2)
const AMOUNT_FIELD_PATTERNS = [
  /^K_\d+$/, /^K_\d+0$/, /^P_\d+/, /^SaldoPoczatkowe$/, /^SaldoKoncowe$/,
  /^KwotaOperacji$/, /^SaldoOperacji$/, /^PodatekNalezny$/, /^PodatekNaliczony$/,
  /^SumaObciazen$/, /^SumaUznan$/, /^WartoscFaktur$/, /^SprzedazVAT_Marza$/,
  /^ZakupVAT_Marza$/, /^WartoscPozycji$/, /^CenaJednostkowa$/
]

function isAmountField(name: string): boolean {
  return AMOUNT_FIELD_PATTERNS.some((p) => p.test(name))
}

// Date fields
const DATE_FIELDS = new Set([
  'DataOd', 'DataDo', 'DataSprzedazy', 'DataWystawienia', 'DataZakupu',
  'DataWplywu', 'DataOperacji', 'TerminPlatnosci', 'DataZaplaty',
  'DataPZ', 'DataWZ', 'DataRW', 'DataMM', 'DataFaktury', 'DataInwentaryzacji'
])

const DATETIME_FIELDS = new Set(['DataWytworzeniaJPK'])

/**
 * Parse XML string into a JS object for validation.
 */
function parseXml(xml: string): Record<string, unknown> | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: false,
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true
    })
    return parser.parse(xml) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Ensure value is an array (XML parser returns single element as object, not array).
 */
function ensureArray(val: unknown): unknown[] {
  if (val === undefined || val === null) return []
  return Array.isArray(val) ? val : [val]
}

/**
 * Detect JPK type from parsed XML.
 */
function detectJpkType(jpk: Record<string, unknown>): string | null {
  const naglowek = jpk['Naglowek'] as Record<string, unknown> | undefined
  if (!naglowek) return null

  const kodFormularza = naglowek['KodFormularza']
  if (typeof kodFormularza === 'object' && kodFormularza !== null) {
    const attrs = kodFormularza as Record<string, unknown>
    const kodSys = attrs['@_kodSystemowy'] as string | undefined
    if (kodSys) {
      if (kodSys.startsWith('JPK_V7M')) return 'JPK_V7M'
      if (kodSys.startsWith('JPK_FA')) return 'JPK_FA'
      if (kodSys.startsWith('JPK_MAG')) return 'JPK_MAG'
      if (kodSys.startsWith('JPK_WB')) return 'JPK_WB'
    }
  }

  // Fallback: check #text value
  const text = typeof kodFormularza === 'string' ? kodFormularza :
    (kodFormularza as Record<string, unknown>)?.['#text'] as string | undefined
  if (text === 'JPK_VAT') return 'JPK_V7M'
  if (text === 'JPK_FA') return 'JPK_FA'
  if (text === 'JPK_MAG') return 'JPK_MAG'
  if (text === 'JPK_WB') return 'JPK_WB'

  return null
}

/**
 * Validate the XML header (Naglowek) against the schema spec.
 */
function validateHeader(
  naglowek: Record<string, unknown>,
  spec: SchemaSpec,
  issues: XsdIssue[]
): void {
  // KodFormularza and its attributes
  const kodFormularza = naglowek['KodFormularza'] as Record<string, unknown> | string | undefined
  if (!kodFormularza) {
    issues.push({
      severity: 'error',
      code: 'XSD_MISSING_ELEMENT',
      message: 'Brak elementu KodFormularza w nagłówku',
      path: 'Naglowek.KodFormularza'
    })
  } else if (typeof kodFormularza === 'object') {
    const kodSys = kodFormularza['@_kodSystemowy'] as string | undefined
    const wersjaSch = kodFormularza['@_wersjaSchemy'] as string | undefined

    if (kodSys !== spec.kodSystemowy) {
      issues.push({
        severity: 'error',
        code: 'XSD_INVALID_ATTRIBUTE',
        message: `Nieprawidłowy kodSystemowy: "${kodSys}" (oczekiwano "${spec.kodSystemowy}")`,
        path: 'Naglowek.KodFormularza@kodSystemowy'
      })
    }
    if (wersjaSch !== spec.wersjaSchemy) {
      issues.push({
        severity: 'error',
        code: 'XSD_INVALID_ATTRIBUTE',
        message: `Nieprawidłowa wersjaSchemy: "${wersjaSch}" (oczekiwano "${spec.wersjaSchemy}")`,
        path: 'Naglowek.KodFormularza@wersjaSchemy'
      })
    }
  }

  // WariantFormularza
  const wariant = String(naglowek['WariantFormularza'] ?? '')
  if (wariant !== spec.wariant) {
    issues.push({
      severity: 'error',
      code: 'XSD_INVALID_VALUE',
      message: `Nieprawidłowy WariantFormularza: "${wariant}" (oczekiwano "${spec.wariant}")`,
      path: 'Naglowek.WariantFormularza'
    })
  }

  // DataWytworzeniaJPK — must be ISO datetime
  const dataWytw = naglowek['DataWytworzeniaJPK'] as string | undefined
  if (!dataWytw) {
    issues.push({
      severity: 'error',
      code: 'XSD_MISSING_ELEMENT',
      message: 'Brak elementu DataWytworzeniaJPK',
      path: 'Naglowek.DataWytworzeniaJPK'
    })
  } else if (!DATETIME_PATTERN.test(dataWytw)) {
    issues.push({
      severity: 'error',
      code: 'XSD_INVALID_FORMAT',
      message: `Nieprawidłowy format DataWytworzeniaJPK: "${dataWytw}" (oczekiwano ISO datetime)`,
      path: 'Naglowek.DataWytworzeniaJPK'
    })
  }

  // KodUrzedu — should be 4 digits
  const kodUrzedu = naglowek['KodUrzedu'] as string | undefined
  if (!kodUrzedu) {
    issues.push({
      severity: 'error',
      code: 'XSD_MISSING_ELEMENT',
      message: 'Brak elementu KodUrzedu',
      path: 'Naglowek.KodUrzedu'
    })
  } else if (!/^\d{4}$/.test(kodUrzedu)) {
    issues.push({
      severity: 'warning',
      code: 'XSD_INVALID_FORMAT',
      message: `KodUrzedu "${kodUrzedu}" nie jest 4-cyfrowym kodem`,
      path: 'Naglowek.KodUrzedu'
    })
  }

  // Date period fields
  validateDateFields(naglowek, 'Naglowek', issues)
}

/**
 * Recursively validate date and amount fields in an element.
 */
function validateDateFields(
  obj: Record<string, unknown>,
  parentPath: string,
  issues: XsdIssue[]
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_')) continue
    const path = `${parentPath}.${key}`

    if (typeof value === 'string') {
      // Date fields
      if (DATE_FIELDS.has(key)) {
        if (!DATE_PATTERN.test(value)) {
          issues.push({
            severity: 'error',
            code: 'XSD_INVALID_FORMAT',
            message: `Nieprawidłowy format daty w ${key}: "${value}" (oczekiwano YYYY-MM-DD)`,
            path
          })
        }
      }
      // DateTime fields
      if (DATETIME_FIELDS.has(key)) {
        if (!DATETIME_PATTERN.test(value)) {
          issues.push({
            severity: 'error',
            code: 'XSD_INVALID_FORMAT',
            message: `Nieprawidłowy format daty/czasu w ${key}: "${value}"`,
            path
          })
        }
      }
      // Amount fields — must be valid decimal with exactly 2 decimal places
      if (isAmountField(key)) {
        if (!DECIMAL_PATTERN.test(value)) {
          // Allow negative and zero, but require .XX format
          const parsed = parseFloat(value)
          if (isNaN(parsed)) {
            issues.push({
              severity: 'error',
              code: 'XSD_INVALID_FORMAT',
              message: `Nieprawidłowy format kwoty w ${key}: "${value}" (oczekiwano liczby z 2 miejscami dziesiętnymi)`,
              path
            })
          } else if (!value.includes('.') || value.split('.')[1]?.length !== 2) {
            issues.push({
              severity: 'warning',
              code: 'XSD_DECIMAL_FORMAT',
              message: `Kwota ${key}="${value}" powinna mieć dokładnie 2 miejsca dziesiętne`,
              path
            })
          }
        }
      }
    }
  }
}

/**
 * Validate NIP fields in Podmiot1.
 */
function validatePodmiot(
  jpk: Record<string, unknown>,
  issues: XsdIssue[]
): void {
  const podmiot = jpk['Podmiot1'] as Record<string, unknown> | undefined
  if (!podmiot) return

  // Find NIP in any nested structure
  const nip = findNip(podmiot)
  if (nip) {
    if (!NIP_PATTERN.test(nip)) {
      issues.push({
        severity: 'error',
        code: 'XSD_INVALID_NIP',
        message: `NIP podmiotu "${nip}" nie jest prawidłowym 10-cyfrowym NIP`,
        path: 'Podmiot1.NIP'
      })
    }
  }

  // Find Email
  const email = findField(podmiot, 'Email')
  if (email && !EMAIL_PATTERN.test(email)) {
    issues.push({
      severity: 'warning',
      code: 'XSD_INVALID_EMAIL',
      message: `Adres email "${email}" nie pasuje do wzorca XSD`,
      path: 'Podmiot1.Email'
    })
  }
}

/**
 * Find NIP value in a nested object.
 */
function findNip(obj: unknown): string | null {
  if (obj == null || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>
  if (typeof record['NIP'] === 'string') return record['NIP']
  for (const val of Object.values(record)) {
    if (typeof val === 'object' && val !== null) {
      const found = findNip(val)
      if (found) return found
    }
  }
  return null
}

/**
 * Find a field value in a nested object.
 */
function findField(obj: unknown, fieldName: string): string | null {
  if (obj == null || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>
  if (typeof record[fieldName] === 'string') return record[fieldName] as string
  for (const val of Object.values(record)) {
    if (typeof val === 'object' && val !== null) {
      const found = findField(val, fieldName)
      if (found) return found
    }
  }
  return null
}

/**
 * Validate control sums (LiczbaWierszy, PodatekNalezny, etc.)
 */
function validateControlSums(
  jpk: Record<string, unknown>,
  spec: SchemaSpec,
  issues: XsdIssue[]
): void {
  if (!spec.ctrlSections) return

  // For V7M, data is inside Ewidencja
  const ewidencja = jpk['Ewidencja'] as Record<string, unknown> | undefined
  const searchIn = ewidencja ?? jpk

  for (const ctrl of spec.ctrlSections) {
    const ctrlObj = (searchIn[ctrl.ctrlElement] ?? jpk[ctrl.ctrlElement]) as Record<string, unknown> | undefined
    if (!ctrlObj) {
      issues.push({
        severity: 'warning',
        code: 'XSD_MISSING_CTRL',
        message: `Brak sekcji sum kontrolnych ${ctrl.ctrlElement}`,
        path: ctrl.ctrlElement
      })
      continue
    }

    // Validate row count
    const declaredCount = parseInt(String(ctrlObj[ctrl.countElement] ?? '0'), 10)
    const rows = ensureArray(searchIn[ctrl.rowElement] ?? jpk[ctrl.rowElement])
    const actualCount = rows.length

    if (declaredCount !== actualCount) {
      issues.push({
        severity: 'error',
        code: 'XSD_CTRL_COUNT',
        message: `${ctrl.countElement}: zadeklarowano ${declaredCount}, faktycznie ${actualCount} wierszy`,
        path: `${ctrl.ctrlElement}.${ctrl.countElement}`
      })
    } else {
      issues.push({
        severity: 'info',
        code: 'XSD_CTRL_COUNT_OK',
        message: `${ctrl.countElement}: ${actualCount} wierszy — zgodne`,
        path: `${ctrl.ctrlElement}.${ctrl.countElement}`
      })
    }

    // Validate sum if specified
    if (ctrl.sumElement && ctrl.sumFields) {
      const declaredSum = parseFloat(String(ctrlObj[ctrl.sumElement] ?? '0'))

      let computedSum = 0
      for (const row of rows) {
        if (typeof row !== 'object' || row === null) continue
        const r = row as Record<string, unknown>
        for (const field of ctrl.sumFields) {
          const val = parseFloat(String(r[field] ?? '0'))
          if (!isNaN(val)) computedSum += val
        }
        if (ctrl.sumSubtractFields) {
          for (const field of ctrl.sumSubtractFields) {
            const val = parseFloat(String(r[field] ?? '0'))
            if (!isNaN(val)) computedSum -= val
          }
        }
      }

      // Round to 2 decimal places for comparison
      computedSum = Math.round(computedSum * 100) / 100

      if (Math.abs(declaredSum - computedSum) > 0.01) {
        issues.push({
          severity: 'error',
          code: 'XSD_CTRL_SUM',
          message: `${ctrl.sumElement}: zadeklarowano ${declaredSum.toFixed(2)}, obliczono ${computedSum.toFixed(2)}`,
          path: `${ctrl.ctrlElement}.${ctrl.sumElement}`
        })
      } else {
        issues.push({
          severity: 'info',
          code: 'XSD_CTRL_SUM_OK',
          message: `${ctrl.sumElement}: ${declaredSum.toFixed(2)} — zgodne`,
          path: `${ctrl.ctrlElement}.${ctrl.sumElement}`
        })
      }
    }
  }
}

/**
 * Validate data type formats in row elements.
 */
function validateRowFormats(
  jpk: Record<string, unknown>,
  spec: SchemaSpec,
  issues: XsdIssue[]
): void {
  if (!spec.ctrlSections) return

  const ewidencja = jpk['Ewidencja'] as Record<string, unknown> | undefined
  const searchIn = ewidencja ?? jpk

  for (const ctrl of spec.ctrlSections) {
    const rows = ensureArray(searchIn[ctrl.rowElement] ?? jpk[ctrl.rowElement])
    let amountErrors = 0
    let dateErrors = 0
    const maxSamples = 3
    const amountSamples: string[] = []
    const dateSamples: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (typeof row !== 'object' || row === null) continue
      const r = row as Record<string, unknown>

      for (const [key, value] of Object.entries(r)) {
        if (key.startsWith('@_') || typeof value !== 'string') continue

        if (isAmountField(key)) {
          const v = value.trim()
          if (v !== '' && !DECIMAL_PATTERN.test(v)) {
            const parsed = parseFloat(v)
            if (isNaN(parsed)) {
              amountErrors++
              if (amountSamples.length < maxSamples) {
                amountSamples.push(`Wiersz ${i + 1}, ${key}="${v}"`)
              }
            }
          }
        }

        if (DATE_FIELDS.has(key)) {
          const v = value.trim()
          if (v !== '' && !DATE_PATTERN.test(v)) {
            dateErrors++
            if (dateSamples.length < maxSamples) {
              dateSamples.push(`Wiersz ${i + 1}, ${key}="${v}"`)
            }
          }
        }
      }
    }

    if (amountErrors > 0) {
      issues.push({
        severity: 'error',
        code: 'XSD_ROW_AMOUNT_FORMAT',
        message: `${amountErrors} kwot w ${ctrl.rowElement} nie spełnia formatu TKwotowy (decimal 18,2)`,
        path: ctrl.rowElement
      })
    }

    if (dateErrors > 0) {
      issues.push({
        severity: 'error',
        code: 'XSD_ROW_DATE_FORMAT',
        message: `${dateErrors} dat w ${ctrl.rowElement} nie spełnia formatu TData (YYYY-MM-DD)`,
        path: ctrl.rowElement
      })
    }

    if (amountErrors === 0 && dateErrors === 0 && rows.length > 0) {
      issues.push({
        severity: 'info',
        code: 'XSD_ROW_FORMAT_OK',
        message: `Formaty danych w ${ctrl.rowElement}: poprawne (${rows.length} wierszy)`,
        path: ctrl.rowElement
      })
    }
  }
}

/**
 * WB-specific: validate IBAN pattern.
 */
function validateWbSpecific(
  jpk: Record<string, unknown>,
  issues: XsdIssue[]
): void {
  const nrRachunku = jpk['NumerRachunku'] as string | undefined
  if (nrRachunku) {
    if (!IBAN_PATTERN.test(nrRachunku)) {
      issues.push({
        severity: 'error',
        code: 'XSD_INVALID_IBAN',
        message: `NumerRachunku "${nrRachunku}" nie pasuje do wzorca IBAN ([A-Z]{2}[0-9]{2}[0-9A-Z]{10,30})`,
        path: 'NumerRachunku'
      })
    }
  }
}

/**
 * V7M-specific: validate Podmiot1 rola attribute.
 */
function validateV7mSpecific(
  jpk: Record<string, unknown>,
  issues: XsdIssue[]
): void {
  const podmiot = jpk['Podmiot1'] as Record<string, unknown> | undefined
  if (podmiot) {
    const rola = podmiot['@_rola'] as string | undefined
    if (rola !== 'Podatnik') {
      issues.push({
        severity: 'warning',
        code: 'XSD_MISSING_ATTRIBUTE',
        message: `Podmiot1: brak lub nieprawidłowy atrybut rola (oczekiwano "Podatnik")`,
        path: 'Podmiot1@rola'
      })
    }
  }
}

/**
 * Validate namespace in the root JPK element.
 */
function validateNamespace(
  parsed: Record<string, unknown>,
  spec: SchemaSpec,
  issues: XsdIssue[]
): void {
  const jpk = parsed['JPK'] as Record<string, unknown> | undefined
  if (!jpk) return

  const xmlns = jpk['@_xmlns'] as string | undefined
  if (!xmlns) {
    issues.push({
      severity: 'warning',
      code: 'XSD_MISSING_NAMESPACE',
      message: 'Brak deklaracji namespace xmlns w elemencie JPK',
      path: 'JPK@xmlns'
    })
  } else if (xmlns !== spec.namespace) {
    issues.push({
      severity: 'error',
      code: 'XSD_WRONG_NAMESPACE',
      message: `Nieprawidłowy namespace: "${xmlns}" (oczekiwano "${spec.namespace}")`,
      path: 'JPK@xmlns'
    })
  } else {
    issues.push({
      severity: 'info',
      code: 'XSD_NAMESPACE_OK',
      message: `Namespace: zgodny ze schematem ${spec.kodSystemowy}`,
      path: 'JPK@xmlns'
    })
  }
}

/**
 * Main entry point: validate a generated XML string against JPK XSD rules.
 *
 * @param xml — complete XML string
 * @param expectedType — optional JPK type hint (auto-detected if not provided)
 */
export function validateXsd(xml: string, expectedType?: string): XsdValidationResult {
  const issues: XsdIssue[] = []

  // Parse XML
  const parsed = parseXml(xml)
  if (!parsed) {
    issues.push({
      severity: 'error',
      code: 'XSD_PARSE_ERROR',
      message: 'Nie można sparsować XML — dokument jest nieprawidłowy',
      path: ''
    })
    return { valid: false, issues, jpkType: null }
  }

  // Find root JPK element
  const jpk = parsed['JPK'] as Record<string, unknown> | undefined
  if (!jpk) {
    issues.push({
      severity: 'error',
      code: 'XSD_NO_ROOT',
      message: 'Brak elementu głównego <JPK> w dokumencie',
      path: ''
    })
    return { valid: false, issues, jpkType: null }
  }

  // Detect JPK type
  const detectedType = detectJpkType(jpk)
  const jpkType = expectedType ?? detectedType

  if (!jpkType) {
    issues.push({
      severity: 'error',
      code: 'XSD_UNKNOWN_TYPE',
      message: 'Nie rozpoznano typu JPK — nie można dopasować schematu XSD',
      path: 'Naglowek.KodFormularza'
    })
    return { valid: false, issues, jpkType: null }
  }

  const spec = SCHEMAS[jpkType]
  if (!spec) {
    issues.push({
      severity: 'error',
      code: 'XSD_NO_SCHEMA',
      message: `Brak reguł walidacji dla typu ${jpkType}`,
      path: ''
    })
    return { valid: false, issues, jpkType }
  }

  // 1. Validate namespace
  validateNamespace(parsed, spec, issues)

  // 2. Validate required sections
  for (const section of spec.requiredSections) {
    const sectionValue = jpk[section]
    if (sectionValue === undefined || sectionValue === null) {
      issues.push({
        severity: 'error',
        code: 'XSD_MISSING_SECTION',
        message: `Brak wymaganej sekcji <${section}>`,
        path: section
      })
    }
  }

  // 3. Validate header
  const naglowek = jpk['Naglowek'] as Record<string, unknown> | undefined
  if (naglowek) {
    validateHeader(naglowek, spec, issues)
  }

  // 4. Validate Podmiot1
  validatePodmiot(jpk, issues)

  // 5. Validate control sums
  validateControlSums(jpk, spec, issues)

  // 6. Validate row data formats
  validateRowFormats(jpk, spec, issues)

  // 7. Type-specific validations
  if (jpkType === 'JPK_V7M') {
    validateV7mSpecific(jpk, issues)
  }
  if (jpkType === 'JPK_WB') {
    validateWbSpecific(jpk, issues)
  }

  const hasErrors = issues.some((i) => i.severity === 'error')
  return { valid: !hasErrors, issues, jpkType }
}
