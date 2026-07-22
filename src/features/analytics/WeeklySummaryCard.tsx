import { useMemo } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { startOfWeek, subDays } from 'date-fns'
import { compareWeeks, type WeekTotals } from '@/domain/analytics'
import type { Workout } from '@/domain/types'
import { toDateKey } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'

/**
 * This calendar week (Monday start) vs the previous one, with trend arrows.
 * Deliberately Recharts-free so the Home screen can import it statically
 * without pulling the charts chunk.
 */
export function WeeklySummaryCard({
  workouts,
}: {
  workouts: Pick<Workout, 'dateKey' | 'totalSets' | 'totalVolumeKg'>[]
}) {
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
    <section className="rounded-card border border-hairline bg-surface p-3">
      <h2 className="pb-2 font-semibold">{t('analytics:weekly.title')}</h2>
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
                {kg && (
                  <span className="text-xs font-medium text-ink-3"> {t('common:units.kg')}</span>
                )}
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
    </section>
  )
}
