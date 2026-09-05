import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  Shield,
  FolderKanban,
  Plus,
  MoreHorizontal,
  Edit3,
  UserX,
  Trash2,
  Trash,
  X,
  Check,
  Loader2,
  Phone,
  Briefcase,
  ShieldCheck,
  ShieldPlus,
  UserPlus,
  Filter,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { formatRelativeTime } from '../services/projects.service'
import {
  ApiUser,
  listUsers,
  listRoles,
  createUser,
  updateUser,
  softDeleteUser,
  permanentlyDeleteUser,
  assignRolesToUser,
  userStatusInfo,
  extractUserError,
} from '../services/users.service'
import type { Role, EntityStatus, CreateUserDto, UpdateUserDto, PaginatedResult } from '../../../packages/shared-types/src'
import { useAuthStore } from '../store/authStore'

const PAGE_SIZE = 25

function initialsOf(name: string | null, email: string | null) {
  if (name && name.trim().length > 0) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return '??'
}

type StatusFilter = 'ALL' | EntityStatus

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
  { value: 'BLOCKED', label: 'Bloqueados' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'DELETED', label: 'Eliminados' },
]

function RoleBadge({ name, isSystemRole }: { name: string; isSystemRole?: boolean }) {
  const up = (name || '').toUpperCase()
  const isAdmin = up.includes('ADMIN') || up.includes('PROPIETARIO') || up.includes('OWNER')
  return (
    <span
      className={clsx(
        'text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1',
        isAdmin
          ? 'bg-status-blocked/20 dark:bg-status-blocked/15 text-rose-700 dark:text-rose-200 border-status-blocked/40'
          : 'bg-brand-500/15 dark:bg-brand-500/10 text-brand-700 dark:text-brand-200 border-brand-500/30'
      )}
    >
      {isSystemRole ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
      {name}
    </span>
  )
}

type EditUserTarget = { mode: 'create' } | { mode: 'edit'; user: ApiUser } | null
type RoleManagerTarget = ApiUser | null
type ConfirmDeleteTarget =
  | { user: ApiUser; permanent: true }
  | { user: ApiUser; permanent: false; kind: 'TRASH' }
  | { user: ApiUser; permanent: false; kind: 'INACTIVE' }
  | { user: ApiUser; permanent: false; kind: 'ACTIVE' }
  | null

function UsersPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const isOrgAdmin = !!currentUser?.isOrgAdmin
  const isHydrated = useAuthStore((s) => s.isHydrated)

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, statusFilter])

  const listQuery = useQuery({
    queryKey: ['users', 'list', { page, search: searchDebounced, status: statusFilter }],
    queryFn: () =>
      listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: searchDebounced || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        includeDeleted: statusFilter === 'ALL' ? false : statusFilter === 'DELETED',
      }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (!listQuery.error) return
    const err = listQuery.error as any
    const msg = extractUserError(err, 'No se pudieron cargar los usuarios')
    const w = window as any
    if (!w.__usersLoadErrorShown) {
      w.__usersLoadErrorShown = true
      alert(msg)
      setTimeout(() => { w.__usersLoadErrorShown = false }, 2000)
    }
  }, [listQuery.error])

  const data = listQuery.data as PaginatedResult<ApiUser> | undefined
  const items: ApiUser[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, total === 0 ? 0 : Math.ceil(total / PAGE_SIZE))
  const isLoading = listQuery.isLoading && listQuery.fetchStatus !== 'idle'
  const isEmpty = !isLoading && items.length === 0

  const headerTotal = useMemo(() => {
    if (isLoading) return '…'
    if (listQuery.isFetching && total === 0) return '…'
    return String(total)
  }, [isLoading, total, listQuery.isFetching])

  const [editTarget, setEditTarget] = useState<EditUserTarget>(null)
  const [rolesTarget, setRolesTarget] = useState<RoleManagerTarget>(null)
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteTarget>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  const rolesQuery = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => listRoles(),
    staleTime: 30_000,
    retry: 3,
    refetchOnMount: true,
  })
  const roles: Role[] = rolesQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserDto) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      setEditTarget(null)
    },
    onError: (err: any) => alert(extractUserError(err, 'No se pudo crear el usuario')),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: UpdateUserDto }) => updateUser(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      setEditTarget(null)
    },
    onError: (err: any) => alert(extractUserError(err, 'No se pudo actualizar el usuario')),
  })

  const softDeleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      setConfirmDelete(null)
    },
    onError: (err: any) => alert(extractUserError(err, 'No se pudo desactivar el usuario')),
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => permanentlyDeleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      setConfirmDelete(null)
    },
    onError: (err: any) => alert(extractUserError(err, 'No se pudo eliminar permanentemente el usuario')),
  })

  const assignRolesMutation = useMutation({
    mutationFn: (payload: { id: string; roleIds: string[] }) =>
      assignRolesToUser(payload.id, payload.roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      setRolesTarget(null)
    },
    onError: (err: any) => alert(extractUserError(err, 'No se pudieron asignar los roles')),
  })

  const isCurrentUser = (id: string) => currentUser?.id?.toLowerCase() === String(id).toLowerCase()

  function closeActions() { setActionMenu(null) }

  if (isHydrated && !isOrgAdmin) {
    return <Navigate to="/projects" replace />
  }
  if (!isHydrated) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando…
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" onClick={closeActions}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {headerTotal} usuarios en la organización
          </p>
        </div>
        <button className="btn-primary text-sm inline-flex items-center gap-2" onClick={() => setEditTarget({ mode: 'create' })}>
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o cargo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-base pl-10 py-1.5 text-sm"
          />
        </div>
        <button
          className={clsx(
            'btn-secondary text-sm inline-flex items-center gap-2',
            showFilters && 'ring-1 ring-brand-500/60'
          )}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="w-4 h-4" />
          Filtros
        </button>
      </div>

      {showFilters && (
        <div className="card p-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-2">Estado:</span>
          {statusFilterOptions.map((opt) => (
            <button
              key={opt.value}
              className={clsx(
                'text-xs px-3 py-1 rounded-full border transition',
                statusFilter === opt.value
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-surface text-muted-foreground border-border hover:border-brand-500/40 hover:text-foreground'
              )}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-surface-secondary rounded" />
                  <div className="h-3 w-full bg-surface-secondary rounded" />
                </div>
              </div>
              <div className="h-10 w-1/3 bg-surface-secondary rounded" />
              <div className="h-3 w-full bg-surface-secondary rounded" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="card p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-semibold">No hay usuarios para mostrar</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {searchDebounced
              ? 'Ningún usuario coincide con tu búsqueda. Prueba con otros términos.'
              : 'Crea el primer usuario para empezar.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {searchDebounced && (
              <button
                className="btn-secondary text-sm"
                onClick={() => { setSearchInput(''); setSearchDebounced('') }}
              >
                Limpiar búsqueda
              </button>
            )}
            <button className="btn-primary text-sm inline-flex items-center gap-2" onClick={() => setEditTarget({ mode: 'create' })}>
              <Plus className="w-4 h-4" />
              Nuevo usuario
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((u) => {
            const st = userStatusInfo(u.status)
            const userRoles = u.roles ?? []
            const isSelf = isCurrentUser(u.id)
            const isDeleted = u.status === 'DELETED'
            return (
              <div
                key={u.id}
                className={clsx(
                  'card p-5 space-y-4 hover:border-brand-500/40 transition-colors relative',
                  isDeleted && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold text-sm ring-1 ring-white/10">
                    {initialsOf(u.fullName, u.email)}
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {u.fullName || u.email || 'Usuario'}
                      </h3>
                      <span className={clsx('text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1', st.bgClass, st.textClass)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', st.dotClass)} />
                        {st.label}
                      </span>
                    </div>
                    {u.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    )}
                    {u.position && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                        <Briefcase className="w-3 h-3 shrink-0" />
                        <span className="truncate">{u.position}</span>
                      </div>
                    )}
                    {u.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span className="truncate">{u.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={clsx('btn-icon text-muted-foreground hover:text-foreground')}
                      onClick={() => setActionMenu((cur) => cur === u.id ? null : u.id)}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {actionMenu === u.id && (
                      <div className="absolute right-0 top-9 z-20 min-w-[180px] card p-1 shadow-lg border-border/60">
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-surface-secondary inline-flex items-center gap-2"
                          onClick={() => { closeActions(); setEditTarget({ mode: 'edit', user: u }) }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar usuario
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-surface-secondary inline-flex items-center gap-2"
                          onClick={() => { closeActions(); setRolesTarget(u) }}
                        >
                          <ShieldPlus className="w-3.5 h-3.5" />
                          Gestionar roles
                        </button>
                        {!isDeleted && !isSelf && u.status !== 'INACTIVE' && (
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-status-blocked/10 hover:text-status-blocked inline-flex items-center gap-2"
                            onClick={() => { closeActions(); setConfirmDelete({ user: u, permanent: false, kind: 'INACTIVE' }) }}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Desactivar
                          </button>
                        )}
                        {!isDeleted && !isSelf && u.status === 'INACTIVE' && (
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 inline-flex items-center gap-2"
                            onClick={() => { closeActions(); setConfirmDelete({ user: u, permanent: false, kind: 'ACTIVE' }) }}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Activar
                          </button>
                        )}
                        {!isDeleted && !isSelf && (
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-2"
                            onClick={() => { closeActions(); setConfirmDelete({ user: u, permanent: false, kind: 'TRASH' }) }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                            Mover a papelera
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-2"
                            onClick={() => { closeActions(); setConfirmDelete({ user: u, permanent: true }) }}
                          >
                            <Trash className="w-3.5 h-3.5" />
                            Eliminar permanentemente
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {userRoles.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {userRoles.slice(0, 3).map((r) => (
                      <RoleBadge key={r.id} name={r.name} isSystemRole={r.isSystemRole} />
                    ))}
                    {userRoles.length > 3 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        +{userRoles.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <FolderKanban className="w-3.5 h-3.5" />
                      Proyectos
                    </span>
                    <span className="text-foreground font-medium">{u.projectsCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      Roles
                    </span>
                    <span className="text-foreground font-medium">{u.rolesCount ?? userRoles.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Creado</span>
                    <span className="text-muted-foreground dark:text-slate-300">{formatRelativeTime(u.createdAt)}</span>
                  </div>
                  {u.lastLogin && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Último acceso</span>
                      <span className="text-muted-foreground dark:text-slate-300">{formatRelativeTime(u.lastLogin)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="card p-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {total} resultados
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50"
              disabled={page <= 1 || listQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50"
              disabled={page >= totalPages || listQuery.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {editTarget && (
        <UserEditModal
          target={editTarget}
          roles={roles}
          rolesLoading={rolesQuery.isLoading}
          onClose={() => setEditTarget(null)}
          onCreate={(dto) => createMutation.mutate(dto)}
          onUpdate={(id, dto) => updateMutation.mutate({ id, data: dto })}
          creating={createMutation.isPending}
          updating={updateMutation.isPending}
        />
      )}

      {rolesTarget && (
        <RoleManagerModal
          user={rolesTarget}
          roles={roles}
          rolesLoading={rolesQuery.isLoading}
          onClose={() => setRolesTarget(null)}
          onSave={(roleIds) => assignRolesMutation.mutate({ id: rolesTarget.id, roleIds })}
          saving={assignRolesMutation.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          target={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete.permanent) {
              permanentDeleteMutation.mutate(confirmDelete.user.id)
            } else {
              const kind = confirmDelete.kind
              if (kind === 'TRASH') softDeleteMutation.mutate(confirmDelete.user.id)
              else if (kind === 'INACTIVE') updateMutation.mutate({ id: confirmDelete.user.id, data: { status: 'INACTIVE' } })
              else if (kind === 'ACTIVE') updateMutation.mutate({ id: confirmDelete.user.id, data: { status: 'ACTIVE' } })
            }
          }}
          pending={
            confirmDelete.permanent
              ? permanentDeleteMutation.isPending
              : (confirmDelete.kind === 'TRASH')
                ? softDeleteMutation.isPending
                : updateMutation.isPending
          }
        />
      )}
    </div>
  )
}

function UserEditModal({
  target, roles, rolesLoading, onClose, onCreate, onUpdate, creating, updating,
}: {
  target: NonNullable<EditUserTarget>
  roles: Role[]
  rolesLoading: boolean
  onClose: () => void
  onCreate: (dto: CreateUserDto) => void
  onUpdate: (id: string, dto: UpdateUserDto) => void
  creating: boolean
  updating: boolean
}) {
  const isEdit = target.mode === 'edit'
  const user = target.mode === 'edit' ? target.user : null

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [position, setPosition] = useState(user?.position ?? '')
  const [status, setStatus] = useState<EntityStatus>((user?.status as EntityStatus) ?? 'ACTIVE')
  const [password, setPassword] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>(() => user?.roles?.map((r) => r.id) ?? [])
  const [error, setError] = useState('')

  const busy = creating || updating

  function toggleRole(rid: string) {
    setRoleIds((cur) => (cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid]))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Nombre completo es requerido (al menos 2 caracteres)')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Correo electrónico inválido')
      return
    }
    if (!isEdit && password && password.length < 6) {
      setError('Contraseña debe tener al menos 6 caracteres')
      return
    }
    if (isEdit) {
      const dto: UpdateUserDto = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        position: position.trim() || null,
        status,
      }
      if (password && password.trim().length >= 6) dto.password = password.trim()
      if (roleIds.length >= 0) dto.roleIds = roleIds
      onUpdate(user!.id, dto)
    } else {
      const dto: CreateUserDto = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        position: position.trim() || null,
        status,
      }
      if (password.trim()) dto.password = password.trim()
      if (roleIds.length > 0) dto.roleIds = roleIds
      onCreate(dto)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="card w-full max-w-xl my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            {isEdit ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
          <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Nombre completo</label>
              <input className="input-base mt-1 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Correo electrónico</label>
              <input className="input-base mt-1 text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
              <input className="input-base mt-1 text-sm" value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cargo</label>
              <input className="input-base mt-1 text-sm" value={position ?? ''} onChange={(e) => setPosition(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <select className="input-base mt-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value as EntityStatus)} disabled={busy}>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="BLOCKED">Bloqueado</option>
                <option value="PENDING">Pendiente</option>
                {isEdit && <option value="DELETED">Eliminado (papelera)</option>}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña (opcional)'}
              </label>
              <input className="input-base mt-1 text-sm" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? 'Dejar vacío para no cambiar' : 'Auto-generada si está vacía'} disabled={busy} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Roles</label>
              {rolesLoading && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Cargando…</span>}
            </div>
            <div className="mt-2 border border-border rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto">
              {roles.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center">No hay roles disponibles</div>
              ) : roles.map((r) => {
                const checked = roleIds.includes(r.id)
                return (
                  <label key={r.id} className={clsx(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition',
                    checked ? 'bg-brand-500/10 ring-1 ring-brand-500/40' : 'hover:bg-surface-secondary'
                  )}>
                    <input type="checkbox" className="accent-brand-500" checked={checked} onChange={() => toggleRole(r.id)} disabled={busy} />
                    <span className="flex-1 font-medium text-foreground">{r.name}</span>
                    {r.description && <span className="text-[11px] text-muted-foreground truncate max-w-[240px]">{r.description}</span>}
                    {r.isSystemRole && <ShieldCheck className="w-3.5 h-3.5 text-status-blocked" />}
                  </label>
                )
              })}
            </div>
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary text-sm inline-flex items-center gap-2" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? (updating ? 'Guardando…' : 'Guardar cambios') : (creating ? 'Creando…' : 'Crear usuario')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RoleManagerModal({
  user, roles, rolesLoading, onClose, onSave, saving,
}: {
  user: ApiUser
  roles: Role[]
  rolesLoading: boolean
  onClose: () => void
  onSave: (roleIds: string[]) => void
  saving: boolean
}) {
  const [selected, setSelected] = useState<string[]>(() => user.roles?.map((r) => r.id) ?? [])

  function toggle(rid: string) {
    setSelected((cur) => (cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid]))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-lg my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            <ShieldPlus className="w-4 h-4" />
            Roles · {user.fullName || user.email}
          </h2>
          <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold text-xs ring-1 ring-white/10">
              {initialsOf(user.fullName, user.email)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{user.fullName || user.email}</p>
              {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
            </div>
          </div>

          <div className="border border-border rounded-lg p-3 space-y-1.5 max-h-80 overflow-y-auto">
            {rolesLoading ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando roles…
              </div>
            ) : roles.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">No hay roles disponibles</div>
            ) : roles.map((r) => {
              const checked = selected.includes(r.id)
              return (
                <label key={r.id} className={clsx(
                  'flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-xs transition',
                  checked ? 'bg-brand-500/10 ring-1 ring-brand-500/40' : 'hover:bg-surface-secondary'
                )}>
                  <input type="checkbox" className="accent-brand-500" checked={checked} onChange={() => toggle(r.id)} disabled={saving} />
                  <span className="flex-1">
                    <div className="font-medium text-foreground inline-flex items-center gap-1.5">
                      {r.name}
                      {r.isSystemRole && <ShieldCheck className="w-3 h-3 text-status-blocked" />}
                      {typeof r.priorityLevel === 'number' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-secondary text-muted-foreground">
                          Nivel {r.priorityLevel}
                        </span>
                      )}
                    </div>
                    {r.description && <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>}
                  </span>
                  {checked && <Check className="w-4 h-4 text-brand-500" />}
                </label>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">{selected.length} rol{selected.length === 1 ? '' : 'es'} seleccionado{selected.length === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-2"
                disabled={saving}
                onClick={() => onSave(selected)}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({
  target, onClose, onConfirm, pending,
}: {
  target: NonNullable<ConfirmDeleteTarget>
  onClose: () => void
  onConfirm: () => void
  pending: boolean
}) {
  const { user } = target
  const title =
    target.permanent ? '¿Eliminar permanentemente?' :
    target.kind === 'TRASH' ? '¿Mover a papelera?' :
    target.kind === 'INACTIVE' ? '¿Desactivar usuario?' :
    '¿Activar usuario?'
  const description =
    target.permanent
      ? `Esta acción no se puede deshacer. Se eliminará "${user.fullName || user.email}" y todas sus membresías. Propiedades (proyectos, archivos, carpetas) pasarán a tener propietario NULL.`
      : target.kind === 'TRASH'
        ? `Se marcará a "${user.fullName || user.email}" como eliminado y no podrá iniciar sesión. Desaparecerá del listado normal y podrás restaurarlo desde el filtro "Eliminados" o borrarlo permanentemente después.`
        : target.kind === 'INACTIVE'
          ? `Se desactivará a "${user.fullName || user.email}". No podrá iniciar sesión, pero **seguirá visible** en el listado de usuarios con estado Inactivo (gris) para que puedas volver a activarlo cuando quieras.`
          : `Se volverá a activar a "${user.fullName || user.email}". Podrá iniciar sesión normalmente y verás su estado como Activo (verde) en el listado.`
  const icon =
    target.permanent ? <Trash2 className="w-5 h-5" /> :
    target.kind === 'TRASH' ? <Trash className="w-5 h-5" /> :
    target.kind === 'INACTIVE' ? <UserX className="w-5 h-5" /> :
    <Check className="w-5 h-5" />
  const iconClass =
    target.permanent ? 'bg-destructive/15 text-destructive' :
    target.kind === 'TRASH' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
    target.kind === 'INACTIVE' ? 'bg-status-blocked/15 text-status-blocked' :
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  const btnLabel =
    target.permanent ? 'Eliminar permanentemente' :
    target.kind === 'TRASH' ? 'Mover a papelera' :
    target.kind === 'INACTIVE' ? 'Desactivar' :
    'Activar'
  const btnClass =
    target.permanent ? 'bg-destructive hover:bg-destructive/90 border-destructive' :
    target.kind === 'TRASH' ? 'bg-amber-600 hover:bg-amber-600/90 border-amber-600' :
    target.kind === 'INACTIVE' ? 'bg-status-blocked hover:bg-status-blocked/90 border-status-blocked' :
    'bg-emerald-600 hover:bg-emerald-600/90 border-emerald-600'
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4">
          <div className={clsx(
            'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center',
            iconClass
          )}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={pending}>Cancelar</button>
          <button
            className={clsx(
              'text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-md border font-medium text-white shadow-sm',
              btnClass
            )}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {pending ? 'Procesando…' : btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UsersPage
