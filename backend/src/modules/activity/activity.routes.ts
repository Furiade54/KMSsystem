import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { listActivity } from './activity.controller'

const activityRouter = Router()
activityRouter.get('/', requireAuth, listActivity)
export default activityRouter
