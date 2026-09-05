import { Router } from 'express'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission, requireResourcePermission } from '../../shared/middleware/rbac'
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
  patchDocumentoMaestroEndpoint,
  clearDocumentoMaestroEndpoint,
} from './projects.controller'
import {
  listPermissionsByResourceHandler,
  upsertPermissionByResourceHandler,
} from '../resource-permissions/resource-permissions.controller'

const projectsRouter = Router()

projectsRouter.use(requireAuth)

projectsRouter.get('/', requirePermission('proyectos.ver'), listProjects)
projectsRouter.get('/:id', requireResourcePermission('PROJECT', 'VER'), getProject)
projectsRouter.get('/:id/miembros', requireResourcePermission('PROJECT', 'VER'), getProjectMembers)
projectsRouter.post('/:id/miembros', requireResourcePermission('PROJECT', 'COMPARTIR'), addProjectMemberEndpoint)
projectsRouter.delete('/:id/miembros/:memberId', requireResourcePermission('PROJECT', 'COMPARTIR'), removeProjectMemberEndpoint)
projectsRouter.patch('/:id/miembros/:memberId', requireResourcePermission('PROJECT', 'COMPARTIR'), updateProjectMemberRoleEndpoint)
projectsRouter.delete('/:id/permanent', requireResourcePermission('PROJECT', 'ADMINISTRAR'), permanentlyDeleteProjectEndpoint)
projectsRouter.post('/', requirePermission('proyectos.crear'), createProject)
projectsRouter.patch('/:id', requireResourcePermission('PROJECT', 'EDITAR'), updateProject)
projectsRouter.delete('/:id', requireResourcePermission('PROJECT', 'ADMINISTRAR'), deleteProject)

projectsRouter.patch('/:id/documento-maestro', requireResourcePermission('PROJECT', 'ADMINISTRAR'), patchDocumentoMaestroEndpoint)
projectsRouter.delete('/:id/documento-maestro', requireResourcePermission('PROJECT', 'ADMINISTRAR'), clearDocumentoMaestroEndpoint)

projectsRouter.get('/:id/permisos', requirePermission(['proyectos.ver', 'recursos.permisos.ver'] as any), listPermissionsByResourceHandler)
projectsRouter.post('/:id/permisos', requirePermission(['proyectos.editar', 'recursos.permisos.editar'] as any), upsertPermissionByResourceHandler)

export default projectsRouter
