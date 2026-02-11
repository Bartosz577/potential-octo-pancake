import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const isMac = window.api.platform === 'darwin'

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    const cleanup = window.api.window.onMaximizedChanged(setIsMaximized)
    return cleanup
  }, [])

  return (
    <div className="flex h-10 items-center bg-bg-app border-b border-border select-none"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Logo / App name — offset on macOS for traffic lights */}
      <div className={`flex items-center gap-2 px-4 ${isMac ? 'pl-20' : ''}`}>
        <div className="w-4 h-4 rounded-sm bg-accent flex items-center justify-center">
          <span className="text-[8px] font-bold text-white">JP</span>
        </div>
        <span className="text-xs font-semibold text-text-secondary">
          JPK Converter <span className="text-text-muted">v1.0</span>
        </span>
      </div>

      {/* Spacer — draggable area */}
      <div className="flex-1" />

      {/* Window controls — Windows/Linux only */}
      {!isMac && (
        <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => window.api.window.minimize()}
            className="flex items-center justify-center w-11 h-10 hover:bg-bg-hover transition-colors"
            aria-label="Minimalizuj"
          >
            <Minus className="w-3.5 h-3.5 text-text-secondary" />
          </button>
          <button
            onClick={() => window.api.window.maximize()}
            className="flex items-center justify-center w-11 h-10 hover:bg-bg-hover transition-colors"
            aria-label="Maksymalizuj"
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 text-text-secondary" />
            ) : (
              <Square className="w-3 h-3 text-text-secondary" />
            )}
          </button>
          <button
            onClick={() => window.api.window.close()}
            className="flex items-center justify-center w-11 h-10 hover:bg-error/80 hover:text-white transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-3.5 h-3.5 text-text-secondary" />
          </button>
        </div>
      )}
    </div>
  )
}
