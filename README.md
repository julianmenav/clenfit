# Clenfit

Your gym progress, set by set. A mobile-first PWA for logging strength workouts: flexible routines, last-session values within reach, automatic records and per-muscle-group analytics.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · Firebase (Auth + Firestore) · zustand · i18next (es) · Recharts · vite-plugin-pwa

## Local development (no Firebase project)

Runs fully against emulators with the `demo-clenfit` demo project:

```bash
pnpm install
pnpm emulators   # Auth :9199, Firestore :8180, UI :4100 (needs ./.tooling/jre → JRE)
pnpm dev         # in another terminal
```

`.env.local` already ships `VITE_USE_EMULATORS=true`. Emulator data is imported/exported under `.emulator-data`.

> `.tooling` is a symlink to brokify's JRE. If it doesn't exist: `ln -s ../brokify/.tooling .tooling` (or install Java and drop the prefixes from the `emulators` script).

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

The vitest tests cover the pure domain (`src/domain`): 1RM formulas (Epley/Brzycki), volume with warmup exclusion, record detection, accent-insensitive search, similar-exercise ranking and catalog invariants.

## Going to production

1. Create the **clenfit** project in the [Firebase Console](https://console.firebase.google.com) with Auth (Email/Password + Google) and Firestore.
2. Create `.env.production` with the `VITE_FIREBASE_*` values from the console (see `.env.example`) and `VITE_USE_EMULATORS=false`.
3. Deploy rules, indexes and hosting:

```bash
firebase use clenfit-juli          # or the real project id (.firebaserc)
firebase deploy --only firestore   # rules + indexes
pnpm build && firebase deploy --only hosting
```

## Architecture

- `src/domain/` — pure Firebase-free logic, tested: 1RM, volume, PRs, search, similarity.
- `src/data/catalog/exercises.ts` — static catalog (~110 exercises, stable slug ids; never delete an id, only `deprecated`). The `movement` axis feeds the similar-exercise suggestions when swapping machines.
- `src/data/` — Firestore layer: zod converters, live hooks, mutations. Everything under `users/{uid}`.
- `users/{uid}/exerciseStats/{exerciseId}` — denormalized per-exercise stats (last session → ghost values, multi-dimension records). Updated in the same batch on finish; after deleting a workout they are recomputed by replaying the history.
- `src/store/activeWorkout.ts` — the active session lives in zustand (instant response) with persist to localStorage and a debounced sync to the Firestore `status:'active'` doc (resumable from another device).
- The rest timer stores `endsAt` (epoch), never a countdown: always correct when returning to the app.
