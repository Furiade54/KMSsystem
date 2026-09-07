import { type Request, Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requireResourcePermission } from '../../shared/middleware/rbac'
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  setMeetingMinutesFile,
  updateMeeting,
} from './meetings.controller'
import {
  listMeetingParticipants,
  removeMeetingParticipant,
  setAttendance,
  upsertMeetingParticipant,
} from './participants.controller'

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

export default meetingsRouter
