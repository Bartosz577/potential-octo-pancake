import { useCallback } from 'react'
import { useImportStore } from '../stores/importStore'
import { useMappingStore } from '../stores/mappingStore'
import { useCompanyStore } from '../stores/companyStore'
import { useHistoryStore } from '../stores/historyStore'
import { usePipelineStore } from './pipelineStore'
import { processFile } from './PipelineBridge'
import type { BridgeSummary, FileProcessingResult } from './types'

export function usePipelineBridge() {
  const files = useImportStore((s) => s.files)
  const activeMappings = useMappingStore((s) => s.activeMappings)
  const company = useCompanyStore((s) => s.company)
  const period = useCompanyStore((s) => s.period)
  const addRecord = useHistoryStore((s) => s.addRecord)

  const status = usePipelineStore((s) => s.status)
  const results = usePipelineStore((s) => s.results)
  const setFileResult = usePipelineStore((s) => s.setFileResult)
  const setStatus = usePipelineStore((s) => s.setStatus)
  const setError = usePipelineStore((s) => s.setError)
  const clearResults = usePipelineStore((s) => s.clearResults)
  const getSummary = usePipelineStore((s) => s.getSummary)

  const validateAll = useCallback(async () => {
    setStatus('validating')
    setError(null)

    try {
      for (const file of files) {
        const mappings = activeMappings[file.id] || []
        const result = processFile(file, mappings, company, period, { skipXml: true })
        setFileResult(file.id, result)
        // Yield to React rendering
        await Promise.resolve()
      }
      setStatus(files.length > 0 ? 'success' : 'idle')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [files, activeMappings, company, period, setFileResult, setStatus, setError])

  const generateAll = useCallback(async () => {
    setStatus('generating')
    setError(null)

    try {
      for (const file of files) {
        const mappings = activeMappings[file.id] || []
        const result = processFile(file, mappings, company, period)
        setFileResult(file.id, result)

        // Save successful exports to history
        if (result.status === 'success' && result.xmlResult) {
          addRecord({
            jpkType: file.jpkType,
            companyName: company.fullName,
            companyNip: company.nip,
            fileName: result.xmlResult.filename,
            schemaVersion: result.xmlResult.schemaVersion,
            rowCount: result.xmlResult.rowCount,
            fileSize: result.xmlResult.fileSize,
            xmlOutput: result.xmlResult.xml
          })
        }

        await Promise.resolve()
      }
      setStatus(files.length > 0 ? 'success' : 'idle')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [files, activeMappings, company, period, addRecord, setFileResult, setStatus, setError])

  const processOne = useCallback(
    async (fileId: string) => {
      const file = files.find((f) => f.id === fileId)
      if (!file) return

      const mappings = activeMappings[file.id] || []
      const result = processFile(file, mappings, company, period)
      setFileResult(file.id, result)

      if (result.status === 'success' && result.xmlResult) {
        addRecord({
          jpkType: file.jpkType,
          companyName: company.fullName,
          companyNip: company.nip,
          fileName: result.xmlResult.filename,
          schemaVersion: result.xmlResult.schemaVersion,
          rowCount: result.xmlResult.rowCount,
          fileSize: result.xmlResult.fileSize,
          xmlOutput: result.xmlResult.xml
        })
      }
    },
    [files, activeMappings, company, period, addRecord, setFileResult]
  )

  const runAll = useCallback(async () => {
    await validateAll()
    const summary = getSummary()
    if (summary.totalErrors === 0) {
      await generateAll()
    }
  }, [validateAll, generateAll, getSummary])

  const reset = useCallback(() => {
    clearResults()
  }, [clearResults])

  const getFileResult = useCallback(
    (fileId: string): FileProcessingResult | null => {
      return results[fileId] ?? null
    },
    [results]
  )

  const summary: BridgeSummary = getSummary()

  return {
    status,
    results,
    summary,
    validateAll,
    generateAll,
    processOne,
    runAll,
    reset,
    getFileResult
  }
}
