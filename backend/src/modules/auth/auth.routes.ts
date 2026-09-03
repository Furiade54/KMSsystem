import { Router } from 'express'
import { loginHandler, meHandler, registerHandler, listOrganizationMembersHandler } from './auth.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'

const authRouter = Router()

authRouter.post('/login', loginHandler)
authRouter.post('/register', registerHandler)
authRouter.get('/me', requireAuth, meHandler)
authRouter.get(
  '/organization/members',
  requireAuth,
  requirePermission(['usuarios.ver', 'proyectos.ver']),
  listOrganizationMembersHandler
)

export default authRouter
