import type { ConnectionPool, IRecordSet } from 'mssql'
import { sql } from '../../shared/db/pool'
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors/AppError'
import type { PermissionCode } from '../../../../packages/shared-types/src'
import { PERMISSION_CODES } from '../../../../packages/shared-types/src'

export interface RolePermission {
  id: string
  code: PermissionCode
  description?: string | null
  category?: string | null
  level?: 'ORGANIZACION' | 'PROYECTO' | 'RECURSO' | 'SISTEMA' | null
}

export interface Role {
  id: string
  name: string
  description?: string | null
  isSystemRole: boolean
  /** @deprecated Usar isOrgAdmin */
  priorityLevel: number
  isOrgAdmin: boolean
  createdAt: string
  updatedAt?: string | null
  permissions?: RolePermission[]
  usersCount?: number
}

export function resolveIsOrgAdmin(row: any): boolean {
  if (row.EsAdminOrg != null) return Boolean(row.EsAdminOrg)
  return typeof row.NivelPrioridad === 'number' && row.NivelPrioridad <= 25
}

function mapRole(row: any, permissions?: RolePermission[], usersCount?: number): Role {
  const priorityLevel = Number(row.NivelPrioridad ?? 50)
  const isOrgAdmin = resolveIsOrgAdmin(row)
  return {
    id: String(row.Id),
    name: row.Nombre,
    description: row.Descripcion ?? null,
    isSystemRole: Boolean(row.EsRolSistema),
    priorityLevel,
    isOrgAdmin,
    createdAt: row.FechaCreacion?.toISOString?.() ?? new Date(row.FechaCreacion).toISOString(),
    updatedAt: row.FechaActualizacion
      ? row.FechaActualizacion.toISOString?.() ?? new Date(row.FechaActualizacion).toISOString()
      : null,
    ...(permissions ? { permissions } : {}),
    ...(typeof usersCount === 'number' ? { usersCount } : {}),
  }
}

function mapPerm(row: any): RolePermission {
  return {
    id: String(row.Id),
    code: row.Codigo as PermissionCode,
    description: row.Descripcion ?? null,
    category: row.Categoria ?? null,
    level: (row.Nivel ?? null) as RolePermission['level'],
  }
}

export async function listRoles(
  pool: ConnectionPool,
  opts: { organizationId: string; includePermissions?: boolean; includeUsersCount?: boolean }
): Promise<Role[]> {
  const { recordset } = await pool
    .request()
    .input('orgId', sql.UniqueIdentifier, opts.organizationId)
    .query(
      `SELECT r.Id, r.Nombre, r.Descripcion, r.EsRolSistema, r.NivelPrioridad, r.FechaCreacion, r.FechaActualizacion
       FROM dbo.Roles r
       WHERE r.IdOrganizacion = @orgId OR r.IdOrganizacion IS NULL
       ORDER BY ISNULL(r.NivelPrioridad, 255) ASC, r.Nombre ASC`
    )
  const rows = recordset as IRecordSet<any>
  if (rows.length === 0) return []

  let permsMap: Record<string, RolePermission[]> = {}
  let usersMap: Record<string, number> = {}

  if (opts.includePermissions) {
    const q2 = `
      SELECT r.Id AS RoleId, p.Id, p.Codigo, p.Descripcion, p.Categoria, p.Nivel
      FROM dbo.Roles r
      INNER JOIN dbo.PermisosRol pr ON pr.IdRol = r.Id
      INNER JOIN dbo.Permisos p ON p.Id = pr.IdPermiso
      WHERE r.IdOrganizacion = @orgId OR r.IdOrganizacion IS NULL
      ORDER BY p.Codigo ASC`
    const { recordset: pRows } = await pool.request().input('orgId', sql.UniqueIdentifier, opts.organizationId).query(q2)
    for (const r of pRows as IRecordSet<any>) {
      permsMap[r.RoleId] = permsMap[r.RoleId] ?? []
      permsMap[r.RoleId].push(mapPerm(r))
    }
  }
  if (opts.includeUsersCount) {
    const q3 = `
      SELECT IdRol, COUNT(DISTINCT IdUsuario) AS N
      FROM dbo.RolesUsuario
      WHERE IdOrganizacion = @orgId
      GROUP BY IdRol`
    const { recordset: cRows } = await pool.request().input('orgId', sql.UniqueIdentifier, opts.organizationId).query(q3)
    for (const r of cRows as IRecordSet<any>) usersMap[r.IdRol] = Number(r.N)
  }

  return rows.map((r) =>
    mapRole(r, opts.includePermissions ? permsMap[r.Id] ?? [] : undefined, opts.includeUsersCount ? usersMap[r.Id] ?? 0 : undefined)
  )
}

