import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderEndpoint,
  copyFolder,
} from './folders.controller'

const foldersRouter = Router()

foldersRouter.get('/', requireAuth, listFolders)
foldersRouter.post('/', requireAuth, createFolder)
foldersRouter.get('/:id', requireAuth, getFolderEndpoint)
foldersRouter.patch('/:id', requireAuth, updateFolder)
foldersRouter.post('/:id/copy', requireAuth, copyFolder)
foldersRouter.delete('/:id', requireAuth, deleteFolder)

export default foldersRouter
