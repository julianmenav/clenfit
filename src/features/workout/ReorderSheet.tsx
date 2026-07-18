import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '@/components/ui/Sheet'
import type { WorkoutExercise } from '@/domain/types'

/** Bottom sheet with a compact list to reorder the session's exercises. */
export function ReorderSheet({
  open,
  onOpenChange,
  exercises,
  onMove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: WorkoutExercise[]
  onMove: (from: number, to: number) => void
}) {
  const { t } = useTranslation(['workout'])

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('workout:reorder.title')}>
      <div className="flex flex-col gap-1 pt-2">
        {exercises.map((ex, i) => (
          <div
            key={`${ex.exerciseId}-${i}`}
            className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-2"
          >
            <span className="tnum w-6 shrink-0 text-center text-sm text-ink-3">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{ex.exerciseName}</span>
            <IconBtn
              label={t('workout:reorder.moveUp')}
              icon={<ArrowUp className="size-4" />}
              disabled={i === 0}
              onClick={() => onMove(i, i - 1)}
            />
            <IconBtn
              label={t('workout:reorder.moveDown')}
              icon={<ArrowDown className="size-4" />}
              disabled={i === exercises.length - 1}
              onClick={() => onMove(i, i + 1)}
            />
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function IconBtn({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-card text-ink-3 active:bg-surface-2 disabled:opacity-30"
    >
      {icon}
    </button>
  )
}
