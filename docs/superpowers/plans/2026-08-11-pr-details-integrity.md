# PR Details + Record Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist which records a session beat (type, value, previous mark), display them in the session detail screen, keep them correct across history edits/deletes, and make the live PR toast honest under set edits.

**Architecture:** New `prDetails` array on the workout doc, written on finish and re-attributed after history edits by extending the chronological stats replay (`rebuildStatsForExercise`) to emit per-workout record events. Recompute is orchestrated so each workout doc receives exactly one update (no per-exercise write races). UI: a records card in `WorkoutDetailScreen`; live toast tracked per set and re-evaluated on edits.

**Tech Stack:** React 19 + TypeScript, zod schemas in `src/domain/types.ts`, Firestore (typed converters in `src/data/converters.ts`), zustand, sonner toasts, vitest, i18next (Spanish locale files).

## Global Constraints

- App UI text is 100% Spanish via i18next (`src/locales/es/*.json`) — never hardcode text in components. Developer-facing text (comments, commits) in English.
- `src/domain/` is pure: no Firebase imports except the `Timestamp` type in `types.ts`; every domain module has a colocated test. Test descriptions are written in Spanish (existing convention).
- Warmups (`type: 'warmup'`) are excluded from ALL calculations; `isWorkingSet` is the only gate (already enforced by `setCandidates` — don't bypass it).
- Missing measurement fields in sets = `null`, never `undefined`.
- Both 1RM formulas (Epley and Brzycki) are stored so a settings change never corrupts history.
- `exerciseStats` are written in the same `writeBatch` as the workout on finish.
- Firestore writes follow the offline-safe pattern: not awaited, `.catch((err) => console.error('[tag]', err))`.
- Quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Commit after every task (Conventional Commits, English).

---

### Task 1: `prDetail` schema + `workout.prDetails` field

**Files:**
- Modify: `src/domain/types.ts` (after the `prTypes` declaration, ~line 199; and inside `workoutSchema` after `prCount`, ~line 177)
- Modify: `src/data/workoutMutations.ts:117` (`startWorkout` literal)
- Modify: `src/features/history/WorkoutEditorScreen.tsx:62` (workout literal)
- Modify: `src/domain/statsRebuild.test.ts:36-55` (`workout()` factory)
- Test: `src/domain/types.test.ts`

**Interfaces:**
- Produces: `prDetailSchema`, `type PrDetail = { exerciseId: string; exerciseName: string; type: PrType; value: number; previousValue: number | null }`, and `Workout.prDetails: PrDetail[] | null` (defaulted). All later tasks import `PrDetail` from `@/domain/types`.

- [ ] **Step 1: Write the failing test** — append to `src/domain/types.test.ts`:

```ts
describe('workoutSchema.prDetails', () => {
  it('los docs antiguos sin prDetails parsean con null', () => {
    const legacy = {
      status: 'completed',
      name: 'Sesión',
      routineId: null,
      startedAt: Timestamp.fromDate(new Date('2026-01-05T10:00:00')),
      completedAt: null,
      durationSeconds: null,
      dateKey: '2026-01-05',
      notes: null,
      bodyWeightKg: null,
      exerciseIds: [],
      exercises: [],
      totalVolumeKg: null,
      totalSets: null,
      prCount: 2,
      setsByMuscle: null,
    }
    expect(workoutSchema.parse(legacy).prDetails).toBeNull()
  })

  it('acepta y conserva un prDetails con entradas', () => {
    const detail = {
      exerciseId: 'press',
      exerciseName: 'Press banca',
      type: 'heaviestWeightKg',
      value: 100,
      previousValue: 95,
    }
    expect(prDetailSchema.parse(detail)).toEqual(detail)
    expect(prDetailSchema.parse({ ...detail, previousValue: null }).previousValue).toBeNull()
  })
})
```

Add the needed imports to the existing import lines (`workoutSchema`, `prDetailSchema`, `Timestamp` — check what the file already imports and extend).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/types.test.ts`
Expected: FAIL — `prDetailSchema` is not exported.

- [ ] **Step 3: Implement the schema** — in `src/domain/types.ts`, after the `prTypes`/`PrType` declarations:

```ts
/** One record beaten in a specific workout (denormalized onto the workout doc). */
export const prDetailSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: z.enum(prTypes),
  value: z.number(),
  /** Mark that was beaten; null = first record of this type for the exercise. */
  previousValue: z.number().nullable(),
})
export type PrDetail = z.infer<typeof prDetailSchema>
```

In `workoutSchema`, right after the `prCount` line:

```ts
  /** Which records this session set. null = written before the feature (see prCount). */
  prDetails: z.array(prDetailSchema).nullable().default(null),
