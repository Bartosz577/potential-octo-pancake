import { describe, it, expect } from 'vitest'
import { sumAmounts, roundAmount } from '../../../src/core/utils/mathUtils'

describe('sumAmounts', () => {
  it('avoids classic IEEE 754 float bug: 0.1 + 0.2 === 0.3', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3)
  })

  it('sums large amounts with small additions correctly', () => {
    expect(sumAmounts([1234.56, 0.01])).toBe(1234.57)
  })

  it('returns 0 for empty array', () => {
    expect(sumAmounts([])).toBe(0)
  })

  it('treats undefined, null, and 0 as zero', () => {
    expect(sumAmounts([undefined as unknown as number, null as unknown as number, 0])).toBe(0)
  })

  it('handles negative values', () => {
    expect(sumAmounts([10.05, -3.02])).toBe(7.03)
  })

  it('handles many small values without drift', () => {
    const values = Array.from({ length: 100 }, () => 0.01)
    expect(sumAmounts(values)).toBe(1.0)
  })

  it('handles mix of positive and negative amounts', () => {
    expect(sumAmounts([100.10, 200.20, -50.15])).toBe(250.15)
  })
})

describe('roundAmount', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundAmount(1.006)).toBe(1.01)
    expect(roundAmount(1.004)).toBe(1.00)
    expect(roundAmount(2.345)).toBe(2.35)
  })

  it('handles zero', () => {
    expect(roundAmount(0)).toBe(0)
  })

  it('handles negative values', () => {
    expect(roundAmount(-1.556)).toBe(-1.56)
    expect(roundAmount(-3.14)).toBe(-3.14)
  })

  it('treats falsy values as zero', () => {
    expect(roundAmount(undefined as unknown as number)).toBe(0)
    expect(roundAmount(null as unknown as number)).toBe(0)
  })
})
