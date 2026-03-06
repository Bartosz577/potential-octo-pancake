import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../src/renderer/src/stores/appStore'
import { useImportStore } from '../../src/renderer/src/stores/importStore'
import { useMappingStore } from '../../src/renderer/src/stores/mappingStore'
import { useCompanyStore } from '../../src/renderer/src/stores/companyStore'
import type { ParsedFile } from '../../src/renderer/src/types'

/**
 * Tests for the "Nowa konwersja" reset logic used by HistoryStep and ExportStep.
 * Simulates the same sequence of store calls that handleNewConversion performs.
 */
function simulateNewConversion(): void {
  useImportStore.getState().clearFiles()
  useMappingStore.getState().clearMappings()
  useAppStore.getState().setActiveJpkType('V7M')
  useAppStore.getState().setJpkSubtype('V7M')
  useAppStore.getState().setMode('conversion')
  useAppStore.getState().setValidationXml(null)
  useAppStore.getState().setCurrentStep(1)
}

const mockFile: ParsedFile = {
  id: 'file-1',
  name: 'test.csv',
  format: 'CSV',
  jpkType: 'JPK_FA',
  subType: 'Faktura',
  system: 'TestSystem',
  headers: ['A', 'B'],
  rows: [['1', '2']],
  allValues: [['A', 'B'], ['1', '2']],
  warnings: [],
  encoding: 'utf-8'
}

describe('New Conversion Reset', () => {
  beforeEach(() => {
    // Set up dirty state simulating a completed conversion
    useAppStore.setState({
      activeJpkType: 'FA',
      jpkSubtype: 'V7K',
      currentStep: 6,
      mode: 'validation',
      validationXml: '<xml>test</xml>',
      validationJpkLabel: 'JPK_FA'
    })
    useImportStore.getState().addFile(mockFile)
    useMappingStore.setState({
      activeMappings: { 'file-1': [{ sourceColumn: 0, targetField: 'NrFaktury', confidence: 1 }] },
      autoMapResults: {},
      matchedProfiles: {},
      transformConfigs: {}
    })
    useCompanyStore.setState({
      company: {
        fullName: 'Test Sp. z o.o.',
        nip: '1234567890',
        regon: '123456789',
        kodUrzedu: '0202',
        email: 'test@test.pl',
        phone: '123456789'
      },
      period: { year: 2025, month: 12, celZlozenia: 1 }
    })
  })

  it('resets appStore to default step 1', () => {
    simulateNewConversion()
    expect(useAppStore.getState().currentStep).toBe(1)
  })

  it('resets activeJpkType to V7M', () => {
    simulateNewConversion()
    expect(useAppStore.getState().activeJpkType).toBe('V7M')
  })

  it('resets jpkSubtype to V7M', () => {
    simulateNewConversion()
    expect(useAppStore.getState().jpkSubtype).toBe('V7M')
  })

  it('resets mode to conversion', () => {
    simulateNewConversion()
    expect(useAppStore.getState().mode).toBe('conversion')
  })

  it('clears validationXml', () => {
    simulateNewConversion()
    expect(useAppStore.getState().validationXml).toBeNull()
    expect(useAppStore.getState().validationJpkLabel).toBeNull()
  })

  it('clears imported files', () => {
    expect(useImportStore.getState().files).toHaveLength(1)
    simulateNewConversion()
    expect(useImportStore.getState().files).toHaveLength(0)
  })

  it('clears active mappings', () => {
    expect(Object.keys(useMappingStore.getState().activeMappings)).toHaveLength(1)
    simulateNewConversion()
    expect(useMappingStore.getState().activeMappings).toEqual({})
    expect(useMappingStore.getState().autoMapResults).toEqual({})
    expect(useMappingStore.getState().matchedProfiles).toEqual({})
    expect(useMappingStore.getState().transformConfigs).toEqual({})
  })

  it('preserves company data after reset', () => {
    simulateNewConversion()
    const { company } = useCompanyStore.getState()
    expect(company.fullName).toBe('Test Sp. z o.o.')
    expect(company.nip).toBe('1234567890')
    expect(company.kodUrzedu).toBe('0202')
  })

  it('preserves period data after reset', () => {
    simulateNewConversion()
    const { period } = useCompanyStore.getState()
    expect(period.year).toBe(2025)
    expect(period.month).toBe(12)
  })

  it('preserves saved mapping profiles after reset', () => {
    useMappingStore.setState({
      savedProfiles: [{
        id: 'profile_1',
        name: 'Test Profile',
        jpkType: 'JPK_FA',
        subType: 'Faktura',
        mappings: [{ sourceColumn: 0, targetField: 'NrFaktury', confidence: 1 }],
        createdAt: '2025-01-01T00:00:00.000Z'
      }]
    })
    simulateNewConversion()
    // clearMappings resets activeMappings but not savedProfiles
    expect(useMappingStore.getState().savedProfiles).toHaveLength(1)
    expect(useMappingStore.getState().savedProfiles[0].name).toBe('Test Profile')
  })
})
