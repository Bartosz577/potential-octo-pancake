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
  Trash2,
  Calendar,
  CreditCard,
  FileText,
  Warehouse,
  ShieldCheck,
  Info
} from 'lucide-react'
import { useCompanyStore, type CompanyData } from '@renderer/stores/companyStore'
import type { PeriodData } from '@renderer/stores/companyStore'
import { useImportStore } from '@renderer/stores/importStore'
import { useAppStore, type JpkSubtype, type JpkType } from '@renderer/stores/appStore'
import { validatePolishNip, normalizeNip } from '@renderer/utils/nipValidator'
import { jpkTypeToLabel } from '../../../../core/mapping/jpkTypeUtils'
import { getDetectedTypes, computeSectionFlags, computeCanProceed } from './companyStepLogic'

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

const QUARTERS = [
  { value: 1, label: 'I kwartał (sty–mar)' },
  { value: 2, label: 'II kwartał (kwi–cze)' },
  { value: 3, label: 'III kwartał (lip–wrz)' },
  { value: 4, label: 'IV kwartał (paź–gru)' }
]

const TYPE_COLORS: Record<string, string> = {
  V7M: 'border-l-blue-500',
  FA: 'border-l-purple-500',
  FA_RR: 'border-l-purple-400',
  MAG: 'border-l-green-500',
  WB: 'border-l-orange-500',
  PKPIR: 'border-l-cyan-500',
  EWP: 'border-l-teal-500',
  KR_PD: 'border-l-rose-500',
  KR: 'border-l-rose-400',
  ST: 'border-l-amber-500',
  ST_KR: 'border-l-amber-400'
}

// FA data column indices (0-based, after 6 meta columns)
const FA_SELLER_NAME_COL = 5  // P_3C
const FA_SELLER_NIP_COL = 8   // P_4B

function extractCompanyFromFA(files: ReturnType<typeof useImportStore.getState>['files']): Partial<CompanyData> | null {
  const faFile = files.find((f) => f.jpkType === 'FA')
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
  optional = false,
  required = false
}: {
  label: string
  children: React.ReactNode
  optional?: boolean
  required?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && <span className="text-zinc-400 ml-1">(opcjonalnie)</span>}
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

/** Correction number input — shown when celZlozenia === 2 */
function NumerKorektyInput({
  value,
  onChange
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
}): React.JSX.Element {
  return (
    <FormField label="Numer korekty" required>
      <input
        type="number"
        min={1}
        max={99}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
        placeholder="1"
        className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
      />
    </FormField>
  )
}

/** Period card for V7M/V7K — monthly/quarterly toggle + year/month/quarter selects */
function V7MPeriodCard({
  period,
  jpkSubtype,
  onSetPeriod,
  onSetSubtype
}: {
  period: PeriodData
  jpkSubtype: JpkSubtype
  onSetPeriod: (data: Partial<PeriodData>) => void
  onSetSubtype: (sub: JpkSubtype) => void
}): React.JSX.Element {
  return (
    <div className={`bg-bg-card rounded-xl border border-border border-l-4 ${TYPE_COLORS['V7M']} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {jpkSubtype === 'V7K' ? 'JPK_V7K — kwartalny' : 'JPK_V7M — miesięczny'}
        </h3>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['V7M', 'V7K'] as JpkSubtype[]).map((sub) => (
            <button
              key={sub}
              onClick={() => onSetSubtype(sub)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                jpkSubtype === sub
                  ? 'bg-accent text-white'
                  : 'bg-bg-input text-text-secondary hover:text-text-primary'
              }`}
            >
              {sub === 'V7M' ? 'Miesięczny' : 'Kwartalny'}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid ${period.celZlozenia === 2 ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
        <FormField label="Rok" required>
          <SelectInput
            value={period.year}
            onChange={(v) => onSetPeriod({ year: parseInt(v, 10) })}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))}
          />
        </FormField>

        {jpkSubtype === 'V7K' ? (
          <FormField label="Kwartał" required>
            <SelectInput
              value={period.quarter ?? 1}
              onChange={(v) => onSetPeriod({ quarter: parseInt(v, 10) })}
              options={QUARTERS.map((q) => ({ value: q.value, label: q.label }))}
            />
          </FormField>
        ) : (
          <FormField label="Miesiąc" required>
            <SelectInput
              value={period.month ?? 1}
              onChange={(v) => onSetPeriod({ month: parseInt(v, 10) })}
              options={MONTHS.map((m, i) => ({ value: i + 1, label: `${i + 1} — ${m}` }))}
            />
          </FormField>
        )}

        <FormField label="Cel złożenia" required>
          <div className="flex items-center gap-4 h-[38px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="celZlozenia-V7M"
                checked={period.celZlozenia === 1}
                onChange={() => onSetPeriod({ celZlozenia: 1, numerKorekty: undefined })}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Złożenie (1)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="celZlozenia-V7M"
                checked={period.celZlozenia === 2}
                onChange={() => onSetPeriod({ celZlozenia: 2 })}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Korekta (2)</span>
            </label>
          </div>
        </FormField>

        {period.celZlozenia === 2 && (
          <NumerKorektyInput
            value={period.numerKorekty}
            onChange={(v) => onSetPeriod({ numerKorekty: v })}
          />
        )}
      </div>
    </div>
  )
}