```

- [ ] **Step 4: Fix the construction sites** (the output type now requires the field):
  - `startWorkout` in `src/data/workoutMutations.ts`: add `prDetails: null,` next to `prCount: null,`
  - `src/features/history/WorkoutEditorScreen.tsx` (~line 62): add `prDetails: null,` next to `prCount: null,`
  - `workout()` factory in `src/domain/statsRebuild.test.ts`: add `prDetails: null,`
  - Run `pnpm typecheck` and fix any remaining literal the compiler reports.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm typecheck && pnpm vitest run src/domain`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(domain): prDetail schema and workout.prDetails field"
```

---

### Task 2: `applySessionPrs` returns the detail rows

**Files:**
- Modify: `src/domain/prs.ts:96-120` (`SessionPrResult`, `applySessionPrs`)
- Test: `src/domain/prs.test.ts`

**Interfaces:**
- Consumes: `PrDetail` from Task 1.
- Produces: `SessionPrResult` gains `details: PrDetail[]` (empty array on baseline sessions). `applySessionPrs` signature unchanged otherwise.

- [ ] **Step 1: Write the failing test** — append to `src/domain/prs.test.ts` a new `describe` block. Reuse the file's existing set/exercise factories if present; otherwise use these local helpers (rename on collision):

```ts
describe('applySessionPrs · details', () => {
  const mkSet = (weightKg: number, reps: number): SetEntry => ({
    order: 0, type: 'normal', weightKg, reps,
    durationSeconds: null, distanceMeters: null, rpe: null, completed: true,
  })
  const mkExercise = (sets: SetEntry[]): WorkoutExercise => ({
    exerciseId: 'press', exerciseName: 'Press banca', muscle: 'chest',
    measurement: 'weight_reps', usesBodyweight: false, order: 0,
    slotIndex: null, swappedFrom: null, restSeconds: null, notes: null, sets,
  })

  it('incluye valor nuevo y marca anterior para cada récord', () => {
    const stats = {
      totalSessions: 3,
      prs: { heaviestWeightKg: { value: 95, workoutId: 'w0', dateKey: '2026-01-01' } },
    }
    const { details } = applySessionPrs(mkExercise([mkSet(100, 3)]), stats, 'w9', '2026-02-01')
    const heaviest = details.find((d) => d.type === 'heaviestWeightKg')
    expect(heaviest).toMatchObject({
      exerciseId: 'press', exerciseName: 'Press banca', value: 100, previousValue: 95,
    })
    // types never recorded before carry previousValue null
    const reps = details.find((d) => d.type === 'mostReps')
    expect(reps?.previousValue).toBeNull()
  })

  it('sesión base: sin récords y sin detalles', () => {
    const { newPrs, details } = applySessionPrs(mkExercise([mkSet(100, 3)]), null, 'w1', '2026-02-01')
    expect(newPrs).toEqual([])
    expect(details).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/prs.test.ts`
Expected: FAIL — `details` is undefined.

- [ ] **Step 3: Implement** — in `src/domain/prs.ts`, extend the interface and function:

```ts
export interface SessionPrResult {
  newPrs: PrType[]
  prs: ExerciseStats['prs']
  /** Rows for the workout doc's prDetails (empty on baseline sessions). */
  details: PrDetail[]
}

export function applySessionPrs(
  exercise: WorkoutExercise,
  stats: StatsForPrs,
  workoutId: string,
  dateKey: string,
  bodyWeightKg?: number | null,
): SessionPrResult {
  const bw = exercise.usesBodyweight ? (bodyWeightKg ?? null) : null
  const candidates = sessionCandidates(exercise.sets, bw)
  const baseline = statsBaseline(stats)
  const improved = detectNewPrs(candidates, baseline)
  const prs: ExerciseStats['prs'] = { ...(stats?.prs ?? {}) }
  for (const type of improved) {
    prs[type] = { value: candidates[type]!, workoutId, dateKey }
  }
  if (isBaselineSession(stats)) return { newPrs: [], prs, details: [] }
  const details: PrDetail[] = improved.map((type) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    type,
    value: candidates[type]!,
    previousValue: baseline[type] ?? null,
  }))
  return { newPrs: improved, prs, details }
}
```

Add `PrDetail` to the type imports from `./types`.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/domain/prs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(domain): applySessionPrs returns record detail rows"
```

---

### Task 3: `domain/prDetails.ts` — merge, count, display grouping

**Files:**
- Create: `src/domain/prDetails.ts`
- Test: `src/domain/prDetails.test.ts`

**Interfaces:**
- Consumes: `PrDetail`, `OneRmFormula`, `PrType` from types; `displayPrCount`, `prDisplayType`, `PrDisplayType` from `./prs`.
- Produces:
  - `mergePrDetails(current: PrDetail[], recomputedExerciseIds: ReadonlySet<string>, events: PrDetail[]): PrDetail[]`
  - `countPrDetails(details: PrDetail[]): number`
  - `prDisplayGroups(details: PrDetail[], formula: OneRmFormula): PrExerciseGroup[]` where `PrExerciseGroup = { exerciseId: string; exerciseName: string; rows: { display: PrDisplayType; value: number; previousValue: number | null }[] }`

- [ ] **Step 1: Write the failing test** — create `src/domain/prDetails.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { countPrDetails, mergePrDetails, prDisplayGroups } from './prDetails'
import type { PrDetail } from './types'

const d = (partial: Partial<PrDetail>): PrDetail => ({
  exerciseId: 'press',
  exerciseName: 'Press banca',
  type: 'heaviestWeightKg',
  value: 100,
  previousValue: 95,
  ...partial,
})

describe('mergePrDetails', () => {
  it('reemplaza solo las entradas de los ejercicios recalculados', () => {
    const current = [d({}), d({ exerciseId: 'curl', exerciseName: 'Curl' })]
    const merged = mergePrDetails(current, new Set(['press']), [d({ value: 105 })])
    expect(merged).toEqual([d({ exerciseId: 'curl', exerciseName: 'Curl' }), d({ value: 105 })])
  })

  it('un ejercicio recalculado sin eventos pierde sus entradas', () => {
    expect(mergePrDetails([d({})], new Set(['press']), [])).toEqual([])
  })
})

describe('countPrDetails', () => {
  it('el par de fórmulas 1RM cuenta una sola vez por ejercicio', () => {
    const details = [
      d({ type: 'best1RmEpley' }),
      d({ type: 'best1RmBrzycki' }),
      d({ type: 'mostReps' }),
      d({ exerciseId: 'curl', type: 'best1RmEpley' }),
    ]
    expect(countPrDetails(details)).toBe(3)
  })
})

describe('prDisplayGroups', () => {
  it('agrupa por ejercicio y colapsa el 1RM a la fórmula elegida', () => {
    const details = [
      d({ type: 'best1RmEpley', value: 110, previousValue: 100 }),
      d({ type: 'best1RmBrzycki', value: 112, previousValue: 102 }),
      d({ exerciseId: 'curl', exerciseName: 'Curl', type: 'mostReps', value: 12, previousValue: null }),
    ]
    const groups = prDisplayGroups(details, 'brzycki')
    expect(groups).toHaveLength(2)
    expect(groups[0].rows).toEqual([{ display: 'best1Rm', value: 112, previousValue: 102 }])
    expect(groups[1]).toMatchObject({ exerciseName: 'Curl', rows: [{ display: 'mostReps', value: 12, previousValue: null }] })
  })

  it('si solo mejoró la otra fórmula, se muestra esa', () => {
    const groups = prDisplayGroups([d({ type: 'best1RmBrzycki', value: 112 })], 'epley')
    expect(groups[0].rows[0]).toMatchObject({ display: 'best1Rm', value: 112 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/prDetails.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement** — create `src/domain/prDetails.ts`:

```ts
import { displayPrCount, prDisplayType, type PrDisplayType } from './prs'
import type { OneRmFormula, PrDetail, PrType } from './types'

/**
 * Replaces the recomputed exercises' entries with freshly attributed events.
 * Entries of exercises outside the recompute are preserved untouched.
 */
export function mergePrDetails(
  current: PrDetail[],
  recomputedExerciseIds: ReadonlySet<string>,
  events: PrDetail[],
): PrDetail[] {
  return [...current.filter((d) => !recomputedExerciseIds.has(d.exerciseId)), ...events]
}

/** prCount as stored on the workout: per exercise, the 1RM pair counts once. */
export function countPrDetails(details: PrDetail[]): number {
  const byExercise = new Map<string, PrType[]>()
  for (const d of details) {
    byExercise.set(d.exerciseId, [...(byExercise.get(d.exerciseId) ?? []), d.type])
  }
  let count = 0
  for (const types of byExercise.values()) count += displayPrCount(types)
  return count
}

export interface PrDisplayRow {
  display: PrDisplayType
  value: number
  previousValue: number | null
}

export interface PrExerciseGroup {
  exerciseId: string
  exerciseName: string
  rows: PrDisplayRow[]
}

/**
 * Groups details per exercise (insertion order) and collapses the 1RM pair to
 * the user's formula; if only the other formula improved, that one is shown.
 */
export function prDisplayGroups(details: PrDetail[], formula: OneRmFormula): PrExerciseGroup[] {
  const order: string[] = []
  const byExercise = new Map<string, PrDetail[]>()
  for (const d of details) {
    if (!byExercise.has(d.exerciseId)) {
      byExercise.set(d.exerciseId, [])
      order.push(d.exerciseId)
    }
    byExercise.get(d.exerciseId)!.push(d)
  }
  const preferred1Rm: PrType = formula === 'epley' ? 'best1RmEpley' : 'best1RmBrzycki'
  return order.map((exerciseId) => {
    const list = byExercise.get(exerciseId)!
    const displays = [...new Set(list.map((d) => prDisplayType(d.type)))]
    const rows = displays.map((display) => {
      const matching = list.filter((d) => prDisplayType(d.type) === display)
      const chosen = matching.find((d) => d.type === preferred1Rm) ?? matching[0]
      return { display, value: chosen.value, previousValue: chosen.previousValue }
    })
    return { exerciseId, exerciseName: list[0].exerciseName, rows }
  })
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/domain/prDetails.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(domain): prDetails merge/count/display helpers"
```

---

### Task 4: replay emits per-workout record events

**Files:**
- Modify: `src/domain/statsRebuild.ts`
- Test: `src/domain/statsRebuild.test.ts`

**Interfaces:**
- Consumes: `PrDetail` from types.
- Produces: `RebuiltExerciseStats` gains `prEventsByWorkout: Map<string, PrDetail[]>`. Callers that spread `RebuiltExerciseStats` into an `ExerciseStats` doc MUST destructure this field out first (Task 6 does).

- [ ] **Step 1: Write the failing test** — append to `src/domain/statsRebuild.test.ts` (reuse the file's `set`/`exercise`/`workout` factories):

```ts
describe('prEventsByWorkout', () => {
  it('la primera sesión no emite eventos; las siguientes sí, con la marca anterior', () => {
    const sessions = [
      workout('w1', '2026-01-05', [exercise('press', [set({ weightKg: 80, reps: 5 })])]),
      workout('w2', '2026-01-12', [exercise('press', [set({ weightKg: 100, reps: 3 })])]),
    ]
    const stats = rebuildStatsForExercise(sessions, 'press')!
    expect(stats.prEventsByWorkout.has('w1')).toBe(false)
    const w2 = stats.prEventsByWorkout.get('w2')!
    expect(w2.find((e) => e.type === 'heaviestWeightKg')).toMatchObject({
      exerciseId: 'press', value: 100, previousValue: 80,
    })
  })

  it('al quitar la sesión del récord, el evento migra a la sesión que ahora lo tiene', () => {
    const all = [
      workout('w1', '2026-01-05', [exercise('press', [set({ weightKg: 80, reps: 5 })])]),
      workout('w2', '2026-01-12', [exercise('press', [set({ weightKg: 100, reps: 3 })])]),
      workout('w3', '2026-01-19', [exercise('press', [set({ weightKg: 85, reps: 5 })])]),
    ]
    // with w2 present, w3 sets no weight record
    expect(
      rebuildStatsForExercise(all, 'press')!.prEventsByWorkout.get('w3')
        ?.some((e) => e.type === 'heaviestWeightKg') ?? false,
    ).toBe(false)
    // without w2, the 85 kg session becomes the record holder (beating 80)
    const without = rebuildStatsForExercise(all.filter((w) => w.id !== 'w2'), 'press')!
    expect(without.prEventsByWorkout.get('w3')!.find((e) => e.type === 'heaviestWeightKg'))
      .toMatchObject({ value: 85, previousValue: 80 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/statsRebuild.test.ts`
Expected: FAIL — `prEventsByWorkout` is undefined.

- [ ] **Step 3: Implement** — in `src/domain/statsRebuild.ts`:

```ts
import { detectNewPrs, sessionCandidates, statsBaseline } from './prs'
import type { ExerciseStats, PrDetail, WithId, Workout } from './types'

/** Result of rebuilding one exercise's stats from scratch (no id/updatedAt yet). */
export interface RebuiltExerciseStats {
  exerciseName: string
  lastPerformance: ExerciseStats['lastPerformance']
  prs: ExerciseStats['prs']
  totalSessions: number
  /** Record events attributed per workout; the baseline (first) session emits none. */
  prEventsByWorkout: Map<string, PrDetail[]>
}

export function rebuildStatsForExercise(
  sessions: WithId<Workout>[],
  exerciseId: string,
): RebuiltExerciseStats | null {
  let prs: ExerciseStats['prs'] = {}
  let exerciseName = ''
  let last: ExerciseStats['lastPerformance'] = null
  let totalSessions = 0
  const prEventsByWorkout = new Map<string, PrDetail[]>()

  for (const w of sessions) {
    const matches = w.exercises.filter((e) => e.exerciseId === exerciseId)
    if (matches.length === 0) continue
    totalSessions += 1
    const isBaseline = totalSessions === 1
    for (const ex of matches) {
      exerciseName = ex.exerciseName
      const bw = ex.usesBodyweight ? (w.bodyWeightKg ?? null) : null
      const candidates = sessionCandidates(ex.sets, bw)
      const baseline = statsBaseline({ prs })
      const newTypes = detectNewPrs(candidates, baseline)
      if (!isBaseline && newTypes.length > 0) {
        const events = prEventsByWorkout.get(w.id) ?? []
        for (const type of newTypes) {
          events.push({
            exerciseId,
            exerciseName: ex.exerciseName,
            type,
            value: candidates[type]!,
            previousValue: baseline[type] ?? null,
          })
        }
        prEventsByWorkout.set(w.id, events)
      }
      for (const type of newTypes) {
        prs = { ...prs, [type]: { value: candidates[type]!, workoutId: w.id, dateKey: w.dateKey } }
      }
      last = { workoutId: w.id, dateKey: w.dateKey, sets: ex.sets }
    }
  }

  if (totalSessions === 0) return null
  return { exerciseName, lastPerformance: last, prs, totalSessions, prEventsByWorkout }
}
```

(`rebuildAllStats` needs no change — it carries the new field through.)

- [ ] **Step 4: Run tests + typecheck** (typecheck catches any spread of `RebuiltExerciseStats` into stats docs — those are fixed in Task 6; if `pnpm typecheck` fails ONLY inside `src/data/workoutMutations.ts`, that is expected and resolved by Task 6. If so, do Task 6 before committing this one — otherwise commit now.)

Run: `pnpm vitest run src/domain && pnpm typecheck`

- [ ] **Step 5: Commit** (fold into Task 6's commit if typecheck required jumping ahead)

```bash
git add -A && git commit -m "feat(domain): stats replay emits per-workout record events"
```

---

### Task 5: `finishWorkout` writes `prDetails`

**Files:**
- Modify: `src/data/workoutMutations.ts:185-240` (`finishWorkout`)

**Interfaces:**
- Consumes: `SessionPrResult.details` (Task 2), `PrDetail` type.
- Produces: finished workout docs carry `prDetails: PrDetail[]` (possibly empty; never null for new finishes). `FinishResult` unchanged.

- [ ] **Step 1: Implement** — in `finishWorkout`, accumulate details:

```ts
  const batch = writeBatch(db)
  let prCount = 0
  const prDetails: PrDetail[] = []

  for (const ex of exercises) {
    const prev = statsMap.get(ex.exerciseId) ?? null
    const { newPrs, prs, details } = applySessionPrs(ex, prev, active.id, active.dateKey, bodyWeightKg)
    prCount += displayPrCount(newPrs)
    prDetails.push(...details)
    if (newPrs.length > 0) newPrsByExercise.set(ex.exerciseId, newPrs)
    // ... stats doc unchanged ...
  }

  const workout: WithId<Workout> = {
    ...active,
    status: 'completed',
    completedAt,
    durationSeconds: Math.max(0, completedAt.seconds - active.startedAt.seconds),
    exercises,
    exerciseIds: exercises.map((e) => e.exerciseId),
    ...totals,
    prCount,
    prDetails,
  }
```

Add `PrDetail` to the type imports from `@/domain/types`.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm vitest run src/domain`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(workout): persist record details on finish"
```

---

### Task 6: orchestrated recompute — one update per workout doc

**Files:**
- Modify: `src/data/workoutMutations.ts` (`recomputeExerciseStats`, `saveEditedWorkout`, `deleteCompletedWorkout`, `recomputeAllExerciseStats`)

**Interfaces:**
- Consumes: `rebuildStatsForExercise` with `prEventsByWorkout` (Task 4); `mergePrDetails`, `countPrDetails` (Task 3).
- Produces: `recomputeStatsAndPrs(uid: string, exerciseIds: string[], opts?: RecomputeOptions): Promise<void>` (exported). `recomputeExerciseStats(uid, exerciseId, opts)` stays as a thin wrapper (check callers with `grep -rn "recomputeExerciseStats" src` — keep them working).

- [ ] **Step 1: Extract the per-exercise session query** (same logic that lives inline in `recomputeExerciseStats` today):

```ts
/** Completed sessions containing the exercise, with exclude/override applied, ascending. */
async function queryExerciseSessions(
  uid: string,
  exerciseId: string,
  opts: RecomputeOptions,
): Promise<WithId<Workout>[]> {
  const snap = await getDocs(
    query(
      workoutsCol(uid),
      where('exerciseIds', 'array-contains', exerciseId),
      where('status', '==', 'completed'),
      orderBy('startedAt', 'asc'),
    ),
  )
  const override = opts.overrideWorkout
  const sessions = snap.docs
    .map((d) => d.data())
    .filter((w) => w.id !== opts.excludeWorkoutId && w.id !== override?.id)
  if (
    override?.status === 'completed' &&
    override.exercises.some((e) => e.exerciseId === exerciseId)
  ) {
    sessions.push(override)
    sessions.sort(
      (a, b) =>
        a.startedAt.seconds - b.startedAt.seconds ||
        a.startedAt.nanoseconds - b.startedAt.nanoseconds,
    )
  }
  return sessions
}
```

- [ ] **Step 2: Implement the orchestrator** (replaces the body of `recomputeExerciseStats`; keep the old doc comment, moved/adapted):

```ts
/**
 * Rebuilds several exercises' stats and re-attributes the records of every
 * workout involved (prDetails + prCount). Workout docs get exactly ONE update
 * each — parallel per-exercise recomputes would race on docs they share.
 * Legacy docs (prDetails null) are only rewritten when every one of their
 * exercises is being recomputed (otherwise a partial list would lie); the
 * full repair (recomputeAllExerciseStats) backfills the rest.
 */
export async function recomputeStatsAndPrs(
  uid: string,
  exerciseIds: string[],
  opts: RecomputeOptions = {},
): Promise<void> {
  const unique = [...new Set(exerciseIds)]
  const updatedAt = Timestamp.now()
  const workoutsById = new Map<string, WithId<Workout>>()
  const eventsByWorkout = new Map<string, PrDetail[]>()
  const recomputedPerWorkout = new Map<string, Set<string>>()

  await Promise.all(
    unique.map(async (exerciseId) => {
      const sessions = await queryExerciseSessions(uid, exerciseId, opts)
      for (const w of sessions) {
        workoutsById.set(w.id, w)
        const set = recomputedPerWorkout.get(w.id) ?? new Set<string>()
        set.add(exerciseId)
        recomputedPerWorkout.set(w.id, set)
      }
      const statsRef = exerciseStatsDoc(uid, exerciseId)
      const rebuilt = rebuildStatsForExercise(sessions, exerciseId)
      if (!rebuilt) {
        deleteDoc(statsRef).catch((err) => console.error('[recomputeStatsAndPrs]', err))
        return
      }
      for (const [workoutId, events] of rebuilt.prEventsByWorkout) {
        eventsByWorkout.set(workoutId, [...(eventsByWorkout.get(workoutId) ?? []), ...events])
      }
      const { prEventsByWorkout: _events, ...fields } = rebuilt
      const stats: WithId<ExerciseStats> = { id: exerciseId, exerciseId, ...fields, updatedAt }
      setDoc(statsRef, stats).catch((err) => console.error('[recomputeStatsAndPrs]', err))
    }),
  )

  // one update per touched workout doc
  const recomputedIds = new Set(unique)
  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = []
  for (const [workoutId, w] of workoutsById) {
    const knowsAll = w.exercises.every((e) => recomputedPerWorkout.get(workoutId)?.has(e.exerciseId))
    if (w.prDetails == null && !knowsAll) continue // legacy: don't write a partial lie
    const merged = mergePrDetails(w.prDetails ?? [], recomputedIds, eventsByWorkout.get(workoutId) ?? [])
    const prCount = countPrDetails(merged)
    if (w.prDetails != null && prCount === w.prCount && samePrDetails(w.prDetails, merged)) continue
    ops.push((batch) =>
      batch.update(doc(db, 'users', uid, 'workouts', workoutId), { prDetails: merged, prCount }),
    )
  }
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 400)) op(batch)
    batch.commit().catch((err) => console.error('[recomputeStatsAndPrs]', err))
  }
}

function samePrDetails(a: PrDetail[], b: PrDetail[]): boolean {
  if (a.length !== b.length) return false
  return a.every((d, i) => {
    const e = b[i]
    return (
      d.exerciseId === e.exerciseId && d.type === e.type &&
      d.value === e.value && d.previousValue === e.previousValue
    )
  })
}

/** Single-exercise recompute (kept for existing callers). */
export function recomputeExerciseStats(
  uid: string,
  exerciseId: string,
  opts: RecomputeOptions = {},
): Promise<void> {
  return recomputeStatsAndPrs(uid, [exerciseId], opts)
}
```

Add imports: `mergePrDetails`, `countPrDetails` from `@/domain/prDetails`; `PrDetail` type.

- [ ] **Step 3: Rewire callers** in the same file:
  - `saveEditedWorkout`: keep writing `prCount: null` AND add `prDetails: null` to the written doc (stale detail must not survive if the recompute fails), then replace the `Promise.all(...)` with `await recomputeStatsAndPrs(uid, affected, { overrideWorkout: workout })`. Update its doc comment: prCount/prDetails are now re-attributed by the recompute.
  - `deleteCompletedWorkout`: replace the `Promise.all(...)` with `await recomputeStatsAndPrs(uid, unique, { excludeWorkoutId: workout.id })`.

- [ ] **Step 4: Extend `recomputeAllExerciseStats`** (full repair backfill). After `rebuildAllStats`:

```ts
  const rebuilt = rebuildAllStats(workoutsSnap.docs.map((d) => d.data()))
  const updatedAt = Timestamp.now()

  const eventsByWorkout = new Map<string, PrDetail[]>()
  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = []
  for (const [exerciseId, stats] of rebuilt) {
    const { prEventsByWorkout, ...fields } = stats
    for (const [workoutId, events] of prEventsByWorkout) {
      eventsByWorkout.set(workoutId, [...(eventsByWorkout.get(workoutId) ?? []), ...events])
    }
    ops.push((batch) =>
      batch.set(exerciseStatsDoc(uid, exerciseId), { id: exerciseId, exerciseId, ...fields, updatedAt }),
    )
  }
  // backfill every completed workout with its attributed records
  for (const d of workoutsSnap.docs) {
    const w = d.data()
    const details = eventsByWorkout.get(w.id) ?? []
    ops.push((batch) =>
      batch.update(doc(db, 'users', uid, 'workouts', w.id), {
        prDetails: details,
        prCount: countPrDetails(details),
      }),
    )
  }
```

(keep the existing orphan-stats deletion loop and the chunked commit loop as they are).

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(history): re-attribute workout records on edit/delete/repair"
```

---

### Task 7: honest live PR toast

**Files:**
- Modify: `src/features/workout/ActiveWorkoutScreen.tsx`

**Interfaces:**
- Consumes: `detectLiveSetPrs`, `prDisplayType` (existing), sonner `toast.dismiss(id)`.

- [ ] **Step 1: Track toast ids per set.** Next to `finishedIdRef`:

```ts
  // live PR toasts per set, so a misclick's toast can be retracted on edit/uncheck
  const prToastIds = useRef(new Map<string, string | number>())
```

- [ ] **Step 2: Extract the detection+toast into a helper** inside the component (used by `completeSet` and the new re-evaluation):

```ts
  function dismissPrToast(key: string) {
    const id = prToastIds.current.get(key)
    if (id != null) {
      toast.dismiss(id)
      prToastIds.current.delete(key)
    }
  }

  /** Runs live PR detection for a completed set and shows/stores the toast. */
  function firePrToast(exIndex: number, setIndex: number, set: SetEntry, vibrate: boolean) {
    if (!workout) return
    const ex = workout.exercises[exIndex]
    const priorSets = workout.exercises
      .filter((e) => e.exerciseId === ex.exerciseId)
      .flatMap((e) => e.sets.filter((s) => s.completed && s !== set))
    const stats = statsMap?.get(ex.exerciseId)
    const bodyWeightKg = ex.usesBodyweight
      ? (workout.bodyWeightKg ?? profile?.settings.bodyWeightKg ?? null)
      : null
    const prs = detectLiveSetPrs(set, priorSets, stats, bodyWeightKg)
    if (prs.length > 0) {
      const labels = [...new Set(prs.map((p) => t(`workout:pr.types.${prDisplayType(p)}`)))]
      const id = toast.success(t('workout:pr.toast', { exercise: ex.exerciseName }), {
        description: labels.join(' · '),
      })
      prToastIds.current.set(`${exIndex}:${setIndex}`, id)
      if (vibrate) navigator.vibrate?.(100)
    } else if (vibrate && isBaselineSession(stats) && priorSets.length === 0) {
      toast.message(t('workout:pr.baseline', { exercise: ex.exerciseName }))
    }
  }
```

Note: `firePrToast` must read the exercise/set from the CURRENT `workout` render value in `completeSet` (pass the merged set), and from post-mutation store state in re-evaluation (Step 4). `completeSet` passes the `merged` set it just built; its `priorSets`/detection code moves into this helper — delete the now-duplicated block from `completeSet` and call `firePrToast(exIndex, setIndex, merged, true)` after `store.updateSet(...)`. CAREFUL: inside `firePrToast` when called from `completeSet`, `workout.exercises[exIndex].sets` still holds the pre-merge set object, so the `s !== set` identity filter works because `merged` is a new object — but the pre-merge set at `setIndex` IS in the array as a completed=false set, which `filter((s) => s.completed ...)` already excludes. No double counting.

- [ ] **Step 3: Dismiss on uncheck.** In `completeSet`, the early-return branch:

```ts
    if (set.completed) {
      store.updateSet(uid, exIndex, setIndex, { completed: false })
      dismissPrToast(`${exIndex}:${setIndex}`)
      return
    }
```

- [ ] **Step 4: Re-evaluate on value edits of completed sets.** Add:

```ts
  /** A completed set was edited: retract the stale toast and re-run detection. */
  function reevaluateSet(exIndex: number, setIndex: number, patch: Partial<SetEntry>) {
    const valueKeys = ['weightKg', 'reps', 'durationSeconds', 'distanceMeters'] as const
    if (!valueKeys.some((k) => k in patch)) return
    const current = useActiveWorkoutStore.getState().workout
    const set = current?.exercises[exIndex]?.sets[setIndex]
    if (!current || !set?.completed) return
    dismissPrToast(`${exIndex}:${setIndex}`)
    firePrToast(exIndex, setIndex, set, false)
  }
```

CAREFUL: `firePrToast` uses the component-scope `workout` (stale during this event tick). For correctness in `reevaluateSet`, change `firePrToast` to start with `const w = useActiveWorkoutStore.getState().workout ?? workout` and use `w` throughout — the store is updated synchronously by `mutate`, so post-mutation state is already visible.

Wire it in the JSX handlers:

```tsx
  onPatchSet={(setIndex, patch) => {
    store.updateSet(uid, i, setIndex, patch)
    reevaluateSet(i, setIndex, patch)
  }}
  onPatchWeight={(setIndex, weightKg) => {
    store.updateSetWeight(uid, i, setIndex, weightKg)
    reevaluateSet(i, setIndex, { weightKg })
  }}
```

- [ ] **Step 5: Verify manually + gate.** Run `pnpm typecheck && pnpm lint && pnpm build`. Then quick manual check with `pnpm dev` + emulators if running: check a set with an absurd weight → toast appears; lower the weight → toast disappears (and no new toast unless still a record); uncheck → toast disappears.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(workout): retract and re-evaluate live PR toasts on set edits"
```

---

### Task 8: records card in the session detail

**Files:**
- Create: `src/features/history/PrDetailsCard.tsx`
- Modify: `src/features/history/WorkoutDetailScreen.tsx` (banner block, lines 82-87; add `useUserProfile` import)
- Modify: `src/locales/es/history.json`

**Interfaces:**
- Consumes: `prDisplayGroups`, `countPrDetails` (Task 3), `PrDetail`, `OneRmFormula`, `formatKg`, existing i18n keys `workout:pr.types.*`, `workout:finishSheet.prs`.

- [ ] **Step 1: i18n key** — in `src/locales/es/history.json` add:

```json
  "pr": {
    "first": "primera marca"
  }
```

- [ ] **Step 2: Create `PrDetailsCard.tsx`:**

```tsx
import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { countPrDetails, prDisplayGroups, type PrDisplayRow } from '@/domain/prDetails'
import type { OneRmFormula, PrDetail } from '@/domain/types'
import { formatKg } from '@/lib/formatSet'

/** Breakdown of the session's records: per exercise, previous mark → new mark. */
export function PrDetailsCard({ details, formula }: { details: PrDetail[]; formula: OneRmFormula }) {
  const { t } = useTranslation(['workout', 'history', 'common'])
  const groups = prDisplayGroups(details, formula)

  return (
    <section className="rounded-card border border-status-warn/30 bg-status-warn/10 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-status-warn">
        <Trophy className="size-4" />
        {t('workout:finishSheet.prs', { count: countPrDetails(details) })}
      </h2>
      <div className="mt-2 flex flex-col gap-2.5">
        {groups.map((g) => (
          <div key={g.exerciseId}>
            <p className="text-sm font-medium">{g.exerciseName}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {g.rows.map((row) => (
                <li key={row.display} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-2">{t(`workout:pr.types.${row.display}`)}</span>
                  <Mark row={row} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Mark({ row }: { row: PrDisplayRow }) {
  const { t } = useTranslation(['history', 'common'])
  const unit = row.display === 'mostReps' ? 'reps' : t('common:units.kg')
  const fmt = (v: number) => (row.display === 'mostReps' ? String(v) : formatKg(v))

  return (
    <span className="tnum shrink-0">
      {row.previousValue != null ? (
        <span className="text-ink-3">{fmt(row.previousValue)} → </span>
      ) : (
        <span className="pr-1 text-xs text-ink-3">({t('history:pr.first')}) </span>
      )}
      <span className="font-semibold">
        {fmt(row.value)} {unit}
      </span>
    </span>
  )
}
```

- [ ] **Step 3: Wire into `WorkoutDetailScreen`.** Add `useUserProfile` to the `@/data/hooks` import and `const profile = useUserProfile()` in the component. Replace the banner block:

```tsx
      {workout.prDetails && workout.prDetails.length > 0 ? (
        <PrDetailsCard
          details={workout.prDetails}
          formula={profile?.settings.oneRmFormula ?? 'epley'}
        />
      ) : (
        (workout.prCount ?? 0) > 0 && (
          <p className="flex items-center gap-2 rounded-card bg-status-warn/10 px-3 py-2 text-sm font-medium text-status-warn">
            <Trophy className="size-4" />
            {t('workout:finishSheet.prs', { count: workout.prCount ?? 0 })}
          </p>
        )
      )}
```

- [ ] **Step 4: Full quality gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(history): session records card with previous marks"
```
