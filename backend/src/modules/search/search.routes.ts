import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { searchAll } from './search.controller'

const searchRouter = Router()
searchRouter.get('/', requireAuth, searchAll)
export default searchRouter
