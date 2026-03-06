import { useState, useCallback, type DragEvent } from 'react'
import {
  Upload,
  FileText,
  FolderOpen,
  X,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  Package,
  Info,
  AlertTriangle,
  Wallet,
  BookOpen,
  GitMerge,
  Download,
  Trash2,
  ShieldCheck,
  ArrowUpCircle,
  CheckCircle2
} from 'lucide-react'
import { mergeJpkFiles } from '../../../../core/JpkMerger'
import { convertJpkVersion, detectUpgradeNeeded } from '../../../../core/JpkVersionConverter'
import { detectJpkLabel } from '@renderer/utils/validator'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore } from '@renderer/stores/appStore'
import { useToast } from '@renderer/stores/toastStore'
import { FormatBadge } from '@renderer/components/shared/FormatBadge'
import type { ParsedFile, JpkType, FileFormat } from '@renderer/types'

const ACCEPTED_EXTENSIONS = ['.txt', '.csv', '.xlsx', '.xls', '.json', '.xml', '.dat', '.tsv', '.epp', '.dbf', '.ods']

const ENCODING_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-8-bom', label: 'UTF-8 BOM' },
  { value: 'windows-1250', label: 'Windows-1250' },
  { value: 'iso-8859-2', label: 'ISO-8859-2' },
  { value: 'cp852', label: 'CP852' }
]

// Text-based file formats that support encoding override
const TEXT_FORMATS: Set<string> = new Set(['txt', 'csv', 'tsv', 'dat'])

const JPK_BADGE_CONFIG: Record<JpkType, { label: string; className: string; icon: typeof FileText }> = {
  JPK_VDEK: { label: 'V7M', className: 'bg-accent/15 text-accent', icon: FileText },
  JPK_FA: { label: 'FA', className: 'bg-purple-500/15 text-purple-400', icon: FileSpreadsheet },
  JPK_MAG: { label: 'MAG', className: 'bg-amber-500/15 text-amber-400', icon: Package },
  JPK_WB: { label: 'WB', className: 'bg-cyan-500/15 text-cyan-400', icon: Wallet },
  JPK_PKPIR: { label: 'PKPiR', className: 'bg-emerald-500/15 text-emerald-400', icon: BookOpen },
  JPK_EWP: { label: 'EWP', className: 'bg-rose-500/15 text-rose-400', icon: BookOpen },
  JPK_KR_PD: { label: 'KR_PD', className: 'bg-indigo-500/15 text-indigo-400', icon: BookOpen },
  JPK_ST: { label: 'ST', className: 'bg-teal-500/15 text-teal-400', icon: BookOpen },
  JPK_ST_KR: { label: 'ST_KR', className: 'bg-sky-500/15 text-sky-400', icon: BookOpen },
  JPK_FA_RR: { label: 'FA_RR', className: 'bg-lime-500/15 text-lime-400', icon: BookOpen },
  JPK_KR: { label: 'KR', className: 'bg-violet-500/15 text-violet-400', icon: BookOpen }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionToFormat(filename: string): FileFormat {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'csv': return 'csv'
    case 'xlsx': case 'xls': return 'xlsx'
    case 'json': return 'json'
    case 'xml': return 'xml'
    default: return 'txt'
  }
}

function isTextFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return TEXT_FORMATS.has(ext)
}

// ── EncodingPreview — shows 5 sample rows for encoding verification ──

