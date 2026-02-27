import { Upload, GitBranch, Building2, Table, ShieldCheck, Download, Clock } from 'lucide-react'
import { useAppStore, STEP_LABELS, type Step } from '@renderer/stores/appStore'

const STEP_ICONS: Record<Step, typeof Upload> = {
  1: Upload,
  2: GitBranch,
  3: Building2,
  4: Table,
  5: ShieldCheck,
  6: Download,
  7: Clock
}

const STEPS: Step[] = [1, 2, 3, 4, 5, 6, 7]

export function StepIndicator(): React.JSX.Element {
  const { currentStep } = useAppStore()

  return (
    <div className="flex items-center justify-center gap-0 h-14 bg-bg-app border-t border-border px-8">
      {STEPS.map((step, index) => {
        const Icon = STEP_ICONS[step]
        const isActive = step === currentStep
        const isCompleted = step < currentStep
        const isLast = index === STEPS.length - 1

        return (
          <div key={step} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : isCompleted
                      ? 'bg-accent/20 text-accent'
                      : 'bg-bg-hover text-text-muted'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? 'text-text-primary'
                    : isCompleted
                      ? 'text-accent'
                      : 'text-text-muted'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={`w-8 h-px mx-2 ${
                  isCompleted ? 'bg-accent/40' : 'bg-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
