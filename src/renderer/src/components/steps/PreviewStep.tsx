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
import type { ParsedFile, JpkType } from '@renderer/types'

// Column definitions per JPK type
interface ColumnDef {
  key: string
  label: string
  dataIndex: number
  type: 'text' | 'decimal' | 'nip' | 'date'
  width?: string
  summable?: boolean
}

const VDEK_COLUMNS: ColumnDef[] = [
  { key: 'lp', label: 'Lp', dataIndex: 0, type: 'text', width: 'w-14' },
  { key: 'kodKraju', label: 'Kraj', dataIndex: 1, type: 'text', width: 'w-14' },
  { key: 'nip', label: 'NIP', dataIndex: 2, type: 'nip', width: 'w-32' },
  { key: 'kontrahent', label: 'Kontrahent', dataIndex: 3, type: 'text' },
  { key: 'nrDowodu', label: 'Nr dowodu', dataIndex: 4, type: 'text', width: 'w-40' },
  { key: 'dataWyst', label: 'Data wyst.', dataIndex: 5, type: 'date', width: 'w-24' },
  { key: 'typDok', label: 'Typ', dataIndex: 7, type: 'text', width: 'w-12' },
  { key: 'k19', label: 'K_19 netto', dataIndex: 45, type: 'decimal', width: 'w-24', summable: true },
  { key: 'k20', label: 'K_20 VAT', dataIndex: 46, type: 'decimal', width: 'w-24', summable: true }
]

const FA_COLUMNS: ColumnDef[] = [
  { key: 'waluta', label: 'Waluta', dataIndex: 0, type: 'text', width: 'w-16' },
  { key: 'dataWyst', label: 'Data wyst.', dataIndex: 1, type: 'date', width: 'w-24' },
  { key: 'nrFaktury', label: 'Nr faktury', dataIndex: 2, type: 'text', width: 'w-40' },
  { key: 'nabywca', label: 'Nabywca', dataIndex: 3, type: 'text' },
  { key: 'nipNabywcy', label: 'NIP nabywcy', dataIndex: 10, type: 'nip', width: 'w-32' },
  { key: 'netto23', label: 'Netto 23%', dataIndex: 12, type: 'decimal', width: 'w-24', summable: true },
  { key: 'vat23', label: 'VAT 23%', dataIndex: 13, type: 'decimal', width: 'w-24', summable: true },
  { key: 'brutto', label: 'Brutto', dataIndex: 27, type: 'decimal', width: 'w-24', summable: true },
  { key: 'rodzaj', label: 'Rodzaj', dataIndex: 51, type: 'text', width: 'w-16' }
]

const MAG_COLUMNS: ColumnDef[] = [
  { key: 'nrWZ', label: 'Nr WZ', dataIndex: 1, type: 'text', width: 'w-40' },
  { key: 'dataWZ', label: 'Data WZ', dataIndex: 2, type: 'date', width: 'w-24' },
  { key: 'wartoscWZ', label: 'Wartość WZ', dataIndex: 3, type: 'decimal', width: 'w-24' },
  { key: 'kodTowaru', label: 'Kod towaru', dataIndex: 9, type: 'text', width: 'w-24' },
  { key: 'nazwaTowaru', label: 'Nazwa towaru', dataIndex: 10, type: 'text' },
  { key: 'ilosc', label: 'Ilość', dataIndex: 11, type: 'decimal', width: 'w-20' },
  { key: 'jedn', label: 'Jdn.', dataIndex: 12, type: 'text', width: 'w-14' },
  { key: 'cena', label: 'Cena', dataIndex: 13, type: 'decimal', width: 'w-20' },
  { key: 'wartosc', label: 'Wartość', dataIndex: 14, type: 'decimal', width: 'w-20', summable: true }
]

function getColumnsForType(jpkType: JpkType): ColumnDef[] {
  switch (jpkType) {
    case 'JPK_VDEK': return VDEK_COLUMNS
    case 'JPK_FA': return FA_COLUMNS
    case 'JPK_MAG': return MAG_COLUMNS
    case 'JPK_WB': return MAG_COLUMNS // placeholder until WB columns are defined
  }
}

