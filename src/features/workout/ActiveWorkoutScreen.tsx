import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Dumbbell, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAllExerciseStats, useUserProfile } from '@/data/hooks'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { saveWorkoutAsRoutine, updateRoutineSlots } from '@/data/workoutMutations'
import { ghostForSet } from '@/domain/ghosts'
import { detectLiveSetPrs, isBaselineSession, prDisplayType } from '@/domain/prs'
import type { ExerciseDef, SetEntry } from '@/domain/types'
import { formatClock } from '@/lib/dates'
import { useActiveWorkoutStore } from '@/store/activeWorkout'
import { useRestTimerStore } from '@/store/restTimer'
import { ExercisePicker } from '@/features/exercises/ExercisePicker'
import { ExerciseCard } from './ExerciseCard'
import { FinishWorkoutSheet, type FinishOptions } from './FinishWorkoutSheet'
import { RestTimerBar } from './RestTimerBar'
import { useTicker } from './useTicker'

export function ActiveWorkoutScreen() {
  const uid = useUser().uid
  const navigate = useNavigate()
  const { t } = useTranslation(['workout', 'common'])
  const workout = useActiveWorkoutStore((s) => s.workout)
  const store = useActiveWorkoutStore()
  const statsMap = useAllExerciseStats()
  const { byId } = useExerciseIndex()
  const profile = useUserProfile()
  const startRest = useRestTimerStore((s) => s.start)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useTicker(1000, workout != null)

  if (!workout) return <Navigate to="/" replace />

  const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - workout.startedAt.seconds))

  function completeSet(exIndex: number, setIndex: number) {
    if (!workout) return
    const ex = workout.exercises[exIndex]
    const set = ex.sets[setIndex]

    if (set.completed) {
      store.updateSet(uid, exIndex, setIndex, { completed: false })
      return
    }

    // ghost values (last session or current-session weight fallback) if the user hasn't typed anything
    const ghost = ghostForSet(ex.sets, setIndex, statsMap?.get(ex.exerciseId)?.lastPerformance?.sets)
    const merged: SetEntry = {
      ...set,
      weightKg: set.weightKg ?? ghost?.weightKg ?? null,
      reps: set.reps ?? ghost?.reps ?? null,
      durationSeconds: set.durationSeconds ?? ghost?.durationSeconds ?? null,
      distanceMeters: set.distanceMeters ?? ghost?.distanceMeters ?? null,
      completed: true,
    }

    const hasData =
      merged.reps != null ||
      merged.durationSeconds != null ||
      merged.distanceMeters != null ||
      merged.weightKg != null
    if (!hasData) return

    store.updateSet(uid, exIndex, setIndex, merged)

    // live records (against history + what's already been done this session)
    const priorSets = workout.exercises
      .filter((e) => e.exerciseId === ex.exerciseId)
      .flatMap((e) => e.sets.filter((s) => s.completed && s !== set))
    const stats = statsMap?.get(ex.exerciseId)
    const prs = detectLiveSetPrs(merged, priorSets, stats)
    if (prs.length > 0) {
      const labels = [...new Set(prs.map((p) => t(`workout:pr.types.${prDisplayType(p)}`)))]
      toast.success(t('workout:pr.toast', { exercise: ex.exerciseName }), {
        description: labels.join(' · '),
      })
      navigator.vibrate?.(100)
    } else if (isBaselineSession(stats) && priorSets.length === 0) {
      toast.message(t('workout:pr.baseline', { exercise: ex.exerciseName }))
    }

    // automatic rest
    const restSettings = profile?.settings.restTimer
    if (restSettings?.enabled) {
      startRest(ex.restSeconds ?? restSettings.defaultSeconds)
    }
  }

  async function confirmFinish(opts: FinishOptions) {
    if (!workout || !statsMap) return
    setBusy(true)
    try {
      const result = await store.finish(uid, statsMap)
      if (!result) return
      useRestTimerStore.getState().stop()

      if (opts.saveAsRoutineName) {
        await saveWorkoutAsRoutine(uid, result.workout, opts.saveAsRoutineName)
      }
      if (opts.updateRoutine && result.workout.routineId) {
        await updateRoutineSlots(uid, result.workout.routineId, result.workout)
      }
      if (result.prCount > 0) {
        toast.success(t('workout:finishSheet.prs', { count: result.prCount }))
      }
      navigate(`/historial/${result.workout.id}`, { replace: true })
    } finally {
      setBusy(false)
      setFinishOpen(false)
    }
  }

  return (
    <div className="px-4 pt-4">
      <RestTimerBar />

      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{workout.name}</h1>
          <p className="tnum text-sm text-ink-3">{formatClock(elapsed)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label={t('workout:discard')}
            onClick={() => setDiscardOpen(true)}
            className="flex size-10 items-center justify-center rounded-card border border-hairline text-ink-3"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setFinishOpen(true)}
            className="h-10 rounded-card bg-accent px-4 font-semibold text-on-accent"
          >
            {t('workout:finish')}
          </button>
        </div>
      </header>

      {workout.exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title={t('workout:emptyTitle')}
          body={t('workout:emptyBody')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {workout.exercises.map((ex, i) => (
            <ExerciseCard
              key={`${ex.exerciseId}-${i}`}
              exercise={ex}
              stats={statsMap?.get(ex.exerciseId)}
              onPatchSet={(setIndex, patch) => store.updateSet(uid, i, setIndex, patch)}
              onCycleType={(setIndex) => store.cycleSetType(uid, i, setIndex)}
              onCompleteSet={(setIndex) => completeSet(i, setIndex)}
              onAddSet={() => store.addSet(uid, i)}
              onRemoveLastSet={() => store.removeSet(uid, i, ex.sets.length - 1)}
              onSwap={() => setSwapIndex(i)}
              onRemove={() => setRemoveIndex(i)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-hairline font-medium text-ink-2"
      >
        <Plus className="size-5" />
        {t('workout:addExercise')}
      </button>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('workout:addExercise')}
        onSelect={(def: ExerciseDef) => store.addExercise(uid, def)}
      />

      <ExercisePicker
        open={swapIndex !== null}
        onOpenChange={(open) => !open && setSwapIndex(null)}
        title={t('workout:swapExercise')}
        similarTo={
          swapIndex !== null ? byId.get(workout.exercises[swapIndex]?.exerciseId) : undefined
        }
        onSelect={(def) => {
          if (swapIndex !== null) store.swapExercise(uid, swapIndex, def)
          setSwapIndex(null)
        }}
      />

      <ConfirmDialog
        open={removeIndex !== null}
        title={t('workout:removeExercise')}
        body={
          removeIndex !== null
            ? t('workout:removeExerciseConfirm', {
                name: workout.exercises[removeIndex]?.exerciseName,
              })
            : undefined
        }
        onConfirm={() => {
          if (removeIndex !== null) store.removeExercise(uid, removeIndex)
          setRemoveIndex(null)
        }}
        onCancel={() => setRemoveIndex(null)}
      />

      <ConfirmDialog
        open={discardOpen}
        title={t('workout:discard')}
        body={t('workout:discardConfirm')}
        onConfirm={() => {
          setDiscardOpen(false)
          useRestTimerStore.getState().stop()
          void store.discard(uid)
          navigate('/', { replace: true })
        }}
        onCancel={() => setDiscardOpen(false)}
      />

      <FinishWorkoutSheet
        open={finishOpen}
        onOpenChange={setFinishOpen}
        workout={workout}
        onConfirm={(opts) => void confirmFinish(opts)}
        busy={busy}
      />
    </div>
  )
}
