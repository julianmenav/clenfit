import { useSyncExternalStore } from 'react'

/*
 * `beforeinstallprompt` (Chromium) fires once, early: it is captured at module
 * load (imported from main.tsx) and replayed when the user taps «Instalar».
 * iOS has no equivalent — installation is manual via Compartir → Añadir a
 * pantalla de inicio.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/** true when the native Chromium install prompt can be shown. */
export function useCanPromptInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferredPrompt !== null)
}

export async function promptInstall(): Promise<void> {
  if (!deferredPrompt) return
  const prompt = deferredPrompt
  deferredPrompt = null
  notify()
  await prompt.prompt()
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
