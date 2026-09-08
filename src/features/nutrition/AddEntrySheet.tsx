import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '@/components/ui/Sheet'
import { newEntryId } from '@/data/nutritionMutations'
import { entryMacros, rankFoods } from '@/domain/nutrition'
import type { Food, FoodEntry, Macros, WithId } from '@/domain/types'
import { draftIsValid, draftToFoodFields, emptyFoodDraft, type FoodDraft } from './foodDraft'
import { AmountField, FoodForm, MacroPreview } from './FoodForm'
import { FoodListRow } from './FoodListRow'

type Step = { kind: 'search' } | { kind: 'amount'; food: WithId<Food> } | { kind: 'new' }

/**
 * Add flow: search the library → amount, or «Nuevo alimento» → form + amount
 * (+ optional save to the library, off by default).
 */
export function AddEntrySheet({
  open,
  onOpenChange,
  foods,
  goal,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  foods: WithId<Food>[]
  goal: Macros
  onAdd: (entry: FoodEntry, opts: { food: WithId<Food> | null; saveToLibrary: boolean }) => void
}) {
  const { t } = useTranslation(['nutrition', 'common'])
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'search' })
  const [amount, setAmount] = useState<number | null>(null)
  const [draft, setDraft] = useState<FoodDraft>(emptyFoodDraft())
  const [save, setSave] = useState(false)

  // fresh state every time the sheet opens
  useEffect(() => {
    if (!open) return
    setQuery('')
    setStep({ kind: 'search' })
    setAmount(null)
    setDraft(emptyFoodDraft())
    setSave(false)
  }, [open])

  const ranked = useMemo(() => rankFoods(foods, query).slice(0, 30), [foods, query])

  function pickFood(food: WithId<Food>) {
    setAmount(food.lastAmount ?? (food.kind === 'perUnit' ? 1 : null))
    setStep({ kind: 'amount', food })
  }

  function startNew() {
    setDraft(emptyFoodDraft(query.trim()))
    setAmount(null)
    setStep({ kind: 'new' })
  }

  function confirmFromFood(food: WithId<Food>) {
    if (amount == null || amount <= 0) return
    onAdd(
      {
        id: newEntryId(),
        foodId: food.id,
        name: food.name,
        kind: food.kind,
        unitLabel: food.unitLabel,
        amount,
        per: food.per,
      },
      { food, saveToLibrary: false },
    )
    onOpenChange(false)
  }

  function confirmNew() {
    if (!draftIsValid(draft) || amount == null || amount <= 0) return
    const fields = draftToFoodFields(draft)
    onAdd(
      { id: newEntryId(), foodId: null, ...fields, amount },
      { food: null, saveToLibrary: save },
    )
    onOpenChange(false)
  }

  const canConfirm = amount != null && amount > 0

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('nutrition:addSheet.title')}
      tall={step.kind === 'search'}
    >
      {step.kind === 'search' && (
        <div className="flex flex-col gap-2 pt-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('nutrition:addSheet.searchPlaceholder')}
              className="h-11 w-full rounded-card border border-hairline bg-surface-2 pl-9 pr-3 text-base outline-none focus:border-accent"
            />
          </div>

          <ul className="flex flex-col gap-2 pt-1">
            {ranked.length === 0 && <NewFoodRow query={query} onClick={startNew} first />}
            {ranked.map((food) => (
              <FoodListRow key={food.id} food={food} onClick={() => pickFood(food)} />
            ))}
            {ranked.length > 0 && <NewFoodRow query={query} onClick={startNew} />}
          </ul>
          {ranked.length === 0 && (
            <p className="pt-2 text-center text-sm text-ink-3">
              {foods.length === 0
                ? t('nutrition:addSheet.noFoods')
                : t('nutrition:addSheet.noMatches')}
            </p>
          )}
        </div>
      )}

      {step.kind === 'amount' && (
        <div className="flex flex-col gap-4 pt-2 pb-2">
          <BackRow
            onClick={() => setStep({ kind: 'search' })}
            label={t('nutrition:addSheet.back')}
          />
          <p className="text-lg font-semibold">{step.food.name}</p>
          <AmountField
            kind={step.food.kind}
            unitLabel={step.food.unitLabel}
            value={amount}
            onChange={setAmount}
          />
          {canConfirm && (
            <MacroPreview
              macros={entryMacros({ kind: step.food.kind, amount: amount!, per: step.food.per })}
              goal={goal}
            />
          )}
          <ConfirmButton disabled={!canConfirm} onClick={() => confirmFromFood(step.food)} />
        </div>
      )}

      {step.kind === 'new' && (
        <div className="flex flex-col gap-4 pt-2 pb-2">
          <BackRow
            onClick={() => setStep({ kind: 'search' })}
            label={t('nutrition:addSheet.back')}
          />
          <FoodForm draft={draft} onChange={setDraft} />
          <AmountField
            kind={draft.kind}
            unitLabel={draft.unitLabel.trim() || null}
            value={amount}
            onChange={setAmount}
          />
          {canConfirm && draftIsValid(draft) && (
            <MacroPreview
              macros={entryMacros({
                kind: draft.kind,
                amount: amount!,
                per: draftToFoodFields(draft).per,
              })}
              goal={goal}
            />
          )}
          <label className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-3">
            <span className="text-sm font-medium">{t('nutrition:form.saveToLibrary')}</span>
            <input
              type="checkbox"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
              className="size-5 accent-(--accent)"
            />
          </label>
          <ConfirmButton disabled={!canConfirm || !draftIsValid(draft)} onClick={confirmNew} />
        </div>
      )}
    </Sheet>
  )
}

function NewFoodRow({
  query,
  onClick,
  first = false,
}: {
  query: string
  onClick: () => void
  first?: boolean
}) {
  const { t } = useTranslation('nutrition')
  const q = query.trim()
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex h-12 w-full items-center gap-2 rounded-card border border-dashed px-3 text-sm font-medium ${
          first ? 'border-accent text-accent' : 'border-hairline text-ink-2'
        }`}
      >
        <Plus className="size-4" />
        {q ? t('addSheet.newFoodNamed', { name: q }) : t('addSheet.newFood')}
      </button>
    </li>
  )
}

function BackRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 self-start text-sm text-ink-2"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  )
}

function ConfirmButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useTranslation('nutrition')
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full rounded-card bg-accent font-semibold text-on-accent disabled:opacity-50"
    >
      {t('add')}
    </button>
  )
}
