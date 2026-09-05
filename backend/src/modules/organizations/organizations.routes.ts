import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import {
  getOrganizationEndpoint,
  updateOrganizationEndpoint,
  createOrganizationHandler,
  listOrganizationsHandler,
  getOrganizationByIdHandler,
  updateOrganizationByIdHandler,
  deleteOrganizationHandler,
  permanentlyDeleteOrganizationHandler,
} from './organizations.controller'

const organizationsRouter = Router()

organizationsRouter.use(requireAuth)

organizationsRouter.get('/list', requirePermission('org.listar'), listOrganizationsHandler)
organizationsRouter.post('/', requirePermission('org.crear'), createOrganizationHandler)

organizationsRouter.get('/', requirePermission('org.ver'), getOrganizationEndpoint)
organizationsRouter.patch('/', requirePermission('org.editar'), updateOrganizationEndpoint)

organizationsRouter.delete('/:id/permanent', requirePermission('org.eliminar_permanente'), permanentlyDeleteOrganizationHandler)
organizationsRouter.get('/:id', requirePermission(['org.ver', 'org.listar']), getOrganizationByIdHandler)
organizationsRouter.patch('/:id', requirePermission('org.editar'), updateOrganizationByIdHandler)
organizationsRouter.delete('/:id', requirePermission('org.eliminar'), deleteOrganizationHandler)

export default organizationsRouter
