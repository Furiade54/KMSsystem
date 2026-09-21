import { type Request, Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requireResourcePermission } from '../../shared/middleware/rbac'
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  linkTopicToMeeting,
  listMeetingLinkedTopics,
  listMeetings,
  setMeetingMinutesFile,
  unlinkTopicFromMeeting,
  updateMeeting,
} from './meetings.controller'
import {
  listMeetingParticipants,
  removeMeetingParticipant,
  setAttendance,
  upsertMeetingParticipant,
} from './participants.controller'
import {
  createMeetingAgendaItem,
  deleteMeetingAgendaItem,
  getMeetingAgendaItem,
  listMeetingAgenda,
  moveMeetingAgendaItem,
  reorderMeetingAgenda,
  updateMeetingAgendaItem,
} from './reunion-agenda.controller'

const meetingsRouter = Router({ mergeParams: true })

meetingsRouter.use(requireAuth)

const projectIdFromParams = (req: Request) => String(req.params.projectId || '')

meetingsRouter.get('/', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), listMeetings)
meetingsRouter.get('/:meetingId', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), getMeeting)
meetingsRouter.post('/', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), createMeeting)
meetingsRouter.patch('/:meetingId', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), updateMeeting)
meetingsRouter.delete('/:meetingId', requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams), deleteMeeting)

meetingsRouter.patch(
  '/:meetingId/minutos-archivo',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  setMeetingMinutesFile
)

// --- Asistentes ---
meetingsRouter.get(
  '/:meetingId/asistentes',
  requireResourcePermission('PROJECT', 'VER', projectIdFromParams),
  listMeetingParticipants
)
meetingsRouter.post(
  '/:meetingId/asistentes',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  upsertMeetingParticipant
)
meetingsRouter.patch(
  '/:meetingId/asistentes/:userId/asistencia',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  setAttendance
)
meetingsRouter.delete(
  '/:meetingId/asistentes/:userId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  removeMeetingParticipant
)

// --- Orden del día (tabla ReunionesOrdenDia, nueva en Fase 1) ---
meetingsRouter.get(
  '/:meetingId/orden-dia',
  requireResourcePermission('PROJECT', 'VER', projectIdFromParams),
  listMeetingAgenda
)
meetingsRouter.post(
  '/:meetingId/orden-dia',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  createMeetingAgendaItem
)
meetingsRouter.patch(
  '/:meetingId/orden-dia/reorder',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  reorderMeetingAgenda
)
meetingsRouter.get(
  '/:meetingId/orden-dia/:itemId',
  requireResourcePermission('PROJECT', 'VER', projectIdFromParams),
  getMeetingAgendaItem
)
meetingsRouter.patch(
  '/:meetingId/orden-dia/:itemId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  updateMeetingAgendaItem
)
meetingsRouter.delete(
  '/:meetingId/orden-dia/:itemId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  deleteMeetingAgendaItem
)
meetingsRouter.patch(
  '/:meetingId/orden-dia/:itemId/move',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  moveMeetingAgendaItem
)

// --- Vinculación Reunión <-> Temas ---
meetingsRouter.get(
  '/:meetingId/temas',
  requireResourcePermission('PROJECT', 'VER', projectIdFromParams),
  listMeetingLinkedTopics
)
meetingsRouter.post(
  '/:meetingId/temas/:topicId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  linkTopicToMeeting
)
meetingsRouter.delete(
  '/:meetingId/temas/:topicId',
  requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams),
  unlinkTopicFromMeeting
)

export default meetingsRouter