export async function getRoleById(
  pool: ConnectionPool,
  opts: { organizationId: string; roleId: string; includePermissions?: boolean }
): Promise<Role> {
  const { recordset } = await pool
    .request()
    .input('orgId', sql.UniqueIdentifier, opts.organizationId)
    .input('roleId', sql.UniqueIdentifier, opts.roleId)
    .query(
      `SELECT r.Id, r.Nombre, r.Descripcion, r.EsRolSistema, r.NivelPrioridad, r.FechaCreacion, r.FechaActualizacion
       FROM dbo.Roles r
       WHERE r.Id = @roleId AND (r.IdOrganizacion = @orgId OR r.IdOrganizacion IS NULL)`
    )
  if (recordset.length === 0) throw new NotFoundError('Rol no encontrado')
  const row = (recordset as IRecordSet<any>)[0]

  let perms: RolePermission[] | undefined
  if (opts.includePermissions) {
    const q2 = `
      SELECT p.Id, p.Codigo, p.Descripcion, p.Categoria, p.Nivel
      FROM dbo.PermisosRol pr
      INNER JOIN dbo.Permisos p ON p.Id = pr.IdPermiso
      WHERE pr.IdRol = @roleId
      ORDER BY p.Codigo ASC`
    const { recordset: pRows } = await pool.request().input('roleId', sql.UniqueIdentifier, opts.roleId).query(q2)
    perms = (pRows as IRecordSet<any>).map(mapPerm)
  }
  return mapRole(row, perms)
}

export async function createRole(
  pool: ConnectionPool,
  opts: {
    organizationId: string
    name: string
    description?: string | null
    isOrgAdmin?: boolean
    priorityLevel?: number
    permissionCodes?: PermissionCode[]
  }
): Promise<Role> {
  const name = (opts.name ?? '').trim()
  if (!name) throw new BadRequestError('Nombre del rol es requerido')
  const isOrgAdmin =
    opts.isOrgAdmin ?? (typeof opts.priorityLevel === 'number' ? opts.priorityLevel <= 25 : false)
  const priority =
    opts.priorityLevel ?? (isOrgAdmin ? 10 : 100)
  if (priority < 0 || priority > 255) throw new BadRequestError('NivelPrioridad debe ser 0-255')

  const dup = await pool
    .request()
    .input('orgId', sql.UniqueIdentifier, opts.organizationId)
    .input('nombre', sql.NVarChar(100), name)
    .query(
      `SELECT Id FROM dbo.Roles WHERE IdOrganizacion = @orgId AND Nombre = @nombre`
    )
  if (dup.recordset.length > 0) throw new ConflictError('Ya existe un rol con este nombre')

  const idRol = crypto.randomUUID()
  await pool
    .request()
    .input('id', sql.UniqueIdentifier, idRol)
    .input('orgId', sql.UniqueIdentifier, opts.organizationId)
    .input('nombre', sql.NVarChar(100), name)
    .input('desc', sql.NVarChar(500), opts.description ?? null)
    .input('nivel', sql.TinyInt, priority)
    .query(
      `INSERT INTO dbo.Roles (Id, IdOrganizacion, Nombre, Descripcion, EsRolSistema, NivelPrioridad)
       VALUES (@id, @orgId, @nombre, @desc, 0, @nivel)`
    )
  if (opts.permissionCodes && opts.permissionCodes.length > 0) {
    await setRolePermissions(pool, { organizationId: opts.organizationId, roleId: idRol, codes: opts.permissionCodes })
  }
  return getRoleById(pool, { organizationId: opts.organizationId, roleId: idRol, includePermissions: true })
}

export async function updateRole(
  pool: ConnectionPool,
  opts: {
    organizationId: string
    roleId: string
    name?: string
    description?: string | null
    isOrgAdmin?: boolean
    priorityLevel?: number
  }
): Promise<Role> {
  const role = await getRoleById(pool, { organizationId: opts.organizationId, roleId: opts.roleId })
  if (role.isSystemRole) {
    if (opts.priorityLevel !== undefined || opts.isOrgAdmin !== undefined || opts.name !== undefined) {
      throw new BadRequestError('Roles de sistema no se pueden renombrar ni cambiar el estado de Admin')
    }
  }
  const name = opts.name !== undefined ? (opts.name ?? '').trim() : role.name
  if (opts.name !== undefined && !name) throw new BadRequestError('Nombre es requerido')

  const wasAdmin = role.isOrgAdmin
  const becameAdmin = opts.isOrgAdmin !== undefined ? opts.isOrgAdmin : wasAdmin
  const priority =
    opts.priorityLevel !== undefined
      ? opts.priorityLevel
      : opts.isOrgAdmin !== undefined
        ? becameAdmin
          ? Math.min(role.priorityLevel, 10)
          : Math.max(role.priorityLevel, 100)
        : role.priorityLevel
  if (priority < 0 || priority > 255) throw new BadRequestError('NivelPrioridad debe ser 0-255')

  await pool
    .request()
    .input('roleId', sql.UniqueIdentifier, opts.roleId)
    .input('nombre', sql.NVarChar(100), name)
    .input('desc', sql.NVarChar(500), opts.description !== undefined ? opts.description ?? null : undefined)
    .input('nivel', sql.TinyInt, priority)
    .query(
      `UPDATE dbo.Roles SET
         Nombre = @nombre,
         Descripcion = ISNULL(@desc, Descripcion),
         NivelPrioridad = @nivel,
         FechaActualizacion = SYSUTCDATETIME()
       WHERE Id = @roleId`
    )
  return getRoleById(pool, { organizationId: opts.organizationId, roleId: opts.roleId, includePermissions: true })
}

