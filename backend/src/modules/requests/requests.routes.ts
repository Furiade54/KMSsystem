import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { createRequest, getPendingCount, listRequests, resolveApprove, resolveReject } from './requests.controller'

const requestsRouter = Router()
requestsRouter.get('/count', requireAuth, getPendingCount)
requestsRouter.get('/', requireAuth, listRequests)
requestsRouter.post('/', requireAuth, createRequest)
requestsRouter.patch('/:id/aprobar', requireAuth, resolveApprove)
requestsRouter.patch('/:id/rechazar', requireAuth, resolveReject)
export default requestsRouter
