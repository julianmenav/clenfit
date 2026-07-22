import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { ArrowLeft, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NumericField } from '@/components/ui/NumericField'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { useAllExerciseStats, useUserProfile, useWorkout } from '@/data/hooks'
import { exerciseFromDef, newWorkoutId, saveEditedWorkout } from '@/data/workoutMutations'
import type { WithId, Workout } from '@/domain/types'
import {
  normalizeEditedSets,
  withAddedExercise,
  withAddedSet,
  withCycledSetType,
  withExerciseNotes,
  withMovedExercise,
  withRemovedExercise,
  withRemovedSet,
  withSetPatch,
  withSwappedExercise,
} from '@/domain/workoutEdit'
import { toDateKey } from '@/lib/dates'
import { formatKg, parseDecimal, parseInteger } from '@/lib/formatSet'
import { ExercisePicker } from '@/features/exercises/ExercisePicker'
import { ExerciseCard } from '@/features/workout/ExerciseCard'
import { ExerciseHistorySheet } from '@/features/workout/ExerciseHistorySheet'
import { ReorderSheet } from '@/features/workout/ReorderSheet'

/** Create (/historial/nuevo) or edit (/historial/:workoutId/editar) a completed workout. */
export function WorkoutEditorScreen() {
  const { workoutId } = useParams()
  if (!workoutId) return <CreateEditor />
  return <EditExisting workoutId={workoutId} />
}

function CreateEditor() {
  const uid = useUser().uid
  const { t } = useTranslation('history')
  const [initial] = useState<WithId<Workout>>(() => {
    const now = new Date()
    return {
      id: newWorkoutId(uid),
      status: 'completed',
      name: t('editor.defaultName'),
      routineId: null,
      startedAt: Timestamp.fromDate(now),
      completedAt: null,
      durationSeconds: null,
      dateKey: toDateKey(now),
      notes: null,
      bodyWeightKg: null,
      exerciseIds: [],
      exercises: [],
      totalVolumeKg: null,
      totalSets: null,
      prCount: null,
      setsByMuscle: null,
    }
  })
  return <Editor initial={initial} previousExerciseIds={[]} isNew />
}

function EditExisting({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation('common')
  const remote = useWorkout(workoutId)

  if (remote === undefined) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('loading')}</p>
  }
  // only finished sessions are editable here; the active one lives in its own screen
  if (remote === null || remote.status !== 'completed') {
    return <Navigate to="/historial" replace />
  }
  return (
    <Editor
      key={remote.id}
      initial={remote}
      previousExerciseIds={remote.exerciseIds}
      isNew={false}
    />
  )
}

