import { useTranslation } from 'react-i18next'

/** Modal centrado, reservado para acciones destructivas. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-card border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold">{title}</h2>
        {body && <p className="mt-2 text-sm text-ink-2">{body}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-card px-4 text-sm font-medium text-ink-2"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 rounded-card px-4 text-sm font-semibold ${
              destructive ? 'bg-status-over text-white' : 'bg-accent text-on-accent'
            }`}
          >
            {confirmLabel ?? t('actions.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
