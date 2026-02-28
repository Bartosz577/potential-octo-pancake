import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  error: 0,
  warning: 0
}

const MAX_TOASTS = 5

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type, duration) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const toast: Toast = {
      id,
      message,
      type,
      duration: duration ?? DEFAULT_DURATIONS[type]
    }
    set((state) => {
      const next = [...state.toasts, toast]
      if (next.length > MAX_TOASTS) next.shift()
      return { toasts: next }
    })
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))

export function useToast() {
  const addToast = useToastStore((s) => s.addToast)
  return {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    warning: (msg: string) => addToast(msg, 'warning'),
    info: (msg: string) => addToast(msg, 'info')
  }
}
