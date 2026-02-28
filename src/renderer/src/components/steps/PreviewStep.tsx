import { useState, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle
} from 'lucide-react'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore } from '@renderer/stores/appStore'
import { useMappingStore } from '@renderer/stores/mappingStore'
import type { ParsedFile, JpkType } from '@renderer/types'
import type { ColumnMapping } from '../../../../core/mapping/AutoMapper'
import type { JpkFieldType } from '../../../../core/mapping/JpkFieldDefinitions'
import { getFieldDefinitions } from '../../../../core/mapping/JpkFieldDefinitions'

interface DynColumnDef {
  key: string
  label: string
  fieldName: string
  dataIndex: number
  fieldType: JpkFieldType
  summable: boolean
}

const SUMMABLE_TYPES: JpkFieldType[] = ['decimal']

function buildColumnsFromMappings(
  mappings: ColumnMapping[],
  jpkType: string,
  subType: string
): DynColumnDef[] {
  const fields = getFieldDefinitions(jpkType, subType)
  const fieldMap = new Map(fields.map((f) => [f.name, f]))

  return mappings
    .filter((m) => fieldMap.has(m.targetField))
    .sort((a, b) => a.sourceColumn - b.sourceColumn)
    .map((m) => {
      const field = fieldMap.get(m.targetField)!
      return {
        key: m.targetField,
        label: field.label,
        fieldName: m.targetField,
        dataIndex: m.sourceColumn,
        fieldType: field.type,
        summable: SUMMABLE_TYPES.includes(field.type)
      }
    })
}

function parseDecimal(value: string): number {
  if (!value || value.trim() === '') return 0
  return parseFloat(value.replace(',', '.')) || 0
}