export async function setRolePermissions(
  pool: ConnectionPool,
  opts: { organizationId: string; roleId: string; codes: PermissionCode[] }
): Promise<Role> {
  await getRoleById(pool, { organizationId: opts.organizationId, roleId: opts.roleId })
  for (const c of opts.codes) {
    if (!PERMISSION_CODES.has(c)) {
      throw new BadRequestError('Permiso desconocido: ' + c)
    }
  }
  const codesSet = new Set(opts.codes)
  const uniqueCodes = Array.from(codesSet)
  const tx = pool.transaction()
  let rollbackErr: unknown = null
  try {
    await tx.begin()
    try {
      await tx
        .request()
        .input('roleId', sql.UniqueIdentifier, opts.roleId)
        .query(`DELETE FROM dbo.PermisosRol WHERE IdRol = @roleId`)
      if (uniqueCodes.length > 0) {
        const placeholders = uniqueCodes.map((_, i) => `SELECT @p${i} AS Codigo`).join(' UNION ALL ')
        const insert = `
          INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
          SELECT @roleId, p.Id
          FROM dbo.Permisos p
          INNER JOIN (${placeholders}) c ON c.Codigo = p.Codigo`
        const req = tx.request()
        req.input('roleId', sql.UniqueIdentifier, opts.roleId)
        uniqueCodes.forEach((c, i) => req.input(`p${i}`, sql.VarChar(64), c))
        await req.query(insert)
      }
      await tx.commit()
    } catch (stepErr) {
      try { await tx.rollback() } catch (rb) { rollbackErr = rb }
      throw stepErr
    }
  } catch (outer) {
    if (rollbackErr) {
      // eslint-disable-next-line no-console
      console.error('[setRolePermissions] rollback failed:', rollbackErr)
    }
    throw outer
  }
  return getRoleById(pool, { organizationId: opts.organizationId, roleId: opts.roleId, includePermissions: true })
}

export async function listPermissionCatalog(pool: ConnectionPool): Promise<RolePermission[]> {
  const { recordset } = await pool.query(
    `SELECT p.Id, p.Codigo, p.Descripcion, p.Categoria, p.Nivel AS LevelN
     FROM dbo.Permisos p
     WHERE p.Codigo IS NOT NULL
     ORDER BY CASE p.Nivel
                WHEN 'ORGANIZACION' THEN 1
                WHEN 'PROYECTO' THEN 2
                WHEN 'RECURSO' THEN 3
                WHEN 'SISTEMA' THEN 4
                ELSE 5
              END,
              ISNULL(p.Categoria, N''),
              p.Codigo ASC`
  )
  return (recordset as IRecordSet<any>).map((row) => ({
    id: String(row.Id),
    code: row.Codigo as RolePermission['code'],
    description: row.Descripcion ?? null,
    category: row.Categoria ?? null,
    level: row.LevelN as RolePermission['level'] | undefined,
  }))
}

export async function deleteRole(pool: ConnectionPool, opts: { organizationId: string; roleId: string }): Promise<void> {
  const role = await getRoleById(pool, { organizationId: opts.organizationId, roleId: opts.roleId })
  if (role.isSystemRole) throw new BadRequestError('No se pueden eliminar roles de sistema')
  const inUse = await pool
    .request()
    .input('roleId', sql.UniqueIdentifier, opts.roleId)
    .query(`SELECT TOP 1 1 FROM dbo.RolesUsuario WHERE IdRol = @roleId`)
  if ((inUse.recordset as any[]).length > 0) {
    throw new ConflictError('No se puede eliminar el rol: todavía tiene usuarios asignados')
  }
  const tx = pool.transaction()
  await tx.begin()
  try {
    await tx.request().input('roleId', sql.UniqueIdentifier, opts.roleId).query(`DELETE FROM dbo.PermisosRol WHERE IdRol = @roleId`)
    await tx.request().input('roleId', sql.UniqueIdentifier, opts.roleId).query(`DELETE FROM dbo.PermisosRecurso WHERE IdRol = @roleId`)
    await tx.request().input('roleId', sql.UniqueIdentifier, opts.roleId).query(`DELETE FROM dbo.Roles WHERE Id = @roleId`)
    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }
}
