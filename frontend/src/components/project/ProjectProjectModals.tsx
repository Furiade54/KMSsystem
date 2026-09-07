import { Trash2, ShieldAlert, Loader2, X, Check } from 'lucide-react'
import clsx from 'clsx'

export type ApiProjectStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'INACTIVE' | 'ARCHIVED'

export type EditProjectModalForm = {
  name: string
  description: string
  status: ApiProjectStatus
  errors: { name?: string; description?: string; _global?: string }
}

export type EditProjectModalProps = {
  open: boolean
  project: unknown | null | undefined
  mutationPending: boolean
  form: EditProjectModalForm
  setForm: React.Dispatch<React.SetStateAction<EditProjectModalForm>>
  onClose: () => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

export function EditProjectModal(props: EditProjectModalProps) {
  const { open, project, mutationPending, form, setForm, onClose, onSubmit } = props
  if (!open || !project) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Editar proyecto</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Actualiza la información del espacio de trabajo.</p>
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
        <div className="p-4 space-y-4">
          {form.errors._global && (
            <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
              {form.errors._global}
            </div>
          )}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Nombre <span className="text-status-blocked">*</span></label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              maxLength={200}
              className={clsx('input-base w-full', form.errors.name && 'ring-1 ring-status-blocked')}
            />
            {form.errors.name && (
              <p className="text-xs text-status-blocked mt-1">{form.errors.name}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Descripción</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              maxLength={2000}
              className="input-base w-full resize-none"
            />
            {form.errors.description && (
              <p className="text-xs text-status-blocked mt-1">{form.errors.description}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Estado</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as ApiProjectStatus }))
              }
              className="input-base w-full bg-surface"
            >
              <option value="PENDING">Borrador</option>
              <option value="ACTIVE">En construcción</option>
              <option value="COMPLETED">Completado</option>
              <option value="INACTIVE">Inactivo</option>
              <option value="ARCHIVED">Archivado</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={mutationPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary text-sm"
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
                Guardar cambios
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export type DeleteProjectDialogProps = {
  open: boolean
  project: { id?: string; name?: string } | null | undefined
  mutationPending: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteProjectDialog(props: DeleteProjectDialogProps) {
  const { open, project, mutationPending, onClose, onConfirm } = props
  if (!open || !project) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-status-blocked" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground">Mover proyecto a papelera</h2>
              <p className="text-sm text-muted-foreground mt-1">
                ¿Estás seguro que deseas eliminar{' '}
                <strong className="text-foreground">{project.name}</strong>? La acción se puede
                deshacer desde la papelera.
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

export type ForbiddenDeleteDialogProps = {
  open: boolean
  onClose: () => void
}

export function ForbiddenDeleteDialog(props: ForbiddenDeleteDialogProps) {
  const { open, onClose } = props
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-status-blocked" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground">Acceso Denegado</h2>
              <p className="text-sm text-muted-foreground mt-1">
                No tienes permisos para eliminar este proyecto. Solo el <strong>propietario</strong> del proyecto puede enviarlo a la papelera.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            className="btn-primary text-sm"
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
