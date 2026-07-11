import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartPie } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { startOfWeek, subDays } from 'date-fns'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCompletedWorkouts } from '@/data/hooks'
import { muscleGroups, type MuscleGroup, type WithId, type Workout } from '@/domain/types'
import { formatShortDate, toDateKey } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'

type RangeKey = '4w' | '3m' | '1y' | 'all'
const rangeDays: Record<RangeKey, number | null> = { '4w': 28, '3m': 91, '1y': 365, all: null }

export function AnalyticsScreen() {
  const { t } = useTranslation(['analytics', 'exercises', 'common'])
  const workouts = useCompletedWorkouts(500)
  const [range, setRange] = useState<RangeKey>('3m')

  const filtered = useMemo(() => {
    if (!workouts) return []
    const days = rangeDays[range]
    if (days == null) return workouts
    const from = toDateKey(subDays(new Date(), days))
    return workouts.filter((w) => w.dateKey >= from)
  }, [workouts, range])

  if (workouts === undefined) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('analytics:title')}</h1>

      <div className="flex gap-1.5">
        {(Object.keys(rangeDays) as RangeKey[]).map((k) => (
          <Chip
            key={k}
            label={t(`analytics:range.${k}`)}
            active={range === k}
            onClick={() => setRange(k)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ChartPie} title={t('analytics:empty')} />
      ) : (
        <>
          <SetsPerMuscle workouts={filtered} />
          <VolumeTrend workouts={filtered} />
          <Frequency workouts={filtered} />
        </>
      )}
    </div>
  )
}

/** Effective sets per muscle group in the range (horizontal bar, single tone). */
function SetsPerMuscle({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation(['analytics', 'exercises'])

  const data = useMemo(() => {
    const totals = new Map<MuscleGroup, number>()
    for (const w of workouts) {
      for (const [m, n] of Object.entries(w.setsByMuscle ?? {})) {
        totals.set(m as MuscleGroup, (totals.get(m as MuscleGroup) ?? 0) + n)
      }
    }
    return muscleGroups
      .filter((m) => (totals.get(m) ?? 0) > 0)
      .map((m) => ({ muscle: t(`exercises:muscle.${m}`), sets: totals.get(m)! }))
      .sort((a, b) => b.sets - a.sets)
  }, [workouts, t])

  if (data.length === 0) return null
  const height = Math.max(120, data.length * 34 + 30)

  return (
    <Card title={t('analytics:setsPerMuscle')}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="muscle"
              width={88}
              tick={{ fill: 'var(--ink-2)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<SimpleTooltip unit="" />} />
            <Bar
              dataKey="sets"
              fill="var(--accent)"
              radius={[0, 4, 4, 0]}
              barSize={18}
              label={{ position: 'right', fill: 'var(--ink-2)', fontSize: 11 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

/** Total volume per week (line, single tone). */
function VolumeTrend({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation(['analytics', 'common'])

  const data = useMemo(() => weeklyTotals(workouts, (w) => w.totalVolumeKg ?? 0), [workouts])
  if (data.length < 2) return null

  return (
    <Card title={t('analytics:volumeTrend')}>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="week"
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
              width={52}
            />
            <Tooltip
              cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 3' }}
              content={<SimpleTooltip unit={` ${t('common:units.kg')}`} kg />}
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
    </Card>
  )
}

/** Workouts per week (bars, single tone). */
function Frequency({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation('analytics')

  const data = useMemo(() => weeklyTotals(workouts, () => 1), [workouts])
  if (data.length < 2) return null

  return (
    <Card title={t('frequency')}>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="week"
              tickFormatter={(d: string) => formatShortDate(new Date(d))}
              tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--hairline)' }}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<SimpleTooltip unit="" />} />
            <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function weeklyTotals(
  workouts: WithId<Workout>[],
  pick: (w: WithId<Workout>) => number,
): { week: string; value: number }[] {
  const map = new Map<string, number>()
  for (const w of workouts) {
    const week = toDateKey(startOfWeek(new Date(w.dateKey), { weekStartsOn: 1 }))
    map.set(week, (map.get(week) ?? 0) + pick(w))
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, value]) => ({ week, value }))
}

function SimpleTooltip({
  active,
  payload,
  unit,
  kg = false,
}: {
  active?: boolean
  payload?: { value: number; payload: { week?: string; muscle?: string } }[]
  unit: string
  kg?: boolean
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const label = p.payload.muscle ?? (p.payload.week ? formatShortDate(new Date(p.payload.week)) : '')
  return (
    <div className="rounded-card border border-hairline bg-surface-2 px-3 py-2 text-xs">
      <div className="text-ink-3">{label}</div>
      <div className="tnum mt-0.5 font-semibold text-ink">
        {kg ? formatKg(p.value) : p.value}
        {unit}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-3">
      <h2 className="pb-2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}
