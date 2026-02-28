import { describe, it, expect, beforeEach } from 'vitest'
import { useImportStore } from '../../../src/renderer/src/stores/importStore'
import type { ParsedFile } from '../../../src/renderer/src/types'

function makeParsedFile(overrides?: Partial<ParsedFile>): ParsedFile {
  return {
    id: 'f1',
    filename: 'test.txt',
    system: 'NAMOS',
    jpkType: 'JPK_VDEK',
    subType: 'SprzedazWiersz',
    pointCode: '',
    dateFrom: '',
    dateTo: '',
    rows: [],
    rowCount: 0,
    columnCount: 0,
    fileSize: 0,
    ...overrides
  }
}

const initialState = {
  files: []
}

describe('importStore', () => {
  beforeEach(() => {
    useImportStore.setState(initialState)
  })

  describe('addFile', () => {
    it('appends a file to the files array', () => {
      const file = makeParsedFile()
      useImportStore.getState().addFile(file)

      const { files } = useImportStore.getState()
      expect(files).toHaveLength(1)
      expect(files[0]).toEqual(file)
    })

    it('appends multiple files', () => {
      useImportStore.getState().addFile(makeParsedFile({ id: 'f1' }))
      useImportStore.getState().addFile(makeParsedFile({ id: 'f2', filename: 'second.txt' }))

      const { files } = useImportStore.getState()
      expect(files).toHaveLength(2)
      expect(files[0].id).toBe('f1')
      expect(files[1].id).toBe('f2')
    })
  })

  describe('updateFile', () => {
    it('replaces file with matching id', () => {
      useImportStore.getState().addFile(makeParsedFile({ id: 'f1', filename: 'old.txt' }))
      const updated = makeParsedFile({ id: 'f1', filename: 'new.txt' })
      useImportStore.getState().updateFile('f1', updated)

      const { files } = useImportStore.getState()
      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('new.txt')
    })

    it('does not change other files', () => {
      useImportStore.getState().addFile(makeParsedFile({ id: 'f1', filename: 'first.txt' }))
      useImportStore.getState().addFile(makeParsedFile({ id: 'f2', filename: 'second.txt' }))

      const updated = makeParsedFile({ id: 'f1', filename: 'updated.txt' })
      useImportStore.getState().updateFile('f1', updated)

      const { files } = useImportStore.getState()
      expect(files).toHaveLength(2)
      expect(files[0].filename).toBe('updated.txt')
      expect(files[1].filename).toBe('second.txt')
    })

    it('does nothing if id not found', () => {
      useImportStore.getState().addFile(makeParsedFile({ id: 'f1' }))
      const updated = makeParsedFile({ id: 'f99' })
      useImportStore.getState().updateFile('f99', updated)

      const { files } = useImportStore.getState()
      expect(files).toHaveLength(1)
      expect(files[0].id).toBe('f1')
    })
  })

  describe('removeFile', () => {
    it('removes file by id', () => {
      useImportStore.getState().addFile(makeParsedFile({ id: 'f1' }))
      useImportStore.getState().addFile(makeParsedFile({ id: 'f2' }))

      useImportStore.getState().removeFile('f1')

      const { files } = useImportStore.getState()
      expect(files).toHaveLength(1)
      expect(files[0].id).toBe('f2')
    })

    it('does nothing if id not found', () => {
      useImportStore.getState().addFile(makeParsedFile({ id: 'f1' }))
      useImportStore.getState().removeFile('nonexistent')

      expect(useImportStore.getState().files).toHaveLength(1)
    })
  })

  describe('clearFiles', () => {
    it('empties the files array', () => {
      useImportStore.getState().addFile(makeParsedFile({ id: 'f1' }))
      useImportStore.getState().addFile(makeParsedFile({ id: 'f2' }))

      useImportStore.getState().clearFiles()

      expect(useImportStore.getState().files).toHaveLength(0)
    })
  })
})
