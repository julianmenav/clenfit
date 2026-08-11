import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { countPrDetails, prDisplayGroups, type PrDisplayRow } from '@/domain/prDetails'
import type { OneRmFormula, PrDetail } from '@/domain/types'
import { formatKg } from '@/lib/formatSet'

/** Breakdown of the session's records: per exercise, previous mark → new mark. */
export function PrDetailsCard({ details, formula }: { details: PrDetail[]; formula: OneRmFormula }) {
  const { t } = useTranslation(['workout', 'history', 'common'])
  const groups = prDisplayGroups(details, formula)

  return (
    <section className="rounded-card border border-status-warn/30 bg-status-warn/10 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-status-warn">
        <Trophy className="size-4" />
        {t('workout:finishSheet.prs', { count: countPrDetails(details) })}
      </h2>
      <div className="mt-2 flex flex-col gap-2.5">
        {groups.map((g) => (
          <div key={g.exerciseId}>
            <p className="text-sm font-medium">{g.exerciseName}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {g.rows.map((row) => (
                <li key={row.display} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-2">{t(`workout:pr.types.${row.display}`)}</span>
                  <Mark row={row} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Mark({ row }: { row: PrDisplayRow }) {
  const { t } = useTranslation(['history', 'common'])
  const unit = row.display === 'mostReps' ? 'reps' : t('common:units.kg')
  const fmt = (v: number) => (row.display === 'mostReps' ? String(v) : formatKg(v))

  return (
    <span className="tnum shrink-0">
      {row.previousValue != null ? (
        <span className="text-ink-3">{fmt(row.previousValue)} → </span>
      ) : (
        <span className="pr-1 text-xs text-ink-3">({t('history:pr.first')}) </span>
      )}
      <span className="font-semibold">
        {fmt(row.value)} {unit}
      </span>
    </span>
  )
}
