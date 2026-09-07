import { X, Loader2, Plus } from 'lucide-react'
import type { ApiFolder } from '@/services/folders.service'

export type ProjectNewFolderModalProps = {
  open: boolean
  project: unknown | null | undefined
  selectedFolderId: string | null
  flatFolderById: Map<string, ApiFolder>
  newFolderName: string
  setNewFolderName: (v: string) => void
  newFolderError: string
  createPending: boolean
  createError: unknown
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export default function ProjectNewFolderModal(props: ProjectNewFolderModalProps) {
  const {
    open,
    project,
    selectedFolderId,
    flatFolderById,
    newFolderName,
    setNewFolderName,
    newFolderError,
    createPending,
    createError,
    onClose,
    onSubmit,
  } = props
  if (!open || !project) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Nueva carpeta</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              En:{' '}
              <span className="text-foreground">
                {selectedFolderId == null
                  ? 'Raíz del proyecto'
                  : flatFolderById.get(selectedFolderId)?.name || selectedFolderId}
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={createPending}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {createError || newFolderError ? (
            <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
              {newFolderError || (createError instanceof Error ? createError.message : 'Error desconocido')}
            </div>
          ) : null}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Nombre de carpeta <span className="text-status-blocked">*</span>
            </label>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
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
            disabled={createPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={createPending}
          >
            {createPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Crear carpeta
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
