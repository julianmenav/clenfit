import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/app/AuthProvider'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { createCustomExercise } from '@/data/exerciseMutations'
import {
  equipmentTypes,
  measurementTypes,
  movements,
  muscleGroups,
  type Equipment,
  type ExerciseDef,
  type Measurement,
  type Movement,
  type MuscleGroup,
} from '@/domain/types'

/** Alta de ejercicio personalizado (los tres ejes + tipo de registro). */
export function ExerciseForm({
  open,
  onOpenChange,
  onCreated,
  initialName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (def: ExerciseDef) => void
  initialName?: string
}) {
  const uid = useUser().uid
  const { t } = useTranslation(['exercises', 'common'])
  const [name, setName] = useState(initialName)
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [secondary, setSecondary] = useState<MuscleGroup[]>([])
  const [equipment, setEquipment] = useState<Equipment>('machine')
  const [movement, setMovement] = useState<Movement>('other')
  const [measurement, setMeasurement] = useState<Measurement>('weight_reps')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const data = {
        name: name.trim(),
        muscle,
        secondaryMuscles: secondary,
        equipment,
        movement,
        measurement,
      }
      const id = await createCustomExercise(uid, data)
      onCreated({ id, ...data, custom: true })
      setName('')
      setSecondary([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('exercises:addCustom')}>
      <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          {t('exercises:form.name')}
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('exercises:form.namePlaceholder')}
            className="h-12 rounded-card border border-hairline bg-surface-2 px-4 text-base text-ink outline-none focus:border-accent"
          />
        </label>

        <Field label={t('exercises:form.muscle')}>
          <div className="flex flex-wrap gap-1.5">
            {muscleGroups.map((m) => (
              <Chip
                key={m}
                label={t(`exercises:muscle.${m}`)}
                active={muscle === m}
                onClick={() => {
                  setMuscle(m)
                  setSecondary(secondary.filter((s) => s !== m))
                }}
              />
            ))}
          </div>
        </Field>

        <Field label={t('exercises:form.secondaryMuscles')}>
          <div className="flex flex-wrap gap-1.5">
            {muscleGroups
              .filter((m) => m !== muscle)
              .map((m) => (
                <Chip
                  key={m}
                  label={t(`exercises:muscle.${m}`)}
                  active={secondary.includes(m)}
                  onClick={() =>
                    setSecondary(
                      secondary.includes(m)
                        ? secondary.filter((s) => s !== m)
                        : [...secondary, m],
                    )
                  }
                />
              ))}
          </div>
        </Field>

        <Field label={t('exercises:form.equipment')}>
          <div className="flex flex-wrap gap-1.5">
            {equipmentTypes.map((e) => (
              <Chip
                key={e}
                label={t(`exercises:equipment.${e}`)}
                active={equipment === e}
                onClick={() => setEquipment(e)}
              />
            ))}
          </div>
        </Field>

        <label className="flex flex-col gap-1 text-sm text-ink-2">
          {t('exercises:form.movement')}
          <select
            value={movement}
            onChange={(e) => setMovement(e.target.value as Movement)}
            className="h-12 rounded-card border border-hairline bg-surface-2 px-3 text-base text-ink outline-none focus:border-accent"
          >
            {movements.map((m) => (
              <option key={m} value={m}>
                {t(`exercises:movement.${m}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-2">
          {t('exercises:form.measurement')}
          <select
            value={measurement}
            onChange={(e) => setMeasurement(e.target.value as Measurement)}
            className="h-12 rounded-card border border-hairline bg-surface-2 px-3 text-base text-ink outline-none focus:border-accent"
          >
            {measurementTypes.map((m) => (
              <option key={m} value={m}>
                {t(`exercises:measurement.${m}`)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="h-12 rounded-card bg-accent font-semibold text-on-accent disabled:opacity-60"
        >
          {t('common:actions.save')}
        </button>
      </form>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm text-ink-2">
      {label}
      {children}
    </div>
  )
}
