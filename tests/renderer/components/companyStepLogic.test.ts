import { describe, it, expect } from 'vitest'
import {
  getDetectedTypes,
  computeSectionFlags,
  computeCanProceed
} from '../../../src/renderer/src/components/steps/companyStepLogic'
import type { CompanyData, PeriodData } from '../../../src/renderer/src/stores/companyStore'
import type { JpkType } from '../../../src/renderer/src/types'

// Valid NIP with correct checksum: 1234563218
const VALID_NIP = '1234563218'
const INVALID_NIP = '1234567890'

function makeCompany(overrides: Partial<CompanyData> = {}): CompanyData {
  return {
    nip: VALID_NIP,
    fullName: 'Test Sp. z o.o.',
    regon: '',
    kodUrzedu: '1234',
    email: '',
    ...overrides
  }
}

function makePeriod(overrides: Partial<PeriodData> = {}): PeriodData {
  return {
    year: 2025,
    month: 6,
    celZlozenia: 1,
    ...overrides
  }
}

function makePeriodGetter(periods: Partial<Record<JpkType, PeriodData>> = {}) {
  return (t: JpkType): PeriodData => periods[t] ?? makePeriod()
}

describe('getDetectedTypes', () => {
  it('returns empty array when no files', () => {
    expect(getDetectedTypes([])).toEqual([])
  })

  it('extracts unique jpkType from files', () => {
    const files = [
      { jpkType: 'V7M' as JpkType },
      { jpkType: 'FA' as JpkType },
      { jpkType: 'V7M' as JpkType }
    ]
    const result = getDetectedTypes(files)
    expect(result).toHaveLength(2)
    expect(result).toContain('V7M')
    expect(result).toContain('FA')
  })

  it('deduplicates types correctly', () => {
    const files = [
      { jpkType: 'WB' as JpkType },
      { jpkType: 'WB' as JpkType },
      { jpkType: 'WB' as JpkType }
    ]
    expect(getDetectedTypes(files)).toEqual(['WB'])
  })

  it('handles all different types', () => {
    const files = [
      { jpkType: 'V7M' as JpkType },
      { jpkType: 'FA' as JpkType },
      { jpkType: 'MAG' as JpkType },
      { jpkType: 'WB' as JpkType }
    ]
    const result = getDetectedTypes(files)
    expect(result).toHaveLength(4)
  })
})

describe('computeSectionFlags', () => {
  it('showAll === true when detectedTypes is empty (no files)', () => {
    const flags = computeSectionFlags([])
    expect(flags.showAll).toBe(true)
  })

  it('all section flags are true when showAll', () => {
    const flags = computeSectionFlags([])
    expect(flags.hasV7).toBe(true)
    expect(flags.hasFA).toBe(true)
    expect(flags.hasMAG).toBe(true)
    expect(flags.hasWB).toBe(true)
  })

  it('showAll === false when files detected', () => {
    const flags = computeSectionFlags(['V7M'])
    expect(flags.showAll).toBe(false)
  })

  it('hasV7 true only when V7M detected', () => {
    expect(computeSectionFlags(['V7M']).hasV7).toBe(true)
    expect(computeSectionFlags(['FA']).hasV7).toBe(false)
  })

  it('hasFA true when FA or FA_RR detected', () => {
    expect(computeSectionFlags(['FA']).hasFA).toBe(true)
    expect(computeSectionFlags(['FA_RR']).hasFA).toBe(true)
    expect(computeSectionFlags(['V7M']).hasFA).toBe(false)
  })

  it('hasMAG true only when MAG detected', () => {
    expect(computeSectionFlags(['MAG']).hasMAG).toBe(true)
    expect(computeSectionFlags(['V7M']).hasMAG).toBe(false)
  })

  it('hasWB true only when WB detected', () => {
    expect(computeSectionFlags(['WB']).hasWB).toBe(true)
    expect(computeSectionFlags(['V7M']).hasWB).toBe(false)
  })
})

