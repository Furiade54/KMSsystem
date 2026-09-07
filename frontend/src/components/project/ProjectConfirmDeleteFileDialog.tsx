import { Trash2, Loader2 } from 'lucide-react'
import type { ApiFile } from '@/services/files.service'

export type ProjectConfirmDeleteFileDialogProps = {
  file: ApiFile | null
  mutationPending: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ProjectConfirmDeleteFileDialog(props: ProjectConfirmDeleteFileDialogProps) {
  const { file, mutationPending, onClose, onConfirm } = props
  if (!file) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-status-blocked" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground">Eliminar archivo</h2>
              <p className="text-sm text-muted-foreground mt-1">
                ¿Eliminar definitivamente el archivo{' '}
                <strong className="text-foreground">{file.name}</strong>? Esta
                acción no se puede deshacer.
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
