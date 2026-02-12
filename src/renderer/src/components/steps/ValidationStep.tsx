import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ShieldCheck,
  FileText
} from 'lucide-react'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore } from '@renderer/stores/appStore'
import {
  validateFiles,
  type ValidationReport,
  type ValidationLevel,
  type ValidationItem,
  type Severity
} from '@renderer/utils/validator'
import type { JpkType } from '@renderer/types'

const SEVERITY_CONFIG: Record<Severity, { icon: typeof CheckCircle2; color: string; bg: string }> =
  {
    error: { icon: XCircle, color: 'text-error', bg: 'bg-error/10' },
    warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
    info: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' }
  }

const TAB_LABELS: Record<JpkType, string> = {
  JPK_VDEK: 'V7M',
  JPK_FA: 'FA',
  JPK_MAG: 'MAG'
}

function SeverityIcon({
  severity,
  className = 'w-4 h-4'
}: {
  severity: Severity
  className?: string
}): React.JSX.Element {
  const config = SEVERITY_CONFIG[severity]
  const Icon = config.icon
  return <Icon className={`${className} ${config.color}`} />
}

function ValidationItemRow({ item }: { item: ValidationItem }): React.JSX.Element {
  const config = SEVERITY_CONFIG[item.severity]

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 rounded-lg ${config.bg}`}>
      <SeverityIcon severity={item.severity} className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-text-primary">{item.message}</span>
        {item.details && (
          <span className="text-xs text-text-muted break-words">{item.details}</span>
        )}
      </div>
    </div>
  )
}

function LevelCard({ level }: { level: ValidationLevel }): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)

  const errorCount = level.items.filter((i) => i.severity === 'error').length
  const warningCount = level.items.filter((i) => i.severity === 'warning').length

  const levelIcon =
    errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : ('info' as Severity)

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <SeverityIcon severity={levelIcon} />
          <span className="text-sm font-semibold text-text-primary">
            Poziom {level.level} — {level.title}
          </span>
          {errorCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error/15 text-error">
              {errorCount} {errorCount === 1 ? 'błąd' : errorCount < 5 ? 'błędy' : 'błędów'}
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 text-warning">
              {warningCount}{' '}
              {warningCount === 1
                ? 'ostrzeżenie'
                : warningCount < 5
                  ? 'ostrzeżenia'
                  : 'ostrzeżeń'}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* Items */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-1.5">
          {level.items.map((item) => (
            <ValidationItemRow key={item.id} item={item} />
          ))}
          {level.items.length === 0 && (
            <div className="px-4 py-3 text-xs text-text-muted">Brak wyników do wyświetlenia</div>
          )}
        </div>
      )}
    </div>
  )
}

function FileReport({
  fileId,
  filename,
  jpkType,
  report
}: {
  fileId: string
  filename: string
  jpkType: JpkType
  report: ValidationReport
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3" key={fileId}>
      {/* File header */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-text-primary">{filename}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent">
          {TAB_LABELS[jpkType]}
        </span>
      </div>

      {/* Level cards */}
      {report.levels.map((level) => (
        <LevelCard key={level.level} level={level} />
      ))}
    </div>
  )
}

function SummaryBanner({
  totalErrors,
  totalWarnings
}: {
  totalErrors: number
  totalWarnings: number
}): React.JSX.Element {
  const allClear = totalErrors === 0 && totalWarnings === 0
  const hasErrors = totalErrors > 0

  return (
    <div
      className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
        hasErrors
          ? 'bg-error/5 border-error/20'
          : allClear
            ? 'bg-success/5 border-success/20'
            : 'bg-warning/5 border-warning/20'
      }`}
    >
      {hasErrors ? (
        <XCircle className="w-5 h-5 text-error shrink-0" />
      ) : allClear ? (
        <ShieldCheck className="w-5 h-5 text-success shrink-0" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
      )}
      <div>
        <p className="text-sm font-semibold text-text-primary">
          {hasErrors
            ? `Walidacja nieudana`
            : allClear
              ? 'Walidacja zakończona — brak problemów'
              : 'Walidacja zakończona z ostrzeżeniami'}
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {totalErrors > 0 && (
            <span className="text-error font-medium">
              {totalErrors} {totalErrors === 1 ? 'błąd' : totalErrors < 5 ? 'błędy' : 'błędów'}
            </span>
          )}
          {totalErrors > 0 && totalWarnings > 0 && <span>, </span>}
          {totalWarnings > 0 && (
            <span className="text-warning font-medium">
              {totalWarnings}{' '}
              {totalWarnings === 1
                ? 'ostrzeżenie'
                : totalWarnings < 5
                  ? 'ostrzeżenia'
                  : 'ostrzeżeń'}
            </span>
          )}
          {totalErrors === 0 && totalWarnings === 0 && (
            <span className="text-success">Dane gotowe do eksportu XML</span>
          )}
        </p>
      </div>
    </div>
  )
}

export function ValidationStep(): React.JSX.Element {
  const { files } = useImportStore()
  const { setCurrentStep } = useAppStore()

  const { reports, totalErrors, totalWarnings } = useMemo(() => validateFiles(files), [files])

  const canExport = totalErrors === 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Walidacja danych</h1>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Sprawdzenie poprawności danych przed generowaniem XML
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-6 pb-4 flex flex-col gap-5">
        {/* Summary */}
        <SummaryBanner totalErrors={totalErrors} totalWarnings={totalWarnings} />

        {/* Per-file reports */}
        {files.map((file) => {
          const report = reports.get(file.id)
          if (!report) return null
          return (
            <FileReport
              key={file.id}
              fileId={file.id}
              filename={file.filename}
              jpkType={file.jpkType}
              report={report}
            />
          )
        })}

        {files.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Info className="w-4 h-4" />
              Brak zaimportowanych plików do walidacji
            </div>
          </div>
        )}
      </div>

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
          disabled={!canExport}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            canExport
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-bg-hover text-text-muted cursor-not-allowed'
          }`}
        >
          Eksportuj XML
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
