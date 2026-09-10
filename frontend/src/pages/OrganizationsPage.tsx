import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Landmark,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Edit3,
  Trash2,
  X,
  Loader2,
  Hash,
  Link as LinkIcon,
  Users,
  FolderKanban,
  Filter,
  AlertTriangle,
  Trash,
  Info,
  Lightbulb,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { formatRelativeTime } from '../services/projects.service'
import {
  ApiOrganization,
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  permanentlyDeleteOrganization,
  orgStatusInfo,
  extractOrgError,
  extractOrgFailure,
  type OrgDeleteFailure,
} from '../services/organizations.service'
import type { EntityStatus, CreateOrganizationDto, UpdateOrganizationDto, PaginatedResult } from '../../../packages/shared-types/src'
import { useAuthStore } from '../store/authStore'

const PAGE_SIZE = 25

type StatusFilter = 'ALL' | EntityStatus

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'INACTIVE', label: 'Inactivas' },
  { value: 'DELETED', label: 'Eliminadas' },
]

type EditOrgTarget = { mode: 'create' } | { mode: 'edit'; org: ApiOrganization } | null
type ConfirmDeleteTarget =
  | { org: ApiOrganization; permanent: true }
  | { org: ApiOrganization; permanent: false }
  | null
type DeleteBlockedModalState = { failure: OrgDeleteFailure; fallback: string; permanent: boolean } | null

