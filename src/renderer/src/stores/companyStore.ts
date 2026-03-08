import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JpkType } from '../types'

/** Dane podmiotu (Podmiot1) — wspólne dla wszystkich typów JPK */
export interface CompanyData {
  nip: string                // wymagany we wszystkich typach JPK
  fullName: string           // PelnaNazwa — wymagany wszędzie
  regon: string              // wymagany w MAG, WB; opcjonalny w KR_PD, ST_KR, KR
  kodUrzedu: string          // w Naglowek (nie Podmiot1), ale UI zbiera tu
  email: string              // wymagany w V7M/V7K; brak w FA, MAG, WB
  telefon?: string           // opcjonalne, tylko V7M/V7K (Telefon w XSD)
}

/** Okres rozliczeniowy per typ JPK */
export interface PeriodData {
  year: number
  month?: number             // miesięczne: V7M, FA, MAG, WB, itp.
  quarter?: number           // kwartalne: V7K (1-4)
  dataOd?: string            // YYYY-MM-DD — jawny początek okresu
  dataDo?: string            // YYYY-MM-DD — jawny koniec okresu
  celZlozenia: 1 | 2
  numerKorekty?: number      // numer korekty (gdy celZlozenia=2)
}

interface CompanyState {
  company: CompanyData
  periods: Partial<Record<JpkType, PeriodData>>
  savedCompanies: CompanyData[]
  setCompany: (data: Partial<CompanyData>) => void
  setPeriod: (type: JpkType, data: Partial<PeriodData>) => void
  getPeriod: (type: JpkType) => PeriodData
  saveCompany: () => void
  loadCompany: (nip: string) => void
  removeSavedCompany: (nip: string) => void
}

const emptyCompany: CompanyData = {
  nip: '',
  fullName: '',
  regon: '',
  kodUrzedu: '',
  email: ''
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const DEFAULT_PERIOD: PeriodData = {
  year: currentYear,
  month: currentMonth,
  celZlozenia: 1
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      company: { ...emptyCompany },
      periods: { V7M: { ...DEFAULT_PERIOD } },
      savedCompanies: [],

      setCompany: (data) =>
        set((state) => ({ company: { ...state.company, ...data } })),

      setPeriod: (type, data) =>
        set((state) => ({
          periods: {
            ...state.periods,
            [type]: { ...get().getPeriod(type), ...data }
          }
        })),

      getPeriod: (type) => {
        const { periods } = get()
        return periods[type] ?? { ...DEFAULT_PERIOD }
      },

      saveCompany: () => {
        const { company, savedCompanies } = get()
        if (!company.nip) return
        const existing = savedCompanies.findIndex((c) => c.nip === company.nip)
        if (existing >= 0) {
          const updated = [...savedCompanies]
          updated[existing] = { ...company }
          set({ savedCompanies: updated })
        } else {
          set({ savedCompanies: [...savedCompanies, { ...company }] })
        }
      },

      loadCompany: (nip) => {
        const found = get().savedCompanies.find((c) => c.nip === nip)
        if (found) set({ company: { ...found } })
      },

      removeSavedCompany: (nip) =>
        set((state) => ({
          savedCompanies: state.savedCompanies.filter((c) => c.nip !== nip)
        }))
    }),
    {
      name: 'jpk-company-store',
      // Migrate persisted state from old `period` to new `periods`
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version === 0 && state['period'] && !state['periods']) {
          const oldPeriod = state['period'] as PeriodData
          state['periods'] = { V7M: oldPeriod }
          delete state['period']
        }
        // Remove old `phone` field from company and savedCompanies
        if (state['company'] && typeof state['company'] === 'object') {
          const c = state['company'] as Record<string, unknown>
          if ('phone' in c) {
            if (c['phone'] && !c['telefon']) c['telefon'] = c['phone']
            delete c['phone']
          }
        }
        if (Array.isArray(state['savedCompanies'])) {
          for (const sc of state['savedCompanies'] as Record<string, unknown>[]) {
            if ('phone' in sc) {
              if (sc['phone'] && !sc['telefon']) sc['telefon'] = sc['phone']
              delete sc['phone']
            }
          }
        }
        return state as unknown as CompanyState
      },
      version: 1
    }
  )
)
