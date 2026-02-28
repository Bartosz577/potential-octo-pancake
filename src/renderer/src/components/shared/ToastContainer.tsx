import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type Toast, type ToastType } from '@renderer/stores/toastStore'

const ICON_MAP: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

const COLOR_MAP: Record<ToastType, { accent: string; icon: string }> = {
  success: { accent: 'bg-success', icon: 'text-success' },
  error: { accent: 'bg-error', icon: 'text-error' },
  warning: { accent: 'bg-warning', icon: 'text-warning' },
  info: { accent: 'bg-accent', icon: 'text-accent' }
}

function ToastItem({ toast }: { toast: Toast }): React.JSX.Element {
  const removeToast = useToastStore((s) => s.removeToast)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = setTimeout(() => setExiting(true), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => removeToast(toast.id), 300)
    return () => clearTimeout(timer)
  }, [exiting, toast.id, removeToast])

  const Icon = ICON_MAP[toast.type]
  const colors = COLOR_MAP[toast.type]

  return (
    <div
      className="w-[360px] flex overflow-hidden rounded-xl bg-bg-card border border-border shadow-lg"
      style={{
        animation: exiting
          ? 'toast-slide-out 0.3s ease-in forwards'
          : 'toast-slide-in 0.3s ease-out'
      }}
    >
      {/* Color accent bar */}
      <div className={`w-1 shrink-0 ${colors.accent}`} />

      <div className="flex items-start gap-3 px-4 py-3 flex-1 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${colors.icon}`} />
        <span className="text-sm text-text-primary flex-1 min-w-0 break-words">
          {toast.message}
        </span>
        <button
          onClick={() => setExiting(true)}
          className="shrink-0 p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          aria-label="Zamknij"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ToastContainer(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return <></>

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
