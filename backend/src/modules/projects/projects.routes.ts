import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectMembers,
} from './projects.controller'

const projectsRouter = Router()

projectsRouter.get('/', requireAuth, listProjects)
projectsRouter.get('/:id', requireAuth, getProject)
projectsRouter.get('/:id/miembros', requireAuth, getProjectMembers)
projectsRouter.post('/', requireAuth, createProject)
projectsRouter.patch('/:id', requireAuth, updateProject)
projectsRouter.delete('/:id', requireAuth, deleteProject)

export default projectsRouter
