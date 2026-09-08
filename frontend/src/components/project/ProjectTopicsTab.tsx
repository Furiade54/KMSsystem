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
  Users,
  CheckCircle2,
  UserPlus,
  ListChecks,
  Circle,
} from 'lucide-react'
import type { ApiTopic, ApiTopicItem, ApiTopicItemStatus, ApiTopicStatus } from '@/services/project-topics.service'
import { initials, topicItemStatusBadgeClass, topicItemStatusLabel, topicStatusBadgeClass, topicStatusLabel } from './fileHelpers'

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
  newTopicDescription: string
  newTopicOrder: number
  newTopicStatus: ApiTopicStatus
  newTopicError: string
  setNewTopicTitle: (v: string) => void
  setNewTopicDescription: (v: string) => void
  setNewTopicOrder: (v: number) => void
  setNewTopicStatus: (v: ApiTopicStatus) => void
  editTopicTitle: string
  editTopicDescription: string
  editTopicOrder: number
  editTopicStatus: ApiTopicStatus
  editTopicError: string
  setEditTopicTitle: (v: string) => void
  setEditTopicDescription: (v: string) => void
  setEditTopicOrder: (v: number) => void
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

  canAddTopicItems: boolean
  canEditTopicItems: boolean
  canDeleteTopicItems: boolean
  canAssignItemMembers: boolean

  topicItemsSearch: string
  setTopicItemsSearch: (v: string) => void
  topicItemsStatusFilter: ApiTopicItemStatus | ''
  setTopicItemsStatusFilter: (v: ApiTopicItemStatus | '') => void
  topicItemsLoading: boolean
  topicItemsIsError: boolean
  topicItemsItems: ApiTopicItem[] | undefined
  topicItemsTotal: number | undefined

  showNewTopicItem: boolean
  setShowNewTopicItem: (v: boolean) => void
  editingTopicItem: ApiTopicItem | null
  newTopicItemTitle: string
  newTopicItemDescription: string
  newTopicItemOrder: number
  newTopicItemStatus: ApiTopicItemStatus
  newTopicItemAssignedMembers: string[]
  setNewTopicItemAssignedMembers: (v: string[]) => void
  newTopicItemError: string
  setNewTopicItemTitle: (v: string) => void
  setNewTopicItemDescription: (v: string) => void
  setNewTopicItemOrder: (v: number) => void
  setNewTopicItemStatus: (v: ApiTopicItemStatus) => void
  editTopicItemTitle: string
  editTopicItemDescription: string
  editTopicItemOrder: number
  editTopicItemStatus: ApiTopicItemStatus
  editTopicItemAssignedMembers: string[]
  setEditTopicItemAssignedMembers: (v: string[]) => void
  editTopicItemError: string
  setEditTopicItemTitle: (v: string) => void
  setEditTopicItemDescription: (v: string) => void
  setEditTopicItemOrder: (v: number) => void
  setEditTopicItemStatus: (v: ApiTopicItemStatus) => void

  confirmDeleteTopicItem: ApiTopicItem | null
  setConfirmDeleteTopicItem: (m: ApiTopicItem | null) => void

  createTopicItemPending: boolean
  updateTopicItemPending: boolean
  deleteTopicItemPending: boolean

  onNewTopicItem: () => void
  onEditTopicItem: (item: ApiTopicItem) => void
  onSubmitTopicItem: (e: React.FormEvent) => void
  onConfirmDeleteTopicItem: () => void

  managingMembersForItemId: string | null
  setManagingMembersForItemId: (v: string | null) => void
  manageMembersError: string
  topicItemAvailableMembersLoading: boolean
  topicItemAvailableMembersIsError: boolean
  topicItemAvailableMembersItems:
    | Array<{
        projectMemberId: string
        userId: string
        userName?: string | null
        roleName?: string | null
        alreadyAssigned: boolean
        assignmentId?: string | null
      }>
    | undefined
  onOpenManageMembersForItem: (item: ApiTopicItem) => void
  onAssignItemMember: (projectMemberId: string) => void
  assignItemMemberPending: boolean
  onUnassignItemMember: (assignmentId: string) => void
  unassignItemMemberPending: boolean
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
    newTopicDescription,
    newTopicOrder,
    newTopicStatus,
    newTopicError,
    setNewTopicTitle,
    setNewTopicDescription,
    setNewTopicOrder,
    setNewTopicStatus,
    editTopicTitle,
    editTopicDescription,
    editTopicOrder,
    editTopicStatus,
    editTopicError,
    setEditTopicTitle,
    setEditTopicDescription,
    setEditTopicOrder,
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
    canAddTopicItems,
    canEditTopicItems,
    canDeleteTopicItems,
    canAssignItemMembers,
    topicItemsSearch,
    setTopicItemsSearch,
    topicItemsStatusFilter,
    setTopicItemsStatusFilter,
    topicItemsLoading,
    topicItemsIsError,
    topicItemsItems,
    topicItemsTotal,
    showNewTopicItem,
    setShowNewTopicItem,
    editingTopicItem,
    newTopicItemTitle,
    newTopicItemDescription,
    newTopicItemOrder,
    newTopicItemStatus,
    newTopicItemAssignedMembers,
    setNewTopicItemAssignedMembers,
    newTopicItemError,
    setNewTopicItemTitle,
    setNewTopicItemDescription,
    setNewTopicItemOrder,
    setNewTopicItemStatus,
    editTopicItemTitle,
    editTopicItemDescription,
    editTopicItemOrder,
    editTopicItemStatus,
    editTopicItemAssignedMembers,
    setEditTopicItemAssignedMembers,
    editTopicItemError,
    setEditTopicItemTitle,
    setEditTopicItemDescription,
    setEditTopicItemOrder,
    setEditTopicItemStatus,
    confirmDeleteTopicItem,
    setConfirmDeleteTopicItem,
    createTopicItemPending,
    updateTopicItemPending,
    deleteTopicItemPending,
    onNewTopicItem,
    onEditTopicItem,
    onSubmitTopicItem,
    onConfirmDeleteTopicItem,
    managingMembersForItemId,
    setManagingMembersForItemId,
    manageMembersError,
    topicItemAvailableMembersLoading,
    topicItemAvailableMembersIsError,
    topicItemAvailableMembersItems,
    onOpenManageMembersForItem,
    onAssignItemMember,
    assignItemMemberPending,
    onUnassignItemMember,
    unassignItemMemberPending,
  } = props

  const managingMembersItem =
    topicItemsItems?.find((i) => i.id === managingMembersForItemId) ?? null

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Temas del proyecto
          </h2>
          <p className="text-xs text-muted-foreground">
            Registrá los temas y conceptos, seguí su estado y la asignación a miembros del equipo.
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
                      {typeof topic.percentage === 'number' && (
                        <span className="inline-flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="relative w-20 h-2 rounded-full bg-surface-secondary overflow-hidden shrink-0">
                            <span
                              className={clsx(
                                'absolute inset-y-0 left-0 rounded-full transition-all',
                                topic.percentage >= 95
                                  ? 'bg-emerald-500'
                                  : topic.percentage >= 30
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                              )}
                              style={{ width: `${Math.max(0, Math.min(100, topic.percentage))}%` }}
                            />
                          </span>
                          <span className="text-[10.5px] font-semibold text-muted-foreground tabular-nums shrink-0">
                            {topic.percentage}%
                          </span>
                        </span>
                      )}
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
                    <div className="pt-3 pb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Detalles del tema
                      </div>
                      {(canAddTopicItems || canEditTopicItems) && (
                        <div className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground tabular-nums">
                          <ListChecks className="w-3.5 h-3.5" />
                          <span>{typeof topicItemsTotal === 'number' ? topicItemsTotal : 0} conceptos</span>
                        </div>
                      )}
                    </div>
                    {topic.description ? (
                      <div className="mt-2 text-[12px] text-foreground/85 whitespace-pre-wrap break-words rounded-md border border-border/70 bg-surface/60 px-3 py-2">
                        {topic.description}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11.5px] text-muted-foreground/70 italic">
                        Sin descripción.
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[180px]">
                          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                          <input
                            type="text"
                            placeholder="Buscar conceptos..."
                            value={topicItemsSearch}
                            onChange={(e) => setTopicItemsSearch(e.target.value)}
                            className="w-full h-7 pl-7 pr-3 text-[11.5px] rounded-md bg-surface/80 border border-border/80 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
                          />
                        </div>
                        <select
                          value={topicItemsStatusFilter}
                          onChange={(e) =>
                            setTopicItemsStatusFilter(
                              (e.target.value || '') as ApiTopicItemStatus | ''
                            )
                          }
                          className="h-7 px-2 text-[11px] rounded-md bg-surface/80 border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
                        >
                          <option value="">Todos estados</option>
                          <option value="PENDING">Pendientes</option>
                          <option value="IN_PROGRESS">En progreso</option>
                          <option value="COMPLETED">Completados</option>
                          <option value="BLOCKED">Bloqueados</option>
                        </select>
                        {canAddTopicItems && (
                          <button
                            className="btn-secondary text-[11px] px-2 h-7 inline-flex items-center"
                            onClick={onNewTopicItem}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Concepto
                          </button>
                        )}
                      </div>

                      <div className="rounded-lg border border-border/80 bg-surface/70 overflow-hidden divide-y divide-border/60">
                        {topicItemsLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-3 flex items-start gap-3 animate-pulse">
                              <div className="w-5 h-5 rounded bg-surface-secondary" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 w-60 bg-surface-secondary rounded" />
                                <div className="h-3 w-48 bg-surface-secondary rounded" />
                              </div>
                            </div>
                          ))
                        ) : topicItemsIsError ? (
                          <div className="p-4 text-center text-[12px] text-muted-foreground">
                            No se pudieron cargar los conceptos del tema.
                          </div>
                        ) : !topicItemsItems?.length ? (
                          <div className="p-6 text-center text-[12px] text-muted-foreground">
                            Aún no hay conceptos en este tema.
                            {canAddTopicItems ? (
                              <div className="mt-2">
                                <button
                                  onClick={onNewTopicItem}
                                  className="btn-secondary text-[11px] h-7 px-2.5 inline-flex items-center"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Agregar el primer concepto
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          topicItemsItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 flex items-start gap-3 hover:bg-surface-secondary/40 transition-colors"
                            >
                              <div className="pt-0.5 shrink-0">
                                <Circle className="w-4 h-4 text-muted-foreground/60" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-[12.5px] text-foreground truncate">
                                    {item.title}
                                  </span>
                                  <span
                                    className={clsx(
                                      'inline-flex items-center text-[10px] px-1.5 py-[1px] rounded-full',
                                      topicItemStatusBadgeClass(item.status)
                                    )}
                                  >
                                    {topicItemStatusLabel(item.status)}
                                  </span>
                                </div>
                                {item.description ? (
                                  <p className="mt-1 text-[11.5px] text-muted-foreground/85 line-clamp-2">
                                    {item.description}
                                  </p>
                                ) : null}
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {item.assignedMembers && item.assignedMembers.length > 0 ? (
                                    item.assignedMembers.map((m) => (
                                      <span
                                        key={m.assignmentId}
                                        className="inline-flex items-center gap-1 rounded-full bg-surface-secondary ring-1 ring-black/5 px-1.5 py-[1px] text-[10.5px]"
                                        title={`${m.userName ?? m.userId}${m.roleName ? ' · ' + m.roleName : ''}`}
                                      >
                                        <span className="w-3.5 h-3.5 rounded-full bg-brand-500/20 text-brand-700 dark:text-brand-300 grid place-items-center text-[9px] font-semibold">
                                          {initials(m.userName ?? m.userId)}
                                        </span>
                                        <span className="text-foreground/80">
                                          {m.userName?.split(' ')[0] ?? m.userId.slice(0, 6)}
                                        </span>
                                      </span>
                                    ))
                                  ) : null}
                                  {!item.assignedMembers?.length &&
                                  canAssignItemMembers ? (
                                    <span className="text-[10.5px] text-muted-foreground/60 italic inline-flex items-center gap-1">
                                      <Users className="w-3 h-3" />
                                      Sin asignar
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {canAssignItemMembers && (
                                  <button
                                    className="btn-ghost p-1 rounded-md h-7 w-7 text-muted-foreground hover:text-brand-600 hover:bg-brand-500/10 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
                                    title="Gestionar miembros"
                                    onClick={() => onOpenManageMembersForItem(item)}
                                  >
                                    {managingMembersForItemId === item.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <UserPlus className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                                {canEditTopicItems && (
                                  <button
                                    className="btn-ghost p-1 rounded-md h-7 w-7 text-muted-foreground hover:text-brand-600 hover:bg-brand-500/10 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
                                    title="Editar concepto"
                                    onClick={() => onEditTopicItem(item)}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canDeleteTopicItems && (
                                  <button
                                    className="btn-ghost p-1 rounded-md h-7 w-7 text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10 focus-visible:ring-2 focus-visible:ring-status-blocked/50 focus:outline-none"
                                    title="Eliminar concepto"
                                    onClick={() => setConfirmDeleteTopicItem(item)}
                                  >
                                    {deleteTopicItemPending && confirmDeleteTopicItem?.id === item.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
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
                <label className="block text-[11.5px] text-muted-foreground mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={editingTopic ? editTopicDescription : newTopicDescription}
                  onChange={(e) =>
                    editingTopic
                      ? setEditTopicDescription(e.target.value)
                      : setNewTopicDescription(e.target.value)
                  }
                  placeholder="Detalle del tema, contexto, enlaces..."
                  className="input-base w-full text-[12px] resize-none"
                  maxLength={2000}
                />
                <div className="text-right text-[10px] text-muted-foreground/60 mt-0.5">
                  {(editingTopic ? editTopicDescription : newTopicDescription).length}/2000
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-[11.5px] text-muted-foreground mb-1">Estado</label>
                  <select
                    value={editingTopic ? editTopicStatus : newTopicStatus}
                    onChange={(e) =>
                      editingTopic
                        ? setEditTopicStatus(e.target.value as ApiTopicStatus)
                        : setNewTopicStatus(e.target.value as ApiTopicStatus)
                    }
                    className="input-base text-[12px] h-9 w-full"
                  >
                    <option value="OPEN">Abierto</option>
                    <option value="IN_REVIEW">En revisión</option>
                    <option value="IN_PROGRESS">En progreso</option>
                    <option value="RESOLVED">Resuelto</option>
                    <option value="CLOSED">Cerrado</option>
                  </select>
                </div>
                <div className="min-w-[110px]">
                  <label className="block text-[11.5px] text-muted-foreground mb-1">Orden</label>
                  <input
                    type="number"
                    min={0}
                    value={editingTopic ? editTopicOrder : newTopicOrder}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (Number.isNaN(v)) return
                      editingTopic ? setEditTopicOrder(Math.max(0, v)) : setNewTopicOrder(Math.max(0, v))
                    }}
                    className="input-base text-[12px] h-9 w-full tabular-nums"
                  />
                </div>
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

      {showNewTopicItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={onSubmitTopicItem}
            className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-semibold text-foreground">
                {editingTopicItem ? 'Editar concepto' : 'Nuevo concepto'}
              </h3>
              <button
                type="button"
                className="btn-ghost p-1 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewTopicItem(false)}
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
                  value={editingTopicItem ? editTopicItemTitle : newTopicItemTitle}
                  onChange={(e) =>
                    editingTopicItem
                      ? setEditTopicItemTitle(e.target.value)
                      : setNewTopicItemTitle(e.target.value)
                  }
                  placeholder="Ej: Revisar auditoría de datos maestra"
                  className="input-base text-[12px] h-9 w-full"
                  maxLength={255}
                />
                <div className="text-right text-[10px] text-muted-foreground/60 mt-0.5">
                  {(editingTopicItem ? editTopicItemTitle : newTopicItemTitle).length}/255
                </div>
              </div>
              <div>
                <label className="block text-[11.5px] text-muted-foreground mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={editingTopicItem ? editTopicItemDescription : newTopicItemDescription}
                  onChange={(e) =>
                    editingTopicItem
                      ? setEditTopicItemDescription(e.target.value)
                      : setNewTopicItemDescription(e.target.value)
                  }
                  placeholder="Contexto, pasos a realizar, enlaces..."
                  className="input-base w-full text-[12px] resize-none"
                  maxLength={2000}
                />
                <div className="text-right text-[10px] text-muted-foreground/60 mt-0.5">
                  {(editingTopicItem ? editTopicItemDescription : newTopicItemDescription).length}/2000
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11.5px] text-muted-foreground mb-1">Estado</label>
                  <select
                    value={editingTopicItem ? editTopicItemStatus : newTopicItemStatus}
                    onChange={(e) =>
                      editingTopicItem
                        ? setEditTopicItemStatus(e.target.value as ApiTopicItemStatus)
                        : setNewTopicItemStatus(e.target.value as ApiTopicItemStatus)
                    }
                    className="input-base text-[12px] h-9 w-full"
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="IN_PROGRESS">En progreso</option>
                    <option value="COMPLETED">Completado</option>
                    <option value="BLOCKED">Bloqueado</option>
                  </select>
                </div>
                <div className="min-w-[110px]">
                  <label className="block text-[11.5px] text-muted-foreground mb-1">Orden</label>
                  <input
                    type="number"
                    min={0}
                    value={editingTopicItem ? editTopicItemOrder : newTopicItemOrder}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (Number.isNaN(v)) return
                      editingTopicItem
                        ? setEditTopicItemOrder(Math.max(0, v))
                        : setNewTopicItemOrder(Math.max(0, v))
                    }}
                    className="input-base text-[12px] h-9 w-full tabular-nums"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11.5px] text-muted-foreground">
                    Miembros asignados (actualizar al guardar)
                  </label>
                  <span className="text-[10.5px] text-muted-foreground/70">
                    {editingTopicItem
                      ? editTopicItemAssignedMembers.length
                      : newTopicItemAssignedMembers.length}{' '}
                    seleccionados
                  </span>
                </div>
                <div className="rounded-md border border-border/70 bg-surface/60 p-2 max-h-40 overflow-y-auto space-y-0.5">
                  {(topicItemsItems
                    ?.flatMap((i) => i.assignedMembers ?? [])
                    .filter(
                      (v, idx, arr) =>
                        idx === arr.findIndex((m) => m.projectMemberId === v.projectMemberId)
                    ) ?? []).length === 0 &&
                  topicItemsItems?.every((i) => !i.assignedMembers?.length) ? (
                    <div className="p-3 text-center text-[11px] text-muted-foreground/70 italic">
                      Para seleccionar miembros, abrí “Gestionar miembros” desde la tarjeta del
                      concepto (botón +persona) una vez creado.
                    </div>
                  ) : (
                    (topicItemsItems
                      ?.flatMap((i) => i.assignedMembers ?? [])
                      .filter(
                        (v, idx, arr) =>
                          idx === arr.findIndex((m) => m.projectMemberId === v.projectMemberId)
                      ) ?? []).map((m) => {
                      const checked =
                        editingTopicItem
                          ? editTopicItemAssignedMembers.includes(m.projectMemberId)
                          : newTopicItemAssignedMembers.includes(m.projectMemberId)
                      const toggle = () => {
                        const current = editingTopicItem
                          ? editTopicItemAssignedMembers
                          : newTopicItemAssignedMembers
                        const set = editingTopicItem
                          ? setEditTopicItemAssignedMembers
                          : setNewTopicItemAssignedMembers
                        set(
                          checked
                            ? current.filter((x) => x !== m.projectMemberId)
                            : [...current, m.projectMemberId]
                        )
                      }
                      return (
                        <label
                          key={m.projectMemberId}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-secondary/70 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="accent-brand-500"
                            checked={checked}
                            onChange={toggle}
                          />
                          <span className="w-4 h-4 rounded-full bg-brand-500/20 text-brand-700 dark:text-brand-300 grid place-items-center text-[9px] font-semibold shrink-0">
                            {initials(m.userName ?? m.userId)}
                          </span>
                          <span className="text-[11.5px] text-foreground/85 truncate">
                            {m.userName ?? m.userId}
                          </span>
                          {m.roleName ? (
                            <span className="ml-auto text-[10.5px] text-muted-foreground/70 shrink-0">
                              {m.roleName}
                            </span>
                          ) : null}
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
              {(editingTopicItem ? editTopicItemError : newTopicItemError) ? (
                <div className="rounded-md border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-[11.5px] text-status-blocked">
                  {editingTopicItem ? editTopicItemError : newTopicItemError}
                </div>
              ) : null}
            </div>
            <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-[11.5px] h-8 px-3"
                onClick={() => setShowNewTopicItem(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary text-[11.5px] h-8 px-3 inline-flex items-center gap-1.5"
                disabled={editingTopicItem ? updateTopicItemPending : createTopicItemPending}
              >
                {(editingTopicItem ? updateTopicItemPending : createTopicItemPending) && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {editingTopicItem ? 'Guardar' : 'Crear concepto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {managingMembersForItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="font-semibold text-foreground text-[14px] flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-500" />
                  Miembros del concepto
                </h3>
                {managingMembersItem ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    {managingMembersItem.title}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-ghost p-1 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setManagingMembersForItemId(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {manageMembersError ? (
                <div className="rounded-md border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-[11.5px] text-status-blocked">
                  {manageMembersError}
                </div>
              ) : null}
              {topicItemAvailableMembersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-surface-secondary" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-40 bg-surface-secondary rounded" />
                      <div className="h-3 w-24 bg-surface-secondary rounded" />
                    </div>
                    <div className="w-5 h-5 rounded bg-surface-secondary" />
                  </div>
                ))
              ) : topicItemAvailableMembersIsError ? (
                <div className="p-4 text-center text-[12px] text-muted-foreground">
                  No se pudieron cargar los miembros del proyecto.
                </div>
              ) : !topicItemAvailableMembersItems?.length ? (
                <div className="p-5 text-center text-[12px] text-muted-foreground">
                  El proyecto no tiene miembros para asignar.
                </div>
              ) : (
                topicItemAvailableMembersItems.map((m) => {
                  const isBusy = assignItemMemberPending || unassignItemMemberPending
                  return (
                    <div
                      key={m.projectMemberId}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border/70 bg-surface/70"
                    >
                      <span className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-700 dark:text-brand-300 grid place-items-center text-[11px] font-semibold shrink-0">
                        {initials(m.userName ?? m.userId)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-foreground truncate">
                          {m.userName ?? m.userId}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground truncate">
                          {m.roleName ?? 'Sin rol'}
                        </div>
                      </div>
                      {m.alreadyAssigned && m.assignmentId ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onUnassignItemMember(m.assignmentId as string)}
                          className="btn-ghost h-7 px-2 text-[11px] inline-flex items-center gap-1 text-status-blocked hover:bg-status-blocked/10 disabled:opacity-50"
                          title="Desasignar"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          Asignado
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onAssignItemMember(m.projectMemberId)}
                          className="btn-secondary h-7 px-2 text-[11px] inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          Asignar
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            <div className="border-t border-border px-4 py-3 flex items-center justify-end">
              <button
                type="button"
                className="btn-primary text-[11.5px] h-8 px-3"
                onClick={() => setManagingMembersForItemId(null)}
              >
                Listo
              </button>
            </div>
          </div>
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
                  ? Se eliminarán también sus conceptos y asignaciones. Esta acción no se puede
                  deshacer.
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

      {confirmDeleteTopicItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-status-blocked/15 text-status-blocked shrink-0 flex items-center justify-center ring-1 ring-black/5">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground">Eliminar concepto</h3>
                <p className="text-[12.5px] text-muted-foreground mt-1">
                  ¿Estás seguro que querés eliminar el concepto{' '}
                  <strong className="text-foreground">
                    “{confirmDeleteTopicItem.title || 'Sin título'}”
                  </strong>
                  ? Se retirarán también las asignaciones. Esta acción no se puede deshacer y
                  afectará el progreso del tema.
                </p>
              </div>
            </div>
            <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-[11.5px] h-8 px-3"
                onClick={() => setConfirmDeleteTopicItem(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger text-[11.5px] h-8 px-3 inline-flex items-center gap-1.5"
                onClick={onConfirmDeleteTopicItem}
                disabled={deleteTopicItemPending}
              >
                {deleteTopicItemPending ? (
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
