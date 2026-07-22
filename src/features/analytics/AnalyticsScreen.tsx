import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartPie, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { startOfWeek, subDays } from 'date-fns'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCompletedWorkouts } from '@/data/hooks'
import { useExerciseIndex } from '@/data/exerciseIndex'
import {
  bucketedTotals,
  compareWeeks,
  muscleBalance,
  muscleSetBreakdown,
  repRangeDistribution,
  type BalanceGroup,
  type MuscleSetBreakdown,
  type RepRange,
  type WeekTotals,
} from '@/domain/analytics'
import { muscleGroups, type WithId, type Workout } from '@/domain/types'
import { formatShortDate, toDateKey } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'
import { OneRmProgressionCard } from './OneRmProgressionCard'

type RangeKey = '1w' | '4w' | '3m' | '1y' | 'all'
const rangeDays: Record<RangeKey, number | null> = {
  '1w': 7,
  '4w': 28,
  '3m': 91,
  '1y': 365,
  all: null,
}

const weekStartKey = (dateKey: string) =>
  toDateKey(startOfWeek(new Date(dateKey), { weekStartsOn: 1 }))

export function AnalyticsScreen() {
  const { t } = useTranslation(['analytics', 'exercises', 'common'])
  const workouts = useCompletedWorkouts(500)
  const [range, setRange] = useState<RangeKey>('3m')

  const rangeFromKey = useMemo(() => {
    const days = rangeDays[range]
    return days == null ? undefined : toDateKey(subDays(new Date(), days))
  }, [range])

  const filtered = useMemo(() => {
    if (!workouts) return []
    if (rangeFromKey == null) return workouts
    return workouts.filter((w) => w.dateKey >= rangeFromKey)
  }, [workouts, rangeFromKey])

  if (workouts === undefined) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('analytics:title')}</h1>

      <WeeklySummary workouts={workouts} />

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
          <OneRmProgressionCard workouts={workouts} fromDateKey={rangeFromKey} />
          <SetsPerMuscle workouts={filtered} />
          <MuscleBalance workouts={filtered} />
          <RepRanges workouts={filtered} />
          <VolumeTrend workouts={filtered} daily={range === '1w'} />
          {/* workouts-per-week is meaningless inside a single week */}
          {range !== '1w' && <Frequency workouts={filtered} />}
        </>
      )}
    </div>
  )
}

