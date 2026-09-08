import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Sheet } from '@/components/ui/Sheet'
import { entryMacros } from '@/domain/nutrition'
import type { FoodEntry, Macros } from '@/domain/types'
import { AmountField, MacroPreview } from './FoodForm'

/** Change the amount of a logged entry or remove it from the day. */
export function EditEntrySheet({
  entry,
  goal,
  onClose,
  onSave,
  onDelete,
}: {
  entry: FoodEntry | null
  goal: Macros
  onClose: () => void
  onSave: (entry: FoodEntry) => void
  onDelete: (entryId: string) => void
}) {
  const { t } = useTranslation(['nutrition', 'common'])
  const [amount, setAmount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setAmount(entry?.amount ?? null)
    setConfirming(false)
  }, [entry])

  const canSave = entry != null && amount != null && amount > 0

  return (
    <>
      {/* The sheet steps aside while the confirm dialog is up: vaul's modal layer
          would otherwise sit on top of it and swallow its clicks. Cancel brings it back. */}
      <Sheet
        open={entry != null && !confirming}
        onOpenChange={(o) => !o && !confirming && onClose()}
        title={t('nutrition:entry.editTitle')}
      >
        {entry && (
          <div className="flex flex-col gap-4 pt-2 pb-2">
            <p className="text-lg font-semibold">{entry.name}</p>
            <AmountField
              kind={entry.kind}
              unitLabel={entry.unitLabel}
              value={amount}
              onChange={setAmount}
            />
            {canSave && (
              <MacroPreview
                macros={entryMacros({ kind: entry.kind, amount: amount!, per: entry.per })}
                goal={goal}
              />
            )}
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                onSave({ ...entry, amount: amount! })
                onClose()
              }}
              className="h-12 w-full rounded-card bg-accent font-semibold text-on-accent disabled:opacity-50"
            >
              {t('common:actions.save')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-hairline font-medium text-status-over"
            >
              <Trash2 className="size-4" />
              {t('nutrition:entry.delete')}
            </button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title={t('nutrition:entry.delete')}
        body={t('nutrition:entry.deleteBody')}
        confirmLabel={t('common:actions.delete')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (entry) onDelete(entry.id)
          setConfirming(false)
          onClose()
        }}
      />
    </>
  )
}
