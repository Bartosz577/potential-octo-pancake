import { describe, it, expect } from 'vitest'
import { validateGeneratorInput, GeneratorInputError } from '../../../src/core/utils/inputValidator'

interface TestInput {
  naglowek: { dataOd: string }
  podmiot: { nip: string }
  wiersze?: string[]
}

describe('validateGeneratorInput', () => {
  const validInput: TestInput = {
    naglowek: { dataOd: '2024-01-01' },
    podmiot: { nip: '1234567890' },
  }

  it('returns input when all required fields are present', () => {
    const result = validateGeneratorInput<TestInput>(
      validInput,
      ['naglowek', 'podmiot'],
      'TestGenerator',
    )
    expect(result).toBe(validInput)
  })

  it('allows optional fields to be missing', () => {
    const result = validateGeneratorInput<TestInput>(
      validInput,
      ['naglowek', 'podmiot'],
      'TestGenerator',
    )
    expect(result.wiersze).toBeUndefined()
  })

  it('throws GeneratorInputError for null input', () => {
    expect(() =>
      validateGeneratorInput<TestInput>(null, ['naglowek'], 'TestGenerator'),
    ).toThrow(GeneratorInputError)
    expect(() =>
      validateGeneratorInput<TestInput>(null, ['naglowek'], 'TestGenerator'),
    ).toThrow('[TestGenerator] Invalid input: input is null or undefined')
  })

  it('throws GeneratorInputError for undefined input', () => {
    expect(() =>
      validateGeneratorInput<TestInput>(undefined, ['naglowek'], 'TestGenerator'),
    ).toThrow(GeneratorInputError)
  })

  it('throws GeneratorInputError for non-object input (string)', () => {
    expect(() =>
      validateGeneratorInput<TestInput>('hello', ['naglowek'], 'TestGenerator'),
    ).toThrow('expected object, got string')
  })

  it('throws GeneratorInputError for non-object input (number)', () => {
    expect(() =>
      validateGeneratorInput<TestInput>(42, ['naglowek'], 'TestGenerator'),
    ).toThrow('expected object, got number')
  })

  it('throws GeneratorInputError for array input', () => {
    expect(() =>
      validateGeneratorInput<TestInput>([], ['naglowek'], 'TestGenerator'),
    ).toThrow('expected object, got array')
  })

  it('throws GeneratorInputError listing missing fields', () => {
    expect(() =>
      validateGeneratorInput<TestInput>({}, ['naglowek', 'podmiot'], 'TestGenerator'),
    ).toThrow('missing required fields: naglowek, podmiot')
  })

  it('throws with generator name in message', () => {
    expect(() =>
      validateGeneratorInput<TestInput>({}, ['naglowek'], 'JPK_V7M'),
    ).toThrow('[JPK_V7M]')
  })

  it('passes when required fields exist even with falsy values', () => {
    const input = { naglowek: 0, podmiot: '', wiersze: false }
    const result = validateGeneratorInput<TestInput>(
      input,
      ['naglowek', 'podmiot'],
      'TestGenerator',
    )
    expect(result).toBe(input)
  })

  it('passes with empty required fields array', () => {
    const result = validateGeneratorInput<TestInput>({}, [], 'TestGenerator')
    expect(result).toEqual({})
  })

  it('error is instance of Error', () => {
    try {
      validateGeneratorInput<TestInput>(null, [], 'TestGenerator')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect(e).toBeInstanceOf(GeneratorInputError)
      expect((e as GeneratorInputError).name).toBe('GeneratorInputError')
    }
  })
})
