import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Link2,
  Unlink
} from 'lucide-react'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore } from '@renderer/stores/appStore'
import { useMappingStore } from '@renderer/stores/mappingStore'
import { getFieldDefinitions, type JpkFieldDef } from '../../../../core/mapping/JpkFieldDefinitions'
import type { ColumnMapping } from '../../../../core/mapping/AutoMapper'

const SAMPLE_COUNT = 5

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-success'
  if (confidence >= 0.5) return 'text-warning'
  return 'text-error'
}

function confidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'bg-success/10 border-success/30'
  if (confidence >= 0.5) return 'bg-warning/10 border-warning/30'
  return 'bg-error/10 border-error/30'
}

function SourceColumn({
  index,
  header,
  samples,
  mapping,
  isSelected,
  onClick
}: {
  index: number
  header?: string
  samples: string[]
  mapping?: ColumnMapping
  isSelected: boolean
  onClick: () => void
}): React.JSX.Element {
  const isMapped = !!mapping

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        isSelected
          ? 'border-accent bg-accent/10'
          : isMapped
            ? `border ${confidenceBg(mapping!.confidence)}`
            : 'border-border bg-bg-card hover:border-border-active'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-text-muted uppercase">
            Kol {index}
          </span>
          {header && (
            <span className="text-xs font-medium text-text-primary truncate max-w-[140px]">
              {header}
            </span>
          )}
        </div>
        {isMapped && (
          <div className="flex items-center gap-1">
            <Link2 className={`w-3 h-3 ${confidenceColor(mapping!.confidence)}`} />
            <span className={`text-[10px] font-bold ${confidenceColor(mapping!.confidence)}`}>
              {Math.round(mapping!.confidence * 100)}%
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {samples.slice(0, SAMPLE_COUNT).map((val, i) => (
          <span key={i} className="text-[11px] font-mono text-text-muted truncate">
            {val || '—'}
          </span>
        ))}
      </div>
    </button>
  )
}

function TargetField({
  field,
  mapping,
  isSelected,
  onClick
}: {
  field: JpkFieldDef
  mapping?: ColumnMapping
  isSelected: boolean
  onClick: () => void
}): React.JSX.Element {
  const isMapped = !!mapping

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        isSelected
          ? 'border-accent bg-accent/10'
          : isMapped
            ? `border ${confidenceBg(mapping!.confidence)}`
            : field.required
              ? 'border-error/30 bg-error/5 hover:border-error/50'
              : 'border-border bg-bg-card hover:border-border-active'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {field.required && !isMapped && (
            <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
          )}
          {isMapped && (
            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${confidenceColor(mapping!.confidence)}`} />
          )}
          <span className="text-xs font-medium text-text-primary truncate">
            {field.name}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-bg-hover text-text-muted shrink-0">
            {field.type}
          </span>
        </div>
        {field.required && (
          <span className="text-[9px] font-bold text-error/70 shrink-0">*</span>
        )}
      </div>
      <p className="text-[11px] text-text-muted mt-0.5 truncate">
        {field.label}
      </p>
      {isMapped && mapping!.sourceHeader && (
        <p className="text-[10px] font-mono text-text-muted mt-1 truncate">
          ← {mapping!.sourceHeader || `Kol ${mapping!.sourceColumn}`}
        </p>
      )}
      {!isMapped && field.required && (
        <p className="text-[10px] text-error/60 mt-1">
          Brak przypisania
        </p>
      )}
    </button>
  )
}

function FileTabs({
  files,
  activeFileId,
  onSelect
}: {
  files: { id: string; filename: string }[]
  activeFileId: string
  onSelect: (id: string) => void
}): React.JSX.Element | null {
  if (files.length <= 1) return null

  return (
    <div className="flex gap-1 border-b border-border mb-4">
      {files.map((file) => {
        const isActive = file.id === activeFileId
        return (
          <button
            key={file.id}
            onClick={() => onSelect(file.id)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              isActive
                ? 'bg-bg-card text-text-primary border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {file.filename}
          </button>
        )
      })}
    </div>
  )
}

export function MappingStep(): React.JSX.Element {
  const { files } = useImportStore()
  const { setCurrentStep } = useAppStore()
  const { activeMappings, runAutoMap, updateMapping, removeMapping } = useMappingStore()

  const [activeFileId, setActiveFileId] = useState<string>(files[0]?.id || '')
  const [selectedSource, setSelectedSource] = useState<number | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)

  const activeFile = files.find((f) => f.id === activeFileId) || files[0]
  const mappings = activeFile ? (activeMappings[activeFile.id] || []) : []

  // Run automap on mount for each file
  useEffect(() => {
    for (const file of files) {
      if (!activeMappings[file.id]) {
        runAutoMap(file)
      }
    }
  }, [files, activeMappings, runAutoMap])

  // Get target fields for the active file
  const targetFields = useMemo(() => {
    if (!activeFile) return []
    return getFieldDefinitions(activeFile.jpkType, activeFile.subType)
  }, [activeFile])

  // Build source column info
  const sourceColumns = useMemo(() => {
    if (!activeFile) return []
    const count = activeFile.columnCount
    const cols: { index: number; header?: string; samples: string[] }[] = []
    for (let i = 0; i < count; i++) {
      const header = activeFile.headers?.[i]
      const samples = activeFile.rows.slice(0, SAMPLE_COUNT).map((row) => row[i] || '')
      cols.push({ index: i, header, samples })
    }
    return cols
  }, [activeFile])

  // Check required fields mapped
  const requiredFieldsMapped = useMemo(() => {
    const requiredFields = targetFields.filter((f) => f.required)
    return requiredFields.every((f) => mappings.some((m) => m.targetField === f.name))
  }, [targetFields, mappings])

  // Handle click on source column
  const handleSourceClick = (index: number): void => {
    if (selectedSource === index) {
      // Deselect
      setSelectedSource(null)
      return
    }
    setSelectedSource(index)

    // If a target is already selected, create the mapping
    if (selectedTarget !== null) {
      const header = activeFile?.headers?.[index]
      updateMapping(activeFile!.id, {
        sourceColumn: index,
        sourceHeader: header,
        targetField: selectedTarget,
        confidence: 1.0,
        method: 'manual'
      })
      setSelectedSource(null)
      setSelectedTarget(null)
    }
  }

  // Handle click on target field
  const handleTargetClick = (fieldName: string): void => {
    if (selectedTarget === fieldName) {
      setSelectedTarget(null)
      return
    }
    setSelectedTarget(fieldName)

    // If a source is already selected, create the mapping
    if (selectedSource !== null) {
      const header = activeFile?.headers?.[selectedSource]
      updateMapping(activeFile!.id, {
        sourceColumn: selectedSource,
        sourceHeader: header,
        targetField: fieldName,
        confidence: 1.0,
        method: 'manual'
      })
      setSelectedSource(null)
      setSelectedTarget(null)
    }
  }

  // Handle unlink
  const handleUnlink = (sourceColumn: number): void => {
    if (activeFile) {
      removeMapping(activeFile.id, sourceColumn)
    }
  }

  // Get mapping for source column
  const getMappingForSource = (index: number): ColumnMapping | undefined =>
    mappings.find((m) => m.sourceColumn === index)

  // Get mapping for target field
  const getMappingForTarget = (fieldName: string): ColumnMapping | undefined =>
    mappings.find((m) => m.targetField === fieldName)

  const mappedCount = mappings.length
  const requiredCount = targetFields.filter((f) => f.required).length
  const mappedRequiredCount = targetFields.filter(
    (f) => f.required && mappings.some((m) => m.targetField === f.name)
  ).length

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-text-muted" />
        <p className="text-sm text-text-secondary">Brak zaimportowanych plików</p>
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
        <h1 className="text-xl font-semibold text-text-primary mb-1">Mapowanie kolumn</h1>
        <p className="text-sm text-text-secondary mb-4">
          Przypisz kolumny źródłowe do pól JPK {activeFile?.jpkType?.replace('JPK_', '') || ''}
        </p>

        {/* File tabs */}
        <FileTabs
          files={files.map((f) => ({ id: f.id, filename: f.filename }))}
          activeFileId={activeFile?.id || ''}
          onSelect={(id) => {
            setActiveFileId(id)
            setSelectedSource(null)
            setSelectedTarget(null)
          }}
        />

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-4 text-xs">
          <span className="text-text-secondary">
            Zmapowane: <span className="font-medium text-text-primary">{mappedCount}</span>
          </span>
          <span className="text-text-secondary">
            Wymagane:{' '}
            <span className={`font-medium ${mappedRequiredCount === requiredCount ? 'text-success' : 'text-warning'}`}>
              {mappedRequiredCount}/{requiredCount}
            </span>
          </span>
          {selectedSource !== null && (
            <span className="text-accent text-xs">
              Wybrano kolumnę {selectedSource} — kliknij pole docelowe
            </span>
          )}
          {selectedTarget !== null && (
            <span className="text-accent text-xs">
              Wybrano pole {selectedTarget} — kliknij kolumnę źródłową
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex gap-4 px-6 pb-4 min-h-0 overflow-hidden">
        {/* LEFT: Source columns */}
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
            Kolumny źródłowe ({sourceColumns.length})
          </h3>
          <div className="flex-1 overflow-auto flex flex-col gap-1.5 pr-1">
            {sourceColumns.map((col) => {
              const mapping = getMappingForSource(col.index)
              return (
                <div key={col.index} className="relative group">
                  <SourceColumn
                    index={col.index}
                    header={col.header}
                    samples={col.samples}
                    mapping={mapping}
                    isSelected={selectedSource === col.index}
                    onClick={() => handleSourceClick(col.index)}
                  />
                  {mapping && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnlink(col.index)
                      }}
                      className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error/15 hover:text-error text-text-muted transition-all"
                      title="Usuń powiązanie"
                    >
                      <Unlink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Target JPK fields */}
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
            Pola JPK ({targetFields.length})
          </h3>
          <div className="flex-1 overflow-auto flex flex-col gap-1.5 pr-1">
            {targetFields.map((field) => (
              <TargetField
                key={field.name}
                field={field}
                mapping={getMappingForTarget(field.name)}
                isSelected={selectedTarget === field.name}
                onClick={() => handleTargetClick(field.name)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 flex justify-between border-t border-border bg-bg-app">
        <button
          onClick={() => setCurrentStep(1)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Wstecz
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          disabled={!requiredFieldsMapped}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            requiredFieldsMapped
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
