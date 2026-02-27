import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Clock,
  Download,
  Trash2,
  Filter,
  FileText,
  Check,
  AlertTriangle,
  Search
} from 'lucide-react'
import { useHistoryStore, type ConversionRecord } from '@renderer/stores/historyStore'
import type { JpkType } from '@renderer/types'

const JPK_LABELS: Record<JpkType, string> = {
  JPK_VDEK: 'V7M',
  JPK_FA: 'FA',
  JPK_MAG: 'MAG',
  JPK_WB: 'WB'
}

const JPK_COLORS: Record<JpkType, string> = {
  JPK_VDEK: 'bg-accent/15 text-accent',
  JPK_FA: 'bg-purple-500/15 text-purple-400',
  JPK_MAG: 'bg-amber-500/15 text-amber-400',
  JPK_WB: 'bg-cyan-500/15 text-cyan-400'
}

const ALL_TYPES: JpkType[] = ['JPK_VDEK', 'JPK_FA', 'JPK_MAG', 'JPK_WB']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Toast({ message, onDone }: { message: string; onDone: () => void }): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-success/90 text-white text-sm font-medium rounded-lg shadow-lg flex items-center gap-2 animate-in">
      <Check className="w-4 h-4" />
      {message}
    </div>
  )
}

function RecordRow({
  record,
  onReDownload,
  onRemove
}: {
  record: ConversionRecord
  onReDownload: (record: ConversionRecord) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 bg-bg-card rounded-xl border border-border hover:border-border-active transition-colors">
      {/* JPK type badge */}
      <span
        className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold ${JPK_COLORS[record.jpkType]}`}
      >
        {JPK_LABELS[record.jpkType]}
      </span>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {record.fileName}
          </span>
          <span className="text-xs text-text-muted">v{record.schemaVersion}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-text-secondary">{record.companyName}</span>
          <span className="text-xs text-text-muted font-mono">{record.companyNip}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="shrink-0 text-right">
        <div className="text-xs text-text-secondary">{formatDate(record.date)}</div>
        <div className="text-[10px] text-text-muted mt-0.5">
          {record.rowCount.toLocaleString('pl-PL')} wierszy &middot;{' '}
          {formatBytes(record.fileSize)}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1">
        <button
          onClick={() => onReDownload(record)}
          className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          title="Pobierz ponownie"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={() => onRemove(record.id)}
          className="p-2 rounded-lg text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
          title="Usuń z historii"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function HistoryStep(): React.JSX.Element {
  const { records, removeRecord, clearHistory } = useHistoryStore()
  const [toast, setToast] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<JpkType | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let list = records
    if (filterType !== 'ALL') {
      list = list.filter((r) => r.jpkType === filterType)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (r) =>
          r.fileName.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q) ||
          r.companyNip.includes(q)
      )
    }
    return list
  }, [records, filterType, searchQuery])

  const handleReDownload = useCallback(async (record: ConversionRecord) => {
    const savedPath = await window.api.saveFile(record.fileName, record.xmlOutput)
    if (savedPath) {
      setToast(`Zapisano: ${savedPath}`)
    }
  }, [])

  const handleRemove = useCallback(
    (id: string) => {
      removeRecord(id)
    },
    [removeRecord]
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Historia konwersji</h1>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Poprzednie eksporty XML — pobierz ponownie lub usuń
        </p>

        {/* Filters */}
        <div className="flex items-center gap-3 pb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Szukaj po nazwie, firmie, NIP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-bg-input border border-border text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterType === 'ALL'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
              }`}
            >
              Wszystkie
            </button>
            {ALL_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterType === type
                    ? JPK_COLORS[type]
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {JPK_LABELS[type]}
              </button>
            ))}
          </div>

          {/* Clear all */}
          {records.length > 0 && (
            <button
              onClick={clearHistory}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-error hover:bg-error/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Wyczyść historię
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filtered.map((record) => (
              <RecordRow
                key={record.id}
                record={record}
                onReDownload={handleReDownload}
                onRemove={handleRemove}
              />
            ))}
          </div>
        ) : records.length > 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <AlertTriangle className="w-10 h-10 text-text-muted" />
            <p className="text-sm text-text-secondary">
              Brak wyników dla wybranych filtrów
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <FileText className="w-10 h-10 text-text-muted" />
            <p className="text-sm text-text-secondary">Brak historii konwersji</p>
            <p className="text-xs text-text-muted">
              Po zapisaniu pliku XML pojawi się tutaj wpis
            </p>
          </div>
        )}
      </div>

      {/* Footer - stats */}
      {records.length > 0 && (
        <div className="px-6 py-2.5 border-t border-border bg-bg-app">
          <span className="text-xs text-text-muted">
            {filtered.length === records.length
              ? `${records.length} ${records.length === 1 ? 'konwersja' : records.length < 5 ? 'konwersje' : 'konwersji'}`
              : `${filtered.length} z ${records.length} konwersji`}
          </span>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
