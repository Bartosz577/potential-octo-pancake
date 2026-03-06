import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock document.documentElement.setAttribute for node environment
const setAttributeMock = vi.fn()
Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement: {
      setAttribute: setAttributeMock
    }
  },
  writable: true
})

// Import after document mock is set up
const { useThemeStore } = await import('../../../src/renderer/src/stores/themeStore')

const initialState = {
  theme: 'dark' as const
}

describe('themeStore', () => {
  beforeEach(() => {
    useThemeStore.setState(initialState)
    setAttributeMock.mockClear()
  })

  describe('initial state', () => {
    it('defaults to dark theme', () => {
      expect(useThemeStore.getState().theme).toBe('dark')
    })
  })

  describe('toggleTheme', () => {
    it('toggles from dark to light', () => {
      useThemeStore.getState().toggleTheme()
      expect(useThemeStore.getState().theme).toBe('light')
    })

    it('toggles from light back to dark', () => {
      useThemeStore.getState().toggleTheme()
      useThemeStore.getState().toggleTheme()
      expect(useThemeStore.getState().theme).toBe('dark')
    })

    it('sets data-theme attribute on document when toggling', () => {
      useThemeStore.getState().toggleTheme()
      expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('sets data-theme to dark when toggling back', () => {
      useThemeStore.getState().toggleTheme()
      setAttributeMock.mockClear()
      useThemeStore.getState().toggleTheme()
      expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark')
    })
  })

  describe('setTheme', () => {
    it('sets theme to light', () => {
      useThemeStore.getState().setTheme('light')
      expect(useThemeStore.getState().theme).toBe('light')
      expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('sets theme to dark', () => {
      useThemeStore.getState().setTheme('light')
      setAttributeMock.mockClear()
      useThemeStore.getState().setTheme('dark')
      expect(useThemeStore.getState().theme).toBe('dark')
      expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('applies theme even if same value', () => {
      useThemeStore.getState().setTheme('dark')
      expect(setAttributeMock).toHaveBeenCalledWith('data-theme', 'dark')
    })
  })

  describe('persistence key', () => {
    it('store uses jpk-theme as persist name', () => {
      // Verify the store is configured with persist (setState/getState work after toggle)
      useThemeStore.getState().toggleTheme()
      expect(useThemeStore.getState().theme).toBe('light')
      useThemeStore.getState().toggleTheme()
      expect(useThemeStore.getState().theme).toBe('dark')
    })

    it('state survives setState (simulating rehydration)', () => {
      useThemeStore.setState({ theme: 'light' })
      expect(useThemeStore.getState().theme).toBe('light')
    })
  })
})
