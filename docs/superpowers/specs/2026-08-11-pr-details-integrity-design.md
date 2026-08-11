# PR details + record integrity — design

Date: 2026-08-11 · Status: approved

## Goal

Today a finished session only stores `prCount` ("5 récords") — the *which*,
*value*, and *previous mark* are computed in `finishWorkout` and thrown away.
Editing a past session sets `prCount: null`, losing attribution entirely. And
a misclicked set-check fires a live PR toast that never retracts.

This feature: persist the full record detail per workout, show it in the
session detail screen, keep it correct across history edits/deletes, and make
the live toast honest under edits.

## Data model (`src/domain/types.ts`)

```ts
export const prDetailSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: z.enum(prTypes),
  value: z.number(),
  /** Mark that was beaten; null = first record of this type for the exercise. */
  previousValue: z.number().nullable(),
})
export type PrDetail = z.infer<typeof prDetailSchema>

// workoutSchema gains:
prDetails: z.array(prDetailSchema).nullable().default(null)
```

- Both 1RM formulas are stored as separate entries (same philosophy as
  `stats.prs`: a settings change never corrupts history). UI collapses them.
- `.default(null)` keeps every pre-feature doc parsing.

## Finish flow (`finishWorkout`)

For each exercise, the baseline (`statsBaseline(prev)`) provides
`previousValue` per type and `applySessionPrs` the beaten types. Build the
`PrDetail[]` and write it on the workout in the same batch. `prCount`
semantics unchanged (sum per exercise of `displayPrCount`). Baseline sessions
(first ever for the exercise) contribute no details, as today.

A pure helper builds details from `(newPrs, candidates, baseline)` — lives in
`src/domain/prs.ts` with tests.

## Rebuild integrity (`statsRebuild.ts` + `workoutMutations.ts`)

`rebuildStatsForExercise` additionally returns
`prEventsByWorkout: Map<workoutId, PrDetail[]>`: while replaying
chronologically it records, per workout, the types that workout set, with the
running baseline value as `previousValue`. The exercise's first session emits
no events (baseline rule, mirrors live behavior).

**Orchestration change.** `saveEditedWorkout` / `deleteCompletedWorkout`
currently fire independent per-exercise `recomputeExerciseStats` calls, each of
which could write the same workout doc (race → lost updates). New shape:

1. For each affected exercise: query its completed sessions (as today,
   honoring `excludeWorkoutId` / `overrideWorkout`), rebuild stats, write the
   `exerciseStats` doc, and collect `prEventsByWorkout`.
2. Group all events by workout across the affected exercises.
3. For each touched workout doc, **one** update: drop `prDetails` entries of
   the recomputed exercises, insert the new events, recompute `prCount` from
   the merged list (group by exercise, sum `displayPrCount`).

This makes record attribution self-healing: editing an old session moves a
record to whichever later session now holds it. `prCount: null` on edit is
gone.

**Legacy policy.** A pre-feature doc (`prDetails: null`) touched only
incidentally (shares an exercise with the edited workout) keeps its old
`prCount` and stays `prDetails: null` — we don't know its other exercises'
entries, and writing a partial list would lie. The edited workout itself is
always fully known (all its exercises are recomputed), so it always gets
complete details.

**Backfill.** `recomputeAllExerciseStats` (Settings → full repair) is extended
to also write `prDetails` + `prCount` for every completed workout (it rebuilds
everything, so it has complete knowledge). Running it once after shipping
backfills the entire history.

Merge/recount helpers are pure, in `src/domain/prDetails.ts`, with colocated
tests.

## Live toast honesty (`ActiveWorkoutScreen`)

Track the sonner toast id per set (`Map` in a ref, key `${exIndex}:${setIndex}`):

- **Uncheck** → dismiss that set's PR toast.
- **Edit values of a completed set** (weight/reps/time/distance commit) →
  dismiss the stale toast, re-run `detectLiveSetPrs` with the corrected set,
  fire a fresh toast if it is still a record (store the new id).
- Weight propagation (`updateSetWeight`) re-evaluates only the directly edited
  set; propagated targets are open sets, which have no toasts.

Accepted edge: removing/reordering sets shifts keys; toasts auto-dismiss in
seconds, so a missed dismissal is harmless.

## Session detail UI (`WorkoutDetailScreen`)

The «X récords» banner becomes a records card when `prDetails` is present:

- Grouped by exercise: name header, one row per display-type record.
- Row: type label + `previous → new` («92,5 kg → 96 kg»); «nuevo récord» when
  `previousValue` is null.
- Formats per type: kg (heaviest, 1RM, set/session volume), reps count.
- 1RM pair collapses to the user's `oneRmFormula`; if only the other formula
  improved, show that entry instead (label stays «1RM est.»).
- Legacy docs (`prDetails: null`, `prCount > 0`): today's count-only banner.
- Strings in `src/locales/es/history.json` / `workout.json`; PR type labels
  already exist (`workout:pr.types.*`).

## Testing

- `prs.test.ts`: detail building (values, previousValue, baseline session).
- `statsRebuild.test.ts`: per-workout event attribution; record migrates to a
  later session after an edit; first session emits nothing; previousValue
  follows the chronological chain.
- `prDetails.test.ts`: merge drops only recomputed exercises' entries;
  prCount recount collapses the 1RM pair per exercise.
- Quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Out of scope

- Celebration modal on finish (kept: count toast + detail screen).
- PR timeline/feed across sessions.
- Retracting `exerciseStats` PRs mid-session (stats are only written on
  finish; live toasts are the only ephemeral feedback).
