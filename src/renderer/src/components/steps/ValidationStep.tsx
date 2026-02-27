import { useState, useMemo, useCallback } from 'react'
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
  FileText,
  Hash,
  Search,
  Wrench
} from 'lucide-react'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore } from '@renderer/stores/appStore'
import { useMappingStore } from '@renderer/stores/mappingStore'
import {
  validateFiles,
  applyFixes,
  type ValidationReport,
  type ValidationGroup,
  type ValidationItem,
  type AutoFix,
  type Severity
} from '@renderer/utils/validator'
import type { JpkType, ParsedFile } from '@renderer/types'

const SEVERITY_CONFIG: Record<Severity, { icon: typeof CheckCircle2; color: string; bg: string }> =
  {
    error: { icon: XCircle, color: 'text-error', bg: 'bg-error/10' },
    warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
    info: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' }
  }

const CATEGORY_ICONS = {
  STRUKTURA: FileText,
  MERYTORYKA: Search,
  SUMY_KONTROLNE: Hash
}

const TAB_LABELS: Record<JpkType, string> = {
  JPK_VDEK: 'V7M',
  JPK_FA: 'FA',
  JPK_MAG: 'MAG',
  JPK_WB: 'WB'
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

function ValidationItemRow({
  item,
  onApplyFixes
}: {
  item: ValidationItem
  onApplyFixes?: (fixes: AutoFix[]) => void
}): React.JSX.Element {
  const config = SEVERITY_CONFIG[item.severity]

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 rounded-lg ${config.bg}`}>
      <SeverityIcon severity={item.severity} className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-sm text-text-primary">{item.message}</span>
        {item.details && (
          <span className="text-xs text-text-muted break-words">{item.details}</span>
        )}
      </div>
      {item.autoFixable && item.fixes.length > 0 && onApplyFixes && (
        <button
          onClick={() => onApplyFixes(item.fixes)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
        >
          <Wrench className="w-3 h-3" />
          Napraw ({item.fixes.length})
        </button>
      )}
    </div>
  )
}

function GroupCard({
  group,
  onApplyFixes
}: {
  group: ValidationGroup
  onApplyFixes: (fixes: AutoFix[]) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)

  const errorCount = group.items.filter((i) => i.severity === 'error').length
  const warningCount = group.items.filter((i) => i.severity === 'warning').length
  const groupFixCount = group.items.reduce((acc, i) => acc + i.fixes.length, 0)

  const groupSeverity: Severity =
    errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'info'

  const CategoryIcon = CATEGORY_ICONS[group.category]

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CategoryIcon className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-text-primary">{group.title}</span>
          {errorCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error/15 text-error">
              {errorCount} {errorCount === 1 ? 'bład' : errorCount < 5 ? 'błędy' : 'błędów'}
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
        <div className="flex items-center gap-2">
          {groupFixCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const allFixes = group.items.flatMap((i) => i.fixes)
                onApplyFixes(allFixes)
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors"
            >
              <Wrench className="w-3 h-3" />
              Napraw wszystko ({groupFixCount})
            </button>
          )}
          {groupSeverity === 'info' && errorCount === 0 && warningCount === 0 && (
            <CheckCircle2 className="w-4 h-4 text-success" />
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-1.5">
          {group.items.map((item) => (
            <ValidationItemRow key={item.id} item={item} onApplyFixes={onApplyFixes} />
          ))}
          {group.items.length === 0 && (
            <div className="px-4 py-3 text-xs text-text-muted">Brak wyników do wyświetlenia</div>
          )}
        </div>
      )}
    </div>
  )
}

function FileReport({
  file,
  report,
  onApplyFixes
}: {
  file: ParsedFile
  report: ValidationReport
  onApplyFixes: (fixes: AutoFix[]) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-text-primary">{file.filename}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent">
          {TAB_LABELS[file.jpkType]}
        </span>
      </div>

      {report.groups.map((group) => (
        <GroupCard key={group.category} group={group} onApplyFixes={onApplyFixes} />
      ))}
    </div>
  )
}

function SummaryBanner({
  totalErrors,
  totalWarnings,
  totalAutoFixes,
  onFixAll
}: {
  totalErrors: number
  totalWarnings: number
  totalAutoFixes: number
  onFixAll: () => void
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
      <div className="flex-1">
        <p className="text-sm font-semibold text-text-primary">
          {hasErrors
            ? 'Walidacja nieudana'
            : allClear
              ? 'Walidacja zakończona — brak problemów'
              : 'Walidacja zakończona z ostrzeżeniami'}
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {totalErrors > 0 && (
            <span className="text-error font-medium">
              {totalErrors} {totalErrors === 1 ? 'bład' : totalErrors < 5 ? 'błędy' : 'błędów'}
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
      {totalAutoFixes > 0 && (
        <button
          onClick={onFixAll}
          className="shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          <Wrench className="w-3.5 h-3.5" />
          Napraw automatycznie ({totalAutoFixes})
        </button>
      )}
    </div>
  )
}

export function ValidationStep(): React.JSX.Element {
  const { files } = useImportStore()
  const { setCurrentStep } = useAppStore()
  const { activeMappings } = useMappingStore()
  const [fixVersion, setFixVersion] = useState(0)

  const { reports, totalErrors, totalWarnings, totalAutoFixes } = useMemo(
    () => validateFiles(files, activeMappings),
    [files, activeMappings, fixVersion]
  )

  const canExport = totalErrors === 0

  const handleApplyFixes = useCallback(
    (file: ParsedFile, fixes: AutoFix[]) => {
      applyFixes(file, fixes)
      setFixVersion((v) => v + 1)
    },
    []
  )

  const handleFixAll = useCallback(() => {
    for (const file of files) {
      const report = reports.get(file.id)
      if (!report) continue
      const allFixes = report.groups.flatMap((g) => g.items.flatMap((i) => i.fixes))
      if (allFixes.length > 0) {
        applyFixes(file, allFixes)
      }
    }
    setFixVersion((v) => v + 1)
  }, [files, reports])

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
        <SummaryBanner
          totalErrors={totalErrors}
          totalWarnings={totalWarnings}
          totalAutoFixes={totalAutoFixes}
          onFixAll={handleFixAll}
        />

        {/* Per-file reports */}
        {files.map((file) => {
          const report = reports.get(file.id)
          if (!report) return null
          return (
            <FileReport
              key={file.id}
              file={file}
              report={report}
              onApplyFixes={(fixes) => handleApplyFixes(file, fixes)}
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
          onClick={() => setCurrentStep(4)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Wstecz
        </button>
        <button
          onClick={() => setCurrentStep(6)}
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
