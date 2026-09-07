import express, { type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env, isDev } from './shared/config/env'
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler'

import configRouter from './modules/config/config.routes'
import authRouter from './modules/auth/auth.routes'
import usersRouter from './modules/users/users.routes'
import projectsRouter from './modules/projects/projects.routes'
import filesRouter from './modules/files/files.routes'
import foldersRouter from './modules/folders/folders.routes'
import searchRouter from './modules/search/search.routes'
import activityRouter from './modules/activity/activity.routes'
import requestsRouter from './modules/requests/requests.routes'
import favoritesRouter from './modules/favorites/favorites.routes'
import organizationsRouter from './modules/organizations/organizations.routes'
import rolesRouter from './modules/roles/roles.routes'
import revisionsRouter from './modules/revisions/revisions.routes'
import sharesRouter from './modules/shares/shares.routes'
import meetingsRouter from './modules/meetings/meetings.routes'
import { resourcePermissionsRouter } from './modules/resource-permissions/resource-permissions.routes'

const app = express()

app.set('trust proxy', true)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
      if (!origin) return callback(null, true)
      const match = allowed.includes(origin) || allowed.includes('*')
      if (match) return callback(null, true)
      return callback(new Error('Origen CORS no permitido: ' + origin))
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
)
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(isDev ? 'dev' : 'combined'))

app.use(configRouter)

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    environment: env.NODE_ENV,
  })
})

app.get('/', (_req: Request, res: Response) => {
  res.redirect('/config')
})

app.use('/api/auth', authRouter)
app.use('/api/organizacion', organizationsRouter)
app.use('/api/usuarios', usersRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/projects/:projectId/reuniones', meetingsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/archivos', filesRouter)
app.use('/api/carpetas', foldersRouter)
app.use('/api/buscar', searchRouter)
app.use('/api/actividad', activityRouter)
app.use('/api/solicitudes', requestsRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/revisiones', revisionsRouter)
app.use('/api/compartidos', sharesRouter)
app.use('/api/permisos-recurso', resourcePermissionsRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
