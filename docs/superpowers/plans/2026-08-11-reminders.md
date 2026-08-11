# Workout Reminders («Recordatorios») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User-programmable motivational messages that fire as a full-screen overlay at chosen session moments: workout start, workout finish, before a specific exercise, or before the first exercise of a muscle group.

**Architecture:** Reminders live in `users/{uid}/reminders` (zod schema + typed converter, same pattern as routines). Pure trigger-matching in `src/domain/reminders.ts`. A zustand store holds the overlay queue (ephemeral) and per-session fired ids (persisted). `ReminderOverlay` mounts in `AppLayout` so finish-triggered messages survive navigation. Management UI at `/recordatorios` with a list + editor, preset packs shipped in the locale file.

**Tech Stack:** React 19 + TypeScript, zod, Firestore, zustand persist, i18next, vitest, Tailwind v4 CSS-first (semantic tokens).

## Global Constraints

- App UI text is 100% Spanish via i18next (`src/locales/es/*.json`) — never hardcode text in components. Preset pack copy lives in `reminders.json`.
- `src/domain/` is pure (only the `Timestamp` type from Firebase in `types.ts`); colocated tests, Spanish test descriptions.
- Firestore writes: offline-safe pattern (not awaited, `.catch(console.error)`).
- Routes are in Spanish (`/recordatorios`, `/recordatorios/nuevo`, `/recordatorios/:reminderId`).
- Muscle labels reuse `exercises:muscle.<key>`; muscle matching uses the exercise's PRIMARY muscle only (v1 limit).
- Dedupe rule: each reminder fires at most once per session — the fired-key IS the reminder id (a reminder targets exactly one trigger/exercise/muscle, so this implements the spec's once-per-exercise/muscle rule exactly).
- Quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Commit after every task.

---

### Task 1: schema, converter, rules, locale namespace

**Files:**
- Modify: `src/domain/types.ts` (new Reminders section after Routines)
- Modify: `src/data/converters.ts` (converter + collection refs)
- Modify: `firestore.rules` (new subcollection match)
- Create: `src/locales/es/reminders.json`
- Modify: `src/i18n.ts` (register namespace)
- Test: `src/domain/types.test.ts`

**Interfaces:**
- Produces: `reminderTriggerSchema`, `ReminderTrigger`, `reminderSchema`, `Reminder`; `remindersCol(uid)`, `reminderDoc(uid, id)`; i18n namespace `reminders`.

- [ ] **Step 1: Write the failing test** — append to `src/domain/types.test.ts`:

```ts
describe('reminderSchema', () => {
  const base = {
    enabled: true,
    routineIds: null,
    messages: ['FOCUS.'],
    createdAt: Timestamp.now(),
  }

  it('acepta los cuatro tipos de disparador', () => {
    expect(() => reminderSchema.parse({ ...base, trigger: { type: 'workoutStart' } })).not.toThrow()
    expect(() => reminderSchema.parse({ ...base, trigger: { type: 'workoutFinish' } })).not.toThrow()
    expect(() =>
      reminderSchema.parse({
        ...base,
        trigger: { type: 'beforeExercise', exerciseId: 'press', exerciseName: 'Press banca' },
      }),
    ).not.toThrow()
    expect(() =>
      reminderSchema.parse({ ...base, trigger: { type: 'beforeMuscle', muscle: 'quads' } }),
    ).not.toThrow()
  })

  it('rechaza mensajes vacíos', () => {
    expect(() =>
      reminderSchema.parse({ ...base, messages: [], trigger: { type: 'workoutStart' } }),
    ).toThrow()
    expect(() =>
      reminderSchema.parse({ ...base, messages: [''], trigger: { type: 'workoutStart' } }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/types.test.ts`
Expected: FAIL — `reminderSchema` not exported.

- [ ] **Step 3: Implement the schema** — in `src/domain/types.ts` after the Routines section:

```ts
/* -------------------------------- Reminders ------------------------------- */

export const reminderTriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('workoutStart') }),
  z.object({ type: z.literal('workoutFinish') }),
  z.object({
    type: z.literal('beforeExercise'),
    exerciseId: z.string(),
    /** Copy of the name: survives renames and retired exercises. */
    exerciseName: z.string(),
  }),
  z.object({ type: z.literal('beforeMuscle'), muscle: z.enum(muscleGroups) }),
])
export type ReminderTrigger = z.infer<typeof reminderTriggerSchema>

export const reminderSchema = z.object({
  enabled: z.boolean(),
  trigger: reminderTriggerSchema,
  /** Routines it applies to; null = every workout (freestyle included). */
  routineIds: z.array(z.string()).nullable(),
  /** One is shown at random each time it fires. */
  messages: z.array(z.string().min(1)).min(1),
  createdAt: z.instanceof(Timestamp),
})
export type Reminder = z.infer<typeof reminderSchema>
```

- [ ] **Step 4: Converter + refs** — in `src/data/converters.ts` add `reminderSchema` to the types import, then:

```ts
export const reminderConverter = converterFor(reminderSchema)

export const remindersCol = (uid: string) =>
  collection(db, 'users', uid, 'reminders').withConverter(reminderConverter)
export const reminderDoc = (uid: string, id: string) =>
  doc(db, 'users', uid, 'reminders', id).withConverter(reminderConverter)
```

- [ ] **Step 5: Firestore rules** — in `firestore.rules`, next to the `routines` match:

```
      match /reminders/{docId} {
        allow read, write: if isOwner(uid);
      }
```

- [ ] **Step 6: Locale namespace** — create `src/locales/es/reminders.json`:

```json
{
  "title": "Recordatorios",
  "add": "Nuevo recordatorio",
  "empty": {
    "title": "Sin recordatorios",
    "body": "Crea mensajes que aparecerán al entrenar: al empezar, al terminar o antes de un ejercicio."
  },
  "messageCount_one": "{{count}} mensaje",
  "messageCount_other": "{{count}} mensajes",
  "triggers": {
    "workoutStart": "Al empezar",
    "workoutFinish": "Al terminar",
    "beforeExercise": "Antes de {{name}}",
    "beforeMuscle": "Antes de {{muscle}}"
  },
  "overlay": {
    "label": "Recordatorio",
    "dismiss": "Toca para continuar"
  },
  "editor": {
    "titleNew": "Nuevo recordatorio",
    "titleEdit": "Editar recordatorio",
    "enabled": "Activo",
    "when": "Cuándo",
    "pickExercise": "Elegir ejercicio",
    "pickMuscle": "Grupo muscular",
    "routines": "Rutinas",
    "routinesHelp": "Sin selección se aplica a todos los entrenamientos.",
    "allRoutines": "Todos los entrenamientos",
    "messages": "Mensajes",
    "messagesHelp": "Si hay varios, cada vez se muestra uno al azar.",
    "messagePlaceholder": "Escribe tu mensaje…",
    "addMessage": "Añadir mensaje",
    "removeMessage": "Quitar mensaje",
    "packs": "Packs de mensajes",
    "packsHelp": "Añaden sus frases a la lista; luego edítalas a tu gusto.",
    "save": "Guardar",
    "delete": "Eliminar recordatorio",
    "deleteConfirm": "¿Eliminar este recordatorio?"
  },
  "packs": {
    "beast": {
      "name": "Modo bestia",
      "messages": [
        "FOCUS. Desde la primera rep hasta la última.",
        "No hay nadie más en el gym. Solo tú y el puto hierro.",
        "Nadie te mira. Nadie importa. APRIETA.",
        "No has venido a pasar el rato. Has venido a dejarlo todo.",
        "La última rep es donde empieza el crecimiento. VE A POR ELLA."
      ]
    },
    "focus": {
      "name": "Foco total",
      "messages": [
        "Respira. Técnica limpia. Presencia total.",
        "Cada rep con intención. Siente el músculo.",
        "Controla el peso. Que no te controle él a ti.",
        "El móvil puede esperar. Esta serie no."
      ]
    },
    "firstRep": {
      "name": "Primera rep, última rep",
      "messages": [
        "La primera rep con la misma seriedad que la última.",
        "Nada de reps basura. Cada serie cuenta.",
        "Si vas a hacerlo, hazlo de verdad.",
        "Deja el ego fuera: peso que puedas controlar, esfuerzo que no puedas fingir."
      ]
    },
    "closing": {
      "name": "Cierre",
      "messages": [
        "Has venido. Has trabajado. Eso ya te separa del 90%.",
        "Otro día que suma. La constancia es el verdadero PR.",
        "Hoy has ganado la batalla más difícil: aparecer.",
        "Descansa, come y vuelve. El progreso se cocina fuera del gym."
      ]
    }
  }
}
```

- [ ] **Step 7: Register the namespace** — in `src/i18n.ts` add `import reminders from './locales/es/reminders.json'` and add `reminders` to the `resources.es` object (typed keys flow automatically via `@types/i18next.d.ts`).

- [ ] **Step 8: Verify + commit**

Run: `pnpm typecheck && pnpm vitest run src/domain/types.test.ts`
Expected: PASS

```bash
git add -A && git commit -m "feat(reminders): schema, converter, rules and locale namespace"
```

---

### Task 2: pure trigger matching

**Files:**
- Create: `src/domain/reminders.ts`
- Test: `src/domain/reminders.test.ts`

**Interfaces:**
- Produces:
  - `type ReminderEvent = { kind: 'workoutStart' } | { kind: 'workoutFinish' } | { kind: 'exerciseTouched'; exerciseId: string; muscle: MuscleGroup }`
  - `interface ReminderContext { routineId: string | null; firedIds: ReadonlySet<string> }`
  - `matchReminders(reminders: WithId<Reminder>[], event: ReminderEvent, ctx: ReminderContext): WithId<Reminder>[]`
  - `pickMessage(messages: string[], rand: number): string | null` (rand ∈ [0,1))

- [ ] **Step 1: Write the failing test** — create `src/domain/reminders.test.ts`:

```ts
import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { matchReminders, pickMessage, type ReminderEvent } from './reminders'
import type { Reminder, ReminderTrigger, WithId } from './types'

const reminder = (
  id: string,
  trigger: ReminderTrigger,
  partial: Partial<Reminder> = {},
): WithId<Reminder> => ({
  id,
  enabled: true,
  trigger,
  routineIds: null,
  messages: ['FOCUS.'],
  createdAt: Timestamp.now(),
  ...partial,
})

const ctx = (over: Partial<{ routineId: string | null; firedIds: Set<string> }> = {}) => ({
  routineId: null,
  firedIds: new Set<string>(),
  ...over,
})

const touched: ReminderEvent = { kind: 'exerciseTouched', exerciseId: 'squat', muscle: 'quads' }

describe('matchReminders', () => {
  it('cada evento activa solo su tipo de disparador', () => {
    const all = [
      reminder('a', { type: 'workoutStart' }),
      reminder('b', { type: 'workoutFinish' }),
      reminder('c', { type: 'beforeExercise', exerciseId: 'squat', exerciseName: 'Sentadilla' }),
      reminder('d', { type: 'beforeMuscle', muscle: 'quads' }),
    ]
    expect(matchReminders(all, { kind: 'workoutStart' }, ctx()).map((r) => r.id)).toEqual(['a'])
    expect(matchReminders(all, { kind: 'workoutFinish' }, ctx()).map((r) => r.id)).toEqual(['b'])
    expect(matchReminders(all, touched, ctx()).map((r) => r.id)).toEqual(['c', 'd'])
  })

  it('no activa ejercicios ni músculos distintos', () => {
    const all = [
      reminder('c', { type: 'beforeExercise', exerciseId: 'press', exerciseName: 'Press' }),
      reminder('d', { type: 'beforeMuscle', muscle: 'chest' }),
    ]
    expect(matchReminders(all, touched, ctx())).toEqual([])
  })

  it('respeta enabled y los ya disparados', () => {
    const all = [
      reminder('a', { type: 'workoutStart' }, { enabled: false }),
      reminder('b', { type: 'workoutStart' }),
    ]
    expect(
      matchReminders(all, { kind: 'workoutStart' }, ctx({ firedIds: new Set(['b']) })),
    ).toEqual([])
  })

  it('filtro de rutinas: null aplica siempre; lista solo con la rutina activa', () => {
    const all = [
      reminder('a', { type: 'workoutStart' }, { routineIds: ['r1'] }),
      reminder('b', { type: 'workoutStart' }),
    ]
    expect(matchReminders(all, { kind: 'workoutStart' }, ctx()).map((r) => r.id)).toEqual(['b'])
    expect(
      matchReminders(all, { kind: 'workoutStart' }, ctx({ routineId: 'r1' })).map((r) => r.id),
    ).toEqual(['a', 'b'])
  })
})

describe('pickMessage', () => {
  it('elige por índice proporcional y tolera extremos', () => {
    expect(pickMessage(['a', 'b', 'c'], 0)).toBe('a')
    expect(pickMessage(['a', 'b', 'c'], 0.5)).toBe('b')
    expect(pickMessage(['a', 'b', 'c'], 0.999999)).toBe('c')
    expect(pickMessage(['a', 'b', 'c'], 1)).toBe('c')
    expect(pickMessage([], 0.5)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/reminders.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement** — create `src/domain/reminders.ts`:

```ts
import type { MuscleGroup, Reminder, WithId } from './types'

export type ReminderEvent =
  | { kind: 'workoutStart' }
  | { kind: 'workoutFinish' }
  | { kind: 'exerciseTouched'; exerciseId: string; muscle: MuscleGroup }

export interface ReminderContext {
  routineId: string | null
  /** Reminder ids already fired this session (each fires at most once). */
  firedIds: ReadonlySet<string>
}

/** Reminders that should fire for an event, honoring enabled/dedupe/routine filter. */
export function matchReminders(
  reminders: WithId<Reminder>[],
  event: ReminderEvent,
  ctx: ReminderContext,
): WithId<Reminder>[] {
  return reminders.filter((r) => {
    if (!r.enabled || ctx.firedIds.has(r.id)) return false
    if (r.routineIds != null && (ctx.routineId == null || !r.routineIds.includes(ctx.routineId)))
      return false
    switch (event.kind) {
      case 'workoutStart':
        return r.trigger.type === 'workoutStart'
      case 'workoutFinish':
        return r.trigger.type === 'workoutFinish'
      case 'exerciseTouched':
        return (
          (r.trigger.type === 'beforeExercise' && r.trigger.exerciseId === event.exerciseId) ||
          (r.trigger.type === 'beforeMuscle' && r.trigger.muscle === event.muscle)
        )
    }
  })
}

/** rand ∈ [0,1) — injected by the caller so the function stays pure. */
export function pickMessage(messages: string[], rand: number): string | null {
  if (messages.length === 0) return null
  const clamped = Math.min(Math.max(rand, 0), 1 - Number.EPSILON)
  return messages[Math.floor(clamped * messages.length)]
}
```

- [ ] **Step 4: Run tests + commit**

Run: `pnpm vitest run src/domain/reminders.test.ts`
Expected: PASS

```bash
git add -A && git commit -m "feat(domain): reminder trigger matching"
```

---

### Task 3: reminders store (queue + fired ids)

**Files:**
- Create: `src/store/reminders.ts`

**Interfaces:**
- Produces: `useRemindersStore` with `{ queue: string[]; workoutId: string | null; firedIds: string[]; enqueue(workoutId, firedIds, messages): void; dismissCurrent(): void; resetSession(): void }`. Only `workoutId`/`firedIds` persist.

- [ ] **Step 1: Implement** — create `src/store/reminders.ts`:

```ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/*
 * `queue` drives the full-screen overlay (ephemeral, not persisted).
 * `firedIds` per workout IS persisted: a mid-session reload must not refire
 * the same reminders. A new workout id resets the fired set.
 */
interface RemindersState {
  queue: string[]
  workoutId: string | null
  firedIds: string[]

  enqueue: (workoutId: string, firedIds: string[], messages: string[]) => void
  dismissCurrent: () => void
  /** On discard: forget the session's fired set (queue untouched). */
  resetSession: () => void
}

export const useRemindersStore = create<RemindersState>()(
  persist(
    (set, get) => ({
      queue: [],
      workoutId: null,
      firedIds: [],

      enqueue: (workoutId, firedIds, messages) => {
        const prev = get()
        const sameSession = prev.workoutId === workoutId
        set({
          workoutId,
          firedIds: sameSession ? [...prev.firedIds, ...firedIds] : firedIds,
          queue: [...prev.queue, ...messages],
        })
      },

      dismissCurrent: () => set((s) => ({ queue: s.queue.slice(1) })),

      resetSession: () => set({ workoutId: null, firedIds: [] }),
    }),
    {
      name: 'clenfit:reminders',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ workoutId: s.workoutId, firedIds: s.firedIds }) as RemindersState,
    },
  ),
)
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm typecheck`
Expected: PASS

```bash
git add -A && git commit -m "feat(reminders): overlay queue store with persisted fired ids"
```

---

### Task 4: full-screen overlay

**Files:**
- Create: `src/features/reminders/ReminderOverlay.tsx`
- Modify: `src/index.css` (keyframes at the end of the file)
- Modify: `src/app/AppLayout.tsx` (mount next to `<PwaUpdatePrompt />`)

**Interfaces:**
- Consumes: `useRemindersStore` (Task 3), i18n `reminders:overlay.*`.

- [ ] **Step 1: Create the component:**

```tsx
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRemindersStore } from '@/store/reminders'
import { cn } from '@/lib/utils'

