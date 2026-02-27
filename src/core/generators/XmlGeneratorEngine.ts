// ── XML Generator Engine ──
// Shared utilities, interface, and registry for all JPK XML generators

// ── XML value helpers ──

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function formatAmount(value: string | number | undefined): string {
  if (value === undefined || value === '' || value === null) return '0.00'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return '0.00'
  return num.toFixed(2)
}

export function formatDeclAmount(value: string | number | undefined): string {
  if (value === undefined || value === '' || value === null) return '0'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return '0'
  return String(Math.round(num))
}

export function formatQuantity(value: string | number | undefined): string {
  if (value === undefined || value === '' || value === null) return '0'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return '0'
  let formatted = num.toFixed(6)
  formatted = formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return formatted
}

export function parseAmount(value: string | undefined): number {
  if (!value || value === '') return 0
  const num = parseFloat(value)
  return isNaN(num) ? 0 : num
}

export function formatDateTime(date?: Date): string {
  const d = date ?? new Date()
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ── XML element builders ──

export function buildElement(
  name: string,
  value: string,
  attrs?: Record<string, string>,
): string {
  const attrStr = attrs
    ? ' ' + Object.entries(attrs).map(([k, v]) => `${k}="${escapeXml(v)}"`).join(' ')
    : ''
  return `<${name}${attrStr}>${escapeXml(value)}</${name}>`
}

export function buildAmountElement(name: string, value: string | number | undefined): string {
  return `<${name}>${formatAmount(value)}</${name}>`
}

export function buildQuantityElement(name: string, value: string | number | undefined): string {
  return `<${name}>${formatQuantity(value)}</${name}>`
}

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'

// ── XmlGenerator interface ──

export interface XmlGenerator {
  readonly jpkType: string
  readonly version: string
  readonly namespace: string
  generate(input: unknown): string
}

// ── XmlGeneratorRegistry ──

export class XmlGeneratorRegistry {
  private generators = new Map<string, XmlGenerator>()

  register(generator: XmlGenerator): void {
    this.generators.set(generator.jpkType, generator)
  }

  get(jpkType: string): XmlGenerator | undefined {
    return this.generators.get(jpkType)
  }

  getAll(): XmlGenerator[] {
    return Array.from(this.generators.values())
  }

  getAvailableTypes(): string[] {
    return Array.from(this.generators.keys())
  }
}

// Singleton registry instance
export const generatorRegistry = new XmlGeneratorRegistry()
