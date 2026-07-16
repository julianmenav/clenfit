import { useMemo, useState } from 'react'
import { Plus, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { searchEntries } from '@/domain/search'
import { rankSimilar } from '@/domain/similarity'
import {
  equipmentTypes,
  muscleGroups,
  type Equipment,
  type ExerciseDef,
  type MuscleGroup,
} from '@/domain/types'
import { ExerciseForm } from './ExerciseForm'

/**
 * Exercise search (sheet): instant accent-insensitive filtering, chips by
 * muscle and equipment and, if `similarTo`, a similar-exercises section first
 * (swap out a busy machine in two taps).
 */
export function ExercisePicker({
  open,
  onOpenChange,
  onSelect,
  title,
  similarTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (def: ExerciseDef) => void
  title: string
  similarTo?: ExerciseDef
}) {
  const { t } = useTranslation(['exercises', 'workout'])
  const { all, entries } = useExerciseIndex()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [creating, setCreating] = useState(false)

  const results = useMemo(() => {
    const filtered = entries.filter(
      (e) =>
        (muscle === null || e.item.muscle === muscle) &&
        (equipment === null || e.item.equipment === equipment),
    )
    return searchEntries(query, filtered)
  }, [entries, query, muscle, equipment])

  const similar = useMemo(() => {
    if (!similarTo || query.trim() || muscle || equipment) return []
    return rankSimilar(similarTo, all)
  }, [similarTo, all, query, muscle, equipment])

  const similarIds = new Set(similar.map((s) => s.id))
  const rest = similar.length > 0 ? results.filter((r) => !similarIds.has(r.id)) : results

  function select(def: ExerciseDef) {
    onSelect(def)
    onOpenChange(false)
    setQuery('')
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title={title} tall>
        <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3 pt-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('exercises:searchPlaceholder')}
              className="h-11 w-full rounded-card border border-hairline bg-surface-2 pl-9 pr-3 text-base outline-none focus:border-accent"
            />
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {muscleGroups.map((m) => (
              <Chip
                key={m}
                label={t(`exercises:muscle.${m}`)}
                active={muscle === m}
                onClick={() => setMuscle(muscle === m ? null : m)}
              />
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {equipmentTypes.map((e) => (
              <Chip
                key={e}
                label={t(`exercises:equipment.${e}`)}
                active={equipment === e}
                onClick={() => setEquipment(equipment === e ? null : e)}
              />
            ))}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="pt-1">
            <h3 className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
              {t('workout:similar')}
            </h3>
            <ul>
              {similar.map((def) => (
                <ExerciseRow key={def.id} def={def} onSelect={select} highlight />
              ))}
            </ul>
            <h3 className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
              {t('workout:allExercises')}
            </h3>
          </section>
        )}

        {rest.length === 0 && similar.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-2">{t('exercises:noResults')}</p>
        ) : (
          <ul className="pb-2">
            {rest.map((def) => (
              <ExerciseRow key={def.id} def={def} onSelect={select} />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-auto flex h-11 shrink-0 items-center justify-center gap-2 rounded-card border border-dashed border-hairline text-sm font-medium text-ink-2"
        >
          <Plus className="size-4" />
          {t('exercises:addCustom')}
        </button>
      </Sheet>

      <ExerciseForm
        open={creating}
        onOpenChange={setCreating}
        initial={{ name: query }}
        onSaved={(def) => {
          setCreating(false)
          select(def)
        }}
      />
    </>
  )
}

function ExerciseRow({
  def,
  onSelect,
  highlight = false,
}: {
  def: ExerciseDef
  onSelect: (def: ExerciseDef) => void
  highlight?: boolean
}) {
  const { t } = useTranslation('exercises')
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(def)}
        className={`flex w-full items-center justify-between gap-3 rounded-card px-2 py-2.5 text-left active:bg-surface-2 ${
          highlight ? 'bg-surface-2/60' : ''
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{def.name}</span>
          <span className="block text-xs text-ink-3">
            {t(`muscle.${def.muscle}`)} · {t(`equipment.${def.equipment}`)}
            {def.custom ? ` · ${t('customBadge')}` : ''}
          </span>
        </span>
      </button>
    </li>
  )
}
