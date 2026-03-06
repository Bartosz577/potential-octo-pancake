import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ColumnMapping, MappingResult } from '../../../src/core/mapping/AutoMapper'
import type { ParsedFile } from '../../../src/renderer/src/types'

// Mock the core dependencies before importing the store
vi.mock('../../../src/core/mapping/AutoMapper', () => ({
  autoMap: vi.fn()
}))

vi.mock('../../../src/core/mapping/JpkFieldDefinitions', () => ({
  getFieldDefinitions: vi.fn()
}))

vi.mock('../../../src/core/mapping/SystemProfiles', () => ({
  applyProfile: vi.fn()
}))

vi.mock('../../../src/renderer/src/bridge/PipelineBridge', () => ({
  parsedFileToRawSheet: vi.fn()
}))

// Import the mocked modules so we can control them
import { autoMap } from '../../../src/core/mapping/AutoMapper'
import { getFieldDefinitions } from '../../../src/core/mapping/JpkFieldDefinitions'
import { applyProfile } from '../../../src/core/mapping/SystemProfiles'
import { parsedFileToRawSheet } from '../../../src/renderer/src/bridge/PipelineBridge'
import {
  useMappingStore,
  DEFAULT_TRANSFORM_CONFIG
} from '../../../src/renderer/src/stores/mappingStore'
import type { TransformConfig } from '../../../src/renderer/src/stores/mappingStore'

const mockedAutoMap = vi.mocked(autoMap)
const mockedGetFieldDefinitions = vi.mocked(getFieldDefinitions)
const mockedApplyProfile = vi.mocked(applyProfile)
const mockedParsedFileToRawSheet = vi.mocked(parsedFileToRawSheet)

function makeParsedFile(overrides?: Partial<ParsedFile>): ParsedFile {
  return {
    id: 'file-1',
    filename: 'test.txt',
    system: 'NAMOS',
    jpkType: 'JPK_VDEK',
    subType: 'SprzedazWiersz',
    pointCode: '01',
    dateFrom: '2025-01-01',
    dateTo: '2025-01-31',
    rows: [['val1', 'val2'], ['val3', 'val4']],
    rowCount: 2,
    columnCount: 2,
    fileSize: 100,
    headers: ['Col1', 'Col2'],
    ...overrides
  }
}

function makeMapping(overrides?: Partial<ColumnMapping>): ColumnMapping {
  return {
    sourceColumn: 0,
    sourceHeader: 'Col1',
    targetField: 'DataSprzedazy',
    confidence: 1.0,
    method: 'exact',
    ...overrides
  }
}

const fakeSheet = {
  name: 'test.txt',
  headers: ['Col1', 'Col2'],
  rows: [
    { index: 0, cells: ['val1', 'val2'] },
    { index: 1, cells: ['val3', 'val4'] }
  ],
  metadata: { system: 'NAMOS', jpkType: 'JPK_VDEK', subType: 'SprzedazWiersz' }
}

