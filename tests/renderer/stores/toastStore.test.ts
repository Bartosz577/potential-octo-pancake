import { describe, it, expect, beforeEach } from 'vitest'
import { useToastStore } from '../../../src/renderer/src/stores/toastStore'

const initialState = {
  toasts: []
}

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState(initialState)
  })

  describe('addToast', () => {
    it('adds a toast with correct fields', () => {
      useToastStore.getState().addToast('Hello', 'success')
      const { toasts } = useToastStore.getState()

      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toBe('Hello')
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].id).toMatch(/^toast_/)
    })

    it('uses default duration 5000 for success', () => {
      useToastStore.getState().addToast('OK', 'success')
      const toast = useToastStore.getState().toasts[0]
      expect(toast.duration).toBe(5000)
    })

    it('uses default duration 5000 for info', () => {
      useToastStore.getState().addToast('Info', 'info')
      const toast = useToastStore.getState().toasts[0]
      expect(toast.duration).toBe(5000)
    })

    it('uses default duration 0 for error', () => {
      useToastStore.getState().addToast('Error', 'error')
      const toast = useToastStore.getState().toasts[0]
      expect(toast.duration).toBe(0)
    })

    it('uses default duration 0 for warning', () => {
      useToastStore.getState().addToast('Warning', 'warning')
      const toast = useToastStore.getState().toasts[0]
      expect(toast.duration).toBe(0)
    })

    it('custom duration overrides default', () => {
      useToastStore.getState().addToast('Custom', 'success', 3000)
      const toast = useToastStore.getState().toasts[0]
      expect(toast.duration).toBe(3000)
    })

    it('adding 6th toast removes oldest (max 5)', () => {
      const store = useToastStore.getState()
      for (let i = 0; i < 6; i++) {
        store.addToast(`Toast ${i}`, 'info')
      }
      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(5)
      // First toast (index 0) should have been removed; first remaining is "Toast 1"
      expect(toasts[0].message).toBe('Toast 1')
      expect(toasts[4].message).toBe('Toast 5')
    })
  })

  describe('removeToast', () => {
    it('removes the correct toast', () => {
      const store = useToastStore.getState()
      store.addToast('First', 'info')
      store.addToast('Second', 'info')

      const toasts = useToastStore.getState().toasts
      expect(toasts).toHaveLength(2)

      const idToRemove = toasts[0].id
      useToastStore.getState().removeToast(idToRemove)

      const remaining = useToastStore.getState().toasts
      expect(remaining).toHaveLength(1)
      expect(remaining[0].message).toBe('Second')
    })

    it('does nothing if id not found', () => {
      useToastStore.getState().addToast('Stays', 'info')
      useToastStore.getState().removeToast('nonexistent')
      expect(useToastStore.getState().toasts).toHaveLength(1)
    })
  })

  describe('useToast convenience methods', () => {
    // useToast() is a React hook that calls useToastStore((s) => s.addToast)
    // We can test the underlying addToast behavior for each type instead.
    it('success type produces correct toast', () => {
      useToastStore.getState().addToast('OK', 'success')
      const t = useToastStore.getState().toasts[0]
      expect(t.type).toBe('success')
      expect(t.duration).toBe(5000)
    })

    it('error type produces correct toast', () => {
      useToastStore.getState().addToast('Fail', 'error')
      const t = useToastStore.getState().toasts[0]
      expect(t.type).toBe('error')
      expect(t.duration).toBe(0)
    })

    it('warning type produces correct toast', () => {
      useToastStore.getState().addToast('Warn', 'warning')
      const t = useToastStore.getState().toasts[0]
      expect(t.type).toBe('warning')
      expect(t.duration).toBe(0)
    })

    it('info type produces correct toast', () => {
      useToastStore.getState().addToast('FYI', 'info')
      const t = useToastStore.getState().toasts[0]
      expect(t.type).toBe('info')
      expect(t.duration).toBe(5000)
    })
  })
})
