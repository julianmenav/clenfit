import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CATALOG } from './catalog/exercises'
import { makeEntry, type SearchEntry } from '@/domain/search'
import type { CustomExercise, ExerciseDef, WithId } from '@/domain/types'
import { useCustomExercises } from './hooks'

export function customToDef(c: WithId<CustomExercise>): ExerciseDef {
  return {
    id: c.id,
    name: c.name,
    muscle: c.muscle,
    secondaryMuscles: c.secondaryMuscles,
    equipment: c.equipment,
    movement: c.movement,
    measurement: c.measurement,
    custom: true,
  }
}

export interface ExerciseIndex {
  /** Searchable: non-deprecated catalog + custom. */
  all: ExerciseDef[]
  /** Resolution by id, including deprecated ones (for the history). */
  byId: Map<string, ExerciseDef>
  entries: SearchEntry<ExerciseDef>[]
  loading: boolean
}

/** Static catalog + custom exercises, with a normalized search index. */
export function useExerciseIndex(): ExerciseIndex {
  const { t } = useTranslation('exercises')
  const custom = useCustomExercises()

  return useMemo(() => {
    const customDefs = (custom ?? []).map(customToDef)
    const merged = [...CATALOG, ...customDefs]
    const byId = new Map(merged.map((e) => [e.id, e]))
    const all = merged.filter((e) => !e.deprecated)
    const entries = all.map((e) =>
      makeEntry(e, e.name, e.aliases, [t(`muscle.${e.muscle}`), t(`equipment.${e.equipment}`)]),
    )
    return { all, byId, entries, loading: custom === undefined }
  }, [custom, t])
}