function Editor({
  initial,
  previousExerciseIds,
  isNew,
}: {
  initial: WithId<Workout>
  previousExerciseIds: string[]
  isNew: boolean
}) {
  const uid = useUser().uid
  const navigate = useNavigate()
  const { t } = useTranslation(['history', 'workout', 'common'])
  const { byId } = useExerciseIndex()
  const statsMap = useAllExerciseStats()
  const profile = useUserProfile()

  // local draft: the editor never touches the active-workout store
  const [draft, setDraft] = useState(initial)
  const [date, setDate] = useState(initial.dateKey)
  const [time, setTime] = useState(format(initial.startedAt.toDate(), 'HH:mm'))
  const [durationMin, setDurationMin] = useState<number | null>(
    initial.durationSeconds != null ? Math.round(initial.durationSeconds / 60) : null,
  )
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null)

  const hasBodyweight = draft.exercises.some((ex) => ex.usesBodyweight)
  const bodyWeightKg = draft.bodyWeightKg ?? profile?.settings.bodyWeightKg ?? null

  const normalized = useMemo(() => normalizeEditedSets(draft.exercises), [draft.exercises])
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const canSave = !busy && normalized.length > 0 && draft.name.trim().length > 0 && hasValidDate

  async function save() {
    if (!canSave) return
    setBusy(true)
    try {
      // local-time parse: new Date('YYYY-MM-DD') alone would be UTC midnight
      const startedAt = Timestamp.fromDate(new Date(`${date}T${time || '12:00'}`))
      const durationSeconds = durationMin != null ? Math.max(0, durationMin) * 60 : null
      const completedAt = Timestamp.fromMillis(
        startedAt.toMillis() + (durationSeconds ?? 0) * 1000,
      )
      await saveEditedWorkout(
        uid,
        {
          ...draft,
          name: draft.name.trim(),
          startedAt,
          completedAt,
          durationSeconds,
          dateKey: date,
          bodyWeightKg: hasBodyweight ? bodyWeightKg : (draft.bodyWeightKg ?? null),
        },
        previousExerciseIds,
      )
      navigate(`/historial/${draft.id}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header className="flex items-center gap-2">
        <Link
          to={isNew ? '/historial' : `/historial/${initial.id}`}
          aria-label={t('common:actions.back')}
          className="flex size-10 items-center justify-center rounded-card text-ink-2 active:bg-surface-2"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">
          {isNew ? t('history:editor.titleNew') : t('history:editor.titleEdit')}
        </h1>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="h-10 rounded-card bg-accent px-4 font-semibold text-on-accent disabled:opacity-60"
        >
          {t('common:actions.save')}
        </button>
      </header>

      <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-3">
        <Field label={t('history:editor.name')}>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="h-11 w-full rounded-card border border-hairline bg-surface-2 px-3 text-base outline-none focus:border-accent"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('history:editor.date')}>
            <input
              type="date"
              value={date}
              max={toDateKey(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-card border border-hairline bg-surface-2 px-3 text-base outline-none focus:border-accent"
            />
          </Field>
          <Field label={t('history:editor.startTime')}>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 w-full rounded-card border border-hairline bg-surface-2 px-3 text-base outline-none focus:border-accent"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('history:editor.duration')}>
            <NumericField
              ariaLabel={t('history:editor.duration')}
              value={durationMin}
              format={String}
              parse={parseInteger}
              inputMode="numeric"
              onCommit={setDurationMin}
              className="text-left px-3"
            />
          </Field>
          {hasBodyweight && (
            <Field label={t('workout:finishSheet.bodyWeight')}>
              <div className="flex items-center gap-2">
                <NumericField
                  ariaLabel={t('workout:finishSheet.bodyWeight')}
                  value={bodyWeightKg}
                  format={formatKg}
                  parse={parseDecimal}
                  onCommit={(v) => setDraft((d) => ({ ...d, bodyWeightKg: v }))}
                  className="text-left px-3"
                />
                <span className="text-sm text-ink-3">{t('common:units.kg')}</span>
              </div>
            </Field>
          )}
        </div>
      </section>

      {draft.exercises.length > 0 && (
        <div className="flex flex-col gap-3">
          {draft.exercises.map((ex, i) => (
            <ExerciseCard
              key={`${ex.exerciseId}-${i}`}
              exercise={ex}
              stats={statsMap?.get(ex.exerciseId)}
              onPatchSet={(setIndex, patch) =>
                setDraft((d) => withSetPatch(d, i, setIndex, patch))
              }
              onCycleType={(setIndex) => setDraft((d) => withCycledSetType(d, i, setIndex))}
              onCompleteSet={(setIndex) =>
                setDraft((d) =>
                  withSetPatch(d, i, setIndex, {
                    completed: !d.exercises[i].sets[setIndex].completed,
                  }),
                )
              }
              onAddSet={() => setDraft((d) => withAddedSet(d, i))}
              onRemoveLastSet={() =>
                setDraft((d) => withRemovedSet(d, i, d.exercises[i].sets.length - 1))
              }
              onSwap={() => setSwapIndex(i)}
              onRemove={() => setRemoveIndex(i)}
              onReorder={draft.exercises.length > 1 ? () => setReorderOpen(true) : undefined}
              onSetNotes={(notes) => setDraft((d) => withExerciseNotes(d, i, notes))}
              onShowHistory={() => setHistoryExerciseId(ex.exerciseId)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-hairline font-medium text-ink-2"
      >
        <Plus className="size-5" />
        {t('workout:addExercise')}
      </button>

      {normalized.length === 0 && draft.exercises.length > 0 && (
        <p className="text-center text-sm text-ink-3">{t('history:editor.needsData')}</p>
      )}
      <p className="pb-2 text-center text-xs text-ink-3">{t('history:editor.statsNote')}</p>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('workout:addExercise')}
        onSelect={(def) =>
          setDraft((d) => withAddedExercise(d, exerciseFromDef(def, d.exercises.length)))
        }
      />

      <ExercisePicker
        open={swapIndex !== null}
        onOpenChange={(open) => !open && setSwapIndex(null)}
        title={t('workout:swapExercise')}
        similarTo={swapIndex !== null ? byId.get(draft.exercises[swapIndex]?.exerciseId) : undefined}
        onSelect={(def) => {
          if (swapIndex !== null) setDraft((d) => withSwappedExercise(d, swapIndex, def))
          setSwapIndex(null)
        }}
      />

      <ExerciseHistorySheet
        open={historyExerciseId !== null}
        onOpenChange={(open) => !open && setHistoryExerciseId(null)}
        exerciseId={historyExerciseId}
      />

      <ReorderSheet
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        exercises={draft.exercises}
        onMove={(from, to) => setDraft((d) => withMovedExercise(d, from, to))}
      />

      <ConfirmDialog
        open={removeIndex !== null}
        title={t('workout:removeExercise')}
        body={
          removeIndex !== null
            ? t('workout:removeExerciseConfirm', {
                name: draft.exercises[removeIndex]?.exerciseName,
              })
            : undefined
        }
        onConfirm={() => {
          if (removeIndex !== null) setDraft((d) => withRemovedExercise(d, removeIndex))
          setRemoveIndex(null)
        }}
        onCancel={() => setRemoveIndex(null)}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-3">{label}</span>
      {children}
    </label>
  )
}
