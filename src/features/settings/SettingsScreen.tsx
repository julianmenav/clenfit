import { signOut } from 'firebase/auth'
import { updateDoc } from 'firebase/firestore'
import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { userDoc } from '@/data/converters'
import { useUserProfile } from '@/data/hooks'
import type { OneRmFormula } from '@/domain/types'
import { auth } from '@/lib/firebase'
import { applyThemePref, type ThemePref } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function SettingsScreen() {
  const user = useUser()
  const profile = useUserProfile()
  const { t } = useTranslation(['settings', 'common'])

  if (!profile) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  const s = profile.settings

  function update(patch: Record<string, unknown>) {
    updateDoc(userDoc(user.uid), patch).catch((err) => console.error('[settings]', err))
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings:title')}</h1>

      <Section title={t('settings:theme.title')}>
        <Segmented
          value={s.theme}
          options={[
            { value: 'system', label: t('settings:theme.system') },
            { value: 'light', label: t('settings:theme.light') },
            { value: 'dark', label: t('settings:theme.dark') },
          ]}
          onChange={(theme) => {
            applyThemePref(theme as ThemePref)
            update({ 'settings.theme': theme })
          }}
        />
      </Section>

      <Section title={t('settings:restTimer.title')}>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">{t('settings:restTimer.enabled')}</span>
          <input
            type="checkbox"
            checked={s.restTimer.enabled}
            onChange={(e) => update({ 'settings.restTimer.enabled': e.target.checked })}
            className="size-5 accent-(--accent)"
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">{t('settings:restTimer.duration')}</span>
          <div className="flex items-center gap-2">
            <Stepper
              onClick={() =>
                update({
                  'settings.restTimer.defaultSeconds': Math.max(15, s.restTimer.defaultSeconds - 15),
                })
              }
              label="−15"
            />
            <span className="tnum w-16 text-center font-semibold">
              {t('settings:restTimer.seconds', { count: s.restTimer.defaultSeconds })}
            </span>
            <Stepper
              onClick={() =>
                update({
                  'settings.restTimer.defaultSeconds': Math.min(600, s.restTimer.defaultSeconds + 15),
                })
              }
              label="+15"
            />
          </div>
        </div>
      </Section>

      <Section title={t('settings:oneRm.title')} help={t('settings:oneRm.help')}>
        <Segmented
          value={s.oneRmFormula}
          options={[
            { value: 'epley', label: t('settings:oneRm.epley') },
            { value: 'brzycki', label: t('settings:oneRm.brzycki') },
          ]}
          onChange={(f) => update({ 'settings.oneRmFormula': f as OneRmFormula })}
        />
      </Section>

      <Section title={t('settings:account')}>
        <p className="pb-3 text-sm text-ink-2">{user.email}</p>
        <button
          type="button"
          onClick={() => void signOut(auth)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-hairline font-medium text-status-over"
        >
          <LogOut className="size-4" />
          {t('settings:signOut')}
        </button>
      </Section>
    </div>
  )
}

function Section({
  title,
  help,
  children,
}: {
  title: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-4">
      <h2 className="pb-3 font-semibold">{title}</h2>
      {children}
      {help && <p className="mt-3 text-xs text-ink-3">{help}</p>}
    </section>
  )
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex rounded-card bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'h-9 flex-1 rounded-[10px] text-sm font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tnum h-9 rounded-chip bg-surface-2 px-3 text-sm font-semibold"
    >
      {label}
    </button>
  )
}
