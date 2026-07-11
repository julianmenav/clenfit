import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowLeftRight, Trash2, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useWorkout } from '@/data/hooks'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { deleteCompletedWorkout } from '@/data/workoutMutations'
import { formatDay, formatDuration } from '@/lib/dates'
import { formatKg, formatSet } from '@/lib/formatSet'
import type { SetType } from '@/domain/types'

export function WorkoutDetailScreen() {
  const { workoutId = '' } = useParams()
  const uid = useUser().uid
  const navigate = useNavigate()
  const { t } = useTranslation(['history', 'workout', 'common'])
  const workout = useWorkout(workoutId)
  const { byId } = useExerciseIndex()
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)

  if (workout === undefined) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }
  if (workout === null) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:error.generic')}</p>
  }

  async function remove() {
    if (!workout || busy) return
    setBusy(true)
    try {
      await deleteCompletedWorkout(uid, workout)
      navigate('/historial', { replace: true })
    } finally {
      setBusy(false)
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header className="flex items-center gap-2">
        <Link
          to="/historial"
          aria-label={t('common:actions.back')}
          className="flex size-10 items-center justify-center rounded-card text-ink-2 active:bg-surface-2"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{workout.name}</h1>
          <p className="text-xs text-ink-3">{formatDay(new Date(workout.dateKey))}</p>
        </div>
        <button
          type="button"
          aria-label={t('common:actions.delete')}
          onClick={() => setDeleting(true)}
          className="flex size-10 items-center justify-center rounded-card border border-hairline text-status-over"
        >
          <Trash2 className="size-4" />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={t('common:stats.duration')}
          value={workout.durationSeconds != null ? formatDuration(workout.durationSeconds) : '—'}
        />
        <Stat
          label={`${t('common:stats.volume')} (${t('common:units.kg')})`}
          value={formatKg(workout.totalVolumeKg ?? 0)}
        />
        <Stat label={t('workout:sets')} value={String(workout.totalSets ?? 0)} />
      </div>

      {(workout.prCount ?? 0) > 0 && (
        <p className="flex items-center gap-2 rounded-card bg-status-warn/10 px-3 py-2 text-sm font-medium text-status-warn">
          <Trophy className="size-4" />
          {t('workout:finishSheet.prs', { count: workout.prCount ?? 0 })}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {workout.exercises.map((ex, i) => (
          <section key={i} className="rounded-card border border-hairline bg-surface p-3">
            <Link to={`/ejercicios/${ex.exerciseId}`} className="font-semibold">
              {ex.exerciseName}
            </Link>
            {ex.swappedFrom && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                <ArrowLeftRight className="size-3" />
                {t('history:swappedFrom', {
                  name: byId.get(ex.swappedFrom)?.name ?? ex.swappedFrom,
                })}
              </p>
            )}
            <ul className="mt-2 flex flex-col gap-1">
              {ex.sets.map((set, j) => (
                <li key={j} className="flex items-center gap-3 text-sm">
                  <TypeBadge type={set.type} index={j} />
                  <span className="tnum">{formatSet(set, ex.measurement)}</span>
                  {set.rpe != null && <span className="text-xs text-ink-3">RPE {set.rpe}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {workout.notes && <p className="rounded-card bg-surface-2 p-3 text-sm">{workout.notes}</p>}

      <ConfirmDialog
        open={deleting}
        title={t('common:actions.delete')}
        body={t('history:deleteConfirm')}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}

function TypeBadge({ type, index }: { type: SetType; index: number }) {
  const { t } = useTranslation('workout')
  const label =
    type === 'normal' ? String(index + 1) : t(`setTypeShort.${type as Exclude<SetType, 'normal'>}`)
  const color =
    type === 'warmup'
      ? 'text-status-warn'
      : type === 'dropset'
        ? 'text-accent'
        : type === 'failure'
          ? 'text-status-over'
          : 'text-ink-3'
  return (
    <span
      className={`tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold ${color}`}
    >
      {label}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface px-3 py-2.5 text-center">
      <div className="tnum text-lg font-bold">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  )
}
