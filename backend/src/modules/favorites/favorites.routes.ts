import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import {
  listFavoritesEndpoint,
  checkFavoriteEndpoint,
  addFavoriteEndpoint,
  removeFavoriteEndpoint,
  toggleFavoriteEndpoint,
} from './favorites.controller'

const favoritesRouter = Router()

favoritesRouter.get('/', requireAuth, listFavoritesEndpoint)
favoritesRouter.get('/check', requireAuth, checkFavoriteEndpoint)
favoritesRouter.put('/toggle', requireAuth, toggleFavoriteEndpoint)
favoritesRouter.post('/', requireAuth, addFavoriteEndpoint)
favoritesRouter.delete('/:resourceType/:resourceId', requireAuth, removeFavoriteEndpoint)

export default favoritesRouter
