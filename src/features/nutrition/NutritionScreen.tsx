import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Target, Utensils } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { parseISO } from 'date-fns'
import { EmptyState } from '@/components/ui/EmptyState'
import { KebabMenu, MenuItem } from '@/components/ui/KebabMenu'
import { WeekPager } from '@/components/ui/WeekPager'
import { useNutritionWeek, useUserProfile } from '@/data/hooks'
import {
  dayTotals,
  entryMacros,
  hasGoal,
  proteinIndex,
  weekSummary,
  type WeekSummary as WeekSummaryData,
} from '@/domain/nutrition'
import type { FoodEntry, Macros } from '@/domain/types'
import { addWeeksToKey, formatDay, toDateKey, weekDayKeys, weekStartKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DayCard } from './DayCard'
import { entryAmountLabel, formatGrams, formatIndex, formatKcal } from './format'
import { WeekStrip } from './WeekStrip'

export function NutritionScreen() {
  const { t } = useTranslation(['nutrition', 'common'])
  const navigate = useNavigate()
  const profile = useUserProfile()

  const todayKey = toDateKey(new Date())
  const currentWeekStart = weekStartKey(todayKey)
  const [weekStart, setWeekStart] = useState(currentWeekStart)
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const days = useNutritionWeek(weekStart)
  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart])

  const goal = profile?.settings.nutritionGoal ?? null
  const selectedDay = days?.find((d) => d.dateKey === selectedKey) ?? null

  function stepWeek(dir: -1 | 1) {
    const next = addWeeksToKey(weekStart, dir)
    setWeekStart(next)
    setSelectedKey(next === currentWeekStart ? todayKey : next)
  }

  if (!profile) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  if (!hasGoal(goal)) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('nutrition:title')}</h1>
        <EmptyState
          icon={Utensils}
          title={t('nutrition:noGoal.title')}
          body={t('nutrition:noGoal.body')}
          action={
            <Link
              to="/ajustes"
              className="mt-1 flex h-10 items-center rounded-card bg-accent px-4 text-sm font-semibold text-on-accent"
            >
              {t('nutrition:noGoal.action')}
            </Link>
          }
        />
      </div>
    )
  }

  const summary = days ? weekSummary(dayKeys, days, goal) : null
  const totals = dayTotals(selectedDay?.entries ?? [])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-24">
      <header className="flex items-center gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight">{t('nutrition:title')}</h1>
        <KebabMenu>
          {(close) => (
            <MenuItem
              icon={<Target className="size-4" />}
              label={t('nutrition:menu.goals')}
              onClick={() => {
                close()
                navigate('/ajustes')
              }}
            />
          )}
        </KebabMenu>
      </header>

      <WeekPager
        weekStart={weekStart}
        currentWeekStart={currentWeekStart}
        minWeekStart={null}
        onStep={stepWeek}
        labels={{
          current: t('nutrition:week.current'),
          prev: t('nutrition:week.prev'),
          next: t('nutrition:week.next'),
        }}
      />

      {summary && (
        <>
          <WeekStrip
            cells={summary.days}
            selectedKey={selectedKey}
            todayKey={todayKey}
            onSelect={setSelectedKey}
          />
          <WeekLine summary={summary} />
        </>
      )}

      <h2 className="text-sm font-semibold text-ink-2">{formatDay(parseISO(selectedKey))}</h2>

      <DayCard totals={totals} goal={goal} />

      {selectedDay && selectedDay.entries.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {selectedDay.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} goal={goal} />
          ))}
        </ul>
      ) : (
        <p className="px-2 text-center text-sm text-ink-3">{t('nutrition:day.empty')}</p>
      )}
    </div>
  )
}

/** «Media/día 1.790 kcal · 98 g prot» and the signed weekly kcal balance. */
function WeekLine({ summary }: { summary: WeekSummaryData }) {
  const { t } = useTranslation(['nutrition', 'common'])
  if (summary.avg == null) {
    return <p className="text-center text-xs text-ink-3">{t('nutrition:week.noData')}</p>
  }
  const b = summary.balanceKcal
  const sign = b > 0 ? '+' : b < 0 ? '−' : ''
  return (
    <div className="flex items-center justify-between px-1 text-sm">
      <span className="text-ink-2">
        {t('nutrition:week.average')}{' '}
        <span className="tnum font-medium text-ink">{formatKcal(summary.avg.kcal)} kcal</span>
        {summary.avg.protein != null && (
          <span className="tnum font-medium text-ink">
            {' · '}
            {formatGrams(summary.avg.protein)} {t('common:units.g')}{' '}
            {t('nutrition:macros.proteinShort')}
          </span>
        )}
      </span>
      <span
        className={cn(
          'tnum font-semibold',
          b > 0 ? 'text-status-over' : b < 0 ? 'text-status-ok' : 'text-ink-2',
        )}
        title={t('nutrition:week.balance')}
      >
        {sign}
        {formatKcal(Math.abs(b))} kcal
      </span>
    </div>
  )
}

function EntryRow({ entry, goal }: { entry: FoodEntry; goal: Macros }) {
  const { t } = useTranslation(['nutrition', 'common'])
  const m = entryMacros(entry)
  const index = proteinIndex(m, goal)
  return (
    <li className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.name}</p>
        <p className="mt-0.5 text-xs text-ink-3">{entryAmountLabel(entry, t)}</p>
      </div>
      <div className="tnum text-right text-sm">
        <p className="font-semibold">{formatKcal(m.kcal)} kcal</p>
        {m.protein != null && (
          <p className="text-xs text-ink-2">
            {formatGrams(m.protein)} {t('common:units.g')} {t('nutrition:macros.proteinShort')}
          </p>
        )}
      </div>
      {index != null && (
        <span
          className={cn(
            'tnum shrink-0 rounded-chip border px-2 py-0.5 text-xs font-semibold',
            index >= 1 ? 'border-accent/40 text-accent' : 'border-hairline text-ink-3',
          )}
        >
          {formatIndex(index)}
        </span>
      )}
    </li>
  )
}
