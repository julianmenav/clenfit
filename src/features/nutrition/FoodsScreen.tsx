import { useMemo, useState } from 'react'
import { SearchIcon, Trash2, Utensils } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { BackButton } from '@/components/ui/BackButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { useFoods } from '@/data/hooks'
import { deleteFood, saveFood } from '@/data/nutritionMutations'
import { rankFoods } from '@/domain/nutrition'
import type { Food, WithId } from '@/domain/types'
import { draftFromFood, draftIsValid, draftToFoodFields, type FoodDraft } from './foodDraft'
import { FoodForm } from './FoodForm'
import { FoodListRow } from './FoodListRow'

/** Personal food library: search, edit values, delete. Past entries are never touched. */
export function FoodsScreen() {
  const uid = useUser().uid
  const { t } = useTranslation(['nutrition', 'common'])
  const foods = useFoods()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<WithId<Food> | null>(null)
  const [draft, setDraft] = useState<FoodDraft | null>(null)
  const [confirming, setConfirming] = useState(false)

  const ranked = useMemo(() => rankFoods(foods ?? [], query), [foods, query])

  function open(food: WithId<Food>) {
    setEditing(food)
    setDraft(draftFromFood(food))
  }

  function close() {
    setEditing(null)
    setDraft(null)
    setConfirming(false)
  }

  function save() {
    if (!editing || !draft || !draftIsValid(draft)) return
    saveFood(uid, { ...editing, ...draftToFoodFields(draft) })
    close()
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <header className="flex items-center gap-2">
        <BackButton fallback="/comida" />
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">
          {t('nutrition:library.title')}
        </h1>
      </header>

      {foods === undefined ? (
        <p className="pt-10 text-center text-ink-3">{t('common:loading')}</p>
      ) : foods.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title={t('nutrition:library.empty.title')}
          body={t('nutrition:library.empty.body')}
        />
      ) : (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('nutrition:library.searchPlaceholder')}
              className="h-11 w-full rounded-card border border-hairline bg-surface-2 pl-9 pr-3 text-base outline-none focus:border-accent"
            />
          </div>
          {ranked.length === 0 ? (
            <p className="pt-6 text-center text-sm text-ink-3">
              {t('nutrition:library.noMatches')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ranked.map((food) => (
                <FoodListRow key={food.id} food={food} onClick={() => open(food)} />
              ))}
            </ul>
          )}
        </>
      )}

      {/* Steps aside while the confirm dialog is up (vaul's modal layer would block it). */}
      <Sheet
        open={editing != null && !confirming}
        onOpenChange={(o) => !o && !confirming && close()}
        title={t('nutrition:library.editTitle')}
      >
        {editing && draft && (
          <div className="flex flex-col gap-4 pt-2 pb-2">
            <p className="text-xs text-ink-3">
              {t('nutrition:library.usedTimes', { count: editing.useCount })}
            </p>
            <FoodForm draft={draft} onChange={setDraft} />
            <button
              type="button"
              disabled={!draftIsValid(draft)}
              onClick={save}
              className="h-12 w-full rounded-card bg-accent font-semibold text-on-accent disabled:opacity-50"
            >
              {t('common:actions.save')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-hairline font-medium text-status-over"
            >
              <Trash2 className="size-4" />
              {t('nutrition:library.delete')}
            </button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title={t('nutrition:library.delete')}
        body={t('nutrition:library.deleteBody')}
        confirmLabel={t('common:actions.delete')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (editing) deleteFood(uid, editing.id)
          close()
        }}
      />
    </div>
  )
}