function formatDecimal(value: string): string {
  const num = parseDecimal(value)
  return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCellValue(value: string, type: JpkFieldType): string {
  if (!value) return ''
  if (type === 'decimal') return formatDecimal(value)
  return value
}

function typeHighlightClass(type: JpkFieldType): string {
  switch (type) {
    case 'date': return 'text-blue-400'
    case 'decimal': return 'text-emerald-400'
    case 'nip': return 'text-amber-400'
    default: return 'text-text-primary'
  }
}

const ROWS_PER_PAGE = 50

function EditableCell({
  value,
  fieldType,
  onSave
}: {
  value: string
  fieldType: JpkFieldType
  onSave: (newValue: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  const handleStartEdit = (): void => {
    setEditValue(value)
    setEditing(true)
  }

  const handleSave = (): void => {
    setEditing(false)
    if (editValue !== value) onSave(editValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setEditValue(value)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full px-1 py-0.5 bg-bg-input border border-accent rounded text-xs font-mono text-text-primary outline-none"
      />
    )
  }

  const isNipBrak = fieldType === 'nip' && (value === 'brak' || value === '')
  const displayValue = formatCellValue(value, fieldType)

  return (
    <span
      onClick={handleStartEdit}
      className={`cursor-pointer hover:bg-bg-hover px-1 py-0.5 rounded transition-colors ${
        isNipBrak ? 'text-warning bg-warning/10 rounded px-1.5' : typeHighlightClass(fieldType)
      }`}
      title="Kliknij aby edytować"
    >
      {displayValue || <span className="text-text-muted">—</span>}
    </span>
  )
}

function SummaryBar({
  file,
  columns
}: {
  file: ParsedFile
  columns: DynColumnDef[]
}): React.JSX.Element {
  const summableColumns = columns.filter((c) => c.summable)

  const sums = useMemo(() => {
    return summableColumns.map((col) => {
      const total = file.rows.reduce((acc, row) => acc + parseDecimal(row[col.dataIndex] || ''), 0)
      return { label: col.fieldName, total }
    })
  }, [file.rows, summableColumns])

  const nipCol = columns.find((c) => c.fieldType === 'nip')
  const nipBrakCount = useMemo(() => {
    if (!nipCol) return 0
    return file.rows.filter((row) => {
      const v = row[nipCol.dataIndex] || ''
      return v === 'brak' || v === ''
    }).length
  }, [file.rows, nipCol])

  return (
    <div className="shrink-0 flex items-center gap-6 px-4 py-2.5 bg-bg-card border-t border-border text-xs">
      <span className="text-text-secondary">
        Wierszy: <span className="font-medium text-text-primary font-mono">{file.rowCount.toLocaleString('pl-PL')}</span>
      </span>
      {sums.map((s) => (
        <span key={s.label} className="text-text-secondary">
          {s.label}:{' '}
          <span className="font-medium text-text-primary font-mono">
            {s.total.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </span>
      ))}
      {nipBrakCount > 0 && (
        <span className="flex items-center gap-1 text-warning">
          <AlertTriangle className="w-3 h-3" />
          {nipBrakCount}x NIP \u201ebrak\u201d
        </span>
      )}
    </div>
  )
}

/**
 * DataTable wraps scroll area + SummaryBar + pagination in a single
 * overflow-hidden container. The table can be wider than the viewport —
 * only the scroll area scrolls (both axes). SummaryBar and pagination
 * stay pinned below with shrink-0.
 */
function DataTable({
  file,
  columns
}: {
  file: ParsedFile
  columns: DynColumnDef[]
}): React.JSX.Element {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(file.rowCount / ROWS_PER_PAGE)

  const pageRows = useMemo(() => {
    const start = page * ROWS_PER_PAGE
    return file.rows.slice(start, start + ROWS_PER_PAGE)
  }, [file.rows, page])

  const handleCellEdit = useCallback(
    (rowIndex: number, colIndex: number, newValue: string) => {
      const globalRow = page * ROWS_PER_PAGE + rowIndex
      // eslint-disable-next-line react-hooks/immutability -- intentional in-place edit for cell editing
      file.rows[globalRow][colIndex] = newValue
    },
    [file.rows, page]
  )

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Scrollable table — flex-1 takes remaining space, scrolls both axes */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="min-w-max border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-card">
              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border w-10">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider border-b border-border whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span className={typeHighlightClass(col.fieldType)}>{col.fieldName}</span>
                    <span className="text-text-muted font-normal normal-case">
                      {col.label !== col.fieldName ? col.label : ''}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIdx) => {
              const globalIdx = page * ROWS_PER_PAGE + rowIdx
              return (
                <tr
                  key={globalIdx}
                  className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors"
                >
                  <td className="px-2 py-1.5 text-xs text-text-muted font-mono whitespace-nowrap">
                    {globalIdx + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-2 py-1.5 text-xs font-mono whitespace-nowrap">
                      <EditableCell
                        value={row[col.dataIndex] || ''}
                        fieldType={col.fieldType}
                        onSave={(v) => handleCellEdit(rowIdx, col.dataIndex, v)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* SummaryBar — pinned below table */}
      <SummaryBar file={file} columns={columns} />

      {/* Pagination — pinned below summary */}
      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-bg-app border-t border-border">
          <span className="text-xs text-text-muted">
            Strona {page + 1} z {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1.5 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-text-secondary" />
            </button>

            {/* Clickable page numbers */}
            {(() => {
              const pages: number[] = []
              const maxVisible = 5
              let start = Math.max(0, page - Math.floor(maxVisible / 2))
              const end = Math.min(totalPages, start + maxVisible)
              start = Math.max(0, end - maxVisible)
              for (let i = start; i < end; i++) pages.push(i)
              return pages.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {p + 1}
                </button>
              ))
            })()}

            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-3.5 h-3.5 text-text-secondary" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const TAB_LABELS: Record<JpkType, string> = {
  JPK_VDEK: 'Sprzedaż V7M',
  JPK_FA: 'Faktury',
  JPK_MAG: 'Magazyn',
  JPK_WB: 'Wyciągi bankowe'
}

export function PreviewStep(): React.JSX.Element {
  const { files } = useImportStore()
  const { setCurrentStep } = useAppStore()
  const { activeMappings } = useMappingStore()
  const [activeFileId, setActiveFileId] = useState<string>(files[0]?.id || '')

  const activeFile = files.find((f) => f.id === activeFileId) || files[0]

  const columns = useMemo(() => {
    if (!activeFile) return []
    const mappings = activeMappings[activeFile.id] || []
    if (mappings.length > 0) {
      return buildColumnsFromMappings(mappings, activeFile.jpkType, activeFile.subType)
    }
    // Fallback: show first N columns raw
    const count = Math.min(activeFile.columnCount, 10)
    return Array.from({ length: count }, (_, i): DynColumnDef => ({
      key: `col_${i}`,
      label: activeFile.headers?.[i] || `Kol ${i}`,
      fieldName: activeFile.headers?.[i] || `Kol ${i}`,
      dataIndex: i,
      fieldType: 'string',
      summable: false
    }))
  }, [activeFile, activeMappings])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header — shrink-0 */}
      <div className="shrink-0 px-6 pt-5 pb-0">
        <h1 className="text-xl font-semibold text-text-primary mb-1">Podgląd danych</h1>
        <p className="text-sm text-text-secondary mb-4">
          Sprawdź dane przed walidacją — kliknij komórkę aby edytować
        </p>

        {files.length > 1 && (
          <div className="flex gap-1 border-b border-border">
            {files.map((file) => {
              const isActive = file.id === activeFile?.id
              return (
                <button
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                    isActive
                      ? 'bg-bg-card text-text-primary border-b-2 border-accent'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {TAB_LABELS[file.jpkType]}{' '}
                  <span className="text-text-muted">({file.rowCount})</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* DataTable renders: scroll area (flex-1) + SummaryBar (shrink-0) + pagination (shrink-0) */}
      {activeFile && columns.length > 0 ? (
        <DataTable file={activeFile} columns={columns} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          Brak zaimportowanych plików
        </div>
      )}

      {/* Navigation footer — shrink-0, always visible at bottom */}
      <div className="shrink-0 px-6 py-3 flex justify-between border-t border-border bg-bg-app">
        <button
          onClick={() => setCurrentStep(3)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Wstecz
        </button>
        <button
          onClick={() => setCurrentStep(5)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
        >
          Dalej
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
