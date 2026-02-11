import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CompanyData {
  nip: string
  fullName: string
  regon: string
  kodUrzedu: string
  email: string
  phone: string
}

export interface PeriodData {
  year: number
  month: number
  celZlozenia: 1 | 2
}

interface CompanyState {
  company: CompanyData
  period: PeriodData
  savedCompanies: CompanyData[]
  setCompany: (data: Partial<CompanyData>) => void
  setPeriod: (data: Partial<PeriodData>) => void
  saveCompany: () => void
  loadCompany: (nip: string) => void
  removeSavedCompany: (nip: string) => void
}

const emptyCompany: CompanyData = {
  nip: '',
  fullName: '',
  regon: '',
  kodUrzedu: '',
  email: '',
  phone: ''
}

const currentYear = new Date().getFullYear()

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      company: { ...emptyCompany },
      period: { year: currentYear, month: new Date().getMonth() + 1, celZlozenia: 1 },
      savedCompanies: [],

      setCompany: (data) =>
        set((state) => ({ company: { ...state.company, ...data } })),

      setPeriod: (data) =>
        set((state) => ({ period: { ...state.period, ...data } })),

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
    { name: 'jpk-company-store' }
  )
)
