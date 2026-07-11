export type ThemePref = 'system' | 'light' | 'dark'

const THEME_KEY = 'clenfit:theme'

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

/** Sin clase = sigue al sistema; .light/.dark fuerzan (tokens.css). */
export function applyThemePref(pref: ThemePref): void {
  localStorage.setItem(THEME_KEY, pref)
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (pref !== 'system') root.classList.add(pref)
}

export function initTheme(): void {
  applyThemePref(getThemePref())
}
