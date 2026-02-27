import type { FileFormat } from '@renderer/types'

const FORMAT_CONFIG: Record<FileFormat, { label: string; className: string }> = {
  txt: { label: 'TXT', className: 'bg-zinc-500/15 text-zinc-400' },
  csv: { label: 'CSV', className: 'bg-emerald-500/15 text-emerald-400' },
  xlsx: { label: 'XLSX', className: 'bg-blue-500/15 text-blue-400' },
  json: { label: 'JSON', className: 'bg-yellow-500/15 text-yellow-400' },
  xml: { label: 'XML', className: 'bg-orange-500/15 text-orange-400' }
}

export function FormatBadge({ format }: { format: FileFormat }): React.JSX.Element {
  const config = FORMAT_CONFIG[format]
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${config.className}`}>
      {config.label}
    </span>
  )
}
