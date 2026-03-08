/**
 * Sumuje kwoty pieniężne bez błędów IEEE 754.
 * Zamienia każdą wartość na grosze (int), sumuje, zwraca złote.
 */
export function sumAmounts(values: number[]): number {
  return values
    .map(v => Math.round((v || 0) * 100))
    .reduce((a, b) => a + b, 0) / 100
}

export function roundAmount(value: number): number {
  return Math.round((value || 0) * 100) / 100
}
