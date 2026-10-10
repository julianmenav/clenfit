# Training report export («Informe») — design

Date: 2026-10-10 · Status: approved

## Goal

Let the user export a raw, opinion-free dump of a date range of training as
Markdown, to paste into an LLM and ask for conclusions. The report must be
self-explanatory: an LLM that has never seen the app should understand every
line without the user explaining units, tags or made-up exercise names.

Entry point: an «Informe» button on the Analytics tab. Flow: choose range and
sections → generate → download the file or copy the text.

## Non-goals

- No opinions, scores or recommendations in the report. Data only.
- No nutrition section for now (the section list is designed so adding
  «Nutrición» later is one more entry, nothing structural).
- No JSON/CSV output. Markdown only.
- No new Firestore queries or indexes: the report is built from the workouts
  the Analytics screen already has loaded (the 500 most recent).

## UI flow

The Analytics header gets an «Informe» button (document icon + label) next
to the title. It opens a tall `Sheet` with two steps.

**Step 1 — options**

- Range chips: «4 semanas» (default), «8 semanas», «3 meses», «Personalizado».
  Presets are rolling windows ending today: 28, 56 and 91 days inclusive.
  «Personalizado» reveals two native `<input type="date">` fields, «Desde» and
  «Hasta», prefilled with the last preset's dates. The range is validated in
  the domain (`reportRangeProblem`): an empty date, an inverted range or an
  end date after today disables «Generar» and shows a hint; the input's
  `max` alone is not enough because a typed date bypasses it.
- «Generar» also waits for the user profile and the custom exercises to be
  loaded, so the report never states a default formula or loses custom
  exercise metadata.
- Section checkboxes, all on by default: «Sesiones», «Resumen semanal»,
  «Progresión 1RM». Context and the exercise glossary are always included
  and not shown as options.
- A line below the options: «N sesiones en el rango». «Generar» is disabled
  when N = 0.

**Step 2 — result**

- A size line: «12 sesiones · 310 líneas · 14 KB».
- The Markdown in a scrollable monospace `<pre>` box.
- Two buttons pinned at the bottom: «Descargar» and «Copiar».
- A «Cambiar opciones» link goes back to step 1 keeping the choices.

## Delivery (`src/lib/download.ts`)

- `copyText(text)` → `navigator.clipboard.writeText`, then a toast
  («Informe copiado»).
- `deliverTextFile(filename, text)`: builds a `File` of type
  `text/markdown`. If `navigator.canShare({ files })` is true (iOS and
  Android), it calls `navigator.share({ files, title })` so the OS sheet
  offers both «Guardar en Archivos» and the LLM apps. Otherwise it triggers a
  plain `<a download>` with an object URL. Returns
  `'shared' | 'downloaded' | 'cancelled' | 'failed'`; an `AbortError` from
  the share sheet is `'cancelled'` and shows no toast. Any other share error
  (e.g. an expired gesture) falls through to the download path; only a
  failed download shows an error toast.
- Filename: `informe-<fromKey>-a-<toKey>.md`.

Rationale: a direct download inside an installed PWA on iOS is unreliable and
lands in the Files app; the share sheet gives the file and the
direct-to-app path at once.

## Data

- Workouts: the `useCompletedWorkouts(500)` result the Analytics screen
  already holds, passed to the sheet as a prop and filtered by
  `dateKey ∈ [fromKey, toKey]`. A range older than the 500 loaded workouts
  (~2 years at 5 sessions/week) is truncated; documented, not handled.
- Exercise definitions: `useExerciseIndex().byId` (catalog + custom +
  deprecated). An id with no definition (deleted custom exercise) falls
  back to the data stored in the workout.
- Body weight and 1RM formula: `useUserProfile().settings`.

## Domain model (`src/domain/report.ts`, pure)

