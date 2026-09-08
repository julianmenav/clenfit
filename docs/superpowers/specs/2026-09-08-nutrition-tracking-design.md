# Daily nutrition tracking («Comida») — design

Date: 2026-09-08 · Status: approved

## Goal

Replace the user's spreadsheet for daily calorie and macro tracking. One
screen shows the current day against a daily goal (eaten, remaining, protein
index), a Mon–Sun strip of the calendar week and the week's average per
logged day. Foods the user eats often are saved once in a personal library
and re-logged by typing a name and an amount. Only kcal is mandatory
everywhere; protein, carbs and fat are optional and simply hidden when
absent.

Why here and not a separate app: auth, Firestore per user, offline PWA,
zustand, i18n and the design tokens already exist. Nutrition goals are tied
to training goals for this user. The only structural cost is a slot in the
bottom bar, which is freed by removing the never-used train button.

## Data model (`src/domain/types.ts`)

Shared macro shape — kcal required, the rest nullable (never `undefined`,
these live inside arrays):

```ts
export const macrosSchema = z.object({
  kcal: z.number(),
  protein: z.number().nullable(),
  carbs: z.number().nullable(),
  fat: z.number().nullable(),
})
export type Macros = z.infer<typeof macrosSchema>
```

Goal — in `userSettingsSchema`, optional until the user sets it:

```ts
nutritionGoal: macrosSchema.nullable().default(null) // default for older profile docs
```

A goal counts as set only when `kcal > 0` (`hasGoal`). Settings write the
object with `kcal: 0` when the field is cleared instead of nulling it, so the
optional macros survive retyping the calories.

Library food — new subcollection `users/{uid}/foods/{id}`:

```ts
export const foodKinds = ['per100g', 'perUnit'] as const
export const foodSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(foodKinds),
  /** «huevo», «lata», «rebanada»… Only meaningful for perUnit; null otherwise. */
  unitLabel: z.string().nullable(),
  /** Per 100 g (per100g) or per unit (perUnit). */
  per: macrosSchema,
  /** Prefill for the next log of this food. */
  lastAmount: z.number().nullable(),
  useCount: z.number().int(),
  lastUsedAt: z.instanceof(Timestamp).nullable(),
  createdAt: z.instanceof(Timestamp),
})
```

Day log — new subcollection `users/{uid}/nutritionDays/{dateKey}`, one doc
per local day, id = `YYYY-MM-DD` (same `toDateKey` as workouts):

```ts
export const foodEntrySchema = z.object({
  id: z.string(),
  /** Library food it came from; null for one-off entries or deleted foods. */
  foodId: z.string().nullable(),
  name: z.string().min(1),
  kind: z.enum(foodKinds),
  unitLabel: z.string().nullable(),
  /** Grams for per100g, units (decimals allowed) for perUnit. */
  amount: z.number().positive(),
  /** Snapshot of the food's per-100g / per-unit macros at logging time. */
  per: macrosSchema,
})
export const nutritionDaySchema = z.object({
  dateKey: z.string(),
  /** Goal in force when the day was last written. */
  goal: macrosSchema,
  entries: z.array(foodEntrySchema),
  updatedAt: z.instanceof(Timestamp),
})
```

Rules that follow from the model:

- Entry totals are **derived**, never stored. Editing an amount recomputes
  from `per`.
- Entries snapshot `per`; editing or deleting a library food never changes
  past days. A deleted food leaves `foodId` dangling, which is fine.
- The day doc carries a goal snapshot. A write to today (or a future day)
  stamps the current goal; a write to a past day that already has a doc keeps
  the snapshot it was logged under (`goalForDay`), so editing an old entry
  after changing the goal never recolors that week. Days without a doc are
  evaluated against the current goal.
- A day doc is created on the first entry and deleted when its last entry is
  removed (keeps «logged day» = «has a doc with ≥1 entry»).

## Domain logic (`src/domain/nutrition.ts`, colocated test)

Pure functions, no Firebase:

- `entryMacros(entry): Macros` — `per100g`: `per × amount / 100`; `perUnit`:
  `per × amount`. Null components stay null.
- `sumMacros(list: Macros[]): Macros` — kcal summed; for protein/carbs/fat a
  null contributes 0, and the result component is null only when every input
  is null (so a day with no protein data shows no protein at all).
- `proteinIndex(m: Macros, goal: Macros): number | null` —
  `(m.protein / goal.protein) / (m.kcal / goal.kcal)`. Null when
  `m.protein` or `goal.protein` is null, or `m.kcal` is 0. 1 = protein
  density exactly matching the goal ratio.
- `remaining(goal: Macros, eaten: Macros): Macros` — goal − eaten per
  component; null where the goal is null.
- `weekSummary(weekStart, days: NutritionDay[], currentGoal): WeekSummary`
  — returns the seven `{ dateKey, logged, kcal, protein, goalKcal }` cells
  (`goalKcal` from the day snapshot or `currentGoal`), plus over **logged
  days only**: `avg: Macros | null` (null when nothing logged),
  `balanceKcal: number` = Σ (kcal − goalKcal). The balance is the number the
  user reasons with («300 under Monday cancels 300 over Tuesday»).
- `rankFoods(foods, query): Food[]` — non-empty query: accent-insensitive
  match through `domain/search.ts` (`makeEntry`/`searchEntries`); empty
  query: by `lastUsedAt` desc, then `useCount` desc, then name.
