import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission, requireResourcePermission } from '../../shared/middleware/rbac'
import {
  uploadMiddleware,
  uploadFileEndpoint,
  listFilesEndpoint,
  getFileEndpoint,
  deleteFileEndpoint,
  localDownloadEndpoint,
  updateFileEndpoint,
  copyFileEndpoint,
  commentFileEndpoint,
  listFileCommentsEndpoint,
  updateFileCommentEndpoint,
  deleteFileCommentEndpoint,
} from './files.controller'
import { shareFileEndpoint } from '../shares/shares.controller'
import {
  listPermissionsByResourceHandler,
  upsertPermissionByResourceHandler,
} from '../resource-permissions/resource-permissions.controller'

const filesRouter = Router()

filesRouter.get('/local-download/:key', localDownloadEndpoint)

filesRouter.use(requireAuth)

filesRouter.post('/', requirePermission('archivos.subir'), uploadMiddleware, uploadFileEndpoint)
filesRouter.post('/upload', requirePermission('archivos.subir'), uploadMiddleware, uploadFileEndpoint)
filesRouter.get('/', requirePermission('archivos.ver'), listFilesEndpoint)
filesRouter.get('/:id', requireResourcePermission('FILE', 'VER'), getFileEndpoint)
filesRouter.patch('/:id', requireResourcePermission('FILE', 'EDITAR'), updateFileEndpoint)
filesRouter.post('/:id/copy', requireResourcePermission('FILE', 'EDITAR'), copyFileEndpoint)
filesRouter.post('/:id/compartir', requireResourcePermission('FILE', 'COMPARTIR'), shareFileEndpoint)
filesRouter.get('/:id/comentarios', requireResourcePermission('FILE', 'VER'), listFileCommentsEndpoint)
filesRouter.post('/:id/comentarios', requireResourcePermission('FILE', 'COMENTAR'), commentFileEndpoint)
filesRouter.patch('/:id/comentarios/:cid', requireResourcePermission('FILE', 'COMENTAR'), updateFileCommentEndpoint)
filesRouter.delete('/:id/comentarios/:cid', requireResourcePermission('FILE', 'COMENTAR'), deleteFileCommentEndpoint)
filesRouter.delete('/:id', requireResourcePermission('FILE', 'ADMINISTRAR'), deleteFileEndpoint)

filesRouter.get('/:id/permisos', requirePermission(['archivos.ver', 'recursos.permisos.ver'] as any), listPermissionsByResourceHandler)
filesRouter.post('/:id/permisos', requirePermission(['archivos.editar', 'recursos.permisos.editar'] as any), upsertPermissionByResourceHandler)

export default filesRouter
