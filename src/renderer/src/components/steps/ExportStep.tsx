import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ChevronLeft,
  Download,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  Package,
  FileCode2,
  HardDrive
} from 'lucide-react'
import { useImportStore } from '@renderer/stores/importStore'
import { useCompanyStore } from '@renderer/stores/companyStore'
import { useAppStore } from '@renderer/stores/appStore'
import { useHistoryStore } from '@renderer/stores/historyStore'
import { generateVdekXml, getVdekSummary } from '@renderer/utils/xmlGenerator'
import { generateFaXml, getFaSummary } from '@renderer/utils/faGenerator'
import { generateMagXml, getMagSummary } from '@renderer/utils/magGenerator'
import type { XmlSummary } from '@renderer/utils/xmlGenerator'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Simple XML syntax highlighting
function XmlHighlight({ xml }: { xml: string }): React.JSX.Element {
  const lines = xml.split('\n')

  return (
    <pre className="text-xs font-mono leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="w-10 shrink-0 text-right pr-3 text-text-muted select-none">
            {i + 1}
          </span>
          <span>
            <HighlightedLine line={line} />
          </span>
        </div>
      ))}
    </pre>
  )
}

function HighlightedLine({ line }: { line: string }): React.JSX.Element {
  const parts: React.JSX.Element[] = []
  let remaining = line
  let key = 0

  while (remaining.length > 0) {
    // XML declaration or processing instruction
    const piMatch = remaining.match(/^(<\?[^?]*\?>)/)
    if (piMatch) {
      parts.push(
        <span key={key++} className="text-text-muted">
          {piMatch[1]}
        </span>
      )
      remaining = remaining.slice(piMatch[1].length)
      continue
    }

    // Closing tag
    const closeMatch = remaining.match(/^(<\/[a-zA-Z_][\w.:_-]*>)/)
    if (closeMatch) {
      parts.push(
        <span key={key++} className="text-accent">
          {closeMatch[1]}
        </span>
      )
      remaining = remaining.slice(closeMatch[1].length)
      continue
    }

    // Opening tag (with optional attributes)
    const openMatch = remaining.match(/^(<[a-zA-Z_][\w.:_-]*)/)
    if (openMatch) {
      parts.push(
        <span key={key++} className="text-accent">
          {openMatch[1]}
        </span>
      )
      remaining = remaining.slice(openMatch[1].length)

      // Attributes
      while (remaining.length > 0) {
        const attrMatch = remaining.match(/^(\s+)([a-zA-Z_][\w.:_-]*)(=")([^"]*)(")/)
        if (attrMatch) {
          parts.push(
            <span key={key++} className="text-text-primary">
              {attrMatch[1]}
            </span>
          )
          parts.push(
            <span key={key++} className="text-warning">
              {attrMatch[2]}
            </span>
          )
          parts.push(
            <span key={key++} className="text-text-muted">
              {attrMatch[3]}
            </span>
          )
          parts.push(
            <span key={key++} className="text-success">
              {attrMatch[4]}
            </span>
          )
          parts.push(
            <span key={key++} className="text-text-muted">
              {attrMatch[5]}
            </span>
          )
          remaining = remaining.slice(attrMatch[0].length)
          continue
        }

        // End of opening tag
        const endTagMatch = remaining.match(/^(\s*\/?>)/)
        if (endTagMatch) {
          parts.push(
            <span key={key++} className="text-accent">
              {endTagMatch[1]}
            </span>
          )
          remaining = remaining.slice(endTagMatch[1].length)
        }
        break
      }
      continue
    }

    // Text content (between tags)
    const textMatch = remaining.match(/^([^<]+)/)
    if (textMatch) {
      parts.push(
        <span key={key++} className="text-text-primary">
          {textMatch[1]}
        </span>
      )
      remaining = remaining.slice(textMatch[1].length)
      continue
    }

    // Fallback: single character
    parts.push(
      <span key={key++} className="text-text-primary">
        {remaining[0]}
      </span>
    )
    remaining = remaining.slice(1)
  }

  return <>{parts}</>
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

type TabType = 'JPK_VDEK' | 'JPK_FA' | 'JPK_MAG'

export function ExportStep(): React.JSX.Element {
  const { files } = useImportStore()
  const { company, period } = useCompanyStore()
  const { setCurrentStep } = useAppStore()
  const { addRecord } = useHistoryStore()

  const [toast, setToast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Find available files per type
  const vdekFile = files.find((f) => f.jpkType === 'JPK_VDEK')
  const faFile = files.find((f) => f.jpkType === 'JPK_FA')
  const magFile = files.find((f) => f.jpkType === 'JPK_MAG')

  // Build available tabs (only for actually imported files)
  const availableTabs: { type: TabType; file: ParsedFile }[] = []
  if (vdekFile) availableTabs.push({ type: 'JPK_VDEK', file: vdekFile })
  if (faFile) availableTabs.push({ type: 'JPK_FA', file: faFile })
  if (magFile) availableTabs.push({ type: 'JPK_MAG', file: magFile })

  const [activeTab, setActiveTab] = useState<TabType | null>(
    availableTabs.length > 0 ? availableTabs[0].type : null
  )

  // Update active tab if files change and current tab is no longer available
  const activeTabEntry = availableTabs.find((t) => t.type === activeTab)
  const activeFile = activeTabEntry?.file ?? null

  // Generate XML for the active file
  const xml = useMemo(() => {
    if (!activeFile) return ''
    if (activeTab === 'JPK_VDEK') return generateVdekXml(activeFile, company, period)
    if (activeTab === 'JPK_FA') return generateFaXml(activeFile, company, period)
    if (activeTab === 'JPK_MAG') return generateMagXml(activeFile, company, period)
    return ''
  }, [activeFile, activeTab, company, period])

  const summary = useMemo(() => {
    if (!activeFile) return null
    let s: XmlSummary
    if (activeTab === 'JPK_VDEK') s = getVdekSummary(activeFile, company, period)
    else if (activeTab === 'JPK_FA') s = getFaSummary(activeFile, company, period)
    else if (activeTab === 'JPK_MAG') s = getMagSummary(activeFile, company, period)
    else return null
    s.fileSize = new Blob([xml]).size
    return s
  }, [activeFile, activeTab, company, period, xml])

  const handleSave = useCallback(async () => {
    if (!summary || !xml || !activeFile || !activeTab) return
    const savedPath = await window.api.saveFile(summary.filename, xml)
    if (savedPath) {
      setToast(`Zapisano: ${savedPath}`)
      addRecord({
        jpkType: activeFile.jpkType,
        subType: activeFile.subType,
        sourceFilename: activeFile.filename,
        outputFilename: summary.filename,
        rowCount: summary.rowCount,
        companyNip: company.nip,
        companyName: company.fullName,
        period: `${period.year}-${String(period.month).padStart(2, '0')}`
      })
    }
  }, [summary, xml, activeFile, activeTab, company, period, addRecord])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(xml)
    setCopied(true)
    setToast('XML skopiowany do schowka')
    setTimeout(() => setCopied(false), 2000)
  }, [xml])

  // Empty state — no exportable files
  if (availableTabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <FileText className="w-12 h-12 text-text-muted" />
        <p className="text-sm text-text-secondary">Brak pliku do eksportu</p>
        <button
          onClick={() => setCurrentStep(1)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
        >
          Wróć do importu
        </button>
      </div>
    )
  }

  // Value label per type
  const valueLabel =
    activeTab === 'JPK_VDEK' ? 'VAT:' : activeTab === 'JPK_FA' ? 'Brutto:' : 'Wartość WZ:'

  // Tab icon helper
  function tabIcon(type: TabType): React.JSX.Element {
    if (type === 'JPK_VDEK') return <FileText className="w-3.5 h-3.5" />
    if (type === 'JPK_FA') return <FileSpreadsheet className="w-3.5 h-3.5" />
    return <Package className="w-3.5 h-3.5" />
  }

  function tabLabel(type: TabType): string {
    if (type === 'JPK_VDEK') return 'JPK V7M'
    if (type === 'JPK_FA') return 'JPK FA'
    return 'JPK MAG'
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <FileCode2 className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Eksport XML</h1>
        </div>
        <p className="text-sm text-text-secondary mb-3">
          Podgląd wygenerowanego pliku JPK
        </p>

        {/* Tabs — only shown when more than one file type is imported */}
        {availableTabs.length > 1 && (
          <div className="flex gap-1 mb-4">
            {availableTabs.map(({ type }) => (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === type
                    ? 'bg-accent text-white'
                    : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-border-active'
                }`}
              >
                {tabIcon(type)}
                {tabLabel(type)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info cards */}
      {summary && (
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded-lg border border-border">
              <FileText className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs text-text-secondary">
                Plik:{' '}
                <span className="font-mono font-medium text-text-primary">{summary.filename}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded-lg border border-border">
              <HardDrive className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs text-text-secondary">
                Rozmiar:{' '}
                <span className="font-mono font-medium text-text-primary">
                  {formatBytes(summary.fileSize)}
                </span>
              </span>
            </div>
            <div className="px-3 py-2 bg-bg-card rounded-lg border border-border">
              <span className="text-xs text-text-secondary">
                Wierszy:{' '}
                <span className="font-mono font-medium text-text-primary">
                  {summary.rowCount.toLocaleString('pl-PL')}
                </span>
              </span>
            </div>
            <div className="px-3 py-2 bg-bg-card rounded-lg border border-border">
              <span className="text-xs text-text-secondary">
                {valueLabel}{' '}
                <span className="font-mono font-medium text-text-primary">
                  {summary.vatTotal.toLocaleString('pl-PL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{' '}
                  PLN
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* XML Preview */}
      <div className="flex-1 mx-6 mb-4 overflow-auto bg-bg-card rounded-xl border border-border p-4">
        <XmlHighlight xml={xml} />
      </div>

      {/* Footer */}
      <div className="px-6 py-3 flex justify-between items-center border-t border-border bg-bg-app">
        <button
          onClick={() => setCurrentStep(4)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Wstecz
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border hover:border-border-active transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Skopiowano' : 'Kopiuj XML'}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Zapisz XML
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