/** This calendar week (Monday start) vs the previous one, with trend arrows. */
function WeeklySummary({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation(['analytics', 'common'])

  const { current, previous } = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    return compareWeeks(workouts, toDateKey(weekStart), toDateKey(subDays(weekStart, 7)))
  }, [workouts])

  const stats: { label: string; pick: (w: WeekTotals) => number; kg?: boolean }[] = [
    { label: t('analytics:weekly.workouts'), pick: (w) => w.workouts },
    { label: t('analytics:weekly.sets'), pick: (w) => w.sets },
    { label: t('analytics:weekly.volume'), pick: (w) => w.volumeKg, kg: true },
  ]

  return (
    <Card title={t('analytics:weekly.title')}>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(({ label, pick, kg }) => {
          const now = pick(current)
          const before = pick(previous)
          const delta = before > 0 ? Math.round(((now - before) / before) * 100) : null
          const Icon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown
          const tone =
            delta == null || delta === 0
              ? 'text-ink-3'
              : delta > 0
                ? 'text-status-ok'
                : 'text-status-over'
          return (
            <div key={label} className="rounded-card bg-surface-2 p-2.5">
              <p className="text-xs text-ink-3">{label}</p>
              <p className="tnum mt-0.5 text-lg font-bold">
                {kg ? formatKg(now) : now}
                {kg && <span className="text-xs font-medium text-ink-3"> {t('common:units.kg')}</span>}
              </p>
              <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${tone}`}>
                <Icon className="size-3.5" />
                {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
              </p>
            </div>
          )
        })}
      </div>
      <p className="pt-2 text-xs text-ink-3">{t('analytics:weekly.vsPrevWeek')}</p>
    </Card>
  )
}

/** Working sets per push/pull/legs/core group (token bars, no Recharts). */
function MuscleBalance({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation('analytics')
  const balance = useMemo(() => muscleBalance(workouts), [workouts])
  const entries = (Object.entries(balance) as [BalanceGroup, number][]).filter(([, n]) => n > 0)
  if (entries.length === 0) return null
  const total = entries.reduce((sum, [, n]) => sum + n, 0)

  return (
    <Card title={t('balance.title')}>
      <BarList rows={entries.map(([g, n]) => ({ label: t(`balance.${g}`), value: n }))} total={total} />
    </Card>
  )
}

/** Working sets by rep range: strength / hypertrophy / endurance. */
function RepRanges({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation('analytics')
  const dist = useMemo(() => repRangeDistribution(workouts), [workouts])
  const entries = (Object.entries(dist) as [RepRange, number][]).filter(([, n]) => n > 0)
  if (entries.length === 0) return null
  const total = entries.reduce((sum, [, n]) => sum + n, 0)

  return (
    <Card title={t('repRanges.title')}>
      <BarList rows={entries.map(([r, n]) => ({ label: t(`repRanges.${r}`), value: n }))} total={total} />
    </Card>
  )
}

function BarList({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(({ label, value }) => {
        const pct = Math.round((value / total) * 100)
        return (
          <div key={label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">{label}</span>
              <span className="tnum text-xs text-ink-3">
                {value} · {pct}%
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-2">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface MuscleRow {
  muscle: string
  direct: number
  indirect: number
  total: number
  topExercises: MuscleSetBreakdown['topExercises']
  /* Recharts skips labels on zero-width rects and misindexes custom label
     content, so each stack segment gets a precomputed end label: the total on
     whichever segment is the last non-empty one, '' elsewhere. */
  directEndLabel: string
  stackEndLabel: string
}

/** Direct (primary muscle) + indirect (secondary, ×0.5) sets, stacked per muscle. */
function SetsPerMuscle({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation(['analytics', 'exercises'])
  const { byId } = useExerciseIndex()

  const data = useMemo(() => {
    const breakdown = muscleSetBreakdown(workouts, (id) => byId.get(id)?.secondaryMuscles ?? [])
    return muscleGroups
      .filter((m) => breakdown.has(m))
      .map((m): MuscleRow => {
        const b = breakdown.get(m)!
        const total = b.direct + b.indirect
        return {
          muscle: t(`exercises:muscle.${m}`),
          direct: b.direct,
          indirect: b.indirect,
          total,
          topExercises: b.topExercises,
          directEndLabel: b.indirect === 0 ? formatKg(total) : '',
          stackEndLabel: b.indirect > 0 ? formatKg(total) : '',
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [workouts, byId, t])

  if (data.length === 0) return null
  const height = Math.max(120, data.length * 34 + 30)

  return (
    <Card title={t('analytics:setsPerMuscle')}>
      <div className="flex items-center gap-4 pb-2 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          {t('analytics:setsPerMuscleCard.direct')}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: 'var(--cat-1)' }}
          />
          {t('analytics:setsPerMuscleCard.indirect')}
        </span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 34, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="muscle"
              width={88}
              tick={{ fill: 'var(--ink-2)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<MuscleTooltip />} />
            <Bar
              dataKey="direct"
              stackId="m"
              fill="var(--accent)"
              barSize={18}
              stroke="var(--surface)"
              strokeWidth={1}
            >
              <LabelList
                dataKey="directEndLabel"
                position="right"
                fill="var(--ink-2)"
                fontSize={11}
              />
            </Bar>
            <Bar
              dataKey="indirect"
              stackId="m"
              fill="var(--cat-1)"
              radius={[0, 4, 4, 0]}
              barSize={18}
              stroke="var(--surface)"
              strokeWidth={1}
            >
              <LabelList
                dataKey="stackEndLabel"
                position="right"
                fill="var(--ink-2)"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="pt-1 text-xs text-ink-3">{t('analytics:setsPerMuscleCard.help')}</p>
    </Card>
  )
}

function MuscleTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: MuscleRow }[]
}) {
  const { t } = useTranslation('analytics')
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="max-w-56 rounded-card border border-hairline bg-surface-2 px-3 py-2 text-xs">
      <div className="font-semibold text-ink">{row.muscle}</div>
      <div className="tnum mt-0.5 text-ink-2">
        {t('setsPerMuscleCard.direct')} {formatKg(row.direct)} ·{' '}
        {t('setsPerMuscleCard.indirect')} {formatKg(row.indirect)}
      </div>
      {row.topExercises.length > 0 && (
        <>
          <div className="mt-1.5 text-ink-3">{t('setsPerMuscleCard.topExercises')}</div>
          <ul className="mt-0.5 flex flex-col gap-0.5 text-ink-2">
            {row.topExercises.map((e) => (
              <li key={e.exerciseId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{e.exerciseName}</span>
                <span className="tnum shrink-0">{formatKg(e.sets)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Total volume per week — or per day when viewing the 7-day range. */
function VolumeTrend({ workouts, daily }: { workouts: WithId<Workout>[]; daily: boolean }) {
  const { t } = useTranslation(['analytics', 'common'])

  const data = useMemo(() => {
    const totals = bucketedTotals(
      workouts,
      (w) => w.totalVolumeKg ?? 0,
      daily ? 'day' : 'week',
      weekStartKey,
    )
    if (!daily) return totals
    // a 7-point series with holes reads badly: zero-fill the window
    const byDay = new Map(totals.map((d) => [d.bucket, d.value]))
    return Array.from({ length: 7 }, (_, i) => {
      const bucket = toDateKey(subDays(new Date(), 6 - i))
      return { bucket, value: byDay.get(bucket) ?? 0 }
    })
  }, [workouts, daily])
  if (data.length < 2) return null

  return (
    <Card title={daily ? t('analytics:volumeTrendDaily') : t('analytics:volumeTrend')}>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="bucket"
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

  const data = useMemo(
    () => bucketedTotals(workouts, () => 1, 'week', weekStartKey),
    [workouts],
  )
  if (data.length < 2) return null

  return (
    <Card title={t('frequency')}>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="bucket"
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

function SimpleTooltip({
  active,
  payload,
  unit,
  kg = false,
}: {
  active?: boolean
  payload?: { value: number; payload: { bucket?: string } }[]
  unit: string
  kg?: boolean
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const label = p.payload.bucket ? formatShortDate(new Date(p.payload.bucket)) : ''
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
