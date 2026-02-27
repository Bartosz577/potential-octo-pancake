import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JpkType } from '../types'

export interface ConversionRecord {
  id: string
  date: string
  jpkType: JpkType
  companyName: string
  companyNip: string
  fileName: string
  schemaVersion: string
  rowCount: number
  fileSize: number
  xmlOutput: string
}

interface HistoryState {
  records: ConversionRecord[]
  addRecord: (record: Omit<ConversionRecord, 'id' | 'date'>) => void
  removeRecord: (id: string) => void
  clearHistory: () => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      records: [],

      addRecord: (record) =>
        set((state) => ({
          records: [
            {
              ...record,
              id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              date: new Date().toISOString()
            },
            ...state.records
          ]
        })),

      removeRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id)
        })),

      clearHistory: () => set({ records: [] })
    }),
    { name: 'jpk-history-store' }
  )
)
