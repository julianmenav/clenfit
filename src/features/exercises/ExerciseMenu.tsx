import { useState } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { KebabMenu, MenuItem } from '@/components/ui/KebabMenu'
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
  const [form, setForm] = useState<{ editId?: string; initial: Partial<CustomExerciseInput> } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const editable = def.custom && !def.deprecated

  const fields = {
    muscle: def.muscle,
    secondaryMuscles: def.secondaryMuscles,
    equipment: def.equipment,
    movement: def.movement,
    measurement: def.measurement,
  }

  return (
    <div className="relative shrink-0">
      <KebabMenu label={t('common:actions.edit')}>
        {(close) => {
          const act = (fn: () => void) => () => {
            close()
            fn()
          }
          return (
            <>
              <MenuItem
                icon={<Copy className="size-4" />}
                label={t('exercises:menu.duplicate')}
                onClick={act(() =>
                  setForm({
                    initial: { name: t('exercises:copyName', { name: def.name }), ...fields },
                  }),
                )}
              />
              {editable && (
                <MenuItem
                  icon={<Pencil className="size-4" />}
                  label={t('common:actions.edit')}
                  onClick={act(() =>
                    setForm({ editId: def.id, initial: { name: def.name, ...fields } }),
                  )}
                />
              )}
              {editable && (
                <MenuItem
                  icon={<Trash2 className="size-4" />}
                  label={t('common:actions.delete')}
                  destructive
                  onClick={act(() => setConfirming(true))}
                />
              )}
            </>
          )
        }}
      </KebabMenu>

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
