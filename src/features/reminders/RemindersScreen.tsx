import { Link } from 'react-router'
import { BellRing, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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

/** Shared by the list and the editor: human trigger label. */
export function triggerLabel(trigger: Reminder['trigger'], t: TFunction<['reminders', 'exercises']>): string {
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
