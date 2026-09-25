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

revisionsRouter.use(requireAuth)
revisionsRouter.get('/', requirePermission('revisiones.ver'), listRevisionsEndpoint)
revisionsRouter.get('/:id', requirePermission('revisiones.ver'), getRevisionEndpoint)
revisionsRouter.post('/', requirePermission('revisiones.crear'), createRevisionEndpoint)
revisionsRouter.patch('/:id/estado', requirePermission('revisiones.ver'), updateRevisionStatusEndpoint)
revisionsRouter.patch('/:id/asignar', requirePermission('revisiones.asignar'), assignRevisionEndpoint)

export default revisionsRouter
