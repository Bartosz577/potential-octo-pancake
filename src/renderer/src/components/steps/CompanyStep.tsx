import { useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Save,
  Building2,
  Download,
  CheckCircle2,
  XCircle,
  Trash2
} from 'lucide-react'
import { useCompanyStore, type CompanyData } from '@renderer/stores/companyStore'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore } from '@renderer/stores/appStore'
import { validatePolishNip, normalizeNip } from '@renderer/utils/nipValidator'

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

const YEARS = [2024, 2025, 2026]

// FA data column indices (0-based, after 6 meta columns)
const FA_SELLER_NAME_COL = 5  // P_3C
const FA_SELLER_NIP_COL = 8   // P_4B

function extractCompanyFromFA(files: ReturnType<typeof useImportStore.getState>['files']): Partial<CompanyData> | null {
  const faFile = files.find((f) => f.jpkType === 'JPK_FA')
  if (!faFile || faFile.rows.length === 0) return null

  const firstRow = faFile.rows[0]
  const name = firstRow[FA_SELLER_NAME_COL] || ''
  const nip = normalizeNip(firstRow[FA_SELLER_NIP_COL] || '')

  if (!name && !nip) return null
  return { fullName: name, nip }
}

function FormField({
  label,
  children,
  optional = false
}: {
  label: string
  children: React.ReactNode
  optional?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">
        {label}
        {optional && <span className="text-text-muted ml-1">(opcjonalnie)</span>}
      </label>
      {children}
    </div>
  )
}

function NipInput({
  value,
  onChange
}: {
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  const normalized = normalizeNip(value)
  const hasInput = normalized.length > 0
  const isValid = hasInput && validatePolishNip(normalized)
  const isInvalid = hasInput && normalized.length >= 10 && !isValid

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0000000000"
        maxLength={13}
        className={`w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted outline-none border transition-colors ${
          isValid
            ? 'border-success/50 focus:border-success'
            : isInvalid
              ? 'border-error/50 focus:border-error'
              : 'border-border focus:border-accent'
        }`}
      />
      {hasInput && normalized.length >= 10 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isValid ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <XCircle className="w-4 h-4 text-error" />
          )}
        </div>
      )}
    </div>
  )
}

function SelectInput({
  value,
  onChange,
  options
}: {
  value: string | number
  onChange: (v: string) => void
  options: { value: string | number; label: string }[]
}): React.JSX.Element {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm text-text-primary border border-border focus:border-accent outline-none appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
    </div>
  )
}

