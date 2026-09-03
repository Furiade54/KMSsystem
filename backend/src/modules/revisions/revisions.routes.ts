import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import {
  listRevisionsEndpoint,
  getRevisionEndpoint,
  createRevisionEndpoint,
  updateRevisionStatusEndpoint,
  assignRevisionEndpoint,
} from './revisions.controller'

const revisionsRouter = Router()

revisionsRouter.use(requireAuth, requirePermission('revisiones.ver'))
revisionsRouter.get('/', listRevisionsEndpoint)
revisionsRouter.get('/:id', getRevisionEndpoint)
revisionsRouter.post('/', createRevisionEndpoint)
revisionsRouter.patch('/:id/estado', updateRevisionStatusEndpoint)
revisionsRouter.patch('/:id/asignar', requirePermission('revisiones.asignar'), assignRevisionEndpoint)

export default revisionsRouter
