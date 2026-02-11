import { useState, useCallback, type DragEvent } from 'react'
import {
  Upload,
  FileText,
  FolderOpen,
  X,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
  Package,
  Info
} from 'lucide-react'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore } from '@renderer/stores/appStore'
import { parseTxtFile } from '@renderer/utils/fileParser'
import type { ParsedFile, JpkType } from '@renderer/types'

const JPK_BADGE_CONFIG: Record<JpkType, { label: string; className: string; icon: typeof FileText }> = {
  JPK_VDEK: { label: 'V7M', className: 'bg-accent/15 text-accent', icon: FileText },
  JPK_FA: { label: 'FA', className: 'bg-purple-500/15 text-purple-400', icon: FileSpreadsheet },
  JPK_MAG: { label: 'MAG', className: 'bg-amber-500/15 text-amber-400', icon: Package }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileCard({ file, onRemove }: { file: ParsedFile; onRemove: () => void }): React.JSX.Element {
  const badge = JPK_BADGE_CONFIG[file.jpkType]
  const Icon = badge.icon

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-bg-card rounded-lg border border-border hover:border-border-active transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-bg-hover flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-text-secondary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-text-primary truncate font-mono">
            {file.filename}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{file.rowCount.toLocaleString('pl-PL')} wierszy</span>
          <span>{file.columnCount} kolumn</span>
          {file.fileSize > 0 && <span>{formatFileSize(file.fileSize)}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-bg-hover text-text-secondary">
          {file.system}
        </span>
      </div>

      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/15 hover:text-error text-text-muted transition-all"
        aria-label="Usuń plik"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function AutoDetectPanel({ files }: { files: ParsedFile[] }): React.JSX.Element {
  if (files.length === 0) return <></>

  const first = files[0]
  const systems = [...new Set(files.map((f) => f.system))]
  const points = [...new Set(files.map((f) => f.pointCode))]

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-accent-subtle rounded-lg border border-accent/20">
      <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span className="text-text-secondary">
          Separator: <span className="text-text-primary font-mono">|</span> (pipe)
        </span>
        <span className="text-text-secondary">
          System: <span className="text-text-primary">{systems.join(', ')}</span>
        </span>
        <span className="text-text-secondary">
          Punkt: <span className="text-text-primary">{points.join(', ')}</span>
        </span>
        <span className="text-text-secondary">
          Okres:{' '}
          <span className="text-text-primary">
            {first.dateFrom} — {first.dateTo}
          </span>
        </span>
      </div>
    </div>
  )
}

export function ImportStep(): React.JSX.Element {
  const { files, addFile, removeFile } = useImportStore()
  const { setCurrentStep } = useAppStore()
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFileContent = useCallback(
    (content: string, filename: string, size: number) => {
      try {
        const parsed = parseTxtFile(content, filename, size)
        const alreadyImported = files.some((f) => f.filename === filename)
        if (alreadyImported) {
          setError(`Plik "${filename}" jest już zaimportowany`)
          return
        }
        addFile(parsed)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Błąd parsowania pliku')
      }
    },
    [files, addFile]
  )

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)

      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith('.txt')
      )

      if (droppedFiles.length === 0) {
        setError('Upuść pliki w formacie .txt')
        return
      }

      for (const file of droppedFiles) {
        const content = await file.text()
        processFileContent(content, file.name, file.size)
      }
    },
    [processFileContent]
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleOpenDialog = useCallback(async () => {
    const paths = await window.api.openFileDialog()
    for (const filePath of paths) {
      const filename = filePath.split(/[/\\]/).pop() || filePath
      const { content, size } = await window.api.readFile(filePath)
      processFileContent(content, filename, size)
    }
  }, [processFileContent])

  return (
    <div className="flex-1 flex flex-col p-6 gap-5 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Import plików</h1>
        <p className="text-sm text-text-secondary">
          Przeciągnij pliki TXT lub kliknij aby wybrać z dysku
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleOpenDialog}
        className={`flex flex-col items-center justify-center gap-3 py-12 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          isDragOver
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-text-muted hover:bg-bg-card/50'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
            isDragOver ? 'bg-accent/15' : 'bg-bg-card'
          }`}
        >
          {isDragOver ? (
            <Upload className="w-5 h-5 text-accent" />
          ) : (
            <FolderOpen className="w-5 h-5 text-text-muted" />
          )}
        </div>
        <div className="text-center">
          <p className={`text-sm font-medium ${isDragOver ? 'text-accent' : 'text-text-primary'}`}>
            {isDragOver ? 'Upuść pliki tutaj' : 'Przeciągnij pliki TXT tutaj'}
          </p>
          <p className="text-xs text-text-muted mt-1">lub kliknij aby wybrać z dysku</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-error/10 border border-error/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-error shrink-0" />
          <span className="text-sm text-error">{error}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Zaimportowane pliki ({files.length})
          </h2>
          {files.map((file) => (
            <FileCard key={file.id} file={file} onRemove={() => removeFile(file.id)} />
          ))}
        </div>
      )}

      {/* Auto-detect panel */}
      <AutoDetectPanel files={files} />

      {/* Footer with Next button */}
      <div className="mt-auto pt-4 flex justify-end">
        <button
          onClick={() => setCurrentStep(2)}
          disabled={files.length === 0}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            files.length > 0
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-bg-hover text-text-muted cursor-not-allowed'
          }`}
        >
          Dalej
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
