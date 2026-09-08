import type { ChangeEvent, MutableRefObject } from 'react'
import { useState } from 'react'
import clsx from 'clsx'
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  Edit3,
  Trash2,
  Loader2,
  Users,
  UserMinus,
  Upload,
  Link2,
  Unlink,
  Download,
  Link as LinkIcon,
  CheckSquare,
  Square,
  X as XIcon,
} from 'lucide-react'
import type { ApiMeeting, ApiMeetingLinkedTopic, ApiMeetingStatus } from '@/services/meetings.service'
import type { ApiTopic } from '@/services/project-topics.service'
import type { ProjectMember } from '@/services/projects.service'
import type { ApiFile } from '@/services/files.service'
import { formatBytes } from '@/services/files.service'
import { formatRelativeTime } from '@/services/projects.service'
import { colorForKind, iconForKind, meetingStatusBadgeClass, meetingStatusLabel } from './fileHelpers'
import { fileKind } from '@/services/files.service'

type MeetingParticipantRow = {
  meetingId: string
  userId: string
  userFullName?: string | null
  userEmail?: string | null
  roleName?: string | null
  attended: boolean
}

export type ProjectMeetingsTabProps = {
  meetingsSearch: string
  setMeetingsSearch: (v: string) => void
  meetingsStatusFilter: ApiMeetingStatus | ''
  setMeetingsStatusFilter: (v: ApiMeetingStatus | '') => void
  meetingsPage: number
  setMeetingsPage: (v: number | ((p: number) => number)) => void

  canEditMeetings: boolean
  canDeleteMeetings: boolean

  meetingsLoading: boolean
  meetingsFetchStatus: string
  meetingsError: boolean
  meetingsItems: ApiMeeting[] | undefined
  meetingsTotal: number | undefined
  meetingsTotalPages: number | undefined
  meetingsCurrentPage: number | undefined

  participantsLoading: boolean
  participantsError: boolean
  participantsItems: MeetingParticipantRow[] | undefined

  meetingFiles: ApiFile[] | undefined

  expandedMeetingId: string | null
  setExpandedMeetingId: (v: string | null | ((p: string | null) => string | null)) => void
  meetingPanelTab: 'participants' | 'file'
  setMeetingPanelTab: (v: 'participants' | 'file') => void

  showAddMeetingParticipant: string | null
  setShowAddMeetingParticipant: (v: string | null) => void
  newParticipantUserId: string
  setNewParticipantUserId: (v: string) => void
  newParticipantRole: string
  setNewParticipantRole: (v: string) => void
  newParticipantAttended: boolean
  setNewParticipantAttended: (v: boolean) => void

  members: ProjectMember[] | undefined

  isUploadingActa: boolean
  setRemoveMeetingFileId: (v: string | null) => void
  removeMeetingFileId: string | null
  setFilePickerSearch: (v: string) => void
  setShowFilePicker: (v: boolean) => void
  minutesUploadInputRef: MutableRefObject<HTMLInputElement | null>

  confirmDeleteMeeting: ApiMeeting | null
  setConfirmDeleteMeeting: (m: ApiMeeting | null) => void

  upsertParticipantPending: boolean
  setAttendancePending: boolean
  removeParticipantPending: boolean
  setMinutesFilePending: boolean
  deleteMeetingPending: boolean

  onNewMeeting: () => void
  onEditMeeting: (meeting: ApiMeeting) => void
  onSubmitAddParticipant: (meetingId: string) => void
  onToggleAttendance: (meetingId: string, userId: string, attended: boolean) => void
  onRemoveParticipant: (meetingId: string, userId: string) => void
  onUploadActa: (ev: ChangeEvent<HTMLInputElement>, meetingId: string) => void
  onConfirmUnlinkActa: (meetingId: string) => void

  projectTopicsItems: ApiTopic[] | undefined
  linkingTopicsForMeetingId: string | null
  setLinkingTopicsForMeetingId: (v: string | null) => void
  meetingLinkedTopicsLoading: boolean
  meetingLinkedTopicsItems: ApiMeetingLinkedTopic[]
  linkTopicPending: boolean
  unlinkTopicPending: boolean
  onLinkTopic: (meetingId: string, topicId: string) => void
  onUnlinkTopic: (meetingId: string, topicId: string) => void
}