function initialsOf(name: string | null) {
  if (!name || !name.trim()) return '??'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function OrganizationsPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const isOrgAdmin = !!currentUser?.isOrgAdmin
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const myOrgId = currentUser?.organizationId

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

  const includeDeleted =
    statusFilter === 'DELETED' ? true : statusFilter === 'ALL' ? false : false

  const listQuery = useQuery({
    queryKey: ['organizations', 'list', { page, search: searchDebounced, status: statusFilter, includeDeleted }],
    queryFn: () =>
      listOrganizations({
        page,
        pageSize: PAGE_SIZE,
        search: searchDebounced || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        includeDeleted,
      }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (!listQuery.error) return
    const err = listQuery.error as any
    const msg = extractOrgError(err, 'No se pudieron cargar las organizaciones')
    const w = window as any
    if (!w.__orgsLoadErrorShown) {
      w.__orgsLoadErrorShown = true
      alert(msg)
      setTimeout(() => { w.__orgsLoadErrorShown = false }, 2000)
    }
  }, [listQuery.error])

  const data = listQuery.data as PaginatedResult<ApiOrganization> | undefined
  const items: ApiOrganization[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, total === 0 ? 0 : Math.ceil(total / PAGE_SIZE))
  const isLoading = listQuery.isLoading && listQuery.fetchStatus !== 'idle'
  const isEmpty = !isLoading && items.length === 0

  const headerTotal = useMemo(() => {
    if (isLoading) return '…'
    if (listQuery.isFetching && total === 0) return '…'
    return String(total)
  }, [isLoading, total, listQuery.isFetching])

  const [editTarget, setEditTarget] = useState<EditOrgTarget>(null)
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteTarget>(null)
  const [blockedDelete, setBlockedDelete] = useState<DeleteBlockedModalState>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: CreateOrganizationDto) => createOrganization(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] })
      setEditTarget(null)
    },
    onError: (err: any) => alert(extractOrgError(err, 'No se pudo crear la organización')),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: UpdateOrganizationDto }) =>
      updateOrganization(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['organization', 'me'] })
      setEditTarget(null)
    },
    onError: (err: any) => alert(extractOrgError(err, 'No se pudo actualizar la organización')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] })
      setConfirmDelete(null)
    },
    onError: (err: any) => {
      const structured = extractOrgFailure(err)
      if (structured) {
        setBlockedDelete({ failure: structured, fallback: 'No se pudo eliminar la organización', permanent: false })
      } else {
        alert(extractOrgError(err, 'No se pudo eliminar la organización'))
      }
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => permanentlyDeleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] })
      setConfirmDelete(null)
    },
    onError: (err: any) => {
      const structured = extractOrgFailure(err)
      if (structured) {
        setBlockedDelete({ failure: structured, fallback: 'No se pudo eliminar permanentemente la organización', permanent: true })
      } else {
        alert(extractOrgError(err, 'No se pudo eliminar permanentemente la organización'))
      }
    },
  })

  function closeActions() { setActionMenu(null) }
  const isMyOrg = (id: string) => myOrgId?.toLowerCase() === String(id).toLowerCase()

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
          <h1 className="text-2xl font-bold text-foreground">Organizaciones</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {headerTotal} organizaciones registradas en el sistema
          </p>
        </div>
        <button
          className="btn-primary text-sm inline-flex items-center gap-2"
          onClick={() => setEditTarget({ mode: 'create' })}
        >
          <Plus className="w-4 h-4" />
          Nueva organización
        </button>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre o NIT..."
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
                  <div className="h-3 w-1/2 bg-surface-secondary rounded" />
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
            <Landmark className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-semibold">No hay organizaciones para mostrar</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {searchDebounced
              ? 'Ninguna organización coincide con tu búsqueda. Prueba con otros términos.'
              : 'Crea la primera organización para empezar.'}
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
            <button
              className="btn-primary text-sm inline-flex items-center gap-2"
              onClick={() => setEditTarget({ mode: 'create' })}
            >
              <Plus className="w-4 h-4" />
              Nueva organización
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((o) => {
            const st = orgStatusInfo(o.status)
            const isSelf = isMyOrg(o.id)
            const isDeleted = o.status === 'DELETED'
            return (
              <div
                key={o.id}
                className={clsx(
                  'card p-5 space-y-4 hover:border-brand-500/40 transition-colors relative',
                  isDeleted && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold text-sm ring-1 ring-white/10 overflow-hidden">
                    {o.logoUrl ? (
                      <img src={o.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initialsOf(o.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {o.name || 'Organización'}
                        {isSelf && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30 align-middle">
                            Esta
                          </span>
                        )}
                      </h3>
                      <span
                        className={clsx(
                          'text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                          st.bgClass,
                          st.textClass
                        )}
                      >
                        <span className={clsx('w-1.5 h-1.5 rounded-full', st.dotClass)} />
                        {st.label}
                      </span>
                    </div>
                    {o.taxId && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                        <Hash className="w-3 h-3 shrink-0" />
                        <span className="truncate">NIT: {o.taxId}</span>
                      </div>
                    )}
                    {o.logoUrl && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{o.logoUrl}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={clsx('btn-icon text-muted-foreground hover:text-foreground')}
                      onClick={() => setActionMenu((cur) => (cur === o.id ? null : o.id))}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {actionMenu === o.id && (
                      <div className="absolute right-0 top-9 z-20 min-w-[180px] card p-1 shadow-lg border-border/60">
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-surface-secondary inline-flex items-center gap-2"
                          onClick={() => { closeActions(); setEditTarget({ mode: 'edit', org: o }) }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar organización
                        </button>
                        {!isSelf && (
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-2"
                            onClick={() => { closeActions(); setConfirmDelete({ org: o, permanent: false }) }}
                            disabled={isSelf}
                          >
                            <Trash className="w-3.5 h-3.5" />
                            {isDeleted ? 'Restaurar (editar)' : 'Mover a papelera'}
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-2"
                            onClick={() => { closeActions(); setConfirmDelete({ org: o, permanent: true }) }}
                            disabled={isSelf}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar permanentemente
                          </button>
                        )}
                        {isSelf && (
                          <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                            No puedes eliminar tu propia organización
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Usuarios
                    </span>
                    <span className="text-foreground font-medium">{o.usersCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <FolderKanban className="w-3.5 h-3.5" />
                      Proyectos
                    </span>
                    <span className="text-foreground font-medium">{o.projectsCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Creada</span>
                    <span className="text-muted-foreground dark:text-slate-300">
                      {formatRelativeTime(o.createdAt)}
                    </span>
                  </div>
                  {o.updatedAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Actualizada</span>
                      <span className="text-muted-foreground dark:text-slate-300">
                        {formatRelativeTime(o.updatedAt)}
                      </span>
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
        <OrganizationEditModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onCreate={(dto) => createMutation.mutate(dto)}
          onUpdate={(id, dto) => updateMutation.mutate({ id, data: dto })}
          creating={createMutation.isPending}
          updating={updateMutation.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          target={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete.permanent) permanentDeleteMutation.mutate(confirmDelete.org.id)
            else deleteMutation.mutate(confirmDelete.org.id)
          }}
          pending={
            confirmDelete.permanent
              ? permanentDeleteMutation.isPending
              : deleteMutation.isPending
          }
        />
      )}

      {blockedDelete && (
        <DeleteBlockedModal
          failure={blockedDelete.failure}
          fallbackMessage={blockedDelete.fallback}
          permanent={blockedDelete.permanent}
          onClose={() => setBlockedDelete(null)}
        />
      )}
    </div>
  )
}

function OrganizationEditModal({
  target, onClose, onCreate, onUpdate, creating, updating,
}: {
  target: NonNullable<EditOrgTarget>
  onClose: () => void
  onCreate: (dto: CreateOrganizationDto) => void
  onUpdate: (id: string, dto: UpdateOrganizationDto) => void
  creating: boolean
  updating: boolean
}) {
  const isEdit = target.mode === 'edit'
  const org = target.mode === 'edit' ? target.org : null

  const [name, setName] = useState(org?.name ?? '')
  const [taxId, setTaxId] = useState(org?.taxId ?? '')
  const [logoUrl, setLogoUrl] = useState(org?.logoUrl ?? '')
  const [status, setStatus] = useState<EntityStatus>(
    (org?.status as EntityStatus) ?? 'ACTIVE'
  )
  const [error, setError] = useState('')

  const busy = creating || updating

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || name.trim().length < 2) {
      setError('Nombre es requerido (al menos 2 caracteres)')
      return
    }
    if (name.trim().length > 200) {
      setError('El nombre no puede exceder 200 caracteres')
      return
    }
    if (taxId.trim().length > 50) {
      setError('El NIT no puede exceder 50 caracteres')
      return
    }
    if (logoUrl.trim().length > 1000) {
      setError('La URL del logo no puede exceder 1000 caracteres')
      return
    }
    if (!['ACTIVE', 'INACTIVE', 'DELETED'].includes(status)) {
      setError('Estado inválido')
      return
    }
    if (isEdit) {
      const dto: UpdateOrganizationDto = {
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        status,
      }
      onUpdate(org!.id, dto)
    } else {
      const dto: CreateOrganizationDto = {
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        status,
      }
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
            {isEdit ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isEdit ? 'Editar organización' : 'Nueva organización'}
          </h2>
          <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <input
                className="input-base mt-1 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                maxLength={200}
                placeholder="Instituto Superior Tecnológico"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                <Hash className="w-3 h-3" /> NIT / Identificación tributaria
              </label>
              <input
                className="input-base mt-1 text-sm"
                value={taxId ?? ''}
                onChange={(e) => setTaxId(e.target.value)}
                disabled={busy}
                maxLength={50}
                placeholder="900.123.456-7"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                <LinkIcon className="w-3 h-3" /> URL del logo (opcional)
              </label>
              <input
                className="input-base mt-1 text-sm"
                value={logoUrl ?? ''}
                onChange={(e) => setLogoUrl(e.target.value)}
                disabled={busy}
                maxLength={1000}
                placeholder="https://…/logo.png"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <select
                className="input-base mt-1 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as EntityStatus)}
                disabled={busy}
              >
                <option value="ACTIVE">Activa</option>
                <option value="INACTIVE">Inactiva</option>
                {isEdit && <option value="DELETED">Eliminada (papelera)</option>}
              </select>
              {!isEdit && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Las nuevas organizaciones se crean como Activas por defecto.
                </p>
              )}
            </div>
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary text-sm inline-flex items-center gap-2" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit
                ? updating ? 'Guardando…' : 'Guardar cambios'
                : creating ? 'Creando…' : 'Crear organización'}
            </button>
          </div>
        </form>
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
  const { org } = target
  const permanent = !!target.permanent
  const title = permanent ? '¿Eliminar permanentemente?' : '¿Mover a papelera?'
  const description = permanent
    ? `Esta acción NO se puede deshacer. Se eliminarán FÍSICAMENTE de la base de datos: la organización "${org.name}", sus usuarios, roles, proyectos, carpetas, archivos, comentarios, favoritos, notificaciones, auditoría y todas las dependencias asociadas.`
    : `Se marcará a "${org.name}" como eliminada (soft delete). Desaparecerá del listado normal y no podrá ser usada hasta que la restaures desde el filtro "Eliminadas" (cambiando su estado) o la borres permanentemente.`
  const icon = permanent ? <Trash2 className="w-5 h-5" /> : <Trash className="w-5 h-5" />
  const iconClass = permanent
    ? 'bg-destructive/15 text-destructive'
    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  const btnLabel = permanent ? 'Eliminar permanentemente' : 'Mover a papelera'
  const btnClass = permanent
    ? 'bg-destructive hover:bg-destructive/90 border-destructive'
    : 'bg-amber-600 hover:bg-amber-600/90 border-amber-600'
  const countColor = permanent
    ? 'text-destructive dark:text-rose-200'
    : 'text-amber-700 dark:text-amber-300'
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
            {(org.usersCount ?? 0) + (org.projectsCount ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                {org.usersCount && org.usersCount > 0 && (
                  <p className={clsx('text-xs inline-flex items-center gap-1', countColor)}>
                    <Users className="w-3 h-3" />
                    {org.usersCount} usuario{org.usersCount === 1 ? '' : 's'} asociado{org.usersCount === 1 ? '' : 's'}
                  </p>
                )}
                {org.projectsCount && org.projectsCount > 0 && (
                  <p className={clsx('text-xs inline-flex items-center gap-1', countColor)}>
                    <FolderKanban className="w-3 h-3" />
                    {org.projectsCount} proyecto{org.projectsCount === 1 ? '' : 's'} asociado{org.projectsCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            )}
            {permanent && (
              <div className={clsx('mt-3 text-xs px-3 py-2 rounded-md border inline-flex items-start gap-1.5 bg-destructive/10 border-destructive/30 text-destructive')}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Irreversible:</strong> una vez borrada, no habrá forma de recuperar ningún dato sin restaurar desde un backup de MSSQL.
                </span>
              </div>
            )}
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

function DeleteBlockedModal({
  failure, fallbackMessage, permanent, onClose,
}: {
  failure: OrgDeleteFailure
  fallbackMessage: string
  permanent: boolean
  onClose: () => void
}) {
  const title = failure.title || (permanent ? 'No se puede eliminar la organización' : 'No se puede mover a papelera')
  const summary = failure.summary || fallbackMessage
  const blocks = failure.blocks ?? []
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4 border-b border-border">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{summary}</p>
          </div>
          <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {blocks.length > 0 && (
          <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
            {blocks.map((b, idx) => {
              const isInfo = b.kind === 'info'
              const Icon = isInfo ? Info : Lightbulb
              const toneClass = isInfo
                ? 'bg-brand-500/10 border-brand-500/30 text-foreground'
                : 'bg-amber-500/10 border-amber-500/40 text-foreground'
              const iconClass = isInfo ? 'text-brand-600 dark:text-brand-300' : 'text-amber-600 dark:text-amber-300'
              return (
                <div
                  key={`bk-${idx}`}
                  className={clsx(
                    'rounded-md border px-3 py-2.5',
                    toneClass
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={clsx('w-4 h-4 shrink-0 mt-0.5', iconClass)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{b.title}</p>
                      {b.items && b.items.length > 0 && (
                        <ul className="mt-1.5 space-y-1 pl-0.5">
                          {b.items.map((it, i) => (
                            <li
                              key={`bk-${idx}-${i}`}
                              className="text-xs text-foreground/90 list-disc marker:text-muted-foreground/60 ml-3"
                            >
                              {it}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {failure.rawHint && (
              <details className="mt-2 text-[11px] text-muted-foreground select-none">
                <summary className="cursor-pointer hover:text-foreground">Detalles técnicos</summary>
                <p className="mt-1.5 p-2 rounded border border-border bg-surface-secondary/50 whitespace-pre-wrap break-words font-mono leading-snug">
                  {failure.rawHint}
                </p>
              </details>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
          <button className="btn-primary text-sm" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  )
}

export default OrganizationsPage
