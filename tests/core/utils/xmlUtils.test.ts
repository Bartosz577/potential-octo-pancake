import { describe, it, expect } from 'vitest'
import { escapeXml } from '../../../src/core/generators/XmlGeneratorEngine'

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('AT&T')).toBe('AT&amp;T')
  })

  it('escapes angle brackets', () => {
    expect(escapeXml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeXml('"quoted"')).toBe('&quot;quoted&quot;')
  })

  it('escapes single quotes (apostrophe)', () => {
    expect(escapeXml("it's")).toBe('it&apos;s')
  })

  it('returns empty string for null', () => {
    expect(escapeXml(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(escapeXml(undefined)).toBe('')
  })

  it('converts number to string', () => {
    expect(escapeXml(123.45)).toBe('123.45')
  })

  it('handles string with multiple special chars', () => {
    expect(escapeXml('A & B < C > D "E" \'F\'')).toBe(
      'A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;'
    )
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeXml('Środek trwały nr 001')).toBe('Środek trwały nr 001')
  })

  it('handles empty string', () => {
    expect(escapeXml('')).toBe('')
  })

  it('handles zero', () => {
    expect(escapeXml(0)).toBe('0')
  })
})
