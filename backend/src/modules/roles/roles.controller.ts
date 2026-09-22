import type { Request, Response, NextFunction } from 'express'
import { getDbPool } from '../../shared/db/pool'
import {
  createRole,
  deleteRole,
  getRoleById,
  listPermissionCatalog,
  listRoles,
  setRolePermissions,
  updateRole,
} from './roles.service'
import type { ApiResponse } from '../../../../packages/shared-types/src'
import type { PermissionCode } from '../../../../packages/shared-types/src'

type AuthR = { auth: { userId: string; organizationId: string; email: string } }

export async function listRolesEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const includePerms = req.query.includePermissions !== 'false'
    const includeCount = req.query.includeUsersCount === 'true'
    const data = await listRoles(pool, {
      organizationId: auth.organizationId,
      includePermissions: includePerms,
      includeUsersCount: includeCount,
    })
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function listPermissionCatalogEndpoint(_req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const pool = await getDbPool()
    const data = await listPermissionCatalog(pool)
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function getRoleEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const data = await getRoleById(pool, { organizationId: auth.organizationId, roleId: String(req.params.id), includePermissions: true })
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function createRoleEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const body: any = req.body ?? {}
    const data = await createRole(pool, {
      organizationId: auth.organizationId,
      name: String(body.name ?? ''),
      description: body.description ?? null,
      isOrgAdmin: body.isOrgAdmin !== undefined ? Boolean(body.isOrgAdmin) : undefined,
      priorityLevel: body.priorityLevel !== undefined ? Number(body.priorityLevel) : undefined,
      permissionCodes: Array.isArray(body.permissionCodes) ? (body.permissionCodes as PermissionCode[]) : undefined,
    })
    res.status(201).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function updateRoleEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const body: any = req.body ?? {}
    const data = await updateRole(pool, {
      organizationId: auth.organizationId,
      roleId: String(req.params.id),
      name: body.name,
      description: body.description !== undefined ? body.description ?? null : undefined,
      isOrgAdmin: body.isOrgAdmin !== undefined ? Boolean(body.isOrgAdmin) : undefined,
      priorityLevel: body.priorityLevel !== undefined ? Number(body.priorityLevel) : undefined,
    })
    res.status(200).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function setRolePermissionsEndpoint(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    const codes: PermissionCode[] = Array.isArray(req.body?.permissionCodes) ? req.body.permissionCodes : []
    const data = await setRolePermissions(pool, {
      organizationId: auth.organizationId,
      roleId: String(req.params.id),
      codes,
    })
    res.status(200).json({ success: true, data, message: 'Permisos actualizados' })
  } catch (e) { next(e) }
}

export async function deleteRoleEndpoint(req: Request, res: Response<ApiResponse<void>>, next: NextFunction) {
  try {
    const { auth } = req as unknown as AuthR
    const pool = await getDbPool()
    await deleteRole(pool, { organizationId: auth.organizationId, roleId: String(req.params.id) })
    res.status(204).end()
  } catch (e) { next(e) }
}
