// ── Runtime input validation for JPK XML generators ──

export class GeneratorInputError extends Error {
  constructor(generatorName: string, message: string) {
    super(`[${generatorName}] Invalid input: ${message}`)
    this.name = 'GeneratorInputError'
  }
}

/**
 * Validates that `input` is a non-null object and that all `requiredFields` are present (not undefined).
 * Returns the input cast to T if valid, throws GeneratorInputError otherwise.
 */
export function validateGeneratorInput<T extends object>(
  input: unknown,
  requiredFields: (keyof T)[],
  generatorName: string,
): T {
  if (input === null || input === undefined) {
    throw new GeneratorInputError(generatorName, 'input is null or undefined')
  }

  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new GeneratorInputError(generatorName, `expected object, got ${Array.isArray(input) ? 'array' : typeof input}`)
  }

  const obj = input as Record<string, unknown>

  const missing = requiredFields.filter(field => obj[field as string] === undefined)
  if (missing.length > 0) {
    throw new GeneratorInputError(
      generatorName,
      `missing required fields: ${missing.map(String).join(', ')}`,
    )
  }

  return input as T
}
