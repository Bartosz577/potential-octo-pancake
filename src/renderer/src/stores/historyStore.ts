import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ConversionRecord {
  id: string
  jpkType: string        // 'JPK_VDEK' | 'JPK_FA' | 'JPK_MAG'
  subType: string        // 'SprzedazWiersz' | 'Faktura' | 'WZ' | 'RW'
  sourceFilename: string
  outputFilename: string
  rowCount: number
  companyNip: string
  companyName: string
  period: string         // '2026-01'
  convertedAt: string    // ISO timestamp
}

interface HistoryState {
  records: ConversionRecord[]
  addRecord: (record: Omit<ConversionRecord, 'id' | 'convertedAt'>) => void
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
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              convertedAt: new Date().toISOString()
            },
            ...state.records.slice(0, 49)
          ]
        })),

      clearHistory: () => set({ records: [] })
    }),
    { name: 'jpk-history-store' }
  )
)
