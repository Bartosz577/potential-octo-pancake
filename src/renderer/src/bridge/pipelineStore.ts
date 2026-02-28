import { create } from 'zustand'
import type { BridgeStatus, BridgeSummary, FileProcessingResult } from './types'

interface PipelineState {
  status: BridgeStatus
  results: Record<string, FileProcessingResult>
  error: string | null

  setFileResult: (fileId: string, result: FileProcessingResult) => void
  setStatus: (status: BridgeStatus) => void
  setError: (error: string | null) => void
  clearResults: () => void
  getSummary: () => BridgeSummary
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  status: 'idle',
  results: {},
  error: null,

  setFileResult: (fileId, result) =>
    set((state) => ({
      results: { ...state.results, [fileId]: result }
    })),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error }),

  clearResults: () => set({ status: 'idle', results: {}, error: null }),

  getSummary: (): BridgeSummary => {
    const { status, results } = get()
    const entries = Object.values(results)
    const totalFiles = entries.length
    const processedFiles = entries.filter(
      (r) => r.status !== 'idle' && r.status !== 'validating' && r.status !== 'generating'
    ).length
    const totalErrors = entries.reduce((sum, r) => sum + r.errorCount, 0)
    const totalWarnings = entries.reduce((sum, r) => sum + r.warningCount, 0)
    const canExport =
      totalFiles > 0 &&
      processedFiles === totalFiles &&
      entries.every((r) => r.status === 'success')

    return { status, totalFiles, processedFiles, totalErrors, totalWarnings, canExport }
  }
}))