describe('computeCanProceed', () => {
  it('returns false when NIP is invalid', () => {
    const result = computeCanProceed({
      company: makeCompany({ nip: INVALID_NIP }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('returns false when NIP is empty', () => {
    const result = computeCanProceed({
      company: makeCompany({ nip: '' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('returns false when NIP is too short', () => {
    const result = computeCanProceed({
      company: makeCompany({ nip: '12345' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('returns false when fullName is empty', () => {
    const result = computeCanProceed({
      company: makeCompany({ fullName: '' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('returns false when fullName is whitespace only', () => {
    const result = computeCanProceed({
      company: makeCompany({ fullName: '   ' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('returns false when hasV7 and kodUrzedu is not 4 chars', () => {
    const result = computeCanProceed({
      company: makeCompany({ kodUrzedu: '12' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('returns false when hasV7 and kodUrzedu is empty', () => {
    const result = computeCanProceed({
      company: makeCompany({ kodUrzedu: '' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('returns false when hasV7 and kodUrzedu is 5 chars', () => {
    const result = computeCanProceed({
      company: makeCompany({ kodUrzedu: '12345' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(false)
  })

  it('does not require kodUrzedu 4 chars when no V7M type', () => {
    const result = computeCanProceed({
      company: makeCompany({ kodUrzedu: '' }),
      typesToValidate: ['FA'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        FA: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(true)
  })

  it('returns true when hasV7, NIP ok, fullName ok, kodUrzedu 4 chars, period filled', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        V7M: makePeriod({ year: 2025, month: 6 })
      })
    })
    expect(result).toBe(true)
  })

  it('returns true for V7K with quarter filled', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7K',
      getPeriod: makePeriodGetter({
        V7M: makePeriod({ year: 2025, quarter: 2 })
      })
    })
    expect(result).toBe(true)
  })

  it('returns false for V7K without quarter', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7K',
      getPeriod: makePeriodGetter({
        V7M: makePeriod({ year: 2025, quarter: undefined })
      })
    })
    expect(result).toBe(false)
  })

  it('returns false when hasWB and numerRachunku is missing', () => {
    const result = computeCanProceed({
      company: makeCompany({ numerRachunku: undefined }),
      typesToValidate: ['WB'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        WB: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(false)
  })

  it('returns false when hasWB and numerRachunku is empty string', () => {
    const result = computeCanProceed({
      company: makeCompany({ numerRachunku: '' }),
      typesToValidate: ['WB'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        WB: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(false)
  })

  it('returns false when hasWB and numerRachunku is whitespace', () => {
    const result = computeCanProceed({
      company: makeCompany({ numerRachunku: '   ' }),
      typesToValidate: ['WB'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        WB: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(false)
  })

  it('returns true when hasWB and numerRachunku is filled', () => {
    const result = computeCanProceed({
      company: makeCompany({ numerRachunku: 'PL12345678901234567890123456' }),
      typesToValidate: ['WB'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        WB: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(true)
  })

  it('returns false when celZlozenia === 2 and numerKorekty is missing', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        V7M: makePeriod({ celZlozenia: 2, numerKorekty: undefined })
      })
    })
    expect(result).toBe(false)
  })

  it('returns true when celZlozenia === 2 and numerKorekty is provided', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        V7M: makePeriod({ celZlozenia: 2, numerKorekty: 1 })
      })
    })
    expect(result).toBe(true)
  })

  it('returns false when celZlozenia === 2 for non-V7M type and numerKorekty missing', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['FA'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        FA: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31', celZlozenia: 2, numerKorekty: undefined })
      })
    })
    expect(result).toBe(false)
  })

  it('returns false when non-V7M type and dataOd is missing', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['FA'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        FA: makePeriod({ dataOd: undefined, dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(false)
  })

  it('returns false when non-V7M type and dataDo is missing', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['FA'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        FA: makePeriod({ dataOd: '2025-01-01', dataDo: undefined })
      })
    })
    expect(result).toBe(false)
  })

  it('returns false when non-V7M type and both dataOd and dataDo are missing', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['FA'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        FA: makePeriod({ dataOd: undefined, dataDo: undefined })
      })
    })
    expect(result).toBe(false)
  })

  it('returns true for non-V7M type with dataOd and dataDo filled', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['FA'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        FA: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(true)
  })

  it('validates all types in typesToValidate — mixed V7M + WB', () => {
    // V7M ok, WB missing numerRachunku → false
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['V7M', 'WB'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        V7M: makePeriod({ year: 2025, month: 6 }),
        WB: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(false)
  })

  it('returns true for mixed V7M + WB when all requirements met', () => {
    const result = computeCanProceed({
      company: makeCompany({ numerRachunku: 'PL123' }),
      typesToValidate: ['V7M', 'WB'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        V7M: makePeriod({ year: 2025, month: 6 }),
        WB: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' })
      })
    })
    expect(result).toBe(true)
  })

  it('returns false when one of multiple non-V7M types has missing dates', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: ['FA', 'MAG'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter({
        FA: makePeriod({ dataOd: '2025-01-01', dataDo: '2025-01-31' }),
        MAG: makePeriod({ dataOd: undefined, dataDo: undefined })
      })
    })
    expect(result).toBe(false)
  })

  it('returns true with empty typesToValidate (no types to check)', () => {
    const result = computeCanProceed({
      company: makeCompany(),
      typesToValidate: [],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(true)
  })

  it('accepts NIP with dashes (normalizes internally)', () => {
    const result = computeCanProceed({
      company: makeCompany({ nip: '123-456-32-18' }),
      typesToValidate: ['V7M'],
      jpkSubtype: 'V7M',
      getPeriod: makePeriodGetter()
    })
    expect(result).toBe(true)
  })
})
