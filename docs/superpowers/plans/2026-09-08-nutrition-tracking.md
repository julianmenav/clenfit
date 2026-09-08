# Daily Nutrition Tracking («Comida») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A «Comida» tab where the user logs what they eat per day against a daily kcal (and optional protein/carbs/fat) goal, sees the remaining kcal, the protein index, a Mon–Sun strip of the week and the week's average per logged day, and re-logs frequent foods from a personal library.

**Architecture:** Two new subcollections under `users/{uid}`: `foods` (personal library, per 100 g or per unit) and `nutritionDays` (one doc per local day, id = `YYYY-MM-DD`, entries embedded as an array, goal snapshotted). All arithmetic (entry macros, sums, protein index, week averages, food ranking) is pure in `src/domain/nutrition.ts`. UI in `src/features/nutrition/` with the existing `Sheet`/`NumericField`/`KebabMenu` primitives. The never-used train button leaves the mobile bar and «Comida» takes the center slot.

**Tech Stack:** React 19 + TypeScript, zod v4, Firestore (offline-safe fire-and-forget writes), i18next (es), date-fns, vitest, Tailwind v4 CSS-first with semantic tokens.

## Global Constraints

- App UI text is 100% Spanish via i18next (`src/locales/es/*.json`) — never hardcode text in components. Developer-facing text (comments, commits, docs) in English. Test descriptions in Spanish (matches `src/domain/*.test.ts`).
- `src/domain/` is pure: no Firebase imports (except the `Timestamp` type in `types.ts`); every module has a colocated test. Domain functions that need calendar math receive the date keys from the caller (see `bucketedTotals` in `analytics.ts`).
- Missing measurement fields = `null`, never `undefined` (Firestore rejects them; entries live inside arrays). Only `kcal` is required on goals, foods and entries; `protein`, `carbs`, `fat` are `number | null`.
- Entries snapshot the food's base macros (`per`); editing/deleting a library food never changes past days. Totals are derived, never stored.
- Firestore writes: not awaited, `.catch((err) => console.error('[fn]', err))`, like `reminderMutations.ts`.
- Routes in Spanish: `/comida`, `/comida/alimentos`.
- Style: Tailwind v4 semantic tokens only (`bg-surface`, `bg-surface-2`, `border-hairline`, `text-ink`, `text-ink-2`, `text-ink-3`, `bg-accent`, `text-on-accent`, `text-status-ok`, `text-status-over`, `rounded-card`, `rounded-chip`). No raw colors.
- Quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Commit after every task (Juli wants one commit per feature step). Commit trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ab5ve9vwh6X26m9eGc2ygK
  ```

## File Structure

| File | Responsibility |
| --- | --- |
| `src/domain/types.ts` | `macrosSchema`, `foodSchema`, `foodEntrySchema`, `nutritionDaySchema`, `settings.nutritionGoal` |
| `src/domain/nutrition.ts` (+ test) | Pure math: entry macros, sums, protein index, remaining, week summary, goal-for-day, food ranking |
| `src/lib/dates.ts` (+ test) | `weekDayKeys`, `weekdayInitial` |
| `src/data/converters.ts` | `foodsCol/foodDoc`, `nutritionDaysCol/nutritionDayDoc` |
| `src/data/hooks.ts` | `useFoods()`, `useNutritionWeek(weekStart)` |
| `src/data/nutritionMutations.ts` | `addEntry`, `updateEntry`, `removeEntry`, `createFood`, `saveFood`, `deleteFood`, `newEntryId` |
| `firestore.rules` | owner rules for the two subcollections |
| `src/locales/es/nutrition.json`, `common.json`, `settings.json`, `src/i18n.ts` | copy + namespace registration |
| `src/features/settings/SettingsScreen.tsx` | «Nutrición» goal section |
| `src/components/ui/WeekPager.tsx` | shared Mon–Sun stepper (extracted from Analytics) |
| `src/features/nutrition/format.ts` | number/label formatting for kcal, grams, amounts, index |
| `src/features/nutrition/NutritionScreen.tsx` | `/comida`: pager, strip, week line, day card, entries, sheets |
| `src/features/nutrition/WeekStrip.tsx` | seven day cells with kcal bars |
| `src/features/nutrition/DayCard.tsx` | eaten / goal / remaining / index card |
| `src/features/nutrition/FoodForm.tsx` | food fields form + `FoodDraft` helpers (new food & library edit) |
| `src/features/nutrition/FoodListRow.tsx` | one library food row (add sheet + library screen) |
| `src/features/nutrition/AddEntrySheet.tsx` | search → amount, or new food → amount |
| `src/features/nutrition/EditEntrySheet.tsx` | change amount / delete an entry |
| `src/features/nutrition/FoodsScreen.tsx` | `/comida/alimentos`: library list, edit, delete |
| `src/app/AppLayout.tsx`, `src/app/router.tsx` | nav + routes |

---

### Task 1: schemas, settings goal, converters, rules, locale namespace

**Files:**
- Modify: `src/domain/types.ts` (new Nutrition section before «User profile»; `userSettingsSchema`; `defaultSettings`)
- Modify: `src/data/converters.ts`
- Modify: `firestore.rules`
- Create: `src/locales/es/nutrition.json`
- Modify: `src/locales/es/common.json`, `src/locales/es/settings.json`, `src/i18n.ts`
- Test: `src/domain/types.test.ts`

**Interfaces:**
- Produces: `macrosSchema`, `Macros`, `foodKinds`, `FoodKind`, `foodSchema`, `Food`, `foodEntrySchema`, `FoodEntry`, `nutritionDaySchema`, `NutritionDay`; `UserSettings.nutritionGoal: Macros | null`; `foodsCol(uid)`, `foodDoc(uid, id)`, `nutritionDaysCol(uid)`, `nutritionDayDoc(uid, dateKey)`; i18n namespace `nutrition` and keys `common:nav.nutrition`, `common:units.g`, `common:units.kcal`, `settings:nutrition.*`.

- [ ] **Step 1: Write the failing test** — append to `src/domain/types.test.ts` (extend the import from `./types` with `foodEntrySchema, macrosSchema, nutritionDaySchema, userSettingsSchema`):

```ts
describe('nutrición: esquemas', () => {
  const entry = {
    id: 'e1',
    foodId: null,
    name: 'Huevo',
    kind: 'perUnit',
    unitLabel: 'huevo',
    amount: 2,
    per: { kcal: 70, protein: 6, carbs: null, fat: null },
  }

  it('macrosSchema exige kcal y admite null (nunca undefined) en el resto', () => {
    expect(macrosSchema.parse({ kcal: 100, protein: null, carbs: null, fat: null }).protein).toBeNull()
    expect(() => macrosSchema.parse({ kcal: 100, protein: undefined, carbs: null, fat: null })).toThrow()
    expect(() => macrosSchema.parse({ protein: 10, carbs: null, fat: null })).toThrow()
  })

  it('foodEntrySchema exige una cantidad positiva', () => {
    expect(() => foodEntrySchema.parse(entry)).not.toThrow()
    expect(() => foodEntrySchema.parse({ ...entry, amount: 0 })).toThrow()
  })

  it('nutritionDaySchema guarda el objetivo del día y las entradas', () => {
    const parsed = nutritionDaySchema.parse({
      dateKey: '2026-09-08',
      goal: { kcal: 1850, protein: 100, carbs: null, fat: null },
      entries: [entry],
      updatedAt: Timestamp.now(),
    })
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.goal.kcal).toBe(1850)
  })

  it('los perfiles antiguos sin nutritionGoal parsean con null', () => {
    const parsed = userSettingsSchema.parse({
      theme: 'system',
      restTimer: { enabled: true, defaultSeconds: 90 },
      oneRmFormula: 'epley',
    })
    expect(parsed.nutritionGoal).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/domain/types.test.ts`
Expected: FAIL — `macrosSchema` is not exported.

- [ ] **Step 3: Add the schemas** — in `src/domain/types.ts`, insert before the `/* --- User profile --- */` section:

```ts
/* -------------------------------- Nutrition ------------------------------- */

/** kcal is always known; the other three are optional data (null = not tracked). */
export const macrosSchema = z.object({
  kcal: z.number(),
  protein: z.number().nullable(),
  carbs: z.number().nullable(),
  fat: z.number().nullable(),
})
export type Macros = z.infer<typeof macrosSchema>

export const foodKinds = ['per100g', 'perUnit'] as const
export type FoodKind = (typeof foodKinds)[number]

/** Personal food library entry (users/{uid}/foods). */
export const foodSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(foodKinds),
  /** «huevo», «lata», «rebanada»… only meaningful for perUnit; null otherwise. */
  unitLabel: z.string().nullable(),
  /** Per 100 g (per100g) or per unit (perUnit). */
  per: macrosSchema,
  /** Prefill for the next log of this food. */
  lastAmount: z.number().nullable(),
  useCount: z.number().int(),
  lastUsedAt: z.instanceof(Timestamp).nullable(),
  createdAt: z.instanceof(Timestamp),
})
export type Food = z.infer<typeof foodSchema>

/** One logged item inside a day. Snapshots the food's base macros. */
export const foodEntrySchema = z.object({
  id: z.string(),
  /** Library food it came from; null for one-off entries (or deleted foods). */
  foodId: z.string().nullable(),
  name: z.string().min(1),
  kind: z.enum(foodKinds),
  unitLabel: z.string().nullable(),
  /** Grams for per100g, units (decimals allowed) for perUnit. */
  amount: z.number().positive(),
  /** Snapshot of the food's per-100g / per-unit macros at logging time. */
  per: macrosSchema,
})
export type FoodEntry = z.infer<typeof foodEntrySchema>

/** One doc per local day (users/{uid}/nutritionDays/{dateKey}). */
export const nutritionDaySchema = z.object({
  dateKey: z.string(),
  /** Goal in force when the day was last written (past days keep theirs). */
  goal: macrosSchema,
  entries: z.array(foodEntrySchema),
  updatedAt: z.instanceof(Timestamp),
})
export type NutritionDay = z.infer<typeof nutritionDaySchema>
```

Then in `userSettingsSchema` add after `bodyWeightKg`:

```ts
  /** Daily nutrition goal; null until set. kcal 0 also means «not set» (see hasGoal). */
  nutritionGoal: macrosSchema.nullable().default(null),
```

and in `defaultSettings` add `nutritionGoal: null,`.

- [ ] **Step 4: Converters + refs** — in `src/data/converters.ts` add `foodSchema, nutritionDaySchema` to the `@/domain/types` import, then after the reminder refs:

```ts
export const foodConverter = converterFor(foodSchema)
export const nutritionDayConverter = converterFor(nutritionDaySchema)

export const foodsCol = (uid: string) =>
  collection(db, 'users', uid, 'foods').withConverter(foodConverter)
export const foodDoc = (uid: string, id: string) =>
  doc(db, 'users', uid, 'foods', id).withConverter(foodConverter)

/** Day docs are keyed by the local date ('YYYY-MM-DD'). */
export const nutritionDaysCol = (uid: string) =>
  collection(db, 'users', uid, 'nutritionDays').withConverter(nutritionDayConverter)
export const nutritionDayDoc = (uid: string, dateKey: string) =>
  doc(db, 'users', uid, 'nutritionDays', dateKey).withConverter(nutritionDayConverter)
```

- [ ] **Step 5: Firestore rules** — in `firestore.rules`, after the `reminders` match:

```
      match /foods/{docId} {
        allow read, write: if isOwner(uid);
      }
      match /nutritionDays/{docId} {
        allow read, write: if isOwner(uid);
      }
```

- [ ] **Step 6: Locale** — create `src/locales/es/nutrition.json`:

```json
{
  "title": "Comida",
  "week": {
    "current": "Esta semana",
    "prev": "Semana anterior",
    "next": "Semana siguiente",
    "average": "Media/día",
    "balance": "Balance semanal",
    "noData": "Sin registros esta semana"
  },
  "day": {
    "eaten": "Comido",
    "of": "de {{goal}}",
    "remaining": "Te quedan {{kcal}} kcal",
    "over": "Te has pasado {{kcal}} kcal",
    "index": "Índice proteico",
    "empty": "Nada registrado todavía. Añade lo primero que hayas comido.",
    "future": "Todavía no ha llegado este día."
  },
  "macros": {
    "kcal": "kcal",
    "protein": "Proteínas",
    "carbs": "Hidratos",
    "fat": "Grasas",
    "proteinShort": "prot"
  },
  "add": "Añadir",
  "addSheet": {
    "title": "Añadir comida",
    "searchPlaceholder": "Buscar en mis alimentos…",
    "newFood": "Nuevo alimento",
    "newFoodNamed": "Nuevo alimento «{{name}}»",
    "noMatches": "Ningún alimento guardado coincide.",
    "noFoods": "Aún no tienes alimentos guardados: crea el primero.",
    "amount": "Cantidad",
    "back": "Volver a buscar"
  },
  "form": {
    "name": "Nombre",
    "namePlaceholder": "Pechuga de pollo, Atún en lata…",
    "kind": "Valores por",
    "per100g": "100 g",
    "perUnit": "Unidad",
    "unitLabel": "Nombre de la unidad",
    "unitLabelPlaceholder": "huevo, lata, rebanada…",
    "kcal": "Calorías",
    "protein": "Proteínas",
    "carbs": "Hidratos",
    "fat": "Grasas",
    "optional": "opcional",
    "amountEaten": "Cantidad que has comido",
    "unitShort": "ud",
    "saveToLibrary": "Guardar en mis alimentos"
  },
  "preview": {
    "full": "{{kcal}} kcal · {{protein}} g prot",
    "kcalOnly": "{{kcal}} kcal"
  },
  "entry": {
    "editTitle": "Editar entrada",
    "delete": "Eliminar entrada",
    "deleteBody": "Se quitará de este día. El alimento guardado no cambia.",
    "amountGrams": "{{amount}} g",
    "amountUnits": "{{amount}} × {{unit}}",
    "amountUnitsBare": "{{amount}} ud"
  },
  "library": {
    "title": "Mis alimentos",
    "searchPlaceholder": "Buscar…",
    "empty": {
      "title": "Aún no has guardado alimentos",
      "body": "Marca «Guardar en mis alimentos» al añadir una comida y aparecerá aquí."
    },
    "noMatches": "Ningún alimento coincide.",
    "editTitle": "Editar alimento",
    "delete": "Eliminar alimento",
    "deleteBody": "Las entradas ya registradas no cambian.",
    "perBase100g": "por 100 g",
    "perBaseUnit": "por {{unit}}",
    "perBaseUnitBare": "por unidad",
    "usedTimes_one": "{{count}} vez",
    "usedTimes_other": "{{count}} veces"
  },
  "menu": {
    "library": "Mis alimentos",
    "goals": "Objetivos"
  },
  "noGoal": {
    "title": "Define tu objetivo diario",
    "body": "Necesitas al menos las calorías diarias para empezar a registrar lo que comes.",
    "action": "Ir a ajustes"
  }
}
```

In `src/locales/es/common.json` add `"nutrition": "Comida"` inside `nav` (after `"exercises"`), and inside `units` add `"g": "g"` and `"kcal": "kcal"`.

In `src/locales/es/settings.json` add after the `bodyWeight` block:

```json
  "nutrition": {
    "title": "Nutrición",
    "help": "Objetivo diario. Las calorías son obligatorias; el resto es opcional y solo se muestra si lo rellenas.",
    "kcal": "Calorías",
    "protein": "Proteínas",
    "carbs": "Hidratos",
    "fat": "Grasas",
    "optional": "opcional"
  },
```

In `src/i18n.ts` add `import nutrition from './locales/es/nutrition.json'` and `nutrition` to the `resources.es` object.

- [ ] **Step 7: Run the test and the typecheck**

Run: `pnpm vitest run src/domain/types.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/domain/types.ts src/domain/types.test.ts src/data/converters.ts firestore.rules src/locales/es/nutrition.json src/locales/es/common.json src/locales/es/settings.json src/i18n.ts
git commit -m "feat(nutrition): schemas, converters, rules and locale namespace"
```

---

### Task 2: domain core — entry macros, sums, protein index, remaining

**Files:**
- Create: `src/domain/nutrition.ts`
- Test: `src/domain/nutrition.test.ts`

**Interfaces:**
- Consumes: `Macros`, `FoodEntry` (Task 1).
- Produces: `entryMacros(entry: Pick<FoodEntry, 'kind' | 'amount' | 'per'>): Macros`, `sumMacros(list: readonly Macros[]): Macros`, `dayTotals(entries: readonly FoodEntry[]): Macros`, `proteinIndex(m: Macros, goal: Macros): number | null`, `remaining(goal: Macros, eaten: Macros): Macros`, `hasGoal(goal: Macros | null | undefined): goal is Macros`, `EMPTY_MACROS: Macros`.

- [ ] **Step 1: Write the failing tests** — create `src/domain/nutrition.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { dayTotals, entryMacros, hasGoal, proteinIndex, remaining, sumMacros } from './nutrition'
import type { FoodEntry, Macros } from './types'

const m = (
  kcal: number,
  protein: number | null = null,
  carbs: number | null = null,
  fat: number | null = null,
): Macros => ({ kcal, protein, carbs, fat })

const goal = m(2000, 150)

const entry = (
  kind: FoodEntry['kind'],
  amount: number,
  per: Macros,
  over: Partial<FoodEntry> = {},
): FoodEntry => ({
  id: 'e',
  foodId: null,
  name: 'Algo',
  kind,
  unitLabel: null,
  amount,
  per,
  ...over,
})

describe('entryMacros', () => {
  it('por 100 g escala por gramos/100', () => {
    expect(entryMacros(entry('per100g', 150, m(100, 20, 10, 2)))).toEqual(m(150, 30, 15, 3))
  })

  it('por unidad multiplica por las unidades (decimales permitidos)', () => {
    expect(entryMacros(entry('perUnit', 2.5, m(70, 6)))).toEqual(m(175, 15, null, null))
  })

  it('los componentes nulos se quedan nulos', () => {
    expect(entryMacros(entry('per100g', 50, m(200)))).toEqual(m(100))
  })
})

describe('sumMacros / dayTotals', () => {
  it('suma kcal siempre y un opcional solo si alguna entrada lo tiene', () => {
    expect(sumMacros([m(100, 10), m(200), m(50, 5, 3)])).toEqual(m(350, 15, 3, null))
  })

  it('lista vacía → 0 kcal y opcionales nulos', () => {
    expect(sumMacros([])).toEqual(m(0))
  })

  it('dayTotals suma las entradas ya escaladas', () => {
    const entries = [entry('per100g', 200, m(100, 10)), entry('perUnit', 2, m(70, 6))]
    expect(dayTotals(entries)).toEqual(m(340, 32, null, null))
  })
})

describe('proteinIndex', () => {
  it('vale 1 cuando la densidad proteica iguala la del objetivo', () => {
    expect(proteinIndex(m(200, 15), goal)).toBeCloseTo(1)
  })

  it('vale 2 cuando dobla la densidad del objetivo', () => {
    expect(proteinIndex(m(200, 30), goal)).toBeCloseTo(2)
  })

  it('null sin proteína en la comida, sin objetivo de proteína o con 0 kcal', () => {
    expect(proteinIndex(m(200), goal)).toBeNull()
    expect(proteinIndex(m(200, 15), m(2000))).toBeNull()
    expect(proteinIndex(m(0, 15), goal)).toBeNull()
  })
})

describe('remaining', () => {
  it('resta lo comido y deja null donde no hay objetivo', () => {
    expect(remaining(goal, m(1500, 100, 50, 20))).toEqual(m(500, 50, null, null))
  })

  it('sin proteína comida cuenta como 0 frente a un objetivo con proteína', () => {
    expect(remaining(goal, m(300))).toEqual(m(1700, 150, null, null))
  })

  it('puede ser negativo (te has pasado)', () => {
    expect(remaining(goal, m(2300)).kcal).toBe(-300)
  })
})

describe('hasGoal', () => {
  it('solo un objetivo con kcal > 0 cuenta como definido', () => {
    expect(hasGoal(null)).toBe(false)
    expect(hasGoal(undefined)).toBe(false)
    expect(hasGoal(m(0, 100))).toBe(false)
    expect(hasGoal(m(1850))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/domain/nutrition.test.ts`
Expected: FAIL — cannot resolve `./nutrition`.

- [ ] **Step 3: Implement** — create `src/domain/nutrition.ts`:

```ts
/**
 * Nutrition math. Pure: no Firebase, no dates. Only kcal is mandatory; the
 * other components are `null` when not tracked and stay null through scaling.
 */
import type { FoodEntry, Macros } from './types'

export const EMPTY_MACROS: Macros = { kcal: 0, protein: null, carbs: null, fat: null }

const optionalKeys = ['protein', 'carbs', 'fat'] as const

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein == null ? null : m.protein * factor,
    carbs: m.carbs == null ? null : m.carbs * factor,
    fat: m.fat == null ? null : m.fat * factor,
  }
}

/** Macros of a logged entry: per 100 g × grams/100, or per unit × units. */
export function entryMacros(entry: Pick<FoodEntry, 'kind' | 'amount' | 'per'>): Macros {
  return scaleMacros(entry.per, entry.kind === 'per100g' ? entry.amount / 100 : entry.amount)
}

/** kcal always summed; an optional component is null only when every input has it null. */
export function sumMacros(list: readonly Macros[]): Macros {
  const out: Macros = { ...EMPTY_MACROS }
  for (const m of list) {
    out.kcal += m.kcal
    for (const k of optionalKeys) {
      const v = m[k]
      if (v != null) out[k] = (out[k] ?? 0) + v
    }
  }
  return out
}

export function dayTotals(entries: readonly FoodEntry[]): Macros {
  return sumMacros(entries.map(entryMacros))
}

/**
 * Protein density relative to the goal: (protein/goalProtein) / (kcal/goalKcal).
 * 1 = exactly the goal's ratio; 2 = twice as protein-dense. null when protein
 * is unknown on either side or there are no kcal to compare.
 */
export function proteinIndex(m: Macros, goal: Macros): number | null {
  if (m.protein == null || goal.protein == null) return null
  if (goal.protein <= 0 || goal.kcal <= 0 || m.kcal <= 0) return null
  return m.protein / goal.protein / (m.kcal / goal.kcal)
}

/** goal − eaten per component; null where the goal has no target. Negative = over. */
export function remaining(goal: Macros, eaten: Macros): Macros {
  return {
    kcal: goal.kcal - eaten.kcal,
    protein: goal.protein == null ? null : goal.protein - (eaten.protein ?? 0),
    carbs: goal.carbs == null ? null : goal.carbs - (eaten.carbs ?? 0),
    fat: goal.fat == null ? null : goal.fat - (eaten.fat ?? 0),
  }
}

/** A goal is usable once it has calories (settings may hold a half-typed goal). */
export function hasGoal(goal: Macros | null | undefined): goal is Macros {
  return goal != null && goal.kcal > 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/nutrition.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/nutrition.ts src/domain/nutrition.test.ts
git commit -m "feat(domain): nutrition macros, protein index and remaining"
```

---

### Task 3: domain week summary, goal-for-day, food ranking + date helpers

**Files:**
- Modify: `src/lib/dates.ts`, `src/lib/dates.test.ts`
- Modify: `src/domain/nutrition.ts`, `src/domain/nutrition.test.ts`

**Interfaces:**
- Consumes: `sumMacros`, `entryMacros`, `scaleMacros`, `EMPTY_MACROS` (Task 2); `searchEntries`, `makeEntry`, `normalize` from `./search`; `Food`, `NutritionDay`, `FoodEntry`, `Macros`, `WithId` (Task 1).
- Produces:
  - `src/lib/dates.ts`: `weekDayKeys(weekStart: string): string[]` (7 keys Mon→Sun), `weekdayInitial(dateKey: string): string` («L», «M», «X», «J», «V», «S», «D»).
  - `src/domain/nutrition.ts`: `WeekDayCell`, `WeekSummary`, `weekSummary(dateKeys: readonly string[], days: readonly NutritionDay[], currentGoal: Macros): WeekSummary`, `goalForDay(day: Pick<NutritionDay, 'goal'> | null, dateKey: string, todayKey: string, currentGoal: Macros): Macros`, `rankFoods<F extends Pick<Food, 'name' | 'lastUsedAt' | 'useCount'>>(foods: readonly F[], query: string): F[]`, `foodFromEntry(entry: FoodEntry): Omit<Food, 'createdAt' | 'lastUsedAt'>`.

- [ ] **Step 1: Failing date tests** — append to `src/lib/dates.test.ts` (extend the import with `weekDayKeys, weekdayInitial`):

```ts
describe('weekDayKeys', () => {
  it('returns the seven keys Monday to Sunday', () => {
    expect(weekDayKeys('2026-09-07')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ])
  })
})

describe('weekdayInitial', () => {
  it('uses the Spanish initials, X for Wednesday', () => {
    expect(weekDayKeys('2026-09-07').map(weekdayInitial)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/dates.test.ts`
Expected: FAIL — `weekDayKeys` is not exported.

- [ ] **Step 3: Implement the date helpers** — append to `src/lib/dates.ts`:

```ts
/** The seven day keys of the Mon–Sun week starting at the given Monday key. */
export function weekDayKeys(weekStart: string): string[] {
  const monday = parseISO(weekStart)
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(monday, i)))
}

/** Single-letter Spanish weekday: L M X J V S D. */
export function weekdayInitial(dateKey: string): string {
  const initials = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
  return initials[parseISO(dateKey).getDay()]
}
```

Run: `pnpm vitest run src/lib/dates.test.ts` → PASS.

- [ ] **Step 4: Failing domain tests** — append to `src/domain/nutrition.test.ts`. Add `import { Timestamp } from 'firebase/firestore'` at the top, extend the `./nutrition` import with `foodFromEntry, goalForDay, rankFoods, weekSummary`, and extend the types import with `Food, NutritionDay, WithId`:

```ts
const keys = [
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
]

const day = (dateKey: string, entries: FoodEntry[], goalKcal = 2000): NutritionDay => ({
  dateKey,
  goal: m(goalKcal, 150),
  entries,
  updatedAt: Timestamp.now(),
})

const eaten = (kcal: number, protein: number | null = null) => entry('perUnit', 1, m(kcal, protein))

describe('weekSummary', () => {
  it('media y balance solo sobre los días con registros', () => {
    const s = weekSummary(
      keys,
      [day('2026-09-07', [eaten(1700, 100)]), day('2026-09-08', [eaten(2300, 120)])],
      goal,
    )
    expect(s.loggedDays).toBe(2)
    expect(s.avg).toEqual(m(2000, 110, null, null))
    expect(s.balanceKcal).toBe(0)
    expect(s.days).toHaveLength(7)
    expect(s.days[0]).toEqual({
      dateKey: '2026-09-07',
      logged: true,
      kcal: 1700,
      protein: 100,
      goalKcal: 2000,
    })
    expect(s.days[2]).toEqual({
      dateKey: '2026-09-09',
      logged: false,
      kcal: 0,
      protein: null,
      goalKcal: 2000,
    })
  })

  it('cada día se compara con su objetivo guardado; los no registrados con el actual', () => {
    const s = weekSummary(keys, [day('2026-09-07', [eaten(1800)], 1800)], m(2500))
    expect(s.balanceKcal).toBe(0)
    expect(s.days[0].goalKcal).toBe(1800)
    expect(s.days[1].goalKcal).toBe(2500)
  })

  it('el balance es negativo por debajo y positivo por encima', () => {
    const s = weekSummary(keys, [day('2026-09-07', [eaten(1700)]), day('2026-09-08', [eaten(2100)])], goal)
    expect(s.balanceKcal).toBe(-200)
  })

  it('semana vacía → avg null, balance 0, siete celdas', () => {
    const s = weekSummary(keys, [], goal)
    expect(s.avg).toBeNull()
    expect(s.balanceKcal).toBe(0)
    expect(s.loggedDays).toBe(0)
    expect(s.days.every((d) => !d.logged)).toBe(true)
  })

  it('un doc sin entradas no cuenta como día registrado', () => {
    const s = weekSummary(keys, [day('2026-09-07', [])], goal)
    expect(s.loggedDays).toBe(0)
    expect(s.days[0].logged).toBe(false)
  })
})

describe('goalForDay', () => {
  const today = '2026-09-10'
  const snap = { goal: m(1800, 120) }

  it('hoy y el futuro siguen el objetivo actual', () => {
    expect(goalForDay(snap, today, today, goal)).toEqual(goal)
    expect(goalForDay(null, '2026-09-11', today, goal)).toEqual(goal)
  })

  it('un día pasado conserva su objetivo guardado', () => {
    expect(goalForDay(snap, '2026-09-01', today, goal)).toEqual(snap.goal)
  })

  it('un día pasado sin registro usa el actual', () => {
    expect(goalForDay(null, '2026-09-01', today, goal)).toEqual(goal)
  })
})

const food = (name: string, over: Partial<Food> = {}): WithId<Food> => ({
  id: name,
  name,
  kind: 'per100g',
  unitLabel: null,
  per: m(100, 10),
  lastAmount: null,
  useCount: 0,
  lastUsedAt: null,
  createdAt: Timestamp.now(),
  ...over,
})

describe('rankFoods', () => {
  it('sin consulta: último uso, luego veces usado, luego nombre', () => {
    const list = [
      food('Pan'),
      food('Atún', { useCount: 5 }),
      food('Huevo', { lastUsedAt: Timestamp.fromMillis(1000) }),
      food('Arroz', { useCount: 5 }),
    ]
    expect(rankFoods(list, '  ').map((f) => f.name)).toEqual(['Huevo', 'Arroz', 'Atún', 'Pan'])
  })

  it('con consulta busca sin acentos ni mayúsculas', () => {
    const list = [food('Atún en lata'), food('Pan'), food('Pechuga de pollo')]
    expect(rankFoods(list, 'atun').map((f) => f.name)).toEqual(['Atún en lata'])
    expect(rankFoods(list, 'POLLO').map((f) => f.name)).toEqual(['Pechuga de pollo'])
  })
})

describe('foodFromEntry', () => {
  it('crea el alimento con la cantidad como prefill y un uso', () => {
    const e = entry('perUnit', 2, m(70, 6), { name: ' Huevo ', unitLabel: 'huevo' })
    expect(foodFromEntry(e)).toEqual({
      name: 'Huevo',
      kind: 'perUnit',
      unitLabel: 'huevo',
      per: m(70, 6),
      lastAmount: 2,
      useCount: 1,
    })
  })

  it('por 100 g nunca lleva etiqueta de unidad', () => {
    const e = entry('per100g', 150, m(100, 20), { unitLabel: 'lata' })
    expect(foodFromEntry(e).unitLabel).toBeNull()
  })
})
```

- [ ] **Step 5: Run to verify failure**

Run: `pnpm vitest run src/domain/nutrition.test.ts`
Expected: FAIL — `weekSummary` is not exported.

- [ ] **Step 6: Implement** — in `src/domain/nutrition.ts`, change the imports to:

```ts
import { makeEntry, normalize, searchEntries } from './search'
import type { Food, FoodEntry, Macros, NutritionDay } from './types'
```

and append:

```ts
/* ------------------------------- Week view -------------------------------- */

export interface WeekDayCell {
  dateKey: string
  /** Has a day doc with at least one entry. */
  logged: boolean
  kcal: number
  protein: number | null
  /** The day's snapshotted goal, or the current one when never logged. */
  goalKcal: number
}

export interface WeekSummary {
  days: WeekDayCell[]
  /** Averages over logged days; null when nothing is logged. */
  avg: Macros | null
  /** Σ (kcal − goalKcal) over logged days. Negative = under the goal. */
  balanceKcal: number
  loggedDays: number
}

/** `dateKeys` are the seven Mon–Sun keys (built by the caller, see lib/dates weekDayKeys). */
export function weekSummary(
  dateKeys: readonly string[],
  days: readonly NutritionDay[],
  currentGoal: Macros,
): WeekSummary {
  const byKey = new Map(days.map((d) => [d.dateKey, d]))
  const cells: WeekDayCell[] = []
  const loggedTotals: Macros[] = []
  let balanceKcal = 0

  for (const dateKey of dateKeys) {
    const day = byKey.get(dateKey)
    const logged = day != null && day.entries.length > 0
    const totals = logged ? dayTotals(day.entries) : EMPTY_MACROS
    const goalKcal = day?.goal.kcal ?? currentGoal.kcal
    if (logged) {
      loggedTotals.push(totals)
      balanceKcal += totals.kcal - goalKcal
    }
    cells.push({ dateKey, logged, kcal: totals.kcal, protein: totals.protein, goalKcal })
  }

  const n = loggedTotals.length
  return {
    days: cells,
    avg: n === 0 ? null : scaleMacros(sumMacros(loggedTotals), 1 / n),
    balanceKcal,
    loggedDays: n,
  }
}

/**
 * Goal to stamp on a day write: today and the future follow the current goal;
 * a past day keeps the snapshot it was logged under (current goal if it was
 * never logged). Changing the goal in settings never recolors past weeks.
 */
export function goalForDay(
  day: Pick<NutritionDay, 'goal'> | null,
  dateKey: string,
  todayKey: string,
  currentGoal: Macros,
): Macros {
  if (dateKey >= todayKey || day == null) return currentGoal
  return day.goal
}

/* ------------------------------ Food library ------------------------------ */

/**
 * Library search. Empty query → most recently used first (then most used,
 * then name); otherwise the catalog's accent-insensitive relevance ranking.
 */
export function rankFoods<F extends Pick<Food, 'name' | 'lastUsedAt' | 'useCount'>>(
  foods: readonly F[],
  query: string,
): F[] {
  if (normalize(query) === '') {
    return [...foods].sort(
      (a, b) =>
        (b.lastUsedAt?.toMillis() ?? 0) - (a.lastUsedAt?.toMillis() ?? 0) ||
        b.useCount - a.useCount ||
        a.name.localeCompare(b.name, 'es'),
    )
  }
  return searchEntries(
    query,
    foods.map((f) => makeEntry(f, f.name)),
  )
}

/** Library food built from a freshly typed entry (the «save to my foods» checkbox). */
export function foodFromEntry(entry: FoodEntry): Omit<Food, 'createdAt' | 'lastUsedAt'> {
  return {
    name: entry.name.trim(),
    kind: entry.kind,
    unitLabel: entry.kind === 'perUnit' ? entry.unitLabel : null,
    per: entry.per,
    lastAmount: entry.amount,
    useCount: 1,
  }
}
```

- [ ] **Step 7: Run all tests**

Run: `pnpm vitest run src/domain/nutrition.test.ts src/lib/dates.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/domain/nutrition.ts src/domain/nutrition.test.ts
git commit -m "feat(domain): nutrition week summary, goal snapshot rule and food ranking"
```

---

### Task 4: data layer — live hooks and mutations

**Files:**
- Modify: `src/data/hooks.ts`
- Create: `src/data/nutritionMutations.ts`

**Interfaces:**
- Consumes: `foodsCol`, `foodDoc`, `nutritionDaysCol`, `nutritionDayDoc` (Task 1); `foodFromEntry` (Task 3); `weekEndKey` from `@/lib/dates`.
- Produces:
  - `useFoods(): WithId<Food>[] | undefined`
  - `useNutritionWeek(weekStart: string): WithId<NutritionDay>[] | undefined`
  - `newEntryId(): string`
  - `addEntry(uid, dateKey, day: NutritionDay | null, entry: FoodEntry, goal: Macros, opts: { food: WithId<Food> | null; saveToLibrary: boolean }): void`
  - `updateEntry(uid, day: WithId<NutritionDay>, entry: FoodEntry, goal: Macros): void`
  - `removeEntry(uid, day: WithId<NutritionDay>, entryId: string, goal: Macros): void`
  - `createFood(uid, data: Pick<Food, 'name' | 'kind' | 'unitLabel' | 'per'>): string`, `saveFood(uid, food: WithId<Food>): void`, `deleteFood(uid, id: string): void`

- [ ] **Step 1: Hooks** — in `src/data/hooks.ts`: add `Food, NutritionDay` to the `@/domain/types` type import, `foodsCol, nutritionDaysCol` to the `./converters` import, and `import { weekEndKey } from '@/lib/dates'`. Append:

```ts
/** The whole personal food library (small; ranked client-side). */
export function useFoods(): WithId<Food>[] | undefined {
  const uid = useUser().uid
  return useLiveQuery(() => query(foodsCol(uid), orderBy('name')), [uid])
}

/** Day docs of the Mon–Sun week starting at `weekStart`; only logged days exist. */
export function useNutritionWeek(weekStart: string): WithId<NutritionDay>[] | undefined {
  const uid = useUser().uid
  return useLiveQuery(
    () =>
      query(
        nutritionDaysCol(uid),
        where('dateKey', '>=', weekStart),
        where('dateKey', '<=', weekEndKey(weekStart)),
      ),
    [uid, weekStart],
  )
}
```

(A range on a single field needs no composite index.)

- [ ] **Step 2: Mutations** — create `src/data/nutritionMutations.ts`:

```ts
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

  batch.set(nutritionDayDoc(uid, dateKey), dayWith(dateKey, [...(day?.entries ?? []), linked], goal))
  batch.commit().catch(logError('addEntry'))
}

export function updateEntry(
  uid: string,
  day: WithId<NutritionDay>,
  entry: FoodEntry,
  goal: Macros,
): void {
  const entries = day.entries.map((e) => (e.id === entry.id ? entry : e))
  setDoc(nutritionDayDoc(uid, day.id), dayWith(day.id, entries, goal)).catch(logError('updateEntry'))
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
  setDoc(nutritionDayDoc(uid, day.id), dayWith(day.id, entries, goal)).catch(logError('removeEntry'))
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
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. (`crypto.randomUUID` is typed in DOM lib; the project targets modern browsers.)

- [ ] **Step 4: Commit**

```bash
git add src/data/hooks.ts src/data/nutritionMutations.ts
git commit -m "feat(nutrition): live hooks and day/food mutations"
```

---

### Task 5: settings — daily goal section

**Files:**
- Modify: `src/features/settings/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `Macros` (Task 1), `EMPTY_MACROS` (Task 2), `NumericField`, `formatKg`, `parseDecimal`, `settings:nutrition.*` and `common:units.*` keys (Task 1).
- Produces: writes `settings.nutritionGoal` on the user doc. kcal cleared → stored as `0` (the section stays; `hasGoal` treats it as unset), so protein/carbs/fat survive retyping kcal.

- [ ] **Step 1: Add the section** — in `SettingsScreen.tsx` add the imports:

```ts
import { EMPTY_MACROS } from '@/domain/nutrition'
import type { Macros, OneRmFormula } from '@/domain/types'
```

(replace the existing `import type { OneRmFormula }` line). In the JSX, after the `bodyWeight` `<Section>` and before the reminders one, insert:

```tsx
      <NutritionGoalSection
        goal={s.nutritionGoal ?? null}
        onChange={(goal) => update({ 'settings.nutritionGoal': goal })}
      />
```

(`s.nutritionGoal ?? null` matters: `useUserProfile` casts the raw doc without zod, so old profiles hand back `undefined`.)

Add the component below `DataSection`:

```tsx
/** Daily kcal goal (required to enable «Comida») plus optional protein/carbs/fat. */
function NutritionGoalSection({
  goal,
  onChange,
}: {
  goal: Macros | null
  onChange: (goal: Macros) => void
}) {
  const { t } = useTranslation(['settings', 'common'])
  const current = goal ?? EMPTY_MACROS

  const rows: { key: keyof Macros; label: string; unit: string }[] = [
    { key: 'kcal', label: t('settings:nutrition.kcal'), unit: t('common:units.kcal') },
    { key: 'protein', label: t('settings:nutrition.protein'), unit: t('common:units.g') },
    { key: 'carbs', label: t('settings:nutrition.carbs'), unit: t('common:units.g') },
    { key: 'fat', label: t('settings:nutrition.fat'), unit: t('common:units.g') },
  ]

  return (
    <Section title={t('settings:nutrition.title')} help={t('settings:nutrition.help')}>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {row.label}
              {row.key !== 'kcal' && (
                <span className="text-ink-3"> · {t('settings:nutrition.optional')}</span>
              )}
            </span>
            <div className="flex w-32 items-center gap-2">
              <NumericField
                ariaLabel={row.label}
                value={row.key === 'kcal' ? (current.kcal > 0 ? current.kcal : null) : current[row.key]}
                format={formatKg}
                parse={parseDecimal}
                onCommit={(v) => {
                  const next: Macros = { ...current }
                  if (row.key === 'kcal') next.kcal = v ?? 0
                  else next[row.key] = v
                  onChange(next)
                }}
              />
              <span className="w-8 text-sm text-ink-3">{row.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
```

- [ ] **Step 2: Typecheck, lint, and check it in the browser**

Run: `pnpm typecheck && pnpm lint`
Then with `pnpm emulators` + `pnpm dev` running, open `/ajustes`: the «Nutrición» block shows four fields; typing 1850 in Calorías and 100 in Proteínas and reloading keeps both values. Clearing Calorías keeps Proteínas.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/SettingsScreen.tsx
git commit -m "feat(settings): daily nutrition goal"
```

---

### Task 6: navigation, shared week pager, formatting, and the read-only Comida screen

**Files:**
- Create: `src/components/ui/WeekPager.tsx`
- Modify: `src/features/analytics/AnalyticsScreen.tsx` (use the shared pager)
- Create: `src/features/nutrition/format.ts`, `src/features/nutrition/WeekStrip.tsx`, `src/features/nutrition/DayCard.tsx`, `src/features/nutrition/NutritionScreen.tsx`
- Modify: `src/app/AppLayout.tsx`, `src/app/router.tsx`

**Interfaces:**
- Consumes: `useNutritionWeek` (Task 4), `useUserProfile`, `weekSummary`, `dayTotals`, `remaining`, `proteinIndex`, `entryMacros`, `hasGoal`, `WeekDayCell` (Tasks 2–3), `weekDayKeys`, `weekdayInitial`, `weekStartKey`, `addWeeksToKey`, `toDateKey`, `formatDay` from `@/lib/dates`, `formatKg` from `@/lib/formatSet`.
- Produces:
  - `WeekPager({ weekStart, currentWeekStart, minWeekStart, onStep, labels })` — `minWeekStart: string | null`, null = unbounded past.
  - `format.ts`: `formatKcal(v: number): string` («1.850»), `formatGrams(v: number): string` (1 decimal, comma), `formatAmount(v: number): string` (= `formatKg`), `formatIndex(v: number): string` (2 decimals, comma), `entryAmountLabel(entry: Pick<FoodEntry, 'kind' | 'amount' | 'unitLabel'>, t: TFunction<['nutrition', 'common']>): string`, `foodBaseLabel(food: Pick<Food, 'kind' | 'unitLabel'>, t: TFunction<['nutrition', 'common']>): string`.
  - `WeekStrip({ cells, selectedKey, todayKey, onSelect })`, `DayCard({ totals, goal })`.
  - `NutritionScreen` exported from `NutritionScreen.tsx`; routes `/comida`.

- [ ] **Step 1: Shared WeekPager** — create `src/components/ui/WeekPager.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatWeekRange } from '@/lib/dates'

/**
 * Mon–Sun stepper on week keys. › stops at the current week; ‹ stops at
 * `minWeekStart` (null = unbounded).
 */
export function WeekPager({
  weekStart,
  currentWeekStart,
  minWeekStart,
  onStep,
  labels,
}: {
  weekStart: string
  currentWeekStart: string
  minWeekStart: string | null
  onStep: (dir: -1 | 1) => void
  labels: { current: string; prev: string; next: string }
}) {
  const isCurrent = weekStart >= currentWeekStart
  const atMin = minWeekStart != null && weekStart <= minWeekStart

  return (
    <div className="flex items-center justify-between rounded-card border border-hairline bg-surface p-1">
      <button
        type="button"
        aria-label={labels.prev}
        disabled={atMin}
        onClick={() => onStep(-1)}
        className="flex size-9 items-center justify-center rounded-card text-ink-2 active:bg-surface-2 disabled:opacity-30"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="text-sm font-medium">
        {isCurrent ? labels.current : formatWeekRange(weekStart)}
      </span>
      <button
        type="button"
        aria-label={labels.next}
        disabled={isCurrent}
        onClick={() => onStep(1)}
        className="flex size-9 items-center justify-center rounded-card text-ink-2 active:bg-surface-2 disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Analytics uses it** — in `AnalyticsScreen.tsx`: delete the private `WeekPager` function (the block starting at the comment `/** Mon–Sun stepper for week mode; › stops at the current week. */` through its closing brace), remove `ChevronLeft, ChevronRight` from the lucide import (keep `ChartPie`), add `import { WeekPager } from '@/components/ui/WeekPager'`, and change the call site to:

```tsx
      {range === 'week' && (
        <WeekPager
          weekStart={weekStart}
          currentWeekStart={currentWeekStart}
          minWeekStart={minWeekStart ?? currentWeekStart}
          onStep={(dir) => setWeekStart((w) => addWeeksToKey(w, dir))}
          labels={{
            current: t('analytics:week.current'),
            prev: t('analytics:week.prev'),
            next: t('analytics:week.next'),
          }}
        />
      )}
```

(`minWeekStart ?? currentWeekStart` preserves the old behavior: with no workouts, ‹ is disabled.) `formatWeekRange` was only used by the removed pager: delete it from the `@/lib/dates` import in `AnalyticsScreen.tsx`.

- [ ] **Step 3: Formatting helpers** — create `src/features/nutrition/format.ts`:

```ts
import type { TFunction } from 'i18next'
import type { Food, FoodEntry } from '@/domain/types'
import { formatKg } from '@/lib/formatSet'

type T = TFunction<['nutrition', 'common']>

/** «1.850» — rounded, Spanish thousands separator. */
export function formatKcal(v: number): string {
  return Math.round(v).toLocaleString('es-ES')
}

/** «32,5» — one decimal max, Spanish comma. */
export function formatGrams(v: number): string {
  return (Math.round(v * 10) / 10).toString().replace('.', ',')
}

/** Amount typed by the user (grams or units): two decimals max, comma. */
export const formatAmount = formatKg

/** «1,12». */
export function formatIndex(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',')
}

/** «150 g» · «2 × huevo» · «2 ud». */
export function entryAmountLabel(
  entry: Pick<FoodEntry, 'kind' | 'amount' | 'unitLabel'>,
  t: T,
): string {
  const amount = formatAmount(entry.amount)
  if (entry.kind === 'per100g') return t('nutrition:entry.amountGrams', { amount })
  if (entry.unitLabel) return t('nutrition:entry.amountUnits', { amount, unit: entry.unitLabel })
  return t('nutrition:entry.amountUnitsBare', { amount })
}

/** «por 100 g» · «por huevo» · «por unidad». */
export function foodBaseLabel(food: Pick<Food, 'kind' | 'unitLabel'>, t: T): string {
  if (food.kind === 'per100g') return t('nutrition:library.perBase100g')
  if (food.unitLabel) return t('nutrition:library.perBaseUnit', { unit: food.unitLabel })
  return t('nutrition:library.perBaseUnitBare')
}
```

- [ ] **Step 4: WeekStrip** — create `src/features/nutrition/WeekStrip.tsx`:

```tsx
import type { WeekDayCell } from '@/domain/nutrition'
import { weekdayInitial } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { formatKcal } from './format'

/** Seven tappable cells: weekday initial, kcal (— when not logged), bar vs goal. */
export function WeekStrip({
  cells,
  selectedKey,
  todayKey,
  onSelect,
}: {
  cells: WeekDayCell[]
  selectedKey: string
  todayKey: string
  onSelect: (dateKey: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((cell) => {
        const ratio = cell.goalKcal > 0 ? cell.kcal / cell.goalKcal : 0
        const over = cell.logged && ratio > 1
        const future = cell.dateKey > todayKey
        const selected = cell.dateKey === selectedKey
        return (
          <button
            key={cell.dateKey}
            type="button"
            disabled={future}
            aria-pressed={selected}
            onClick={() => onSelect(cell.dateKey)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-card border px-1 py-2',
              selected ? 'border-accent bg-surface-2' : 'border-hairline bg-surface',
              future && 'opacity-40',
            )}
          >
            <span
              className={cn(
                'text-xs font-semibold',
                cell.dateKey === todayKey ? 'text-accent' : 'text-ink-3',
              )}
            >
              {weekdayInitial(cell.dateKey)}
            </span>
            <span className="tnum text-xs">{cell.logged ? formatKcal(cell.kcal) : '—'}</span>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn('h-full rounded-full', over ? 'bg-status-over' : 'bg-accent')}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: DayCard** — create `src/features/nutrition/DayCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { proteinIndex, remaining } from '@/domain/nutrition'
import type { Macros } from '@/domain/types'
import { cn } from '@/lib/utils'
import { formatGrams, formatIndex, formatKcal } from './format'

/** Eaten vs goal for the selected day: kcal + remaining, optional macros, protein index. */
export function DayCard({ totals, goal }: { totals: Macros; goal: Macros }) {
  const { t } = useTranslation(['nutrition', 'common'])
  const rem = remaining(goal, totals)
  const index = proteinIndex(totals, goal)
  const over = rem.kcal < 0

  const macroRows = (['protein', 'carbs', 'fat'] as const).filter((k) => goal[k] != null)

  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">{t('nutrition:day.eaten')}</p>
          <p className="tnum text-3xl font-bold tracking-tight">
            {formatKcal(totals.kcal)}
            <span className="ml-1 text-base font-medium text-ink-3">
              {t('nutrition:day.of', { goal: formatKcal(goal.kcal) })}
            </span>
          </p>
        </div>
        <p className={cn('tnum text-sm font-semibold', over ? 'text-status-over' : 'text-status-ok')}>
          {over
            ? t('nutrition:day.over', { kcal: formatKcal(-rem.kcal) })
            : t('nutrition:day.remaining', { kcal: formatKcal(rem.kcal) })}
        </p>
      </div>
      <Bar ratio={goal.kcal > 0 ? totals.kcal / goal.kcal : 0} />

      {macroRows.map((k) => (
        <div key={k} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-2">{t(`nutrition:macros.${k}`)}</span>
            <span className="tnum">
              {formatGrams(totals[k] ?? 0)} / {formatGrams(goal[k]!)} {t('common:units.g')}
            </span>
          </div>
          <Bar ratio={goal[k]! > 0 ? (totals[k] ?? 0) / goal[k]! : 0} />
        </div>
      ))}

      {index != null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">{t('nutrition:day.index')}</span>
          <span className={cn('tnum font-semibold', index >= 1 ? 'text-status-ok' : 'text-ink')}>
            {formatIndex(index)}
          </span>
        </div>
      )}
    </section>
  )
}

function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={cn('h-full rounded-full', ratio > 1 ? 'bg-status-over' : 'bg-accent')}
        style={{ width: `${Math.min(100, ratio * 100)}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 6: NutritionScreen (read-only for now)** — create `src/features/nutrition/NutritionScreen.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Target, Utensils } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/EmptyState'
import { KebabMenu, MenuItem } from '@/components/ui/KebabMenu'
import { WeekPager } from '@/components/ui/WeekPager'
import { useNutritionWeek, useUserProfile } from '@/data/hooks'
import {
  dayTotals,
  entryMacros,
  hasGoal,
  proteinIndex,
  weekSummary,
  type WeekSummary as WeekSummaryData,
} from '@/domain/nutrition'
import type { FoodEntry, Macros } from '@/domain/types'
import { addWeeksToKey, formatDay, toDateKey, weekDayKeys, weekStartKey } from '@/lib/dates'
import { parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { DayCard } from './DayCard'
import { entryAmountLabel, formatGrams, formatIndex, formatKcal } from './format'
import { WeekStrip } from './WeekStrip'

export function NutritionScreen() {
  const { t } = useTranslation(['nutrition', 'common'])
  const navigate = useNavigate()
  const profile = useUserProfile()

  const todayKey = toDateKey(new Date())
  const currentWeekStart = weekStartKey(todayKey)
  const [weekStart, setWeekStart] = useState(currentWeekStart)
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const days = useNutritionWeek(weekStart)
  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart])

  const goal = profile?.settings.nutritionGoal ?? null
  const selectedDay = days?.find((d) => d.dateKey === selectedKey) ?? null

  function stepWeek(dir: -1 | 1) {
    const next = addWeeksToKey(weekStart, dir)
    setWeekStart(next)
    setSelectedKey(next === currentWeekStart ? todayKey : next)
  }

  if (!profile) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  if (!hasGoal(goal)) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('nutrition:title')}</h1>
        <EmptyState
          icon={Utensils}
          title={t('nutrition:noGoal.title')}
          body={t('nutrition:noGoal.body')}
          action={
            <Link
              to="/ajustes"
              className="mt-1 flex h-10 items-center rounded-card bg-accent px-4 text-sm font-semibold text-on-accent"
            >
              {t('nutrition:noGoal.action')}
            </Link>
          }
        />
      </div>
    )
  }

  const summary = days ? weekSummary(dayKeys, days, goal) : null
  const totals = dayTotals(selectedDay?.entries ?? [])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      <header className="flex items-center gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight">{t('nutrition:title')}</h1>
        <KebabMenu>
          {(close) => (
            <MenuItem
              icon={<Target className="size-4" />}
              label={t('nutrition:menu.goals')}
              onClick={() => {
                close()
                navigate('/ajustes')
              }}
            />
          )}
        </KebabMenu>
      </header>

      <WeekPager
        weekStart={weekStart}
        currentWeekStart={currentWeekStart}
        minWeekStart={null}
        onStep={stepWeek}
        labels={{
          current: t('nutrition:week.current'),
          prev: t('nutrition:week.prev'),
          next: t('nutrition:week.next'),
        }}
      />

      {summary && (
        <>
          <WeekStrip
            cells={summary.days}
            selectedKey={selectedKey}
            todayKey={todayKey}
            onSelect={setSelectedKey}
          />
          <WeekLine summary={summary} />
        </>
      )}

      <h2 className="text-sm font-semibold text-ink-2">{formatDay(parseISO(selectedKey))}</h2>

      <DayCard totals={totals} goal={goal} />

      {selectedDay && selectedDay.entries.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {selectedDay.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} goal={goal} />
          ))}
        </ul>
      ) : (
        <p className="px-2 text-center text-sm text-ink-3">{t('nutrition:day.empty')}</p>
      )}
    </div>
  )
}

/** «Media/día 1.790 kcal · 98 g prot» and the signed weekly kcal balance. */
function WeekLine({ summary }: { summary: WeekSummaryData }) {
  const { t } = useTranslation(['nutrition', 'common'])
  if (summary.avg == null) {
    return <p className="text-center text-xs text-ink-3">{t('nutrition:week.noData')}</p>
  }
  const b = summary.balanceKcal
  const sign = b > 0 ? '+' : b < 0 ? '−' : ''
  return (
    <div className="flex items-center justify-between px-1 text-sm">
      <span className="text-ink-2">
        {t('nutrition:week.average')}{' '}
        <span className="tnum font-medium text-ink">{formatKcal(summary.avg.kcal)} kcal</span>
        {summary.avg.protein != null && (
          <span className="tnum font-medium text-ink">
            {' · '}
            {formatGrams(summary.avg.protein)} {t('common:units.g')} {t('nutrition:macros.proteinShort')}
          </span>
        )}
      </span>
      <span
        className={cn(
          'tnum font-semibold',
          b > 0 ? 'text-status-over' : b < 0 ? 'text-status-ok' : 'text-ink-2',
        )}
        title={t('nutrition:week.balance')}
      >
        {sign}
        {formatKcal(Math.abs(b))} kcal
      </span>
    </div>
  )
}

function EntryRow({ entry, goal }: { entry: FoodEntry; goal: Macros }) {
  const { t } = useTranslation(['nutrition', 'common'])
  const m = entryMacros(entry)
  const index = proteinIndex(m, goal)
  return (
    <li className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.name}</p>
        <p className="mt-0.5 text-xs text-ink-3">{entryAmountLabel(entry, t)}</p>
      </div>
      <div className="tnum text-right text-sm">
        <p className="font-semibold">{formatKcal(m.kcal)} kcal</p>
        {m.protein != null && (
          <p className="text-xs text-ink-2">
            {formatGrams(m.protein)} {t('common:units.g')} {t('nutrition:macros.proteinShort')}
          </p>
        )}
      </div>
      {index != null && (
        <span
          className={cn(
            'tnum shrink-0 rounded-chip border px-2 py-0.5 text-xs font-semibold',
            index >= 1 ? 'border-accent/40 text-accent' : 'border-hairline text-ink-3',
          )}
        >
          {formatIndex(index)}
        </span>
      )}
    </li>
  )
}
```

- [ ] **Step 7: Route + navigation** — in `src/app/router.tsx` add `import { NutritionScreen } from '@/features/nutrition/NutritionScreen'` and, after the `/ejercicios/:exerciseId` route, `{ path: '/comida', element: <NutritionScreen /> },`.

In `src/app/AppLayout.tsx`:

1. Replace the lucide import with `import { ChartPie, Dumbbell, History, House, Play, Settings, Utensils } from 'lucide-react'` (`Play` stays for the desktop side button).
2. Tabs:

```tsx
  const tabs = [
    { to: '/', label: t('nav.home'), icon: House },
    { to: '/historial', label: t('nav.history'), icon: History },
    { to: '/comida', label: t('nav.nutrition'), icon: Utensils },
    { to: '/ejercicios', label: t('nav.exercises'), icon: Dumbbell },
    { to: '/analisis', label: t('nav.analytics'), icon: ChartPie },
  ] as const
```

3. Mobile bar body becomes:

```tsx
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
          {tabs.map((tab) => (
            <TabLink key={tab.to} {...tab} />
          ))}
        </div>
```

4. Delete the `TrainFab` function entirely (the desktop `TrainSideButton` stays; the sidebar already maps `tabs`, so «Comida» appears there automatically).

- [ ] **Step 8: Gate + browser check**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean. In the browser: the bottom bar shows five tabs with «Comida» in the middle, no train button; `/comida` with no goal shows the empty state with a link to settings; with a goal, the pager, the strip (today highlighted, future days dimmed), «Sin registros esta semana», the day heading, the day card with «Te quedan 1.850 kcal», and the empty-day text. Analytics week mode still pages.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/WeekPager.tsx src/features/analytics/AnalyticsScreen.tsx src/features/nutrition/format.ts src/features/nutrition/WeekStrip.tsx src/features/nutrition/DayCard.tsx src/features/nutrition/NutritionScreen.tsx src/app/AppLayout.tsx src/app/router.tsx
git commit -m "feat(nutrition): Comida tab with week strip, averages and day card"
```

---

### Task 7: add flow — food form, food row, add sheet

**Files:**
- Create: `src/features/nutrition/FoodForm.tsx`, `src/features/nutrition/FoodListRow.tsx`, `src/features/nutrition/AddEntrySheet.tsx`
- Modify: `src/features/nutrition/NutritionScreen.tsx`

**Interfaces:**
- Consumes: `useFoods`, `addEntry`, `newEntryId` (Task 4); `rankFoods`, `entryMacros`, `proteinIndex`, `goalForDay` (Tasks 2–3); `Sheet`, `NumericField`; `foodBaseLabel`, `formatKcal`, `formatGrams`, `formatIndex`, `formatAmount` (Task 6); `parseDecimal` from `@/lib/formatSet`.
- Produces:
  - `FoodForm.tsx`: `FoodDraft` (`{ name: string; kind: FoodKind; unitLabel: string; per: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } }`), `emptyFoodDraft(name?: string): FoodDraft`, `draftFromFood(food: Food): FoodDraft`, `draftIsValid(d: FoodDraft): boolean`, `draftToFoodFields(d: FoodDraft): Pick<Food, 'name' | 'kind' | 'unitLabel' | 'per'>`, `FoodForm({ draft, onChange })`, `TextInput` (exported for reuse in sheets), `AmountField({ kind, unitLabel, value, onChange })`, `MacroPreview({ macros, goal })`.
  - `FoodListRow({ food, onClick })`.
  - `AddEntrySheet({ open, onOpenChange, foods, goal, onAdd })` with `onAdd(entry: FoodEntry, opts: { food: WithId<Food> | null; saveToLibrary: boolean })`.

- [ ] **Step 1: FoodForm and shared field pieces** — create `src/features/nutrition/FoodForm.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { NumericField } from '@/components/ui/NumericField'
import { proteinIndex } from '@/domain/nutrition'
import type { Food, FoodKind, Macros } from '@/domain/types'
import { formatKg, parseDecimal } from '@/lib/formatSet'
import { cn } from '@/lib/utils'
import { formatAmount, formatGrams, formatIndex, formatKcal } from './format'

export interface FoodDraft {
  name: string
  kind: FoodKind
  /** Free text while editing; trimmed/nulled by draftToFoodFields. */
  unitLabel: string
  per: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }
}

export function emptyFoodDraft(name = ''): FoodDraft {
  return { name, kind: 'per100g', unitLabel: '', per: { kcal: null, protein: null, carbs: null, fat: null } }
}

export function draftFromFood(food: Food): FoodDraft {
  return { name: food.name, kind: food.kind, unitLabel: food.unitLabel ?? '', per: { ...food.per } }
}

/** Name and kcal are the only requirements. */
export function draftIsValid(d: FoodDraft): boolean {
  return d.name.trim().length > 0 && d.per.kcal != null && d.per.kcal >= 0
}

export function draftToFoodFields(d: FoodDraft): Pick<Food, 'name' | 'kind' | 'unitLabel' | 'per'> {
  const unit = d.unitLabel.trim()
  return {
    name: d.name.trim(),
    kind: d.kind,
    unitLabel: d.kind === 'perUnit' && unit ? unit : null,
    per: { kcal: d.per.kcal ?? 0, protein: d.per.protein, carbs: d.per.carbs, fat: d.per.fat },
  }
}

const inputClass =
  'h-11 w-full rounded-card border border-hairline bg-surface-2 px-3 text-base outline-none placeholder:text-ink-3/70 focus:border-accent'

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel: string
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-2">
        {label}
        {hint && <span className="text-ink-3"> · {hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** Fields of a library food: name, per-100g/per-unit toggle, unit label, four macros. */
export function FoodForm({ draft, onChange }: { draft: FoodDraft; onChange: (d: FoodDraft) => void }) {
  const { t } = useTranslation(['nutrition', 'common'])
  const optional = t('nutrition:form.optional')

  function setPer(key: keyof FoodDraft['per'], v: number | null) {
    onChange({ ...draft, per: { ...draft.per, [key]: v } })
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label={t('nutrition:form.name')}>
        <TextInput
          value={draft.name}
          onChange={(name) => onChange({ ...draft, name })}
          placeholder={t('nutrition:form.namePlaceholder')}
          ariaLabel={t('nutrition:form.name')}
        />
      </Field>

      <Field label={t('nutrition:form.kind')}>
        <div className="flex rounded-card bg-surface-2 p-1">
          {(['per100g', 'perUnit'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={draft.kind === kind}
              onClick={() => onChange({ ...draft, kind })}
              className={cn(
                'h-9 flex-1 rounded-[10px] text-sm font-medium transition-colors',
                draft.kind === kind ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              {t(`nutrition:form.${kind}`)}
            </button>
          ))}
        </div>
      </Field>

      {draft.kind === 'perUnit' && (
        <Field label={t('nutrition:form.unitLabel')} hint={optional}>
          <TextInput
            value={draft.unitLabel}
            onChange={(unitLabel) => onChange({ ...draft, unitLabel })}
            placeholder={t('nutrition:form.unitLabelPlaceholder')}
            ariaLabel={t('nutrition:form.unitLabel')}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('nutrition:form.kcal')}>
          <NumericField
            ariaLabel={t('nutrition:form.kcal')}
            value={draft.per.kcal}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('kcal', v)}
          />
        </Field>
        <Field label={t('nutrition:form.protein')} hint={optional}>
          <NumericField
            ariaLabel={t('nutrition:form.protein')}
            value={draft.per.protein}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('protein', v)}
          />
        </Field>
        <Field label={t('nutrition:form.carbs')} hint={optional}>
          <NumericField
            ariaLabel={t('nutrition:form.carbs')}
            value={draft.per.carbs}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('carbs', v)}
          />
        </Field>
        <Field label={t('nutrition:form.fat')} hint={optional}>
          <NumericField
            ariaLabel={t('nutrition:form.fat')}
            value={draft.per.fat}
            format={formatKg}
            parse={parseDecimal}
            onCommit={(v) => setPer('fat', v)}
          />
        </Field>
      </div>
    </div>
  )
}

/** Amount eaten, with the unit as a suffix («g», the unit label, or «ud»). */
export function AmountField({
  kind,
  unitLabel,
  value,
  onChange,
}: {
  kind: FoodKind
  unitLabel: string | null
  value: number | null
  onChange: (v: number | null) => void
}) {
  const { t } = useTranslation(['nutrition', 'common'])
  const suffix =
    kind === 'per100g' ? t('common:units.g') : unitLabel || t('nutrition:form.unitShort')
  return (
    <Field label={t('nutrition:form.amountEaten')}>
      <div className="flex items-center gap-2">
        <NumericField
          ariaLabel={t('nutrition:form.amountEaten')}
          value={value}
          format={formatAmount}
          parse={parseDecimal}
          onCommit={onChange}
          className="text-lg"
        />
        <span className="w-16 truncate text-sm text-ink-3">{suffix}</span>
      </div>
    </Field>
  )
}

/** «350 kcal · 30 g prot» plus the protein index chip when computable. */
export function MacroPreview({ macros, goal }: { macros: Macros; goal: Macros }) {
  const { t } = useTranslation(['nutrition', 'common'])
  const index = proteinIndex(macros, goal)
  return (
    <div className="flex items-center justify-between rounded-card bg-surface-2 px-3 py-2 text-sm">
      <span className="tnum font-medium">
        {macros.protein != null
          ? t('nutrition:preview.full', {
              kcal: formatKcal(macros.kcal),
              protein: formatGrams(macros.protein),
            })
          : t('nutrition:preview.kcalOnly', { kcal: formatKcal(macros.kcal) })}
      </span>
      {index != null && (
        <span className={cn('tnum text-xs font-semibold', index >= 1 ? 'text-accent' : 'text-ink-3')}>
          {t('nutrition:day.index')} {formatIndex(index)}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: FoodListRow** — create `src/features/nutrition/FoodListRow.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { Food, WithId } from '@/domain/types'
import { foodBaseLabel, formatGrams, formatKcal } from './format'

/** One library food: name, base («por 100 g»), kcal and protein per base. */
export function FoodListRow({ food, onClick }: { food: WithId<Food>; onClick: () => void }) {
  const { t } = useTranslation(['nutrition', 'common'])
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface p-3 text-left active:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{food.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink-3">{foodBaseLabel(food, t)}</p>
        </div>
        <div className="tnum text-right text-sm">
          <p className="font-semibold">{formatKcal(food.per.kcal)} kcal</p>
          {food.per.protein != null && (
            <p className="text-xs text-ink-2">
              {formatGrams(food.per.protein)} {t('common:units.g')} {t('nutrition:macros.proteinShort')}
            </p>
          )}
        </div>
      </button>
    </li>
  )
}
```

- [ ] **Step 3: AddEntrySheet** — create `src/features/nutrition/AddEntrySheet.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '@/components/ui/Sheet'
import { newEntryId } from '@/data/nutritionMutations'
import { entryMacros, rankFoods } from '@/domain/nutrition'
import type { Food, FoodEntry, Macros, WithId } from '@/domain/types'
import {
  AmountField,
  draftIsValid,
  draftToFoodFields,
  emptyFoodDraft,
  FoodForm,
  MacroPreview,
  type FoodDraft,
} from './FoodForm'
import { FoodListRow } from './FoodListRow'

type Step = { kind: 'search' } | { kind: 'amount'; food: WithId<Food> } | { kind: 'new' }

/**
 * Add flow: search the library → amount, or «Nuevo alimento» → form + amount
 * (+ optional save to the library, off by default).
 */
export function AddEntrySheet({
  open,
  onOpenChange,
  foods,
  goal,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  foods: WithId<Food>[]
  goal: Macros
  onAdd: (entry: FoodEntry, opts: { food: WithId<Food> | null; saveToLibrary: boolean }) => void
}) {
  const { t } = useTranslation(['nutrition', 'common'])
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'search' })
  const [amount, setAmount] = useState<number | null>(null)
  const [draft, setDraft] = useState<FoodDraft>(emptyFoodDraft())
  const [save, setSave] = useState(false)

  // fresh state every time the sheet opens
  useEffect(() => {
    if (!open) return
    setQuery('')
    setStep({ kind: 'search' })
    setAmount(null)
    setDraft(emptyFoodDraft())
    setSave(false)
  }, [open])

  const ranked = useMemo(() => rankFoods(foods, query).slice(0, 30), [foods, query])

  function pickFood(food: WithId<Food>) {
    setAmount(food.lastAmount ?? (food.kind === 'perUnit' ? 1 : null))
    setStep({ kind: 'amount', food })
  }

  function startNew() {
    setDraft(emptyFoodDraft(query.trim()))
    setAmount(null)
    setStep({ kind: 'new' })
  }

  function confirmFromFood(food: WithId<Food>) {
    if (amount == null || amount <= 0) return
    onAdd(
      {
        id: newEntryId(),
        foodId: food.id,
        name: food.name,
        kind: food.kind,
        unitLabel: food.unitLabel,
        amount,
        per: food.per,
      },
      { food, saveToLibrary: false },
    )
    onOpenChange(false)
  }

  function confirmNew() {
    if (!draftIsValid(draft) || amount == null || amount <= 0) return
    const fields = draftToFoodFields(draft)
    onAdd(
      { id: newEntryId(), foodId: null, ...fields, amount },
      { food: null, saveToLibrary: save },
    )
    onOpenChange(false)
  }

  const canConfirm = amount != null && amount > 0

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('nutrition:addSheet.title')}
      tall={step.kind === 'search'}
    >
      {step.kind === 'search' && (
        <div className="flex flex-col gap-2 pt-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('nutrition:addSheet.searchPlaceholder')}
              className="h-11 w-full rounded-card border border-hairline bg-surface-2 pl-9 pr-3 text-base outline-none focus:border-accent"
            />
          </div>

          <ul className="flex flex-col gap-2 pt-1">
            {ranked.length === 0 && <NewFoodRow query={query} onClick={startNew} first />}
            {ranked.map((food) => (
              <FoodListRow key={food.id} food={food} onClick={() => pickFood(food)} />
            ))}
            {ranked.length > 0 && <NewFoodRow query={query} onClick={startNew} />}
          </ul>
          {ranked.length === 0 && (
            <p className="pt-2 text-center text-sm text-ink-3">
              {foods.length === 0 ? t('nutrition:addSheet.noFoods') : t('nutrition:addSheet.noMatches')}
            </p>
          )}
        </div>
      )}

      {step.kind === 'amount' && (
        <div className="flex flex-col gap-4 pt-2 pb-2">
          <BackRow onClick={() => setStep({ kind: 'search' })} label={t('nutrition:addSheet.back')} />
          <p className="text-lg font-semibold">{step.food.name}</p>
          <AmountField
            kind={step.food.kind}
            unitLabel={step.food.unitLabel}
            value={amount}
            onChange={setAmount}
          />
          {canConfirm && (
            <MacroPreview
              macros={entryMacros({ kind: step.food.kind, amount: amount!, per: step.food.per })}
              goal={goal}
            />
          )}
          <ConfirmButton disabled={!canConfirm} onClick={() => confirmFromFood(step.food)} />
        </div>
      )}

      {step.kind === 'new' && (
        <div className="flex flex-col gap-4 pt-2 pb-2">
          <BackRow onClick={() => setStep({ kind: 'search' })} label={t('nutrition:addSheet.back')} />
          <FoodForm draft={draft} onChange={setDraft} />
          <AmountField
            kind={draft.kind}
            unitLabel={draft.unitLabel.trim() || null}
            value={amount}
            onChange={setAmount}
          />
          {canConfirm && draftIsValid(draft) && (
            <MacroPreview
              macros={entryMacros({ kind: draft.kind, amount: amount!, per: draftToFoodFields(draft).per })}
              goal={goal}
            />
          )}
          <label className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-3">
            <span className="text-sm font-medium">{t('nutrition:form.saveToLibrary')}</span>
            <input
              type="checkbox"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
              className="size-5 accent-(--accent)"
            />
          </label>
          <ConfirmButton disabled={!canConfirm || !draftIsValid(draft)} onClick={confirmNew} />
        </div>
      )}
    </Sheet>
  )
}

function NewFoodRow({ query, onClick, first = false }: { query: string; onClick: () => void; first?: boolean }) {
  const { t } = useTranslation('nutrition')
  const q = query.trim()
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex h-12 w-full items-center gap-2 rounded-card border border-dashed px-3 text-sm font-medium ${
          first ? 'border-accent text-accent' : 'border-hairline text-ink-2'
        }`}
      >
        <Plus className="size-4" />
        {q ? t('addSheet.newFoodNamed', { name: q }) : t('addSheet.newFood')}
      </button>
    </li>
  )
}

function BackRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 self-start text-sm text-ink-2">
      <ArrowLeft className="size-4" />
      {label}
    </button>
  )
}

function ConfirmButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useTranslation('nutrition')
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full rounded-card bg-accent font-semibold text-on-accent disabled:opacity-50"
    >
      {t('add')}
    </button>
  )
}
```

- [ ] **Step 4: Wire into NutritionScreen** — in `NutritionScreen.tsx`:

Imports to add:

```ts
import { useUser } from '@/app/AuthProvider'
import { useFoods, useNutritionWeek, useUserProfile } from '@/data/hooks' // replaces the hooks import
import { addEntry } from '@/data/nutritionMutations'
import { goalForDay } from '@/domain/nutrition' // add to the existing domain import list
import { AddEntrySheet } from './AddEntrySheet'
```

State and data inside the component (after `const days = ...`):

```ts
  const uid = useUser().uid
  const foods = useFoods() ?? []
  const [adding, setAdding] = useState(false)
```

After `const totals = ...`:

```ts
  const writeGoal = goalForDay(selectedDay, selectedKey, todayKey, goal)
  const canLog = selectedKey <= todayKey
```

Replace the empty-day paragraph so future days say so:

```tsx
        <p className="px-2 text-center text-sm text-ink-3">
          {canLog ? t('nutrition:day.empty') : t('nutrition:day.future')}
        </p>
```

Before the closing `</div>` of the main return, add the floating button and the sheet:

```tsx
      {canLog && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg justify-center px-4 pb-3 lg:bottom-0">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-on-accent shadow-lg active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.5} />
            {t('nutrition:add')}
          </button>
        </div>
      )}

      <AddEntrySheet
        open={adding}
        onOpenChange={setAdding}
        foods={foods}
        goal={goal}
        onAdd={(entry, opts) => addEntry(uid, selectedKey, selectedDay, entry, writeGoal, opts)}
      />
```

Add `Plus` to the lucide import.

- [ ] **Step 5: Gate + browser check**

Run: `pnpm typecheck && pnpm lint && pnpm test`
In the browser on `/comida`: «Añadir» → search shows «Nuevo alimento» dashed row → fill «Huevo», per unit, unit «huevo», 70 kcal, 6 g protein, amount 2, tick save → the entry appears («2 × huevo», 140 kcal, 12 g prot, index chip), the day card updates, the strip shows today's kcal. Open «Añadir» again: «Huevo» is listed first; tap → amount prefilled with 2 → add. Reload: everything persists. Untick save on a new one-off → not in the list next time.

- [ ] **Step 6: Commit**

```bash
git add src/features/nutrition/FoodForm.tsx src/features/nutrition/FoodListRow.tsx src/features/nutrition/AddEntrySheet.tsx src/features/nutrition/NutritionScreen.tsx
git commit -m "feat(nutrition): add-entry sheet with library search and new-food form"
```

---

### Task 8: edit / delete an entry

**Files:**
- Create: `src/features/nutrition/EditEntrySheet.tsx`
- Modify: `src/features/nutrition/NutritionScreen.tsx`

**Interfaces:**
- Consumes: `updateEntry`, `removeEntry` (Task 4); `AmountField`, `MacroPreview` (Task 7); `entryMacros`; `Sheet`, `ConfirmDialog`.
- Produces: `EditEntrySheet({ entry, goal, onClose, onSave, onDelete })` — `entry: FoodEntry | null` (open when non-null).

- [ ] **Step 1: EditEntrySheet** — create `src/features/nutrition/EditEntrySheet.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Sheet } from '@/components/ui/Sheet'
import { entryMacros } from '@/domain/nutrition'
import type { FoodEntry, Macros } from '@/domain/types'
import { AmountField, MacroPreview } from './FoodForm'

/** Change the amount of a logged entry or remove it from the day. */
export function EditEntrySheet({
  entry,
  goal,
  onClose,
  onSave,
  onDelete,
}: {
  entry: FoodEntry | null
  goal: Macros
  onClose: () => void
  onSave: (entry: FoodEntry) => void
  onDelete: (entryId: string) => void
}) {
  const { t } = useTranslation(['nutrition', 'common'])
  const [amount, setAmount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setAmount(entry?.amount ?? null)
    setConfirming(false)
  }, [entry])

  const canSave = entry != null && amount != null && amount > 0

  return (
    <>
      <Sheet open={entry != null} onOpenChange={(o) => !o && onClose()} title={t('nutrition:entry.editTitle')}>
        {entry && (
          <div className="flex flex-col gap-4 pt-2 pb-2">
            <p className="text-lg font-semibold">{entry.name}</p>
            <AmountField kind={entry.kind} unitLabel={entry.unitLabel} value={amount} onChange={setAmount} />
            {canSave && (
              <MacroPreview macros={entryMacros({ kind: entry.kind, amount: amount!, per: entry.per })} goal={goal} />
            )}
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                onSave({ ...entry, amount: amount! })
                onClose()
              }}
              className="h-12 w-full rounded-card bg-accent font-semibold text-on-accent disabled:opacity-50"
            >
              {t('common:actions.save')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-hairline font-medium text-status-over"
            >
              <Trash2 className="size-4" />
              {t('nutrition:entry.delete')}
            </button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title={t('nutrition:entry.delete')}
        body={t('nutrition:entry.deleteBody')}
        confirmLabel={t('common:actions.delete')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (entry) onDelete(entry.id)
          setConfirming(false)
          onClose()
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Wire into NutritionScreen** — add `import { EditEntrySheet } from './EditEntrySheet'`, extend the mutations import to `import { addEntry, removeEntry, updateEntry } from '@/data/nutritionMutations'`, add state `const [editing, setEditing] = useState<FoodEntry | null>(null)`, give `EntryRow` an `onClick` prop and make its root a button:

```tsx
function EntryRow({ entry, goal, onClick }: { entry: FoodEntry; goal: Macros; onClick: () => void }) {
  ...
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface p-3 text-left active:bg-surface-2"
      >
        {/* same three children as before */}
      </button>
    </li>
  )
}
```

Render rows with `onClick={() => setEditing(entry)}` and mount, next to `AddEntrySheet`:

```tsx
      <EditEntrySheet
        entry={editing}
        goal={goal}
        onClose={() => setEditing(null)}
        onSave={(entry) => selectedDay && updateEntry(uid, selectedDay, entry, writeGoal)}
        onDelete={(id) => selectedDay && removeEntry(uid, selectedDay, id, writeGoal)}
      />
```

- [ ] **Step 3: Gate + browser check**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Browser: tap an entry → change 2 to 3 → save: row and totals update. Delete the only entry → confirm → the day shows the empty text and the strip cell goes back to «—» (doc deleted). Edit an entry on a past day whose goal differs from the current one: the strip's `goalKcal` for that day does not change (snapshot kept).

- [ ] **Step 4: Commit**

```bash
git add src/features/nutrition/EditEntrySheet.tsx src/features/nutrition/NutritionScreen.tsx
git commit -m "feat(nutrition): edit amount and delete entries"
```

---

### Task 9: library screen («Mis alimentos»)

**Files:**
- Create: `src/features/nutrition/FoodsScreen.tsx`
- Modify: `src/app/router.tsx`, `src/features/nutrition/NutritionScreen.tsx` (kebab item)

**Interfaces:**
- Consumes: `useFoods`, `saveFood`, `deleteFood` (Task 4); `rankFoods`; `FoodForm`, `draftFromFood`, `draftIsValid`, `draftToFoodFields` (Task 7); `FoodListRow` (Task 7); `BackButton`, `EmptyState`, `Sheet`, `ConfirmDialog`.
- Produces: `FoodsScreen` at `/comida/alimentos`.

- [ ] **Step 1: FoodsScreen** — create `src/features/nutrition/FoodsScreen.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { SearchIcon, Trash2, Utensils } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { BackButton } from '@/components/ui/BackButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { useFoods } from '@/data/hooks'
import { deleteFood, saveFood } from '@/data/nutritionMutations'
import { rankFoods } from '@/domain/nutrition'
import type { Food, WithId } from '@/domain/types'
import { draftFromFood, draftIsValid, draftToFoodFields, FoodForm, type FoodDraft } from './FoodForm'
import { FoodListRow } from './FoodListRow'

/** Personal food library: search, edit values, delete. Past entries are never touched. */
export function FoodsScreen() {
  const uid = useUser().uid
  const { t } = useTranslation(['nutrition', 'common'])
  const foods = useFoods()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<WithId<Food> | null>(null)
  const [draft, setDraft] = useState<FoodDraft | null>(null)
  const [confirming, setConfirming] = useState(false)

  const ranked = useMemo(() => rankFoods(foods ?? [], query), [foods, query])

  function open(food: WithId<Food>) {
    setEditing(food)
    setDraft(draftFromFood(food))
  }

  function close() {
    setEditing(null)
    setDraft(null)
    setConfirming(false)
  }

  function save() {
    if (!editing || !draft || !draftIsValid(draft)) return
    saveFood(uid, { ...editing, ...draftToFoodFields(draft) })
    close()
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <header className="flex items-center gap-2">
        <BackButton fallback="/comida" />
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{t('nutrition:library.title')}</h1>
      </header>

      {foods === undefined ? (
        <p className="pt-10 text-center text-ink-3">{t('common:loading')}</p>
      ) : foods.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title={t('nutrition:library.empty.title')}
          body={t('nutrition:library.empty.body')}
        />
      ) : (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('nutrition:library.searchPlaceholder')}
              className="h-11 w-full rounded-card border border-hairline bg-surface-2 pl-9 pr-3 text-base outline-none focus:border-accent"
            />
          </div>
          {ranked.length === 0 ? (
            <p className="pt-6 text-center text-sm text-ink-3">{t('nutrition:library.noMatches')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ranked.map((food) => (
                <FoodListRow key={food.id} food={food} onClick={() => open(food)} />
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={editing != null} onOpenChange={(o) => !o && close()} title={t('nutrition:library.editTitle')}>
        {editing && draft && (
          <div className="flex flex-col gap-4 pt-2 pb-2">
            <p className="text-xs text-ink-3">
              {t('nutrition:library.usedTimes', { count: editing.useCount })}
            </p>
            <FoodForm draft={draft} onChange={setDraft} />
            <button
              type="button"
              disabled={!draftIsValid(draft)}
              onClick={save}
              className="h-12 w-full rounded-card bg-accent font-semibold text-on-accent disabled:opacity-50"
            >
              {t('common:actions.save')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-hairline font-medium text-status-over"
            >
              <Trash2 className="size-4" />
              {t('nutrition:library.delete')}
            </button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title={t('nutrition:library.delete')}
        body={t('nutrition:library.deleteBody')}
        confirmLabel={t('common:actions.delete')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (editing) deleteFood(uid, editing.id)
          close()
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Route + kebab** — in `src/app/router.tsx` add `import { FoodsScreen } from '@/features/nutrition/FoodsScreen'` and `{ path: '/comida/alimentos', element: <FoodsScreen /> },` right after `/comida`.

In `NutritionScreen.tsx` add `BookOpen` to the lucide import and a second menu item before «Objetivos»:

```tsx
            <MenuItem
              icon={<BookOpen className="size-4" />}
              label={t('nutrition:menu.library')}
              onClick={() => {
                close()
                navigate('/comida/alimentos')
              }}
            />
```

(The kebab's children callback must return a single node: wrap both `MenuItem`s in a fragment `<>…</>`.)

- [ ] **Step 3: Gate + browser check**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Browser: ⋮ → «Mis alimentos» → list shows saved foods; tap «Huevo», change kcal to 75, save → row shows 75 kcal; back to `/comida`: the already-logged entry still shows 140 kcal (snapshot). Delete a food → gone from the library, entries intact. Back button returns to `/comida`.

- [ ] **Step 4: Commit**

```bash
git add src/features/nutrition/FoodsScreen.tsx src/features/nutrition/NutritionScreen.tsx src/app/router.tsx
git commit -m "feat(nutrition): food library screen"
```

---

### Task 10: docs, rules deploy note, final gate

**Files:**
- Modify: `README.md` (Architecture list), `CLAUDE.md` (Project rules)

- [ ] **Step 1: README** — in the Architecture list, after the `exerciseStats` bullet add:

```md
- `users/{uid}/foods` + `users/{uid}/nutritionDays/{YYYY-MM-DD}` — personal food library and one doc per logged day (entries embedded, goal snapshotted). All nutrition math is pure in `src/domain/nutrition.ts`.
```

And in the Checks paragraph, extend the list of covered domains with «nutrition (macros, protein index, week averages)».

- [ ] **Step 2: CLAUDE.md** — add to «Project rules»:

```md
- Nutrition: only `kcal` is required on goals/foods/entries; `protein`/`carbs`/`fat` are `number | null`. Entries snapshot the food's `per` macros — editing or deleting a library food never touches past days. A day doc exists iff it has ≥1 entry; its `goal` is the snapshot to compare against (past days keep theirs, see `goalForDay`).
```

- [ ] **Step 3: Full quality gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. Fix anything that is not before committing.

- [ ] **Step 4: Rules** — deploying is a production action; note it for Juli rather than running it:

```bash
firebase deploy --only firestore:rules
```

(The emulator picks `firestore.rules` up automatically.)

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: nutrition tracking architecture and rules"
```

---

## Self-review notes

- **Spec coverage:** data model (T1), domain math incl. index/averages/balance/goal snapshot/ranking (T2–T3), hooks + batch mutations + rules (T1, T4), settings goal (T5), nav swap + `/comida` with pager/strip/week line/day card/entries/kebab/no-goal state (T6, T9), add sheet with search, amount prefill, new-food form, save checkbox off by default (T7), edit/delete entry with doc deletion on empty (T8), library screen (T9), locale namespace (T1), docs (T10). Out-of-scope items untouched.
- **Refinement vs spec:** past days keep their goal snapshot even when edited (`goalForDay`), and settings store kcal `0` for «unset» so optional fields survive retyping (`hasGoal`). Both are recorded in the spec.
- **Type consistency:** `addEntry(uid, dateKey, day, entry, goal, opts)` in T4 matches the T7 call; `updateEntry/removeEntry(uid, day, …, goal)` match T8; `WeekPager` `labels`/`minWeekStart` match T6's two call sites; `AmountField(kind, unitLabel, value, onChange)` is called with exactly those props in T7/T8.
