import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as usersService from './users.service'
import { BadRequestError } from '../../shared/errors/AppError'
import type { ApiResponse, PaginatedResult, User, Role, RoleAssignment } from '../../../../packages/shared-types/src'

type AuthReq = { auth: { organizationId: string; userId: string } }

const CreateUserSchema = z.object({
  fullName: z.string().min(2, 'Nombre completo requerido'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Contraseña mínima 6 caracteres').optional(),
  phone: z.string().max(50, 'Teléfono demasiado largo').nullable().optional(),
  position: z.string().max(150, 'Cargo demasiado largo').nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING']).optional(),
  roleIds: z.array(z.string().uuid('Rol inválido')).optional(),
})

const UpdateUserSchema = z.object({
  fullName: z.string().min(2, 'Nombre completo requerido').optional(),
  email: z.string().email('Correo inválido').optional(),
  phone: z.string().max(50, 'Teléfono demasiado largo').nullable().optional(),
  position: z.string().max(150, 'Cargo demasiado largo').nullable().optional(),
  avatarUrl: z.string().max(500, 'URL de avatar demasiado larga').nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING', 'DELETED']).optional(),
  password: z.string().min(6, 'Contraseña mínima 6 caracteres').optional(),
  roleIds: z.array(z.string().uuid('Rol inválido')).optional(),
})

const AssignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid('Rol inválido')),
})

const ChangeMyPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(6, 'Nueva contraseña mínima 6 caracteres'),
})

export async function changeMyPasswordHandler(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const parsed = ChangeMyPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.issues.forEach((i) => {
        const k = i.path.join('.')
        if (!errors[k]) errors[k] = []
        errors[k].push(i.message)
      })
      throw new BadRequestError('Datos inválidos', errors)
    }
    const auth = (req as unknown as AuthReq).auth
    await usersService.changeOwnPassword(auth, parsed.data, req)
    res.status(200).json({ success: true, data: undefined as any, message: 'Contraseña actualizada correctamente' })
  } catch (e) { next(e) }
}

export async function listUsersHandler(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<User & { projectsCount: number; rolesCount: number }>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 25)))
    const search = req.query.search ? String(req.query.search) : null
    const status = req.query.status ? String(req.query.status) : null
    const includeDeleted = req.query.includeDeleted === 'true'
    const result = await usersService.listUsers(auth, { page, pageSize, search, status, includeDeleted })
    res.status(200).json({ success: true, data: result })
  } catch (e) { next(e) }
}

export async function getUserHandler(
  req: Request,
  res: Response<ApiResponse<User & { projectsCount: number }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    const id = String(req.params.id)
    const data = await usersService.getUserDetail(auth, id)
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function createUserHandler(
  req: Request,
  res: Response<ApiResponse<User>>,
  next: NextFunction
) {
  try {
    const parsed = CreateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.issues.forEach((i) => {
        const k = i.path.join('.')
        if (!errors[k]) errors[k] = []
        errors[k].push(i.message)
      })
      throw new BadRequestError('Datos de usuario inválidos', errors)
    }
    const auth = (req as unknown as AuthReq).auth
    const created = await usersService.createUser(auth, parsed.data, req)
    res.status(201).json({ success: true, data: created, message: 'Usuario creado correctamente' })
  } catch (e) { next(e) }
}

export async function updateUserHandler(
  req: Request,
  res: Response<ApiResponse<User>>,
  next: NextFunction
) {
  try {
    const parsed = UpdateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.issues.forEach((i) => {
        const k = i.path.join('.')
        if (!errors[k]) errors[k] = []
        errors[k].push(i.message)
      })
      throw new BadRequestError('Datos de actualización inválidos', errors)
    }
    const auth = (req as unknown as AuthReq).auth
    const id = String(req.params.id)
    const updated = await usersService.updateUser(auth, id, parsed.data, req)
    res.status(200).json({ success: true, data: updated, message: 'Usuario actualizado correctamente' })
  } catch (e) { next(e) }
}

export async function softDeleteUserHandler(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    const id = String(req.params.id)
    await usersService.softDeleteUser(auth, id, req)
    res.status(204).end()
  } catch (e) { next(e) }
}

export async function permanentlyDeleteUserHandler(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    const id = String(req.params.id)
    await usersService.permanentlyDeleteUser(auth, id, req)
    res.status(204).end()
  } catch (e) { next(e) }
}

export async function listRolesHandler(
  req: Request,
  res: Response<ApiResponse<Role[]>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as AuthReq).auth
    const includeSystem = req.query.includeSystem !== 'false'
    const data = await usersService.listRoles(auth, { includeSystem })
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function assignRolesHandler(
  req: Request,
  res: Response<ApiResponse<RoleAssignment[]>>,
  next: NextFunction
) {
  try {
    const parsed = AssignRolesSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.issues.forEach((i) => {
        const k = i.path.join('.')
        if (!errors[k]) errors[k] = []
        errors[k].push(i.message)
      })
      throw new BadRequestError('Roles inválidos', errors)
    }
    const auth = (req as unknown as AuthReq).auth
    const id = String(req.params.id)
    const data = await usersService.assignRoles(auth, id, parsed.data.roleIds, req)
    res.status(200).json({ success: true, data, message: 'Roles actualizados correctamente' })
  } catch (e) { next(e) }
}
