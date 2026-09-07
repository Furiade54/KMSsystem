import { Loader2, UserMinus, UserPlus } from 'lucide-react'
import type { ProjectMember } from '@/services/projects.service'
import { initials } from './fileHelpers'

export type ProjectTeamTabProps = {
  project: { ownerId?: string | null } | null
  members: ProjectMember[] | undefined
  membersLoading: boolean
  membersFetchStatus: string
  canManageMembers: boolean
  confirmRemoveMemberId: string | null
  removeMemberMutationPending: boolean
  onAddMemberClick: () => void
  onRemoveMemberClick: (member: ProjectMember) => void
}

export default function ProjectTeamTab({
  project,
  members,
  membersLoading,
  membersFetchStatus,
  canManageMembers,
  confirmRemoveMemberId,
  removeMemberMutationPending,
  onAddMemberClick,
  onRemoveMemberClick,
}: ProjectTeamTabProps) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Equipo del proyecto</h2>
          {canManageMembers && (
            <button
              className="btn-secondary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60"
              onClick={onAddMemberClick}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5">Agregar miembro</span>
            </button>
          )}
        </div>
        <div className="card divide-y divide-border overflow-hidden">
          {membersLoading && membersFetchStatus !== 'idle' ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-surface-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-surface-secondary rounded" />
                  <div className="h-3 w-64 bg-surface-secondary rounded" />
                </div>
                <div className="h-4 w-20 bg-surface-secondary rounded" />
              </div>
            ))
          ) : !members?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              Aún no hay miembros.
            </div>
          ) : (
            members.map((m) => {
              const isOwner = project && m.userId === project.ownerId
              const canRemove = canManageMembers && !isOwner
              return (
                <div key={m.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 text-brand-300 dark:text-brand-200 flex items-center justify-center font-semibold shrink-0">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      initials(m.fullName)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">
                      {m.fullName || 'Usuario sin nombre'}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {m.email || 'Sin correo'}
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-surface-secondary text-gray-300 shrink-0">
                    {m.roleName || (isOwner ? 'Propietario' : 'Miembro')}
                  </div>
                  {canRemove && (
                    <button
                      className="btn-ghost p-1 rounded-md h-8 w-8 shrink-0 text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10 focus-visible:ring-2 focus-visible:ring-status-blocked/50 focus:outline-none"
                      title="Retirar del proyecto"
                      aria-label={`Retirar ${m.fullName || m.email || 'miembro'} del proyecto`}
                      onClick={() => onRemoveMemberClick(m)}
                      disabled={removeMemberMutationPending}
                    >
                      {removeMemberMutationPending && confirmRemoveMemberId === m.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
