import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import {
  listFavoritesEndpoint,
  checkFavoriteEndpoint,
  addFavoriteEndpoint,
  removeFavoriteEndpoint,
  toggleFavoriteEndpoint,
} from './favorites.controller'

const favoritesRouter = Router()

favoritesRouter.use(requireAuth)
favoritesRouter.use(requirePermission('favoritos.gestionar'))

favoritesRouter.get('/', listFavoritesEndpoint)
favoritesRouter.get('/check', checkFavoriteEndpoint)
favoritesRouter.put('/toggle', toggleFavoriteEndpoint)
favoritesRouter.post('/', addFavoriteEndpoint)
favoritesRouter.delete('/:resourceType/:resourceId', removeFavoriteEndpoint)

export default favoritesRouter
