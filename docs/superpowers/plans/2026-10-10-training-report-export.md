# Training Report Export («Informe») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An «Informe» button on the Analytics tab that builds a Markdown dump of a date range of training (context, exercise glossary, every session with every set, weekly aggregates, 1RM progression) and lets the user download it as a file or copy it, to paste into an LLM.

**Architecture:** A pure domain function `buildReport` turns the already-loaded completed workouts into a structured `Report` model (filtering, glossary, sessions, weekly buckets, progression). A `lib` renderer turns the model into Markdown using the existing formatters and i18n keys. A two-step bottom sheet in the analytics feature wires data, options and the share/download/copy delivery.

**Tech Stack:** React 19 + TypeScript, i18next (es), date-fns, vitest, Tailwind v4 CSS-first semantic tokens, vaul `Sheet`, sonner toasts, Web Share API with `<a download>` fallback.

**Spec:** `docs/superpowers/specs/2026-10-10-training-report-export-design.md`

## Global Constraints

- App UI text is 100% Spanish via i18next (`src/locales/es/*.json`) — never hardcode text in components. Developer-facing text (comments, commits, docs) in English. Test descriptions in Spanish for domain tests (matches `src/domain/*.test.ts`); `src/lib` tests use English descriptions (matches `dates.test.ts`).
- `src/domain/` is pure: no Firebase imports, no date library; calendar helpers are injected (see `bucketedTotals` in `analytics.ts`). Every domain module has a colocated test.
- Warmups (`type: 'warmup'`) are excluded from ALL calculations — `isWorkingSet` is the only gate. They are still *listed* in the report, tagged.
- Missing measurement fields are `null`, never `undefined`.
- No new Firestore queries or indexes: the report uses the 500 workouts `AnalyticsScreen` already holds.
- Style: Tailwind v4 semantic tokens only (`bg-surface`, `bg-surface-2`, `border-hairline`, `text-ink`, `text-ink-2`, `text-ink-3`, `bg-accent`, `text-on-accent`, `rounded-card`, `rounded-chip`). No raw colors.
- Quality gate before every commit: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (node/pnpm live in `~/.local/share/pnpm/bin`; prefix `PATH` in the Bash shell).
- One commit per task. Commit trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

## Review Focus

1. Two sessions on the same day (a morning and an evening workout) must both appear, in start-time order — pinned in Task 1.
2. A workout whose `exercises[].order` or `sets[].order` has gaps or is unsorted must still list exercises and sets in `order`, not array order — pinned in Task 1.
3. A set with `rpe` set on a non-weight exercise (time-only) must still print its RPE; a `weight_time` set with only one of the two values prints a dash in the other slot — pinned in Task 4.
4. An exercise appearing twice in one session (the user added it again later) must count once in the glossary and merge into one progression point — pinned in Tasks 1 and 3.
5. The custom «Hasta» date later than today, or «Desde» after «Hasta», must disable «Generar» rather than produce an empty or inverted report — pinned by the input `min`/`max` attributes plus the `valid` guard in Task 6 (manual check).

## File Structure

| File | Responsibility |
| --- | --- |
| `src/domain/report.ts` (+ `report.test.ts`) | `buildReport`: range filter, glossary, sessions, weekly buckets, 1RM progression |
| `src/locales/es/report.json`, `src/i18n.ts` | UI copy + fixed report strings under `md.*`; namespace registration |
| `src/lib/reportMarkdown.ts` (+ `reportMarkdown.test.ts`) | `renderReportMarkdown(report)` → Markdown string |
| `src/lib/download.ts` | `copyText`, `deliverTextFile`, `reportFilename` |
| `src/features/analytics/ReportSheet.tsx` | Two-step sheet: options → result with Descargar / Copiar |
| `src/features/analytics/AnalyticsScreen.tsx` | «Informe» header button + sheet mount |

---

### Task 1: domain model — range filter, glossary, sessions

**Files:**
- Create: `src/domain/report.ts`
- Test: `src/domain/report.test.ts`

**Interfaces:**
- Consumes: `summarizeWorkout` (`./workoutSummary`), `prDisplayGroups` + `PrExerciseGroup` (`./prDetails`), types from `./types`.
- Produces: `buildReport(input: ReportInput): Report`, `reportSections`, `MIN_PROGRESSION_SESSIONS`, and the `Report*` types below. Tasks 2 and 3 add `weeks` and `progression` inside the same function; Task 4 renders `Report`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/report.test.ts
import { describe, expect, it } from 'vitest'
import { buildReport, type ReportInput, type ReportWorkout } from './report'
import type { ExerciseDef, SetEntry, WorkoutExercise } from './types'

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    order: 0,
    type: 'normal',
    weightKg: null,
    reps: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    completed: true,
    ...partial,
  }
}

function exercise(partial: Partial<WorkoutExercise> & { sets: SetEntry[] }): WorkoutExercise {
  return {
    exerciseId: 'bench',
    exerciseName: 'Press banca',
    muscle: 'chest',
    measurement: 'weight_reps',
    usesBodyweight: false,
    order: 0,
    slotIndex: null,
    swappedFrom: null,
    restSeconds: null,
    notes: null,
    ...partial,
  }
}

function workout(partial: Partial<ReportWorkout> & { dateKey: string }): ReportWorkout {
  return {
    name: 'Empuje',
    startedAt: { toMillis: () => 0 },
    durationSeconds: 3600,
    bodyWeightKg: 80,
    notes: null,
    exercises: [],
    prDetails: null,
    ...partial,
  }
}

const bench: ExerciseDef = {
  id: 'bench',
  name: 'Press banca con barra',
  muscle: 'chest',
  secondaryMuscles: ['triceps', 'shoulders'],
  equipment: 'barbell',
  movement: 'horizontal_press',
  measurement: 'weight_reps',
}

const defs = new Map<string, ExerciseDef>([[bench.id, bench]])

/** Mondays for a fixed September 2026 calendar (the 14th is a Monday). */
function mondayOf(dateKey: string): string {
  const day = Number(dateKey.slice(8))
  const monday = day - ((day - 14 + 700) % 7)
  return `2026-09-${String(monday).padStart(2, '0')}`
}
function sundayOf(weekStart: string): string {
  return `2026-09-${String(Number(weekStart.slice(8)) + 6).padStart(2, '0')}`
}

function input(partial: Partial<ReportInput>): ReportInput {
  return {
    workouts: [],
    fromKey: '2026-09-01',
    toKey: '2026-09-30',
    sections: ['sessions', 'weekly', 'progression'],
    formula: 'epley',
    bodyWeightKg: 82,
    resolveDef: (id) => defs.get(id),
    weekStartKeyOf: mondayOf,
    weekEndKeyOf: sundayOf,
    ...partial,
  }
}

describe('buildReport · rango', () => {
  it('incluye solo las sesiones dentro del rango (ambos extremos inclusive)', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({ dateKey: '2026-08-31' }),
          workout({ dateKey: '2026-09-01' }),
          workout({ dateKey: '2026-09-30' }),
          workout({ dateKey: '2026-10-01' }),
        ],
      }),
    )
    expect(r.range.sessions).toBe(2)
    expect(r.sessions?.map((s) => s.dateKey)).toEqual(['2026-09-01', '2026-09-30'])
  })

  it('ordena las sesiones ascendentemente por fecha y hora de inicio', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({ dateKey: '2026-09-15', startedAt: { toMillis: () => 20 }, name: 'tarde' }),
          workout({ dateKey: '2026-09-15', startedAt: { toMillis: () => 10 }, name: 'mañana' }),
          workout({ dateKey: '2026-09-14', name: 'ayer' }),
        ],
      }),
    )
    expect(r.sessions?.map((s) => s.name)).toEqual(['ayer', 'mañana', 'tarde'])
  })

  it('cuenta los días del rango de forma inclusiva', () => {
    const r = buildReport(input({ fromKey: '2026-09-12', toKey: '2026-10-10' }))
    expect(r.range.days).toBe(29)
    expect(buildReport(input({ fromKey: '2026-09-12', toKey: '2026-09-12' })).range.days).toBe(1)
  })

  it('devuelve null en las secciones no pedidas', () => {
    const r = buildReport(input({ sections: [] }))
    expect(r.sessions).toBeNull()
    expect(r.weeks).toBeNull()
    expect(r.progression).toBeNull()
  })

  it('copia el peso corporal y la fórmula de los ajustes', () => {
    const r = buildReport(input({ bodyWeightKg: 82, formula: 'brzycki' }))
    expect(r.bodyWeightKg).toBe(82)
    expect(r.formula).toBe('brzycki')
  })
})

