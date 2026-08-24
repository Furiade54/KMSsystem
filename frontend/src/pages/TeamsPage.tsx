import { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  Shield,
  FolderKanban,
} from 'lucide-react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  OrgMember,
  fetchOrganizationMembers,
  formatRelativeTime,
} from '../services/projects.service'

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

function roleBadge(role?: string | null) {
  const r = (role || 'MIEMBRO').toUpperCase()
  if (r === 'ADMIN' || r === 'ADMINISTRADOR') {
    return { label: 'Administrador', bg: 'bg-status-blocked/20 dark:bg-status-blocked/15', text: 'text-rose-700 dark:text-rose-200', border: 'border-status-blocked/60 dark:border-status-blocked/40' }
  }
  if (r === 'OWNER' || r === 'PROPIETARIO') {
    return { label: 'Propietario', bg: 'bg-brand-500/20 dark:bg-brand-500/15', text: 'text-brand-700 dark:text-brand-200', border: 'border-brand-500/60 dark:border-brand-500/40' }
  }
  if (r === 'EDITOR') {
    return { label: 'Editor', bg: 'bg-status-review/20 dark:bg-status-review/15', text: 'text-amber-700 dark:text-amber-200', border: 'border-status-review/60 dark:border-status-review/40' }
  }
  return { label: 'Miembro', bg: 'bg-status-approved/20 dark:bg-status-approved/15', text: 'text-emerald-700 dark:text-emerald-200', border: 'border-status-approved/60 dark:border-status-approved/40' }
}

function TeamsPage() {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced])

  const query = useQuery({
    queryKey: ['org', 'members', { page, search: searchDebounced }],
    queryFn: () =>
      fetchOrganizationMembers({
        page,
        pageSize: PAGE_SIZE,
        search: searchDebounced || undefined,
      }),
    staleTime: 120_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })

  const items: OrgMember[] = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, total === 0 ? 0 : Math.ceil(total / PAGE_SIZE))
  const isLoading = query.isLoading && query.fetchStatus !== 'idle'
  const isEmpty = !isLoading && items.length === 0

  const headerTotal = useMemo(() => {
    if (isLoading) return '…'
    if (query.isFetching && total === 0) return '…'
    return String(total)
  }, [isLoading, total, query.isFetching])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {headerTotal} miembros en tu organización
          </p>
        </div>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar miembros por nombre o correo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-base pl-10 py-1.5 text-sm"
          />
        </div>
      </div>

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
          <h3 className="text-foreground font-semibold">No hay miembros para mostrar</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {searchDebounced
              ? 'Ningún miembro coincide con tu búsqueda. Prueba con otros términos.'
              : 'Invita a personas a tu organización para colaborar.'}
          </p>
          {searchDebounced && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  setSearchInput('')
                  setSearchDebounced('')
                }}
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((m) => {
            const badge = roleBadge(m.role)
            const inactive = (m.status || 'ACTIVO').toUpperCase() !== 'ACTIVO'
            return (
              <div
                key={m.id}
                className={clsx(
                  'card p-5 space-y-4 hover:border-brand-500/40 transition-colors',
                  inactive && 'opacity-70'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold text-sm ring-1 ring-white/10">
                    {initialsOf(m.fullName, m.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">
                      {m.fullName || m.email || 'Usuario'}
                    </h3>
                    {m.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{m.email}</span>
                      </div>
                    )}
                  </div>
                  {inactive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/15 text-muted-foreground dark:text-slate-300 border border-gray-500/30">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={clsx(
                      'text-[11px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1',
                      badge.bg,
                      badge.text,
                      badge.border
                    )}
                  >
                    <Shield className="w-3 h-3" />
                    {badge.label}
                  </span>
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <FolderKanban className="w-3.5 h-3.5" />
                      Proyectos
                    </span>
                    <span className="text-foreground font-medium">{m.projectsCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Se unió</span>
                    <span className="text-muted-foreground dark:text-slate-300">{formatRelativeTime(m.joinedAt)}</span>
                  </div>
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
    </div>
  )
}

export default TeamsPage
