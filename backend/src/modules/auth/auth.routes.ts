import { Router } from 'express'
import { loginHandler, meHandler, registerHandler, listOrganizationMembersHandler } from './auth.controller'
import { requireAuth } from '../../shared/middleware/auth'

const authRouter = Router()

authRouter.post('/login', loginHandler)
authRouter.post('/register', registerHandler)
authRouter.get('/me', requireAuth, meHandler)
authRouter.get('/organization/members', requireAuth, listOrganizationMembersHandler)

export default authRouter