function parseDecimal(value: string): number {
  if (!value || value.trim() === '') return 0
  return parseFloat(value.replace(',', '.')) || 0
}

function formatDecimal(value: string): string {
  const num = parseDecimal(value)
  return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ROWS_PER_PAGE = 50

// Inline editable cell
function EditableCell({
  value,
  type,
  onSave
}: {
  value: string
  type: ColumnDef['type']
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
    if (editValue !== value) {
      onSave(editValue)
    }
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

  const isNipBrak = type === 'nip' && (value === 'brak' || value === '')
  const displayValue = type === 'decimal' ? formatDecimal(value) : value

  return (
    <span
      onClick={handleStartEdit}
      className={`cursor-pointer hover:bg-bg-hover px-1 py-0.5 rounded transition-colors ${
        isNipBrak ? 'text-warning bg-warning/10 rounded px-1.5' : ''
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
  columns: ColumnDef[]
}): React.JSX.Element {
  const summableColumns = columns.filter((c) => c.summable)

  const sums = useMemo(() => {
    return summableColumns.map((col) => {
      const total = file.rows.reduce((acc, row) => acc + parseDecimal(row[col.dataIndex] || ''), 0)
      return { label: col.label, total }
    })
  }, [file.rows, summableColumns])

  const nipBrakCount = useMemo(() => {
    const nipCol = columns.find((c) => c.type === 'nip')
    if (!nipCol) return 0
    return file.rows.filter((row) => {
      const v = row[nipCol.dataIndex] || ''
      return v === 'brak' || v === ''
    }).length
  }, [file.rows, columns])

  return (
    <div className="flex items-center gap-6 px-4 py-2.5 bg-bg-card border-t border-border text-xs">
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
          {nipBrakCount}x NIP „brak"
        </span>
      )}
    </div>
  )
}

function DataTable({ file }: { file: ParsedFile }): React.JSX.Element {
  const columns = getColumnsForType(file.jpkType)
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(file.rowCount / ROWS_PER_PAGE)

  const pageRows = useMemo(() => {
    const start = page * ROWS_PER_PAGE
    return file.rows.slice(start, start + ROWS_PER_PAGE)
  }, [file.rows, page])

  const handleCellEdit = useCallback(
    (rowIndex: number, colIndex: number, newValue: string) => {
      const globalRow = page * ROWS_PER_PAGE + rowIndex
      // Mutate in place — rows are owned by importStore
      file.rows[globalRow][colIndex] = newValue
    },
    [file.rows, page]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-card">
              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border w-10">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border ${col.width || ''}`}
                >
                  {col.label}
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
                  <td className="px-2 py-1.5 text-xs text-text-muted font-mono">
                    {globalIdx + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 text-xs font-mono text-text-primary ${col.width || ''}`}
                    >
                      <EditableCell
                        value={row[col.dataIndex] || ''}
                        type={col.type}
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

      {/* Summary bar */}
      <SummaryBar file={file} columns={columns} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 bg-bg-app border-t border-border">
          <span className="text-xs text-text-muted">
            Strona {page + 1} z {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page === totalPages - 1}
              className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
  const [activeFileId, setActiveFileId] = useState<string>(files[0]?.id || '')

  const activeFile = files.find((f) => f.id === activeFileId) || files[0]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header + tabs */}
      <div className="px-6 pt-5 pb-0">
        <h1 className="text-xl font-semibold text-text-primary mb-1">Podgląd danych</h1>
        <p className="text-sm text-text-secondary mb-4">
          Sprawdź dane przed walidacją — kliknij komórkę aby edytować
        </p>

        {/* Tabs */}
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

      {/* Table */}
      {activeFile ? (
        <DataTable file={activeFile} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          Brak zaimportowanych plików
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 flex justify-between border-t border-border bg-bg-app">
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