```ts
export type ReportSection = 'sessions' | 'weekly' | 'progression'
export const reportSections: readonly ReportSection[]
export const MIN_PROGRESSION_SESSIONS = 5

export interface ReportInput {
  workouts: Pick<Workout, 'dateKey' | 'startedAt' | 'name' | 'durationSeconds' |
    'bodyWeightKg' | 'notes' | 'exercises' | 'prDetails'>[]   // any order
  fromKey: string
  toKey: string
  sections: readonly ReportSection[]
  formula: OneRmFormula
  bodyWeightKg: number | null            // current, from settings
  resolveDef: (exerciseId: string) => ExerciseDef | undefined
  weekStartKeyOf: (dateKey: string) => string   // injected (date-lib-free module)
  weekEndKeyOf: (weekStartKey: string) => string
  minProgressionSessions?: number        // default MIN_PROGRESSION_SESSIONS
}

export interface Report {
  range: { fromKey: string; toKey: string; days: number; sessions: number }
  bodyWeightKg: number | null
  formula: OneRmFormula
  exercises: ReportExercise[]           // glossary: every exercise in range, by name
  sessions: ReportSession[] | null      // null = section not requested
  weeks: ReportWeek[] | null
  progression: ReportProgression[] | null
}

export interface ReportExercise {
  exerciseId: string
  name: string                          // from the def when found, else the workout copy
  muscle: MuscleGroup
  secondaryMuscles: MuscleGroup[] | null  // null = definition not found
  equipment: Equipment | null             // null = definition not found
  measurement: Measurement
  custom: boolean
}

export interface ReportSet {
  position: number                      // 1-based within the exercise, warmups included
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
  exercises: ReportSessionExercise[]     // by `order`
  prs: PrExerciseGroup[]                 // prDisplayGroups(prDetails ?? [], formula)
  workingSets: number                    // via summarizeWorkout (recomputed, never the stored totals)
  volumeKg: number
}

export interface ReportWeek {
  weekStartKey: string
  weekEndKey: string
  sessions: number
  workingSets: number
  volumeKg: number
  muscles: { muscle: MuscleGroup; direct: number; indirect: number }[] // total desc, only > 0
  balance: Record<BalanceGroup, number>  // muscleBalance over recomputed setsByMuscle
  repRanges: Record<RepRange, number>
}

export interface ReportProgression {
  exerciseId: string
  name: string
  points: { dateKey: string; oneRm: number; weightKg: number; reps: number }[] // ascending
}

export function buildReport(input: ReportInput): Report
```

Rules:

- Sessions sorted ascending by `dateKey`, then `startedAt`. Only workouts
  with `dateKey` inside the range count anywhere.
- Every set is listed, warmups included, each tagged with its type. Warmups
  are excluded from every total (`isWorkingSet` is the only gate), same as
  the rest of the app.
- `range.days` is the inclusive day count between the two keys, computed
  with `Date.UTC` arithmetic (no date library in the domain).
- Weekly buckets reuse `muscleSetBreakdown`, `muscleBalance` and
  `repRangeDistribution` from `analytics.ts`; only weeks with at least one
  session appear, ascending.
- Progression covers exercises with `measurement === 'weight_reps'` only
  (bodyweight loads are ballast, not the lift) that appear in at least
  `minProgressionSessions` sessions in the range with an estimable set. One
  point per session: the best `estimateSet1Rm(set, formula)` and the set
  behind it; several entries of the same exercise in one session are merged.
  Exercises are listed by name.
- Glossary: one row per distinct `exerciseId` across the range, sorted by
  name with `localeCompare`.

## Markdown renderer (`src/lib/reportMarkdown.ts`)

`renderReportMarkdown(report: Report): string`. Lives in `lib` (not domain)
because it formats text: it uses `formatKg` / `formatClock` / `formatKm`,
date-fns for weekday names and `i18n.t` with the `report` namespace plus the
existing `exercises:muscle.*`, `exercises:equipment.*`,
`exercises:measurement.*` and `workout:pr.types.*` keys. Tests import the
real i18n instance so they assert the exact Spanish output and surface
missing keys.

Shape (every line is data; nothing is omitted silently, missing values print
«—»):

