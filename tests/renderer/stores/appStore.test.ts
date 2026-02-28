import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/renderer/src/stores/appStore'
import type { JpkType, Step } from '../../../src/renderer/src/stores/appStore'

const initialState = {
  activeJpkType: 'V7M' as JpkType,
  currentStep: 1 as Step
}

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState(initialState)
  })

  describe('initial state', () => {
    it('has activeJpkType = V7M', () => {
      expect(useAppStore.getState().activeJpkType).toBe('V7M')
    })

    it('has currentStep = 1', () => {
      expect(useAppStore.getState().currentStep).toBe(1)
    })
  })

  describe('setActiveJpkType', () => {
    it('changes the active JPK type', () => {
      useAppStore.getState().setActiveJpkType('FA')
      expect(useAppStore.getState().activeJpkType).toBe('FA')
    })

    it('can cycle through all types', () => {
      const types: JpkType[] = ['V7M', 'FA', 'MAG', 'WB']
      for (const type of types) {
        useAppStore.getState().setActiveJpkType(type)
        expect(useAppStore.getState().activeJpkType).toBe(type)
      }
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
})
