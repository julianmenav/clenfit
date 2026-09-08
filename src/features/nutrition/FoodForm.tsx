import { useTranslation } from 'react-i18next'
import { NumericField } from '@/components/ui/NumericField'
import { proteinIndex } from '@/domain/nutrition'
import type { FoodKind, Macros } from '@/domain/types'
import { formatKg, parseDecimal } from '@/lib/formatSet'
import { cn } from '@/lib/utils'
import type { FoodDraft } from './foodDraft'
import { formatAmount, formatGrams, formatIndex, formatKcal } from './format'

const inputClass =
  'h-11 w-full rounded-card border border-hairline bg-surface-2 px-3 text-base outline-none placeholder:text-ink-3/70 focus:border-accent'

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel: string
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-2">
        {label}
        {hint && <span className="text-ink-3"> · {hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** Fields of a library food: name, per-100g/per-unit toggle, unit label, four macros. */
export function FoodForm({
  draft,
  onChange,
}: {
  draft: FoodDraft
  onChange: (d: FoodDraft) => void
}) {
  const { t } = useTranslation(['nutrition', 'common'])
  const optional = t('nutrition:form.optional')

  function setPer(key: keyof FoodDraft['per'], v: number | null) {
    onChange({ ...draft, per: { ...draft.per, [key]: v } })
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label={t('nutrition:form.name')}>
        <TextInput
          value={draft.name}
          onChange={(name) => onChange({ ...draft, name })}
          placeholder={t('nutrition:form.namePlaceholder')}
          ariaLabel={t('nutrition:form.name')}
        />
      </Field>

      <Field label={t('nutrition:form.kind')}>
        <div className="flex rounded-card bg-surface-2 p-1">
          {(['per100g', 'perUnit'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={draft.kind === kind}
              onClick={() => onChange({ ...draft, kind })}
              className={cn(
                'h-9 flex-1 rounded-[10px] text-sm font-medium transition-colors',
                draft.kind === kind ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              {t(`nutrition:form.${kind}`)}
            </button>
          ))}
        </div>
      </Field>

      {draft.kind === 'perUnit' && (
        <Field label={t('nutrition:form.unitLabel')} hint={optional}>
          <TextInput
            value={draft.unitLabel}
            onChange={(unitLabel) => onChange({ ...draft, unitLabel })}
            placeholder={t('nutrition:form.unitLabelPlaceholder')}
            ariaLabel={t('nutrition:form.unitLabel')}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('nutrition:form.kcal')}>
          <NumericField
            ariaLabel={t('nutrition:form.kcal')}
            value={draft.per.kcal}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('kcal', v)}
          />
        </Field>
        <Field label={t('nutrition:form.protein')} hint={optional}>
          <NumericField
            ariaLabel={t('nutrition:form.protein')}
            value={draft.per.protein}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('protein', v)}
          />
        </Field>
        <Field label={t('nutrition:form.carbs')} hint={optional}>
          <NumericField
            ariaLabel={t('nutrition:form.carbs')}
            value={draft.per.carbs}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('carbs', v)}
          />
        </Field>
        <Field label={t('nutrition:form.fat')} hint={optional}>
          <NumericField
            ariaLabel={t('nutrition:form.fat')}
            value={draft.per.fat}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('fat', v)}
          />
        </Field>
      </div>
    </div>
  )
}

/** Amount eaten, with the unit as a suffix («g», the unit label, or «ud»). */
export function AmountField({
  kind,
  unitLabel,
  value,
  onChange,
}: {
  kind: FoodKind
  unitLabel: string | null
  value: number | null
  onChange: (v: number | null) => void
}) {
  const { t } = useTranslation(['nutrition', 'common'])
  const suffix =
    kind === 'per100g' ? t('common:units.g') : unitLabel || t('nutrition:form.unitShort')
  return (
    <Field label={t('nutrition:form.amountEaten')}>
      <div className="flex items-center gap-2">
        <NumericField
          ariaLabel={t('nutrition:form.amountEaten')}
          value={value}
          format={formatAmount}
          parse={parseDecimal}
          onCommit={onChange}
          className="text-lg"
        />
        <span className="w-16 truncate text-sm text-ink-3">{suffix}</span>
      </div>
    </Field>
  )
}

/** «350 kcal · 30 g prot» plus the protein index when computable. */
export function MacroPreview({ macros, goal }: { macros: Macros; goal: Macros }) {
  const { t } = useTranslation(['nutrition', 'common'])
  const index = proteinIndex(macros, goal)
  return (
    <div className="flex items-center justify-between rounded-card bg-surface-2 px-3 py-2 text-sm">
      <span className="tnum font-medium">
        {macros.protein != null
          ? t('nutrition:preview.full', {
              kcal: formatKcal(macros.kcal),
              protein: formatGrams(macros.protein),
            })
          : t('nutrition:preview.kcalOnly', { kcal: formatKcal(macros.kcal) })}
      </span>
      {index != null && (
        <span
          className={cn('tnum text-xs font-semibold', index >= 1 ? 'text-accent' : 'text-ink-3')}
        >
          {t('nutrition:day.index')} {formatIndex(index)}
        </span>
      )}
    </div>
  )
}