describe('mappingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useMappingStore.setState({
      activeMappings: {},
      autoMapResults: {},
      matchedProfiles: {},
      savedProfiles: [],
      transformConfigs: {}
    })
  })

  describe('DEFAULT_TRANSFORM_CONFIG', () => {
    it('has auto defaults', () => {
      expect(DEFAULT_TRANSFORM_CONFIG).toEqual({
        dateFormat: 'auto',
        decimalSeparator: 'auto',
        nipFormat: 'auto'
      })
    })
  })

  describe('initial state', () => {
    it('has empty activeMappings', () => {
      expect(useMappingStore.getState().activeMappings).toEqual({})
    })

    it('has empty autoMapResults', () => {
      expect(useMappingStore.getState().autoMapResults).toEqual({})
    })

    it('has empty matchedProfiles', () => {
      expect(useMappingStore.getState().matchedProfiles).toEqual({})
    })

    it('has empty transformConfigs', () => {
      expect(useMappingStore.getState().transformConfigs).toEqual({})
    })
  })

  describe('runAutoMap', () => {
    it('uses applyProfile result when a system profile matches', () => {
      const mappings: ColumnMapping[] = [makeMapping()]
      const mappingResult: MappingResult = {
        mappings,
        unmappedFields: [],
        unmappedColumns: [1]
      }

      mockedParsedFileToRawSheet.mockReturnValue(fakeSheet as unknown as ReturnType<typeof parsedFileToRawSheet>)
      mockedApplyProfile.mockReturnValue({
        result: mappingResult,
        profile: {
          id: 'namos-v7m-sprzedaz',
          name: 'NAMOS -> JPK_V7M Sprzedaz',
          system: 'NAMOS',
          jpkType: 'JPK_VDEK',
          subType: 'SprzedazWiersz',
          columnMap: [],
          fields: []
        }
      })

      const file = makeParsedFile()
      useMappingStore.getState().runAutoMap(file)

      const state = useMappingStore.getState()
      expect(state.activeMappings['file-1']).toEqual(mappings)
      expect(state.autoMapResults['file-1']).toEqual(mappingResult)
      expect(state.matchedProfiles['file-1']).toEqual({
        profileName: 'NAMOS -> JPK_V7M Sprzedaz',
        profileSystem: 'NAMOS',
        fileSystem: 'NAMOS'
      })

      expect(mockedAutoMap).not.toHaveBeenCalled()
    })

    it('falls back to header-based autoMap when no profile matches', () => {
      const mappings: ColumnMapping[] = [
        makeMapping({ method: 'synonym', confidence: 0.8 })
      ]
      const mappingResult: MappingResult = {
        mappings,
        unmappedFields: ['NrKontrahenta'],
        unmappedColumns: []
      }

      mockedParsedFileToRawSheet.mockReturnValue(fakeSheet as unknown as ReturnType<typeof parsedFileToRawSheet>)
      mockedApplyProfile.mockReturnValue(null)
      mockedGetFieldDefinitions.mockReturnValue([])
      mockedAutoMap.mockReturnValue(mappingResult)

      const file = makeParsedFile({ system: 'UNKNOWN' })
      useMappingStore.getState().runAutoMap(file)

      const state = useMappingStore.getState()
      expect(state.activeMappings[file.id]).toEqual(mappings)
      expect(state.autoMapResults[file.id]).toEqual(mappingResult)
      // No profile matched, so matchedProfiles should not have this file
      expect(state.matchedProfiles[file.id]).toBeUndefined()

      expect(mockedGetFieldDefinitions).toHaveBeenCalledWith('JPK_VDEK', 'SprzedazWiersz')
      expect(mockedAutoMap).toHaveBeenCalled()
    })

    it('does not overwrite matchedProfiles for other files', () => {
      // Pre-set a matched profile for a different file
      useMappingStore.setState({
        matchedProfiles: {
          'other-file': {
            profileName: 'Other',
            profileSystem: 'ESO',
            fileSystem: 'ESO'
          }
        }
      })

      mockedParsedFileToRawSheet.mockReturnValue(fakeSheet as unknown as ReturnType<typeof parsedFileToRawSheet>)
      mockedApplyProfile.mockReturnValue(null)
      mockedGetFieldDefinitions.mockReturnValue([])
      mockedAutoMap.mockReturnValue({ mappings: [], unmappedFields: [], unmappedColumns: [] })

      useMappingStore.getState().runAutoMap(makeParsedFile())

      const state = useMappingStore.getState()
      expect(state.matchedProfiles['other-file']).toBeDefined()
    })
  })

  describe('updateMapping', () => {
    it('adds a mapping to an empty file', () => {
      const mapping = makeMapping()
      useMappingStore.getState().updateMapping('file-1', mapping)

      const mappings = useMappingStore.getState().activeMappings['file-1']
      expect(mappings).toHaveLength(1)
      expect(mappings[0]).toEqual(mapping)
    })

    it('replaces existing mapping by sourceColumn', () => {
      const original = makeMapping({ sourceColumn: 0, targetField: 'DataSprzedazy' })
      const replacement = makeMapping({ sourceColumn: 0, targetField: 'NrDokumentu' })

      useMappingStore.getState().updateMapping('file-1', original)
      useMappingStore.getState().updateMapping('file-1', replacement)

      const mappings = useMappingStore.getState().activeMappings['file-1']
      expect(mappings).toHaveLength(1)
      expect(mappings[0].targetField).toBe('NrDokumentu')
    })

    it('replaces existing mapping by targetField', () => {
      const m1 = makeMapping({ sourceColumn: 0, targetField: 'DataSprzedazy' })
      const m2 = makeMapping({ sourceColumn: 1, targetField: 'DataSprzedazy' })

      useMappingStore.getState().updateMapping('file-1', m1)
      useMappingStore.getState().updateMapping('file-1', m2)

      const mappings = useMappingStore.getState().activeMappings['file-1']
      expect(mappings).toHaveLength(1)
      expect(mappings[0].sourceColumn).toBe(1)
    })

    it('can add multiple mappings for different columns/fields', () => {
      const m1 = makeMapping({ sourceColumn: 0, targetField: 'DataSprzedazy' })
      const m2 = makeMapping({ sourceColumn: 1, targetField: 'NrDokumentu' })

      useMappingStore.getState().updateMapping('file-1', m1)
      useMappingStore.getState().updateMapping('file-1', m2)

      const mappings = useMappingStore.getState().activeMappings['file-1']
      expect(mappings).toHaveLength(2)
    })
  })

  describe('removeMapping', () => {
    it('removes a mapping by sourceColumn', () => {
      const m1 = makeMapping({ sourceColumn: 0, targetField: 'DataSprzedazy' })
      const m2 = makeMapping({ sourceColumn: 1, targetField: 'NrDokumentu' })

      useMappingStore.getState().updateMapping('file-1', m1)
      useMappingStore.getState().updateMapping('file-1', m2)
      useMappingStore.getState().removeMapping('file-1', 0)

      const mappings = useMappingStore.getState().activeMappings['file-1']
      expect(mappings).toHaveLength(1)
      expect(mappings[0].sourceColumn).toBe(1)
    })

    it('does nothing if sourceColumn not found', () => {
      const m1 = makeMapping({ sourceColumn: 0 })
      useMappingStore.getState().updateMapping('file-1', m1)
      useMappingStore.getState().removeMapping('file-1', 99)

      expect(useMappingStore.getState().activeMappings['file-1']).toHaveLength(1)
    })

    it('handles missing fileId gracefully (empty array)', () => {
      useMappingStore.getState().removeMapping('nonexistent', 0)
      expect(useMappingStore.getState().activeMappings['nonexistent']).toEqual([])
    })
  })

  describe('setTransformConfig', () => {
    it('sets transform config for a file', () => {
      const config: TransformConfig = {
        dateFormat: 'DD.MM.YYYY',
        decimalSeparator: 'comma',
        nipFormat: 'with-dashes'
      }
      useMappingStore.getState().setTransformConfig('file-1', config)

      expect(useMappingStore.getState().transformConfigs['file-1']).toEqual(config)
    })

    it('overwrites existing config', () => {
      useMappingStore.getState().setTransformConfig('file-1', DEFAULT_TRANSFORM_CONFIG)
      const newConfig: TransformConfig = {
        dateFormat: 'YYYY-MM-DD',
        decimalSeparator: 'dot',
        nipFormat: 'without'
      }
      useMappingStore.getState().setTransformConfig('file-1', newConfig)

      expect(useMappingStore.getState().transformConfigs['file-1']).toEqual(newConfig)
    })

    it('does not affect configs for other files', () => {
      const config1: TransformConfig = { dateFormat: 'DD.MM.YYYY', decimalSeparator: 'comma', nipFormat: 'auto' }
      const config2: TransformConfig = { dateFormat: 'YYYY-MM-DD', decimalSeparator: 'dot', nipFormat: 'without' }

      useMappingStore.getState().setTransformConfig('file-1', config1)
      useMappingStore.getState().setTransformConfig('file-2', config2)

      expect(useMappingStore.getState().transformConfigs['file-1']).toEqual(config1)
      expect(useMappingStore.getState().transformConfigs['file-2']).toEqual(config2)
    })
  })

  describe('saveProfile', () => {
    it('saves a profile from current mappings', () => {
      const mapping = makeMapping()
      useMappingStore.getState().updateMapping('file-1', mapping)
      useMappingStore.getState().saveProfile('My Profile', 'file-1', 'JPK_VDEK', 'SprzedazWiersz')

      const { savedProfiles } = useMappingStore.getState()
      expect(savedProfiles).toHaveLength(1)
      expect(savedProfiles[0].name).toBe('My Profile')
      expect(savedProfiles[0].jpkType).toBe('JPK_VDEK')
      expect(savedProfiles[0].subType).toBe('SprzedazWiersz')
      expect(savedProfiles[0].mappings).toHaveLength(1)
      expect(savedProfiles[0].id).toMatch(/^profile_/)
      expect(savedProfiles[0].createdAt).toBeTruthy()
    })

    it('includes transformConfig if set', () => {
      const config: TransformConfig = {
        dateFormat: 'DD.MM.YYYY',
        decimalSeparator: 'comma',
        nipFormat: 'auto'
      }
      useMappingStore.getState().updateMapping('file-1', makeMapping())
      useMappingStore.getState().setTransformConfig('file-1', config)
      useMappingStore.getState().saveProfile('Profile with config', 'file-1', 'JPK_VDEK', 'SprzedazWiersz')

      const { savedProfiles } = useMappingStore.getState()
      expect(savedProfiles[0].transformConfig).toEqual(config)
    })

    it('saves empty mappings if file has none', () => {
      useMappingStore.getState().saveProfile('Empty', 'file-1', 'JPK_FA', 'Faktura')

      const { savedProfiles } = useMappingStore.getState()
      expect(savedProfiles[0].mappings).toEqual([])
    })

    it('persists to localStorage', () => {
      useMappingStore.getState().saveProfile('Persisted', 'file-1', 'JPK_VDEK', 'SprzedazWiersz')

      const stored = localStorage.getItem('jpk-mapping-profiles')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Persisted')
    })

    it('can save multiple profiles', () => {
      useMappingStore.getState().saveProfile('Profile A', 'file-1', 'JPK_VDEK', 'SprzedazWiersz')
      useMappingStore.getState().saveProfile('Profile B', 'file-1', 'JPK_FA', 'Faktura')

      expect(useMappingStore.getState().savedProfiles).toHaveLength(2)
    })
  })

  describe('loadProfile', () => {
    it('loads mappings from a saved profile', () => {
      const mapping = makeMapping()
      useMappingStore.getState().updateMapping('file-1', mapping)
      useMappingStore.getState().saveProfile('LoadMe', 'file-1', 'JPK_VDEK', 'SprzedazWiersz')

      const profileId = useMappingStore.getState().savedProfiles[0].id

      // Load into a different file
      useMappingStore.getState().loadProfile(profileId, 'file-2')

      const mappings = useMappingStore.getState().activeMappings['file-2']
      expect(mappings).toHaveLength(1)
      expect(mappings[0].targetField).toBe('DataSprzedazy')
    })

    it('loads transformConfig if profile has one', () => {
      const config: TransformConfig = {
        dateFormat: 'DD.MM.YYYY',
        decimalSeparator: 'comma',
        nipFormat: 'auto'
      }
      useMappingStore.getState().updateMapping('file-1', makeMapping())
      useMappingStore.getState().setTransformConfig('file-1', config)
      useMappingStore.getState().saveProfile('WithConfig', 'file-1', 'JPK_VDEK', 'SprzedazWiersz')

      const profileId = useMappingStore.getState().savedProfiles[0].id
      useMappingStore.getState().loadProfile(profileId, 'file-2')

      expect(useMappingStore.getState().transformConfigs['file-2']).toEqual(config)
    })

    it('does not overwrite transformConfig if profile has none', () => {
      const existingConfig: TransformConfig = {
        dateFormat: 'YYYY-MM-DD',
        decimalSeparator: 'dot',
        nipFormat: 'without'
      }
      useMappingStore.getState().setTransformConfig('file-2', existingConfig)

      // Save a profile without transform config
      useMappingStore.getState().updateMapping('file-1', makeMapping())
      useMappingStore.getState().saveProfile('NoConfig', 'file-1', 'JPK_VDEK', 'SprzedazWiersz')

      const profileId = useMappingStore.getState().savedProfiles[0].id
      useMappingStore.getState().loadProfile(profileId, 'file-2')

      // Existing config should be preserved
      expect(useMappingStore.getState().transformConfigs['file-2']).toEqual(existingConfig)
    })

    it('does nothing if profile not found', () => {
      useMappingStore.getState().updateMapping('file-1', makeMapping())
      useMappingStore.getState().loadProfile('nonexistent-id', 'file-1')

      // Mappings should remain unchanged
      expect(useMappingStore.getState().activeMappings['file-1']).toHaveLength(1)
    })
  })

  describe('deleteProfile', () => {
    it('removes a profile by id', () => {
      // Mock Date.now to return unique values for each saveProfile call
      let now = 1000
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => now++)

      useMappingStore.getState().saveProfile('A', 'f1', 'JPK_VDEK', 'SprzedazWiersz')
      useMappingStore.getState().saveProfile('B', 'f1', 'JPK_FA', 'Faktura')

      const profiles = useMappingStore.getState().savedProfiles
      expect(profiles).toHaveLength(2)

      useMappingStore.getState().deleteProfile(profiles[0].id)

      const remaining = useMappingStore.getState().savedProfiles
      expect(remaining).toHaveLength(1)
      expect(remaining[0].name).toBe('B')

      spy.mockRestore()
    })

    it('persists deletion to localStorage', () => {
      useMappingStore.getState().saveProfile('ToDelete', 'f1', 'JPK_VDEK', 'SprzedazWiersz')
      const id = useMappingStore.getState().savedProfiles[0].id

      useMappingStore.getState().deleteProfile(id)

      const stored = JSON.parse(localStorage.getItem('jpk-mapping-profiles')!)
      expect(stored).toHaveLength(0)
    })

    it('does nothing if profile not found', () => {
      useMappingStore.getState().saveProfile('Keep', 'f1', 'JPK_VDEK', 'SprzedazWiersz')
      useMappingStore.getState().deleteProfile('nonexistent')

      expect(useMappingStore.getState().savedProfiles).toHaveLength(1)
    })
  })

  describe('clearMappings', () => {
    it('clears all mapping-related state', () => {
      // Set up state
      useMappingStore.getState().updateMapping('file-1', makeMapping())
      useMappingStore.getState().setTransformConfig('file-1', DEFAULT_TRANSFORM_CONFIG)
      useMappingStore.setState({
        autoMapResults: { 'file-1': { mappings: [], unmappedFields: [], unmappedColumns: [] } },
        matchedProfiles: {
          'file-1': { profileName: 'Test', profileSystem: 'NAMOS', fileSystem: 'NAMOS' }
        }
      })

      useMappingStore.getState().clearMappings()

      const state = useMappingStore.getState()
      expect(state.activeMappings).toEqual({})
      expect(state.autoMapResults).toEqual({})
      expect(state.matchedProfiles).toEqual({})
      expect(state.transformConfigs).toEqual({})
    })

    it('does not clear savedProfiles', () => {
      useMappingStore.getState().saveProfile('Preserved', 'f1', 'JPK_VDEK', 'SprzedazWiersz')
      useMappingStore.getState().clearMappings()

      expect(useMappingStore.getState().savedProfiles).toHaveLength(1)
    })
  })
})
