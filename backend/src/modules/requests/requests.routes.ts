import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import { createRequest, getPendingCount, listRequests, resolveApprove, resolveReject } from './requests.controller'

const requestsRouter = Router()
requestsRouter.use(requireAuth)

requestsRouter.get('/count', requirePermission(['solicitudes.gestionar', 'proyectos.ver', 'archivos.ver']), getPendingCount)
requestsRouter.get('/', requirePermission(['solicitudes.gestionar', 'proyectos.ver', 'archivos.ver']), listRequests)
requestsRouter.post('/', requirePermission(['proyectos.ver', 'archivos.ver']), createRequest)
requestsRouter.patch('/:id/aprobar', requirePermission('solicitudes.gestionar'), resolveApprove)
requestsRouter.patch('/:id/rechazar', requirePermission('solicitudes.gestionar'), resolveReject)
export default requestsRouter
