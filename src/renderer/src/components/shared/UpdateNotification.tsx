import { useState, useEffect } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded'

export function UpdateNotification(): React.JSX.Element | null {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const cleanupAvailable = window.api.update.onAvailable((info) => {
      setVersion(info.version)
      setState('available')
      setDismissed(false)
    })

    const cleanupProgress = window.api.update.onProgress((info) => {
      setProgress(info.percent)
      setState('downloading')
    })

    const cleanupDownloaded = window.api.update.onDownloaded((info) => {
      setVersion(info.version)
      setState('downloaded')
      setDismissed(false)
    })

    return () => {
      cleanupAvailable()
      cleanupProgress()
      cleanupDownloaded()
    }
  }, [])

  if (state === 'idle' || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[320px] bg-bg-card border border-border rounded-xl shadow-lg p-4">
      <div className="flex items-start gap-3">
        {state === 'downloaded' ? (
          <RefreshCw className="w-5 h-5 text-success shrink-0 mt-0.5" />
        ) : (
          <Download className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          {state === 'available' && (
            <>
              <p className="text-sm font-medium text-text-primary">
                Dostępna aktualizacja v{version}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Pobieranie rozpocznie się automatycznie
              </p>
            </>
          )}

          {state === 'downloading' && (
            <>
              <p className="text-sm font-medium text-text-primary">
                Pobieranie aktualizacji...
              </p>
              <div className="mt-1.5 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-0.5">{progress}%</p>
            </>
          )}

          {state === 'downloaded' && (
            <>
              <p className="text-sm font-medium text-text-primary">
                Aktualizacja v{version} gotowa
              </p>
              <button
                onClick={() => window.api.update.installAndRestart()}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Zainstaluj i uruchom ponownie
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-bg-hover text-text-muted transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
