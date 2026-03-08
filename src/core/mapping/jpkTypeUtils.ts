// ── JPK Type utilities — single source of truth for type normalization ──

import type { JpkType } from '../models/types'

const ALL_JPK_TYPES: JpkType[] = [
  'JPK_VDEK', 'JPK_FA', 'JPK_MAG', 'JPK_WB', 'JPK_PKPIR',
  'JPK_EWP', 'JPK_KR_PD', 'JPK_ST', 'JPK_ST_KR', 'JPK_FA_RR', 'JPK_KR',
]

/** Maps raw input strings to canonical JpkType values */
const NORMALIZATION_MAP: Record<string, JpkType> = {
  // Canonical values (passthrough)
  'JPK_VDEK': 'JPK_VDEK',
  'JPK_FA': 'JPK_FA',
  'JPK_MAG': 'JPK_MAG',
  'JPK_WB': 'JPK_WB',
  'JPK_PKPIR': 'JPK_PKPIR',
  'JPK_EWP': 'JPK_EWP',
  'JPK_KR_PD': 'JPK_KR_PD',
  'JPK_ST': 'JPK_ST',
  'JPK_ST_KR': 'JPK_ST_KR',
  'JPK_FA_RR': 'JPK_FA_RR',
  'JPK_KR': 'JPK_KR',
  // V7M/V7K aliases → VDEK
  'JPK_V7M': 'JPK_VDEK',
  'JPK_V7K': 'JPK_VDEK',
  'V7M': 'JPK_VDEK',
  'V7K': 'JPK_VDEK',
  'VDEK': 'JPK_VDEK',
  // Without JPK_ prefix
  'FA': 'JPK_FA',
  'MAG': 'JPK_MAG',
  'WB': 'JPK_WB',
  'PKPIR': 'JPK_PKPIR',
  'EWP': 'JPK_EWP',
  'KR_PD': 'JPK_KR_PD',
  'ST': 'JPK_ST',
  'ST_KR': 'JPK_ST_KR',
  'FA_RR': 'JPK_FA_RR',
  'KR': 'JPK_KR',
}

/**
 * Normalize a raw JPK type string to a canonical JpkType value.
 * Handles: 'JPK_VDEK', 'JPK_V7M', 'V7M', 'FA', 'JPK_FA', etc.
 * Returns null if the input doesn't match any known type.
 */
export function normalizeJpkType(raw: string): JpkType | null {
  return NORMALIZATION_MAP[raw.toUpperCase().trim()] ?? null
}

/** Human-readable label for a JpkType */
const LABELS: Record<JpkType, string> = {
  JPK_VDEK: 'JPK_V7M (VDEK)',
  JPK_FA: 'JPK_FA',
  JPK_MAG: 'JPK_MAG',
  JPK_WB: 'JPK_WB',
  JPK_PKPIR: 'JPK_PKPIR',
  JPK_EWP: 'JPK_EWP',
  JPK_KR_PD: 'JPK_KR_PD',
  JPK_ST: 'JPK_ST',
  JPK_ST_KR: 'JPK_ST_KR',
  JPK_FA_RR: 'JPK_FA_RR',
  JPK_KR: 'JPK_KR',
}

/**
 * Returns a human-readable label for the given JpkType.
 */
export function jpkTypeToLabel(type: JpkType): string {
  return LABELS[type] ?? type
}

/** Filename patterns for detecting JPK type from file names */
const FILENAME_PATTERNS: [RegExp, JpkType][] = [
  [/JPK[_\s-]?V(?:DEK|7[MK])/i, 'JPK_VDEK'],
  [/JPK[_\s-]?FA[_\s-]?RR/i, 'JPK_FA_RR'],
  [/JPK[_\s-]?FA/i, 'JPK_FA'],
  [/JPK[_\s-]?MAG/i, 'JPK_MAG'],
  [/JPK[_\s-]?WB/i, 'JPK_WB'],
  [/JPK[_\s-]?PKPIR/i, 'JPK_PKPIR'],
  [/JPK[_\s-]?EWP/i, 'JPK_EWP'],
  [/JPK[_\s-]?KR[_\s-]?PD/i, 'JPK_KR_PD'],
  [/JPK[_\s-]?ST[_\s-]?KR/i, 'JPK_ST_KR'],
  [/JPK[_\s-]?ST/i, 'JPK_ST'],
  [/JPK[_\s-]?KR/i, 'JPK_KR'],
]

/**
 * Attempts to detect the JpkType from a filename using regex patterns.
 * Returns null if no pattern matches.
 */
export function jpkTypeFromFilename(filename: string): JpkType | null {
  for (const [pattern, type] of FILENAME_PATTERNS) {
    if (pattern.test(filename)) return type
  }
  return null
}

/**
 * Returns all valid JpkType values.
 */
export function getAllJpkTypes(): JpkType[] {
  return [...ALL_JPK_TYPES]
}
