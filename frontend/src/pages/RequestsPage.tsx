import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  approveRequest,
  createRequest,
  fetchRequestCount,
  fetchRequests,
  rejectRequest,
  requestStatusMeta,
  RequestResourceType,
  RequestScope,
  RequestStatus,
  resourceTypeLabel,
  type ApiAccessRequest,
} from '../services/requests.service'
import { formatRelativeTime } from '../services/projects.service'
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  FolderKanban,
  Inbox,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

type Tab = 'received' | 'sent'

function avatarInitials(name?: string | null, email?: string | null) {
  const s = name || email || '??'
  const parts = s.split(/\s+/).filter(Boolean).slice(0, 2)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (s.slice(0, 2)).toUpperCase()
}

function resourceIcon(t: RequestResourceType) {
  if (t === 'proyecto') return <FolderKanban className="w-4 h-4" />
  if (t === 'carpeta')  return <Folder className="w-4 h-4" />
  return <FileText className="w-4 h-4" />
}

function resourceColorClass(t: RequestResourceType): string {
  if (t === 'proyecto') return 'text-brand-600 dark:text-brand-300 bg-brand-500/10 ring-brand-500/20'
  if (t === 'carpeta')  return 'text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-amber-500/20'
  return 'text-sky-600 dark:text-sky-300 bg-sky-500/10 ring-sky-500/20'
}

