import clsx from 'clsx'
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Edit3,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react'
import type { ApiTopic, ApiTopicStatus } from '@/services/project-topics.service'
import { topicStatusBadgeClass, topicStatusLabel } from './fileHelpers'

export type ProjectTopicsTabProps = {
  topicsSearch: string
  setTopicsSearch: (v: string) => void
  topicsStatusFilter: ApiTopicStatus | ''
  setTopicsStatusFilter: (v: ApiTopicStatus | '') => void
  topicsPage: number
  setTopicsPage: (v: number | ((p: number) => number)) => void

  canEditTopics: boolean
  canDeleteTopics: boolean

  topicsLoading: boolean
  topicsFetchStatus: string
  topicsIsError: boolean
  topicsItems: ApiTopic[] | undefined
  topicsTotal: number | undefined
  topicsTotalPages: number | undefined
  topicsCurrentPage: number | undefined

  expandedTopicId: string | null
  setExpandedTopicId: (v: string | null | ((p: string | null) => string | null)) => void

  showNewTopic: boolean
  setShowNewTopic: (v: boolean) => void
  editingTopic: ApiTopic | null
  newTopicTitle: string
  newTopicStatus: ApiTopicStatus
  newTopicError: string
  setNewTopicTitle: (v: string) => void
  setNewTopicStatus: (v: ApiTopicStatus) => void
  editTopicTitle: string
  editTopicStatus: ApiTopicStatus
  editTopicError: string
  setEditTopicTitle: (v: string) => void
  setEditTopicStatus: (v: ApiTopicStatus) => void

  confirmDeleteTopic: ApiTopic | null
  setConfirmDeleteTopic: (m: ApiTopic | null) => void

  createTopicPending: boolean
  updateTopicPending: boolean
  deleteTopicPending: boolean

  onNewTopic: () => void
  onEditTopic: (topic: ApiTopic) => void
  onSubmitTopic: (e: React.FormEvent) => void
  onConfirmDeleteTopic: () => void

  formatRelativeTime: (iso: string | null | undefined) => string
}

