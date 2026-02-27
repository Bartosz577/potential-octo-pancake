import { create } from 'zustand'

export type JpkType = 'V7M' | 'FA' | 'MAG' | 'WB'
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
  currentStep: Step
  setActiveJpkType: (type: JpkType) => void
  setCurrentStep: (step: Step) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeJpkType: 'V7M',
  currentStep: 1,
  setActiveJpkType: (type) => set({ activeJpkType: type }),
  setCurrentStep: (step) => set({ currentStep: step })
}))
