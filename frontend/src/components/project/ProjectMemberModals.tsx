import { UserMinus, Loader2, UserPlus, X, Search, Check } from 'lucide-react'
import clsx from 'clsx'
import { initials } from './fileHelpers'
import type { OrgMember } from '@/services/projects.service'

/* ================================================================
   ConfirmRemoveMemberDialog
   ================================================================ */
export type ConfirmRemoveMemberDialogTarget = {
  id: string
  fullName?: string | null
  email?: string | null
} | null

export type ConfirmRemoveMemberDialogProps = {
  member: ConfirmRemoveMemberDialogTarget
  mutationPending: boolean
  onClose: () => void
  onConfirm: (memberId: string) => void
}

export function ConfirmRemoveMemberDialog(props: ConfirmRemoveMemberDialogProps) {
  const { member, mutationPending, onClose, onConfirm } = props
  if (!member) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
              <UserMinus className="w-5 h-5 text-status-blocked" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-foreground">Retirar miembro</h2>
              <p className="text-sm text-muted-foreground mt-1">
                ¿Retirar a{' '}
                <strong className="text-foreground">
                  {member.fullName || member.email || 'este usuario'}
                </strong>{' '}
                del proyecto? Perderá acceso inmediatamente.
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
            onClick={() => onConfirm(member.id)}
            disabled={mutationPending}
          >
            {mutationPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Retirando…
              </>
            ) : (
              <>
                <UserMinus className="w-4 h-4" />
                Sí, retirar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   InviteMemberModal
   ================================================================ */
export type InviteMemberModalProps = {
  open: boolean
  canManageMembers: boolean
  inviteError: string
  inviteSearch: string
  setInviteSearch: (v: string) => void
  inviteSelectedUserId: string | null
  setInviteSelectedUserId: (v: string | null) => void
  inviteRole: string
  setInviteRole: (v: string) => void
  orgMembersLoading: boolean
  orgMembersFetching: boolean
  candidates: OrgMember[]
  addPending: boolean
  addError: unknown
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

export function InviteMemberModal(props: InviteMemberModalProps) {
  const {
    open,
    inviteError,
    inviteSearch,
    setInviteSearch,
    inviteSelectedUserId,
    setInviteSelectedUserId,
    inviteRole,
    setInviteRole,
    orgMembersLoading,
    orgMembersFetching,
    candidates,
    addPending,
    addError,
    onSubmit,
    onClose,
  } = props
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (addPending) return
        onClose()
      }}
    >
      <form
        onSubmit={onSubmit}
        className="card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-brand-500" />
              Agregar miembro al proyecto
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecciona un usuario de la organización.
            </p>
          </div>
          <button
            type="button"
            disabled={addPending}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {(() => {
            const msg: string | null = inviteError
              ? inviteError
              : addError instanceof Error
                ? addError.message
                : addError
                  ? 'Error desconocido'
                  : null
            if (!msg) return null
            return (
              <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                {msg}
              </div>
            )
          })()}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Buscar usuario
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={inviteSearch}
                onChange={(e) => {
                  setInviteSearch(e.target.value)
                  setInviteSelectedUserId(null)
                }}
                placeholder="Nombre o correo del usuario..."
                className="input-base w-full pl-8 pr-2.5 text-[12px] h-9 rounded-md border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Rol en el proyecto
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="input-base w-full text-[12px] h-9 rounded-md border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 bg-surface"
            >
              <option value="Miembro">Miembro</option>
              <option value="Colaborador">Colaborador</option>
              <option value="Editor">Editor</option>
              <option value="Administrador">Administrador</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Usuarios disponibles
            </label>
            <div className="max-h-[260px] overflow-y-auto scrollbar-thin card divide-y divide-border overflow-hidden">
              {orgMembersLoading && orgMembersFetching ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-surface-secondary" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-40 bg-surface-secondary rounded" />
                      <div className="h-2.5 w-56 bg-surface-secondary rounded" />
                    </div>
                  </div>
                ))
              ) : candidates.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  {inviteSearch.trim()
                    ? 'No se encontraron usuarios con esos términos.'
                    : 'Todos los miembros de la organización ya están en este proyecto.'}
                </div>
              ) : (
                candidates.map((u) => {
                  const selected = inviteSelectedUserId === u.id
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setInviteSelectedUserId(u.id)}
                      className={clsx(
                        'w-full p-3 flex items-center gap-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/60',
                        selected
                          ? 'bg-brand-500/12 ring-1 ring-inset ring-brand-500/30'
                          : 'hover:bg-surface-secondary'
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(u.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-foreground truncate">
                          {u.fullName || 'Usuario sin nombre'}
                        </div>
                        <div className="text-[10.5px] text-gray-400 truncate">
                          {u.email || 'Sin correo'}
                        </div>
                      </div>
                      <div
                        className={clsx(
                          'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                          selected
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'border-muted-foreground/30'
                        )}
                      >
                        {selected && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={addPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={!inviteSelectedUserId || addPending}
          >
            {addPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Agregando…
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Agregar miembro
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