export default function ProjectTopicsTab(props: ProjectTopicsTabProps) {
  const {
    topicsSearch,
    setTopicsSearch,
    topicsStatusFilter,
    setTopicsStatusFilter,
    topicsPage,
    setTopicsPage,
    canEditTopics,
    canDeleteTopics,
    topicsLoading,
    topicsFetchStatus,
    topicsIsError,
    topicsItems,
    topicsTotal,
    topicsTotalPages,
    topicsCurrentPage,
    expandedTopicId,
    setExpandedTopicId,
    showNewTopic,
    setShowNewTopic,
    editingTopic,
    newTopicTitle,
    newTopicStatus,
    newTopicError,
    setNewTopicTitle,
    setNewTopicStatus,
    editTopicTitle,
    editTopicStatus,
    editTopicError,
    setEditTopicTitle,
    setEditTopicStatus,
    confirmDeleteTopic,
    setConfirmDeleteTopic,
    createTopicPending,
    updateTopicPending,
    deleteTopicPending,
    onNewTopic,
    onEditTopic,
    onSubmitTopic,
    onConfirmDeleteTopic,
    formatRelativeTime,
  } = props

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Temas del proyecto
          </h2>
          <p className="text-xs text-muted-foreground">
            Registrá los temas y su estado para darle seguimiento durante el proyecto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Buscar temas..."
              value={topicsSearch}
              onChange={(e) => {
                setTopicsSearch(e.target.value)
                setTopicsPage(1)
              }}
              className="w-full h-8 pl-8 pr-3 text-[12px] rounded-md bg-surface-secondary/60 border border-border/80 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
            />
          </div>
          <select
            value={topicsStatusFilter}
            onChange={(e) => {
              setTopicsStatusFilter((e.target.value || '') as ApiTopicStatus | '')
              setTopicsPage(1)
            }}
            className="h-8 px-2 text-[11.5px] rounded-md bg-surface-secondary/60 border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
          >
            <option value="">Todos los estados</option>
            <option value="OPEN">Abiertos</option>
            <option value="IN_REVIEW">En revisión</option>
            <option value="IN_PROGRESS">En progreso</option>
            <option value="RESOLVED">Resueltos</option>
            <option value="CLOSED">Cerrados</option>
          </select>
          {canEditTopics && (
            <button
              className="btn-primary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60"
              onClick={onNewTopic}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5">Nuevo tema</span>
            </button>
          )}
        </div>

        <div className="card divide-y divide-border overflow-hidden">
          {topicsLoading && topicsFetchStatus !== 'idle' ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 flex items-start gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-surface-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-56 bg-surface-secondary rounded" />
                  <div className="h-3 w-80 bg-surface-secondary rounded" />
                  <div className="h-3 w-36 bg-surface-secondary rounded" />
                </div>
                <div className="h-5 w-20 bg-surface-secondary rounded" />
              </div>
            ))
          ) : topicsIsError ? (
            <div className="p-6 text-center text-muted-foreground">
              No se pudieron cargar los temas. Inténtalo de nuevo.
            </div>
          ) : !topicsItems?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              Aún no hay temas.
              {canEditTopics ? (
                <div className="mt-3">
                  <button
                    className="btn-secondary text-[11.5px] px-2.5 h-8 inline-flex items-center"
                    onClick={onNewTopic}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Crear el primer tema
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            topicsItems.map((topic) => (
              <div key={topic.id} className="flex flex-col">
                <div className="p-4 flex items-start gap-4">
                  <button
                    type="button"
                    className="w-10 h-10 rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0 ring-1 ring-black/5 hover:bg-brand-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
                    aria-label={expandedTopicId === topic.id ? 'Colapsar detalles' : 'Ver detalles del tema'}
                    onClick={() =>
                      setExpandedTopicId((prev) => (prev === topic.id ? null : topic.id))
                    }
                  >
                    {expandedTopicId === topic.id ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-foreground truncate">
                        {topic.title || 'Sin título'}
                      </h3>
                      <span
                        className={clsx(
                          'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full',
                          topicStatusBadgeClass(topic.status)
                        )}
                      >
                        {topicStatusLabel(topic.status)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80 tabular-nums">
                      <span>Creado {formatRelativeTime(topic.createdAt)}</span>
                      {topic.updatedAt && topic.updatedAt !== topic.createdAt ? (
                        <span>Actualizado {formatRelativeTime(topic.updatedAt)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEditTopics && (
                      <button
                        className="btn-ghost p-1 rounded-md h-8 w-8 text-muted-foreground hover:text-brand-600 hover:bg-brand-500/10 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
                        title="Editar tema"
                        onClick={() => onEditTopic(topic)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {canDeleteTopics && (
                      <button
                        className="btn-ghost p-1 rounded-md h-8 w-8 text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10 focus-visible:ring-2 focus-visible:ring-status-blocked/50 focus:outline-none"
                        title="Eliminar tema"
                        onClick={() => setConfirmDeleteTopic(topic)}
                      >
                        {deleteTopicPending && confirmDeleteTopic?.id === topic.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {expandedTopicId === topic.id ? (
                  <div className="border-t border-border bg-surface-secondary/25 px-4 pb-4">
                    <div className="pt-3 pb-1">
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Detalles del tema (comentarios y asignación próximamente)
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg border border-dashed border-border p-4 text-center text-[11.5px] text-muted-foreground">
                      En próximas versiones podrás agregar comentarios, archivos adjuntos y asignar
                      responsable directamente desde acá.
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {topicsTotalPages && topicsTotalPages > 1 ? (
          <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
            <span>
              Total {topicsTotal ?? 0} temas · Página {topicsCurrentPage ?? topicsPage} de{' '}
              {topicsTotalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn-secondary text-[11.5px] h-8 px-2"
                onClick={() => setTopicsPage((p) => Math.max(1, p - 1))}
                disabled={topicsPage <= 1}
              >
                Anterior
              </button>
              <button
                className="btn-secondary text-[11.5px] h-8 px-2"
                onClick={() =>
                  setTopicsPage((p) => Math.min(topicsTotalPages || p, p + 1))
                }
                disabled={topicsPage >= (topicsTotalPages || 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showNewTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={onSubmitTopic}
            className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-semibold text-foreground">
                {editingTopic ? 'Editar tema' : 'Nuevo tema'}
              </h3>
              <button
                type="button"
                className="btn-ghost p-1 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewTopic(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11.5px] text-muted-foreground mb-1">
                  Título <span className="text-status-blocked">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={editingTopic ? editTopicTitle : newTopicTitle}
                  onChange={(e) =>
                    editingTopic ? setEditTopicTitle(e.target.value) : setNewTopicTitle(e.target.value)
                  }
                  placeholder="Ej: Revisar checklist de entregable v1.2"
                  className="input-base text-[12px] h-9"
                  maxLength={255}
                />
                <div className="text-right text-[10px] text-muted-foreground/60 mt-0.5">
                  {(editingTopic ? editTopicTitle : newTopicTitle).length}/255
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] text-muted-foreground mb-1">Estado</label>
                <select
                  value={editingTopic ? editTopicStatus : newTopicStatus}
                  onChange={(e) =>
                    editingTopic
                      ? setEditTopicStatus(e.target.value as ApiTopicStatus)
                      : setNewTopicStatus(e.target.value as ApiTopicStatus)
                  }
                  className="input-base text-[12px] h-9"
                >
                  <option value="OPEN">Abierto</option>
                  <option value="IN_REVIEW">En revisión</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="RESOLVED">Resuelto</option>
                  <option value="CLOSED">Cerrado</option>
                </select>
              </div>
              {(editingTopic ? editTopicError : newTopicError) ? (
                <div className="rounded-md border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-[11.5px] text-status-blocked">
                  {editingTopic ? editTopicError : newTopicError}
                </div>
              ) : null}
            </div>
            <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-[11.5px] h-8 px-3"
                onClick={() => setShowNewTopic(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary text-[11.5px] h-8 px-3 inline-flex items-center gap-1.5"
                disabled={editingTopic ? updateTopicPending : createTopicPending}
              >
                {(editingTopic ? updateTopicPending : createTopicPending) && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {editingTopic ? 'Guardar cambios' : 'Crear tema'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-status-blocked/15 text-status-blocked shrink-0 flex items-center justify-center ring-1 ring-black/5">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground">Eliminar tema</h3>
                <p className="text-[12.5px] text-muted-foreground mt-1">
                  ¿Estás seguro que querés eliminar el tema{' '}
                  <strong className="text-foreground">
                    “{confirmDeleteTopic.title || 'Sin título'}”
                  </strong>
                  ? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-[11.5px] h-8 px-3"
                onClick={() => setConfirmDeleteTopic(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger text-[11.5px] h-8 px-3 inline-flex items-center gap-1.5"
                onClick={onConfirmDeleteTopic}
                disabled={deleteTopicPending}
              >
                {deleteTopicPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
