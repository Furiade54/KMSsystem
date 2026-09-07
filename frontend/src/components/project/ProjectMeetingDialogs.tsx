import { X, Check, Loader2, Trash2 } from 'lucide-react'
import type { ApiMeeting, ApiMeetingStatus } from '@/services/meetings.service'

export type NewMeetingFormState = any

export type ConfirmDeleteMeetingTarget = {
  id: string
  title?: string | null
} | null

/* ================================================================
   NewMeetingModal
   ================================================================ */
export type NewMeetingModalProps = {
  open: boolean
  editingMeeting: ApiMeeting | null
  form: NewMeetingFormState
  setForm: React.Dispatch<React.SetStateAction<NewMeetingFormState>>
  createPending: boolean
  updatePending: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

export function NewMeetingModal(props: NewMeetingModalProps) {
  const {
    open,
    editingMeeting,
    form,
    setForm,
    createPending,
    updatePending,
    onClose,
    onSubmit,
  } = props
  if (!open) return null
  const busy = createPending || updatePending
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (busy) return
        onClose()
      }}
    >
      <form
        onSubmit={onSubmit}
        className="card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-secondary/40">
          <h2 className="text-[15px] font-semibold text-foreground">
            {editingMeeting ? 'Editar reunión' : 'Nueva reunión'}
          </h2>
          <button
            type="button"
            className="btn-ghost p-1 rounded-md h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
            onClick={() => {
              if (busy) return
              onClose()
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1">
              Título <span className="text-status-blocked">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={form.title}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, title: e.target.value }))
              }
              placeholder="Ej: Kick-off del proyecto"
              className="w-full h-9 px-3 rounded-md text-[12.5px] bg-surface-secondary/60 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1">
              Descripción
            </label>
            <textarea
              rows={3}
              value={form.description || ''}
              onChange={(e) =>
                setForm((f: any) => ({ ...f, description: e.target.value }))
              }
              placeholder="Agenda, puntos clave, contexto..."
              className="w-full px-3 py-2 rounded-md text-[12.5px] bg-surface-secondary/60 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60 resize-y"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-semibold text-foreground mb-1">
                Fecha y hora
              </label>
              <input
                type="datetime-local"
                value={form.meetingAt || ''}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, meetingAt: e.target.value || undefined }))
                }
                className="w-full h-9 px-2.5 rounded-md text-[12.5px] bg-surface-secondary/60 border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-foreground mb-1">
                Estado
              </label>
              <select
                value={form.status || 'SCHEDULED'}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, status: e.target.value as ApiMeetingStatus }))
                }
                className="w-full h-9 px-2 rounded-md text-[12.5px] bg-surface-secondary/60 border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
              >
                <option value="SCHEDULED">Programada</option>
                <option value="IN_PROGRESS">En curso</option>
                <option value="HELD">Realizada</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              if (busy) return
              onClose()
            }}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {editingMeeting ? 'Guardando…' : 'Creando…'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {editingMeeting ? 'Guardar' : 'Crear reunión'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ================================================================
   ConfirmDeleteMeetingDialog
   ================================================================ */
export type ConfirmDeleteMeetingDialogProps = {
  meeting: ConfirmDeleteMeetingTarget
  mutationPending: boolean
  onClose: () => void
  onConfirm: (meetingId: string) => void
}

export function ConfirmDeleteMeetingDialog(props: ConfirmDeleteMeetingDialogProps) {
  const { meeting, mutationPending, onClose, onConfirm } = props
  if (!meeting) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (mutationPending) return
        onClose()
      }}
    >
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-status-blocked" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground">Eliminar reunión</h2>
              <p className="text-sm text-muted-foreground mt-1">
                ¿Estás seguro de eliminar{' '}
                <strong className="text-foreground">
                  {meeting.title || 'esta reunión'}
                </strong>
                ? Esta acción no se puede deshacer.
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
            onClick={() => onConfirm(meeting.id)}
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