/** Full-screen takeover: the message punches in word by word; tap to dismiss. */
export function ReminderOverlay() {
  const message = useRemindersStore((s) => s.queue[0] ?? null)
  const dismissCurrent = useRemindersStore((s) => s.dismissCurrent)
  const { t } = useTranslation('reminders')

  useEffect(() => {
    if (!message) return
    navigator.vibrate?.([80, 40, 120])
    // the keyboard must not sit on top of the takeover
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, [message])

  if (!message) return null
  const words = message.split(' ')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('overlay.label')}
      onClick={dismissCurrent}
      className="fixed inset-0 z-[100] flex cursor-pointer select-none flex-col items-center justify-center gap-12 bg-black/95 px-8"
    >
      <p
        key={message}
        className="max-w-lg text-center text-4xl font-black uppercase leading-tight tracking-tight text-white"
      >
        {words.map((word, i) => (
          <span key={i}>
            <span
              className={cn(
                'reminder-word inline-block',
                i === words.length - 1 && 'text-accent',
              )}
              style={{ animationDelay: `${Math.min(i * 130, 2600)}ms` }}
            >
              {word}
            </span>{' '}
          </span>
        ))}
      </p>
      <span
        className="reminder-word text-sm text-white/50"
        style={{ animationDelay: `${Math.min(words.length * 130 + 400, 3200)}ms` }}
      >
        {t('overlay.dismiss')}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Keyframes** — append to `src/index.css`:

```css
@keyframes reminder-word {
  from {
    opacity: 0;
    transform: translateY(0.35em) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.reminder-word {
  opacity: 0;
  animation: reminder-word 0.35s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .reminder-word {
    animation: none;
    opacity: 1;
  }
}
```

Note: `text-accent` must resolve — check `src/index.css` `@theme inline` block; if `accent` isn't mapped as a Tailwind color there, use `style={{ color: 'var(--accent)' }}` on the last word instead.

- [ ] **Step 3: Mount in `AppLayout`** — import and render `<ReminderOverlay />` directly after `<PwaUpdatePrompt />`.

- [ ] **Step 4: Verify + commit**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS

```bash
git add -A && git commit -m "feat(reminders): full-screen word-by-word overlay"
```

---

### Task 5: data layer — CRUD + live hook

**Files:**
- Create: `src/data/reminderMutations.ts`
- Modify: `src/data/hooks.ts` (add `useReminders`)

**Interfaces:**
- Consumes: `remindersCol`, `reminderDoc` (Task 1).
- Produces: `createReminder(uid, data: Omit<Reminder, 'createdAt'>): string`, `saveReminder(uid, reminder: WithId<Reminder>): void`, `deleteReminder(uid, id): void`, `useReminders(): WithId<Reminder>[] | undefined`.

- [ ] **Step 1: Create `src/data/reminderMutations.ts`:**

```ts
import { deleteDoc, doc, setDoc, Timestamp } from 'firebase/firestore'
import type { Reminder, WithId } from '@/domain/types'
import { reminderDoc, remindersCol } from './converters'

/** Creates a reminder (offline-safe: the write is not awaited). */
export function createReminder(uid: string, data: Omit<Reminder, 'createdAt'>): string {
  const ref = doc(remindersCol(uid))
  const reminder: WithId<Reminder> = { id: ref.id, ...data, createdAt: Timestamp.now() }
  setDoc(ref, reminder).catch((err) => console.error('[createReminder]', err))
  return ref.id
}

export function saveReminder(uid: string, reminder: WithId<Reminder>): void {
  setDoc(reminderDoc(uid, reminder.id), reminder).catch((err) =>
    console.error('[saveReminder]', err),
  )
}

export function deleteReminder(uid: string, id: string): void {
  deleteDoc(reminderDoc(uid, id)).catch((err) => console.error('[deleteReminder]', err))
}
```

- [ ] **Step 2: Hook** — in `src/data/hooks.ts`, add `Reminder` to the types import, `remindersCol` to the converters import, and:

```ts
export function useReminders(): WithId<Reminder>[] | undefined {
  const uid = useUser().uid
  return useLiveQuery(() => query(remindersCol(uid), orderBy('createdAt')), [uid])
}
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

```bash
git add -A && git commit -m "feat(reminders): CRUD mutations and live hook"
```

---

### Task 6: firing hook + session call sites

**Files:**
- Create: `src/features/reminders/useFireReminders.ts`
- Modify: `src/features/workout/useStartWorkout.ts` (fire on start)
- Modify: `src/features/workout/ActiveWorkoutScreen.tsx` (fire on finish + exercise touch; reset on discard)

**Interfaces:**
- Consumes: `matchReminders`, `pickMessage`, `ReminderEvent` (Task 2), `useReminders` (Task 5), `useRemindersStore` (Task 3).
- Produces: `useFireReminders(): (event: ReminderEvent, workout: { id: string; routineId: string | null }) => void`

- [ ] **Step 1: Create `src/features/reminders/useFireReminders.ts`:**

```ts
import { useReminders } from '@/data/hooks'
import { matchReminders, pickMessage, type ReminderEvent } from '@/domain/reminders'
import { useRemindersStore } from '@/store/reminders'

/** Evaluates an event against the user's reminders and queues the overlay. */
export function useFireReminders() {
  const reminders = useReminders()

  return function fire(event: ReminderEvent, workout: { id: string; routineId: string | null }) {
    if (!reminders?.length) return
    const state = useRemindersStore.getState()
    const firedIds = new Set(state.workoutId === workout.id ? state.firedIds : [])
    const matched = matchReminders(reminders, event, { routineId: workout.routineId, firedIds })
    if (matched.length === 0) return
    const messages = matched
      .map((r) => pickMessage(r.messages, Math.random()))
      .filter((m): m is string => m != null)
    state.enqueue(
      workout.id,
      matched.map((r) => r.id),
      messages,
    )
  }
}
```

- [ ] **Step 2: Fire on start** — in `useStartWorkout.ts`:

```ts
import { useFireReminders } from '@/features/reminders/useFireReminders'
// inside the hook:
const fire = useFireReminders()
// in startAndGo:
  function startAndGo(routine?: WithId<Routine>) {
    if (!workout) {
      start(uid, t('free'), routine, (id) => byId.get(id), profile?.settings.bodyWeightKg ?? null)
      const started = useActiveWorkoutStore.getState().workout
      if (started) fire({ kind: 'workoutStart' }, { id: started.id, routineId: started.routineId })
    }
    navigate('/entrenamiento')
  }
```

(resuming an existing session fires nothing — correct: it already fired when it started.)

- [ ] **Step 3: Fire on finish + touch, reset on discard** — in `ActiveWorkoutScreen.tsx`:

```ts
const fire = useFireReminders()
```

In `confirmFinish`, right after `useRestTimerStore.getState().stop()`:

```ts
    fire({ kind: 'workoutFinish' }, { id: result.workout.id, routineId: result.workout.routineId })
    useRemindersStore.getState().resetSession()
```

CAREFUL — order: `fire` enqueues using the finished workout's id (fresh fired-set is fine since the session is over) and `resetSession` clears `firedIds` but NOT the queue, so the overlay still shows after navigation.

In the discard `ConfirmDialog`'s `onConfirm`, add `useRemindersStore.getState().resetSession()`.

Add the touch handler:

```ts
  /** First interaction with an exercise card = "about to start it". */
  function touchExercise(exIndex: number) {
    if (!workout) return
    const ex = workout.exercises[exIndex]
    fire(
      { kind: 'exerciseTouched', exerciseId: ex.exerciseId, muscle: ex.muscle },
      { id: workout.id, routineId: workout.routineId },
    )
  }
```

Wire it: wrap each `<ExerciseCard …/>` in the map with a focus-capturing div (move the `key` to the wrapper):

```tsx
          {workout.exercises.map((ex, i) => (
            <div key={`${ex.exerciseId}-${i}`} onFocusCapture={() => touchExercise(i)}>
              <ExerciseCard
                …existing props, without key…
              />
            </div>
          ))}
```

And call `touchExercise(exIndex)` at the top of the completing branch of `completeSet` (after the `set.completed` early-return), so checking a set without focusing an input also counts as the first touch.

(dedupe: repeat focus events re-run `matchReminders`, but `firedIds` makes them no-ops.)

- [ ] **Step 4: Verify + commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS

```bash
git add -A && git commit -m "feat(reminders): fire on start/finish/exercise touch"
```

---

### Task 7: list screen, routes, settings entry

**Files:**
- Create: `src/features/reminders/RemindersScreen.tsx`
- Modify: `src/app/router.tsx` (only the `/recordatorios` list route; Task 8 adds the two editor routes)
- Modify: `src/features/settings/SettingsScreen.tsx` (entry section)
- Modify: `src/locales/es/settings.json`

**Interfaces:**
- Consumes: `useReminders`, `saveReminder` (Task 5), i18n `reminders:*`, `exercises:muscle.*`.

- [ ] **Step 1: Create `RemindersScreen.tsx`:**

```tsx
import { Link } from 'react-router'
import { BellRing, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { BackButton } from '@/components/ui/BackButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useReminders } from '@/data/hooks'
import { saveReminder } from '@/data/reminderMutations'
import type { Reminder, WithId } from '@/domain/types'

export function RemindersScreen() {
  const uid = useUser().uid
  const { t } = useTranslation(['reminders', 'common'])
  const reminders = useReminders()

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header className="flex items-center gap-2">
        <BackButton fallback="/ajustes" />
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{t('reminders:title')}</h1>
        <Link
          to="/recordatorios/nuevo"
          aria-label={t('reminders:add')}
          className="flex size-10 items-center justify-center rounded-card bg-accent text-on-accent"
        >
          <Plus className="size-5" />
        </Link>
      </header>

      {reminders === undefined ? (
        <p className="pt-10 text-center text-ink-3">{t('common:loading')}</p>
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title={t('reminders:empty.title')}
          body={t('reminders:empty.body')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {reminders.map((r) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              onToggle={(enabled) => saveReminder(uid, { ...r, enabled })}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Shared by the list and the editor header: human trigger label. */
export function triggerLabel(
  trigger: Reminder['trigger'],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  switch (trigger.type) {
    case 'beforeExercise':
      return t('reminders:triggers.beforeExercise', { name: trigger.exerciseName })
    case 'beforeMuscle':
      return t('reminders:triggers.beforeMuscle', {
        muscle: t(`exercises:muscle.${trigger.muscle}`),
      })
    default:
      return t(`reminders:triggers.${trigger.type}`)
  }
}

function ReminderRow({
  reminder,
  onToggle,
}: {
  reminder: WithId<Reminder>
  onToggle: (enabled: boolean) => void
}) {
  const { t } = useTranslation(['reminders', 'exercises'])

  return (
    <li className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-3">
      <Link to={`/recordatorios/${reminder.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{triggerLabel(reminder.trigger, t)}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">
          {t('reminders:messageCount', { count: reminder.messages.length })} · «
          {reminder.messages[0]}»
        </p>
      </Link>
      <input
        type="checkbox"
        checked={reminder.enabled}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={t('reminders:editor.enabled')}
        className="size-5 shrink-0 accent-(--accent)"
      />
    </li>
  )
}
```

Note: if `t`'s typed signature rejects the loose `triggerLabel` helper typing, type the parameter as the `TFunction` from `i18next` (`import type { TFunction } from 'i18next'`) with namespaces `['reminders', 'exercises']`.

- [ ] **Step 2: Route** — in `src/app/router.tsx` add `import { RemindersScreen } from '@/features/reminders/RemindersScreen'` and, after the `/ajustes` route:

```tsx
              { path: '/recordatorios', element: <RemindersScreen /> },
```

- [ ] **Step 3: Settings entry** — `src/locales/es/settings.json` add:

```json
  "reminders": {
    "title": "Recordatorios",
    "help": "Mensajes motivacionales al empezar, al terminar o antes de un ejercicio.",
    "manage": "Gestionar recordatorios"
  }
```

In `SettingsScreen.tsx`, add a section between the body-weight section and `<InstallSection />` (import `Link` from `react-router` and `BellRing` from lucide):

```tsx
      <Section title={t('settings:reminders.title')} help={t('settings:reminders.help')}>
        <Link
          to="/recordatorios"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-card bg-surface-2 font-medium"
        >
          <BellRing className="size-4" />
          {t('settings:reminders.manage')}
        </Link>
      </Section>
```

- [ ] **Step 4: Verify + commit**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS

```bash
git add -A && git commit -m "feat(reminders): list screen and settings entry"
```

---

### Task 8: editor screen

**Files:**
- Create: `src/features/reminders/ReminderEditorScreen.tsx`
- Modify: `src/app/router.tsx` (two editor routes)

**Interfaces:**
- Consumes: `createReminder`, `saveReminder`, `deleteReminder`, `useReminders`, `useRoutines`, `ExercisePicker` (props: `open`, `onOpenChange`, `title`, `onSelect(def: ExerciseDef)`), `Chip`, `ConfirmDialog`, `triggerLabel` (Task 7), i18n packs via `returnObjects`.

- [ ] **Step 1: Create `ReminderEditorScreen.tsx`:**

```tsx
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { BackButton } from '@/components/ui/BackButton'
import { Chip } from '@/components/ui/Chip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useReminders, useRoutines } from '@/data/hooks'
import { createReminder, deleteReminder, saveReminder } from '@/data/reminderMutations'
import { muscleGroups, type MuscleGroup, type ReminderTrigger } from '@/domain/types'
import { ExercisePicker } from '@/features/exercises/ExercisePicker'
import { cn } from '@/lib/utils'

const packKeys = ['beast', 'focus', 'firstRep', 'closing'] as const

const triggerTypes = ['workoutStart', 'workoutFinish', 'beforeExercise', 'beforeMuscle'] as const
type TriggerType = (typeof triggerTypes)[number]

export function ReminderEditorScreen() {
  const { reminderId } = useParams()
  const uid = useUser().uid
  const navigate = useNavigate()
  const { t } = useTranslation(['reminders', 'exercises', 'common'])
  const reminders = useReminders()
  const routines = useRoutines()

  const existing = useMemo(
    () => reminders?.find((r) => r.id === reminderId) ?? null,
    [reminders, reminderId],
  )

  // editor state, hydrated once from the existing doc
  const [hydrated, setHydrated] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [triggerType, setTriggerType] = useState<TriggerType>('workoutStart')
  const [exercise, setExercise] = useState<{ id: string; name: string } | null>(null)
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [routineIds, setRoutineIds] = useState<string[] | null>(null)
  const [messages, setMessages] = useState<string[]>([''])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (existing && !hydrated) {
    setHydrated(true)
    setEnabled(existing.enabled)
    setTriggerType(existing.trigger.type)
    if (existing.trigger.type === 'beforeExercise')
      setExercise({ id: existing.trigger.exerciseId, name: existing.trigger.exerciseName })
    if (existing.trigger.type === 'beforeMuscle') setMuscle(existing.trigger.muscle)
    setRoutineIds(existing.routineIds)
    setMessages(existing.messages)
  }

  const cleanMessages = messages.map((m) => m.trim()).filter((m) => m.length > 0)
  const canSave =
    cleanMessages.length > 0 && (triggerType !== 'beforeExercise' || exercise != null)

  function buildTrigger(): ReminderTrigger {
    switch (triggerType) {
      case 'beforeExercise':
        return { type: 'beforeExercise', exerciseId: exercise!.id, exerciseName: exercise!.name }
      case 'beforeMuscle':
        return { type: 'beforeMuscle', muscle }
      default:
        return { type: triggerType }
    }
  }

  function save() {
    const data = { enabled, trigger: buildTrigger(), routineIds, messages: cleanMessages }
    if (existing) saveReminder(uid, { ...existing, ...data })
    else createReminder(uid, data)
    navigate('/recordatorios', { replace: true })
  }

  function addPack(key: (typeof packKeys)[number]) {
    const lines = t(`reminders:packs.${key}.messages`, { returnObjects: true }) as string[]
    setMessages((prev) => [...prev.filter((m) => m.trim().length > 0), ...lines])
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header className="flex items-center gap-2">
        <BackButton fallback="/recordatorios" />
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">
          {existing ? t('reminders:editor.titleEdit') : t('reminders:editor.titleNew')}
        </h1>
        {existing && (
          <button
            type="button"
            aria-label={t('reminders:editor.delete')}
            onClick={() => setDeleting(true)}
            className="flex size-10 items-center justify-center rounded-card border border-hairline text-status-over"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <label className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-3">
        <span className="text-sm font-medium">{t('reminders:editor.enabled')}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-5 accent-(--accent)"
        />
      </label>

      <Field title={t('reminders:editor.when')}>
        <div className="grid grid-cols-2 gap-2">
          {triggerTypes.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={triggerType === type}
              onClick={() => setTriggerType(type)}
              className={cn(
                'h-11 rounded-card border px-2 text-sm font-medium',
                triggerType === type
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-hairline bg-surface text-ink-2',
              )}
            >
              {type === 'beforeExercise'
                ? t('reminders:editor.pickExercise')
                : type === 'beforeMuscle'
                  ? t('reminders:editor.pickMuscle')
                  : t(`reminders:triggers.${type}`)}
            </button>
          ))}
        </div>

        {triggerType === 'beforeExercise' && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-card bg-surface-2 text-sm font-medium"
          >
            {exercise ? exercise.name : t('reminders:editor.pickExercise')}
          </button>
        )}

        {triggerType === 'beforeMuscle' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {muscleGroups.map((m) => (
              <Chip
                key={m}
                label={t(`exercises:muscle.${m}`)}
                active={muscle === m}
                onClick={() => setMuscle(m)}
              />
            ))}
          </div>
        )}
      </Field>

      <Field title={t('reminders:editor.routines')} help={t('reminders:editor.routinesHelp')}>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            checked={routineIds == null}
            onChange={(e) => setRoutineIds(e.target.checked ? null : [])}
            className="size-5 accent-(--accent)"
          />
          <span className="text-sm font-medium">{t('reminders:editor.allRoutines')}</span>
        </label>
        {routineIds != null &&
          (routines ?? []).map((r) => (
            <label key={r.id} className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={routineIds.includes(r.id)}
                onChange={(e) =>
                  setRoutineIds(
                    e.target.checked
                      ? [...routineIds, r.id]
                      : routineIds.filter((id) => id !== r.id),
                  )
                }
                className="size-5 accent-(--accent)"
              />
              <span className="text-sm">{r.name}</span>
            </label>
          ))}
      </Field>

      <Field title={t('reminders:editor.messages')} help={t('reminders:editor.messagesHelp')}>
        <div className="flex flex-col gap-2">
          {messages.map((message, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                value={message}
                onChange={(e) =>
                  setMessages((prev) => prev.map((m, j) => (j === i ? e.target.value : m)))
                }
                placeholder={t('reminders:editor.messagePlaceholder')}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-card border border-hairline bg-surface-2 p-2.5 text-sm outline-none focus:border-accent"
              />
              {messages.length > 1 && (
                <button
                  type="button"
                  aria-label={t('reminders:editor.removeMessage')}
                  onClick={() => setMessages((prev) => prev.filter((_, j) => j !== i))}
                  className="flex size-9 shrink-0 items-center justify-center rounded-card text-ink-3 active:bg-surface-2"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMessages((prev) => [...prev, ''])}
            className="flex h-10 items-center justify-center gap-1.5 rounded-card bg-surface-2 text-sm font-medium text-ink-2"
          >
            <Plus className="size-4" />
            {t('reminders:editor.addMessage')}
          </button>
        </div>

        <p className="mt-3 pb-1 text-xs font-medium text-ink-3">
          {t('reminders:editor.packs')} · {t('reminders:editor.packsHelp')}
        </p>
        <div className="flex flex-wrap gap-2">
          {packKeys.map((key) => (
            <Chip
              key={key}
              label={t(`reminders:packs.${key}.name`)}
              active={false}
              onClick={() => addPack(key)}
            />
          ))}
        </div>
      </Field>

      <button
        type="button"
        disabled={!canSave}
        onClick={save}
        className="h-12 rounded-card bg-accent font-semibold text-on-accent disabled:opacity-60"
      >
        {t('reminders:editor.save')}
      </button>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('reminders:editor.pickExercise')}
        onSelect={(def) => {
          setExercise({ id: def.id, name: def.name })
          setPickerOpen(false)
        }}
      />

      <ConfirmDialog
        open={deleting}
        title={t('reminders:editor.delete')}
        body={t('reminders:editor.deleteConfirm')}
        onConfirm={() => {
          if (existing) deleteReminder(uid, existing.id)
          navigate('/recordatorios', { replace: true })
        }}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}

function Field({
  title,
  help,
  children,
}: {
  title: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-3">
      <h2 className="pb-2 text-sm font-semibold">{title}</h2>
      {children}
      {help && <p className="mt-2 text-xs text-ink-3">{help}</p>}
    </section>
  )
}
```

CAREFUL: check `ExercisePicker`'s actual props before wiring (`src/features/exercises/ExercisePicker.tsx`) — `ActiveWorkoutScreen` uses `open`, `onOpenChange`, `title`, `onSelect`; if `onSelect` already closes the picker internally, drop the manual `setPickerOpen(false)`.

- [ ] **Step 2: Routes** — in `src/app/router.tsx`:

```tsx
import { ReminderEditorScreen } from '@/features/reminders/ReminderEditorScreen'
// after the /recordatorios route:
              { path: '/recordatorios/nuevo', element: <ReminderEditorScreen /> },
              { path: '/recordatorios/:reminderId', element: <ReminderEditorScreen /> },
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS

```bash
git add -A && git commit -m "feat(reminders): reminder editor with packs, routine filter and triggers"
```

---

### Task 9: rules deploy + final gate

- [ ] **Step 1: Full quality gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 2: Deploy Firestore rules** (the new `reminders` subcollection is default-denied until deployed; additive change, low risk):

```bash
firebase deploy --only firestore:rules
```

If the CLI is not authenticated in this environment, flag it to the user instead of failing the plan.

- [ ] **Step 3: Manual smoke test note** — with `pnpm dev` + `pnpm emulators`: create a "Modo bestia" workoutStart reminder, start a workout → overlay appears word by word, tap dismisses; reload mid-session → no refire.
