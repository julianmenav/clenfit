import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { BackButton } from '@/components/ui/BackButton'
import { Chip } from '@/components/ui/Chip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useReminders, useRoutines } from '@/data/hooks'
import { createReminder, deleteReminder, saveReminder } from '@/data/reminderMutations'
import { muscleGroups, type MuscleGroup, type ReminderTrigger } from '@/domain/types'
import { ExercisePicker } from '@/features/exercises/ExercisePicker'
import { cn } from '@/lib/utils'

const packKeys = ['beast', 'focus', 'firstRep', 'closing'] as const

const triggerTypes = ['workoutStart', 'workoutFinish', 'beforeExercise', 'beforeMuscle'] as const
type TriggerType = (typeof triggerTypes)[number]

export function ReminderEditorScreen() {
  const { reminderId } = useParams()
  const uid = useUser().uid
  const navigate = useNavigate()
  const { t } = useTranslation(['reminders', 'exercises', 'common'])
  const reminders = useReminders()
  const routines = useRoutines()

  const existing = useMemo(
    () => reminders?.find((r) => r.id === reminderId) ?? null,
    [reminders, reminderId],
  )

  // editor state, hydrated once when the existing doc arrives
  const [hydrated, setHydrated] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [triggerType, setTriggerType] = useState<TriggerType>('workoutStart')
  const [exercise, setExercise] = useState<{ id: string; name: string } | null>(null)
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [routineIds, setRoutineIds] = useState<string[] | null>(null)
  const [messages, setMessages] = useState<string[]>([''])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (existing && !hydrated) {
    setHydrated(true)
    setEnabled(existing.enabled)
    setTriggerType(existing.trigger.type)
    if (existing.trigger.type === 'beforeExercise')
      setExercise({ id: existing.trigger.exerciseId, name: existing.trigger.exerciseName })
    if (existing.trigger.type === 'beforeMuscle') setMuscle(existing.trigger.muscle)
    setRoutineIds(existing.routineIds)
    setMessages(existing.messages)
  }

  const cleanMessages = messages.map((m) => m.trim()).filter((m) => m.length > 0)
  const canSave =
    cleanMessages.length > 0 && (triggerType !== 'beforeExercise' || exercise != null)

  function buildTrigger(): ReminderTrigger {
    switch (triggerType) {
      case 'beforeExercise':
        return { type: 'beforeExercise', exerciseId: exercise!.id, exerciseName: exercise!.name }
      case 'beforeMuscle':
        return { type: 'beforeMuscle', muscle }
      default:
        return { type: triggerType }
    }
  }

  function save() {
    const data = { enabled, trigger: buildTrigger(), routineIds, messages: cleanMessages }
    if (existing) saveReminder(uid, { ...existing, ...data })
    else createReminder(uid, data)
    navigate('/recordatorios', { replace: true })
  }

  function addPack(key: (typeof packKeys)[number]) {
    const lines = t(`reminders:packs.${key}.messages`, { returnObjects: true }) as string[]
    setMessages((prev) => [...prev.filter((m) => m.trim().length > 0), ...lines])
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <header className="flex items-center gap-2">
        <BackButton fallback="/recordatorios" />
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">
          {existing ? t('reminders:editor.titleEdit') : t('reminders:editor.titleNew')}
        </h1>
        {existing && (
          <button
            type="button"
            aria-label={t('reminders:editor.delete')}
            onClick={() => setDeleting(true)}
            className="flex size-10 items-center justify-center rounded-card border border-hairline text-status-over"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <label className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-3">
        <span className="text-sm font-medium">{t('reminders:editor.enabled')}</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-5 accent-(--accent)"
        />
      </label>

      <Field title={t('reminders:editor.when')}>
        <div className="grid grid-cols-2 gap-2">
          {triggerTypes.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={triggerType === type}
              onClick={() => setTriggerType(type)}
              className={cn(
                'h-11 rounded-card border px-2 text-sm font-medium',
                triggerType === type
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-hairline bg-surface text-ink-2',
              )}
            >
              {type === 'beforeExercise'
                ? t('reminders:editor.pickExercise')
                : type === 'beforeMuscle'
                  ? t('reminders:editor.pickMuscle')
                  : t(`reminders:triggers.${type}`)}
            </button>
          ))}
        </div>

        {triggerType === 'beforeExercise' && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-card bg-surface-2 text-sm font-medium"
          >
            {exercise ? exercise.name : t('reminders:editor.pickExercise')}
          </button>
        )}

        {triggerType === 'beforeMuscle' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {muscleGroups.map((m) => (
              <Chip
                key={m}
                label={t(`exercises:muscle.${m}`)}
                active={muscle === m}
                onClick={() => setMuscle(m)}
              />
            ))}
          </div>
        )}
      </Field>

      <Field title={t('reminders:editor.routines')} help={t('reminders:editor.routinesHelp')}>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            checked={routineIds == null}
            onChange={(e) => setRoutineIds(e.target.checked ? null : [])}
            className="size-5 accent-(--accent)"
          />
          <span className="text-sm font-medium">{t('reminders:editor.allRoutines')}</span>
        </label>
        {routineIds != null &&
          (routines ?? []).map((r) => (
            <label key={r.id} className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={routineIds.includes(r.id)}
                onChange={(e) =>
                  setRoutineIds(
                    e.target.checked
                      ? [...routineIds, r.id]
                      : routineIds.filter((id) => id !== r.id),
                  )
                }
                className="size-5 accent-(--accent)"
              />
              <span className="text-sm">{r.name}</span>
            </label>
          ))}
      </Field>

      <Field title={t('reminders:editor.messages')} help={t('reminders:editor.messagesHelp')}>
        <div className="flex flex-col gap-2">
          {messages.map((message, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                value={message}
                onChange={(e) =>
                  setMessages((prev) => prev.map((m, j) => (j === i ? e.target.value : m)))
                }
                placeholder={t('reminders:editor.messagePlaceholder')}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-card border border-hairline bg-surface-2 p-2.5 text-sm outline-none focus:border-accent"
              />
              {messages.length > 1 && (
                <button
                  type="button"
                  aria-label={t('reminders:editor.removeMessage')}
                  onClick={() => setMessages((prev) => prev.filter((_, j) => j !== i))}
                  className="flex size-9 shrink-0 items-center justify-center rounded-card text-ink-3 active:bg-surface-2"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMessages((prev) => [...prev, ''])}
            className="flex h-10 items-center justify-center gap-1.5 rounded-card bg-surface-2 text-sm font-medium text-ink-2"
          >
            <Plus className="size-4" />
            {t('reminders:editor.addMessage')}
          </button>
        </div>

        <p className="mt-3 pb-1 text-xs font-medium text-ink-3">
          {t('reminders:editor.packs')} · {t('reminders:editor.packsHelp')}
        </p>
        <div className="flex flex-wrap gap-2">
          {packKeys.map((key) => (
            <Chip
              key={key}
              label={t(`reminders:packs.${key}.name`)}
              active={false}
              onClick={() => addPack(key)}
            />
          ))}
        </div>
      </Field>

      <button
        type="button"
        disabled={!canSave}
        onClick={save}
        className="h-12 rounded-card bg-accent font-semibold text-on-accent disabled:opacity-60"
      >
        {t('reminders:editor.save')}
      </button>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('reminders:editor.pickExercise')}
        onSelect={(def) => setExercise({ id: def.id, name: def.name })}
      />

      <ConfirmDialog
        open={deleting}
        title={t('reminders:editor.delete')}
        body={t('reminders:editor.deleteConfirm')}
        onConfirm={() => {
          if (existing) deleteReminder(uid, existing.id)
          navigate('/recordatorios', { replace: true })
        }}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}

function Field({
  title,
  help,
  children,
}: {
  title: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-3">
      <h2 className="pb-2 text-sm font-semibold">{title}</h2>
      {children}
      {help && <p className="mt-2 text-xs text-ink-3">{help}</p>}
    </section>
  )
}
