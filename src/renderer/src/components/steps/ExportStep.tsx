import { useState, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  FileText,
  FileCode2,
  HardDrive,
  Info,
  Globe,
  Clock
} from 'lucide-react'
import { useImportStore } from '@renderer/stores/importStore'
import { useCompanyStore } from '@renderer/stores/companyStore'
import { useAppStore } from '@renderer/stores/appStore'
import { useMappingStore } from '@renderer/stores/mappingStore'
import { useHistoryStore } from '@renderer/stores/historyStore'
import { useToast } from '@renderer/stores/toastStore'
import { generateXmlForFile, type XmlExportResult } from '@renderer/utils/xmlExporter'
import type { JpkType } from '@renderer/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TAB_LABELS: Record<JpkType, string> = {
  JPK_VDEK: 'V7M',
  JPK_FA: 'FA',
  JPK_MAG: 'MAG',
  JPK_WB: 'WB'
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

    const openMatch = remaining.match(/^(<[a-zA-Z_][\w.:_-]*)/)
    if (openMatch) {
      parts.push(
        <span key={key++} className="text-accent">
          {openMatch[1]}
        </span>
      )
      remaining = remaining.slice(openMatch[1].length)

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

    parts.push(
      <span key={key++} className="text-text-primary">
        {remaining[0]}
      </span>
    )
    remaining = remaining.slice(1)
  }

  return <>{parts}</>
}

export function ExportStep(): React.JSX.Element {
  const { files } = useImportStore()
  const { company, period } = useCompanyStore()
  const { setCurrentStep } = useAppStore()
  const { activeMappings } = useMappingStore()
  const { addRecord } = useHistoryStore()
  const toast = useToast()

  const [copied, setCopied] = useState(false)
  const [activeFileId, setActiveFileId] = useState<string>(files[0]?.id || '')

  const activeFile = files.find((f) => f.id === activeFileId) || files[0]

  // Generate XML for each file
  const results = useMemo(() => {
    const map = new Map<string, XmlExportResult | null>()
    for (const file of files) {
      const mappings = activeMappings[file.id] || []
      map.set(file.id, generateXmlForFile(file, mappings, company, period))
    }
    return map
  }, [files, activeMappings, company, period])

  const activeResult = activeFile ? results.get(activeFile.id) ?? null : null

  const handleSave = useCallback(async () => {
    if (!activeResult) return
    const savedPath = await window.api.saveFile(activeResult.filename, activeResult.xml)
    if (savedPath) {
      addRecord({
        jpkType: activeFile!.jpkType,
        companyName: company.fullName,
        companyNip: company.nip,
        fileName: activeResult.filename,
        schemaVersion: activeResult.schemaVersion,
        rowCount: activeResult.rowCount,
        fileSize: activeResult.fileSize,
        xmlOutput: activeResult.xml
      })
      toast.success(`Zapisano: ${savedPath}`)
    }
  }, [activeResult, activeFile, company, addRecord, toast])

  const handleCopy = useCallback(async () => {
    if (!activeResult) return
    await navigator.clipboard.writeText(activeResult.xml)
    setCopied(true)
    toast.success('XML skopiowany do schowka')
    setTimeout(() => setCopied(false), 2000)
  }, [activeResult, toast])

  const handleSaveAll = useCallback(async () => {
    let saved = 0
    for (const file of files) {
      const result = results.get(file.id)
      if (!result) continue
      const savedPath = await window.api.saveFile(result.filename, result.xml)
      if (savedPath) {
        addRecord({
          jpkType: file.jpkType,
          companyName: company.fullName,
          companyNip: company.nip,
          fileName: result.filename,
          schemaVersion: result.schemaVersion,
          rowCount: result.rowCount,
          fileSize: result.fileSize,
          xmlOutput: result.xml
        })
        saved++
      }
    }
    if (saved > 0) {
      toast.success(`Zapisano ${saved} ${saved === 1 ? 'plik' : saved < 5 ? 'pliki' : 'plików'} XML`)
    }
  }, [files, results, company, addRecord, toast])

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <FileText className="w-12 h-12 text-text-muted" />
        <p className="text-sm text-text-secondary">Brak plików do eksportu</p>
        <button
          onClick={() => setCurrentStep(1)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
        >
          Wróć do importu
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <FileCode2 className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Eksport XML</h1>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Podgląd wygenerowanych plików JPK
        </p>

        {/* File tabs */}
        {files.length > 1 && (
          <div className="flex gap-1 border-b border-border">
            {files.map((file) => {
              const isActive = file.id === activeFile?.id
              const result = results.get(file.id)
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
                  <span className="text-text-muted">
                    ({result ? formatBytes(result.fileSize) : 'brak'})
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {activeResult ? (
        <>
          {/* Info cards */}
          <div className="px-6 py-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded-lg border border-border">
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs text-text-secondary">
                  Plik:{' '}
                  <span className="font-mono font-medium text-text-primary">
                    {activeResult.filename}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded-lg border border-border">
                <HardDrive className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-secondary">
                  Rozmiar:{' '}
                  <span className="font-mono font-medium text-text-primary">
                    {formatBytes(activeResult.fileSize)}
                  </span>
                </span>
              </div>
              <div className="px-3 py-2 bg-bg-card rounded-lg border border-border">
                <span className="text-xs text-text-secondary">
                  Wierszy:{' '}
                  <span className="font-mono font-medium text-text-primary">
                    {activeResult.rowCount.toLocaleString('pl-PL')}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded-lg border border-border">
                <Globe className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-secondary">
                  Schemat:{' '}
                  <span className="font-mono font-medium text-text-primary">
                    {activeResult.jpkType} v{activeResult.schemaVersion}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* XML Preview */}
          <div className="flex-1 mx-6 mb-4 overflow-auto bg-bg-card rounded-xl border border-border p-4">
            <XmlHighlight xml={activeResult.xml} />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Info className="w-4 h-4" />
            Brak generatora dla tego typu JPK
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 flex justify-between items-center border-t border-border bg-bg-app">
        <button
          onClick={() => setCurrentStep(5)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Wstecz
        </button>

        <div className="flex items-center gap-2">
          {activeResult && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border hover:border-border-active transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Skopiowano' : 'Kopiuj XML'}
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                Zapisz XML
              </button>
            </>
          )}
          {files.length > 1 && (
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              Zapisz wszystkie
            </button>
          )}
          <button
            onClick={() => setCurrentStep(7)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-card border border-border hover:border-border-active transition-colors"
          >
            <Clock className="w-4 h-4" />
            Historia
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  )
}