function EncodingPreview({ rows }: { rows: string[][] }): React.JSX.Element {
  if (rows.length === 0) return <></>

  return (
    <div className="mt-2 rounded-lg bg-bg-hover/50 border border-border overflow-hidden">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border">
        Podgląd kodowania (5 wierszy)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <tbody>
            {rows.slice(0, 5).map((row, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-1 text-text-muted w-8 text-right shrink-0">{i + 1}</td>
                {row.slice(0, 8).map((cell, j) => (
                  <td key={j} className="px-2 py-1 text-text-secondary truncate max-w-[120px]">
                    {cell || '—'}
                  </td>
                ))}
                {row.length > 8 && (
                  <td className="px-2 py-1 text-text-muted">…</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── FileCard — single imported file with encoding controls ──

function FileCard({
  file,
  onRemove,
  onEncodingChange,
  isReloading
}: {
  file: ParsedFile
  onRemove: () => void
  onEncodingChange: (encoding: string) => void
  isReloading: boolean
}): React.JSX.Element {
  const badge = JPK_BADGE_CONFIG[file.jpkType] || JPK_BADGE_CONFIG.JPK_VDEK
  const [showPreview, setShowPreview] = useState(false)
  const [selectedEncoding, setSelectedEncoding] = useState(file.encoding || 'auto')
  const canChangeEncoding = isTextFormat(file.filename)

  const handleEncodingChange = (encoding: string): void => {
    setSelectedEncoding(encoding)
    onEncodingChange(encoding)
    setShowPreview(true)
  }

  return (
    <div>
      <div className="flex items-center gap-4 px-4 py-3 bg-bg-card rounded-lg border border-border hover:border-border-active transition-colors group">
        <div className="w-9 h-9 rounded-lg bg-bg-hover flex items-center justify-center shrink-0">
          <badge.icon className="w-4 h-4 text-text-secondary" />
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
          {file.format && <FormatBadge format={file.format} />}

          {/* Encoding dropdown */}
          {canChangeEncoding ? (
            <select
              value={selectedEncoding}
              onChange={(e) => handleEncodingChange(e.target.value)}
              disabled={isReloading}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-bg-hover border border-border text-text-secondary focus:border-accent focus:outline-none disabled:opacity-50 cursor-pointer"
              title="Kodowanie pliku"
            >
              {ENCODING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            file.encoding && (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-bg-hover text-text-muted">
                {file.encoding}
              </span>
            )
          )}

          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-bg-hover text-text-secondary">
            {file.system}
          </span>

          {/* Preview toggle for text files */}
          {canChangeEncoding && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title={showPreview ? 'Ukryj podgląd' : 'Pokaż podgląd kodowania'}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showPreview ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/15 hover:text-error text-text-muted transition-all"
          aria-label="Usuń plik"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Encoding preview */}
      {showPreview && canChangeEncoding && (
        <div className="ml-13 mr-4">
          {isReloading ? (
            <div className="mt-2 px-3 py-2 rounded-lg bg-bg-hover/50 border border-border text-xs text-text-muted">
              Przeładowywanie z kodowaniem {selectedEncoding}…
            </div>
          ) : (
            <EncodingPreview rows={file.rows} />
          )}
        </div>
      )}
    </div>
  )
}

function WarningsPanel({ files }: { files: ParsedFile[] }): React.JSX.Element {
  const allWarnings = files.flatMap((f) =>
    (f.warnings || []).map((w) => ({ filename: f.filename, warning: w }))
  )
  if (allWarnings.length === 0) return <></>

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 bg-warning/5 rounded-lg border border-warning/20">
      {allWarnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <span className="text-text-secondary">
            <span className="font-mono text-text-muted">{w.filename}</span>{' '}
            {w.warning}
          </span>
        </div>
      ))}
    </div>
  )
}

function AutoDetectPanel({ files }: { files: ParsedFile[] }): React.JSX.Element {
  if (files.length === 0) return <></>

  const first = files[0]
  const systems = [...new Set(files.map((f) => f.system))]
  const formats = [...new Set(files.map((f) => f.format).filter(Boolean))]

  const hasDates = first.dateFrom && first.dateTo

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-accent-subtle rounded-lg border border-accent/20">
      <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {formats.length > 0 && (
          <span className="text-text-secondary">
            Formaty: <span className="text-text-primary">{formats.join(', ').toUpperCase()}</span>
          </span>
        )}
        <span className="text-text-secondary">
          System: <span className="text-text-primary">{systems.join(', ')}</span>
        </span>
        {hasDates && (
          <span className="text-text-secondary">
            Okres:{' '}
            <span className="text-text-primary">
              {first.dateFrom} — {first.dateTo}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

/** Normalize JPK type aliases (JPK_V7M/JPK_V7K → JPK_VDEK) */
function normalizeJpkType(raw: string): JpkType {
  if (raw === 'JPK_V7M' || raw === 'JPK_V7K') return 'JPK_VDEK'
  return raw as JpkType
}

/** Convert serialized IPC result into a ParsedFile */
function resultToParsedFile(
  result: SerializedFileReadResult,
  filename: string,
  filePath: string
): ParsedFile | null {
  if (result.sheets.length === 0) return null

  const sheet = result.sheets[0]
  const meta = sheet.metadata || {}
  const rows = sheet.rows

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    filename,
    filePath,
    system: (meta.system as ParsedFile['system']) || 'UNKNOWN',
    jpkType: normalizeJpkType(meta.jpkType || 'JPK_VDEK'),
    subType: (meta.subType as ParsedFile['subType']) || 'SprzedazWiersz',
    pointCode: meta.pointCode || '',
    dateFrom: meta.dateFrom || '',
    dateTo: meta.dateTo || '',
    rows,
    rowCount: rows.length,
    columnCount: rows[0]?.length || 0,
    fileSize: result.fileSize,
    format: extensionToFormat(filename),
    encoding: result.encoding,
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
    headers: sheet.headers
  }
}

// ── MergeSection — merge multiple JPK XML files ──

interface MergeFile {
  path: string
  name: string
}

function MergeSection(): React.JSX.Element {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [mergeFiles, setMergeFiles] = useState<MergeFile[]>([])
  const [mergeLoading, setMergeLoading] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)

  const handleSelectFiles = useCallback(async () => {
    const paths = await window.api.openFileDialog()
    const xmlPaths = paths.filter((p) => p.toLowerCase().endsWith('.xml'))
    if (xmlPaths.length === 0) {
      toast.warning('Wybierz pliki XML do scalenia')
      return
    }
    const newFiles = xmlPaths.map((p) => ({
      path: p,
      name: p.split(/[/\\]/).pop() || p,
    }))
    setMergeFiles((prev) => {
      const existingPaths = new Set(prev.map((f) => f.path))
      const unique = newFiles.filter((f) => !existingPaths.has(f.path))
      return [...prev, ...unique]
    })
    setMergeError(null)
  }, [toast])

  const handleRemoveFile = useCallback((path: string) => {
    setMergeFiles((prev) => prev.filter((f) => f.path !== path))
    setMergeError(null)
  }, [])

  const handleClearAll = useCallback(() => {
    setMergeFiles([])
    setMergeError(null)
  }, [])

  const handleMerge = useCallback(async () => {
    if (mergeFiles.length < 2) {
      setMergeError('Wybierz co najmniej 2 pliki do scalenia')
      return
    }

    setMergeLoading(true)
    setMergeError(null)

    try {
      // Read all files
      const contents: string[] = []
      for (const f of mergeFiles) {
        const { content } = await window.api.readFile(f.path)
        contents.push(content)
      }

      // Merge
      const merged = mergeJpkFiles(contents)

      // Save
      const defaultName = `JPK_MERGED_${new Date().toISOString().slice(0, 10)}.xml`
      const savedPath = await window.api.saveFile(defaultName, merged)

      if (savedPath) {
        toast.success(`Scalony plik zapisano: ${savedPath.split(/[/\\]/).pop()}`)
        setMergeFiles([])
      }
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : String(err))
    } finally {
      setMergeLoading(false)
    }
  }, [mergeFiles, toast])

  return (
    <div className="rounded-lg border border-border bg-bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover/50 transition-colors rounded-lg"
      >
        <GitMerge className="w-4 h-4 text-text-muted" />
        <span className="text-sm font-medium text-text-primary flex-1">
          Scalanie plików JPK XML
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-xs text-text-muted">
            Scal wiele plików JPK tego samego typu (ten sam KodFormularza, WariantFormularza i NIP) w jeden plik.
          </p>

          {/* File selection */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectFiles}
              disabled={mergeLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-hover hover:bg-border text-text-secondary transition-colors disabled:opacity-50"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Dodaj pliki XML
            </button>
            {mergeFiles.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Wyczyść
              </button>
            )}
          </div>

          {/* Selected files list */}
          {mergeFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              {mergeFiles.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-hover/50 text-xs group"
                >
                  <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="flex-1 font-mono text-text-secondary truncate">
                    {f.name}
                  </span>
                  <button
                    onClick={() => handleRemoveFile(f.path)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-error/15 hover:text-error text-text-muted transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {mergeError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-error/5 border border-error/20 text-xs text-error">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{mergeError}</span>
            </div>
          )}

          {/* Merge button */}
          <button
            onClick={handleMerge}
            disabled={mergeFiles.length < 2 || mergeLoading}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mergeFiles.length >= 2 && !mergeLoading
                ? 'bg-accent hover:bg-accent-hover text-white'
                : 'bg-bg-hover text-text-muted cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            {mergeLoading ? 'Scalanie...' : `Scal i pobierz (${mergeFiles.length} plików)`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── UpgradeBanner — shown when an imported XML file has an older JPK version ──

interface UpgradeInfo {
  filePath: string
  fileName: string
  label: string
  kodFormularza: string
  currentWariant: string
  targetWariant: string
}

function UpgradeBanner({
  upgrade,
  onUpgrade,
  onDismiss
}: {
  upgrade: UpgradeInfo
  onUpgrade: () => void
  onDismiss: () => void
}): React.JSX.Element {
  const [upgrading, setUpgrading] = useState(false)
  const [changes, setChanges] = useState<string[] | null>(null)

  const handleUpgrade = useCallback(async () => {
    setUpgrading(true)
    try {
      const { content } = await window.api.readFile(upgrade.filePath)
      const result = convertJpkVersion(content)
      setChanges(result.changes)

      // Save upgraded file
      const defaultName = upgrade.fileName.replace(/\.xml$/i, `_v${upgrade.targetWariant}.xml`)
      const savedPath = await window.api.saveFile(defaultName, result.result)
      if (savedPath) {
        onUpgrade()
      }
    } catch {
      setUpgrading(false)
    }
  }, [upgrade, onUpgrade])

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-warning/5 rounded-lg border border-warning/20">
      <div className="flex items-start gap-3">
        <ArrowUpCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">
            Wykryto starszy format {upgrade.label}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Zaktualizować do wersji ({upgrade.targetWariant})? Dodane zostanie oznaczenie KSeF (BFK) i zaktualizowany namespace.
          </p>
        </div>
      </div>

      {changes && (
        <div className="ml-8 flex flex-col gap-1 px-3 py-2 rounded bg-bg-hover/50 text-xs">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-text-secondary">
              <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
              {c}
            </div>
          ))}
        </div>
      )}

      {!changes && (
        <div className="ml-8 flex items-center gap-2">
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            {upgrading ? 'Aktualizowanie...' : 'Zaktualizuj automatycznie'}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            Kontynuuj bez zmiany
          </button>
        </div>
      )}
    </div>
  )
}

// ── ValidateSection — validate an existing JPK XML file ──

function ValidateSection(): React.JSX.Element {
  const toast = useToast()
  const { setMode, setValidationXml, setCurrentStep } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string } | null>(null)
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectFile = useCallback(async () => {
    const paths = await window.api.openFileDialog()
    const xmlPaths = paths.filter((p) => p.toLowerCase().endsWith('.xml'))
    if (xmlPaths.length === 0) {
      toast.warning('Wybierz plik XML do walidacji')
      return
    }
    const filePath = xmlPaths[0]
    const fileName = filePath.split(/[/\\]/).pop() || filePath

    setLoading(true)
    setError(null)
    setDetectedLabel(null)
    try {
      const { content } = await window.api.readFile(filePath)
      const label = detectJpkLabel(content)
      setSelectedFile({ path: filePath, name: fileName })
      setDetectedLabel(label)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleValidate = useCallback(async () => {
    if (!selectedFile) return
    setLoading(true)
    setError(null)
    try {
      const { content } = await window.api.readFile(selectedFile.path)
      setValidationXml(content, detectedLabel)
      setMode('validation')
      setCurrentStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedFile, detectedLabel, setValidationXml, setMode, setCurrentStep])

  const handleClear = useCallback(() => {
    setSelectedFile(null)
    setDetectedLabel(null)
    setError(null)
  }, [])

  return (
    <div className="rounded-lg border border-border bg-bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover/50 transition-colors rounded-lg"
      >
        <ShieldCheck className="w-4 h-4 text-text-muted" />
        <span className="text-sm font-medium text-text-primary flex-1">
          Waliduj plik JPK XML
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-xs text-text-muted">
            Sprawdź poprawność istniejącego pliku JPK XML — strukturę, NIP, sumy kontrolne i zgodność ze schematem XSD.
          </p>

          {/* File selection */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectFile}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-hover hover:bg-border text-text-secondary transition-colors disabled:opacity-50"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Wybierz plik XML
            </button>
            {selectedFile && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-error hover:bg-error/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Selected file */}
          {selectedFile && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-bg-hover/50 text-xs">
              <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <span className="flex-1 font-mono text-text-secondary truncate">
                {selectedFile.name}
              </span>
              {detectedLabel && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-accent/15 text-accent">
                  {detectedLabel}
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-error/5 border border-error/20 text-xs text-error">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Validate button */}
          <button
            onClick={handleValidate}
            disabled={!selectedFile || loading}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFile && !loading
                ? 'bg-accent hover:bg-accent-hover text-white'
                : 'bg-bg-hover text-text-muted cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {loading ? 'Ładowanie...' : 'Waliduj plik'}
          </button>
        </div>
      )}
    </div>
  )
}

export function ImportStep(): React.JSX.Element {
  const { files, addFile, updateFile, removeFile } = useImportStore()
  const { setCurrentStep } = useAppStore()
  const toast = useToast()
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reloadingFileId, setReloadingFileId] = useState<string | null>(null)
  const [pendingUpgrade, setPendingUpgrade] = useState<UpgradeInfo | null>(null)

  const importFile = useCallback(
    async (filePath: string, filename: string) => {
      const alreadyImported = files.some((f) => f.filename === filename)
      if (alreadyImported) {
        toast.warning(`Plik "${filename}" jest już zaimportowany`)
        return
      }

      // Check if XML file needs version upgrade
      if (filename.toLowerCase().endsWith('.xml')) {
        try {
          const { content } = await window.api.readFile(filePath)
          const upgrade = detectUpgradeNeeded(content)
          if (upgrade) {
            setPendingUpgrade({
              filePath,
              fileName: filename,
              label: upgrade.label,
              kodFormularza: upgrade.kodFormularza,
              currentWariant: upgrade.currentWariant,
              targetWariant: upgrade.targetWariant,
            })
          }
        } catch {
          // Ignore detection errors — continue with normal import
        }
      }

      const result = await window.api.parseFile(filePath)
      const parsed = resultToParsedFile(result, filename, filePath)

      if (!parsed) {
        toast.error(`Nie udało się sparsować pliku "${filename}"`)
        return
      }

      addFile(parsed)
      toast.success(`Zaimportowano: ${filename}`)
    },
    [files, addFile, toast]
  )

  const handleEncodingChange = useCallback(
    async (fileId: string, encoding: string) => {
      const file = files.find((f) => f.id === fileId)
      if (!file || !file.filePath) return

      setReloadingFileId(fileId)
      try {
        const result = await window.api.parseFile(
          file.filePath,
          encoding === 'auto' ? undefined : encoding
        )
        const updated = resultToParsedFile(result, file.filename, file.filePath)
        if (updated) {
          updated.id = fileId // keep the same ID
          updateFile(fileId, updated)
        }
      } catch (err) {
        toast.error(
          `Błąd zmiany kodowania: ${err instanceof Error ? err.message : String(err)}`
        )
      } finally {
        setReloadingFileId(null)
      }
    },
    [files, updateFile, toast]
  )

  const handleFilesSelected = useCallback(
    async (filePaths: string[]) => {
      setIsLoading(true)
      try {
        for (const filePath of filePaths) {
          const filename = filePath.split(/[/\\]/).pop() || filePath
          await importFile(filePath, filename)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Błąd parsowania pliku')
      } finally {
        setIsLoading(false)
      }
    },
    [importFile, toast]
  )

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)

      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase()
        return ACCEPTED_EXTENSIONS.includes(ext)
      })

      if (droppedFiles.length === 0) {
        toast.warning(`Obsługiwane formaty: ${ACCEPTED_EXTENSIONS.join(', ')}`)
        return
      }

      setIsLoading(true)
      try {
        for (const file of droppedFiles) {
          // Electron File objects have a `path` property with the full filesystem path
          const filePath = (file as File & { path: string }).path
          if (!filePath) {
            toast.error(`Nie można odczytać ścieżki pliku "${file.name}"`)
            continue
          }
          await importFile(filePath, file.name)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Błąd parsowania pliku')
      } finally {
        setIsLoading(false)
      }
    },
    [importFile, toast]
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
    if (paths.length > 0) {
      await handleFilesSelected(paths)
    }
  }, [handleFilesSelected])

  return (
    <div className="flex-1 flex flex-col p-6 gap-5 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Import plików</h1>
        <p className="text-sm text-text-secondary">
          Przeciągnij pliki lub kliknij aby wybrać z dysku
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
            {isLoading
              ? 'Wczytywanie plików...'
              : isDragOver
                ? 'Upuść pliki tutaj'
                : 'Przeciągnij pliki tutaj'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            TXT, CSV, XLSX, JSON, XML
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Zaimportowane pliki ({files.length})
          </h2>
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onRemove={() => removeFile(file.id)}
              onEncodingChange={(encoding) => handleEncodingChange(file.id, encoding)}
              isReloading={reloadingFileId === file.id}
            />
          ))}
        </div>
      )}

      {/* Upgrade banner */}
      {pendingUpgrade && (
        <UpgradeBanner
          upgrade={pendingUpgrade}
          onUpgrade={() => {
            toast.success('Plik zaktualizowany do najnowszej wersji')
            setPendingUpgrade(null)
          }}
          onDismiss={() => setPendingUpgrade(null)}
        />
      )}

      {/* Warnings */}
      <WarningsPanel files={files} />

      {/* Auto-detect panel */}
      <AutoDetectPanel files={files} />

      {/* Merge section */}
      <MergeSection />

      {/* Validate section */}
      <ValidateSection />

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
