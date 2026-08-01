import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { BackButton } from '@/components/ui/BackButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NumericField } from '@/components/ui/NumericField'
import { useRoutines } from '@/data/hooks'
import { archiveRoutine, createRoutine, updateRoutine } from '@/data/routineMutations'
import type { ExerciseDef, RoutineSlot } from '@/domain/types'
import { parseInteger } from '@/lib/formatSet'
import { ExercisePicker } from '@/features/exercises/ExercisePicker'

export function RoutineEditorScreen() {
  const { routineId } = useParams()
  const uid = useUser().uid
  const navigate = useNavigate()
  const { t } = useTranslation(['routines', 'common'])
  const routines = useRoutines()
  const existing = routineId ? routines?.find((r) => r.id === routineId) : undefined

  const [name, setName] = useState('')
  const [slots, setSlots] = useState<RoutineSlot[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // one-time load when opening an existing routine (without clobbering the in-progress edit)
  useEffect(() => {
    if (loaded || routineId == null) return
    if (existing) {
      setName(existing.name)
      setSlots(existing.slots)
      setLoaded(true)
    }
  }, [existing, loaded, routineId])

  function patchSlot(index: number, patch: Partial<RoutineSlot>) {
    setSlots(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= slots.length) return
    const next = [...slots]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSlots(next.map((s, i) => ({ ...s, order: i })))
  }

  function addExercise(def: ExerciseDef) {
    setSlots([
      ...slots,
      {
        exerciseId: def.id,
        exerciseName: def.name,
        order: slots.length,
        targetSets: 3,
        targetReps: null,
        restSeconds: null,
      },
    ])
  }

  // writes are not awaited: offline they stay queued in Firestore until reconnect
  function save() {
    if (!name.trim() || slots.length === 0) return
    const input = { name: name.trim(), slots: slots.map((s, i) => ({ ...s, order: i })) }
    if (existing) {
      updateRoutine(uid, existing, input).catch((err) => console.error('[updateRoutine]', err))
    } else {
      createRoutine(uid, input)
    }
    navigate('/rutinas', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header className="flex items-center gap-2">
        <BackButton fallback="/rutinas" />
        <h1 className="flex-1 text-xl font-bold">
          {existing ? t('routines:edit') : t('routines:new')}
        </h1>
        {existing && (
          <button
            type="button"
            aria-label={t('common:actions.delete')}
            onClick={() => setDeleting(true)}
            className="flex size-10 items-center justify-center rounded-card border border-hairline text-status-over"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <label className="flex flex-col gap-1 text-sm text-ink-2">
        {t('routines:name')}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('routines:namePlaceholder')}
          className="h-12 rounded-card border border-hairline bg-surface-2 px-4 text-base text-ink outline-none focus:border-accent"
        />
      </label>

      <div className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <div key={`${slot.exerciseId}-${i}`} className="rounded-card border border-hairline bg-surface p-3">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-medium">{slot.exerciseName}</span>
              <IconBtn
                label="↑"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                icon={<ArrowUp className="size-4" />}
              />
              <IconBtn
                label="↓"
                disabled={i === slots.length - 1}
                onClick={() => move(i, 1)}
                icon={<ArrowDown className="size-4" />}
              />
              <IconBtn
                label={t('common:actions.delete')}
                onClick={() => setSlots(slots.filter((_, j) => j !== i).map((s, j) => ({ ...s, order: j })))}
                icon={<X className="size-4" />}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <LabeledField label={t('routines:targetSets')}>
                <NumericField
                  value={slot.targetSets}
                  format={String}
                  parse={parseInteger}
                  inputMode="numeric"
                  onCommit={(v) => patchSlot(i, { targetSets: v })}
                  ariaLabel={t('routines:targetSets')}
                />
              </LabeledField>
              <LabeledField label={t('routines:targetReps')}>
                <input
                  type="text"
                  value={slot.targetReps ?? ''}
                  placeholder={t('routines:targetRepsPlaceholder')}
                  onChange={(e) => patchSlot(i, { targetReps: e.target.value || null })}
                  className="tnum h-11 w-full rounded-card border border-hairline bg-surface-2 text-center text-base font-medium outline-none placeholder:text-ink-3/70 focus:border-accent"
                  aria-label={t('routines:targetReps')}
                />
              </LabeledField>
              <LabeledField label={t('routines:restSeconds')}>
                <NumericField
                  value={slot.restSeconds}
                  format={String}
                  parse={parseInteger}
                  inputMode="numeric"
                  onCommit={(v) => patchSlot(i, { restSeconds: v })}
                  ariaLabel={t('routines:restSeconds')}
                />
              </LabeledField>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-card border border-dashed border-hairline font-medium text-ink-2"
      >
        <Plus className="size-5" />
        {t('routines:addExercise')}
      </button>

      <button
        type="button"
        disabled={!name.trim() || slots.length === 0}
        onClick={save}
        className="h-12 rounded-card bg-accent font-semibold text-on-accent disabled:opacity-60"
      >
        {t('common:actions.save')}
      </button>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('routines:addExercise')}
        onSelect={addExercise}
      />

      <ConfirmDialog
        open={deleting}
        title={t('common:actions.delete')}
        body={existing ? t('routines:deleteConfirm', { name: existing.name }) : undefined}
        onConfirm={() => {
          if (existing) void archiveRoutine(uid, existing.id)
          navigate('/rutinas', { replace: true })
        }}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}

function IconBtn({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-card text-ink-3 active:bg-surface-2 disabled:opacity-30"
    >
      {icon}
    </button>
  )
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-3">
      {label}
      {children}
    </label>
  )
}
