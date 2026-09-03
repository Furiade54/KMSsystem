import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import { listActivity } from './activity.controller'

const activityRouter = Router()
activityRouter.use(requireAuth, requirePermission(['auditoria.ver', 'proyectos.ver']))
activityRouter.get('/', listActivity)
export default activityRouter
