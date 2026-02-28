import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { StepIndicator } from './StepIndicator'
import { ImportStep } from '@renderer/components/steps/ImportStep'
import { MappingStep } from '@renderer/components/steps/MappingStep'
import { CompanyStep } from '@renderer/components/steps/CompanyStep'
import { PreviewStep } from '@renderer/components/steps/PreviewStep'
import { ValidationStep } from '@renderer/components/steps/ValidationStep'
import { ExportStep } from '@renderer/components/steps/ExportStep'
import { HistoryStep } from '@renderer/components/steps/HistoryStep'
import { UpdateNotification } from '@renderer/components/shared/UpdateNotification'
import { useAppStore, STEP_LABELS } from '@renderer/stores/appStore'
import { Upload } from 'lucide-react'

function StepPlaceholder(): React.JSX.Element {
  const { currentStep, activeJpkType } = useAppStore()

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border flex items-center justify-center">
        <Upload className="w-7 h-7 text-text-muted" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          {STEP_LABELS[currentStep]}
        </h2>
        <p className="text-sm text-text-secondary">
          JPK {activeJpkType} — Krok {currentStep} z 7
        </p>
      </div>
    </div>
  )
}

function MainContent(): React.JSX.Element {
  const { currentStep } = useAppStore()

  switch (currentStep) {
    case 1:
      return <ImportStep />
    case 2:
      return <MappingStep />
    case 3:
      return <CompanyStep />
    case 4:
      return <PreviewStep />
    case 5:
      return <ValidationStep />
    case 6:
      return <ExportStep />
    case 7:
      return <HistoryStep />
    default:
      return <StepPlaceholder />
  }
}

export function AppShell(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Custom titlebar */}
      <TitleBar />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 bg-bg-main flex flex-col min-h-0">
          <MainContent />
        </main>
      </div>

      {/* Step indicator */}
      <StepIndicator />

      {/* Auto-update toast */}
      <UpdateNotification />
    </div>
  )
}