export default function RequestsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('received')
  const [status, setStatus] = useState<RequestStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const [search, setSearch] = useState('')

  const scope: RequestScope = tab === 'received' ? 'received' : 'sent'
  const listKey = ['requests', 'list', { scope, status, page, pageSize: PAGE_SIZE }]
  const countKey = ['requests', 'count']

  const countQuery = useQuery({
    queryKey: countKey,
    queryFn: fetchRequestCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: () => fetchRequests({
      scope,
      status: status === 'ALL' ? null : status,
      page,
      pageSize: PAGE_SIZE,
    }),
    staleTime: 30_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })

  const items: ApiAccessRequest[] = listQuery.data?.items ?? []
  const total: number = listQuery.data?.total ?? 0
  const totalPages: number = listQuery.data?.totalPages ?? 1
  const isLoading = listQuery.isLoading && listQuery.fetchStatus !== 'idle'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((r: ApiAccessRequest) => {
      const txt = [
        r.resourceName, r.requesterName, r.requesterEmail, r.ownerName, r.ownerEmail, r.message,
        resourceTypeLabel(r.resourceType), requestStatusMeta(r.status).label,
      ].filter(Boolean).join(' ').toLowerCase()
      return txt.includes(q)
    })
  }, [items, search])

  const approveMut = useMutation({
    mutationFn: (id: string) => approveRequest(id, { permissionScope: 'view' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: listKey })
      void qc.invalidateQueries({ queryKey: countKey })
      void qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
  const rejectMut = useMutation({
    mutationFn: rejectRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: listKey })
      void qc.invalidateQueries({ queryKey: countKey })
      void qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
  const requestMut = useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: listKey })
      void qc.invalidateQueries({ queryKey: countKey })
      void qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })

  const pendReceived = countQuery.data?.pendingReceived ?? 0
  const pendSent = countQuery.data?.pendingSent ?? 0
  const myId = user?.id

  return (
    <div className="p-6 w-full max-w-full mx-auto space-y-6 overflow-x-hidden min-w-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">Solicitudes de acceso</h1>
          <p className="text-muted-foreground text-sm mt-1 truncate">
            Gestiona peticiones de acceso a recursos y las solicitudes que has enviado.
          </p>
        </div>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-3 min-w-0 w-full">
        <nav role="tablist" aria-label="Tipo de solicitudes" className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-secondary/50 ring-1 ring-border">
          <button
            role="tab"
            aria-selected={tab === 'received'}
            onClick={() => { setTab('received') ; setPage(1) }}
            className={clsx(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-medium transition shrink-0',
              tab === 'received'
                ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200 ring-1 ring-brand-500/30 shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-secondary'
            )}
          >
            <Inbox className="w-3.5 h-3.5" />
            Recibidas
            {(countQuery.isSuccess) && pendReceived > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 h-4 min-w-[20px] rounded-full bg-status-blocked text-white text-[10px] font-semibold">
                {pendReceived}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'sent'}
            onClick={() => { setTab('sent') ; setPage(1) }}
            className={clsx(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-medium transition shrink-0',
              tab === 'sent'
                ? 'bg-brand-500/15 text-brand-700 dark:text-brand-200 ring-1 ring-brand-500/30 shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-secondary'
            )}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Enviadas
            {(countQuery.isSuccess) && pendSent > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 h-4 min-w-[20px] rounded-full bg-status-draft text-white text-[10px] font-semibold">
                {pendSent}
              </span>
            )}
          </button>
        </nav>

        <div className="flex items-center gap-2 flex-wrap ml-auto min-w-0 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[200px] sm:w-[280px] sm:flex-none w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por recurso, persona, estado, mensaje..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-10 py-1.5 text-sm w-full min-w-0"
            />
          </div>
          <select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(e) => { setStatus(e.target.value as RequestStatus | 'ALL') ; setPage(1) }}
            className="input-base py-1.5 text-sm h-9 w-[140px] shrink-0"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="APROBADO">Aprobadas</option>
            <option value="RECHAZADO">Rechazadas</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="card divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 sm:p-4 flex items-start sm:items-center gap-3 sm:gap-4 animate-pulse min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface-secondary shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-4 w-1/2 bg-surface-secondary rounded" />
                <div className="h-3 w-2/3 bg-surface-secondary rounded" />
                <div className="h-3 w-1/3 bg-surface-secondary rounded" />
              </div>
              <div className="h-7 w-24 bg-surface-secondary rounded shrink-0" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center shrink-0">
            <Inbox className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-semibold">
            {tab === 'received' ? 'No tienes solicitudes recibidas' : 'No has enviado solicitudes aún'}
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {search || status !== 'ALL'
              ? 'Ningún resultado coincide con los filtros actuales.'
              : tab === 'received'
                ? 'Cuando alguien pida acceso a tus recursos, aparecerá aquí para aprobar o rechazar.'
                : 'Pide acceso a un recurso privado y tu solicitud aparecerá en esta pestaña.'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-border min-w-0 w-full">
          {filtered.map((r: ApiAccessRequest) => {
            const meta = requestStatusMeta(r.status)
            const isReceived = tab === 'received' || r.ownerId === myId
            const canResolve = isReceived && r.status === 'PENDIENTE' && r.ownerId === myId
            const personName = isReceived ? (r.requesterName || r.requesterEmail || 'Solicitante') : (r.ownerName || r.ownerEmail || 'Propietario')
            const personEmail = isReceived ? r.requesterEmail : r.ownerEmail
            return (
              <div key={r.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-surface-secondary/40 transition-colors min-w-0 w-full">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-gradient-to-br from-brand-500/80 to-accent-500/80 text-white text-sm font-semibold flex items-center justify-center ring-1 ring-black/5"
                    title={personEmail || personName || ''}
                  >
                    {avatarInitials(personName, personEmail)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate min-w-0" title={personName || ''}>
                        {personName || '—'}
                      </p>
                      <span className={clsx('inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full text-[10.5px] font-medium', meta.pill)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[300px]" title={personEmail || ''}>
                        {personEmail || ''}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 min-w-0">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-1.5 h-5 rounded-md ring-1 text-[11px] font-medium',
                          resourceColorClass(r.resourceType)
                        )}
                        title={resourceTypeLabel(r.resourceType)}
                      >
                        {resourceIcon(r.resourceType)}
                        {resourceTypeLabel(r.resourceType)}
                      </span>
                      <a
                        className="text-sm font-medium text-brand-700 dark:text-brand-200 hover:underline truncate min-w-0 max-w-[520px]"
                        title={r.resourceName || ''}
                        href={
                          r.resourceType === 'proyecto' ? `/projects/${r.resourceId}` :
                          r.resourceType === 'carpeta'  ? `/projects/search?folder=${r.resourceId}` :
                                                          `/projects/search?file=${r.resourceId}`
                        }
                      >
                        {r.resourceName || '(Recurso sin nombre)'}
                      </a>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        · {formatRelativeTime(r.createdAt)}
                      </span>
                    </div>

                    {r.message && (
                      <p className="text-xs text-muted-foreground mt-2 rounded-lg bg-surface-secondary/50 ring-1 ring-border/60 px-2.5 py-1.5 whitespace-pre-wrap max-w-[680px]">
                        {r.message}
                      </p>
                    )}

                    {r.status !== 'PENDIENTE' && r.resolvedAt && (
                      <div className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                        Resuelta {formatRelativeTime(r.resolvedAt)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:ml-auto sm:pl-3 w-full sm:w-auto">
                  {canResolve ? (
                    <>
                      <button
                        className="btn-secondary text-xs sm:text-sm py-1 sm:py-1.5 whitespace-nowrap hover:bg-status-approved/10 hover:text-status-approved focus-visible:ring-status-approved/50"
                        disabled={approveMut.isPending || rejectMut.isPending}
                        onClick={() => void approveMut.mutate(r.id)}
                        title="Aprobar solicitud (permisos de lectura, descarga y comentario)"
                      >
                        {approveMut.variables === r.id && approveMut.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <CheckCircle2 className="w-4 h-4" />}
                        <span className="hidden sm:inline">Aprobar</span>
                      </button>
                      <button
                        className="btn-secondary text-xs sm:text-sm py-1 sm:py-1.5 whitespace-nowrap hover:bg-status-blocked/10 hover:text-status-blocked focus-visible:ring-status-blocked/50"
                        disabled={approveMut.isPending || rejectMut.isPending}
                        onClick={() => void rejectMut.mutate(r.id)}
                        title="Rechazar solicitud"
                      >
                        {rejectMut.variables === r.id && rejectMut.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <XCircle className="w-4 h-4" />}
                        <span className="hidden sm:inline">Rechazar</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                      {tab === 'sent'
                        ? (r.status === 'PENDIENTE' ? 'Pendiente de aprobación' : `Resuelto: ${meta.label}`)
                        : r.status === 'PENDIENTE'
                          ? 'Asignado a otro propietario'
                          : `Resuelto: ${meta.label}`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="card p-3 flex flex-wrap items-center justify-between gap-3 min-w-0 w-full">
          <div className="text-xs text-muted-foreground min-w-0 truncate">
            Página {page} de {totalPages} · {total} resultados
            {search && filtered.length !== total ? ` · Filtrados ${filtered.length}` : ''}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50 whitespace-nowrap"
              disabled={page <= 1 || listQuery.isFetching || approveMut.isPending || rejectMut.isPending || requestMut.isPending}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              className="btn-secondary text-sm py-1.5 disabled:opacity-50 whitespace-nowrap"
              disabled={page >= totalPages || listQuery.isFetching || approveMut.isPending || rejectMut.isPending || requestMut.isPending}
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

export {
  fetchRequests,
  fetchRequestCount,
  approveRequest,
  rejectRequest,
  createRequest,
}
export type { ApiAccessRequest }
