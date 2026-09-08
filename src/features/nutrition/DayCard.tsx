import { useTranslation } from 'react-i18next'
import { proteinIndex, remaining } from '@/domain/nutrition'
import type { Macros } from '@/domain/types'
import { cn } from '@/lib/utils'
import { formatGrams, formatIndex, formatKcal } from './format'

/** Eaten vs goal for the selected day: kcal + remaining, optional macros, protein index. */
export function DayCard({ totals, goal }: { totals: Macros; goal: Macros }) {
  const { t } = useTranslation(['nutrition', 'common'])
  const rem = remaining(goal, totals)
  const index = proteinIndex(totals, goal)
  const over = rem.kcal < 0

  const macroRows = (['protein', 'carbs', 'fat'] as const).filter((k) => goal[k] != null)

  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">{t('nutrition:day.eaten')}</p>
          <p className="tnum text-3xl font-bold tracking-tight">
            {formatKcal(totals.kcal)}
            <span className="ml-1 text-base font-medium text-ink-3">
              {t('nutrition:day.of', { goal: formatKcal(goal.kcal) })}
            </span>
          </p>
        </div>
        <p
          className={cn('tnum text-sm font-semibold', over ? 'text-status-over' : 'text-status-ok')}
        >
          {over
            ? t('nutrition:day.over', { kcal: formatKcal(-rem.kcal) })
            : t('nutrition:day.remaining', { kcal: formatKcal(rem.kcal) })}
        </p>
      </div>
      <Bar ratio={goal.kcal > 0 ? totals.kcal / goal.kcal : 0} />

      {macroRows.map((k) => (
        <div key={k} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-2">{t(`nutrition:macros.${k}`)}</span>
            <span className="tnum">
              {formatGrams(totals[k] ?? 0)} / {formatGrams(goal[k]!)} {t('common:units.g')}
            </span>
          </div>
          <Bar ratio={goal[k]! > 0 ? (totals[k] ?? 0) / goal[k]! : 0} />
        </div>
      ))}

      {index != null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">{t('nutrition:day.index')}</span>
          <span className={cn('tnum font-semibold', index >= 1 ? 'text-status-ok' : 'text-ink')}>
            {formatIndex(index)}
          </span>
        </div>
      )}
    </section>
  )
}

function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={cn('h-full rounded-full', ratio > 1 ? 'bg-status-over' : 'bg-accent')}
        style={{ width: `${Math.min(100, ratio * 100)}%` }}
      />
    </div>
  )
}
