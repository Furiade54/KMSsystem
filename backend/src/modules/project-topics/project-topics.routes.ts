import { type Request, Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requireResourcePermission } from '../../shared/middleware/rbac'
import {
  assignMemberToItem,
  createTopic,
  createTopicItem,
  deleteTopic,
  deleteTopicItem,
  getProjectMembersForTopicItem,
  getTopic,
  getTopicItem,
  listTopicItemMembers,
  listTopicItems,
  listTopics,
  unassignMemberFromItem,
  updateTopic,
  updateTopicItem,
} from './project-topics.controller'

const topicsRouter = Router({ mergeParams: true })

topicsRouter.use(requireAuth)

const projectIdFromParams = (req: Request) => String(req.params.projectId || '')

topicsRouter.get('/', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), listTopics)
topicsRouter.get('/:topicId', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), getTopic)
topicsRouter.post('/', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), createTopic)
topicsRouter.patch('/:topicId', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), updateTopic)
topicsRouter.delete('/:topicId', requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams), deleteTopic)

topicsRouter.get('/:topicId/items', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), listTopicItems)
topicsRouter.get('/:topicId/items/:itemId', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), getTopicItem)
topicsRouter.post('/:topicId/items', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), createTopicItem)
topicsRouter.patch('/:topicId/items/:itemId', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), updateTopicItem)
topicsRouter.delete('/:topicId/items/:itemId', requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams), deleteTopicItem)

topicsRouter.get('/:topicId/items/:itemId/miembros', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), listTopicItemMembers)
topicsRouter.get('/:topicId/items/:itemId/miembros/disponibles', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), getProjectMembersForTopicItem)
topicsRouter.post('/:topicId/items/:itemId/miembros', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), assignMemberToItem)
topicsRouter.delete('/:topicId/items/:itemId/miembros/:assignmentId', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), unassignMemberFromItem)

export default topicsRouter
