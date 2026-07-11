# Clenfit — notes for Claude

Mobile-first PWA for tracking gym workouts. The app UI is 100% in Spanish via i18next (`src/locales/es/*.json`) — never hardcode text in components. (This is a product decision: the end users are Spanish-speaking. Everything developer-facing — this file, the README, commit messages, code comments — is in English.)

## Commands

- `pnpm dev` · `pnpm emulators` (Auth :9199, Firestore :8180; requires the `.tooling` → JRE symlink)
- Quality gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Project rules

- `src/domain/` is pure: no Firebase imports (except the `Timestamp` type in `types.ts`); every module has a colocated test.
- Warmups (`type: 'warmup'`) are excluded from ALL calculations (volume, 1RM, PRs) — `isWorkingSet` is the only gate.
- Missing measurement fields in sets = `null`, never `undefined` (Firestore rejects them, and they are nested inside arrays).
- Catalog ids (`src/data/catalog/exercises.ts`) are forever: never delete/reuse, only mark `deprecated: true`.
- `exerciseStats` are written in the same `writeBatch` as the workout on finish; after editing/deleting history → `recomputeExerciseStats`.
- The active session: zustand (`store/activeWorkout.ts`) is the source of truth; Firestore receives a debounced sync; never write the active doc from anywhere else.
- Both 1RMs (Epley and Brzycki) are stored in PRs so that changing the formula in settings does not corrupt the history.
- Style: Tailwind v4 CSS-first, semantic tokens in `src/styles/tokens.css` (bg/surface/ink/accent...); same convention as ~/Projects/brokify.