- `foodFromEntry(entry): Omit<Food, 'createdAt' | 'useCount' | 'lastUsedAt'>`
  — builds the library food when the «save» checkbox is ticked.

## Data layer

- `data/converters.ts`: `foodsCol/foodDoc`, `nutritionDaysCol/nutritionDayDoc`
  with zod converters, same pattern as reminders.
- `data/hooks.ts`: `useFoods()` (all, ordered by name — the library is small),
  `useNutritionWeek(weekStart)` (range query on `dateKey` between Monday and
  Sunday keys, live).
- `data/nutritionMutations.ts` (fire-and-forget like `reminderMutations`):
  - `addEntry(uid, day: NutritionDay | null, dateKey, entry, goal, opts:
    { saveToLibrary: boolean })` — takes the day the screen already holds
    from the live hook (no read), appends, writes with the goal snapshot. If
    the entry comes from a library food, bumps `useCount`, `lastUsedAt`,
    `lastAmount`. If `saveToLibrary`, creates the food first and links
    `foodId`. All in one `writeBatch`.
  - `updateEntry(uid, day, entry, goal)` / `removeEntry(uid, day, entryId,
    goal)` — rewrite the day; delete the doc when empty.
  - `createFood / saveFood / deleteFood` for the library screen.
- `firestore.rules`: add `foods/{docId}` and `nutritionDays/{docId}` owner
  rules.
- `settings`: `nutritionGoal` saved through the existing profile update path.

## Screens (`src/features/nutrition/`)

Routes: `/comida` (main) · `/comida/alimentos` (library).

**NutritionScreen (`/comida`)**

1. Week stepper header: «‹ 8 – 14 sep ›», current week by default, any past
   week reachable (`weekStartKey`, `addWeeksToKey`, `formatWeekRange`).
2. Mon–Sun strip: weekday initial, kcal (or «—» when not logged), a thin bar
   filled to kcal / goalKcal, today ringed, selected day highlighted. Tap
   selects the day. Selecting today's week defaults to today; another week
   defaults to Monday.
3. Week line: «Media: 1.790 kcal · 98 g prot» over logged days and the
   balance «−180 kcal esta semana» (green under, red over). Protein average
   hidden when null.
4. Day card: kcal eaten / goal and **remaining** (the number the user checks
   before deciding what else to eat), protein eaten / goal when the goal has
   protein, carbs and fat rows when the goal has them, day protein index.
5. Entry list, flat, in logging order: name, amount («150 g» / «2 huevos»),
   kcal, protein, index chip when computable. Tap opens the edit sheet
   (amount, delete).
6. «Añadir» button (sticky bottom of the screen content) opens the add sheet.
7. Kebab: «Mis alimentos» → `/comida/alimentos`; «Objetivos» → `/ajustes`.
8. No goal set → `EmptyState` explaining the section with a button to
   settings. Logging is disabled until a goal exists (the day doc needs a
   goal snapshot).

**Add sheet (`AddEntrySheet`, uses `Sheet`)**

- Search input focused on open. List = `rankFoods(foods, query)`: name, kind
  hint («por 100 g» / «por unidad»), kcal and protein per base.
- Tap a food → amount step: `NumericField` prefilled with `lastAmount`, unit
  suffix («g» or the unit label), live kcal / protein / index preview,
  «Añadir» confirms.
- «Nuevo alimento» row (always last, or first when there are no matches;
  prefilled with the typed query): name, kind toggle (por 100 g / por
  unidad), unit label (perUnit only), kcal, protein, carbs, fat (last three
  optional), amount eaten, checkbox «Guardar en mis alimentos» **off by
  default**, «Añadir».

**FoodsScreen (`/comida/alimentos`)**

- Search box + list of library foods (`rankFoods`), tap → edit sheet with the
  same food form, delete with `ConfirmDialog`. `BackButton` to `/comida`.

**Settings**

- New block «Nutrición»: kcal (required to enable the section), proteínas,
  hidratos, grasas (optional, clear = null). Saves `settings.nutritionGoal`.

## Navigation (`AppLayout`)

- Mobile bar: remove `TrainFab`; five equal tabs Inicio · Historial ·
  Comida · Ejercicios · Análisis (`Utensils` icon). Grid stays five columns.
- Desktop sidebar: add Comida after Historial; keep the train side button.
- `common.json` `nav.nutrition: "Comida"`.

## i18n

New namespace `src/locales/es/nutrition.json` (screen, sheet, library,
empty state, units); settings strings in `settings.json`. No hardcoded text.

## Testing

- `domain/nutrition.test.ts`: `entryMacros` for both kinds and null
  propagation; `sumMacros` null-only vs mixed; `proteinIndex` = 1 on the goal
  ratio, null cases; `remaining`; `weekSummary` averages over logged days
  only, balance sign, snapshot goal vs current goal, empty week → `avg` null;
  `rankFoods` accent-insensitive match and recency order; `foodFromEntry`.
- `domain/types.test.ts`: schemas reject `undefined` macro fields and accept
  null; `nutritionGoal` defaults to null for old profiles.
- Quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Out of scope

- Built-in food catalog or barcode / internet lookup (the personal library
  grows with use).
- Meal grouping (breakfast/lunch/dinner) — flat list by decision.
- Weight tracking, TDEE estimation, goal suggestions.
- Weekly goals or per-weekday goals — a single daily goal.
- Nutrition data in Analytics or Home for v1.
