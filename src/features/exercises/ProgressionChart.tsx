import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { estimateSet1Rm } from '@/domain/oneRepMax'
import { exerciseVolume } from '@/domain/volume'
import { isWorkingSet } from '@/domain/volume'
import type { OneRmFormula, WithId, Workout } from '@/domain/types'
import { formatShortDate } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'
import type { ProgressionMetric } from './ExerciseDetailScreen'

/** Progression of an exercise: max weight / estimated 1RM / volume per session. */
export function ProgressionChart({
  workouts,
  exerciseId,
  metric,
  formula,
}: {
  workouts: WithId<Workout>[]
  exerciseId: string
  metric: ProgressionMetric
  formula: OneRmFormula
}) {
  const data = useMemo(() => {
    return [...workouts]
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
      .filter((d) => d.value != null)
  }, [workouts, exerciseId, metric, formula])

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
              const p = payload[0].payload as { dateKey: string; value: number }
              return (
                <div className="rounded-card border border-hairline bg-surface-2 px-3 py-2 text-xs">
                  <div className="text-ink-3">{formatShortDate(new Date(p.dateKey))}</div>
                  <div className="tnum mt-0.5 font-semibold text-ink">{formatKg(p.value)} kg</div>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
