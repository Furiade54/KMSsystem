import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
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
} from './files.controller'

const filesRouter = Router()

filesRouter.get('/local-download/:key', localDownloadEndpoint)

filesRouter.post('/', requireAuth, uploadMiddleware, uploadFileEndpoint)
filesRouter.post('/upload', requireAuth, uploadMiddleware, uploadFileEndpoint)
filesRouter.get('/', requireAuth, listFilesEndpoint)
filesRouter.get('/:id', requireAuth, getFileEndpoint)
filesRouter.patch('/:id', requireAuth, updateFileEndpoint)
filesRouter.post('/:id/copy', requireAuth, copyFileEndpoint)
filesRouter.get('/:id/comentarios', requireAuth, listFileCommentsEndpoint)
filesRouter.post('/:id/comentarios', requireAuth, commentFileEndpoint)
filesRouter.delete('/:id', requireAuth, deleteFileEndpoint)

export default filesRouter