function SavedCompanySelector({
  companies,
  onLoad,
  onRemove
}: {
  companies: CompanyData[]
  onLoad: (nip: string) => void
  onRemove: (nip: string) => void
}): React.JSX.Element {
  if (companies.length === 0) return <></>

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Zapisane firmy
      </span>
      <div className="flex flex-wrap gap-2">
        {companies.map((c) => (
          <div
            key={c.nip}
            className="flex items-center gap-1 pl-3 pr-1 py-1.5 bg-bg-card rounded-lg border border-border hover:border-border-active transition-colors group"
          >
            <button
              onClick={() => onLoad(c.nip)}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="font-mono text-text-muted mr-1.5">{c.nip}</span>
              <span className="font-medium">{c.fullName.slice(0, 30)}{c.fullName.length > 30 ? '...' : ''}</span>
            </button>
            <button
              onClick={() => onRemove(c.nip)}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error/15 hover:text-error text-text-muted transition-all"
              aria-label="Usuń firmę"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompanyStep(): React.JSX.Element {
  const { company, period, savedCompanies, setCompany, setPeriod, saveCompany, loadCompany, removeSavedCompany } =
    useCompanyStore()
  const { files } = useImportStore()
  const { setCurrentStep } = useAppStore()

  const faCompanyData = useMemo(() => extractCompanyFromFA(files), [files])

  // Derive period from imported files
  const filePeriod = useMemo(() => {
    if (files.length === 0) return null
    const dateFrom = files[0].dateFrom
    if (!dateFrom) return null
    const [yearStr, monthStr] = dateFrom.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    return year && month ? { year, month } : null
  }, [files])

  const handleFillFromFA = (): void => {
    if (!faCompanyData) return
    setCompany(faCompanyData)
    if (filePeriod) setPeriod(filePeriod)
  }

  const handleFillPeriod = (): void => {
    if (filePeriod) setPeriod(filePeriod)
  }

  const nipNormalized = normalizeNip(company.nip)
  const nipValid = nipNormalized.length === 10 && validatePolishNip(nipNormalized)
  const canProceed = nipValid && company.fullName.trim().length > 0

  // Check if FA data differs from current form
  const faDataAvailable = faCompanyData !== null
  const faDataDiffers = faCompanyData &&
    (normalizeNip(faCompanyData.nip || '') !== nipNormalized ||
     faCompanyData.fullName !== company.fullName)
  const periodDiffers = filePeriod &&
    (filePeriod.year !== period.year || filePeriod.month !== period.month)

  return (
    <div className="flex-1 flex flex-col p-6 gap-5 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Dane podmiotu</h1>
        <p className="text-sm text-text-secondary">
          Uzupełnij dane firmy dla nagłówka JPK
        </p>
      </div>

      {/* Auto-fill from FA */}
      {faDataAvailable && faDataDiffers && (
        <div className="flex items-center justify-between px-4 py-3 bg-accent-subtle rounded-lg border border-accent/20">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Download className="w-4 h-4 text-accent shrink-0" />
            <span>
              Wykryto dane sprzedawcy w pliku FA — NIP:{' '}
              <span className="font-mono text-text-primary">{faCompanyData!.nip}</span>
              {', '}
              <span className="text-text-primary">{faCompanyData!.fullName?.slice(0, 40)}</span>
            </span>
          </div>
          <button
            onClick={handleFillFromFA}
            className="shrink-0 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
          >
            Wypełnij dane
          </button>
        </div>
      )}

      {/* Period sync hint */}
      {!faDataDiffers && periodDiffers && filePeriod && (
        <div className="flex items-center justify-between px-4 py-3 bg-accent-subtle rounded-lg border border-accent/20">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Download className="w-4 h-4 text-accent shrink-0" />
            <span>
              Okres z pliku:{' '}
              <span className="text-text-primary">{filePeriod.year}-{String(filePeriod.month).padStart(2, '0')}</span>
            </span>
          </div>
          <button
            onClick={handleFillPeriod}
            className="shrink-0 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
          >
            Ustaw okres
          </button>
        </div>
      )}

      {/* Saved companies */}
      <SavedCompanySelector
        companies={savedCompanies}
        onLoad={loadCompany}
        onRemove={removeSavedCompany}
      />

      {/* Form */}
      <div className="bg-bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Dane firmy</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="NIP">
            <NipInput value={company.nip} onChange={(nip) => setCompany({ nip })} />
          </FormField>

          <FormField label="Pełna nazwa">
            <input
              type="text"
              value={company.fullName}
              onChange={(e) => setCompany({ fullName: e.target.value })}
              placeholder="Nazwa firmy..."
              className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
            />
          </FormField>

          <FormField label="REGON" optional>
            <input
              type="text"
              value={company.regon}
              onChange={(e) => setCompany({ regon: e.target.value })}
              placeholder="000000000"
              maxLength={14}
              className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
            />
          </FormField>

          <FormField label="Kod urzędu skarbowego">
            <input
              type="text"
              value={company.kodUrzedu}
              onChange={(e) => setCompany({ kodUrzedu: e.target.value })}
              placeholder="0000"
              maxLength={4}
              className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
            />
          </FormField>

          <FormField label="Email" optional>
            <input
              type="email"
              value={company.email}
              onChange={(e) => setCompany({ email: e.target.value })}
              placeholder="firma@example.pl"
              className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
            />
          </FormField>

          <FormField label="Telefon" optional>
            <input
              type="tel"
              value={company.phone}
              onChange={(e) => setCompany({ phone: e.target.value })}
              placeholder="+48 000 000 000"
              className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
            />
          </FormField>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={saveCompany}
            disabled={!nipValid}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              nipValid
                ? 'bg-bg-hover text-text-secondary hover:text-text-primary hover:bg-border'
                : 'bg-bg-hover text-text-muted cursor-not-allowed'
            }`}
          >
            <Save className="w-3 h-3" />
            Zapamiętaj firmę
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="bg-bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Okres rozliczeniowy</h2>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Rok">
            <SelectInput
              value={period.year}
              onChange={(v) => setPeriod({ year: parseInt(v, 10) })}
              options={YEARS.map((y) => ({ value: y, label: String(y) }))}
            />
          </FormField>

          <FormField label="Miesiąc">
            <SelectInput
              value={period.month}
              onChange={(v) => setPeriod({ month: parseInt(v, 10) })}
              options={MONTHS.map((m, i) => ({ value: i + 1, label: `${i + 1} — ${m}` }))}
            />
          </FormField>

          <FormField label="Cel złożenia">
            <div className="flex items-center gap-4 h-[38px]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="celZlozenia"
                  checked={period.celZlozenia === 1}
                  onChange={() => setPeriod({ celZlozenia: 1 })}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">Złożenie (1)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="celZlozenia"
                  checked={period.celZlozenia === 2}
                  onChange={() => setPeriod({ celZlozenia: 2 })}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">Korekta (2)</span>
              </label>
            </div>
          </FormField>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 flex justify-between">
        <button
          onClick={() => setCurrentStep(2)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Wstecz
        </button>
        <button
          onClick={() => setCurrentStep(4)}
          disabled={!canProceed}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            canProceed
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-bg-hover text-text-muted cursor-not-allowed'
          }`}
        >
          Dalej
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
