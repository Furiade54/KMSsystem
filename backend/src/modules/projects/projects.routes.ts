import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  permanentlyDeleteProjectEndpoint,
  getProjectMembers,
  addProjectMemberEndpoint,
  removeProjectMemberEndpoint,
  updateProjectMemberRoleEndpoint,
} from './projects.controller'

const projectsRouter = Router()

projectsRouter.get('/', requireAuth, listProjects)
projectsRouter.get('/:id', requireAuth, getProject)
projectsRouter.get('/:id/miembros', requireAuth, getProjectMembers)
projectsRouter.post('/:id/miembros', requireAuth, addProjectMemberEndpoint)
projectsRouter.delete('/:id/miembros/:memberId', requireAuth, removeProjectMemberEndpoint)
projectsRouter.patch('/:id/miembros/:memberId', requireAuth, updateProjectMemberRoleEndpoint)
projectsRouter.delete('/:id/permanent', requireAuth, permanentlyDeleteProjectEndpoint)
projectsRouter.post('/', requireAuth, createProject)
projectsRouter.patch('/:id', requireAuth, updateProject)
projectsRouter.delete('/:id', requireAuth, deleteProject)

export default projectsRouter
