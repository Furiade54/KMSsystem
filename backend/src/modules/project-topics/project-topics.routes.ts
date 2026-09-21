import { type Request, Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission, requireResourcePermission } from '../../shared/middleware/rbac'
import {
  assignMemberToItem,
  createTopic,
  createTopicItem,
  deleteTopic,
  deleteTopicItem,
  getProjectMembersForTopicItem,
  getTopic,
  getTopicItem,
  listTopicItemFiles,
  listTopicItemMembers,
  listTopicItems,
  listTopics,
  linkFileToTopicItem,
  unassignMemberFromItem,
  unlinkFileFromTopicItem,
  updateTopic,
  updateTopicItem,
} from './project-topics.controller'

const topicsRouter = Router({ mergeParams: true })

topicsRouter.use(requireAuth)

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

topicsRouter.get('/', eitherOr(requirePermission('temas.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), listTopics)
topicsRouter.get('/:topicId', eitherOr(requirePermission('temas.ver'), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), getTopic)
topicsRouter.post('/', eitherOr(requirePermission('temas.crear'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), createTopic)
topicsRouter.patch('/:topicId', eitherOr(requirePermission(['temas.editar', 'temas.crear']), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), updateTopic)
topicsRouter.delete('/:topicId', eitherOr(requirePermission('temas.eliminar'), requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams)), deleteTopic)

topicsRouter.get('/:topicId/items', eitherOr(requirePermission(['temas.items.ver', 'temas.ver']), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), listTopicItems)
topicsRouter.get('/:topicId/items/:itemId', eitherOr(requirePermission(['temas.items.ver', 'temas.ver']), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), getTopicItem)
topicsRouter.post('/:topicId/items', eitherOr(requirePermission('temas.items.crear'), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), createTopicItem)
topicsRouter.patch('/:topicId/items/:itemId', eitherOr(requirePermission(['temas.items.editar', 'temas.items.crear']), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), updateTopicItem)
topicsRouter.delete('/:topicId/items/:itemId', eitherOr(requirePermission('temas.items.eliminar'), requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams)), deleteTopicItem)

topicsRouter.get('/:topicId/items/:itemId/miembros', eitherOr(requirePermission(['temas.items.ver', 'temas.ver']), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), listTopicItemMembers)
topicsRouter.get('/:topicId/items/:itemId/miembros/disponibles', eitherOr(requirePermission(['temas.items.ver', 'temas.ver']), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), getProjectMembersForTopicItem)
topicsRouter.post('/:topicId/items/:itemId/miembros', eitherOr(requirePermission(['temas.items.editar', 'temas.items.crear']), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), assignMemberToItem)
topicsRouter.delete('/:topicId/items/:itemId/miembros/:assignmentId', eitherOr(requirePermission(['temas.items.editar', 'temas.items.crear']), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), unassignMemberFromItem)

topicsRouter.get('/:topicId/items/:itemId/archivos', eitherOr(requirePermission(['temas.items.ver', 'temas.ver']), requireResourcePermission('PROJECT', 'VER', projectIdFromParams)), listTopicItemFiles)
topicsRouter.post('/:topicId/items/:itemId/archivos/:fileId', eitherOr(requirePermission(['temas.items.editar', 'temas.items.crear']), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), linkFileToTopicItem)
topicsRouter.delete('/:topicId/items/:itemId/archivos/:fileId', eitherOr(requirePermission(['temas.items.editar', 'temas.items.crear']), requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams)), unlinkFileFromTopicItem)

export default topicsRouter
