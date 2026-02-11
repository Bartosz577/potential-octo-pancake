const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7]

export function validatePolishNip(nip: string): boolean {
  const digits = nip.replace(/[^0-9]/g, '')
  if (digits.length !== 10) return false

  const sum = NIP_WEIGHTS.reduce((acc, weight, i) => acc + weight * parseInt(digits[i], 10), 0)
  return sum % 11 === parseInt(digits[9], 10)
}

export function formatNip(nip: string): string {
  const digits = nip.replace(/[^0-9]/g, '')
  if (digits.length !== 10) return nip
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
}

export function normalizeNip(nip: string): string {
  return nip.replace(/[^0-9]/g, '')
}
