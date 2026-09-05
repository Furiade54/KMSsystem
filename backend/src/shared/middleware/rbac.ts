import type { Request, Response, NextFunction } from 'express'
import type { PermissionCode, ResourceCapability, RoleAssignment } from '../../../../packages/shared-types/src'
import type { ResourceTypeApi, ResourceTypeDb } from '../../../../packages/shared-types/src'
import { PERMISSION_CODES } from '../../../../packages/shared-types/src'
import type { AuthContext } from './auth'
import { ForbiddenError, UnauthorizedError } from '../errors/AppError'
import { getDbPool, sql } from '../db/pool'
import { fetchRolesForUser } from '../../modules/users/users.service'
import { hasCapabilityOnResource } from '../../modules/resource-permissions/resource-permissions.service'

export const ORG_ADMIN_MAX_PRIORITY = 25

export type AuthWithRoles = AuthContext &
  Required<Pick<AuthContext, 'roles' | 'isOrgAdmin' | 'permissions'>>

export function userIsOrgAdmin(roles: RoleAssignment[]): boolean {
  return roles.some(
    (r) => typeof r.priorityLevel === 'number' && r.priorityLevel <= ORG_ADMIN_MAX_PRIORITY
  )
}

async function fetchPermissionsForRoles(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  organizationId: string,
  roleIds: string[]
): Promise<Set<PermissionCode>> {
  const result = new Set<PermissionCode>()
  if (roleIds.length === 0) return result
  const list = roleIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')
  const q = `
    SELECT DISTINCT p.Codigo
    FROM dbo.PermisosRol pr
    INNER JOIN dbo.Permisos p ON p.Id = pr.IdPermiso
    WHERE pr.IdRol IN (${list})
  `
  const { recordset } = await pool.request().input('orgId', sql.UniqueIdentifier, organizationId).query(q)
  for (const row of recordset as Array<{ Codigo: string }>) {
    if (PERMISSION_CODES.has(row.Codigo as PermissionCode)) {
      result.add(row.Codigo as PermissionCode)
    }
  }
  return result
}

export async function loadUserRolesToAuth(req: Request): Promise<AuthWithRoles> {
  if (!req.auth) throw new UnauthorizedError('Autenticación requerida')
  if (
    Array.isArray(req.auth.roles) &&
    typeof req.auth.isOrgAdmin === 'boolean' &&
    req.auth.permissions instanceof Set
  ) {
    return req.auth as AuthWithRoles
  }
  const pool = await getDbPool()
  const roles = Array.isArray(req.auth.roles)
    ? req.auth.roles
    : await fetchRolesForUser(pool, req.auth.organizationId, req.auth.userId)
  const isOrgAdmin = typeof req.auth.isOrgAdmin === 'boolean' ? req.auth.isOrgAdmin : userIsOrgAdmin(roles)
  const roleIds = roles.map((r) => r.roleId).filter(Boolean)
  const permissions =
    req.auth.permissions instanceof Set
      ? req.auth.permissions
      : isOrgAdmin
        ? new Set<PermissionCode>(PERMISSION_CODES)
        : await fetchPermissionsForRoles(pool, req.auth.organizationId, roleIds)
  req.auth.roles = roles
  req.auth.isOrgAdmin = isOrgAdmin
  req.auth.permissions = permissions
  return req.auth as AuthWithRoles
}

export async function userHasPermission(
  req: Request,
  code: PermissionCode | PermissionCode[]
): Promise<boolean> {
  const full = await loadUserRolesToAuth(req)
  const codes: PermissionCode[] = Array.isArray(code) ? code : [code]
  if (full.isOrgAdmin) return true
  for (const c of codes) if (full.permissions?.has(c)) return true
  return false
}

export function requirePermission(
  code: PermissionCode | PermissionCode[],
  denyMessage?: string
): (req: Request, _res: Response, next: NextFunction) => void {
  const codes: PermissionCode[] = Array.isArray(code) ? code : [code]
  const msg =
    denyMessage ??
    `Requiere permiso${codes.length > 1 ? 's' : ''}: ${codes.join(', ')}`
  return function (req: Request, _res: Response, next: NextFunction): void {
    ;(async () => {
      try {
        const full = await loadUserRolesToAuth(req)
        if (full.isOrgAdmin) return next()
        for (const c of codes) if (full.permissions?.has(c)) return next()
        throw new ForbiddenError(msg)
      } catch (err) {
        next(err)
      }
    })()
  }
}

export function requireOrgAdmin(req: Request, _res: Response, next: NextFunction): void {
  ;(async () => {
    try {
      const { isOrgAdmin } = await loadUserRolesToAuth(req)
      if (!isOrgAdmin) {
        throw new ForbiddenError('Requiere privilegios de administrador de la organización')
      }
      next()
    } catch (err) {
      next(err)
    }
  })()
}

export { loadUserRolesToAuth as ensureAuthWithRoles }

export function requireResourcePermission(
  resourceType: ResourceTypeApi | ResourceTypeDb,
  capability: ResourceCapability,
  getResourceId: (req: Request) => string = (req: Request) => String((req.params as any).id),
  denyMessage?: string
): (req: Request, res: Response, next: NextFunction) => void {
  const msg = denyMessage ?? `No tienes permiso para: ${String(capability).toLowerCase()} sobre ${String(resourceType).toLowerCase()}`
  return function (req: Request, _res: Response, next: NextFunction) {
    ;(async () => {
      try {
        const full = await loadUserRolesToAuth(req)
        const pool = await getDbPool()
        const resourceId = getResourceId(req)
        const ok = await hasCapabilityOnResource(pool, full, resourceType, resourceId, capability, { req })
        if (ok) return next()
        throw new ForbiddenError(msg)
      } catch (err) {
        next(err)
      }
    })()
  }
}
