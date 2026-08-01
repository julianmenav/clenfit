import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NumericField } from '@/components/ui/NumericField'
import {
  formatKg,
  formatKm,
  parseDecimal,
  parseInteger,
  parseKmToMeters,
  parseTimeToSeconds,
} from '@/lib/formatSet'
import { formatClock } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Measurement, SetEntry, SetType } from '@/domain/types'

const typeStyles: Record<SetType, string> = {
  normal: 'bg-surface-2 text-ink-2',
  warmup: 'bg-status-warn/20 text-status-warn',
  dropset: 'bg-accent/20 text-accent',
  failure: 'bg-status-over/20 text-status-over',
}

/**
 * A single set row: type badge (tap = cycle Normal→C→D→F), fields based on the
 * exercise's tracking type with ghosts from the last session, and a large check.
 */
export function SetRow({
  set,
  index,
  measurement,
  ghost,
  onPatch,
  onWeight,
  onCycleType,
  onComplete,
}: {
  set: SetEntry
  index: number
  measurement: Measurement
  /** the equivalent set from the last session (placeholder + autocomplete) */
  ghost?: SetEntry
  onPatch: (patch: Partial<SetEntry>) => void
  /** weight commits go through here so they can carry to the following sets */
  onWeight?: (weightKg: number | null) => void
  onCycleType: () => void
  onComplete: () => void
}) {
  const { t } = useTranslation('workout')

  const badge =
    set.type === 'normal' ? String(index + 1) : t(`setTypeShort.${set.type as Exclude<SetType, 'normal'>}`)

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-card px-1.5 py-1',
        set.completed && 'bg-status-ok/10',
      )}
    >
      <button
        type="button"
        onClick={onCycleType}
        aria-label={t(`setTypes.${set.type}`)}
        title={t(`setTypes.${set.type}`)}
        className={cn(
          'tnum flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          typeStyles[set.type],
        )}
      >
        {badge}
      </button>

      <Fields
        set={set}
        measurement={measurement}
        ghost={ghost}
        onPatch={onPatch}
        onWeight={onWeight}
      />

      <button
        type="button"
        onClick={onComplete}
        aria-label={t('setN', { n: index + 1 })}
        aria-pressed={set.completed}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-card transition-colors',
          set.completed ? 'bg-status-ok text-white' : 'bg-surface-2 text-ink-3 active:bg-surface',
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>
    </div>
  )
}

function Fields({
  set,
  measurement,
  ghost,
  onPatch,
  onWeight,
}: {
  set: SetEntry
  measurement: Measurement
  ghost?: SetEntry
  onPatch: (patch: Partial<SetEntry>) => void
  onWeight?: (weightKg: number | null) => void
}) {
  const { t } = useTranslation('workout')

  const commitWeight = onWeight ?? ((v: number | null) => onPatch({ weightKg: v }))
  const weight = (
    <NumericField
      key="w"
      ariaLabel={t('weight')}
      value={set.weightKg}
      format={formatKg}
      parse={parseDecimal}
      onCommit={commitWeight}
      ghost={ghost?.weightKg != null ? formatKg(ghost.weightKg) : undefined}
      onAdoptGhost={
        ghost?.weightKg != null ? () => commitWeight(ghost.weightKg) : undefined
      }
    />
  )
  const reps = (
    <NumericField
      key="r"
      ariaLabel={t('reps')}
      value={set.reps}
      format={String}
      parse={parseInteger}
      inputMode="numeric"
      onCommit={(v) => onPatch({ reps: v })}
      ghost={ghost?.reps != null ? String(ghost.reps) : undefined}
      onAdoptGhost={ghost?.reps != null ? () => onPatch({ reps: ghost.reps }) : undefined}
    />
  )
  const time = (
    <NumericField
      key="t"
      ariaLabel={t('time')}
      value={set.durationSeconds}
      format={formatClock}
      parse={parseTimeToSeconds}
      onCommit={(v) => onPatch({ durationSeconds: v })}
      ghost={ghost?.durationSeconds != null ? formatClock(ghost.durationSeconds) : undefined}
      onAdoptGhost={
        ghost?.durationSeconds != null
          ? () => onPatch({ durationSeconds: ghost.durationSeconds })
          : undefined
      }
    />
  )
  const distance = (
    <NumericField
      key="d"
      ariaLabel={t('distance')}
      value={set.distanceMeters}
      format={formatKm}
      parse={parseKmToMeters}
      onCommit={(v) => onPatch({ distanceMeters: v })}
      ghost={ghost?.distanceMeters != null ? formatKm(ghost.distanceMeters) : undefined}
      onAdoptGhost={
        ghost?.distanceMeters != null
          ? () => onPatch({ distanceMeters: ghost.distanceMeters })
          : undefined
      }
    />
  )

  switch (measurement) {
    case 'weight_reps':
      return (
        <>
          {weight}
          {reps}
        </>
      )
    case 'reps_only':
      return reps
    case 'time_only':
      return time
    case 'weight_time':
      return (
        <>
          {weight}
          {time}
        </>
      )
    case 'distance_time':
      return (
        <>
          {distance}
          {time}
        </>
      )
  }
}

/** Column header consistent with Fields. */
export function SetHeader({ measurement }: { measurement: Measurement }) {
  const { t } = useTranslation(['workout', 'common'])
  const cols: string[] =
    measurement === 'weight_reps'
      ? [t('common:units.kg'), t('workout:reps')]
      : measurement === 'reps_only'
        ? [t('workout:reps')]
        : measurement === 'time_only'
          ? [t('workout:time')]
          : measurement === 'weight_time'
            ? [t('common:units.kg'), t('workout:time')]
            : [t('common:units.km'), t('workout:time')]

  return (
    <div className="flex items-center gap-2 px-1.5 text-xs text-ink-3">
      <span className="size-9 shrink-0 text-center leading-9">{t('workout:set')}</span>
      {cols.map((c) => (
        <span key={c} className="w-full text-center">
          {c}
        </span>
      ))}
      <span className="size-11 shrink-0" />
    </div>
  )
}
