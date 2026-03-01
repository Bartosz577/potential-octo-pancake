import { create } from 'zustand'
import type { ColumnMapping, MappingResult } from '../../../core/mapping/AutoMapper'
import { autoMap } from '../../../core/mapping/AutoMapper'
import { getFieldDefinitions } from '../../../core/mapping/JpkFieldDefinitions'
import { applyProfile } from '../../../core/mapping/SystemProfiles'
import type { ParsedFile } from '../types'
import { parsedFileToRawSheet } from '../bridge/PipelineBridge'

// Transform configuration types
export type DateFormatOption = 'auto' | 'DD.MM.YYYY' | 'DD-MM-YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'YYYY.MM.DD' | 'YYYYMMDD'
export type DecimalSeparatorOption = 'auto' | 'comma' | 'dot'
export type NipFormatOption = 'auto' | 'with-dashes' | 'without'

export interface TransformConfig {
  dateFormat: DateFormatOption
  decimalSeparator: DecimalSeparatorOption
  nipFormat: NipFormatOption
}

export const DEFAULT_TRANSFORM_CONFIG: TransformConfig = {
  dateFormat: 'auto',
  decimalSeparator: 'auto',
  nipFormat: 'auto'
}

export interface SavedMappingProfile {
  id: string
  name: string
  jpkType: string
  subType: string
  mappings: ColumnMapping[]
  transformConfig?: TransformConfig
  createdAt: string
}

const PROFILES_KEY = 'jpk-mapping-profiles'

function loadSavedProfiles(): SavedMappingProfile[] {
  try {
    const data = localStorage.getItem(PROFILES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function persistProfiles(profiles: SavedMappingProfile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

/** Info about a matched system profile for display in UI */
export interface MatchedProfileInfo {
  /** Profile display name (e.g. "NAMOS → JPK_V7M Sprzedaż") */
  profileName: string
  /** Original system from profile definition */
  profileSystem: string
  /** Actual system from file data */
  fileSystem: string
}

interface MappingState {
  activeMappings: Record<string, ColumnMapping[]>
  autoMapResults: Record<string, MappingResult>
  matchedProfiles: Record<string, MatchedProfileInfo>
  savedProfiles: SavedMappingProfile[]
  transformConfigs: Record<string, TransformConfig>

  runAutoMap: (file: ParsedFile) => void
  updateMapping: (fileId: string, mapping: ColumnMapping) => void
  removeMapping: (fileId: string, sourceColumn: number) => void
  setTransformConfig: (fileId: string, config: TransformConfig) => void
  saveProfile: (name: string, fileId: string, jpkType: string, subType: string) => void
  loadProfile: (profileId: string, fileId: string) => void
  deleteProfile: (profileId: string) => void
  clearMappings: () => void
}

export const useMappingStore = create<MappingState>((set, get) => ({
  activeMappings: {},
  autoMapResults: {},
  matchedProfiles: {},
  savedProfiles: loadSavedProfiles(),
  transformConfigs: {},

  runAutoMap: (file: ParsedFile) => {
    const sheet = parsedFileToRawSheet(file)

    // Try structure-based profile matching (jpkType + subType, ignoring system name)
    const profileMatch = applyProfile(sheet)
    let result: MappingResult
    let matchedProfile: MatchedProfileInfo | undefined

    if (profileMatch) {
      result = profileMatch.result
      matchedProfile = {
        profileName: profileMatch.profile.name,
        profileSystem: profileMatch.profile.system,
        fileSystem: file.system
      }
    } else {
      // No matching profile — use header-based heuristic autoMap
      const fields = getFieldDefinitions(file.jpkType, file.subType)
      result = autoMap(sheet, fields)
    }

    set((state) => ({
      autoMapResults: { ...state.autoMapResults, [file.id]: result },
      activeMappings: { ...state.activeMappings, [file.id]: result.mappings },
      matchedProfiles: matchedProfile
        ? { ...state.matchedProfiles, [file.id]: matchedProfile }
        : state.matchedProfiles
    }))
  },

  updateMapping: (fileId: string, mapping: ColumnMapping) => {
    set((state) => {
      const current = state.activeMappings[fileId] || []
      const filtered = current.filter(
        (m) => m.sourceColumn !== mapping.sourceColumn && m.targetField !== mapping.targetField
      )
      return {
        activeMappings: { ...state.activeMappings, [fileId]: [...filtered, mapping] }
      }
    })
  },

  removeMapping: (fileId: string, sourceColumn: number) => {
    set((state) => {
      const current = state.activeMappings[fileId] || []
      return {
        activeMappings: {
          ...state.activeMappings,
          [fileId]: current.filter((m) => m.sourceColumn !== sourceColumn)
        }
      }
    })
  },

  setTransformConfig: (fileId: string, config: TransformConfig) => {
    set((state) => ({
      transformConfigs: { ...state.transformConfigs, [fileId]: config }
    }))
  },

  saveProfile: (name: string, fileId: string, jpkType: string, subType: string) => {
    const mappings = get().activeMappings[fileId] || []
    const transformConfig = get().transformConfigs[fileId]
    const profile: SavedMappingProfile = {
      id: `profile_${Date.now()}`,
      name,
      jpkType,
      subType,
      mappings,
      transformConfig,
      createdAt: new Date().toISOString()
    }
    set((state) => {
      const updated = [...state.savedProfiles, profile]
      persistProfiles(updated)
      return { savedProfiles: updated }
    })
  },

  loadProfile: (profileId: string, fileId: string) => {
    const profile = get().savedProfiles.find((p) => p.id === profileId)
    if (!profile) return
    set((state) => ({
      activeMappings: { ...state.activeMappings, [fileId]: [...profile.mappings] },
      transformConfigs: profile.transformConfig
        ? { ...state.transformConfigs, [fileId]: profile.transformConfig }
        : state.transformConfigs
    }))
  },

  deleteProfile: (profileId: string) => {
    set((state) => {
      const updated = state.savedProfiles.filter((p) => p.id !== profileId)
      persistProfiles(updated)
      return { savedProfiles: updated }
    })
  },

  clearMappings: () => {
    set({ activeMappings: {}, autoMapResults: {}, matchedProfiles: {}, transformConfigs: {} })
  }
}))
