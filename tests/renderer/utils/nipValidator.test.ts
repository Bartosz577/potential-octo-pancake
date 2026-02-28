import { describe, it, expect } from 'vitest'
import {
  validatePolishNip,
  formatNip,
  normalizeNip
} from '../../../src/renderer/src/utils/nipValidator'

// ── validatePolishNip ──

describe('validatePolishNip', () => {
  it('returns true for a valid NIP (5261040828)', () => {
    expect(validatePolishNip('5261040828')).toBe(true)
  })

  it('returns true for another valid NIP (7680002466)', () => {
    expect(validatePolishNip('7680002466')).toBe(true)
  })

  it('returns false for an invalid NIP (checksum mismatch)', () => {
    expect(validatePolishNip('5261040829')).toBe(false)
    expect(validatePolishNip('1234567890')).toBe(false)
  })

  it('returns false for non-10-digit strings', () => {
    expect(validatePolishNip('')).toBe(false)
    expect(validatePolishNip('123')).toBe(false)
    expect(validatePolishNip('12345678901')).toBe(false)
  })

  it('handles NIP with dashes (strips non-digits first)', () => {
    expect(validatePolishNip('526-104-08-28')).toBe(true)
  })

  it('handles NIP with spaces', () => {
    expect(validatePolishNip('526 104 08 28')).toBe(true)
  })

  it('returns true for all-zeros NIP (checksum 0%11===0)', () => {
    // Mathematically the checksum passes: sum=0, 0%11=0, last digit=0
    expect(validatePolishNip('0000000000')).toBe(true)
  })
})

// ── formatNip ──

describe('formatNip', () => {
  it('formats a 10-digit NIP as XXX-XXX-XX-XX', () => {
    expect(formatNip('5261040828')).toBe('526-104-08-28')
  })

  it('formats a NIP that already has dashes (strips then re-formats)', () => {
    expect(formatNip('526-104-08-28')).toBe('526-104-08-28')
  })

  it('returns the original string if not exactly 10 digits', () => {
    expect(formatNip('123')).toBe('123')
    expect(formatNip('')).toBe('')
    expect(formatNip('12345678901')).toBe('12345678901')
  })
})

// ── normalizeNip ──

describe('normalizeNip', () => {
  it('strips dashes from a formatted NIP', () => {
    expect(normalizeNip('526-104-08-28')).toBe('5261040828')
  })

  it('strips spaces from a NIP', () => {
    expect(normalizeNip('526 104 08 28')).toBe('5261040828')
  })

  it('returns digits-only string unchanged', () => {
    expect(normalizeNip('5261040828')).toBe('5261040828')
  })

  it('strips mixed non-digit characters', () => {
    expect(normalizeNip('PL 526-104-08-28')).toBe('5261040828')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeNip('')).toBe('')
  })
})
