import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

/**
 * The app's standard bottom sheet (vaul): handle, scrim, 20 px corners.
 * Everything transactional uses this; centered modals are reserved for destructive actions.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  tall = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** true = altura fija (~92dvh) para contenido con scroll propio, p. ej. el buscador */
  tall?: boolean
  children: ReactNode
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-t-sheet bg-surface outline-none ${
            tall ? 'h-[92dvh]' : 'max-h-[92dvh]'
          }`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-surface-2" />
          <Drawer.Title className="px-5 pt-3 text-lg font-semibold">{title}</Drawer.Title>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-5">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
