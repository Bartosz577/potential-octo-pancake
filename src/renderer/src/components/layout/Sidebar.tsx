import { FileText, FileSpreadsheet, Package, Clock } from 'lucide-react'
import { useAppStore, type JpkType } from '@renderer/stores/appStore'

const NAV_ITEMS: { type: JpkType; label: string; sublabel: string; icon: typeof FileText }[] = [
  { type: 'V7M', label: 'JPK V7M', sublabel: 'Ewidencja VAT', icon: FileText },
  { type: 'FA', label: 'JPK FA', sublabel: 'Faktury', icon: FileSpreadsheet },
  { type: 'MAG', label: 'JPK MAG', sublabel: 'Magazyn', icon: Package }
]

export function Sidebar(): React.JSX.Element {
  const { activeJpkType, setActiveJpkType } = useAppStore()

  return (
    <aside className="flex flex-col w-[220px] bg-bg-sidebar border-r border-border shrink-0">
      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-2 mb-1">
          Typy JPK
        </span>
        {NAV_ITEMS.map(({ type, label, sublabel, icon: Icon }) => {
          const isActive = activeJpkType === type
          return (
            <button
              key={type}
              onClick={() => setActiveJpkType(type)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-accent-subtle text-accent'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : ''}`} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium leading-tight">{label}</span>
                <span className={`text-[11px] leading-tight ${isActive ? 'text-accent/70' : 'text-text-muted'}`}>
                  {sublabel}
                </span>
              </div>
            </button>
          )
        })}

        {/* Separator */}
        <div className="h-px bg-border my-3" />

        {/* Recent conversions */}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-2 mb-1">
          Ostatnie konwersje
        </span>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Clock className="w-5 h-5 text-text-muted mb-2" />
          <span className="text-xs text-text-muted">Brak historii</span>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-[11px] text-text-muted">Gotowy</span>
        </div>
      </div>
    </aside>
  )
}
