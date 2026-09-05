import { useEffect, useMemo, useState } from 'react'
import {
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  RotateCcw,
  Loader2,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ApiProject,
  permanentlyDeleteProject,
  fetchProjects,
  formatRelativeTime,
  projectColorClass,
  projectGradientClass,
  updateProject,
} from '../services/projects.service'

const PAGE_SIZE = 9

function TrashPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [confirmRestoreProject, setConfirmRestoreProject] = useState<ApiProject | null>(null)
  const [confirmPermanentDeleteProject, setConfirmPermanentDeleteProject] =
    useState<ApiProject | null>(null)
  const [toast, setToast] = useState<{
    kind: 'error' | 'success'
    title: string
    message: string
  } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced])

  const query = useQuery({
    queryKey: ['projects', 'trash', { page, search: searchDebounced }],
    queryFn: () =>
      fetchProjects({
        status: 'ELIMINADO',
        page,
        pageSize: PAGE_SIZE,
        search: searchDebounced || undefined,
      }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })

  const restoreMutation = useMutation({
    mutationFn: (project: ApiProject) =>
      updateProject(project.id, { status: 'ACTIVE' as any }),
    onSuccess: (_, project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setToast({
        kind: 'success',
        title: 'Proyecto restaurado',
        message: `«${project.name}» volvió a estar activo correctamente.`,
      })
    },
    onError: (err: any) => {
      setToast({
        kind: 'error',
        title: 'No se pudo restaurar el proyecto',
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido. Inténtalo de nuevo.',
      })
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (project: ApiProject) => permanentlyDeleteProject(project.id),
    onSuccess: (_, project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setConfirmPermanentDeleteProject(null)
      if (items.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1))
      }
      setToast({
        kind: 'success',
        title: 'Proyecto eliminado permanentemente',
        message: `«${project.name}» y su contenido se borraron definitivamente.`,
      })
    },
    onError: (err: any) => {
      setToast({
        kind: 'error',
        title: 'No se pudo eliminar permanentemente',
        message:
          err?.response?.data?.message ||
          err?.message ||
          'Error desconocido. Revisa el proyecto tenga carpetas/archivos y vuelve a intentarlo.',
      })
    },
  })

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = query.data?.totalPages ?? 1
  const isLoading = query.isLoading && query.fetchStatus !== 'idle'
  const isEmpty = !isLoading && items.length === 0

  useEffect(() => {
    if (!query.data) return
    if (query.data.total === 0 && page !== 1) {
      setPage(1)
      return
    }
    if (query.data.totalPages > 0 && page > query.data.totalPages) {
      setPage(query.data.totalPages)
    }
  }, [page, query.data])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6500)
    return () => clearTimeout(t)
  }, [toast])

  const headerTotal = useMemo(() => {
    if (isLoading) return '…'
    if (query.isFetching && total === 0) return '…'
    return String(total)
  }, [isLoading, total, query.isFetching])

  const handleRestore = (p: ApiProject) => {
    setConfirmRestoreProject(p)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Papelera</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {headerTotal} proyectos eliminados recientemente
          </p>
        </div>
      </div>

      <div className="card p-4 flex items-start gap-3 bg-status-blocked/10 border-status-blocked/30">
        <AlertTriangle className="w-5 h-5 text-status-blocked shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground dark:text-slate-300 space-y-1">
          <p className="font-medium text-foreground">Proyectos en la papelera</p>
          <p>
            Los proyectos enviados a la papelera pueden <strong>restaurarse</strong> para volver
            a estar activos. También puedes eliminarlos de forma <strong>permanente</strong>,
            pero esa acción no se puede deshacer.
          </p>
        </div>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar en la papelera..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-base pl-10 py-1.5 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="h-24 bg-surface-secondary" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-surface-secondary rounded" />
                <div className="h-3 w-full bg-surface-secondary rounded" />
                <div className="h-3 w-5/6 bg-surface-secondary rounded" />
                <div className="flex gap-2 pt-2 border-t border-border">
                  <div className="h-8 flex-1 bg-surface-secondary rounded" />
                  <div className="h-8 flex-1 bg-surface-secondary rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="card p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-semibold">La papelera está vacía</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {searchDebounced
              ? 'Ningún proyecto eliminado coincide con tu búsqueda.'
              : 'No hay proyectos en la papelera. Los proyectos que elimines aparecerán aquí.'}
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
          {items.map((p) => {
            const isRestoring = restoreMutation.isPending && restoreMutation.variables?.id === p.id
            const isDeletingPermanently =
              permanentDeleteMutation.isPending &&
              permanentDeleteMutation.variables?.id === p.id
            return (
              <div
                key={p.id}
                className="card overflow-hidden border-status-blocked/30 hover:border-status-blocked/50 transition-colors"
              >
                <div
                  className={clsx(
                    'h-24 bg-gradient-to-br p-4 flex items-start justify-between relative overflow-hidden',
                    projectGradientClass(p.color)
                  )}
                >
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="relative w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <FolderKanban className="w-6 h-6 text-white" />
                  </div>
                  <span className="relative text-[10px] px-2 py-1 rounded-full bg-status-blocked/90 text-white">
                    Eliminado
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                    <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0 mt-1.5', projectColorClass(p.color))} />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {p.description || 'Sin descripción'}
                  </p>
                  <div className="text-xs text-muted-foreground pt-1">
                    Enviado a papelera {formatRelativeTime(p.updatedAt ?? p.createdAt)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                    <button
                      className={clsx('btn-primary text-sm py-2', isRestoring && 'opacity-70 cursor-wait')}
                      disabled={isRestoring}
                      onClick={() => handleRestore(p)}
                    >
                      {isRestoring ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Restaurando…
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          Restaurar
                        </>
                      )}
                    </button>
                    <button
                      className={clsx(
                        'btn-secondary text-sm py-2',
                        isDeletingPermanently &&
                          'opacity-70 cursor-wait border-status-blocked/40 text-status-blocked'
                      )}
                      disabled={isDeletingPermanently}
                      onClick={() => setConfirmPermanentDeleteProject(p)}
                      title="Eliminar permanentemente"
                    >
                      {isDeletingPermanently ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Eliminando…
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </>
                      )}
                    </button>
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

      {confirmRestoreProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmRestoreProject(null)}
        >
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-status-approved/15 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-status-approved" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Restaurar proyecto</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¿Restaurar el proyecto{' '}
                    <strong className="text-foreground">{confirmRestoreProject.name}</strong>?
                    Volverá a estar activo y aparecerá en Mis proyectos.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                className="btn-secondary text-sm"
                onClick={() => setConfirmRestoreProject(null)}
                disabled={restoreMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  restoreMutation.mutate(confirmRestoreProject)
                  setConfirmRestoreProject(null)
                }}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending &&
                restoreMutation.variables?.id === confirmRestoreProject.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Restaurando…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Sí, restaurar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPermanentDeleteProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmPermanentDeleteProject(null)}
        >
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-status-blocked/15 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-status-blocked" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    Eliminar permanentemente
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¿Eliminar de forma permanente el proyecto{' '}
                    <strong className="text-foreground">
                      {confirmPermanentDeleteProject.name}
                    </strong>
                    ? Esta acción no se puede deshacer y borrará sus datos relacionados.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
              <button
                className="btn-secondary text-sm"
                onClick={() => setConfirmPermanentDeleteProject(null)}
                disabled={permanentDeleteMutation.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn-primary text-sm bg-status-blocked hover:bg-status-blocked/90 focus-visible:ring-status-blocked/40"
                onClick={() => permanentDeleteMutation.mutate(confirmPermanentDeleteProject)}
                disabled={permanentDeleteMutation.isPending}
              >
                {permanentDeleteMutation.isPending &&
                permanentDeleteMutation.variables?.id === confirmPermanentDeleteProject.id ? (
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
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm w-full">
          <div
            className={clsx(
              'card shadow-lg border flex items-start gap-3 p-4 pr-12 animate-in fade-in slide-in-from-right-4',
              toast.kind === 'error'
                ? 'border-status-blocked/40 bg-status-blocked/10'
                : 'border-status-approved/40 bg-status-approved/10'
            )}
            role="status"
            aria-live="polite"
          >
            <div
              className={clsx(
                'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center',
                toast.kind === 'error'
                  ? 'bg-status-blocked/15 text-status-blocked'
                  : 'bg-status-approved/15 text-status-approved'
              )}
            >
              {toast.kind === 'error' ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h4 className="font-semibold text-sm text-foreground">{toast.title}</h4>
              <p className="text-xs text-muted-foreground dark:text-slate-300 mt-1 break-words">
                {toast.message}
              </p>
            </div>
            <button
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground"
              onClick={() => setToast(null)}
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrashPage
