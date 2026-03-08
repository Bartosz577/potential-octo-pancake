import type { JpkType } from '../../types'
import type { CompanyData, PeriodData } from '../../stores/companyStore'
import type { JpkSubtype } from '../../stores/appStore'
import { validatePolishNip, normalizeNip } from '../../utils/nipValidator'

/** Extract unique JPK types from imported files */
export function getDetectedTypes(files: { jpkType: JpkType }[]): JpkType[] {
  const types = new Set<JpkType>()
  for (const f of files) {
    if (f.jpkType) types.add(f.jpkType)
  }
  return Array.from(types)
}

/** Compute section visibility flags based on detected types */
export function computeSectionFlags(detectedTypes: JpkType[]) {
  const showAll = detectedTypes.length === 0
  return {
    showAll,
    hasV7: showAll || detectedTypes.includes('V7M'),
    hasFA: showAll || detectedTypes.includes('FA') || detectedTypes.includes('FA_RR'),
    hasMAG: showAll || detectedTypes.includes('MAG'),
    hasWB: showAll || detectedTypes.includes('WB')
  }
}

/** Pure validation: can the user proceed to the next step? */
export function computeCanProceed(params: {
  company: CompanyData
  typesToValidate: JpkType[]
  jpkSubtype: JpkSubtype
  getPeriod: (t: JpkType) => PeriodData
}): boolean {
  const { company, typesToValidate, jpkSubtype, getPeriod } = params

  // Base: NIP must be valid
  const nipNormalized = normalizeNip(company.nip)
  if (nipNormalized.length !== 10 || !validatePolishNip(nipNormalized)) return false

  // Base: fullName required
  if (company.fullName.trim().length === 0) return false

  const hasV7 = typesToValidate.includes('V7M')
  const hasWB = typesToValidate.includes('WB')

  // V7M: kodUrzedu must be exactly 4 chars
  if (hasV7 && company.kodUrzedu.trim().length !== 4) return false

  // Per-type period validation
  for (const t of typesToValidate) {
    const p = getPeriod(t)
    if (t === 'V7M') {
      if (!p.year) return false
      if (jpkSubtype === 'V7K') {
        if (!p.quarter) return false
      } else {
        if (!p.month) return false
      }
    } else {
      // All other types: dataOd + dataDo required
      if (!p.dataOd || !p.dataDo) return false
    }
    // Correction: numerKorekty required when celZlozenia === 2
    if (p.celZlozenia === 2 && !p.numerKorekty) return false
  }

  // WB: numerRachunku required
  if (hasWB && !company.numerRachunku?.trim()) return false

  return true
}
