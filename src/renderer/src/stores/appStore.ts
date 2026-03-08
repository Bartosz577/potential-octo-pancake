import { create } from 'zustand'
import type { JpkType } from '../types'

export type { JpkType }
export type JpkSubtype = 'V7M' | 'V7K'
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type AppMode = 'conversion' | 'validation'

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
  mode: AppMode
  validationXml: string | null
  validationJpkLabel: string | null
  setActiveJpkType: (type: JpkType) => void
  setJpkSubtype: (subtype: JpkSubtype) => void
  setCurrentStep: (step: Step) => void
  setMode: (mode: AppMode) => void
  setValidationXml: (xml: string | null, label?: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeJpkType: 'JPK_VDEK',
  jpkSubtype: 'V7M',
  currentStep: 1,
  mode: 'conversion',
  validationXml: null,
  validationJpkLabel: null,
  setActiveJpkType: (type) => set({ activeJpkType: type }),
  setJpkSubtype: (subtype) => set({ jpkSubtype: subtype }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setMode: (mode) => set({ mode }),
  setValidationXml: (xml, label) => set({ validationXml: xml, validationJpkLabel: label ?? null })
}))
