import { describe, it, expect } from 'vitest'
import {
  normalizeJpkType,
  jpkTypeFromFilename,
  jpkTypeToLabel,
  jpkTypeToXmlCode,
  getAllJpkTypes,
} from '../../../src/core/mapping/jpkTypeUtils'
import type { NormalizedJpkType } from '../../../src/core/mapping/jpkTypeUtils'

describe('jpkTypeUtils', () => {
  describe('normalizeJpkType', () => {
    describe('canonical short values', () => {
      it('normalizes V7M to type V7M with subtype V7M', () => {
        const result = normalizeJpkType('V7M')
        expect(result).toEqual({ type: 'V7M', subtype: 'V7M' })
      })

      it('normalizes V7K to type V7M with subtype V7K', () => {
        const result = normalizeJpkType('V7K')
        expect(result).toEqual({ type: 'V7M', subtype: 'V7K' })
      })

      it('normalizes FA to type FA with no subtype', () => {
        expect(normalizeJpkType('FA')).toEqual({ type: 'FA', subtype: null })
      })

      it('normalizes MAG to type MAG with no subtype', () => {
        expect(normalizeJpkType('MAG')).toEqual({ type: 'MAG', subtype: null })
      })

      it('normalizes WB to type WB with no subtype', () => {
        expect(normalizeJpkType('WB')).toEqual({ type: 'WB', subtype: null })
      })

      it('normalizes PKPIR to type PKPIR with no subtype', () => {
        expect(normalizeJpkType('PKPIR')).toEqual({ type: 'PKPIR', subtype: null })
      })

      it('normalizes EWP to type EWP with no subtype', () => {
        expect(normalizeJpkType('EWP')).toEqual({ type: 'EWP', subtype: null })
      })

      it('normalizes KR_PD to type KR_PD with no subtype', () => {
        expect(normalizeJpkType('KR_PD')).toEqual({ type: 'KR_PD', subtype: null })
      })

      it('normalizes ST to type ST with no subtype', () => {
        expect(normalizeJpkType('ST')).toEqual({ type: 'ST', subtype: null })
      })

      it('normalizes ST_KR to type ST_KR with no subtype', () => {
        expect(normalizeJpkType('ST_KR')).toEqual({ type: 'ST_KR', subtype: null })
      })

      it('normalizes FA_RR to type FA_RR with no subtype', () => {
        expect(normalizeJpkType('FA_RR')).toEqual({ type: 'FA_RR', subtype: null })
      })

      it('normalizes KR to type KR with no subtype', () => {
        expect(normalizeJpkType('KR')).toEqual({ type: 'KR', subtype: null })
      })
    })

    describe('JPK_ prefixed values', () => {
      it('normalizes JPK_V7M to type V7M with subtype V7M', () => {
        expect(normalizeJpkType('JPK_V7M')).toEqual({ type: 'V7M', subtype: 'V7M' })
      })

      it('normalizes JPK_V7K to type V7M with subtype V7K', () => {
        expect(normalizeJpkType('JPK_V7K')).toEqual({ type: 'V7M', subtype: 'V7K' })
      })

      it('normalizes JPK_VDEK to type V7M with no subtype', () => {
        expect(normalizeJpkType('JPK_VDEK')).toEqual({ type: 'V7M', subtype: null })
      })

      it('normalizes JPK_FA to type FA with no subtype', () => {
        expect(normalizeJpkType('JPK_FA')).toEqual({ type: 'FA', subtype: null })
      })

      it('normalizes JPK_MAG to type MAG with no subtype', () => {
        expect(normalizeJpkType('JPK_MAG')).toEqual({ type: 'MAG', subtype: null })
      })

      it('normalizes JPK_WB to type WB with no subtype', () => {
        expect(normalizeJpkType('JPK_WB')).toEqual({ type: 'WB', subtype: null })
      })

      it('normalizes JPK_PKPIR to type PKPIR with no subtype', () => {
        expect(normalizeJpkType('JPK_PKPIR')).toEqual({ type: 'PKPIR', subtype: null })
      })

      it('normalizes JPK_EWP to type EWP with no subtype', () => {
        expect(normalizeJpkType('JPK_EWP')).toEqual({ type: 'EWP', subtype: null })
      })

      it('normalizes JPK_KR_PD to type KR_PD with no subtype', () => {
        expect(normalizeJpkType('JPK_KR_PD')).toEqual({ type: 'KR_PD', subtype: null })
      })

      it('normalizes JPK_ST to type ST with no subtype', () => {
        expect(normalizeJpkType('JPK_ST')).toEqual({ type: 'ST', subtype: null })
      })

      it('normalizes JPK_ST_KR to type ST_KR with no subtype', () => {
        expect(normalizeJpkType('JPK_ST_KR')).toEqual({ type: 'ST_KR', subtype: null })
      })

      it('normalizes JPK_FA_RR to type FA_RR with no subtype', () => {
        expect(normalizeJpkType('JPK_FA_RR')).toEqual({ type: 'FA_RR', subtype: null })
      })

      it('normalizes JPK_KR to type KR with no subtype', () => {
        expect(normalizeJpkType('JPK_KR')).toEqual({ type: 'KR', subtype: null })
      })
    })

    describe('VDEK alias', () => {
      it('normalizes VDEK (without JPK_ prefix) to type V7M with no subtype', () => {
        expect(normalizeJpkType('VDEK')).toEqual({ type: 'V7M', subtype: null })
      })
    })

    describe('case insensitivity and whitespace', () => {
      it('handles lowercase input', () => {
        expect(normalizeJpkType('v7m')).toEqual({ type: 'V7M', subtype: 'V7M' })
      })

      it('handles mixed case input', () => {
        expect(normalizeJpkType('Jpk_Fa')).toEqual({ type: 'FA', subtype: null })
      })

      it('trims whitespace', () => {
        expect(normalizeJpkType('  V7M  ')).toEqual({ type: 'V7M', subtype: 'V7M' })
      })
    })

    describe('unknown values', () => {
      it('returns null for unknown type string', () => {
        expect(normalizeJpkType('UNKNOWN')).toBeNull()
      })

      it('returns null for empty string', () => {
        expect(normalizeJpkType('')).toBeNull()
      })

      it('returns null for arbitrary text', () => {
        expect(normalizeJpkType('some_random_text')).toBeNull()
      })
    })
  })

  describe('jpkTypeFromFilename', () => {
    describe('V7M/V7K detection', () => {
      it('detects V7M from filename with underscore separator', () => {
        expect(jpkTypeFromFilename('data_JPK_V7M_01.txt')).toEqual({ type: 'V7M', subtype: 'V7M' })
      })

      it('detects V7K from filename', () => {
        expect(jpkTypeFromFilename('JPK_V7K_export.csv')).toEqual({ type: 'V7M', subtype: 'V7K' })
      })

      it('detects VDEK from filename', () => {
        expect(jpkTypeFromFilename('JPK_VDEK_2024.txt')).toEqual({ type: 'V7M', subtype: null })
      })
    })

    describe('other JPK types in filenames', () => {
      it('detects FA from filename', () => {
        expect(jpkTypeFromFilename('JPK_FA_2024.xml')).toEqual({ type: 'FA', subtype: null })
      })

      it('detects FA_RR from filename (before FA match)', () => {
        expect(jpkTypeFromFilename('JPK_FA_RR_export.xml')).toEqual({ type: 'FA_RR', subtype: null })
      })

      it('detects MAG from filename', () => {
        expect(jpkTypeFromFilename('JPK_MAG_WZ_data.txt')).toEqual({ type: 'MAG', subtype: null })
      })

      it('detects WB from filename', () => {
        expect(jpkTypeFromFilename('JPK_WB_01_2024.xml')).toEqual({ type: 'WB', subtype: null })
      })

      it('detects PKPIR from filename', () => {
        expect(jpkTypeFromFilename('JPK_PKPIR_export.csv')).toEqual({ type: 'PKPIR', subtype: null })
      })

      it('detects EWP from filename', () => {
        expect(jpkTypeFromFilename('JPK_EWP_2024.xml')).toEqual({ type: 'EWP', subtype: null })
      })

      it('detects KR_PD from filename', () => {
        expect(jpkTypeFromFilename('JPK_KR_PD_dane.xml')).toEqual({ type: 'KR_PD', subtype: null })
      })

      it('detects ST from filename', () => {
        expect(jpkTypeFromFilename('JPK_ST_2024.xml')).toEqual({ type: 'ST', subtype: null })
      })

      it('detects ST_KR from filename (before ST match)', () => {
        expect(jpkTypeFromFilename('JPK_ST_KR_export.xml')).toEqual({ type: 'ST_KR', subtype: null })
      })

      it('detects KR from filename', () => {
        expect(jpkTypeFromFilename('JPK_KR_export.xml')).toEqual({ type: 'KR', subtype: null })
      })
    })

    describe('separator variations in filenames', () => {
      it('handles space separator', () => {
        expect(jpkTypeFromFilename('JPK V7M export.txt')).toEqual({ type: 'V7M', subtype: 'V7M' })
      })

      it('handles dash separator', () => {
        expect(jpkTypeFromFilename('JPK-FA-2024.xml')).toEqual({ type: 'FA', subtype: null })
      })

      it('handles no separator', () => {
        expect(jpkTypeFromFilename('JPKV7M_data.txt')).toEqual({ type: 'V7M', subtype: 'V7M' })
      })
    })

    describe('case insensitivity', () => {
      it('matches lowercase filename', () => {
        expect(jpkTypeFromFilename('jpk_v7m_data.txt')).toEqual({ type: 'V7M', subtype: 'V7M' })
      })

      it('matches mixed case filename', () => {
        expect(jpkTypeFromFilename('Jpk_Fa_export.xml')).toEqual({ type: 'FA', subtype: null })
      })
    })

    describe('no match', () => {
      it('returns null for a filename with no JPK type', () => {
        expect(jpkTypeFromFilename('random_file.txt')).toBeNull()
      })

      it('returns null for an empty filename', () => {
        expect(jpkTypeFromFilename('')).toBeNull()
      })
    })
  })

  describe('jpkTypeToLabel', () => {
    it('returns JPK_V7M for type V7M without subtype', () => {
      expect(jpkTypeToLabel('V7M')).toBe('JPK_V7M')
    })

    it('returns JPK_V7K for type V7M with subtype V7K', () => {
      expect(jpkTypeToLabel('V7M', 'V7K')).toBe('JPK_V7K')
    })

    it('returns JPK_V7M for type V7M with subtype V7M', () => {
      expect(jpkTypeToLabel('V7M', 'V7M')).toBe('JPK_V7M')
    })

    it('returns JPK_FA for type FA', () => {
      expect(jpkTypeToLabel('FA')).toBe('JPK_FA')
    })

    it('returns JPK_MAG for type MAG', () => {
      expect(jpkTypeToLabel('MAG')).toBe('JPK_MAG')
    })

    it('returns JPK_WB for type WB', () => {
      expect(jpkTypeToLabel('WB')).toBe('JPK_WB')
    })

    it('returns JPK_PKPIR for type PKPIR', () => {
      expect(jpkTypeToLabel('PKPIR')).toBe('JPK_PKPIR')
    })

    it('returns JPK_EWP for type EWP', () => {
      expect(jpkTypeToLabel('EWP')).toBe('JPK_EWP')
    })

    it('returns JPK_KR_PD for type KR_PD', () => {
      expect(jpkTypeToLabel('KR_PD')).toBe('JPK_KR_PD')
    })

    it('returns JPK_ST for type ST', () => {
      expect(jpkTypeToLabel('ST')).toBe('JPK_ST')
    })

    it('returns JPK_ST_KR for type ST_KR', () => {
      expect(jpkTypeToLabel('ST_KR')).toBe('JPK_ST_KR')
    })

    it('returns JPK_FA_RR for type FA_RR', () => {
      expect(jpkTypeToLabel('FA_RR')).toBe('JPK_FA_RR')
    })

    it('returns JPK_KR for type KR', () => {
      expect(jpkTypeToLabel('KR')).toBe('JPK_KR')
    })

    it('handles null subtype same as no subtype', () => {
      expect(jpkTypeToLabel('V7M', null)).toBe('JPK_V7M')
    })
  })

  describe('jpkTypeToXmlCode', () => {
    it('returns JPK_V7M for type V7M without subtype', () => {
      expect(jpkTypeToXmlCode('V7M')).toBe('JPK_V7M')
    })

    it('returns JPK_V7K for type V7M with subtype V7K', () => {
      expect(jpkTypeToXmlCode('V7M', 'V7K')).toBe('JPK_V7K')
    })

    it('returns JPK_V7M for type V7M with subtype V7M', () => {
      expect(jpkTypeToXmlCode('V7M', 'V7M')).toBe('JPK_V7M')
    })

    it('returns JPK_FA for type FA', () => {
      expect(jpkTypeToXmlCode('FA')).toBe('JPK_FA')
    })

    it('returns JPK_MAG for type MAG', () => {
      expect(jpkTypeToXmlCode('MAG')).toBe('JPK_MAG')
    })

    it('returns JPK_WB for type WB', () => {
      expect(jpkTypeToXmlCode('WB')).toBe('JPK_WB')
    })

    it('returns JPK_PKPIR for type PKPIR', () => {
      expect(jpkTypeToXmlCode('PKPIR')).toBe('JPK_PKPIR')
    })

    it('returns JPK_EWP for type EWP', () => {
      expect(jpkTypeToXmlCode('EWP')).toBe('JPK_EWP')
    })

    it('returns JPK_KR_PD for type KR_PD', () => {
      expect(jpkTypeToXmlCode('KR_PD')).toBe('JPK_KR_PD')
    })

    it('returns JPK_ST for type ST', () => {
      expect(jpkTypeToXmlCode('ST')).toBe('JPK_ST')
    })

    it('returns JPK_ST_KR for type ST_KR', () => {
      expect(jpkTypeToXmlCode('ST_KR')).toBe('JPK_ST_KR')
    })

    it('returns JPK_FA_RR for type FA_RR', () => {
      expect(jpkTypeToXmlCode('FA_RR')).toBe('JPK_FA_RR')
    })

    it('returns JPK_KR for type KR', () => {
      expect(jpkTypeToXmlCode('KR')).toBe('JPK_KR')
    })

    it('handles null subtype same as no subtype', () => {
      expect(jpkTypeToXmlCode('V7M', null)).toBe('JPK_V7M')
    })
  })

  describe('getAllJpkTypes', () => {
    it('returns all 11 JPK types', () => {
      const types = getAllJpkTypes()
      expect(types).toHaveLength(11)
    })

    it('includes all expected type values', () => {
      const types = getAllJpkTypes()
      expect(types).toContain('V7M')
      expect(types).toContain('FA')
      expect(types).toContain('MAG')
      expect(types).toContain('WB')
      expect(types).toContain('PKPIR')
      expect(types).toContain('EWP')
      expect(types).toContain('KR_PD')
      expect(types).toContain('ST')
      expect(types).toContain('ST_KR')
      expect(types).toContain('FA_RR')
      expect(types).toContain('KR')
    })

    it('returns unprefixed type values (no JPK_ prefix)', () => {
      const types = getAllJpkTypes()
      expect(types.every((t) => !t.startsWith('JPK_'))).toBe(true)
    })

    it('returns a new array on each call (not a reference to internal state)', () => {
      const a = getAllJpkTypes()
      const b = getAllJpkTypes()
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })
  })
})
