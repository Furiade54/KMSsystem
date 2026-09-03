import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
import { searchAll } from './search.controller'

const searchRouter = Router()
searchRouter.use(requireAuth, requirePermission(['proyectos.ver', 'archivos.ver']))
searchRouter.get('/', searchAll)
export default searchRouter
