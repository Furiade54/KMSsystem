import { type Request, Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission, requireResourcePermission } from '../../shared/middleware/rbac'
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

function eitherOr(
  primary: (req: Request, _res: any, next: any) => void,
  fallback: (req: Request, _res: any, next: any) => void
) {
  return (req: Request, _res: any, next: any) => {
    try {
      primary(req, _res, (err?: any) => {
        if (!err) return next()
        fallback(req, _res, next)
      })
    } catch (e) {
      fallback(req, _res, next)
    }
  }
}

meetingsRouter.get('/',    eitherOr(requirePermission('reuniones.ver'),  requireResourcePermission('PROJECT', 'VER',  projectIdFromParams)), listMeetings)
meetingsRouter.get('/:meetingId', eitherOr(requirePermission('reuniones.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), getMeeting)
meetingsRouter.post('/',   eitherOr(requirePermission(['reuniones.crear','reuniones.editar']), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), createMeeting)
meetingsRouter.patch('/:meetingId', eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), updateMeeting)
meetingsRouter.delete('/:meetingId', eitherOr(requirePermission('reuniones.eliminar'), requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams)), deleteMeeting)

meetingsRouter.patch(
  '/:meetingId/minutos-archivo',
  eitherOr(requirePermission('reuniones.acta.gestionar'), requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams)),
  setMeetingMinutesFile
)

// --- Asistentes ---
meetingsRouter.get(
  '/:meetingId/asistentes',
  eitherOr(requirePermission('reuniones.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)),
  listMeetingParticipants
)
meetingsRouter.post(
  '/:meetingId/asistentes',
  eitherOr(requirePermission('reuniones.asistentes.gestionar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  upsertMeetingParticipant
)
meetingsRouter.patch(
  '/:meetingId/asistentes/:userId/asistencia',
  eitherOr(requirePermission('reuniones.asistentes.gestionar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  setAttendance
)
meetingsRouter.delete(
  '/:meetingId/asistentes/:userId',
  eitherOr(requirePermission('reuniones.asistentes.gestionar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  removeMeetingParticipant
)

// --- Orden del día ---
meetingsRouter.get(
  '/:meetingId/orden-dia',
  eitherOr(requirePermission('reuniones.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)),
  listMeetingAgenda
)
meetingsRouter.post(
  '/:meetingId/orden-dia',
  eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  createMeetingAgendaItem
)
meetingsRouter.patch(
  '/:meetingId/orden-dia/reorder',
  eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  reorderMeetingAgenda
)
meetingsRouter.get(
  '/:meetingId/orden-dia/:itemId',
  eitherOr(requirePermission('reuniones.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)),
  getMeetingAgendaItem
)
meetingsRouter.patch(
  '/:meetingId/orden-dia/:itemId',
  eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  updateMeetingAgendaItem
)
meetingsRouter.delete(
  '/:meetingId/orden-dia/:itemId',
  eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  deleteMeetingAgendaItem
)
meetingsRouter.patch(
  '/:meetingId/orden-dia/:itemId/move',
  eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  moveMeetingAgendaItem
)

// --- Vinculación Reunión <-> Temas ---
meetingsRouter.get(
  '/:meetingId/temas',
  eitherOr(requirePermission('reuniones.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)),
  listMeetingLinkedTopics
)
meetingsRouter.post(
  '/:meetingId/temas/:topicId',
  eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  linkTopicToMeeting
)
meetingsRouter.delete(
  '/:meetingId/temas/:topicId',
  eitherOr(requirePermission('reuniones.editar'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)),
  unlinkTopicFromMeeting
)

export default meetingsRouter