describe('buildReport · glosario', () => {
  it('lista cada ejercicio una vez, ordenado por nombre, con sus datos del catálogo', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ sets: [set({ weightKg: 80, reps: 5 })] }),
              exercise({ order: 1, sets: [set({ weightKg: 80, reps: 5 })] }),
            ],
          }),
          workout({
            dateKey: '2026-09-16',
            exercises: [exercise({ sets: [set({ weightKg: 80, reps: 5 })] })],
          }),
        ],
      }),
    )
    expect(r.exercises).toEqual([
      {
        exerciseId: 'bench',
        name: 'Press banca con barra',
        muscle: 'chest',
        secondaryMuscles: ['triceps', 'shoulders'],
        equipment: 'barbell',
        measurement: 'weight_reps',
        custom: false,
      },
    ])
  })

  it('marca los ejercicios personalizados y usa [] si no tienen secundarios', () => {
    const custom: ExerciseDef = { ...bench, id: 'mine', name: 'Mi curl', custom: true }
    custom.secondaryMuscles = undefined
    const r = buildReport(
      input({
        resolveDef: (id) => (id === 'mine' ? custom : undefined),
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [exercise({ exerciseId: 'mine', exerciseName: 'Mi curl', sets: [] })],
          }),
        ],
      }),
    )
    expect(r.exercises[0]).toMatchObject({ name: 'Mi curl', custom: true, secondaryMuscles: [] })
  })

  it('sin definición, usa la copia del entrenamiento y marca los secundarios como desconocidos', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ exerciseId: 'gone', exerciseName: 'Curl raro', muscle: 'biceps', sets: [] }),
            ],
          }),
        ],
      }),
    )
    expect(r.exercises[0]).toEqual({
      exerciseId: 'gone',
      name: 'Curl raro',
      muscle: 'biceps',
      secondaryMuscles: null,
      equipment: null,
      measurement: 'weight_reps',
      custom: false,
    })
  })

  it('ordena por nombre con localeCompare', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ exerciseId: 'z', exerciseName: 'Zancadas', sets: [] }),
              exercise({ exerciseId: 'a', exerciseName: 'Ábdominales', order: 1, sets: [] }),
            ],
          }),
        ],
      }),
    )
    expect(r.exercises.map((e) => e.name)).toEqual(['Ábdominales', 'Zancadas'])
  })
})