```markdown
# Informe de entrenamiento · 2026-09-12 → 2026-10-10

## Contexto
- Rango: 2026-09-12 → 2026-10-10 (29 días, 12 sesiones)
- Peso corporal actual: 82 kg (cada sesión indica el suyo)
- Fórmula 1RM: Epley
- Unidades: kg · repeticiones · tiempo mm:ss · distancia km
- Etiquetas de serie: [C] calentamiento (excluida de todos los totales) · [D] serie descendente · [F] al fallo · @8 = RPE 8
- En ejercicios a peso corporal, el peso de la serie es lastre añadido al peso corporal.

## Ejercicios
- Press banca con barra — pecho; secundarios: tríceps, hombros · barra · peso y repeticiones
- Remo rumano (personalizado) — espalda; secundarios: ninguno · barra · peso y repeticiones
- Curl raro — bíceps; secundarios: desconocidos · peso y repeticiones

## Sesiones
### 2026-09-14 (lunes) · Empuje A · 58 min · peso corporal 82 kg
Notas: dormí mal
1. Press banca con barra · descanso 120 s
   - 1: 40 kg × 10 [C]
   - 2: 80 kg × 6 @8
   - 3: 80 kg × 6 @9
   - 4: 80 kg × 5 @10 [F]
   - Nota: hombro izquierdo molesto
2. Fondos en paralelas · descanso 90 s
   - 1: +10 kg × 12
Récords: Press banca con barra · 1RM est. 96 kg (antes 94) · Peso máximo 82,5 kg (primera marca)
Total: 18 series efectivas · 6420 kg

## Resumen semanal
### Semana 2026-09-14 → 2026-09-20
- Sesiones: 4 · Series efectivas: 72 · Volumen: 24300 kg
- Series por músculo (directas + indirectas × 0,5): pecho 16 (12 + 4) · espalda 14 (14 + 0)
- Equilibrio: empuje 30 · tirón 28 · pierna 14 · core 0
- Rangos de repeticiones: fuerza (1-5) 20 · hipertrofia (6-12) 48 · resistencia (13+) 4

## Progresión 1RM (ejercicios con 5 o más sesiones)
### Press banca con barra
- 2026-09-14: 96 kg (80 kg × 6)
- 2026-09-17: 97,3 kg (82,5 kg × 5)
```

Details:

- Session header pieces (name, duration, body weight) are omitted when
  null; the date is always `YYYY-MM-DD (weekday)`.
- Set lines reuse the `formatSet` conventions (`80 kg × 6`, `+10 kg × 12`,
  `1:30`, `2,5 km · 12:00`), then `@rpe` when present, then the type tag
  for non-normal sets.
- «Récords:» and «Notas:» / «Nota:» lines appear only when there is content.
- Section headings for sections that are off are not rendered at all.
- Numbers use `formatKg` (Spanish decimal comma, no thousands separator).

## i18n

New namespace `src/locales/es/report.json`, registered in `src/i18n.ts`:
UI strings (button, sheet title, range and section labels, size line,
toasts) and the report's fixed strings under `md.*`.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/report.ts` (+ test) | `buildReport`: filtering, glossary, sessions, weeks, progression |
| `src/lib/reportMarkdown.ts` (+ test) | `renderReportMarkdown` |
| `src/lib/download.ts` | `copyText`, `deliverTextFile`, `reportFilename` |
| `src/locales/es/report.json`, `src/i18n.ts` | copy + namespace |
| `src/features/analytics/ReportSheet.tsx` | two-step sheet |
| `src/features/analytics/AnalyticsScreen.tsx` | header button + sheet mount |

## Testing

- `report.test.ts`: range filtering (inclusive bounds, out-of-range ignored),
  ascending order, warmups listed but excluded from totals, glossary dedup
  and name sort, missing definition fallback (`secondaryMuscles: null`,
  `custom: false`), custom flag, week grouping with injected Monday keys,
  sections off → `null`, progression threshold (4 sessions → absent, 5 →
  present), merged entries in one session, bodyweight exercises excluded
  from progression, `range.days` inclusive.
- `reportMarkdown.test.ts`: exact output for a small fixture covering every
  measurement type, each set tag, RPE, notes at both levels, PRs with and
  without previous value, a session without duration/body weight, an
  unknown-definition glossary row, and the headings-off case.
- UI: manual pass on the emulators (sheet steps, copy, download/share).
  The repo has no component tests; this feature doesn't start them.

## Edge cases

- Empty range → «Generar» disabled, no empty report.
- Deleted custom exercise → glossary row from the workout copy with
  «secundarios: desconocidos» and no equipment.
- Workout docs predating `prDetails` / `bodyWeightKg` → `null` handled
  (no «Récords:» line, no body weight piece).
- Share sheet dismissed → nothing happens, no error toast.
- Browser without clipboard API (very old) → error toast.

## Future

- «Nutrición» section: one line per logged day with kcal/macros vs the goal
  in force (`goalForDay`). Add `'nutrition'` to `ReportSection`, a
  `nutritionDays` input and a renderer block.
