// ── JPK Type utilities — single source of truth for type normalization ──

import type { JpkType } from '../models/types'

/** Sub-type within JPK_V7M — monthly (V7M) or quarterly (V7K) */
export type JpkSubtype = 'V7M' | 'V7K'

/** Result of normalizing a raw JPK type string */
export interface NormalizedJpkType {
  type: JpkType
  subtype: JpkSubtype | null
}

const ALL_JPK_TYPES: JpkType[] = [
  'V7M', 'FA', 'MAG', 'WB', 'PKPIR',
  'EWP', 'KR_PD', 'ST', 'ST_KR', 'FA_RR', 'KR',
]

/** Maps raw input strings to canonical JpkType + optional subtype */
const NORMALIZATION_MAP: Record<string, NormalizedJpkType> = {
  // Canonical values (passthrough)
  'V7M': { type: 'V7M', subtype: 'V7M' },
  'V7K': { type: 'V7M', subtype: 'V7K' },
  'FA': { type: 'FA', subtype: null },
  'MAG': { type: 'MAG', subtype: null },
  'WB': { type: 'WB', subtype: null },
  'PKPIR': { type: 'PKPIR', subtype: null },
  'EWP': { type: 'EWP', subtype: null },
  'KR_PD': { type: 'KR_PD', subtype: null },
  'ST': { type: 'ST', subtype: null },
  'ST_KR': { type: 'ST_KR', subtype: null },
  'FA_RR': { type: 'FA_RR', subtype: null },
  'KR': { type: 'KR', subtype: null },
  // With JPK_ prefix
  'JPK_V7M': { type: 'V7M', subtype: 'V7M' },
  'JPK_V7K': { type: 'V7M', subtype: 'V7K' },
  'JPK_VDEK': { type: 'V7M', subtype: null },
  'VDEK': { type: 'V7M', subtype: null },
  'JPK_FA': { type: 'FA', subtype: null },
  'JPK_MAG': { type: 'MAG', subtype: null },
  'JPK_WB': { type: 'WB', subtype: null },
  'JPK_PKPIR': { type: 'PKPIR', subtype: null },
  'JPK_EWP': { type: 'EWP', subtype: null },
  'JPK_KR_PD': { type: 'KR_PD', subtype: null },
  'JPK_ST': { type: 'ST', subtype: null },
  'JPK_ST_KR': { type: 'ST_KR', subtype: null },
  'JPK_FA_RR': { type: 'FA_RR', subtype: null },
  'JPK_KR': { type: 'KR', subtype: null },
}

/**
 * Normalize a raw JPK type string to a canonical JpkType value with optional subtype.
 * Handles: 'JPK_VDEK', 'JPK_V7M', 'V7M', 'V7K', 'FA', 'JPK_FA', etc.
 * Returns null if the input doesn't match any known type.
 */
export function normalizeJpkType(raw: string): NormalizedJpkType | null {
  return NORMALIZATION_MAP[raw.toUpperCase().trim()] ?? null
}

/** Human-readable labels for JpkType values */
const LABELS: Record<JpkType, string> = {
  V7M: 'JPK_V7M',
  FA: 'JPK_FA',
  MAG: 'JPK_MAG',
  WB: 'JPK_WB',
  PKPIR: 'JPK_PKPIR',
  EWP: 'JPK_EWP',
  KR_PD: 'JPK_KR_PD',
  ST: 'JPK_ST',
  ST_KR: 'JPK_ST_KR',
  FA_RR: 'JPK_FA_RR',
  KR: 'JPK_KR',
}

/**
 * Returns a human-readable label for the given JpkType, with optional subtype.
 * jpkTypeToLabel('V7M') → 'JPK_V7M'
 * jpkTypeToLabel('V7M', 'V7K') → 'JPK_V7K'
 */
export function jpkTypeToLabel(type: JpkType, subtype?: JpkSubtype | null): string {
  if (type === 'V7M' && subtype === 'V7K') return 'JPK_V7K'
  return LABELS[type] ?? type
}

/** Maps JpkType to the XML kodFormularza value used in JPK XML files */
const XML_CODE_MAP: Record<JpkType, string> = {
  V7M: 'JPK_V7M',
  FA: 'JPK_FA',
  MAG: 'JPK_MAG',
  WB: 'JPK_WB',
  PKPIR: 'JPK_PKPIR',
  EWP: 'JPK_EWP',
  KR_PD: 'JPK_KR_PD',
  ST: 'JPK_ST',
  ST_KR: 'JPK_ST_KR',
  FA_RR: 'JPK_FA_RR',
  KR: 'JPK_KR',
}

/**
 * Returns the XML kodFormularza string for a given JpkType.
 * Used by generators and XML export logic.
 */
export function jpkTypeToXmlCode(type: JpkType, subtype?: JpkSubtype | null): string {
  if (type === 'V7M' && subtype === 'V7K') return 'JPK_V7K'
  return XML_CODE_MAP[type] ?? `JPK_${type}`
}

/** Filename patterns for detecting JPK type from file names */
const FILENAME_PATTERNS: [RegExp, NormalizedJpkType][] = [
  [/JPK[_\s-]?V7M/i, { type: 'V7M', subtype: 'V7M' }],
  [/JPK[_\s-]?V7K/i, { type: 'V7M', subtype: 'V7K' }],
  [/JPK[_\s-]?VDEK/i, { type: 'V7M', subtype: null }],
  [/JPK[_\s-]?FA[_\s-]?RR/i, { type: 'FA_RR', subtype: null }],
  [/JPK[_\s-]?FA/i, { type: 'FA', subtype: null }],
  [/JPK[_\s-]?MAG/i, { type: 'MAG', subtype: null }],
  [/JPK[_\s-]?WB/i, { type: 'WB', subtype: null }],
  [/JPK[_\s-]?PKPIR/i, { type: 'PKPIR', subtype: null }],
  [/JPK[_\s-]?EWP/i, { type: 'EWP', subtype: null }],
  [/JPK[_\s-]?KR[_\s-]?PD/i, { type: 'KR_PD', subtype: null }],
  [/JPK[_\s-]?ST[_\s-]?KR/i, { type: 'ST_KR', subtype: null }],
  [/JPK[_\s-]?ST/i, { type: 'ST', subtype: null }],
  [/JPK[_\s-]?KR/i, { type: 'KR', subtype: null }],
]

/**
 * Attempts to detect the JpkType from a filename using regex patterns.
 * Returns null if no pattern matches.
 */
export function jpkTypeFromFilename(filename: string): NormalizedJpkType | null {
  for (const [pattern, result] of FILENAME_PATTERNS) {
    if (pattern.test(filename)) return result
  }
  return null
}

/**
 * Returns all valid JpkType values.
 */
export function getAllJpkTypes(): JpkType[] {
  return [...ALL_JPK_TYPES]
}
