import { useMemo, type ReactNode } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { subDays } from 'date-fns'
import { comparePeriods, type PeriodTotals } from '@/domain/analytics'
import type { Workout } from '@/domain/types'
import { toDateKey } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'

/**
 * Rolling 7 days vs the 7 before them, with trend arrows. Rolling rather than
 * calendar weeks on purpose: a Monday-start week is compared while still
 * mostly empty, which read as −100% for days on end.
 *
 * Deliberately Recharts-free so the Home screen can import it statically
 * without pulling the charts chunk.
 */
export function Last7DaysCard({
  workouts,
  footer,
}: {
  workouts: Pick<Workout, 'dateKey' | 'totalSets' | 'totalVolumeKg'>[]
  /** extra block rendered under a divider inside the same card */
  footer?: ReactNode
}) {
  const { t } = useTranslation(['analytics', 'common'])

  const { current, previous } = useMemo(() => {
    const today = new Date()
    return comparePeriods(
      workouts,
      toDateKey(subDays(today, 6)),
      toDateKey(subDays(today, 13)),
    )
  }, [workouts])

  const stats: { label: string; pick: (w: PeriodTotals) => number; kg?: boolean }[] = [
    { label: t('analytics:recent.workouts'), pick: (w) => w.workouts },
    { label: t('analytics:recent.sets'), pick: (w) => w.sets },
    { label: t('analytics:recent.volume'), pick: (w) => w.volumeKg, kg: true },
  ]

  return (
    <section className="rounded-card border border-hairline bg-surface p-3">
      <h2 className="pb-2 font-semibold">{t('analytics:recent.title')}</h2>
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
      <p className="pt-2 text-xs text-ink-3">{t('analytics:recent.vsPrev')}</p>

      {footer && <div className="mt-3 border-t border-hairline pt-3">{footer}</div>}
    </section>
  )
}