/** Period card for non-V7M types — dataOd/dataDo date inputs */
function GenericPeriodCard({
  jpkType,
  period,
  onSetPeriod
}: {
  jpkType: JpkType
  period: PeriodData
  onSetPeriod: (data: Partial<PeriodData>) => void
}): React.JSX.Element {
  const label = jpkTypeToLabel(jpkType)
  const colorClass = TYPE_COLORS[jpkType] || 'border-l-zinc-500'

  return (
    <div className={`bg-bg-card rounded-xl border border-border border-l-4 ${colorClass} p-5`}>
      <h3 className="text-sm font-semibold text-text-primary mb-4">{label}</h3>

      <div className={`grid ${period.celZlozenia === 2 ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
        <FormField label="Data od" required>
          <input
            type="date"
            value={period.dataOd ?? ''}
            onChange={(e) => onSetPeriod({ dataOd: e.target.value })}
            className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary border border-border focus:border-accent outline-none transition-colors"
          />
        </FormField>

        <FormField label="Data do" required>
          <input
            type="date"
            value={period.dataDo ?? ''}
            onChange={(e) => onSetPeriod({ dataDo: e.target.value })}
            className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary border border-border focus:border-accent outline-none transition-colors"
          />
        </FormField>

        <FormField label="Cel złożenia" required>
          <div className="flex items-center gap-4 h-[38px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`celZlozenia-${jpkType}`}
                checked={period.celZlozenia === 1}
                onChange={() => onSetPeriod({ celZlozenia: 1, numerKorekty: undefined })}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Złożenie (1)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`celZlozenia-${jpkType}`}
                checked={period.celZlozenia === 2}
                onChange={() => onSetPeriod({ celZlozenia: 2 })}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Korekta (2)</span>
            </label>
          </div>
        </FormField>

        {period.celZlozenia === 2 && (
          <NumerKorektyInput
            value={period.numerKorekty}
            onChange={(v) => onSetPeriod({ numerKorekty: v })}
          />
        )}
      </div>
    </div>
  )
}

export function CompanyStep(): React.JSX.Element {
  const { company, savedCompanies, setCompany, setPeriod, getPeriod, saveCompany, loadCompany, removeSavedCompany } =
    useCompanyStore()
  const { files } = useImportStore()
  const { activeJpkType, jpkSubtype, setJpkSubtype, setCurrentStep } = useAppStore()

  // Detect unique JPK types from imported files
  const detectedTypes = useMemo(() => getDetectedTypes(files), [files])
  const { showAll, hasV7, hasFA, hasMAG, hasWB } = useMemo(
    () => computeSectionFlags(detectedTypes),
    [detectedTypes]
  )

  // Types used for period cards and validation
  const typesToValidate = useMemo(
    () => (showAll ? [activeJpkType] : detectedTypes),
    [showAll, activeJpkType, detectedTypes]
  )

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
    if (filePeriod) setPeriod(activeJpkType, filePeriod)
  }

  const handleFillPeriod = (): void => {
    if (filePeriod) setPeriod(activeJpkType, filePeriod)
  }

  const nipNormalized = normalizeNip(company.nip)
  const nipValid = nipNormalized.length === 10 && validatePolishNip(nipNormalized)

  // canProceed — delegated to pure function
  const canProceed = useMemo(
    () => computeCanProceed({ company, typesToValidate, jpkSubtype, getPeriod }),
    [company, typesToValidate, jpkSubtype, getPeriod]
  )

  // Check if FA data differs from current form
  const faDataAvailable = faCompanyData !== null
  const faDataDiffers = faCompanyData &&
    (normalizeNip(faCompanyData.nip || '') !== nipNormalized ||
     faCompanyData.fullName !== company.fullName)
  const period = getPeriod(activeJpkType)
  const periodDiffers = filePeriod &&
    (filePeriod.year !== period.year || filePeriod.month !== (period.month ?? 1))

  return (
    <div className="flex-1 flex flex-col p-6 gap-5 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Dane podmiotu</h1>
        <p className="text-sm text-text-secondary">
          Uzupełnij dane firmy i okresy rozliczeniowe dla nagłówków JPK
        </p>
      </div>

      {/* Detected types banner */}
      {files.length > 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs text-text-secondary">
            Wykryte typy JPK:{' '}
            {detectedTypes.map((t) => (
              <span key={t} className="inline-block px-1.5 py-0.5 mx-0.5 bg-blue-500/15 text-blue-300 rounded text-xs font-medium">
                {jpkTypeToLabel(t, t === 'V7M' ? jpkSubtype : null)}
              </span>
            ))}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <Info className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="text-xs text-yellow-300/80">
            Brak zaimportowanych plików — używam domyślnego typu {jpkTypeToLabel(activeJpkType, jpkSubtype)}
          </span>
        </div>
      )}

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

      {/* Section 1: Dane firmy */}
      <div className="bg-bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Dane firmy</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="NIP" required>
            <NipInput value={company.nip} onChange={(nip) => setCompany({ nip })} />
          </FormField>

          <FormField label="Pełna nazwa" required>
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

          <FormField label="Kod urzędu skarbowego" required>
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
              value={company.telefon ?? ''}
              onChange={(e) => setCompany({ telefon: e.target.value })}
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

      {/* Section 2: Okresy rozliczeniowe — per-type cards */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Okresy rozliczeniowe</h2>
        </div>

        {typesToValidate.map((t) =>
          t === 'V7M' ? (
            <V7MPeriodCard
              key={t}
              period={getPeriod('V7M')}
              jpkSubtype={jpkSubtype}
              onSetPeriod={(data) => setPeriod('V7M', data)}
              onSetSubtype={setJpkSubtype}
            />
          ) : (
            <GenericPeriodCard
              key={t}
              jpkType={t}
              period={getPeriod(t)}
              onSetPeriod={(data) => setPeriod(t, data)}
            />
          )
        )}
      </div>

      {/* Section 3: KSeF — only when V7M detected */}
      {hasV7 && (
        <div className="bg-bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">KSeF</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data objęcia KSeF" optional>
              <input
                type="date"
                value={company.objetyKsefOd ?? ''}
                onChange={(e) => setCompany({ objetyKsefOd: e.target.value })}
                className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary border border-border focus:border-accent outline-none transition-colors"
              />
            </FormField>
          </div>

          {company.objetyKsefOd && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs text-blue-300">
                Faktury przed {company.objetyKsefOd} → oznaczane BFK
              </span>
            </div>
          )}
        </div>
      )}

      {/* Section 4: Dane rachunku bankowego — only when WB detected */}
      {hasWB && (
        <div className="bg-bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-text-primary">Dane rachunku bankowego</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Numer rachunku" required>
              <input
                type="text"
                value={company.numerRachunku ?? ''}
                onChange={(e) => setCompany({ numerRachunku: e.target.value })}
                placeholder="PL00 0000 0000 0000 0000 0000 0000"
                className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
              />
            </FormField>

            <FormField label="Waluta rachunku" optional>
              <SelectInput
                value={company.walutaRachunku ?? 'PLN'}
                onChange={(v) => setCompany({ walutaRachunku: v })}
                options={[
                  { value: 'PLN', label: 'PLN — złoty' },
                  { value: 'EUR', label: 'EUR — euro' },
                  { value: 'USD', label: 'USD — dolar' },
                  { value: 'GBP', label: 'GBP — funt' }
                ]}
              />
            </FormField>

            <FormField label="Saldo początkowe" optional>
              <input
                type="number"
                step="0.01"
                value={company.saldoPoczatkowe ?? ''}
                onChange={(e) => setCompany({ saldoPoczatkowe: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Section 5: Dane faktury — only when FA detected */}
      {hasFA && (
        <div className="bg-bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-text-primary">Dane faktury</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Miejsce wystawienia (P_1M)" optional>
              <input
                type="text"
                value={company.miejsceWystawienia ?? ''}
                onChange={(e) => setCompany({ miejsceWystawienia: e.target.value })}
                placeholder="Warszawa"
                className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Section 6: Dane magazynu — only when MAG detected */}
      {hasMAG && (
        <div className="bg-bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Warehouse className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-semibold text-text-primary">Dane magazynu</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Kod magazynu" optional>
              <input
                type="text"
                value={company.kodMagazynu ?? ''}
                onChange={(e) => setCompany({ kodMagazynu: e.target.value })}
                placeholder="MAG-01"
                className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm font-mono text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
              />
            </FormField>

            <FormField label="Nazwa magazynu" optional>
              <input
                type="text"
                value={company.nazwaMagazynu ?? ''}
                onChange={(e) => setCompany({ nazwaMagazynu: e.target.value })}
                placeholder="Magazyn główny"
                className="w-full px-3 py-2 bg-bg-input rounded-lg text-sm text-text-primary placeholder:text-text-muted border border-border focus:border-accent outline-none transition-colors"
              />
            </FormField>
          </div>
        </div>
      )}

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
