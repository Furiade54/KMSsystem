import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'
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

projectsRouter.use(requireAuth)

projectsRouter.get('/', requirePermission('proyectos.ver'), listProjects)
projectsRouter.get('/:id', requirePermission('proyectos.ver'), getProject)
projectsRouter.get('/:id/miembros', requirePermission('proyectos.ver'), getProjectMembers)
projectsRouter.post(
  '/:id/miembros',
  requirePermission('proyectos.miembros.gestionar'),
  addProjectMemberEndpoint
)
projectsRouter.delete(
  '/:id/miembros/:memberId',
  requirePermission('proyectos.miembros.gestionar'),
  removeProjectMemberEndpoint
)
projectsRouter.patch(
  '/:id/miembros/:memberId',
  requirePermission('proyectos.miembros.gestionar'),
  updateProjectMemberRoleEndpoint
)
projectsRouter.delete(
  '/:id/permanent',
  requirePermission('proyectos.eliminar'),
  permanentlyDeleteProjectEndpoint
)
projectsRouter.post('/', requirePermission('proyectos.crear'), createProject)
projectsRouter.patch('/:id', requirePermission('proyectos.editar'), updateProject)
projectsRouter.delete('/:id', requirePermission('proyectos.eliminar'), deleteProject)

export default projectsRouter
