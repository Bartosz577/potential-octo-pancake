import { create } from 'zustand'

export type JpkType = 'V7M' | 'FA' | 'MAG' | 'WB' | 'PKPIR' | 'EWP' | 'KR_PD' | 'ST' | 'ST_KR' | 'FA_RR' | 'KR'
export type JpkSubtype = 'V7M' | 'V7K'
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const STEP_LABELS: Record<Step, string> = {
  1: 'Import',
  2: 'Mapowanie',
  3: 'Firma',
  4: 'Podgląd',
  5: 'Walidacja',
  6: 'Eksport',
  7: 'Historia'
}

interface AppState {
  activeJpkType: JpkType
  jpkSubtype: JpkSubtype
  currentStep: Step
  setActiveJpkType: (type: JpkType) => void
  setJpkSubtype: (subtype: JpkSubtype) => void
  setCurrentStep: (step: Step) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeJpkType: 'V7M',
  jpkSubtype: 'V7M',
  currentStep: 1,
  setActiveJpkType: (type) => set({ activeJpkType: type }),
  setJpkSubtype: (subtype) => set({ jpkSubtype: subtype }),
  setCurrentStep: (step) => set({ currentStep: step })
}))
