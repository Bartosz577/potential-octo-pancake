import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore, STEP_LABELS } from '../../../src/renderer/src/stores/appStore'
import type { JpkType, JpkSubtype, Step, AppMode } from '../../../src/renderer/src/stores/appStore'

const initialState = {
  activeJpkType: 'JPK_VDEK' as JpkType,
  jpkSubtype: 'V7M' as JpkSubtype,
  currentStep: 1 as Step,
  mode: 'conversion' as AppMode,
  validationXml: null as string | null,
  validationJpkLabel: null as string | null
}

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState(initialState)
  })

  describe('initial state', () => {
    it('has activeJpkType = JPK_VDEK', () => {
      expect(useAppStore.getState().activeJpkType).toBe('JPK_VDEK')
    })

    it('has currentStep = 1', () => {
      expect(useAppStore.getState().currentStep).toBe(1)
    })

    it('has jpkSubtype = V7M', () => {
      expect(useAppStore.getState().jpkSubtype).toBe('V7M')
    })

    it('has mode = conversion', () => {
      expect(useAppStore.getState().mode).toBe('conversion')
    })

    it('has validationXml = null', () => {
      expect(useAppStore.getState().validationXml).toBeNull()
    })

    it('has validationJpkLabel = null', () => {
      expect(useAppStore.getState().validationJpkLabel).toBeNull()
    })
  })

  describe('STEP_LABELS', () => {
    it('has labels for all 7 steps', () => {
      expect(Object.keys(STEP_LABELS)).toHaveLength(7)
      expect(STEP_LABELS[1]).toBe('Import')
      expect(STEP_LABELS[7]).toBe('Historia')
    })
  })

  describe('setActiveJpkType', () => {
    it('changes the active JPK type', () => {
      useAppStore.getState().setActiveJpkType('JPK_FA')
      expect(useAppStore.getState().activeJpkType).toBe('JPK_FA')
    })

    it('can cycle through all types', () => {
      const types: JpkType[] = ['JPK_VDEK', 'JPK_FA', 'JPK_MAG', 'JPK_WB']
      for (const type of types) {
        useAppStore.getState().setActiveJpkType(type)
        expect(useAppStore.getState().activeJpkType).toBe(type)
      }
    })
  })

  describe('setJpkSubtype', () => {
    it('changes the subtype to V7K', () => {
      useAppStore.getState().setJpkSubtype('V7K')
      expect(useAppStore.getState().jpkSubtype).toBe('V7K')
    })

    it('changes the subtype back to V7M', () => {
      useAppStore.getState().setJpkSubtype('V7K')
      useAppStore.getState().setJpkSubtype('V7M')
      expect(useAppStore.getState().jpkSubtype).toBe('V7M')
    })
  })

  describe('setCurrentStep', () => {
    it('changes the current step', () => {
      useAppStore.getState().setCurrentStep(4)
      expect(useAppStore.getState().currentStep).toBe(4)
    })

    it('can set to any valid step', () => {
      const steps: Step[] = [1, 2, 3, 4, 5, 6, 7]
      for (const step of steps) {
        useAppStore.getState().setCurrentStep(step)
        expect(useAppStore.getState().currentStep).toBe(step)
      }
    })
  })

  describe('setMode', () => {
    it('changes mode to validation', () => {
      useAppStore.getState().setMode('validation')
      expect(useAppStore.getState().mode).toBe('validation')
    })

    it('changes mode back to conversion', () => {
      useAppStore.getState().setMode('validation')
      useAppStore.getState().setMode('conversion')
      expect(useAppStore.getState().mode).toBe('conversion')
    })
  })

  describe('setValidationXml', () => {
    it('sets xml and label', () => {
      useAppStore.getState().setValidationXml('<xml/>', 'JPK_V7M')
      const state = useAppStore.getState()
      expect(state.validationXml).toBe('<xml/>')
      expect(state.validationJpkLabel).toBe('JPK_V7M')
    })

    it('clears xml by setting null', () => {
      useAppStore.getState().setValidationXml('<xml/>', 'JPK_V7M')
      useAppStore.getState().setValidationXml(null)
      const state = useAppStore.getState()
      expect(state.validationXml).toBeNull()
      expect(state.validationJpkLabel).toBeNull()
    })

    it('defaults label to null when not provided', () => {
      useAppStore.getState().setValidationXml('<xml/>')
      const state = useAppStore.getState()
      expect(state.validationXml).toBe('<xml/>')
      expect(state.validationJpkLabel).toBeNull()
    })

    it('explicitly passes null as label', () => {
      useAppStore.getState().setValidationXml('<xml/>', null)
      expect(useAppStore.getState().validationJpkLabel).toBeNull()
    })
  })
})