describe('buildReport · sesiones', () => {
  it('lista todas las series (calentamientos incluidos) pero solo cuenta las efectivas', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                restSeconds: 120,
                notes: 'hombro molesto',
                sets: [
                  set({ order: 0, type: 'warmup', weightKg: 40, reps: 10 }),
                  set({ order: 1, weightKg: 80, reps: 6, rpe: 8 }),
                  set({ order: 2, type: 'failure', weightKg: 80, reps: 5 }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    const s = r.sessions![0]
    expect(s.workingSets).toBe(2)
    expect(s.volumeKg).toBe(80 * 6 + 80 * 5)
    expect(s.exercises[0]).toMatchObject({
      name: 'Press banca con barra',
      restSeconds: 120,
      notes: 'hombro molesto',
    })
    expect(s.exercises[0].sets).toEqual([
      { position: 1, type: 'warmup', weightKg: 40, reps: 10, durationSeconds: null, distanceMeters: null, rpe: null },
      { position: 2, type: 'normal', weightKg: 80, reps: 6, durationSeconds: null, distanceMeters: null, rpe: 8 },
      { position: 3, type: 'failure', weightKg: 80, reps: 5, durationSeconds: null, distanceMeters: null, rpe: null },
    ])
  })

  it('ordena ejercicios y series por `order`, no por posición en el array', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                exerciseId: 'b',
                exerciseName: 'B',
                order: 5,
                sets: [set({ order: 3, reps: 3 }), set({ order: 1, reps: 1 })],
              }),
              exercise({ exerciseId: 'a', exerciseName: 'A', order: 2, sets: [] }),
            ],
          }),
        ],
      }),
    )
    const s = r.sessions![0]
    expect(s.exercises.map((e) => e.name)).toEqual(['A', 'B'])
    expect(s.exercises[1].sets.map((x) => x.reps)).toEqual([1, 3])
    expect(s.exercises[1].sets.map((x) => x.position)).toEqual([1, 2])
  })

  it('usa el peso corporal de la sesión para el volumen de ejercicios a peso corporal', () => {
    const r = buildReport(
      input({
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            bodyWeightKg: 80,
            exercises: [
              exercise({
                exerciseId: 'dips',
                exerciseName: 'Fondos',
                measurement: 'reps_only',
                usesBodyweight: true,
                sets: [set({ weightKg: 10, reps: 10 })],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.sessions![0].volumeKg).toBe(900)
  })

  it('agrupa los récords de la sesión por ejercicio con la fórmula del usuario', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            prDetails: [
              { exerciseId: 'bench', exerciseName: 'Press banca', type: 'best1RmEpley', value: 96, previousValue: 94 },
              { exerciseId: 'bench', exerciseName: 'Press banca', type: 'best1RmBrzycki', value: 95, previousValue: 93 },
              { exerciseId: 'bench', exerciseName: 'Press banca', type: 'heaviestWeightKg', value: 82.5, previousValue: null },
            ],
          }),
        ],
      }),
    )
    expect(r.sessions![0].prs).toEqual([
      {
        exerciseId: 'bench',
        exerciseName: 'Press banca',
        rows: [
          { display: 'best1Rm', value: 96, previousValue: 94 },
          { display: 'heaviestWeight', value: 82.5, previousValue: null },
        ],
      },
    ])
  })

  it('sin prDetails (docs antiguos) devuelve una lista vacía', () => {
    const r = buildReport(input({ workouts: [workout({ dateKey: '2026-09-14', prDetails: null })] }))
    expect(r.sessions![0].prs).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/domain/report.test.ts`
Expected: FAIL — `Cannot find module './report'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/report.ts
import type { BalanceGroup, RepRange } from './analytics'
import { prDisplayGroups, type PrExerciseGroup } from './prDetails'
import { summarizeWorkout } from './workoutSummary'
import type {
  Equipment,
  ExerciseDef,
  Measurement,
  MuscleGroup,
  OneRmFormula,
  SetType,
  Workout,
  WorkoutExercise,
} from './types'

/* --------------------------------- Options -------------------------------- */

export type ReportSection = 'sessions' | 'weekly' | 'progression'
export const reportSections: readonly ReportSection[] = ['sessions', 'weekly', 'progression']

/** An exercise needs this many sessions in the range to get a progression block. */
export const MIN_PROGRESSION_SESSIONS = 5

/** What the report reads from a workout. `startedAt` is structural so tests need no Timestamp. */
export type ReportWorkout = Pick<
  Workout,
  'dateKey' | 'name' | 'durationSeconds' | 'bodyWeightKg' | 'notes' | 'exercises' | 'prDetails'
> & { startedAt: { toMillis(): number } }

export interface ReportInput {
  /** Any order; only those with dateKey inside [fromKey, toKey] are used. */
  workouts: ReportWorkout[]
  fromKey: string
  toKey: string
  sections: readonly ReportSection[]
  formula: OneRmFormula
  /** Current body weight from settings (each session carries its own snapshot). */
  bodyWeightKg: number | null
  resolveDef: (exerciseId: string) => ExerciseDef | undefined
  /** Injected calendar helpers: this module stays date-lib-free (see analytics.ts). */
  weekStartKeyOf: (dateKey: string) => string
  weekEndKeyOf: (weekStartKey: string) => string
  minProgressionSessions?: number
}

/* ---------------------------------- Model --------------------------------- */

export interface ReportExercise {
  exerciseId: string
  name: string
  muscle: MuscleGroup
  /** null = definition not found (deleted custom exercise). */
  secondaryMuscles: MuscleGroup[] | null
  equipment: Equipment | null
  measurement: Measurement
  custom: boolean
}

export interface ReportSet {
  /** 1-based within the exercise, warmups included. */
  position: number
  type: SetType
  weightKg: number | null
  reps: number | null
  durationSeconds: number | null
  distanceMeters: number | null
  rpe: number | null
}

export interface ReportSessionExercise {
  exerciseId: string
  name: string
  measurement: Measurement
  usesBodyweight: boolean
  restSeconds: number | null
  notes: string | null
  sets: ReportSet[]
}

export interface ReportSession {
  dateKey: string
  name: string
  durationSeconds: number | null
  bodyWeightKg: number | null
  notes: string | null
  exercises: ReportSessionExercise[]
  prs: PrExerciseGroup[]
  workingSets: number
  volumeKg: number
}

export interface ReportWeek {
  weekStartKey: string
  weekEndKey: string
  sessions: number
  workingSets: number
  volumeKg: number
  /** Only muscles with sets, total descending. */
  muscles: { muscle: MuscleGroup; direct: number; indirect: number }[]
  balance: Record<BalanceGroup, number>
  repRanges: Record<RepRange, number>
}

export interface ReportProgressionPoint {
  dateKey: string
  oneRm: number
  weightKg: number
  reps: number
}

export interface ReportProgression {
  exerciseId: string
  name: string
  points: ReportProgressionPoint[]
}

export interface Report {
  range: { fromKey: string; toKey: string; days: number; sessions: number }
  bodyWeightKg: number | null
  formula: OneRmFormula
  /** Every exercise in the range, once, by name. Always present. */
  exercises: ReportExercise[]
  /** null = section not requested. */
  sessions: ReportSession[] | null
  weeks: ReportWeek[] | null
  progression: ReportProgression[] | null
}

/* ---------------------------------- Build --------------------------------- */

export function buildReport(input: ReportInput): Report {
  const { fromKey, toKey } = input
  const inRange = input.workouts
    .filter((w) => w.dateKey >= fromKey && w.dateKey <= toKey)
    .sort(
      (a, b) =>
        a.dateKey.localeCompare(b.dateKey) || a.startedAt.toMillis() - b.startedAt.toMillis(),
    )
  const wanted = new Set(input.sections)
  // The catalog name wins over the workout copy so glossary and sessions agree
  // even after a custom exercise was renamed.
  const nameOf = (ex: Pick<WorkoutExercise, 'exerciseId' | 'exerciseName'>) =>
    input.resolveDef(ex.exerciseId)?.name ?? ex.exerciseName

  return {
    range: { fromKey, toKey, days: inclusiveDays(fromKey, toKey), sessions: inRange.length },
    bodyWeightKg: input.bodyWeightKg,
    formula: input.formula,
    exercises: glossary(inRange, input.resolveDef),
    sessions: wanted.has('sessions') ? inRange.map((w) => toSession(w, input.formula, nameOf)) : null,
    weeks: null,
    progression: null,
  }
}

/** Inclusive day count between two 'YYYY-MM-DD' keys (UTC arithmetic, no date library). */
function inclusiveDays(fromKey: string, toKey: string): number {
  return Math.round((utcMidnight(toKey) - utcMidnight(fromKey)) / 86_400_000) + 1
}

function utcMidnight(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function glossary(
  workouts: ReportWorkout[],
  resolveDef: ReportInput['resolveDef'],
): ReportExercise[] {
  const seen = new Map<string, ReportExercise>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (seen.has(ex.exerciseId)) continue
      const def = resolveDef(ex.exerciseId)
      seen.set(
        ex.exerciseId,
        def
          ? {
              exerciseId: ex.exerciseId,
              name: def.name,
              muscle: def.muscle,
              secondaryMuscles: def.secondaryMuscles ?? [],
              equipment: def.equipment,
              measurement: def.measurement,
              custom: def.custom === true,
            }
          : {
              exerciseId: ex.exerciseId,
              name: ex.exerciseName,
              muscle: ex.muscle,
              secondaryMuscles: null,
              equipment: null,
              measurement: ex.measurement,
              custom: false,
            },
      )
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function toSession(
  w: ReportWorkout,
  formula: OneRmFormula,
  nameOf: (ex: WorkoutExercise) => string,
): ReportSession {
  const totals = summarizeWorkout(w)
  return {
    dateKey: w.dateKey,
    name: w.name,
    durationSeconds: w.durationSeconds,
    bodyWeightKg: w.bodyWeightKg,
    notes: w.notes,
    exercises: [...w.exercises]
      .sort((a, b) => a.order - b.order)
      .map((ex) => ({
        exerciseId: ex.exerciseId,
        name: nameOf(ex),
        measurement: ex.measurement,
        usesBodyweight: ex.usesBodyweight,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        sets: [...ex.sets]
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({
            position: i + 1,
            type: s.type,
            weightKg: s.weightKg,
            reps: s.reps,
            durationSeconds: s.durationSeconds,
            distanceMeters: s.distanceMeters,
            rpe: s.rpe,
          })),
      })),
    prs: prDisplayGroups(w.prDetails ?? [], formula),
    workingSets: totals.totalSets,
    volumeKg: totals.totalVolumeKg,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/domain/report.test.ts`
Expected: PASS (all `rango`, `glosario`, `sesiones` tests).

- [ ] **Step 5: Quality gate and commit**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/domain/report.ts src/domain/report.test.ts
git commit -m "feat(report): domain model with range filter, glossary and sessions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: domain model — weekly buckets

**Files:**
- Modify: `src/domain/report.ts` (replace `weeks: null`)
- Test: `src/domain/report.test.ts` (append)

**Interfaces:**
- Consumes: `muscleSetBreakdown`, `muscleBalance`, `repRangeDistribution` from `./analytics`; `summarizeWorkout`.
- Produces: `Report.weeks: ReportWeek[]` when `'weekly'` is requested.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/report.test.ts`:

```ts
describe('buildReport · resumen semanal', () => {
  it('agrupa por semana (lunes inyectado), ascendente, solo semanas con sesiones', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({ dateKey: '2026-09-22', exercises: [exercise({ sets: [set({ weightKg: 100, reps: 5 })] })] }),
          workout({ dateKey: '2026-09-14', exercises: [exercise({ sets: [set({ weightKg: 80, reps: 5 })] })] }),
          workout({ dateKey: '2026-09-16', exercises: [exercise({ sets: [set({ weightKg: 80, reps: 5 }), set({ order: 1, weightKg: 80, reps: 5 })] })] }),
        ],
      }),
    )
    expect(r.weeks?.map((w) => [w.weekStartKey, w.weekEndKey, w.sessions, w.workingSets, w.volumeKg])).toEqual([
      ['2026-09-14', '2026-09-20', 2, 3, 1200],
      ['2026-09-21', '2026-09-27', 1, 1, 500],
    ])
  })

  it('desglosa series directas e indirectas (×0,5) por músculo, total descendente', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ sets: [set({ weightKg: 80, reps: 5 }), set({ order: 1, weightKg: 80, reps: 5 })] }),
            ],
          }),
        ],
      }),
    )
    expect(r.weeks![0].muscles).toEqual([
      { muscle: 'chest', direct: 2, indirect: 0 },
      { muscle: 'shoulders', direct: 0, indirect: 1 },
      { muscle: 'triceps', direct: 0, indirect: 1 },
    ])
  })

  it('calcula equilibrio y rangos de repeticiones sin contar calentamientos', () => {
    const r = buildReport(
      input({
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                sets: [
                  set({ type: 'warmup', weightKg: 40, reps: 10 }),
                  set({ order: 1, weightKg: 100, reps: 3 }),
                  set({ order: 2, weightKg: 80, reps: 8 }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.weeks![0].balance).toEqual({ push: 2, pull: 0, legs: 0, core: 0 })
    expect(r.weeks![0].repRanges).toEqual({ strength: 1, hypertrophy: 1, endurance: 0 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/domain/report.test.ts -t "resumen semanal"`
Expected: FAIL — `r.weeks` is `null`.

- [ ] **Step 3: Implement**

In `src/domain/report.ts`, change the import of `./analytics` to:

```ts
import {
  muscleBalance,
  muscleSetBreakdown,
  repRangeDistribution,
  type BalanceGroup,
  type RepRange,
} from './analytics'
```

Replace `weeks: null,` in `buildReport` with:

```ts
    weeks: wanted.has('weekly') ? weeklySummary(inRange, input) : null,
```

Append:

```ts
function weeklySummary(workouts: ReportWorkout[], input: ReportInput): ReportWeek[] {
  const byWeek = new Map<string, ReportWorkout[]>()
  for (const w of workouts) {
    const key = input.weekStartKeyOf(w.dateKey)
    byWeek.set(key, [...(byWeek.get(key) ?? []), w])
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStartKey, list]) => {
      const totals = list.map((w) => summarizeWorkout(w))
      const breakdown = muscleSetBreakdown(
        list,
        (id) => input.resolveDef(id)?.secondaryMuscles ?? [],
      )
      const muscles = [...breakdown.entries()]
        .map(([muscle, b]) => ({ muscle, direct: b.direct, indirect: b.indirect }))
        .filter((m) => m.direct + m.indirect > 0)
        .sort(
          (a, b) =>
            b.direct + b.indirect - (a.direct + a.indirect) || a.muscle.localeCompare(b.muscle),
        )
      return {
        weekStartKey,
        weekEndKey: input.weekEndKeyOf(weekStartKey),
        sessions: list.length,
        workingSets: totals.reduce((sum, t) => sum + t.totalSets, 0),
        volumeKg: totals.reduce((sum, t) => sum + t.totalVolumeKg, 0),
        muscles,
        balance: muscleBalance(totals.map((t) => ({ setsByMuscle: t.setsByMuscle }))),
        repRanges: repRangeDistribution(list),
      }
    })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/domain/report.test.ts`
Expected: PASS.

- [ ] **Step 5: Quality gate and commit**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/domain/report.ts src/domain/report.test.ts
git commit -m "feat(report): weekly buckets with muscle breakdown, balance and rep ranges

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: domain model — 1RM progression

**Files:**
- Modify: `src/domain/report.ts` (replace `progression: null`)
- Test: `src/domain/report.test.ts` (append)

**Interfaces:**
- Consumes: `estimateSet1Rm` from `./oneRepMax`.
- Produces: `Report.progression: ReportProgression[]` when `'progression'` is requested.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/report.test.ts`:

```ts
describe('buildReport · progresión 1RM', () => {
  function benchDay(dateKey: string, weightKg: number, reps: number) {
    return workout({
      dateKey,
      exercises: [exercise({ sets: [set({ weightKg, reps })] })],
    })
  }

  it('excluye ejercicios con menos sesiones que el mínimo', () => {
    const four = ['14', '15', '16', '17'].map((d) => benchDay(`2026-09-${d}`, 80, 5))
    expect(buildReport(input({ workouts: four })).progression).toEqual([])
    const five = [...four, benchDay('2026-09-18', 80, 5)]
    expect(buildReport(input({ workouts: five })).progression).toHaveLength(1)
  })

  it('respeta minProgressionSessions', () => {
    const two = ['14', '15'].map((d) => benchDay(`2026-09-${d}`, 80, 5))
    expect(buildReport(input({ workouts: two, minProgressionSessions: 2 })).progression).toHaveLength(1)
  })

  it('un punto por sesión: el mejor 1RM y la serie que lo produce, fechas ascendentes', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        workouts: [
          workout({
            dateKey: '2026-09-16',
            exercises: [
              exercise({
                sets: [
                  set({ type: 'warmup', weightKg: 100, reps: 10 }),
                  set({ order: 1, weightKg: 80, reps: 6 }),
                  set({ order: 2, weightKg: 85, reps: 3 }),
                ],
              }),
            ],
          }),
          benchDay('2026-09-14', 80, 5),
        ],
      }),
    )
    expect(r.progression).toEqual([
      {
        exerciseId: 'bench',
        name: 'Press banca con barra',
        points: [
          { dateKey: '2026-09-14', oneRm: 80 * (1 + 5 / 30), weightKg: 80, reps: 5 },
          { dateKey: '2026-09-16', oneRm: 80 * (1 + 6 / 30), weightKg: 80, reps: 6 },
        ],
      },
    ])
  })

  it('fusiona dos apariciones del mismo ejercicio en una sesión', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ sets: [set({ weightKg: 80, reps: 5 })] }),
              exercise({ order: 1, sets: [set({ weightKg: 90, reps: 5 })] }),
            ],
          }),
        ],
      }),
    )
    expect(r.progression![0].points).toEqual([
      { dateKey: '2026-09-14', oneRm: 90 * (1 + 5 / 30), weightKg: 90, reps: 5 },
    ])
  })

  it('ignora ejercicios que no son de peso y repeticiones (peso corporal incluido)', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({
                exerciseId: 'dips',
                exerciseName: 'Fondos',
                measurement: 'reps_only',
                usesBodyweight: true,
                sets: [set({ weightKg: 10, reps: 10 })],
              }),
              exercise({
                exerciseId: 'plank',
                exerciseName: 'Plancha',
                measurement: 'time_only',
                order: 1,
                sets: [set({ durationSeconds: 60 })],
              }),
            ],
          }),
        ],
      }),
    )
    expect(r.progression).toEqual([])
  })

  it('usa la fórmula pedida', () => {
    const r = buildReport(
      input({ formula: 'brzycki', minProgressionSessions: 1, workouts: [benchDay('2026-09-14', 80, 5)] }),
    )
    expect(r.progression![0].points[0].oneRm).toBeCloseTo((80 * 36) / (37 - 5))
  })

  it('ordena los ejercicios por nombre', () => {
    const r = buildReport(
      input({
        minProgressionSessions: 1,
        resolveDef: () => undefined,
        workouts: [
          workout({
            dateKey: '2026-09-14',
            exercises: [
              exercise({ exerciseId: 's', exerciseName: 'Sentadilla', sets: [set({ weightKg: 100, reps: 5 })] }),
              exercise({ exerciseId: 'c', exerciseName: 'Curl', order: 1, sets: [set({ weightKg: 20, reps: 10 })] }),
            ],
          }),
        ],
      }),
    )
    expect(r.progression!.map((p) => p.name)).toEqual(['Curl', 'Sentadilla'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/domain/report.test.ts -t "progresión"`
Expected: FAIL — `progression` is `null`.

- [ ] **Step 3: Implement**

Add the import in `src/domain/report.ts`:

```ts
import { estimateSet1Rm } from './oneRepMax'
```

Replace `progression: null,` in `buildReport` with:

```ts
    progression: wanted.has('progression')
      ? progression(
          inRange,
          input.formula,
          input.minProgressionSessions ?? MIN_PROGRESSION_SESSIONS,
          nameOf,
        )
      : null,
```

Append:

```ts
/**
 * One point per session for weight-and-reps exercises only: on bodyweight
 * exercises the stored weight is ballast, not the lift, so a 1RM is meaningless.
 */
function progression(
  workouts: ReportWorkout[],
  formula: OneRmFormula,
  minSessions: number,
  nameOf: (ex: WorkoutExercise) => string,
): ReportProgression[] {
  const byExercise = new Map<string, ReportProgression>()
  for (const w of workouts) {
    const bestInSession = new Map<string, ReportProgressionPoint>()
    for (const ex of w.exercises) {
      if (ex.measurement !== 'weight_reps') continue
      for (const s of ex.sets) {
        const oneRm = estimateSet1Rm(s, formula)
        if (oneRm == null) continue
        const current = bestInSession.get(ex.exerciseId)
        if (current == null || oneRm > current.oneRm) {
          // estimateSet1Rm returns a value only when both fields are present
          bestInSession.set(ex.exerciseId, {
            dateKey: w.dateKey,
            oneRm,
            weightKg: s.weightKg!,
            reps: s.reps!,
          })
        }
      }
      if (bestInSession.has(ex.exerciseId) && !byExercise.has(ex.exerciseId)) {
        byExercise.set(ex.exerciseId, { exerciseId: ex.exerciseId, name: nameOf(ex), points: [] })
      }
    }
    for (const [id, point] of bestInSession) byExercise.get(id)!.points.push(point)
  }
  return [...byExercise.values()]
    .filter((p) => p.points.length >= minSessions)
    .sort((a, b) => a.name.localeCompare(b.name))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/domain/report.test.ts`
Expected: PASS.

- [ ] **Step 5: Quality gate and commit**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/domain/report.ts src/domain/report.test.ts
git commit -m "feat(report): per-session 1RM progression for frequent exercises

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: i18n namespace + Markdown renderer

**Files:**
- Create: `src/locales/es/report.json`
- Modify: `src/i18n.ts` (import + register `report`)
- Create: `src/lib/reportMarkdown.ts`
- Test: `src/lib/reportMarkdown.test.ts`

**Interfaces:**
- Consumes: `Report` and sub-types from `@/domain/report`; `formatKg`, `formatSet` from `./formatSet`; `formatDuration` from `./dates`; `i18n` from `@/i18n`.
- Produces: `renderReportMarkdown(report: Report): string` (ends with a single `\n`).

- [ ] **Step 1: Create the locale file and register it**

```json
// src/locales/es/report.json
{
  "open": "Informe",
  "title": "Informe de entrenamiento",
  "range": {
    "title": "Rango",
    "4w": "4 semanas",
    "8w": "8 semanas",
    "3m": "3 meses",
    "custom": "Personalizado",
    "from": "Desde",
    "to": "Hasta",
    "invalid": "La fecha de inicio debe ser anterior a la de fin."
  },
  "sections": {
    "title": "Secciones",
    "sessions": "Sesiones",
    "weekly": "Resumen semanal",
    "progression": "Progresión 1RM"
  },
  "sessionsInRange_one": "{{count}} sesión en el rango",
  "sessionsInRange_other": "{{count}} sesiones en el rango",
  "generate": "Generar",
  "back": "Cambiar opciones",
  "size": "{{sessions}} sesiones · {{lines}} líneas · {{kb}} KB",
  "download": "Descargar",
  "copy": "Copiar",
  "copied": "Informe copiado",
  "copyFailed": "No se ha podido copiar",
  "downloaded": "Informe descargado",
  "downloadFailed": "No se ha podido descargar el informe",
  "md": {
    "title": "Informe de entrenamiento",
    "context": {
      "title": "Contexto",
      "range": "Rango: {{from}} → {{to}} ({{days}}, {{sessions}})",
      "days_one": "{{count}} día",
      "days_other": "{{count}} días",
      "sessions_one": "{{count}} sesión",
      "sessions_other": "{{count}} sesiones",
      "bodyWeight": "Peso corporal actual: {{kg}} kg (cada sesión indica el suyo)",
      "bodyWeightUnknown": "Peso corporal actual: no registrado",
      "formula": "Fórmula 1RM: {{formula}}",
      "units": "Unidades: kg · repeticiones · tiempo mm:ss · distancia km",
      "tags": "Etiquetas de serie: [C] calentamiento (excluida de todos los totales) · [D] serie descendente · [F] al fallo · @8 = RPE 8",
      "bodyweightNote": "En ejercicios a peso corporal, el peso de la serie es lastre añadido al peso corporal."
    },
    "exercises": {
      "title": "Ejercicios",
      "custom": "personalizado",
      "secondary": "secundarios",
      "none": "ninguno",
      "unknown": "desconocidos"
    },
    "sessions": {
      "title": "Sesiones",
      "bodyWeight": "peso corporal {{kg}} kg",
      "notes": "Notas",
      "note": "Nota",
      "rest": "descanso {{seconds}} s",
      "prs": "Récords",
      "prPrevious": "antes {{value}}",
      "prFirst": "primera marca",
      "total": "Total: {{sets}} series efectivas · {{kg}} kg"
    },
    "weekly": {
      "title": "Resumen semanal",
      "week": "Semana {{from}} → {{to}}",
      "totals": "Sesiones: {{sessions}} · Series efectivas: {{sets}} · Volumen: {{kg}} kg",
      "muscles": "Series por músculo (directas + indirectas × 0,5)",
      "balance": "Equilibrio",
      "repRanges": "Rangos de repeticiones"
    },
    "progression": {
      "title": "Progresión 1RM (ejercicios con {{min}} o más sesiones)",
      "none": "Ningún ejercicio con {{min}} o más sesiones en el rango."
    }
  }
}
```

In `src/i18n.ts` add `import report from './locales/es/report.json'` after the `nutrition` import and `report,` after `nutrition,` inside `resources.es`.

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/reportMarkdown.test.ts
import { describe, expect, it } from 'vitest'
import '@/i18n'
import type { Report, ReportSession } from '@/domain/report'
import { renderReportMarkdown } from './reportMarkdown'

function session(partial: Partial<ReportSession>): ReportSession {
  return {
    dateKey: '2026-09-14',
    name: 'Empuje A',
    durationSeconds: 58 * 60,
    bodyWeightKg: 82,
    notes: null,
    exercises: [],
    prs: [],
    workingSets: 0,
    volumeKg: 0,
    ...partial,
  }
}

function report(partial: Partial<Report>): Report {
  return {
    range: { fromKey: '2026-09-12', toKey: '2026-10-10', days: 29, sessions: 1 },
    bodyWeightKg: 82,
    formula: 'epley',
    exercises: [],
    sessions: null,
    weeks: null,
    progression: null,
    ...partial,
  }
}

describe('renderReportMarkdown', () => {
  it('renders the title and context block', () => {
    const md = renderReportMarkdown(report({ exercises: [] }))
    expect(md).toBe(
      [
        '# Informe de entrenamiento · 2026-09-12 → 2026-10-10',
        '',
        '## Contexto',
        '- Rango: 2026-09-12 → 2026-10-10 (29 días, 1 sesión)',
        '- Peso corporal actual: 82 kg (cada sesión indica el suyo)',
        '- Fórmula 1RM: Epley',
        '- Unidades: kg · repeticiones · tiempo mm:ss · distancia km',
        '- Etiquetas de serie: [C] calentamiento (excluida de todos los totales) · [D] serie descendente · [F] al fallo · @8 = RPE 8',
        '- En ejercicios a peso corporal, el peso de la serie es lastre añadido al peso corporal.',
        '',
        '## Ejercicios',
        '',
      ].join('\n'),
    )
  })

  it('says when the body weight is not set', () => {
    const md = renderReportMarkdown(report({ bodyWeightKg: null }))
    expect(md).toContain('- Peso corporal actual: no registrado\n')
  })

  it('renders the glossary with catalog data, custom flag and unknown secondaries', () => {
    const md = renderReportMarkdown(
      report({
        exercises: [
          {
            exerciseId: 'bench',
            name: 'Press banca con barra',
            muscle: 'chest',
            secondaryMuscles: ['triceps', 'shoulders'],
            equipment: 'barbell',
            measurement: 'weight_reps',
            custom: false,
          },
          {
            exerciseId: 'mine',
            name: 'Remo rumano',
            muscle: 'back',
            secondaryMuscles: [],
            equipment: 'barbell',
            measurement: 'weight_reps',
            custom: true,
          },
          {
            exerciseId: 'gone',
            name: 'Curl raro',
            muscle: 'biceps',
            secondaryMuscles: null,
            equipment: null,
            measurement: 'weight_reps',
            custom: false,
          },
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Ejercicios',
        '- Press banca con barra — Pecho; secundarios: Tríceps, Hombros · Barra · Peso y repeticiones',
        '- Remo rumano (personalizado) — Espalda; secundarios: ninguno · Barra · Peso y repeticiones',
        '- Curl raro — Bíceps; secundarios: desconocidos · Peso y repeticiones',
        '',
      ].join('\n'),
    )
  })

  it('renders a session with every set, tags, RPE, notes, PRs and totals', () => {
    const md = renderReportMarkdown(
      report({
        sessions: [
          session({
            notes: 'dormí mal',
            workingSets: 3,
            volumeKg: 1360,
            exercises: [
              {
                exerciseId: 'bench',
                name: 'Press banca con barra',
                measurement: 'weight_reps',
                usesBodyweight: false,
                restSeconds: 120,
                notes: 'hombro izquierdo molesto',
                sets: [
                  { position: 1, type: 'warmup', weightKg: 40, reps: 10, durationSeconds: null, distanceMeters: null, rpe: null },
                  { position: 2, type: 'normal', weightKg: 80, reps: 6, durationSeconds: null, distanceMeters: null, rpe: 8 },
                  { position: 3, type: 'failure', weightKg: 80, reps: 5, durationSeconds: null, distanceMeters: null, rpe: 10 },
                  { position: 4, type: 'dropset', weightKg: 60, reps: 8, durationSeconds: null, distanceMeters: null, rpe: null },
                ],
              },
              {
                exerciseId: 'dips',
                name: 'Fondos en paralelas',
                measurement: 'reps_only',
                usesBodyweight: true,
                restSeconds: null,
                notes: null,
                sets: [
                  { position: 1, type: 'normal', weightKg: 10, reps: 12, durationSeconds: null, distanceMeters: null, rpe: null },
                ],
              },
            ],
            prs: [
              {
                exerciseId: 'bench',
                exerciseName: 'Press banca con barra',
                rows: [
                  { display: 'best1Rm', value: 96, previousValue: 94 },
                  { display: 'heaviestWeight', value: 82.5, previousValue: null },
                ],
              },
              {
                exerciseId: 'dips',
                exerciseName: 'Fondos en paralelas',
                rows: [{ display: 'mostReps', value: 12, previousValue: 10 }],
              },
            ],
          }),
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Sesiones',
        '### 2026-09-14 (lunes) · Empuje A · 58 min · peso corporal 82 kg',
        'Notas: dormí mal',
        '1. Press banca con barra · descanso 120 s',
        '   - 1: 40 kg × 10 [C]',
        '   - 2: 80 kg × 6 @8',
        '   - 3: 80 kg × 5 @10 [F]',
        '   - 4: 60 kg × 8 [D]',
        '   - Nota: hombro izquierdo molesto',
        '2. Fondos en paralelas',
        '   - 1: +10 kg × 12',
        'Récords: Press banca con barra · 1RM estimado 96 kg (antes 94) · Peso máximo 82,5 kg (primera marca); Fondos en paralelas · Más repeticiones 12 reps (antes 10)',
        'Total: 3 series efectivas · 1360 kg',
        '',
      ].join('\n'),
    )
  })

  it('omits missing header pieces and the Notas/Récords lines when empty', () => {
    const md = renderReportMarkdown(
      report({ sessions: [session({ durationSeconds: null, bodyWeightKg: null })] }),
    )
    expect(md).toContain('### 2026-09-14 (lunes) · Empuje A\nTotal: 0 series efectivas · 0 kg\n')
    expect(md).not.toContain('Notas:')
    expect(md).not.toContain('Récords:')
  })

  it('formats time, weight+time and distance sets, with dashes for missing halves', () => {
    const md = renderReportMarkdown(
      report({
        sessions: [
          session({
            exercises: [
              {
                exerciseId: 'plank',
                name: 'Plancha',
                measurement: 'time_only',
                usesBodyweight: false,
                restSeconds: null,
                notes: null,
                sets: [{ position: 1, type: 'normal', weightKg: null, reps: null, durationSeconds: 90, distanceMeters: null, rpe: 7 }],
              },
              {
                exerciseId: 'carry',
                name: 'Paseo del granjero',
                measurement: 'weight_time',
                usesBodyweight: false,
                restSeconds: null,
                notes: null,
                sets: [{ position: 1, type: 'normal', weightKg: 32, reps: null, durationSeconds: null, distanceMeters: null, rpe: null }],
              },
              {
                exerciseId: 'run',
                name: 'Carrera',
                measurement: 'distance_time',
                usesBodyweight: false,
                restSeconds: null,
                notes: null,
                sets: [{ position: 1, type: 'normal', weightKg: null, reps: null, durationSeconds: 720, distanceMeters: 2500, rpe: null }],
              },
            ],
          }),
        ],
      }),
    )
    expect(md).toContain('1. Plancha\n   - 1: 1:30 @7\n')
    expect(md).toContain('2. Paseo del granjero\n   - 1: 32 kg · —\n')
    expect(md).toContain('3. Carrera\n   - 1: 2,5 km · 12:00\n')
  })

  it('renders the weekly summary', () => {
    const md = renderReportMarkdown(
      report({
        weeks: [
          {
            weekStartKey: '2026-09-14',
            weekEndKey: '2026-09-20',
            sessions: 4,
            workingSets: 72,
            volumeKg: 24300,
            muscles: [
              { muscle: 'chest', direct: 12, indirect: 4 },
              { muscle: 'back', direct: 14, indirect: 0 },
              { muscle: 'triceps', direct: 0, indirect: 2.5 },
            ],
            balance: { push: 30, pull: 28, legs: 14, core: 0 },
            repRanges: { strength: 20, hypertrophy: 48, endurance: 4 },
          },
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Resumen semanal',
        '### Semana 2026-09-14 → 2026-09-20',
        '- Sesiones: 4 · Series efectivas: 72 · Volumen: 24300 kg',
        '- Series por músculo (directas + indirectas × 0,5): Pecho 16 (12 + 4) · Espalda 14 (14 + 0) · Tríceps 2,5 (0 + 2,5)',
        '- Equilibrio: Empuje 30 · Tirón 28 · Pierna 14 · Core 0',
        '- Rangos de repeticiones: Fuerza (1-5) 20 · Hipertrofia (6-12) 48 · Resistencia (13+) 4',
        '',
      ].join('\n'),
    )
  })

  it('renders the progression with one decimal, and a line when nothing qualifies', () => {
    const md = renderReportMarkdown(
      report({
        progression: [
          {
            exerciseId: 'bench',
            name: 'Press banca con barra',
            points: [
              { dateKey: '2026-09-14', oneRm: 96, weightKg: 80, reps: 6 },
              { dateKey: '2026-09-17', oneRm: 97.3125, weightKg: 82.5, reps: 5 },
            ],
          },
        ],
      }),
    )
    expect(md).toContain(
      [
        '## Progresión 1RM (ejercicios con 5 o más sesiones)',
        '### Press banca con barra',
        '- 2026-09-14: 96 kg (80 kg × 6)',
        '- 2026-09-17: 97,3 kg (82,5 kg × 5)',
        '',
      ].join('\n'),
    )
    expect(renderReportMarkdown(report({ progression: [] }))).toContain(
      '## Progresión 1RM (ejercicios con 5 o más sesiones)\nNingún ejercicio con 5 o más sesiones en el rango.\n',
    )
  })

  it('skips headings of sections that are off and ends with one newline', () => {
    const md = renderReportMarkdown(report({}))
    expect(md).not.toContain('## Sesiones')
    expect(md).not.toContain('## Resumen semanal')
    expect(md).not.toContain('## Progresión')
    expect(md.endsWith('\n')).toBe(true)
    expect(md.endsWith('\n\n')).toBe(false)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/lib/reportMarkdown.test.ts`
Expected: FAIL — `Cannot find module './reportMarkdown'`.

- [ ] **Step 4: Write the renderer**

```ts
// src/lib/reportMarkdown.ts
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import i18n from '@/i18n'
import { MIN_PROGRESSION_SESSIONS } from '@/domain/report'
import type {
  Report,
  ReportExercise,
  ReportProgression,
  ReportSession,
  ReportSessionExercise,
  ReportSet,
  ReportWeek,
} from '@/domain/report'
import type { BalanceGroup, RepRange } from '@/domain/analytics'
import type { PrDisplayRow } from '@/domain/prDetails'
import { formatDuration } from './dates'
import { formatKg, formatSet } from './formatSet'

const SEP = ' · '

/**
 * Markdown for an LLM: every line is data, sections that are off are not
 * rendered, missing values print «—» so the structure stays regular.
 * Lives in lib (not domain) because it formats text with i18n and date-fns.
 */
export function renderReportMarkdown(r: Report): string {
  const out: string[] = [
    `# ${i18n.t('report:md.title')}${SEP}${r.range.fromKey} → ${r.range.toKey}`,
    '',
    ...context(r),
    '',
    ...glossary(r.exercises),
  ]
  if (r.sessions) out.push('', `## ${i18n.t('report:md.sessions.title')}`, ...r.sessions.flatMap(session))
  if (r.weeks) out.push('', `## ${i18n.t('report:md.weekly.title')}`, ...r.weeks.flatMap(week))
  if (r.progression) out.push('', ...progression(r.progression))
  return out.join('\n') + '\n'
}

function context(r: Report): string[] {
  return [
    `## ${i18n.t('report:md.context.title')}`,
    `- ${i18n.t('report:md.context.range', {
      from: r.range.fromKey,
      to: r.range.toKey,
      days: i18n.t('report:md.context.days', { count: r.range.days }),
      sessions: i18n.t('report:md.context.sessions', { count: r.range.sessions }),
    })}`,
    `- ${
      r.bodyWeightKg != null
        ? i18n.t('report:md.context.bodyWeight', { kg: formatKg(r.bodyWeightKg) })
        : i18n.t('report:md.context.bodyWeightUnknown')
    }`,
    `- ${i18n.t('report:md.context.formula', { formula: i18n.t(`settings:oneRm.${r.formula}`) })}`,
    `- ${i18n.t('report:md.context.units')}`,
    `- ${i18n.t('report:md.context.tags')}`,
    `- ${i18n.t('report:md.context.bodyweightNote')}`,
  ]
}

function glossary(exercises: ReportExercise[]): string[] {
  return [
    `## ${i18n.t('report:md.exercises.title')}`,
    ...exercises.map((e) => {
      const name = e.custom ? `${e.name} (${i18n.t('report:md.exercises.custom')})` : e.name
      const secondary =
        e.secondaryMuscles == null
          ? i18n.t('report:md.exercises.unknown')
          : e.secondaryMuscles.length === 0
            ? i18n.t('report:md.exercises.none')
            : e.secondaryMuscles.map((m) => i18n.t(`exercises:muscle.${m}`)).join(', ')
      const parts = [
        `${i18n.t(`exercises:muscle.${e.muscle}`)}; ${i18n.t('report:md.exercises.secondary')}: ${secondary}`,
        e.equipment != null ? i18n.t(`exercises:equipment.${e.equipment}`) : null,
        i18n.t(`exercises:measurement.${e.measurement}`),
      ].filter((p): p is string => p != null)
      return `- ${name} — ${parts.join(SEP)}`
    }),
  ]
}

function session(s: ReportSession): string[] {
  const weekday = format(parseISO(s.dateKey), 'EEEE', { locale: es })
  const header = [
    `${s.dateKey} (${weekday})`,
    s.name,
    s.durationSeconds != null ? formatDuration(s.durationSeconds) : null,
    s.bodyWeightKg != null
      ? i18n.t('report:md.sessions.bodyWeight', { kg: formatKg(s.bodyWeightKg) })
      : null,
  ].filter((p): p is string => p != null)
  const lines = [`### ${header.join(SEP)}`]
  if (s.notes) lines.push(`${i18n.t('report:md.sessions.notes')}: ${s.notes}`)
  s.exercises.forEach((ex, i) => lines.push(...sessionExercise(ex, i + 1)))
  if (s.prs.length > 0) {
    const groups = s.prs.map(
      (g) => `${g.exerciseName}${SEP}${g.rows.map(prRow).join(SEP)}`,
    )
    lines.push(`${i18n.t('report:md.sessions.prs')}: ${groups.join('; ')}`)
  }
  lines.push(
    i18n.t('report:md.sessions.total', { sets: s.workingSets, kg: formatKg(s.volumeKg) }),
  )
  return lines
}

function sessionExercise(ex: ReportSessionExercise, index: number): string[] {
  const rest =
    ex.restSeconds != null
      ? `${SEP}${i18n.t('report:md.sessions.rest', { seconds: ex.restSeconds })}`
      : ''
  const lines = [`${index}. ${ex.name}${rest}`]
  for (const set of ex.sets) lines.push(`   - ${setLine(set, ex.measurement)}`)
  if (ex.notes) lines.push(`   - ${i18n.t('report:md.sessions.note')}: ${ex.notes}`)
  return lines
}

function setLine(set: ReportSet, measurement: ReportSessionExercise['measurement']): string {
  const text = formatSet({ ...set, order: set.position, completed: true }, measurement)
  const rpe = set.rpe != null ? ` @${formatKg(set.rpe)}` : ''
  const tag = set.type !== 'normal' ? ` [${i18n.t(`workout:setTypeShort.${set.type}`)}]` : ''
  return `${set.position}: ${text}${rpe}${tag}`
}

function prRow(row: PrDisplayRow): string {
  const unit = row.display === 'mostReps' ? i18n.t('common:units.reps') : i18n.t('common:units.kg')
  const previous =
    row.previousValue != null
      ? i18n.t('report:md.sessions.prPrevious', { value: formatKg(row.previousValue) })
      : i18n.t('report:md.sessions.prFirst')
  return `${i18n.t(`workout:pr.types.${row.display}`)} ${formatKg(row.value)} ${unit} (${previous})`
}

const balanceOrder: BalanceGroup[] = ['push', 'pull', 'legs', 'core']
const repRangeOrder: RepRange[] = ['strength', 'hypertrophy', 'endurance']

function week(w: ReportWeek): string[] {
  const muscles = w.muscles.map(
    (m) =>
      `${i18n.t(`exercises:muscle.${m.muscle}`)} ${formatKg(m.direct + m.indirect)} (${formatKg(m.direct)} + ${formatKg(m.indirect)})`,
  )
  const balance = balanceOrder.map((g) => `${i18n.t(`analytics:balance.${g}`)} ${w.balance[g]}`)
  const ranges = repRangeOrder.map((k) => `${i18n.t(`analytics:repRanges.${k}`)} ${w.repRanges[k]}`)
  return [
    `### ${i18n.t('report:md.weekly.week', { from: w.weekStartKey, to: w.weekEndKey })}`,
    `- ${i18n.t('report:md.weekly.totals', { sessions: w.sessions, sets: w.workingSets, kg: formatKg(w.volumeKg) })}`,
    `- ${i18n.t('report:md.weekly.muscles')}: ${muscles.join(SEP)}`,
    `- ${i18n.t('report:md.weekly.balance')}: ${balance.join(SEP)}`,
    `- ${i18n.t('report:md.weekly.repRanges')}: ${ranges.join(SEP)}`,
  ]
}

function progression(list: ReportProgression[]): string[] {
  const min = MIN_PROGRESSION_SESSIONS
  const lines = [`## ${i18n.t('report:md.progression.title', { min })}`]
  if (list.length === 0) {
    lines.push(i18n.t('report:md.progression.none', { min }))
    return lines
  }
  for (const p of list) {
    lines.push(`### ${p.name}`)
    for (const pt of p.points) {
      const oneRm = formatKg(Math.round(pt.oneRm * 10) / 10)
      lines.push(`- ${pt.dateKey}: ${oneRm} kg (${formatKg(pt.weightKg)} kg × ${pt.reps})`)
    }
  }
  return lines
}
```

Note on the progression heading: it prints the default threshold because the UI never overrides `minProgressionSessions`; the test suite is the only caller that does.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm vitest run src/lib/reportMarkdown.test.ts`
Expected: PASS. If a key renders as its raw path (e.g. `report:md.title`), the namespace is not registered in `src/i18n.ts` or the JSON key is misspelled.

- [ ] **Step 6: Quality gate and commit**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/locales/es/report.json src/i18n.ts src/lib/reportMarkdown.ts src/lib/reportMarkdown.test.ts
git commit -m "feat(report): Markdown renderer and report locale namespace

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: delivery helpers (copy, share-or-download)

**Files:**
- Create: `src/lib/download.ts`

**Interfaces:**
- Produces: `copyText(text): Promise<boolean>`, `deliverTextFile(filename, text): Promise<DeliverOutcome>`, `reportFilename(fromKey, toKey): string`, `type DeliverOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'`.

No unit test: the module is DOM/Web-API glue and vitest runs in node; `reportFilename` is a one-line template. Verified manually in Task 7.

- [ ] **Step 1: Write the module**

```ts
// src/lib/download.ts

export type DeliverOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

export function reportFilename(fromKey: string, toKey: string): string {
  return `informe-${fromKey}-a-${toKey}.md`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Hands a text file to the OS share sheet when the browser can share files
 * (iOS/Android: «Guardar en Archivos» sits next to the LLM apps), otherwise
 * triggers a plain download. A dismissed share sheet is 'cancelled', not an
 * error. Must be called from a user gesture (share requires it).
 */
export async function deliverTextFile(
  filename: string,
  text: string,
  mime = 'text/markdown',
): Promise<DeliverOutcome> {
  const file = new File([text], filename, { type: mime })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // e.g. NotAllowedError when the gesture expired: fall through to a download
    }
  }
  return downloadBlob(file, filename)
}

function downloadBlob(blob: Blob, filename: string): DeliverOutcome {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // the click has already captured the URL; revoke once the download has started
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
```

- [ ] **Step 2: Quality gate and commit**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm typecheck && pnpm lint`

```bash
git add src/lib/download.ts
git commit -m "feat(report): share-or-download and clipboard helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: ReportSheet and the Analytics button

**Files:**
- Create: `src/features/analytics/ReportSheet.tsx`
- Modify: `src/features/analytics/AnalyticsScreen.tsx` (imports, header, sheet mount)

**Interfaces:**
- Consumes: `buildReport`, `reportSections`, `ReportSection` (`@/domain/report`); `renderReportMarkdown` (`@/lib/reportMarkdown`); `copyText`, `deliverTextFile`, `reportFilename` (`@/lib/download`); `Sheet`, `Chip`; `useExerciseIndex`; `useUserProfile`; `toDateKey`, `weekStartKey`, `weekEndKey` (`@/lib/dates`).
- Produces: `<ReportSheet open onOpenChange workouts />`.

- [ ] **Step 1: Write the sheet**

```tsx
// src/features/analytics/ReportSheet.tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { subDays } from 'date-fns'
import { toast } from 'sonner'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { useUserProfile } from '@/data/hooks'
import { buildReport, reportSections, type ReportSection } from '@/domain/report'
import type { WithId, Workout } from '@/domain/types'
import { toDateKey, weekEndKey, weekStartKey } from '@/lib/dates'
import { copyText, deliverTextFile, reportFilename } from '@/lib/download'
import { renderReportMarkdown } from '@/lib/reportMarkdown'

type Preset = '4w' | '8w' | '3m' | 'custom'
const presets: Preset[] = ['4w', '8w', '3m', 'custom']
/** Rolling windows ending today, inclusive. */
const presetDays: Record<Exclude<Preset, 'custom'>, number> = { '4w': 28, '8w': 56, '3m': 91 }

interface DateRange {
  from: string
  to: string
}

function presetRange(preset: Exclude<Preset, 'custom'>): DateRange {
  const today = new Date()
  return { from: toDateKey(subDays(today, presetDays[preset] - 1)), to: toDateKey(today) }
}

const inputClass =
  'h-11 w-full rounded-card border border-hairline bg-surface-2 px-3 text-base text-ink outline-none focus:border-accent'

/**
 * Two steps in one sheet: options (range + sections) → generated Markdown
 * with Descargar / Copiar. Works on the workouts the Analytics screen already
 * holds; closing the sheet returns to the options step.
 */
export function ReportSheet({
  open,
  onOpenChange,
  workouts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workouts: WithId<Workout>[]
}) {
  const { t } = useTranslation(['report', 'common'])
  const { byId } = useExerciseIndex()
  const profile = useUserProfile()
  const [preset, setPreset] = useState<Preset>('4w')
  const [custom, setCustom] = useState<DateRange>(() => presetRange('4w'))
  const [sections, setSections] = useState<Set<ReportSection>>(() => new Set(reportSections))
  const [markdown, setMarkdown] = useState<string | null>(null)

  const range = useMemo(
    () => (preset === 'custom' ? custom : presetRange(preset)),
    [preset, custom],
  )
  const inRange = useMemo(
    () => workouts.filter((w) => w.dateKey >= range.from && w.dateKey <= range.to),
    [workouts, range],
  )
  const rangeValid = range.from !== '' && range.to !== '' && range.from <= range.to
  const canGenerate = rangeValid && inRange.length > 0

  function choosePreset(next: Preset) {
    // «Personalizado» starts from the dates of the preset that was active
    if (next === 'custom' && preset !== 'custom') setCustom(presetRange(preset))
    setPreset(next)
  }

  function toggleSection(section: ReportSection) {
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  function generate() {
    const settings = profile?.settings
    const report = buildReport({
      workouts: inRange,
      fromKey: range.from,
      toKey: range.to,
      sections: reportSections.filter((s) => sections.has(s)),
      formula: settings?.oneRmFormula ?? 'epley',
      bodyWeightKg: settings?.bodyWeightKg ?? null,
      resolveDef: (id) => byId.get(id),
      weekStartKeyOf: weekStartKey,
      weekEndKeyOf: weekEndKey,
    })
    setMarkdown(renderReportMarkdown(report))
  }

  async function copy() {
    if (markdown == null) return
    if (await copyText(markdown)) toast.success(t('report:copied'))
    else toast.error(t('report:copyFailed'))
  }

  async function download() {
    if (markdown == null) return
    const outcome = await deliverTextFile(reportFilename(range.from, range.to), markdown)
    if (outcome === 'downloaded') toast.success(t('report:downloaded'))
    else if (outcome === 'failed') toast.error(t('report:downloadFailed'))
  }

  function handleOpenChange(next: boolean) {
    if (!next) setMarkdown(null)
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title={t('report:title')} tall>
      {markdown == null ? (
        <div className="flex flex-col gap-5 pt-4">
          <section>
            <h3 className="pb-2 text-sm font-medium text-ink-2">{t('report:range.title')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Chip
                  key={p}
                  label={t(`report:range.${p}`)}
                  active={preset === p}
                  onClick={() => choosePreset(p)}
                />
              ))}
            </div>
            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-3">
                <label className="flex flex-col gap-1 text-xs text-ink-3">
                  {t('report:range.from')}
                  <input
                    type="date"
                    value={custom.from}
                    max={custom.to}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-3">
                  {t('report:range.to')}
                  <input
                    type="date"
                    value={custom.to}
                    min={custom.from}
                    max={toDateKey(new Date())}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>
            )}
            {!rangeValid && <p className="pt-2 text-xs text-ink-3">{t('report:range.invalid')}</p>}
          </section>

          <section>
            <h3 className="pb-2 text-sm font-medium text-ink-2">{t('report:sections.title')}</h3>
            <div className="flex flex-col gap-2">
              {reportSections.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-3 rounded-card border border-hairline p-3"
                >
                  <input
                    type="checkbox"
                    checked={sections.has(s)}
                    onChange={() => toggleSection(s)}
                    className="size-5 accent-(--accent)"
                  />
                  <span className="text-sm font-medium">{t(`report:sections.${s}`)}</span>
                </label>
              ))}
            </div>
          </section>

          <p className="text-sm text-ink-3">{t('report:sessionsInRange', { count: inRange.length })}</p>

          <button
            type="button"
            disabled={!canGenerate}
            onClick={generate}
            className="h-12 rounded-card bg-accent font-semibold text-on-accent disabled:opacity-60"
          >
            {t('report:generate')}
          </button>
        </div>
      ) : (
        <ReportResult
          markdown={markdown}
          sessions={inRange.length}
          onBack={() => setMarkdown(null)}
          onCopy={copy}
          onDownload={download}
        />
      )}
    </Sheet>
  )
}

function ReportResult({
  markdown,
  sessions,
  onBack,
  onCopy,
  onDownload,
}: {
  markdown: string
  sessions: number
  onBack: () => void
  onCopy: () => void
  onDownload: () => void
}) {
  const { t } = useTranslation('report')
  const lines = markdown.split('\n').length - 1
  const kb = Math.max(1, Math.round(new TextEncoder().encode(markdown).length / 1024))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
      <div className="flex items-center justify-between gap-3 text-xs text-ink-3">
        <span className="tnum">{t('size', { sessions, lines, kb })}</span>
        <button type="button" onClick={onBack} className="shrink-0 font-medium text-accent">
          {t('back')}
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto rounded-card border border-hairline bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">
        {markdown}
      </pre>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="h-12 rounded-card bg-accent font-semibold text-on-accent"
        >
          {t('download')}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="h-12 rounded-card border border-hairline bg-surface font-semibold text-ink"
        >
          {t('copy')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount it from the Analytics header**

In `src/features/analytics/AnalyticsScreen.tsx`:

Change the lucide import to `import { ChartBar, ChartPie, FileText, List } from 'lucide-react'` and add `import { ReportSheet } from './ReportSheet'` after the `Last7DaysCard` import.

Inside `AnalyticsScreen`, after `const [weekStart, setWeekStart] = useState(currentWeekStart)` add:

```tsx
  const [reportOpen, setReportOpen] = useState(false)
```

Change `useTranslation(['analytics', 'exercises', 'common'])` to `useTranslation(['analytics', 'exercises', 'common', 'report'])`.

Replace the `<h1 …>{t('analytics:title')}</h1>` line with:

```tsx
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('analytics:title')}</h1>
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-chip border border-hairline bg-surface px-3 text-sm text-ink-2"
        >
          <FileText className="size-4" />
          {t('report:open')}
        </button>
      </div>
```

Just before the closing `</div>` of the screen (after the `filtered.length === 0 ? … : …` block) add:

```tsx
      <ReportSheet open={reportOpen} onOpenChange={setReportOpen} workouts={workouts} />
```

- [ ] **Step 3: Quality gate**

Run: `PATH=~/.local/share/pnpm/bin:$PATH pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. Typical failures: a `t()` key typed wrong (typecheck catches it because the namespaces are typed), or oxlint complaining about an unused import.

- [ ] **Step 4: Commit**

```bash
git add src/features/analytics/ReportSheet.tsx src/features/analytics/AnalyticsScreen.tsx
git commit -m "feat(analytics): report sheet with range, sections, download and copy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: manual verification on the emulators

**Files:** none (verification only). Uses the project `verify` skill flow (Auth :9199, Firestore :8180, preview on localhost).

- [ ] **Step 1: Build and run against the emulators**

Follow the `verify` skill: start the emulators, build, serve the preview, log in with the seeded user. Known gotchas: the app heading is «TestoTracker», the preview only works on localhost, don't `pkill -f firebase`.

- [ ] **Step 2: Walk the flow**

1. Open «Análisis» → the «Informe» button sits right of the title. Tap it.
2. Sheet shows «4 semanas» active, three checked sections, «N sesiones en el rango», «Generar» enabled when N > 0.
3. Tap «Personalizado»: the two date inputs show the 4-week dates. Set «Desde» after «Hasta» (or clear one) → «Generar» disabled and the hint appears. Fix it → enabled.
4. Uncheck «Progresión 1RM», tap «Generar» → the result step shows the size line, the Markdown preview without a «## Progresión 1RM» heading, and both buttons.
5. «Copiar» → toast «Informe copiado»; paste somewhere to confirm.
6. «Descargar» → on desktop Chromium a file `informe-<from>-a-<to>.md` downloads and the toast «Informe descargado» appears. On a phone the share sheet opens; dismissing it shows no toast.
7. «Cambiar opciones» → back to step 1 with the same choices. Close the sheet, reopen → step 1 again.

- [ ] **Step 3: Record the result**

Note anything that failed. Fix inside the owning task's files, re-run the quality gate, and commit the fix as `fix(report): …`.
