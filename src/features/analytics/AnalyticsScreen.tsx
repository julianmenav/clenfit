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
import { ChartPie, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { addDays, parseISO, subDays } from 'date-fns'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCompletedWorkouts } from '@/data/hooks'
import { useExerciseIndex } from '@/data/exerciseIndex'
import {
  bucketedTotals,
  muscleBalance,
  muscleSetBreakdown,
  repRangeDistribution,
  type BalanceGroup,
  type MuscleSetBreakdown,
  type RepRange,
} from '@/domain/analytics'
import { muscleGroups, type WithId, type Workout } from '@/domain/types'
import {
  addWeeksToKey,
  formatShortDate,
  formatWeekRange,
  toDateKey,
  weekEndKey,
  weekStartKey,
} from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'
import { Last7DaysCard } from './Last7DaysCard'

type RangeKey = 'week' | '4w' | '3m' | '1y' | 'all'
const rangeDays: Record<Exclude<RangeKey, 'week'>, number | null> = {
  '4w': 28,
  '3m': 91,
  '1y': 365,
  all: null,
}
const rangeKeys: RangeKey[] = ['week', '4w', '3m', '1y', 'all']

export function AnalyticsScreen() {
  const { t } = useTranslation(['analytics', 'exercises', 'common'])
  const workouts = useCompletedWorkouts(500)
  const [range, setRange] = useState<RangeKey>('3m')
  const currentWeekStart = weekStartKey(toDateKey(new Date()))
  const [weekStart, setWeekStart] = useState(currentWeekStart)

  // ‹ stops at the week of the earliest loaded workout
  const minWeekStart = useMemo(() => {
    if (!workouts || workouts.length === 0) return null
    let min = workouts[0].dateKey
    for (const w of workouts) if (w.dateKey < min) min = w.dateKey
    return weekStartKey(min)
  }, [workouts])

  const filtered = useMemo(() => {
    if (!workouts) return []
    if (range === 'week') {
      const end = weekEndKey(weekStart)
      return workouts.filter((w) => w.dateKey >= weekStart && w.dateKey <= end)
    }
    const days = rangeDays[range]
    if (days == null) return workouts
    const fromKey = toDateKey(subDays(new Date(), days))
    return workouts.filter((w) => w.dateKey >= fromKey)
  }, [workouts, range, weekStart])

  if (workouts === undefined) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('analytics:title')}</h1>

      <Last7DaysCard workouts={workouts} />

      <div className="flex gap-1.5">
        {rangeKeys.map((k) => (
          <Chip
            key={k}
            label={t(`analytics:range.${k}`)}
            active={range === k}
            onClick={() => setRange(k)}
          />
        ))}
      </div>

      {range === 'week' && (
        <WeekPager
          weekStart={weekStart}
          currentWeekStart={currentWeekStart}
          minWeekStart={minWeekStart}
          onStep={(dir) => setWeekStart((w) => addWeeksToKey(w, dir))}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ChartPie}
          title={range === 'week' ? t('analytics:week.empty') : t('analytics:empty')}
        />
      ) : (
        <>
          <SetsPerMuscle workouts={filtered} />
          <MuscleBalance workouts={filtered} />
          <RepRanges workouts={filtered} />
          <VolumeTrend workouts={filtered} weekStart={range === 'week' ? weekStart : undefined} />
          {/* workouts-per-week is meaningless inside a single week */}
          {range !== 'week' && <Frequency workouts={filtered} />}
        </>
      )}
    </div>
  )
}

/** Mon–Sun stepper for week mode; › stops at the current week. */
function WeekPager({
  weekStart,
  currentWeekStart,
  minWeekStart,
  onStep,
}: {
  weekStart: string
  currentWeekStart: string
  minWeekStart: string | null
  onStep: (dir: -1 | 1) => void
}) {
  const { t } = useTranslation('analytics')
  const isCurrent = weekStart >= currentWeekStart
  const atMin = minWeekStart == null || weekStart <= minWeekStart

  return (
    <div className="flex items-center justify-between rounded-card border border-hairline bg-surface p-1">
      <button
        type="button"
        aria-label={t('week.prev')}
        disabled={atMin}
        onClick={() => onStep(-1)}
        className="flex size-9 items-center justify-center rounded-card text-ink-2 active:bg-surface-2 disabled:opacity-30"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="text-sm font-medium">
        {isCurrent ? t('week.current') : formatWeekRange(weekStart)}
      </span>
      <button
        type="button"
        aria-label={t('week.next')}
        disabled={isCurrent}
        onClick={() => onStep(1)}
        className="flex size-9 items-center justify-center rounded-card text-ink-2 active:bg-surface-2 disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
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

/** Total volume per week — or per day when viewing a single Mon–Sun week. */
function VolumeTrend({ workouts, weekStart }: { workouts: WithId<Workout>[]; weekStart?: string }) {
  const { t } = useTranslation(['analytics', 'common'])

  const data = useMemo(() => {
    const totals = bucketedTotals(
      workouts,
      (w) => w.totalVolumeKg ?? 0,
      weekStart != null ? 'day' : 'week',
      weekStartKey,
    )
    if (weekStart == null) return totals
    // a 7-point series with holes reads badly: zero-fill Mon–Sun
    const byDay = new Map(totals.map((d) => [d.bucket, d.value]))
    return Array.from({ length: 7 }, (_, i) => {
      const bucket = toDateKey(addDays(parseISO(weekStart), i))
      return { bucket, value: byDay.get(bucket) ?? 0 }
    })
  }, [workouts, weekStart])
  if (data.length < 2) return null

  return (
    <Card title={weekStart != null ? t('analytics:volumeTrendDaily') : t('analytics:volumeTrend')}>
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
