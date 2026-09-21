import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import {
  listRolesEndpoint,
  listPermissionCatalogEndpoint,
  getRoleEndpoint,
  createRoleEndpoint,
  updateRoleEndpoint,
  deleteRoleEndpoint,
  setRolePermissionsEndpoint,
} from './roles.controller'

const rolesRouter = Router()

rolesRouter.use(requireAuth)

rolesRouter.get('/', requirePermission('roles.ver'), listRolesEndpoint)
rolesRouter.get('/permisos/catalogo', requirePermission('roles.ver'), listPermissionCatalogEndpoint)
rolesRouter.post('/', requirePermission('roles.crear'), createRoleEndpoint)
rolesRouter.get('/:id', requirePermission('roles.ver'), getRoleEndpoint)
rolesRouter.patch('/:id', requirePermission('roles.crear'), updateRoleEndpoint)
rolesRouter.delete('/:id', requirePermission('roles.crear'), deleteRoleEndpoint)
rolesRouter.patch('/:id/permisos', requirePermission(['roles.asignar', 'roles.crear']), setRolePermissionsEndpoint)

export default rolesRouter
