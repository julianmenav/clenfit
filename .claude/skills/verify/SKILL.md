---
name: verify
description: Drive the built PWA against the Firebase emulators with Playwright to verify offline/sync behavior end-to-end.
---

# Verify clenfit (offline-first PWA)

The service worker only exists in builds — `pnpm dev` cannot verify offline behavior.

## Launch

```bash
pnpm emulators                      # background; Auth :9199, Firestore :8180 (needs .tooling JRE symlink)
VITE_USE_EMULATORS=true pnpm build  # env var overrides .env.production's =false
pnpm exec vite preview --port 4173  # background
```

## Drive (playwright-core + cached chromium)

- Cached browser: `/home/juli/.cache/ms-playwright/chromium-*/chrome-linux64/chrome` (pass as `executablePath`; `pnpm add playwright-core` in a scratch dir, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).
- Context: `{ viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, serviceWorkers: 'allow' }`; `context.setOffline(true/false)` for connectivity (fires online/offline events; Firestore SDK reacts).
- Create users via Auth emulator REST: `POST :9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake` with `{email, password, returnSecureToken:true}`, then sign in through `/entrar` UI (`input[type=email]`, `input[type=password]`, `button[type=submit]`).
- Wait for `navigator.serviceWorker.ready` before going offline.
- Useful selectors (UI is Spanish, labels in `src/locales/es/*.json`): FAB `getByRole('button', {name:'Entrenar'})`; workout heading `getByRole('heading', {name:'Entrenamiento libre'})`; exercise picker items `[data-vaul-drawer] li button`; set inputs `input[inputmode]`; complete-set button aria-label `Serie N`; finish `Terminar` (exact) → sheet confirm `Terminar entrenamiento`.

## Assert server state

Firestore emulator REST **requires the rules bypass** or reads return 403 (easily mistaken for "no documents"):

```bash
curl -H "Authorization: Bearer owner" \
  "http://127.0.0.1:8180/v1/projects/clenfit-juli/databases/(default)/documents/users/<uid>/workouts"
```

Project id is `clenfit-juli` when built from `.env.production` (only `demo-clenfit` if no env config).

## Gotchas

- After reconnect, queued writes can take a few seconds to replay — poll, don't single-check.
- To test the SW update toast: rebuild with a changed bundle (e.g. `VITE_FIREBASE_MESSAGING_SENDER_ID=00000000000`), then `navigator.serviceWorker.ready.then(r => r.update())` in the page; toast «Nueva versión disponible» → button «Actualizar».
- `ERR_INTERNET_DISCONNECTED` console errors while offline are expected Firestore noise.
- Rebuild plain `pnpm build` at the end so `dist/` isn't left pointing at emulators.