export default function ProjectMeetingsTab(props: ProjectMeetingsTabProps) {
  const {
    meetingsSearch,
    setMeetingsSearch,
    meetingsStatusFilter,
    setMeetingsStatusFilter,
    meetingsPage,
    setMeetingsPage,
    canEditMeetings,
    canDeleteMeetings,
    meetingsLoading,
    meetingsFetchStatus,
    meetingsError,
    meetingsItems,
    meetingsTotal,
    meetingsTotalPages,
    meetingsCurrentPage,
    participantsLoading,
    participantsError,
    participantsItems,
    meetingFiles,
    expandedMeetingId,
    setExpandedMeetingId,
    meetingPanelTab,
    setMeetingPanelTab,
    showAddMeetingParticipant,
    setShowAddMeetingParticipant,
    newParticipantUserId,
    setNewParticipantUserId,
    newParticipantRole,
    setNewParticipantRole,
    newParticipantAttended,
    setNewParticipantAttended,
    members,
    isUploadingActa,
    setRemoveMeetingFileId,
    removeMeetingFileId,
    setFilePickerSearch,
    setShowFilePicker,
    minutesUploadInputRef,
    confirmDeleteMeeting,
    setConfirmDeleteMeeting,
    upsertParticipantPending,
    setAttendancePending,
    removeParticipantPending,
    setMinutesFilePending,
    deleteMeetingPending,
    onNewMeeting,
    onEditMeeting,
    onSubmitAddParticipant,
    onToggleAttendance,
    onRemoveParticipant,
    onUploadActa,
    onConfirmUnlinkActa,
    projectTopicsItems,
    linkingTopicsForMeetingId,
    setLinkingTopicsForMeetingId,
    meetingLinkedTopicsLoading,
    meetingLinkedTopicsItems,
    linkTopicPending,
    unlinkTopicPending,
    onLinkTopic,
    onUnlinkTopic,
  } = props

  const [selectedTopicsToLink, setSelectedTopicsToLink] = useState<string[]>([])

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Reuniones del proyecto</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={meetingsSearch}
                onChange={(e) => {
                  setMeetingsSearch(e.target.value)
                  setMeetingsPage(1)
                }}
                placeholder="Buscar reuniones..."
                className="w-full h-8 pl-7 pr-2 text-[11.5px] rounded-md bg-surface-secondary/60 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
              />
            </div>
            <select
              value={meetingsStatusFilter}
              onChange={(e) => {
                setMeetingsStatusFilter((e.target.value || '') as ApiMeetingStatus | '')
                setMeetingsPage(1)
              }}
              className="h-8 px-2 text-[11.5px] rounded-md bg-surface-secondary/60 border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
            >
              <option value="">Todos los estados</option>
              <option value="SCHEDULED">Programadas</option>
              <option value="IN_PROGRESS">En curso</option>
              <option value="HELD">Realizadas</option>
              <option value="COMPLETED">Completadas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
            {canEditMeetings && (
              <button
                className="btn-primary text-[11.5px] px-2.5 h-8 min-w-[32px] focus-visible:ring-2 focus-visible:ring-brand-500/60"
                onClick={onNewMeeting}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1.5">Nueva reunión</span>
              </button>
            )}
          </div>
        </div>

        <div className="card divide-y divide-border overflow-visible">
          {meetingsLoading && meetingsFetchStatus !== 'idle' ? (
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
          ) : meetingsError ? (
            <div className="p-6 text-center text-muted-foreground">
              No se pudieron cargar las reuniones. Inténtalo de nuevo.
            </div>
          ) : !meetingsItems?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              Aún no hay reuniones.
              {canEditMeetings ? (
                <div className="mt-3">
                  <button
                    className="btn-secondary text-[11.5px] px-2.5 h-8 inline-flex items-center"
                    onClick={onNewMeeting}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Crear la primera reunión
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            meetingsItems.map((meeting) => (
              <div key={meeting.id} className="flex flex-col">
                <div className="p-4 flex items-start gap-4">
                  <button
                    type="button"
                    className="w-10 h-10 rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0 ring-1 ring-black/5 hover:bg-brand-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
                    aria-label={expandedMeetingId === meeting.id ? 'Colapsar detalles' : 'Ver detalles de la reunión'}
                    onClick={() => {
                      setExpandedMeetingId((prev) => (prev === meeting.id ? null : meeting.id))
                      setMeetingPanelTab('participants')
                    }}
                  >
                    {expandedMeetingId === meeting.id ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-foreground truncate">
                        {meeting.title || 'Sin título'}
                      </h3>
                      <span
                        className={clsx(
                          'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full',
                          meetingStatusBadgeClass(meeting.status)
                        )}
                      >
                        {meetingStatusLabel(meeting.status)}
                      </span>
                      {meeting.minutesFileId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-black/5">
                          <FileCheck2 className="w-3 h-3" />
                          Acta archivo vinculada
                        </span>
                      ) : null}
                    </div>
                    {meeting.description ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {meeting.description}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80 tabular-nums">
                      <span>
                        {meeting.meetingAt
                          ? `${formatRelativeTime(meeting.meetingAt)} · ${new Date(meeting.meetingAt).toLocaleString()}`
                          : 'Fecha por definir'}
                      </span>
                      <span>Creada {formatRelativeTime(meeting.createdAt)}</span>
                      {meeting.updatedAt && meeting.updatedAt !== meeting.createdAt ? (
                        <span>Actualizada {formatRelativeTime(meeting.updatedAt)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEditMeetings && (
                      <button
                        className="btn-ghost p-1 rounded-md h-8 w-8 text-muted-foreground hover:text-brand-600 hover:bg-brand-500/10 focus-visible:ring-2 focus-visible:ring-brand-500/60 focus:outline-none"
                        title="Editar reunión"
                        onClick={() => onEditMeeting(meeting)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {canDeleteMeetings && (
                      <button
                        className="btn-ghost p-1 rounded-md h-8 w-8 text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10 focus-visible:ring-2 focus-visible:ring-status-blocked/50 focus:outline-none"
                        title="Eliminar reunión"
                        onClick={() => setConfirmDeleteMeeting(meeting)}
                      >
                        {deleteMeetingPending && confirmDeleteMeeting?.id === meeting.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {expandedMeetingId === meeting.id ? (
                  <div className="border-t border-border bg-surface-secondary/25 px-4 pb-4">
                    <div className="flex flex-wrap items-center gap-1 pt-3 pb-3 border-b border-border/70">
                      <button
                        type="button"
                        className={clsx(
                          'h-7 px-3 text-[11.5px] rounded-md transition-colors',
                          meetingPanelTab === 'participants'
                            ? 'bg-brand-500/20 text-brand-700 dark:text-brand-200 ring-1 ring-brand-500/40'
                            : 'text-muted-foreground hover:bg-surface-secondary hover:text-foreground'
                        )}
                        onClick={() => setMeetingPanelTab('participants')}
                      >
                        <Users className="w-3.5 h-3.5 inline mr-1.5" />
                        Asistentes
                      </button>
                      <button
                        type="button"
                        className={clsx(
                          'h-7 px-3 text-[11.5px] rounded-md transition-colors',
                          meetingPanelTab === 'file'
                            ? 'bg-brand-500/20 text-brand-700 dark:text-brand-200 ring-1 ring-brand-500/40'
                            : 'text-muted-foreground hover:bg-surface-secondary hover:text-foreground'
                        )}
                        onClick={() => setMeetingPanelTab('file')}
                      >
                        <FileCheck2 className="w-3.5 h-3.5 inline mr-1.5" />
                        Acta archivo
                      </button>

                      <div className="ml-1 relative">
                        <button
                          type="button"
                          className={clsx(
                            'h-7 px-3 text-[11.5px] rounded-md transition-colors ring-1 ring-black/5',
                            linkingTopicsForMeetingId === meeting.id
                              ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/40'
                              : 'text-muted-foreground hover:bg-surface-secondary hover:text-foreground'
                          )}
                          onClick={() => {
                            const next = linkingTopicsForMeetingId === meeting.id ? null : meeting.id
                            setLinkingTopicsForMeetingId(next)
                            if (next) {
                              setSelectedTopicsToLink([])
                            }
                          }}
                        >
                          <LinkIcon className="w-3.5 h-3.5 inline mr-1.5" />
                          Temas ({meeting.linkedTopicsIds?.length ?? 0})
                          <ChevronDown className="w-3 h-3 inline ml-1.5 opacity-70" />
                        </button>

                        {linkingTopicsForMeetingId === meeting.id ? (
                          <div className="absolute left-0 top-full mt-1.5 z-20 w-80 card overflow-hidden shadow-lg ring-1 ring-black/5 flex flex-col">
                            <div className="px-3 py-2 border-b border-border bg-surface-secondary/40 flex items-center justify-between shrink-0">
                              <div className="min-w-0">
                                <p className="text-[11.5px] font-medium text-foreground flex items-center gap-1.5">
                                  <LinkIcon className="w-3.5 h-3.5 text-violet-600" />
                                  Temas vinculados
                                </p>
                                <p className="text-[10.5px] text-muted-foreground">
                                  Temas del proyecto tratados en esta reunión
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn-ghost h-7 w-7 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
                                onClick={() => {
                                  setLinkingTopicsForMeetingId(null)
                                  setSelectedTopicsToLink([])
                                }}
                              >
                                <XIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {(() => {
                              const linkedIds = new Set(meeting.linkedTopicsIds ?? [])
                              const availableCount = (projectTopicsItems ?? []).filter(
                                (t) => !linkedIds.has(t.id)
                              ).length
                              const totalProjectTopics = projectTopicsItems?.length ?? 0
                              const showFooter =
                                canEditMeetings && totalProjectTopics > 0 && availableCount > 0
                              return (
                                <>
                                  <div className="max-h-60 overflow-y-auto">
                                    {(() => {
                                      type LinkedRow = { id: string; title: string; status?: string; percentage?: number }
                                      const fromProject: LinkedRow[] = (projectTopicsItems ?? []).filter((t) =>
                                        linkedIds.has(t.id)
                                      )
                                      const fromLinkedDetails: LinkedRow[] = (meetingLinkedTopicsItems ?? [])
                                        .filter((l) => !linkedIds.has(l.topicId))
                                        .map((l) => ({ id: l.topicId, title: l.title }))
                                      const linkedRows: LinkedRow[] = [...fromProject, ...fromLinkedDetails].filter(
                                        (t, i, arr) => arr.findIndex((x) => x.id === t.id) === i
                                      )
                                      const availableTopics = (projectTopicsItems ?? []).filter(
                                        (t) => !linkedIds.has(t.id)
                                      )
                                      const hasLinkable = canEditMeetings && availableTopics.length > 0
                                      const hasEmptyAllLinked =
                                        canEditMeetings &&
                                        availableTopics.length === 0 &&
                                        totalProjectTopics > 0
                                      const hasNoTopics = canEditMeetings && totalProjectTopics === 0

                                return (
                                  <div className="p-2 space-y-2">
                                    {meetingLinkedTopicsLoading && meeting.linkedTopicsIds && meeting.linkedTopicsIds.length > 0 ? (
                                      <div className="px-2 py-3 text-center">
                                        <Loader2 className="w-4 h-4 animate-spin text-brand-600 mx-auto" />
                                      </div>
                                    ) : null}

                                    {linkedRows.length > 0 ? (
                                      <div className="space-y-1">
                                        {linkedRows.map((t) => {
                                          const detail = meetingLinkedTopicsItems.find(
                                            (l) => l.topicId === t.id
                                          )
                                          return (
                                            <div
                                              key={t.id}
                                              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-violet-500/10 ring-1 ring-violet-500/20"
                                            >
                                              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                              <div className="min-w-0 flex-1">
                                                <p className="text-[11.5px] font-medium text-foreground truncate">
                                                  {t.title}
                                                </p>
                                                {detail ? (
                                                  <p className="text-[10px] text-muted-foreground truncate">
                                                    Vinculado {formatRelativeTime(detail.linkedAt)}
                                                    {detail.linkedByUserName
                                                      ? ` · ${detail.linkedByUserName}`
                                                      : ''}
                                                  </p>
                                                ) : null}
                                              </div>
                                              {canEditMeetings ? (
                                                <button
                                                  type="button"
                                                  className="btn-ghost h-6 w-6 p-0.5 rounded text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10 shrink-0"
                                                  title="Desvincular tema"
                                                  onClick={() =>
                                                    onUnlinkTopic(meeting.id, t.id)
                                                  }
                                                  disabled={unlinkTopicPending}
                                                >
                                                  {unlinkTopicPending ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                  ) : (
                                                    <Unlink className="w-3.5 h-3.5" />
                                                  )}
                                                </button>
                                              ) : null}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">
                                        No hay temas vinculados a esta reunión.
                                      </div>
                                    )}

                                    {hasLinkable && (
                                      <div className="border-t border-border/70 pt-2 space-y-1">
                                        <p className="px-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                                          Vincular temas del proyecto
                                        </p>
                                        {availableTopics.map((t) => {
                                          const checked = selectedTopicsToLink.includes(t.id)
                                          return (
                                            <label
                                              key={t.id}
                                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-secondary cursor-pointer"
                                            >
                                              <button
                                                type="button"
                                                className="shrink-0 text-brand-600"
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  setSelectedTopicsToLink((prev) =>
                                                    prev.includes(t.id)
                                                      ? prev.filter((x) => x !== t.id)
                                                      : [...prev, t.id]
                                                  )
                                                }}
                                              >
                                                {checked ? (
                                                  <CheckSquare className="w-3.5 h-3.5" />
                                                ) : (
                                                  <Square className="w-3.5 h-3.5 opacity-70" />
                                                )}
                                              </button>
                                              <div className="min-w-0 flex-1">
                                                <p className="text-[11.5px] text-foreground truncate">
                                                  {t.title}
                                                </p>
                                                {typeof t.percentage === 'number' ? (
                                                  <p className="text-[10px] text-muted-foreground">
                                                    Progreso {t.percentage}%
                                                  </p>
                                                ) : null}
                                              </div>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    )}

                                    {hasEmptyAllLinked && (
                                      <div className="px-2 py-2 text-[11px] text-muted-foreground text-center border-t border-border/70 pt-2">
                                        Todos los temas del proyecto ya están vinculados.
                                      </div>
                                    )}

                                    {hasNoTopics && (
                                      <div className="px-2 py-2 text-[11px] text-muted-foreground text-center border-t border-border/70 pt-2">
                                        El proyecto aún no tiene temas creados.
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>

                            {showFooter && (
                              <div className="border-t border-border bg-surface-secondary/50 px-3 py-2 flex items-center justify-end shrink-0">
                                <button
                                  type="button"
                                  className="btn-secondary text-[11px] h-7 px-2"
                                  disabled={!selectedTopicsToLink.length || linkTopicPending}
                                  onClick={() => {
                                    selectedTopicsToLink.forEach((tid) =>
                                      onLinkTopic(meeting.id, tid)
                                    )
                                    setSelectedTopicsToLink([])
                                  }}
                                >
                                  {linkTopicPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Plus className="w-3 h-3" />
                                  )}
                                  <span className="ml-1">
                                    Vincular seleccionados ({selectedTopicsToLink.length})
                                  </span>
                                </button>
                              </div>
                            )}
                                </>
                              )
                            })()}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {meetingPanelTab === 'participants' && (
                      <div className="pt-3 space-y-2">
                        {canEditMeetings && showAddMeetingParticipant === meeting.id ? (
                          <div className="card overflow-hidden p-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-foreground mb-1">
                                  Miembro del proyecto
                                </label>
                                <select
                                  value={newParticipantUserId}
                                  onChange={(e) => setNewParticipantUserId(e.target.value)}
                                  className="w-full h-8 px-2 text-[11.5px] rounded-md bg-surface-secondary/70 border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
                                >
                                  <option value="">Seleccionar usuario…</option>
                                  {(members ?? []).map((m) => (
                                    <option key={m.userId} value={m.userId}>
                                      {m.fullName || m.email || m.userId}{m.roleName ? ` (${m.roleName})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-foreground mb-1">
                                  Rol
                                </label>
                                <input
                                  type="text"
                                  value={newParticipantRole}
                                  onChange={(e) => setNewParticipantRole(e.target.value)}
                                  placeholder="Ej: Moderador"
                                  className="w-full h-8 px-2 text-[11.5px] rounded-md bg-surface-secondary/70 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="inline-flex items-center gap-2 text-[11.5px] text-foreground cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newParticipantAttended}
                                  onChange={(e) => setNewParticipantAttended(e.target.checked)}
                                  className="accent-brand-500"
                                />
                                Ya asistió
                              </label>
                              <div className="ml-auto flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className="btn-secondary text-[11.5px] h-8 px-2"
                                  onClick={() => {
                                    setShowAddMeetingParticipant(null)
                                    setNewParticipantUserId('')
                                    setNewParticipantRole('')
                                    setNewParticipantAttended(false)
                                  }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  className="btn-primary text-[11.5px] h-8 px-2"
                                  onClick={() => onSubmitAddParticipant(meeting.id)}
                                  disabled={upsertParticipantPending}
                                >
                                  {upsertParticipantPending ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span className="ml-1.5">Guardando…</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span className="ml-1.5">Agregar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          canEditMeetings && (
                            <div className="flex items-center justify-between">
                              <p className="text-[11.5px] text-muted-foreground">
                                Usa el botón para agregar asistentes de los miembros del proyecto.
                              </p>
                              <button
                                type="button"
                                className="btn-secondary text-[11.5px] h-8 px-2"
                                onClick={() => {
                                  setShowAddMeetingParticipant(meeting.id)
                                  setNewParticipantUserId('')
                                  setNewParticipantRole('')
                                  setNewParticipantAttended(false)
                                }}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="ml-1.5">Agregar asistente</span>
                              </button>
                            </div>
                          )
                        )}

                        {participantsLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="card p-3 flex items-center gap-3 animate-pulse">
                              <div className="w-8 h-8 rounded-full bg-surface-secondary" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-52 bg-surface-secondary rounded" />
                                <div className="h-2.5 w-40 bg-surface-secondary rounded" />
                              </div>
                            </div>
                          ))
                        ) : participantsError ? (
                          <div className="text-[11.5px] text-muted-foreground text-center p-3">
                            No se pudieron cargar los asistentes.
                          </div>
                        ) : !participantsItems?.length ? (
                          <div className="text-[11.5px] text-muted-foreground text-center p-3">
                            No hay asistentes registrados.
                          </div>
                        ) : (
                          <div className="card divide-y divide-border overflow-hidden">
                            {participantsItems.map((p) => (
                              <div key={`${p.meetingId}-${p.userId}`} className="px-3 py-2 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-200 flex items-center justify-center ring-1 ring-black/5 text-[11.5px] font-semibold shrink-0">
                                  {p.userFullName
                                    ? p.userFullName
                                        .split(' ')
                                        .slice(0, 2)
                                        .map((s) => s[0]?.toUpperCase() ?? '')
                                        .join('')
                                    : (p.userEmail || 'U').slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-[12.5px] font-medium text-foreground truncate">
                                      {p.userFullName || p.userEmail || p.userId}
                                    </p>
                                    {p.roleName ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-secondary text-muted-foreground ring-1 ring-black/5">
                                        {p.roleName}
                                      </span>
                                    ) : null}
                                    <span
                                      className={clsx(
                                        'text-[10px] px-1.5 py-0.5 rounded-full',
                                        p.attended
                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-black/5'
                                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-black/5'
                                      )}
                                    >
                                      {p.attended ? 'Asistió' : 'Pendiente'}
                                    </span>
                                  </div>
                                  {p.userEmail ? (
                                    <p className="text-[11px] text-muted-foreground truncate">{p.userEmail}</p>
                                  ) : null}
                                </div>
                                {canEditMeetings ? (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      className={clsx(
                                        'h-7 px-2 text-[11px] rounded-md ring-1 ring-black/5',
                                        p.attended
                                          ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25'
                                          : 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25'
                                      )}
                                      disabled={setAttendancePending}
                                      onClick={() => onToggleAttendance(meeting.id, p.userId, !p.attended)}
                                    >
                                      Marcar {p.attended ? 'pendiente' : 'asistió'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-ghost h-8 w-8 p-1 rounded-md text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10"
                                      title="Retirar asistente"
                                      onClick={() => onRemoveParticipant(meeting.id, p.userId)}
                                    >
                                      {removeParticipantPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <UserMinus className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {meetingPanelTab === 'file' && (
                      <div className="pt-3 space-y-2">
                        <div className="card overflow-hidden">
                          <div className="px-3 py-2 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileCheck2 className="w-4 h-4 text-brand-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[11.5px] font-medium text-foreground">Archivo del acta</p>
                                <p className="text-[10.5px] text-muted-foreground truncate">
                                  Campo <code className="bg-surface-secondary/80 px-1 rounded">IdActaArchivo</code> en la reunión
                                </p>
                              </div>
                              <input
                                ref={minutesUploadInputRef}
                                type="file"
                                hidden
                                onChange={(e) => onUploadActa(e, meeting.id)}
                              />
                            </div>
                            {canEditMeetings ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  className="btn-primary text-[11.5px] h-8 px-2"
                                  onClick={() => {
                                    minutesUploadInputRef.current?.click()
                                  }}
                                  disabled={isUploadingActa || setMinutesFilePending}
                                >
                                  {isUploadingActa ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                  )}
                                  <span className="ml-1.5">
                                    {isUploadingActa ? 'Subiendo…' : 'Subir acta'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary text-[11.5px] h-8 px-2"
                                  onClick={() => {
                                    setFilePickerSearch('')
                                    setShowFilePicker(true)
                                  }}
                                  disabled={isUploadingActa || setMinutesFilePending}
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                  <span className="ml-1.5">Vincular existente</span>
                                </button>
                                {meeting.minutesFileId ? (
                                  <button
                                    type="button"
                                    className="btn-ghost text-[11.5px] h-8 px-2 text-status-blocked hover:bg-status-blocked/10"
                                    onClick={() => setRemoveMeetingFileId(meeting.id)}
                                    disabled={isUploadingActa || setMinutesFilePending}
                                  >
                                    {setMinutesFilePending && removeMeetingFileId === meeting.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Unlink className="w-3.5 h-3.5" />
                                    )}
                                    <span className="ml-1.5">Desvincular</span>
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div className="px-3 py-2.5">
                            {(() => {
                              const current =
                                meeting.minutesFileId
                                  ? (meetingFiles ?? []).find((f) => f.id === meeting.minutesFileId)
                                  : undefined
                              if (!meeting.minutesFileId) {
                                return (
                                  <p className="text-[11.5px] text-muted-foreground">
                                    No hay archivo vinculado. Usa “Subir acta” para cargar uno nuevo, o “Seleccionar archivo” para enlazar un archivo existente del proyecto.
                                  </p>
                                )
                              }
                              if (current) {
                                return (
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={clsx(
                                        'w-9 h-9 rounded-md flex items-center justify-center shrink-0 ring-1 ring-black/5 shadow-sm',
                                        colorForKind(fileKind(current))
                                      )}
                                    >
                                      {(() => {
                                        const Ic = iconForKind(fileKind(current))
                                        return <Ic className="w-4 h-4 text-white/95" />
                                      })()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12.5px] font-medium text-foreground truncate">
                                        {current.name}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {typeof current.sizeBytes === 'number' ? formatBytes(current.sizeBytes) : '—'}
                                        {current.extension ? ` · ${current.extension}` : ''}
                                        {current.createdAt
                                          ? ` · Subido ${formatRelativeTime(current.createdAt)}`
                                          : ''}
                                      </p>
                                    </div>
                                    {current.downloadUrl ? (
                                      <a
                                        href={current.downloadUrl}
                                        download={current.name}
                                        className="btn-secondary text-[11.5px] h-8 px-2 shrink-0 no-underline"
                                      >
                                        <Download className="w-3.5 h-3.5 inline mr-1" />
                                        Descargar
                                      </a>
                                    ) : null}
                                  </div>
                                )
                              }
                              return (
                                <p className="text-[11.5px] text-muted-foreground">
                                  Archivo vinculado ({String(meeting.minutesFileId).slice(0, 8)}…) pero no está visible en este proyecto.
                                  Puede haber sido movido o requiere volver a enlazarlo.
                                </p>
                              )
                            })()}
                          </div>
                        </div>

                        {removeMeetingFileId ? (
                          <div className="card overflow-hidden p-3 flex items-center justify-between bg-status-blocked/5">
                            <p className="text-[11.5px] text-foreground">
                              ¿Desvincular el archivo del acta en esta reunión?
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className="btn-secondary text-[11.5px] h-8 px-2"
                                onClick={() => setRemoveMeetingFileId(null)}
                                disabled={setMinutesFilePending}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="btn-primary text-[11.5px] h-8 px-2"
                                onClick={() => onConfirmUnlinkActa(removeMeetingFileId)}
                                disabled={setMinutesFilePending}
                              >
                                Sí, desvincular
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {meetingsTotalPages && meetingsTotalPages > 1 ? (
          <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
            <span>
              Total {meetingsTotal ?? 0} reuniones · Página {meetingsCurrentPage ?? meetingsPage} de{' '}
              {meetingsTotalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn-secondary text-[11.5px] h-8 px-2"
                onClick={() => setMeetingsPage((p) => Math.max(1, p - 1))}
                disabled={meetingsPage <= 1}
              >
                Anterior
              </button>
              <button
                className="btn-secondary text-[11.5px] h-8 px-2"
                onClick={() =>
                  setMeetingsPage((p) => Math.min(meetingsTotalPages || p, p + 1))
                }
                disabled={meetingsPage >= (meetingsTotalPages || 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
