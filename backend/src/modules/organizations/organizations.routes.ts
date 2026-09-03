import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import { getOrganizationEndpoint, updateOrganizationEndpoint } from './organizations.controller'

const organizationsRouter = Router()

organizationsRouter.use(requireAuth)
organizationsRouter.get('/', requirePermission('org.ver'), getOrganizationEndpoint)
organizationsRouter.patch('/', requirePermission('org.editar'), updateOrganizationEndpoint)

export default organizationsRouter
