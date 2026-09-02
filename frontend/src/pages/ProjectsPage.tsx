import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  Loader2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ApiProject,
  ApiProjectStatus,
  CreateProjectPayload,
  createProject,
  fetchProjects,
  formatRelativeTime,
  projectColorClass,
  projectGradientClass,
  statusBadgeInfo,
} from '../services/projects.service'
import {
  toggleFavorite,
  type FavoriteResourceType,
  checkFavorite,
} from '../services/favorites.service'

type ViewMode = 'grid' | 'list'

const STATUS_FILTERS: Array<{ value: ApiProjectStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'En construcción' },
  { value: 'PENDING', label: 'Borrador' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'ARCHIVED', label: 'Archivado' },
]

const COLOR_OPTIONS: Array<{ value: string; label: string; dot: string }> = [
  { value: 'indigo', label: 'Azul marca', dot: 'bg-brand-500' },
  { value: 'rose', label: 'Rojo', dot: 'bg-status-blocked' },
  { value: 'emerald', label: 'Verde', dot: 'bg-status-approved' },
  { value: 'amber', label: 'Ámbar', dot: 'bg-status-review' },
]

const PAGE_SIZE = 9

function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ApiProjectStatus | 'ALL'>('ALL')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  const [showNew, setShowNew] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<CreateProjectPayload>({
    name: '',
    description: '',
    status: 'PENDING',
    color: 'indigo',
  })

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, statusFilter])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowNew(true)
    }
  }, [searchParams])

  const clearNewParam = () => {
    if (searchParams.get('new') === '1') {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }

  const query = useQuery({
    queryKey: ['projects', 'list', { page, statusFilter, search: searchDebounced }],
    queryFn: () =>
      fetchProjects({
        page,
        pageSize: PAGE_SIZE,
        search: searchDebounced || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowNew(false)
      resetForm()
      clearNewParam()
      navigate(`/projects/${project.id}`)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setFormErrors((prev) => ({ ...prev, _global: msg }))
    },
  })

  const [projectFavLocals, setProjectFavLocals] = useState<Record<string, boolean>>({})
  const toggleFavoriteProjectMutation = useMutation({
    mutationFn: (payload: { id: string }) =>
      toggleFavorite({ resourceType: 'PROJECT' as FavoriteResourceType, resourceId: payload.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || 'No se pudo actualizar el favorito')
    },
  })

  function handleToggleProjectFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setProjectFavLocals((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }))
    toggleFavoriteProjectMutation.mutate({ id })
  }

  function ProjectFavoriteStar({ id }: { id: string }) {
    const favorited = projectFavLocals[id]
    const pending =
      toggleFavoriteProjectMutation.isPending &&
      (toggleFavoriteProjectMutation.variables as { id: string } | undefined)?.id === id
    return (
      <button
        onClick={(e) => handleToggleProjectFavorite(id, e)}
        aria-label="Marcar proyecto como favorito"
        className={clsx(
          'w-8 h-8 rounded-full bg-black/20 backdrop-blur flex items-center justify-center transition-colors',
          favorited ? 'text-status-review' : 'text-white/90 hover:text-white hover:bg-black/30',
          pending && 'opacity-60 pointer-events-none'
        )}
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Star className={clsx('w-4 h-4', favorited && 'fill-current')} />
        )}
      </button>
    )
  }

  function ProjectFavoriteStarInline({ id }: { id: string }) {
    const favorited = projectFavLocals[id]
    const pending =
      toggleFavoriteProjectMutation.isPending &&
      (toggleFavoriteProjectMutation.variables as { id: string } | undefined)?.id === id
    return (
      <button
        onClick={(e) => handleToggleProjectFavorite(id, e)}
        aria-label="Marcar proyecto como favorito"
        className={clsx(
          'w-8 h-8 rounded-md flex items-center justify-center transition-colors shrink-0',
          favorited ? 'text-status-review bg-status-review/10' : 'text-muted-foreground hover:text-foreground hover:bg-surface-secondary',
          pending && 'opacity-60 pointer-events-none'
        )}
      >
        {pending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Star className={clsx('w-4 h-4', favorited && 'fill-current')} />
        )}
      </button>
    )
  }

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = query.data?.totalPages ?? 1
  const isLoading = query.isLoading && query.fetchStatus !== 'idle'
  const isEmpty = !isLoading && items.length === 0

  const resetForm = () => {
    setForm({ name: '', description: '', status: 'PENDING', color: 'indigo' })
    setFormErrors({})
  }

  const openNew = () => {
    resetForm()
    setShowNew(true)
  }

  const closeNew = () => {
    if (createMutation.isPending) return
    setShowNew(false)
    resetForm()
    clearNewParam()
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    const name = form.name.trim()
    if (name.length === 0) errors.name = 'El nombre es obligatorio'
    else if (name.length > 200) errors.name = 'Máximo 200 caracteres'
    if (form.description && form.description.length > 2000)
      errors.description = 'Máximo 2000 caracteres'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || createMutation.isPending) return
    createMutation.mutate({
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      status: form.status,
      color: form.color,
    })
  }

  const headerTotal = useMemo(() => {
    if (isLoading) return '…'
    if (query.isFetching && total === 0) return '…'
    return String(total)
  }, [isLoading, total, query.isFetching])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Mis proyectos</h1>
          <p className="text-muted-foreground text-xs mt-1">
            {headerTotal} proyectos · Todos los espacios de trabajo
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </button>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar proyectos..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-base pl-10 py-1.5 text-sm"
          />
        </div>
        <button
          className={clsx('btn-secondary text-sm py-1.5', showFilters && 'ring-1 ring-brand-500')}
          onClick={() => setShowFilters((s) => !s)}
          aria-pressed={showFilters}
        >
          <Filter className="w-4 h-4" />
          Filtrar
        </button>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx(
              'px-3 py-1.5 text-sm',
              viewMode === 'grid'
                ? 'bg-surface-tertiary text-foreground'
                : 'hover:bg-surface-secondary text-muted-foreground'
            )}
            aria-pressed={viewMode === 'grid'}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'px-3 py-1.5 text-sm',
              viewMode === 'list'
                ? 'bg-surface-tertiary text-foreground'
                : 'hover:bg-surface-secondary text-muted-foreground'
            )}
            aria-pressed={viewMode === 'list'}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Estado:</span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs transition-colors border',
                statusFilter === f.value
                  ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-200'
                  : 'border-border text-muted-foreground hover:border-gray-500 hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="h-24 bg-surface-secondary" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 bg-surface-secondary rounded" />
                  <div className="h-3 w-full bg-surface-secondary rounded" />
                  <div className="h-3 w-5/6 bg-surface-secondary rounded" />
                  <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
                    <div className="h-3 w-14 bg-surface-secondary rounded" />
                    <div className="h-3 w-14 bg-surface-secondary rounded" />
                    <div className="h-3 w-16 bg-surface-secondary rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-surface-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-surface-secondary rounded" />
                  <div className="h-3 w-2/3 bg-surface-secondary rounded" />
                </div>
                <div className="h-3 w-20 bg-surface-secondary rounded" />
              </div>
            ))}
          </div>
        )
      ) : isEmpty ? (
        <div className="card p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center">
            <FolderKanban className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-semibold">No hay proyectos para mostrar</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {searchDebounced || statusFilter !== 'ALL'
              ? 'Ningún proyecto coincide con los filtros. Prueba con otros términos o limpia los filtros.'
              : 'Crea tu primer proyecto para empezar a organizar tu conocimiento.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {(searchDebounced || statusFilter !== 'ALL') && (
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  setSearchInput('')
                  setSearchDebounced('')
                  setStatusFilter('ALL')
                }}
              >
                Limpiar filtros
              </button>
            )}
            <button className="btn-primary text-sm" onClick={openNew}>
              <Plus className="w-4 h-4" />
              Crear proyecto
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <ProjectGrid
          projects={items}
          renderStar={(id) => <ProjectFavoriteStar id={id} />}
        />
      ) : (
        <ProjectList
          projects={items}
          renderStar={(id) => (
            <ProjectFavoriteStarInline id={id} />
          )}
        />
      )}

      {!isLoading && totalPages > 1 && (
        <div className="card p-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {total} resultados
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50"
              disabled={page >= totalPages || query.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Nuevo proyecto</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define un nombre y una descripción para empezar.
                </p>
              </div>
              <button
                type="button"
                onClick={closeNew}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {formErrors._global && (
                <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
                  {formErrors._global}
                </div>
              )}

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Nombre del proyecto <span className="text-status-blocked">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ej. Plan de calidad 2025"
                  maxLength={200}
                  className={clsx('input-base w-full', formErrors.name && 'ring-1 ring-status-blocked')}
                />
                {formErrors.name && (
                  <p className="text-xs text-status-blocked mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Descripción <span className="text-muted-foreground">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.description ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="¿De qué trata este proyecto?"
                  maxLength={2000}
                  className="input-base w-full resize-none"
                />
                {formErrors.description && (
                  <p className="text-xs text-status-blocked mt-1">
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Estado inicial</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as ApiProjectStatus,
                    }))
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

              <div>
                <label className="block text-xs text-muted-foreground mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => {
                    const selected = form.color === c.value
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors',
                          selected
                            ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-200'
                            : 'border-border text-muted-foreground hover:border-gray-500 hover:text-foreground'
                        )}
                        aria-pressed={selected}
                      >
                        <span className={clsx('w-2.5 h-2.5 rounded-full', c.dot)} />
                        {c.label}
                        {selected && <Check className="w-3 h-3 text-brand-600 dark:text-brand-300" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={closeNew}
                disabled={createMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crear proyecto
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function ProjectGrid({
  projects,
  renderStar,
}: {
  projects: ApiProject[]
  renderStar: (id: string) => React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => {
        const badge = statusBadgeInfo(p.status)
        return (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="card overflow-hidden hover:border-brand-500/50 transition-colors group"
          >
            <div
              className={clsx(
                'h-24 bg-gradient-to-br p-4 flex items-start justify-between',
                projectGradientClass(p.color)
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] px-2 py-1 rounded-full bg-black/30 text-white">
                  {badge.label}
                </span>
                {renderStar(p.id)}
              </div>
            </div>
            <div className="p-4 space-y-3">
              <h3 className="font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors truncate">
                {p.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                {p.description || 'Sin descripción'}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <span>{p.membersCount} miembros</span>
                <span>{p.filesCount} documentos</span>
                <span>{formatRelativeTime(p.updatedAt ?? p.createdAt)}</span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function ProjectList({
  projects,
  renderStar,
}: {
  projects: ApiProject[]
  renderStar: (id: string) => React.ReactNode
}) {
  return (
    <div className="card divide-y divide-border">
      {projects.map((p) => {
        const badge = statusBadgeInfo(p.status)
        return (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="flex items-center gap-4 p-4 hover:bg-surface-secondary/60 transition-colors group"
          >
            <div
              className={clsx(
                'w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center',
                projectGradientClass(p.color)
              )}
            >
              <FolderKanban className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                  {p.name}
                </h3>
                <span
                  className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full border shrink-0',
                    badge.bgClass,
                    badge.textClass
                  )}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {p.description || 'Sin descripción'}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-5 text-xs text-muted-foreground shrink-0">
              <div className="flex items-center gap-1">
                <span className={clsx('w-2 h-2 rounded-full', projectColorClass(p.color))} />
                <span>{p.membersCount} miembros</span>
              </div>
              <span>{p.filesCount} documentos</span>
              <span className="w-20 text-right">
                {formatRelativeTime(p.updatedAt ?? p.createdAt)}
              </span>
            </div>
            {renderStar(p.id)}
          </Link>
        )
      })}
    </div>
  )
}

export default ProjectsPage
