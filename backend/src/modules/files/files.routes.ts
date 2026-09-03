import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
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

const filesRouter = Router()

filesRouter.get('/local-download/:key', localDownloadEndpoint)

filesRouter.use(requireAuth)

filesRouter.post('/', requirePermission('archivos.subir'), uploadMiddleware, uploadFileEndpoint)
filesRouter.post('/upload', requirePermission('archivos.subir'), uploadMiddleware, uploadFileEndpoint)
filesRouter.get('/', requirePermission('archivos.ver'), listFilesEndpoint)
filesRouter.get('/:id', requirePermission('archivos.ver'), getFileEndpoint)
filesRouter.patch('/:id', requirePermission('archivos.editar'), updateFileEndpoint)
filesRouter.post('/:id/copy', requirePermission('archivos.editar'), copyFileEndpoint)
filesRouter.post('/:id/compartir', requirePermission('archivos.compartir'), shareFileEndpoint)
filesRouter.get('/:id/comentarios', requirePermission('archivos.ver'), listFileCommentsEndpoint)
filesRouter.post(
  '/:id/comentarios',
  requirePermission(['comentarios.crear', 'archivos.ver']),
  commentFileEndpoint
)
filesRouter.patch(
  '/:id/comentarios/:cid',
  requirePermission(['comentarios.gestionar', 'comentarios.crear', 'archivos.ver']),
  updateFileCommentEndpoint
)
filesRouter.delete(
  '/:id/comentarios/:cid',
  requirePermission(['comentarios.gestionar', 'comentarios.crear', 'archivos.ver']),
  deleteFileCommentEndpoint
)
filesRouter.delete('/:id', requirePermission('archivos.eliminar'), deleteFileEndpoint)

export default filesRouter
