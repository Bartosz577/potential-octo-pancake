import { create } from 'zustand'
import type { ColumnMapping, MappingResult } from '../../../core/mapping/AutoMapper'
import { autoMap } from '../../../core/mapping/AutoMapper'
import { getFieldDefinitions } from '../../../core/mapping/JpkFieldDefinitions'
import { findProfile, applyProfile } from '../../../core/mapping/SystemProfiles'
import type { ParsedFile } from '../types'
import { parsedFileToRawSheet } from '../bridge/PipelineBridge'

export interface SavedMappingProfile {
  id: string
  name: string
  jpkType: string
  subType: string
  mappings: ColumnMapping[]
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

interface MappingState {
  activeMappings: Record<string, ColumnMapping[]>
  autoMapResults: Record<string, MappingResult>
  savedProfiles: SavedMappingProfile[]

  runAutoMap: (file: ParsedFile) => void
  updateMapping: (fileId: string, mapping: ColumnMapping) => void
  removeMapping: (fileId: string, sourceColumn: number) => void
  saveProfile: (name: string, fileId: string, jpkType: string, subType: string) => void
  loadProfile: (profileId: string, fileId: string) => void
  clearMappings: () => void
}

export const useMappingStore = create<MappingState>((set, get) => ({
  activeMappings: {},
  autoMapResults: {},
  savedProfiles: loadSavedProfiles(),

  runAutoMap: (file: ParsedFile) => {
    const sheet = parsedFileToRawSheet(file)

    // Try known system profile first (NAMOS, ESO → 100% confidence positional mapping)
    const profile = findProfile(file.system, file.jpkType, file.subType)
    let result: MappingResult

    if (profile) {
      const profileResult = applyProfile(sheet)
      if (profileResult) {
        result = profileResult
      } else {
        // Profile found but applyProfile failed — fall back to autoMap
        const fields = getFieldDefinitions(file.jpkType, file.subType)
        result = autoMap(sheet, fields)
      }
    } else {
      // No known profile — use header-based heuristic autoMap
      const fields = getFieldDefinitions(file.jpkType, file.subType)
      result = autoMap(sheet, fields)
    }

    set((state) => ({
      autoMapResults: { ...state.autoMapResults, [file.id]: result },
      activeMappings: { ...state.activeMappings, [file.id]: result.mappings }
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

  saveProfile: (name: string, fileId: string, jpkType: string, subType: string) => {
    const mappings = get().activeMappings[fileId] || []
    const profile: SavedMappingProfile = {
      id: `profile_${Date.now()}`,
      name,
      jpkType,
      subType,
      mappings,
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
      activeMappings: { ...state.activeMappings, [fileId]: [...profile.mappings] }
    }))
  },

  clearMappings: () => {
    set({ activeMappings: {}, autoMapResults: {} })
  }
}))
