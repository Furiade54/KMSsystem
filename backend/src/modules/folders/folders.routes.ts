import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderEndpoint,
  copyFolder,
} from './folders.controller'

const foldersRouter = Router()

foldersRouter.use(requireAuth)

foldersRouter.get('/', requirePermission(['proyectos.ver', 'archivos.ver']), listFolders)
foldersRouter.post('/', requirePermission(['archivos.editar', 'archivos.subir']), createFolder)
foldersRouter.get('/:id', requirePermission(['proyectos.ver', 'archivos.ver']), getFolderEndpoint)
foldersRouter.patch('/:id', requirePermission('archivos.editar'), updateFolder)
foldersRouter.post('/:id/copy', requirePermission('archivos.editar'), copyFolder)
foldersRouter.delete('/:id', requirePermission('archivos.eliminar'), deleteFolder)

export default foldersRouter
