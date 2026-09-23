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
  Link2,
  Unlink,
  Download,
  Link as LinkIcon,
  CheckSquare,
  Square,
  X as XIcon,
  CalendarClock,
  FileText,
  ListOrdered,
  GripVertical,
  Clock3,
} from 'lucide-react'
import type { ApiMeeting, ApiMeetingLinkedTopic, ApiMeetingStatus } from '@/services/meetings.service'
import type { ApiTopic } from '@/services/project-topics.service'
import type { ProjectMember } from '@/services/projects.service'
import type { ApiFile } from '@/services/files.service'
import { formatBytes } from '@/services/files.service'
import { formatRelativeTime, formatWallClockString } from '@/services/projects.service'
import { colorForKind, iconForKind, meetingStatusBadgeClass, meetingStatusLabel } from './fileHelpers'
import { fileKind } from '@/services/files.service'
import type {
  MeetingAgendaItem,
} from '../../../../packages/shared-types/src'
import type {
  CreateAgendaItemBody,
  DeleteAgendaBody,
  UpdateAgendaItemBody,
} from '@/services/meeting-agenda.service'

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
  canManageMeetingParticipants: boolean
  canManageMeetingMinutes: boolean

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

  agendaLoading: boolean
  agendaError: boolean
  agendaItems: MeetingAgendaItem[] | undefined
  agendaTotal: number | undefined

  meetingFiles: ApiFile[] | undefined

  expandedMeetingId: string | null
  setExpandedMeetingId: (v: string | null | ((p: string | null) => string | null)) => void
  meetingPanelTab: 'participants' | 'agenda' | 'topics' | 'minutes'
  setMeetingPanelTab: (v: 'participants' | 'agenda' | 'topics' | 'minutes') => void

  showAddMeetingParticipant: string | null
  setShowAddMeetingParticipant: (v: string | null) => void
  newParticipantUserId: string
  setNewParticipantUserId: (v: string) => void
  newParticipantRole: string
  setNewParticipantRole: (v: string) => void
  newParticipantAttended: boolean
  setNewParticipantAttended: (v: boolean) => void

  members: ProjectMember[] | undefined

  setRemoveMeetingFileId: (v: string | null) => void
  removeMeetingFileId: string | null
  onOpenFilePicker: () => void
  onGotoLinkedFile: (fileId: string) => void

  confirmDeleteMeeting: ApiMeeting | null
  setConfirmDeleteMeeting: (m: ApiMeeting | null) => void

  upsertParticipantPending: boolean
  setAttendancePending: boolean
  removeParticipantPending: boolean
  setMinutesFilePending: boolean
  createAgendaItemPending: boolean
  updateAgendaItemPending: boolean
  deleteAgendaItemPending: boolean
  deleteMeetingPending: boolean

  onNewMeeting: () => void
  onEditMeeting: (meeting: ApiMeeting) => void
  onSubmitAddParticipant: (meetingId: string) => void
  onToggleAttendance: (meetingId: string, userId: string, attended: boolean) => void
  onRemoveParticipant: (meetingId: string, userId: string) => void
  onConfirmUnlinkActa: (meetingId: string) => void

  onCreateAgendaItem: (meetingId: string, body: CreateAgendaItemBody) => void
  onUpdateAgendaItem: (meetingId: string, itemId: string, body: UpdateAgendaItemBody) => void
  onDeleteAgendaItem: (meetingId: string, itemId: string, body?: DeleteAgendaBody) => void

  projectTopicsItems: ApiTopic[] | undefined
  linkingTopicsForMeetingId: string | null
  setLinkingTopicsForMeetingId: (v: string | null) => void
  meetingLinkedTopicsLoading: boolean
  meetingLinkedTopicsItems: ApiMeetingLinkedTopic[]
  linkTopicPending: boolean
  unlinkTopicPending: boolean
  onLinkTopic: (meetingId: string, topicId: string) => void
  onUnlinkTopic: (meetingId: string, topicId: string) => void
  onGotoLinkedTopic?: (topicId: string) => void
}

const AGENDA_STATES: Array<MeetingAgendaItem['state']> = [
  'PENDIENTE',
  'EN_CURSO',
  'COMPLETADO',
  'OMITIDO',
  'DIFERIDO',
]

const AGENDA_STATE_BADGE: Record<MeetingAgendaItem['state'], string> = {
  PENDIENTE: 'bg-slate-100 text-slate-700 border border-slate-200',
  EN_CURSO: 'bg-amber-100 text-amber-800 border border-amber-200',
  COMPLETADO: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  OMITIDO: 'bg-rose-100 text-rose-800 border border-rose-200',
  DIFERIDO: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
}

