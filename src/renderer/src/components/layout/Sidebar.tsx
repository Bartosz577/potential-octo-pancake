import { FileText, FileSpreadsheet, Package, Clock, Wallet, BookOpen, Receipt, Scale, Landmark, Tractor, BookMarked } from 'lucide-react'
import { useAppStore, type JpkType } from '@renderer/stores/appStore'

const NAV_ITEMS: { type: JpkType; label: string; sublabel: string; icon: typeof FileText }[] = [
  { type: 'JPK_VDEK', label: 'JPK V7M', sublabel: 'Ewidencja VAT', icon: FileText },
  { type: 'JPK_FA', label: 'JPK FA', sublabel: 'Faktury', icon: FileSpreadsheet },
  { type: 'JPK_MAG', label: 'JPK MAG', sublabel: 'Magazyn', icon: Package },
  { type: 'JPK_WB', label: 'JPK WB', sublabel: 'Wyciągi bankowe', icon: Wallet },
  { type: 'JPK_PKPIR', label: 'JPK PKPiR', sublabel: 'Księga przychodów', icon: BookOpen },
  { type: 'JPK_EWP', label: 'JPK EWP', sublabel: 'Ewidencja ryczałtu', icon: Receipt },
  { type: 'JPK_KR_PD', label: 'JPK KR_PD', sublabel: 'Księgi rachunkowe (CIT)', icon: Scale },
  { type: 'JPK_ST', label: 'JPK ST', sublabel: 'Środki trwałe (EWP/PKPiR)', icon: Landmark },
  { type: 'JPK_ST_KR', label: 'JPK ST_KR', sublabel: 'Środki trwałe (KR)', icon: Landmark },
  { type: 'JPK_FA_RR', label: 'JPK FA_RR', sublabel: 'Faktury VAT RR', icon: Tractor },
  { type: 'JPK_KR', label: 'JPK KR', sublabel: 'Księgi rachunkowe (legacy)', icon: BookMarked }
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
