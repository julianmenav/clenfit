import { useTranslation } from 'react-i18next'
import type { Food, WithId } from '@/domain/types'
import { foodBaseLabel, formatGrams, formatKcal } from './format'

/** One library food: name, base («por 100 g»), kcal and protein per base. */
export function FoodListRow({ food, onClick }: { food: WithId<Food>; onClick: () => void }) {
  const { t } = useTranslation(['nutrition', 'common'])
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface p-3 text-left active:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{food.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink-3">{foodBaseLabel(food, t)}</p>
        </div>
        <div className="tnum text-right text-sm">
          <p className="font-semibold">{formatKcal(food.per.kcal)} kcal</p>
          {food.per.protein != null && (
            <p className="text-xs text-ink-2">
              {formatGrams(food.per.protein)} {t('common:units.g')}{' '}
              {t('nutrition:macros.proteinShort')}
            </p>
          )}
        </div>
      </button>
    </li>
  )
}
