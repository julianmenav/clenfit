import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { useTranslation } from 'react-i18next'
import { auth } from '@/lib/firebase'
import { authErrorMessage } from '@/lib/authErrors'

type Mode = 'signIn' | 'signUp'

export function LoginScreen() {
  const { t } = useTranslation(['auth', 'common'])
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signIn') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      if (err instanceof FirebaseError && err.code === 'auth/popup-closed-by-user') return
      setError(authErrorMessage(err))
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t('common:appName')}</h1>
        <p className="mt-2 text-ink-2">{t('common:tagline')}</p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          {t('auth:email')}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-card border border-hairline bg-surface-2 px-4 text-base text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          {t('auth:password')}
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-card border border-hairline bg-surface-2 px-4 text-base text-ink outline-none focus:border-accent"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-status-over">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 h-12 rounded-card bg-accent font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {mode === 'signIn' ? t('auth:signIn') : t('auth:signUp')}
        </button>
      </form>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={google}
          className="h-12 rounded-card border border-hairline bg-surface font-medium text-ink transition-transform active:scale-[0.98]"
        >
          {t('auth:signInWithGoogle')}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn')
            setError(null)
          }}
          className="text-sm text-ink-2 underline-offset-4 hover:underline"
        >
          {mode === 'signIn' ? t('auth:noAccount') : t('auth:hasAccount')}
        </button>
      </div>
    </main>
  )
}