function agendaStateLabel(s: MeetingAgendaItem['state']) {
  switch (s) {
    case 'PENDIENTE':
      return 'Pendiente'
    case 'EN_CURSO':
      return 'En curso'
    case 'COMPLETADO':
      return 'Completado'
    case 'OMITIDO':
      return 'Omitido'
    case 'DIFERIDO':
      return 'Diferido'
  }
}

export default function ProjectMeetingsTab(props: ProjectMeetingsTabProps) {
  const {
    meetingsSearch,
    setMeetingsSearch,
    meetingsStatusFilter,
    setMeetingsStatusFilter,
    setMeetingsPage,
    canEditMeetings,
    canDeleteMeetings,
    canManageMeetingParticipants,
    canManageMeetingMinutes,
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
    agendaLoading,
    agendaError,
    agendaItems,
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
    setRemoveMeetingFileId,
    removeMeetingFileId,
    onOpenFilePicker,
    onGotoLinkedFile,
    setConfirmDeleteMeeting,
    setMinutesFilePending,
    linkingTopicsForMeetingId,
    setLinkingTopicsForMeetingId,
    meetingLinkedTopicsLoading,
    meetingLinkedTopicsItems,
    linkTopicPending,
    unlinkTopicPending,
    onLinkTopic,
    onUnlinkTopic,
    onGotoLinkedTopic,
    onNewMeeting,
    onEditMeeting,
    onSubmitAddParticipant,
    onToggleAttendance,
    onRemoveParticipant,
    onConfirmUnlinkActa,
    onCreateAgendaItem,
    onUpdateAgendaItem,
    onDeleteAgendaItem,
    projectTopicsItems,
  } = props

  const [selectedTopicsToLink, setSelectedTopicsToLink] = useState<string[]>([])
  const [agendaEditor, setAgendaEditor] = useState<{
    meetingId: string
    itemId: string | null
    parentId: string | null
  } | null>(null)
  const [agendaDeleteConfirm, setAgendaDeleteConfirm] = useState<{
    meetingId: string
    itemId: string
  } | null>(null)

  const tabsDef: Array<{
    id: 'participants' | 'agenda' | 'topics' | 'minutes'
    label: string
    icon: any
    count: (m: ApiMeeting) => number
  }> = [
    {
      id: 'participants',
      label: 'Asistentes',
      icon: Users,
      count: (m) => participantsItems?.filter((p) => p.meetingId === m.id).length ?? 0,
    },
    {
      id: 'agenda',
      label: 'Orden del día',
      icon: ListOrdered,
      count: () => agendaItems?.length ?? 0,
    },
    {
      id: 'topics',
      label: 'Temas',
      icon: Link2,
      count: (m) => m.linkedTopicsIds?.length ?? 0,
    },
    {
      id: 'minutes',
      label: 'Acta',
      icon: FileText,
      count: (m) => (m.minutesFileId ? 1 : 0),
    },
  ]

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
              </div>
            ))
          ) : meetingsError ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Hubo un error cargando las reuniones.
            </div>
          ) : !meetingsItems || meetingsItems.length === 0 ? (
            <div className="p-10 text-center space-y-2 text-muted-foreground">
              <CalendarClock className="w-10 h-10 mx-auto text-muted-foreground/70" />
              <p className="text-sm">
                Todavía no hay reuniones.
                {canEditMeetings && <> Clic en <b>"Nueva reunión"</b> para programar la primera.</>}
              </p>
            </div>
          ) : (
            meetingsItems.map((m) => {
              const expanded = expandedMeetingId === m.id
              return (
                <div key={m.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMeetingId((prev) => (prev === m.id ? null : m.id))
                      }
                      className="w-11 h-11 rounded-xl bg-brand-100/70 text-brand-700 shrink-0 flex items-center justify-center hover:bg-brand-200/70 transition"
                    >
                      {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-foreground truncate">
                          {m.title}
                        </h3>
                        <span
                          className={clsx(
                            'px-1.5 py-[1px] rounded-full text-[10.5px] font-medium border',
                            meetingStatusBadgeClass(m.status)
                          )}
                        >
                          {meetingStatusLabel(m.status)}
                        </span>
                        {m.minutesFileId && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full text-[10.5px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <FileCheck2 className="w-3 h-3" />
                            Acta archivo vinculada
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11.5px] text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span>
                          {formatWallClockString(m.meetingAt)}
                        </span>
                        <span className="text-border/70">·</span>
                        <span>Creada {formatRelativeTime(m.createdAt)}</span>
                        {m.linkedTopicsIds?.length ? (
                          <>
                            <span className="text-border/70">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              Temas ({m.linkedTopicsIds.length})
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {canEditMeetings && (
                        <button
                          type="button"
                          onClick={() => onEditMeeting(m)}
                          className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-foreground"
                          title="Editar reunión"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteMeetings && (
                        <button
                          type="button"
                          disabled={props.deleteMeetingPending}
                          onClick={() => setConfirmDeleteMeeting(m)}
                          className="btn-ghost-square w-8 h-8 text-rose-600/80 hover:text-rose-600 disabled:opacity-50"
                          title="Eliminar reunión"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 pl-14 space-y-3">
                      <div className="flex flex-wrap gap-1.5 bg-surface-secondary/50 border border-border/70 rounded-xl p-1.5">
                        {tabsDef.map((t) => {
                          const active = meetingPanelTab === t.id
                          const Icon = t.icon
                          const count = t.count(m)
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setMeetingPanelTab(t.id)}
                              className={clsx(
                                'h-8 px-2.5 rounded-lg text-[11.5px] font-medium inline-flex items-center gap-1.5 transition',
                                active
                                  ? 'bg-card text-foreground shadow-sm border border-border/80'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-secondary'
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {t.label}
                              {count > 0 && (
                                <span className="px-1.5 py-[1px] rounded-full bg-muted/80 text-[10px] font-medium text-muted-foreground">
                                  {count}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {meetingPanelTab === 'participants' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11.5px] text-muted-foreground">
                              Usa el botón para agregar asistentes de los miembros del proyecto.
                            </p>
                            {canManageMeetingParticipants && (
                              <button
                                type="button"
                                disabled={props.upsertParticipantPending}
                                onClick={() =>
                                  setShowAddMeetingParticipant(
                                    showAddMeetingParticipant === m.id ? null : m.id
                                  )
                                }
                                className="btn-primary h-8 text-[11.5px] px-2.5 shadow-sm"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="ml-1.5">Agregar asistente</span>
                              </button>
                            )}
                          </div>

                          {canManageMeetingParticipants && showAddMeetingParticipant === m.id && (
                            <div className="p-3 border border-border/70 rounded-lg bg-surface-secondary/40 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2">
                                <select
                                  value={newParticipantUserId}
                                  onChange={(e) => setNewParticipantUserId(e.target.value)}
                                  className="h-8 px-2 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
                                >
                                  <option value="">Seleccionar miembro</option>
                                  {(members ?? [])
                                    .filter(
                                      (mm) =>
                                        !(
                                          participantsItems ?? []
                                        ).some(
                                          (pp) => pp.meetingId === m.id && pp.userId === mm.userId
                                        )
                                    )
                                    .map((mm) => (
                                      <option key={mm.userId} value={mm.userId}>
                                        {`${mm.fullName ?? ''} <${mm.email ?? ''}>`}
                                      </option>
                                    ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Rol (opcional)"
                                  value={newParticipantRole}
                                  onChange={(e) => setNewParticipantRole(e.target.value)}
                                  className="h-8 px-2 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60"
                                />
                                <label className="inline-flex items-center gap-2 px-2 h-8 rounded-md bg-card border border-border/80 text-[11.5px] text-foreground">
                                  <input
                                    type="checkbox"
                                    checked={newParticipantAttended}
                                    onChange={(e) => setNewParticipantAttended(e.target.checked)}
                                  />
                                  Asistió
                                </label>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddMeetingParticipant(null)
                                    setNewParticipantUserId('')
                                    setNewParticipantRole('')
                                    setNewParticipantAttended(false)
                                  }}
                                  className="btn-ghost h-8 px-3 text-[11.5px]"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={props.upsertParticipantPending}
                                  onClick={() => onSubmitAddParticipant(m.id)}
                                  className="btn-primary h-8 px-3 text-[11.5px]"
                                >
                                  {props.upsertParticipantPending && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  )}
                                  Confirmar
                                </button>
                              </div>
                            </div>
                          )}

                          {participantsLoading ? (
                            <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground p-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando asistentes...
                            </div>
                          ) : participantsError ? (
                            <div className="p-2 text-[11.5px] text-rose-700">
                              No se pudo cargar la lista de asistentes.
                            </div>
                          ) : (
                            (participantsItems ?? [])
                              .filter((p) => p.meetingId === m.id)
                              .length === 0 && (
                              <div className="p-3 text-center text-[11.5px] text-muted-foreground border border-dashed border-border/70 rounded-lg">
                                No hay asistentes registrados.
                              </div>
                            )
                          )}

                          <ul className="divide-y divide-border/70 border border-border/70 rounded-lg overflow-hidden">
                            {(participantsItems ?? [])
                              .filter((p) => p.meetingId === m.id)
                              .map((p) => (
                                <li key={`${p.meetingId}-${p.userId}`} className="p-3 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
                                    {(p.userFullName ?? p.userEmail ?? 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12.5px] font-medium text-foreground truncate">
                                      {p.userFullName ?? p.userEmail ?? 'Usuario'}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                                      {p.userEmail && <span>{p.userEmail}</span>}
                                      {p.roleName && (
                                        <>
                                          <span className="text-border/70">·</span>
                                          <span>Rol: {p.roleName}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <label className={clsx("inline-flex items-center gap-1.5 text-[11.5px] text-foreground select-none", !canManageMeetingParticipants && "opacity-60 pointer-events-none")}>
                                    <button
                                      type="button"
                                      onClick={() => onToggleAttendance(m.id, p.userId, !p.attended)}
                                      className={clsx("text-muted-foreground", canManageMeetingParticipants && "hover:text-emerald-600", !canManageMeetingParticipants && "pointer-events-none")}
                                      title={canManageMeetingParticipants ? "Marcar asistencia" : "Sin permiso para gestionar asistentes"}
                                      disabled={!canManageMeetingParticipants}
                                    >
                                      {p.attended ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                                      ) : (
                                        <Square className="w-4 h-4" />
                                      )}
                                    </button>
                                    {p.attended ? 'Asistió' : 'Ausente'}
                                  </label>
                                  {canManageMeetingParticipants && (
                                    <button
                                      type="button"
                                      disabled={props.removeParticipantPending}
                                      onClick={() => onRemoveParticipant(m.id, p.userId)}
                                      className="btn-ghost-square w-7 h-7 text-muted-foreground hover:text-rose-600 disabled:opacity-50"
                                      title="Retirar asistente"
                                    >
                                      <UserMinus className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                      {meetingPanelTab === 'agenda' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11.5px] text-muted-foreground">
                              Ítems del orden del día. Podes crear ítems de nivel raíz o anidarlos.
                            </p>
                            <div className="flex items-center gap-2">
                              {canEditMeetings && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAgendaEditor({
                                      meetingId: m.id,
                                      itemId: null,
                                      parentId: null,
                                    })
                                  }
                                  disabled={props.createAgendaItemPending}
                                  className="btn-primary h-8 px-2.5 text-[11.5px] shadow-sm"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span className="ml-1.5">Nuevo ítem</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {agendaEditor && agendaEditor.meetingId === m.id && (
                            <AgendaItemForm
                              meetingId={m.id}
                              editing={agendaEditor.itemId}
                              initialParentId={agendaEditor.parentId}
                              agendaItems={agendaItems ?? []}
                              members={members ?? []}
                              onClose={() => setAgendaEditor(null)}
                              onSave={(body, editing) => {
                                if (editing) {
                                  onUpdateAgendaItem(m.id, editing, body)
                                } else {
                                  onCreateAgendaItem(m.id, body)
                                }
                                setAgendaEditor(null)
                              }}
                              pendingUpdate={props.updateAgendaItemPending}
                              pendingCreate={props.createAgendaItemPending}
                            />
                          )}

                          {agendaLoading ? (
                            <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground p-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando orden del día...
                            </div>
                          ) : agendaError ? (
                            <div className="p-2 text-[11.5px] text-rose-700">
                              No se pudo cargar el orden del día.
                            </div>
                          ) : (!agendaItems || agendaItems.length === 0) && !agendaEditor ? (
                            <div className="p-4 text-center text-[11.5px] text-muted-foreground border border-dashed border-border/70 rounded-lg">
                              No hay ítems en el orden del día.
                            </div>
                          ) : null}

                          {(agendaItems ?? []).length > 0 && (
                            <AgendaItemsList
                              meetingId={m.id}
                              items={agendaItems ?? []}
                              parentId={null}
                              canEdit={canEditMeetings}
                              members={members ?? []}
                              onEdit={(item) =>
                                setAgendaEditor({
                                  meetingId: m.id,
                                  itemId: item.id,
                                  parentId: item.parentId,
                                })
                              }
                              onDelete={(item) =>
                                setAgendaDeleteConfirm({ meetingId: m.id, itemId: item.id })
                              }
                            />
                          )}

                          {agendaDeleteConfirm && agendaDeleteConfirm.meetingId === m.id && (
                            <div className="p-3 border border-amber-200 bg-amber-50/70 rounded-lg space-y-3">
                              <div className="text-[12.5px] text-amber-900 font-medium">
                                ¿Eliminar este ítem de la agenda?
                              </div>
                              <div className="text-[11.5px] text-amber-800">
                                Por defecto, los ítems hijos pasan a nivel raíz (Promover).
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAgendaDeleteConfirm(null)}
                                  className="btn-ghost h-8 px-3 text-[11.5px]"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={props.deleteAgendaItemPending}
                                  onClick={() => {
                                    if (!agendaDeleteConfirm) return
                                    onDeleteAgendaItem(
                                      agendaDeleteConfirm.meetingId,
                                      agendaDeleteConfirm.itemId,
                                      { orphanStrategy: 'PROMOTE_CHILDREN' }
                                    )
                                    setAgendaDeleteConfirm(null)
                                  }}
                                  className="btn-danger h-8 px-3 text-[11.5px]"
                                >
                                  Eliminar y promover
                                </button>
                                <button
                                  type="button"
                                  disabled={props.deleteAgendaItemPending}
                                  onClick={() => {
                                    if (!agendaDeleteConfirm) return
                                    onDeleteAgendaItem(
                                      agendaDeleteConfirm.meetingId,
                                      agendaDeleteConfirm.itemId,
                                      { orphanStrategy: 'DELETE_CHILDREN' }
                                    )
                                    setAgendaDeleteConfirm(null)
                                  }}
                                  className="btn-danger-ghost h-8 px-3 text-[11.5px]"
                                >
                                  Eliminar incluyendo hijos
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {meetingPanelTab === 'topics' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11.5px] text-muted-foreground">
                              Temas del proyecto tratados o a tratar en la reunión.
                            </p>
                            {canEditMeetings && (
                              <button
                                type="button"
                                onClick={() =>
                                  setLinkingTopicsForMeetingId(
                                    linkingTopicsForMeetingId === m.id ? null : m.id
                                  )
                                }
                                className="btn-primary h-8 text-[11.5px] px-2.5 shadow-sm"
                                disabled={linkTopicPending}
                              >
                                <LinkIcon className="w-3.5 h-3.5" />
                                <span className="ml-1.5">Vincular temas del proyecto</span>
                              </button>
                            )}
                          </div>

                          {canEditMeetings && linkingTopicsForMeetingId === m.id && (
                            <div className="p-3 border border-border/70 rounded-lg bg-surface-secondary/40 space-y-2">
                              <div className="text-[11.5px] text-muted-foreground">
                                Selecciona los temas que quieras vincular a esta reunión:
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto pr-1">
                                {(projectTopicsItems ?? []).map((t) => {
                                  const isLinked = (m.linkedTopicsIds ?? []).includes(t.id)
                                  const isSelected = selectedTopicsToLink.includes(t.id) || isLinked
                                  return (
                                    <label
                                      key={t.id}
                                      className={clsx(
                                        'flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition',
                                        isLinked
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 cursor-not-allowed'
                                          : isSelected
                                          ? 'bg-brand-50 border-brand-200'
                                          : 'bg-card border-border/80 hover:border-brand-300'
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        disabled={isLinked || linkTopicPending}
                                        checked={isSelected}
                                        onChange={(e) => {
                                          setSelectedTopicsToLink((prev) =>
                                            e.target.checked
                                              ? [...prev, t.id]
                                              : prev.filter((x) => x !== t.id)
                                          )
                                        }}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[12px] font-medium truncate">
                                          {t.title}
                                        </div>
                                        <div className="text-[10.5px] text-muted-foreground truncate">
                                          {t.description || '(sin descripción)'}
                                        </div>
                                      </div>
                                      {isLinked && (
                                        <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                          Vinculado
                                        </span>
                                      )}
                                    </label>
                                  )
                                })}
                                {(projectTopicsItems ?? []).length === 0 && (
                                  <div className="col-span-full text-[11.5px] text-muted-foreground p-2 text-center border border-dashed border-border/70 rounded">
                                    El proyecto todavía no tiene temas creados.
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkingTopicsForMeetingId(null)
                                    setSelectedTopicsToLink([])
                                  }}
                                  className="btn-ghost h-8 px-3 text-[11.5px]"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    linkTopicPending || selectedTopicsToLink.length === 0
                                  }
                                  onClick={() => {
                                    selectedTopicsToLink.forEach((topicId) => {
                                      onLinkTopic(m.id, topicId)
                                    })
                                    setSelectedTopicsToLink([])
                                  }}
                                  className="btn-primary h-8 px-3 text-[11.5px]"
                                >
                                  {linkTopicPending && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  )}
                                  Vincular ({selectedTopicsToLink.length})
                                </button>
                              </div>
                            </div>
                          )}

                          {(() => {
                            // Cargando PARA ESTA reunión m: si user abrió drawer vincular
                            // o si expandió esta reunión y está posicionado en tab Temas.
                            const loadingForThisMeeting =
                              meetingLinkedTopicsLoading &&
                              (linkingTopicsForMeetingId === m.id ||
                                (expandedMeetingId === m.id &&
                                  meetingPanelTab === 'topics'))

                            const chipsLinked = meetingLinkedTopicsItems.filter((x) =>
                              (m.linkedTopicsIds ?? []).some((y) => y === x.topicId)
                            )

                            // Fallback: si query no trajo objetos pero sí conocemos IDs +
                            // tenemos el catálogo global de temas del proyecto, renderizar
                            // igual los chips (evita "espacio en blanco" entre expansión y
                            // llegada de la respuesta).
                            const chips =
                              chipsLinked.length > 0
                                ? chipsLinked
                                : (() => {
                                    const ids = new Set(m.linkedTopicsIds ?? [])
                                    if (ids.size === 0) return []
                                    return (projectTopicsItems ?? [])
                                      .filter((t) => ids.has(t.id))
                                      .map((t) => ({ topicId: t.id, title: t.title }))
                                  })()

                            if (loadingForThisMeeting && chips.length === 0) {
                              return (
                                <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground p-2">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando
                                  temas...
                                </div>
                              )
                            }
                            if ((m.linkedTopicsIds ?? []).length === 0) {
                              return (
                                <div className="p-4 text-center text-[11.5px] text-muted-foreground border border-dashed border-border/70 rounded-lg">
                                  No hay temas vinculados a esta reunión.
                                </div>
                              )
                            }
                            if (chips.length === 0) {
                              return (
                                <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground p-2">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando
                                  temas...
                                </div>
                              )
                            }
                            return (
                              <div className="flex flex-wrap gap-2">
                                {chips.map((lt) => (
                                  <div
                                    key={lt.topicId}
                                    className={clsx(
                                      'inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border text-[11.5px] text-foreground transition',
                                      onGotoLinkedTopic
                                        ? 'bg-surface-secondary border-border/70 hover:border-brand-400 hover:bg-brand-50/60 cursor-pointer'
                                        : 'bg-surface-secondary border-border/70 select-none'
                                    )}
                                    onClick={() => onGotoLinkedTopic?.(lt.topicId)}
                                  >
                                    <LinkIcon className="w-3.5 h-3.5 text-brand-600" />
                                    <span className="truncate max-w-[220px]">{lt.title}</span>
                                    {canEditMeetings && (
                                      <button
                                        type="button"
                                        title="Desvincular tema"
                                        disabled={unlinkTopicPending}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onUnlinkTopic(m.id, lt.topicId)
                                        }}
                                        className="btn-ghost-square w-5.5 h-5.5 -mr-0.5 text-muted-foreground hover:text-rose-600 disabled:opacity-50"
                                      >
                                        <XIcon className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {meetingPanelTab === 'minutes' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11.5px] text-muted-foreground">
                              Vinculá un archivo existente de la pestaña Documentos como acta de la reunión.
                            </p>
                            {canManageMeetingMinutes && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (setMinutesFilePending) return
                                  onOpenFilePicker()
                                }}
                                disabled={setMinutesFilePending}
                                className="btn-primary h-8 px-2.5 text-[11.5px] shadow-sm"
                              >
                                <LinkIcon className="w-3.5 h-3.5" />
                                <span className="ml-1.5">
                                  {m.minutesFileId ? 'Cambiar archivo vinculado' : 'Vincular archivo'}
                                </span>
                              </button>
                            )}
                          </div>

                          {m.minutesFileId ? (
                            (() => {
                              const linkedFile = (meetingFiles ?? []).find(
                                (f) => f.id === m.minutesFileId
                              )
                              return (
                                <div className="p-3 border border-emerald-200 rounded-lg bg-emerald-50/60 flex items-start gap-3">
                                  {linkedFile && (
                                    <div
                                      className={clsx(
                                        'w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0',
                                        colorForKind(fileKind(linkedFile))
                                      )}
                                    >
                                      {(() => {
                                        const I = iconForKind(fileKind(linkedFile))
                                        return <I className="w-5 h-5" />
                                      })()}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-foreground truncate">
                                      {linkedFile?.name ?? 'Archivo vinculado'}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                                      {linkedFile && (
                                        <>
                                          <span>
                                            {formatBytes(linkedFile.sizeBytes ?? 0)}
                                          </span>
                                          <span className="text-border/70">·</span>
                                          <span>
                                            Subido{' '}
                                            {linkedFile.createdAt
                                              ? formatRelativeTime(linkedFile.createdAt)
                                              : ''}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    {linkedFile && (
                                      <a
                                        href={`#`}
                                        onClick={(e) => e.preventDefault()}
                                        className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-foreground"
                                        title="Descargar"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-foreground"
                                      title="Abrir archivo (mismo proyecto, Documentos)"
                                      onClick={() => m.minutesFileId && onGotoLinkedFile(m.minutesFileId)}
                                    >
                                      <FileText className="w-4 h-4" />
                                    </button>
                                    {canManageMeetingMinutes && (
                                      <button
                                        type="button"
                                        onClick={() => setRemoveMeetingFileId(m.id)}
                                        disabled={setMinutesFilePending}
                                        className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-rose-600 disabled:opacity-50"
                                        title="Desvincular archivo"
                                      >
                                        <Unlink className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })()
                          ) : (
                            <div className="p-4 text-center text-[11.5px] text-muted-foreground border border-dashed border-border/70 rounded-lg">
                              No hay un archivo vinculado como acta.
                            </div>
                          )}

                          {removeMeetingFileId === m.id && (
                            <div className="p-3 border border-amber-200 bg-amber-50/70 rounded-lg space-y-3">
                              <div className="text-[12.5px] font-medium text-amber-900">
                                ¿Desvincular el archivo del acta de esta reunión?
                              </div>
                              <div className="text-[11.5px] text-amber-800">
                                Esto NO elimina el archivo de Documentos, solo quita el vínculo.
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setRemoveMeetingFileId(null)}
                                  className="btn-ghost h-8 px-3 text-[11.5px]"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={setMinutesFilePending}
                                  onClick={() => onConfirmUnlinkActa(m.id)}
                                  className="btn-danger h-8 px-3 text-[11.5px]"
                                >
                                  Confirmar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {typeof meetingsTotalPages === 'number' &&
          meetingsTotalPages > 1 &&
          typeof meetingsCurrentPage === 'number' && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-[11px] text-muted-foreground">
                {meetingsTotal ?? 0} reuniones · Página {meetingsCurrentPage} / {meetingsTotalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-ghost h-8 px-3 text-[11.5px]"
                  disabled={meetingsCurrentPage <= 1 || meetingsLoading}
                  onClick={() => setMeetingsPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <button
                  className="btn-ghost h-8 px-3 text-[11.5px]"
                  disabled={meetingsCurrentPage >= meetingsTotalPages || meetingsLoading}
                  onClick={() => setMeetingsPage((p) => Math.min(meetingsTotalPages, p + 1))}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
      </div>

    </div>
  )
}

function AgendaItemsList(props: {
  meetingId: string
  items: MeetingAgendaItem[]
  parentId: string | null
  canEdit: boolean
  members: ProjectMember[]
  onEdit: (item: MeetingAgendaItem) => void
  onDelete: (item: MeetingAgendaItem) => void
}) {
  const {
    meetingId: _meetingId,
    items,
    parentId,
    canEdit,
    members,
    onEdit,
    onDelete,
  } = props

  const levelItems = items.filter((i) => (i.parentId ?? null) === (parentId ?? null))
  const ordered = [...levelItems].sort((a, b) => a.order - b.order)

  if (ordered.length === 0) return null

  const depth = (() => {
    let d = 0
    let cur = parentId
    while (cur) {
      const p = items.find((i) => i.id === cur)
      if (!p) break
      cur = p.parentId ?? null
      d++
    }
    return d
  })()

  return (
    <ul
      className="divide-y divide-border/60 border border-border/70 rounded-lg overflow-hidden"
      style={{ marginLeft: depth * 16 }}
    >
      {ordered.map((it) => {
        const responsible = members.find((m) => m.userId === it.responsibleUserId)
        return (
          <li key={it.id}>
            <div className="p-3 flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 mt-[3px]" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[13px] font-medium text-foreground truncate">
                    {it.title}
                  </div>
                  <span
                    className={clsx(
                      'px-1.5 py-[1px] rounded-full text-[10.5px] font-medium border',
                      AGENDA_STATE_BADGE[it.state]
                    )}
                  >
                    {agendaStateLabel(it.state)}
                  </span>
                  {it.estimatedMinutes ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground px-1.5 py-[1px] rounded-full bg-surface-secondary border border-border/70">
                      <Clock3 className="w-3 h-3" />
                      {it.estimatedMinutes} min
                    </span>
                  ) : null}
                </div>
                {it.description?.trim() && (
                  <div className="text-[11.5px] text-muted-foreground whitespace-pre-wrap line-clamp-2">
                    {it.description}
                  </div>
                )}
                {responsible?.fullName && (
                  <div className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full bg-brand-50/80 border border-brand-100 text-brand-800">
                    Responsable: {responsible.fullName}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center pt-0.5">
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(it)}
                        className="btn-ghost-square w-7 h-7 text-muted-foreground hover:text-brand-700"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(it)}
                        className="btn-ghost-square w-7 h-7 text-muted-foreground hover:text-rose-600"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <AgendaItemsList
              meetingId={_meetingId}
              items={items}
              parentId={it.id}
              canEdit={canEdit}
              members={members}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </li>
        )
      })}
    </ul>
  )
}

function AgendaItemForm(props: {
  meetingId: string
  editing: string | null
  initialParentId: string | null
  agendaItems: MeetingAgendaItem[]
  members: ProjectMember[]
  pendingCreate: boolean
  pendingUpdate: boolean
  onClose: () => void
  onSave: (body: CreateAgendaItemBody, editing: string | null) => void
}) {
  const current = props.editing
    ? props.agendaItems.find((a) => a.id === props.editing) ?? null
    : null

  const [title, setTitle] = useState(current?.title ?? '')
  const [description, setDescription] = useState(current?.description ?? '')
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    current?.estimatedMinutes == null ? '' : String(current.estimatedMinutes)
  )
  const [state, setState] = useState<MeetingAgendaItem['state']>(
    (current?.state ?? 'PENDIENTE') as MeetingAgendaItem['state']
  )
  const [responsibleUserId, setResponsibleUserId] = useState<string | null>(
    current?.responsibleUserId ?? null
  )
  const parentId = props.editing
    ? current?.parentId ?? null
    : props.initialParentId ?? null
  const [order, setOrder] = useState<string>(
    props.editing ? String(current?.order ?? 0) : ''
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const t = title.trim()
        if (!t) return
        const body: CreateAgendaItemBody = {
          title: t,
          description: description || null,
          estimatedMinutes:
            estimatedMinutes.trim() === '' ? null : Number(estimatedMinutes) || null,
          state,
          responsibleUserId: responsibleUserId || null,
          parentId: parentId ?? null,
        }
        if (order.trim() !== '') {
          body.order = Number(order) || 0
        }
        props.onSave(body, props.editing)
      }}
      className="p-3 border border-border/70 rounded-lg bg-surface-secondary/40 space-y-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-3">
          <label className="block text-[11px] text-muted-foreground mb-0.5">Título *</label>
          <input
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-8 px-2 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            placeholder="Ej: Presentación de novedades del proyecto"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-[11px] text-muted-foreground mb-0.5">Descripción</label>
          <textarea
            rows={3}
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle de la sección..."
            className="w-full px-2 py-1.5 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-0.5">Estado</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as MeetingAgendaItem['state'])}
            className="w-full h-8 px-2 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
          >
            {AGENDA_STATES.map((s) => (
              <option key={s} value={s}>
                {agendaStateLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-0.5">
            Duración estimada (minutos)
          </label>
          <input
            type="number"
            min={1}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            className="w-full h-8 px-2 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            placeholder="Ej: 20"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-0.5">Orden (opcional)</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-full h-8 px-2 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            placeholder="(auto)"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-[11px] text-muted-foreground mb-0.5">
            Responsable (opcional)
          </label>
          <select
            value={responsibleUserId ?? ''}
            onChange={(e) =>
              setResponsibleUserId(e.target.value === '' ? null : e.target.value)
            }
            className="w-full h-8 px-2 text-[11.5px] rounded-md bg-card border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/60"
          >
            <option value="">(sin asignar)</option>
            {props.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {`${m.fullName ?? ''} <${m.email ?? ''}>`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onClose}
          className="btn-ghost h-8 px-3 text-[11.5px]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={
            (props.editing ? props.pendingUpdate : props.pendingCreate) || !title.trim()
          }
          className="btn-primary h-8 px-3 text-[11.5px]"
        >
          {(props.editing ? props.pendingUpdate : props.pendingCreate) && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          {props.editing ? 'Guardar cambios' : 'Crear ítem'}
        </button>
      </div>
    </form>
  )
}

