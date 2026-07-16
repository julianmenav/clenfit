import { useState } from 'react'
import { Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { updateCustomExercise, type CustomExerciseInput } from '@/data/exerciseMutations'
import type { ExerciseDef } from '@/domain/types'
import { ExerciseForm } from './ExerciseForm'

/**
 * Kebab menu per exercise: duplicate (any exercise) and edit/soft-delete
 * (custom only). Self-contained: owns its form/confirm state and mutations.
 */
export function ExerciseMenu({ def, onDeleted }: { def: ExerciseDef; onDeleted?: () => void }) {
  const uid = useUser().uid
  const { t } = useTranslation(['exercises', 'common'])
  const [menuOpen, setMenuOpen] = useState(false)
  const [form, setForm] = useState<{ editId?: string; initial: Partial<CustomExerciseInput> } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const editable = def.custom && !def.deprecated

  function menuAction(fn: () => void) {
    return () => {
      setMenuOpen(false)
      fn()
    }
  }

  const fields = {
    muscle: def.muscle,
    secondaryMuscles: def.secondaryMuscles,
    equipment: def.equipment,
    movement: def.movement,
    measurement: def.measurement,
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={t('common:actions.edit')}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenuOpen(!menuOpen)
        }}
        className="flex size-9 items-center justify-center rounded-card text-ink-3 active:bg-surface-2"
      >
        <MoreVertical className="size-5" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-card border border-hairline bg-surface-2 py-1 shadow-lg">
            <MenuItem
              icon={<Copy className="size-4" />}
              label={t('exercises:menu.duplicate')}
              onClick={menuAction(() =>
                setForm({ initial: { name: t('exercises:copyName', { name: def.name }), ...fields } }),
              )}
            />
            {editable && (
              <MenuItem
                icon={<Pencil className="size-4" />}
                label={t('common:actions.edit')}
                onClick={menuAction(() =>
                  setForm({ editId: def.id, initial: { name: def.name, ...fields } }),
                )}
              />
            )}
            {editable && (
              <MenuItem
                icon={<Trash2 className="size-4" />}
                label={t('common:actions.delete')}
                destructive
                onClick={menuAction(() => setConfirming(true))}
              />
            )}
          </div>
        </>
      )}

      {form && (
        <ExerciseForm
          open
          onOpenChange={(open) => {
            if (!open) setForm(null)
          }}
          initial={form.initial}
          editId={form.editId}
          onSaved={() => setForm(null)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          open
          title={t('exercises:deleteTitle')}
          body={t('exercises:deleteBody')}
          confirmLabel={t('common:actions.delete')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            void updateCustomExercise(uid, def.id, { deprecated: true })
            setConfirming(false)
            onDeleted?.()
          }}
        />
      )}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm ${
        destructive ? 'text-status-over' : 'text-ink'
      } active:bg-surface`}
    >
      {icon}
      {label}
    </button>
  )
}
