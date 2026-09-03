import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import {
  deleteShareEndpoint,
  getShareEndpoint,
  listSharesEndpoint,
  publicAccessEndpoint,
  shareResourceEndpoint,
} from './shares.controller'
import { shareFileEndpoint } from './shares.controller'

const sharesRouter = Router()

// Acceso público sin auth (compartición con token)
sharesRouter.get('/public/:token', publicAccessEndpoint)
sharesRouter.post('/public/:token', publicAccessEndpoint)

// Autenticados
sharesRouter.use(requireAuth)

sharesRouter.get('/', requirePermission(['archivos.compartir', 'archivos.ver']), listSharesEndpoint)
sharesRouter.post('/', requirePermission('archivos.compartir'), shareResourceEndpoint)
sharesRouter.post('/archivo/:id', requirePermission('archivos.compartir'), shareFileEndpoint)
sharesRouter.get('/:id', requirePermission(['archivos.compartir', 'archivos.ver']), getShareEndpoint)
sharesRouter.delete('/:id', requirePermission('archivos.compartir'), deleteShareEndpoint)

export default sharesRouter
