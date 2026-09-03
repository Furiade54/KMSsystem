import { Router } from 'express'
import {
  listUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  softDeleteUserHandler,
  permanentlyDeleteUserHandler,
  listRolesHandler,
  assignRolesHandler,
} from './users.controller'
import { requireAuth } from '../../shared/middleware/auth'
import { requirePermission } from '../../shared/middleware/rbac'

const usersRouter = Router()

usersRouter.use(requireAuth)

usersRouter.get('/', requirePermission('usuarios.ver'), listUsersHandler)
usersRouter.get('/roles', requirePermission('roles.ver'), listRolesHandler)
usersRouter.post('/', requirePermission('usuarios.crear'), createUserHandler)
usersRouter.get('/:id', requirePermission('usuarios.ver'), getUserHandler)
usersRouter.patch('/:id', requirePermission('usuarios.editar'), updateUserHandler)
usersRouter.delete('/:id', requirePermission('usuarios.eliminar'), softDeleteUserHandler)
usersRouter.delete('/:id/permanent', requirePermission('usuarios.eliminar'), permanentlyDeleteUserHandler)
usersRouter.patch('/:id/roles', requirePermission('roles.asignar'), assignRolesHandler)

export default usersRouter
