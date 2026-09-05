import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import {
  canAccessCheckHandler,
  deletePermissionHandler,
  getPermissionDetailHandler,
  listPermissionsByResourceHandler,
  updatePermissionHandler,
  upsertPermissionByResourceHandler,
} from './resource-permissions.controller'

const resourcePermissionsRouter = Router()

resourcePermissionsRouter.use(requireAuth)

// Endpoints para el permiso individual (id de PermisosRecurso)
resourcePermissionsRouter.get('/check', canAccessCheckHandler)
resourcePermissionsRouter.get('/:id', getPermissionDetailHandler)
resourcePermissionsRouter.patch(
  '/:id',
  requirePermission(['recursos.permisos.editar', 'archivos.editar', 'proyectos.editar'] as any),
  updatePermissionHandler
)
resourcePermissionsRouter.delete(
  '/:id',
  requirePermission(['recursos.permisos.editar', 'archivos.editar', 'proyectos.editar'] as any),
  deletePermissionHandler
)

// Endpoints agrupados por recurso (mount con use() en routers de archivos/proyectos/carpetas)
// Alternativa: los routers existentes hacen router.use('/', nestedRouter)
// para exponer /:id/permisos. A través de buildResourcePermissionsMiddleware.
export {
  resourcePermissionsRouter,
  listPermissionsByResourceHandler,
  upsertPermissionByResourceHandler,
}
