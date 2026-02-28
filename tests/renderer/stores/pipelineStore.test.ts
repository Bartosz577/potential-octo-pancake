import { describe, it, expect, beforeEach } from 'vitest'
import { usePipelineStore } from '../../../src/renderer/src/bridge/pipelineStore'
import type { FileProcessingResult } from '../../../src/renderer/src/bridge/types'

function makeResult(overrides?: Partial<FileProcessingResult>): FileProcessingResult {
  return {
    fileId: 'file-1',
    status: 'success',
    pipelineResult: null,
    validationReport: null,
    xmlResult: null,
    hasErrors: false,
    hasWarnings: false,
    errorCount: 0,
    warningCount: 0,
    error: null,
    ...overrides
  }
}

const initialState = {
  status: 'idle' as const,
  results: {} as Record<string, FileProcessingResult>,
  error: null as string | null
}

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.setState(initialState)
  })

  describe('initial state', () => {
    it('has status = idle', () => {
      expect(usePipelineStore.getState().status).toBe('idle')
    })

    it('has empty results', () => {
      expect(usePipelineStore.getState().results).toEqual({})
    })

    it('has error = null', () => {
      expect(usePipelineStore.getState().error).toBeNull()
    })
  })

  describe('setFileResult', () => {
    it('adds result under file ID', () => {
      const result = makeResult({ fileId: 'f1' })
      usePipelineStore.getState().setFileResult('f1', result)

      const { results } = usePipelineStore.getState()
      expect(results['f1']).toBeDefined()
      expect(results['f1'].fileId).toBe('f1')
      expect(results['f1'].status).toBe('success')
    })

    it('overwrites existing result for same file ID', () => {
      usePipelineStore.getState().setFileResult('f1', makeResult({ fileId: 'f1', status: 'validating' }))
      usePipelineStore.getState().setFileResult('f1', makeResult({ fileId: 'f1', status: 'success' }))

      expect(usePipelineStore.getState().results['f1'].status).toBe('success')
    })

    it('stores multiple file results independently', () => {
      usePipelineStore.getState().setFileResult('f1', makeResult({ fileId: 'f1' }))
      usePipelineStore.getState().setFileResult('f2', makeResult({ fileId: 'f2', errorCount: 3 }))

      const { results } = usePipelineStore.getState()
      expect(Object.keys(results)).toHaveLength(2)
      expect(results['f1'].errorCount).toBe(0)
      expect(results['f2'].errorCount).toBe(3)
    })
  })

  describe('setStatus', () => {
    it('changes status', () => {
      usePipelineStore.getState().setStatus('validating')
      expect(usePipelineStore.getState().status).toBe('validating')
    })
  })

  describe('setError', () => {
    it('sets error string', () => {
      usePipelineStore.getState().setError('Something went wrong')
      expect(usePipelineStore.getState().error).toBe('Something went wrong')
    })

    it('can clear error with null', () => {
      usePipelineStore.getState().setError('Oops')
      usePipelineStore.getState().setError(null)
      expect(usePipelineStore.getState().error).toBeNull()
    })
  })

  describe('clearResults', () => {
    it('resets status to idle, clears results and error', () => {
      usePipelineStore.getState().setStatus('success')
      usePipelineStore.getState().setFileResult('f1', makeResult())
      usePipelineStore.getState().setError('err')

      usePipelineStore.getState().clearResults()

      const state = usePipelineStore.getState()
      expect(state.status).toBe('idle')
      expect(state.results).toEqual({})
      expect(state.error).toBeNull()
    })
  })

  describe('getSummary', () => {
    it('returns zeros when no results', () => {
      const summary = usePipelineStore.getState().getSummary()
      expect(summary.totalFiles).toBe(0)
      expect(summary.processedFiles).toBe(0)
      expect(summary.totalErrors).toBe(0)
      expect(summary.totalWarnings).toBe(0)
      expect(summary.canExport).toBe(false)
    })

    it('calculates totalErrors and totalWarnings correctly', () => {
      usePipelineStore.getState().setFileResult('f1', makeResult({
        fileId: 'f1',
        status: 'success',
        errorCount: 2,
        warningCount: 1
      }))
      usePipelineStore.getState().setFileResult('f2', makeResult({
        fileId: 'f2',
        status: 'success',
        errorCount: 1,
        warningCount: 3
      }))

      const summary = usePipelineStore.getState().getSummary()
      expect(summary.totalErrors).toBe(3)
      expect(summary.totalWarnings).toBe(4)
      expect(summary.totalFiles).toBe(2)
    })

    it('canExport is true when all files are success with no blocking conditions', () => {
      usePipelineStore.getState().setFileResult('f1', makeResult({
        fileId: 'f1',
        status: 'success'
      }))

      const summary = usePipelineStore.getState().getSummary()
      expect(summary.canExport).toBe(true)
      expect(summary.processedFiles).toBe(1)
    })

    it('canExport is false when a file has error status', () => {
      usePipelineStore.getState().setFileResult('f1', makeResult({
        fileId: 'f1',
        status: 'error',
        errorCount: 1,
        hasErrors: true
      }))

      const summary = usePipelineStore.getState().getSummary()
      expect(summary.canExport).toBe(false)
    })

    it('canExport is false when a file is still validating', () => {
      usePipelineStore.getState().setFileResult('f1', makeResult({
        fileId: 'f1',
        status: 'validating'
      }))

      const summary = usePipelineStore.getState().getSummary()
      expect(summary.canExport).toBe(false)
      // validating is not counted as processed
      expect(summary.processedFiles).toBe(0)
    })

    it('processedFiles excludes idle, validating, and generating statuses', () => {
      usePipelineStore.getState().setFileResult('f1', makeResult({ fileId: 'f1', status: 'success' }))
      usePipelineStore.getState().setFileResult('f2', makeResult({ fileId: 'f2', status: 'validating' }))
      usePipelineStore.getState().setFileResult('f3', makeResult({ fileId: 'f3', status: 'idle' }))
      usePipelineStore.getState().setFileResult('f4', makeResult({ fileId: 'f4', status: 'error' }))
      usePipelineStore.getState().setFileResult('f5', makeResult({ fileId: 'f5', status: 'generating' }))

      const summary = usePipelineStore.getState().getSummary()
      expect(summary.totalFiles).toBe(5)
      // Only success, validated, error are "processed" (not idle, validating, generating)
      expect(summary.processedFiles).toBe(2) // f1 (success) + f4 (error)
    })
  })
})
