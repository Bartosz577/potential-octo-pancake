import { create } from 'zustand'

export type JpkType = 'V7M' | 'FA' | 'MAG'
export type Step = 1 | 2 | 3 | 4 | 5

export const STEP_LABELS: Record<Step, string> = {
  1: 'Import',
  2: 'Firma',
  3: 'Podgląd',
  4: 'Walidacja',
  5: 'Eksport'
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
