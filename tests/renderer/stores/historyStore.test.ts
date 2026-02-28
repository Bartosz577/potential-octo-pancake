import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore } from '../../../src/renderer/src/stores/historyStore'
import type { ConversionRecord } from '../../../src/renderer/src/stores/historyStore'

const minimalRecord: Omit<ConversionRecord, 'id' | 'date'> = {
  jpkType: 'JPK_VDEK',
  companyName: 'Test',
  companyNip: '1234567890',
  fileName: 'test.xml',
  schemaVersion: '3',
  rowCount: 10,
  fileSize: 100,
  xmlOutput: '<xml/>'
}

describe('historyStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useHistoryStore.setState({ records: [] })
  })

  describe('addRecord', () => {
    it('prepends a record with auto-generated id and date', () => {
      useHistoryStore.getState().addRecord(minimalRecord)

      const { records } = useHistoryStore.getState()
      expect(records).toHaveLength(1)
      expect(records[0].id).toMatch(/^conv_/)
      expect(records[0].date).toBeTruthy()
      // Verify the date is a valid ISO string
      expect(() => new Date(records[0].date)).not.toThrow()
      expect(records[0].jpkType).toBe('JPK_VDEK')
      expect(records[0].companyName).toBe('Test')
      expect(records[0].fileName).toBe('test.xml')
    })

    it('prepends new records (newest first)', () => {
      useHistoryStore.getState().addRecord({ ...minimalRecord, companyName: 'First' })
      useHistoryStore.getState().addRecord({ ...minimalRecord, companyName: 'Second' })

      const { records } = useHistoryStore.getState()
      expect(records).toHaveLength(2)
      expect(records[0].companyName).toBe('Second')
      expect(records[1].companyName).toBe('First')
    })

    it('generates unique ids for each record', () => {
      useHistoryStore.getState().addRecord(minimalRecord)
      useHistoryStore.getState().addRecord(minimalRecord)

      const { records } = useHistoryStore.getState()
      expect(records[0].id).not.toBe(records[1].id)
    })
  })

  describe('removeRecord', () => {
    it('removes a record by id', () => {
      useHistoryStore.getState().addRecord({ ...minimalRecord, companyName: 'Keep' })
      useHistoryStore.getState().addRecord({ ...minimalRecord, companyName: 'Remove' })

      const records = useHistoryStore.getState().records
      const idToRemove = records.find((r) => r.companyName === 'Remove')!.id

      useHistoryStore.getState().removeRecord(idToRemove)

      const remaining = useHistoryStore.getState().records
      expect(remaining).toHaveLength(1)
      expect(remaining[0].companyName).toBe('Keep')
    })

    it('does nothing if id not found', () => {
      useHistoryStore.getState().addRecord(minimalRecord)
      useHistoryStore.getState().removeRecord('nonexistent')

      expect(useHistoryStore.getState().records).toHaveLength(1)
    })
  })

  describe('clearHistory', () => {
    it('empties the records array', () => {
      useHistoryStore.getState().addRecord(minimalRecord)
      useHistoryStore.getState().addRecord(minimalRecord)
      expect(useHistoryStore.getState().records).toHaveLength(2)

      useHistoryStore.getState().clearHistory()

      expect(useHistoryStore.getState().records).toHaveLength(0)
    })
  })
})
