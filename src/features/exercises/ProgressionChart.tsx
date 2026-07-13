import { useMemo, type Key } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { runningMaxFlags } from '@/domain/analytics'
import { estimateSet1Rm } from '@/domain/oneRepMax'
import { exerciseVolume } from '@/domain/volume'
import { isWorkingSet } from '@/domain/volume'
import type { OneRmFormula, WithId, Workout } from '@/domain/types'
import { formatShortDate } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'
import type { ProgressionMetric } from './ExerciseDetailScreen'

interface Point {
  dateKey: string
  value: number
  isPr: boolean
}

/** Progression of an exercise: max weight / estimated 1RM / volume per session. */
export function ProgressionChart({
  workouts,
  exerciseId,
  metric,
  formula,
  showPrMarkers = true,
  fromDateKey,
}: {
  workouts: WithId<Workout>[]
  exerciseId: string
  metric: ProgressionMetric
  formula: OneRmFormula
  showPrMarkers?: boolean
  /** Display cutoff; PR flags are computed on the full series before trimming. */
  fromDateKey?: string
}) {
  const { t } = useTranslation('exercises')

  const data = useMemo(() => {
    const series = [...workouts]
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map((w) => {
        const sets = w.exercises
          .filter((e) => e.exerciseId === exerciseId)
          .flatMap((e) => e.sets)
        const working = sets.filter(isWorkingSet)
        let value: number | null = null
        if (metric === 'weight') {
          const weights = working.map((s) => s.weightKg ?? 0).filter((v) => v > 0)
          value = weights.length ? Math.max(...weights) : null
        } else if (metric === 'oneRm') {
          const rms = working
            .map((s) => estimateSet1Rm(s, formula))
            .filter((v): v is number => v != null)
          value = rms.length ? Math.max(...rms) : null
        } else {
          const vol = w.exercises
            .filter((e) => e.exerciseId === exerciseId)
            .reduce((sum, e) => sum + exerciseVolume(e), 0)
          value = vol > 0 ? vol : null
        }
        return { dateKey: w.dateKey, value }
      })
      .filter((d): d is { dateKey: string; value: number } => d.value != null)

    const flags = runningMaxFlags(series.map((d) => d.value))
    const points: Point[] = series.map((d, i) => ({ ...d, isPr: showPrMarkers && flags[i] }))
    return fromDateKey == null ? points : points.filter((d) => d.dateKey >= fromDateKey)
  }, [workouts, exerciseId, metric, formula, showPrMarkers, fromDateKey])

  if (data.length < 2) return null

  return (
    <div className="h-52 rounded-card border border-hairline bg-surface p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--hairline)" vertical={false} />
          <XAxis
            dataKey="dateKey"
            tickFormatter={(d: string) => formatShortDate(new Date(d))}
            tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--hairline)' }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as Point
              return (
                <div className="rounded-card border border-hairline bg-surface-2 px-3 py-2 text-xs">
                  <div className="text-ink-3">{formatShortDate(new Date(p.dateKey))}</div>
                  <div className="tnum mt-0.5 font-semibold text-ink">{formatKg(p.value)} kg</div>
                  {p.isPr && (
                    <div className="mt-0.5 font-medium text-status-warn">
                      {t('detail.prPoint')}
                    </div>
                  )}
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={(props: { key?: Key | null; cx?: number; cy?: number; payload?: Point }) => {
              const { key, cx, cy, payload } = props
              if (payload?.isPr) {
                return (
                  <circle
                    key={key}
                    cx={cx}
                    cy={cy}
                    r={4.5}
                    fill="var(--status-warn)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                )
              }
              return (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              )
            }}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
