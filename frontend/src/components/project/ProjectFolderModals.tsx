import { X, Loader2, Check, Trash2, Folder } from 'lucide-react'
import type { ApiFolder } from '@/services/folders.service'

/* ================================================================
   RenameFolderModal
   ================================================================ */
export type RenameFolderModalProps = {
  folder: ApiFolder | null
  nameValue: string
  setNameValue: (v: string) => void
  errorMsg: string
  setErrorMsg: (v: string) => void
  mutationPending: boolean
  mutationError: unknown
  onClose: () => void
  onSubmitRename: (trimmedName: string) => void
}

export function RenameFolderModal(props: RenameFolderModalProps) {
  const {
    folder,
    nameValue,
    setNameValue,
    errorMsg,
    setErrorMsg,
    mutationPending,
    mutationError,
    onClose,
    onSubmitRename,
  } = props
  if (!folder) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => e.preventDefault()}
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Renombrar carpeta</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nombre actual:{' '}
              <span className="text-foreground">{folder.name}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={mutationPending}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {mutationError || errorMsg ? (
            <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
              {errorMsg ||
                (mutationError instanceof Error
                  ? mutationError.message
                  : 'Error desconocido')}
            </div>
          ) : null}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Nuevo nombre <span className="text-status-blocked">*</span>
            </label>
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              maxLength={255}
              placeholder="Ej. Documentos legales"
              className="input-base w-full"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={mutationPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={(e) => {
              e.preventDefault()
              if (mutationPending) return
              const form = e.currentTarget.closest('form')
              const input = form?.querySelector<HTMLInputElement>(
                'input[type="text"], input:not([type])'
              )
              const raw = input?.value ?? nameValue
              const n = raw.trim()
              if (n.length === 0 || n.length > 255) {
                setErrorMsg('Nombre de carpeta inválido (1..255 caracteres)')
                return
              }
              setNameValue(n)
              setErrorMsg('')
              onSubmitRename(n)
            }}
            disabled={mutationPending}
          >
            {mutationPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ================================================================
   ConfirmDeleteFolderDialog
   ================================================================ */
export type ConfirmDeleteFolderDialogProps = {
  folder: ApiFolder | null
  mutationPending: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDeleteFolderDialog(props: ConfirmDeleteFolderDialogProps) {
  const { folder, mutationPending, onClose, onConfirm } = props
  if (!folder) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 text-status-blocked" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground">Eliminar carpeta</h2>
              <p className="text-sm text-muted-foreground mt-1">
                ¿Eliminar la carpeta{' '}
                <strong className="text-foreground">{folder.name}</strong>? Se
                eliminarán también todos los archivos y subcarpetas que contenga. Esta acción no
                se puede deshacer.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={mutationPending}
          >
            Cancelar
          </button>
          <button
            className="btn-primary text-sm"
            onClick={onConfirm}
            disabled={mutationPending}
          >
            {mutationPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Eliminando…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Sí, eliminar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
