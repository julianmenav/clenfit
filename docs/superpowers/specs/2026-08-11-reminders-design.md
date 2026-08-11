# Programmable workout reminders («Recordatorios») — design

Date: 2026-08-11 · Status: approved

## Goal

User-programmable motivational messages that fire at chosen moments of a
session: on workout start, on finish, before a specific exercise, or before
the first exercise of a muscle group. Presentation is a full-screen hype
overlay («FOCUS. Desde la primera rep hasta la última.») — impossible to miss
mid-gym. Messages rotate from a per-reminder pool; curated Spanish preset
packs can be adopted with one tap.

## Data model (`src/domain/types.ts`)

New subcollection `users/{uid}/reminders`:

```ts
export const reminderTriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('workoutStart') }),
  z.object({ type: z.literal('workoutFinish') }),
  z.object({
    type: z.literal('beforeExercise'),
    exerciseId: z.string(),
    exerciseName: z.string(), // copy — survives renames/retired exercises
  }),
  z.object({ type: z.literal('beforeMuscle'), muscle: z.enum(muscleGroups) }),
])
export const reminderSchema = z.object({
  enabled: z.boolean(),
  trigger: reminderTriggerSchema,
  /** Routines this applies to; null = every workout, freestyle included. */
  routineIds: z.array(z.string()).nullable(),
  /** One is picked at random per firing. */
  messages: z.array(z.string().min(1)).min(1),
  createdAt: z.instanceof(Timestamp),
})
```

## Domain logic (`src/domain/reminders.ts`, colocated test)

Pure functions:

- `matchReminders(reminders, event, ctx): WithId<Reminder>[]` — event is
  `{ kind: 'workoutStart' } | { kind: 'workoutFinish' } |
  { kind: 'exerciseTouched', exerciseId, muscle }`; ctx is
  `{ routineId: string | null, firedKeys: ReadonlySet<string> }`.
  Disabled reminders never match. Routine filter: `routineIds != null` matches
  only when `ctx.routineId` is in the list.
- `reminderFireKey(reminder, event): string` — dedupe key: once per session
  for start/finish, once per exercise for `beforeExercise`, once per muscle
  for `beforeMuscle`.
- `pickMessage(messages, rand: number): string` — rand ∈ [0,1) injected by the
  caller (`Math.random()`), keeps the function pure.
- Muscle matching uses the exercise's **primary** muscle only (all that
  `WorkoutExercise` stores). v1 limit, documented.

## Firing infrastructure

`src/store/reminders.ts` (zustand):

- **Overlay queue** (not persisted): `{ message: string }[]`, `enqueue`,
  `dismiss` (pops head).
- **Fired keys** (persisted to localStorage): `{ workoutId, keys: string[] }`
  — a refresh mid-session never refires; reset when a different workout starts
  and cleared on finish/discard.

Hook-in points:

- `workoutStart` → `useStartWorkout`, after the session begins (routineId
  known).
- `workoutFinish` → `confirmFinish` in `ActiveWorkoutScreen`, after a
  successful finish. The overlay lives in `AppLayout`, so it survives the
  automatic navigation to the session detail.
- `exerciseTouched` → `ActiveWorkoutScreen`: first focus of any field inside
  an exercise card (focus-capture on the card container) **or** its first
  set-check, whichever comes first.

## Overlay (`ReminderOverlay`, mounted in `AppLayout`)

Full-screen takeover: near-black backdrop, message in huge bold type revealed
word by word (staggered CSS animation, `animation-delay` per word — no
animation lib), vibration pulse on entry (`navigator.vibrate([80, 40, 120])`),
accent color flash on the last word. Tap anywhere dismisses; queued messages
chain. `role="dialog"` + `aria-modal`; `prefers-reduced-motion` renders the
message instantly. Uses semantic tokens (`tokens.css`) for the accent.

## Management UI

- Routes: `/recordatorios` (list) · `/recordatorios/nuevo` ·
  `/recordatorios/:id` (editor). Entry link in Settings.
- List row: enabled toggle, trigger chip («Al empezar», «Antes de Press
  banca», «Antes de cuádriceps», «Al terminar»), message count.
- Editor: trigger type selector → contextual picker (reuse `ExercisePicker`
  for exercises; muscle chips for muscle groups), routine filter (all vs
  multi-select of routines), message list (add/remove/edit lines), preset
  packs, enabled toggle. Delete with `ConfirmDialog`.
- Data layer: `data/reminderMutations.ts` (CRUD, offline-safe like the rest)
  + `useReminders()` listener in `data/hooks.ts`.
- `firestore.rules`: verify the per-user wildcard covers the new subcollection;
  add a rule if not.

## Preset packs (`src/locales/es/reminders.json`)

Adopting a pack copies its resolved strings into the reminder's `messages`
(user data thereafter; later pack edits never mutate saved reminders). Shipped
packs (final copy written during implementation, this is the voice):

- **Modo bestia** — «FOCUS. Desde la primera rep hasta la última.» · «No hay
  nadie más en el gym. Solo tú y el puto hierro.» · «Nadie te mira. Nadie
  importa. Aprieta.»
- **Foco total** — calm intensity: respiración, técnica, presencia.
- **Primera rep, última rep** — no junk reps; cada serie con intención.
- **Cierre** — «Has venido. Has trabajado. Eso ya te separa del 90%.»

## Testing

- `domain/reminders.test.ts`: matching per event kind, routine filter,
  once-per-session dedupe keys, muscle trigger, disabled reminders,
  `pickMessage` bounds.
- Quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Out of scope

- Push/scheduled notifications outside a session (this is in-session only).
- «After each exercise» trigger (not selected for v1).
- Secondary-muscle matching.
- Per-reminder intensity levels (every reminder uses the overlay).
