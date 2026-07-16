import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Plus, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/ui/Chip'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { searchEntries } from '@/domain/search'
import {
  equipmentTypes,
  muscleGroups,
  type Equipment,
  type ExerciseDef,
  type MuscleGroup,
} from '@/domain/types'
import { ExerciseForm } from './ExerciseForm'
import { ExerciseMenu } from './ExerciseMenu'

export function LibraryScreen() {
  const { t } = useTranslation('exercises')
  const { entries } = useExerciseIndex()
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

  return (
    <div className="flex flex-col gap-3 px-4 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <button
          type="button"
          aria-label={t('addCustom')}
          onClick={() => setCreating(true)}
          className="flex size-10 items-center justify-center rounded-card bg-surface-2 text-ink"
        >
          <Plus className="size-5" />
        </button>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-11 w-full rounded-card border border-hairline bg-surface-2 pl-9 pr-3 text-base outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {muscleGroups.map((m) => (
          <Chip
            key={m}
            label={t(`muscle.${m}`)}
            active={muscle === m}
            onClick={() => setMuscle(muscle === m ? null : m)}
          />
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {equipmentTypes.map((e) => (
          <Chip
            key={e}
            label={t(`equipment.${e}`)}
            active={equipment === e}
            onClick={() => setEquipment(equipment === e ? null : e)}
          />
        ))}
      </div>

      {results.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-2">{t('noResults')}</p>
      ) : query.trim() ? (
        <Rows items={results} />
      ) : (
        <>
          {results.some((d) => d.custom) && (
            <section>
              <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                {t('sections.mine')}
              </h2>
              <Rows items={results.filter((d) => d.custom)} />
            </section>
          )}
          {results.some((d) => !d.custom) && (
            <section>
              <h2 className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                {t('sections.catalog')}
              </h2>
              <Rows items={results.filter((d) => !d.custom)} />
            </section>
          )}
        </>
      )}

      <ExerciseForm open={creating} onOpenChange={setCreating} onSaved={() => setCreating(false)} />
    </div>
  )
}

function Rows({ items }: { items: ExerciseDef[] }) {
  const { t } = useTranslation('exercises')
  return (
    <ul className="flex flex-col">
      {items.map((def) => (
        <li key={def.id} className="flex items-center gap-1">
          <Link
            to={`/ejercicios/${def.id}`}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-card px-2 py-2.5 active:bg-surface-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{def.name}</span>
              <span className="block text-xs text-ink-3">
                {t(`muscle.${def.muscle}`)} · {t(`equipment.${def.equipment}`)}
                {def.custom ? ` · ${t('customBadge')}` : ''}
              </span>
            </span>
          </Link>
          <ExerciseMenu def={def} />
        </li>
      ))}
    </ul>
  )
}
