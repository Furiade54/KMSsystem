import { type Request, Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requireResourcePermission } from '../../shared/middleware/rbac'
import {
  createTopic,
  deleteTopic,
  getTopic,
  listTopics,
  updateTopic,
} from './project-topics.controller'

const topicsRouter = Router({ mergeParams: true })

topicsRouter.use(requireAuth)

const projectIdFromParams = (req: Request) => String(req.params.projectId || '')

topicsRouter.get('/', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), listTopics)
topicsRouter.get('/:topicId', requireResourcePermission('PROJECT', 'VER', projectIdFromParams), getTopic)
topicsRouter.post('/', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), createTopic)
topicsRouter.patch('/:topicId', requireResourcePermission('PROJECT', 'EDITAR', projectIdFromParams), updateTopic)
topicsRouter.delete('/:topicId', requireResourcePermission('PROJECT', 'ADMINISTRAR', projectIdFromParams), deleteTopic)

export default topicsRouter
