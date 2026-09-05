import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission, requireResourcePermission } from '../../shared/middleware/rbac'
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderEndpoint,
  copyFolder,
} from './folders.controller'
import {
  listPermissionsByResourceHandler,
  upsertPermissionByResourceHandler,
} from '../resource-permissions/resource-permissions.controller'

const foldersRouter = Router()

foldersRouter.use(requireAuth)

foldersRouter.get('/', requirePermission(['proyectos.ver', 'archivos.ver']), listFolders)
foldersRouter.post('/', requirePermission(['archivos.editar', 'archivos.subir']), createFolder)
foldersRouter.get('/:id', requireResourcePermission('FOLDER', 'VER'), getFolderEndpoint)
foldersRouter.patch('/:id', requireResourcePermission('FOLDER', 'EDITAR'), updateFolder)
foldersRouter.post('/:id/copy', requireResourcePermission('FOLDER', 'EDITAR'), copyFolder)
foldersRouter.delete('/:id', requireResourcePermission('FOLDER', 'ADMINISTRAR'), deleteFolder)

foldersRouter.get('/:id/permisos', requirePermission(['proyectos.ver', 'archivos.ver', 'recursos.permisos.ver'] as any), listPermissionsByResourceHandler)
foldersRouter.post('/:id/permisos', requirePermission(['archivos.editar', 'recursos.permisos.editar'] as any), upsertPermissionByResourceHandler)

export default foldersRouter
