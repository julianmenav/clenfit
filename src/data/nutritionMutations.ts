import { deleteDoc, doc, setDoc, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { foodFromEntry } from '@/domain/nutrition'
import type { Food, FoodEntry, Macros, NutritionDay, WithId } from '@/domain/types'
import { foodDoc, foodsCol, nutritionDayDoc } from './converters'

/** Entries are embedded in the day doc, so ids are minted client-side. */
export function newEntryId(): string {
  return crypto.randomUUID()
}

function dayWith(dateKey: string, entries: FoodEntry[], goal: Macros): WithId<NutritionDay> {
  return { id: dateKey, dateKey, goal, entries, updatedAt: Timestamp.now() }
}

function logError(tag: string) {
  return (err: unknown) => console.error(`[${tag}]`, err)
}

/**
 * Appends an entry to a day. `day` is what the screen already holds from the
 * live hook (null = nothing logged that day) — no read round-trip, offline-safe.
 * One batch: the day (with its goal snapshot) plus either the usage bump of
 * the library food it came from or, with `saveToLibrary`, the new food.
 */
export function addEntry(
  uid: string,
  dateKey: string,
  day: NutritionDay | null,
  entry: FoodEntry,
  goal: Macros,
  opts: { food: WithId<Food> | null; saveToLibrary: boolean },
): void {
  const batch = writeBatch(db)
  const now = Timestamp.now()
  let linked = entry

  if (opts.food) {
    batch.set(foodDoc(uid, opts.food.id), {
      ...opts.food,
      lastAmount: entry.amount,
      useCount: opts.food.useCount + 1,
      lastUsedAt: now,
    })
    linked = { ...entry, foodId: opts.food.id }
  } else if (opts.saveToLibrary) {
    const ref = doc(foodsCol(uid))
    batch.set(ref, { id: ref.id, ...foodFromEntry(entry), lastUsedAt: now, createdAt: now })
    linked = { ...entry, foodId: ref.id }
  }

  batch.set(
    nutritionDayDoc(uid, dateKey),
    dayWith(dateKey, [...(day?.entries ?? []), linked], goal),
  )
  batch.commit().catch(logError('addEntry'))
}

export function updateEntry(
  uid: string,
  day: WithId<NutritionDay>,
  entry: FoodEntry,
  goal: Macros,
): void {
  const entries = day.entries.map((e) => (e.id === entry.id ? entry : e))
  setDoc(nutritionDayDoc(uid, day.id), dayWith(day.id, entries, goal)).catch(
    logError('updateEntry'),
  )
}

/** Removing the last entry deletes the day doc (logged day ⇔ doc with entries). */
export function removeEntry(
  uid: string,
  day: WithId<NutritionDay>,
  entryId: string,
  goal: Macros,
): void {
  const entries = day.entries.filter((e) => e.id !== entryId)
  if (entries.length === 0) {
    deleteDoc(nutritionDayDoc(uid, day.id)).catch(logError('removeEntry'))
    return
  }
  setDoc(nutritionDayDoc(uid, day.id), dayWith(day.id, entries, goal)).catch(
    logError('removeEntry'),
  )
}

export function createFood(
  uid: string,
  data: Pick<Food, 'name' | 'kind' | 'unitLabel' | 'per'>,
): string {
  const ref = doc(foodsCol(uid))
  const food: WithId<Food> = {
    id: ref.id,
    ...data,
    lastAmount: null,
    useCount: 0,
    lastUsedAt: null,
    createdAt: Timestamp.now(),
  }
  setDoc(ref, food).catch(logError('createFood'))
  return ref.id
}

export function saveFood(uid: string, food: WithId<Food>): void {
  setDoc(foodDoc(uid, food.id), food).catch(logError('saveFood'))
}

/** Past entries keep their snapshot; only the library row goes. */
export function deleteFood(uid: string, id: string): void {
  deleteDoc(foodDoc(uid, id)).catch(logError('deleteFood'))
}
