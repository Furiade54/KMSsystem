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
}

export interface Role {
  id: string
  name: string
  description?: string | null
  isSystemRole: boolean
  priorityLevel: number
  createdAt: string
  updatedAt?: string | null
  permissions?: RolePermission[]
  usersCount?: number
}

function mapRole(row: any, permissions?: RolePermission[], usersCount?: number): Role {
  return {
    id: String(row.Id),
    name: row.Nombre,
    description: row.Descripcion ?? null,
    isSystemRole: Boolean(row.EsRolSistema),
    priorityLevel: Number(row.NivelPrioridad ?? 50),
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
      SELECT r.Id AS RoleId, p.Id, p.Codigo, p.Descripcion, p.Categoria
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
      SELECT p.Id, p.Codigo, p.Descripcion, p.Categoria
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
    priorityLevel?: number
    permissionCodes?: PermissionCode[]
  }
): Promise<Role> {
  const name = (opts.name ?? '').trim()
  if (!name) throw new BadRequestError('Nombre del rol es requerido')
  const priority = opts.priorityLevel ?? 100
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
    priorityLevel?: number
  }
): Promise<Role> {
  const role = await getRoleById(pool, { organizationId: opts.organizationId, roleId: opts.roleId })
  if (role.isSystemRole) {
    if (opts.priorityLevel !== undefined || opts.name !== undefined) {
      throw new BadRequestError('Roles de sistema no se pueden renombrar ni cambiar prioridad')
    }
  }
  const name = opts.name !== undefined ? (opts.name ?? '').trim() : role.name
  if (opts.name !== undefined && !name) throw new BadRequestError('Nombre es requerido')
  const priority =
    opts.priorityLevel !== undefined ? opts.priorityLevel : role.priorityLevel
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
  const tbl = new sql.Table()
  tbl.create = false
  tbl.columns.add('Codigo', sql.VarChar(64))
  for (const c of opts.codes) tbl.rows.add(c)
  const ps = pool.request()
  ps.input('roleId', sql.UniqueIdentifier, opts.roleId)
  ps.input('orgId', sql.UniqueIdentifier, opts.organizationId)
  if (tbl.rows.length > 0) ps.input('Codes', tbl)

  // Bloque: DELETE todo + INSERT los nuevos (upsert granular)
  const tx = pool.transaction()
  await tx.begin()
  try {
    await tx
      .request()
      .input('roleId', sql.UniqueIdentifier, opts.roleId)
      .query(`DELETE FROM dbo.PermisosRol WHERE IdRol = @roleId`)
    if (opts.codes.length > 0) {
      const insert = `
        INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
        SELECT @roleId, p.Id
        FROM dbo.Permisos p
        INNER JOIN @Codes c ON c.Codigo = p.Codigo
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.PermisosRol pr WHERE pr.IdRol = @roleId AND pr.IdPermiso = p.Id
        )`
      const request = tx.request()
      request.input('roleId', sql.UniqueIdentifier, opts.roleId)
      request.input('Codes', tbl)
      await request.batch(insert)
    }
    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }
  return getRoleById(pool, { organizationId: opts.organizationId, roleId: opts.roleId, includePermissions: true })
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
    await tx.request().input('roleId', sql.UniqueIdentifier, opts.roleId).query(`DELETE FROM dbo.Roles WHERE Id = @roleId`)
    await tx.commit()
  } catch (e) {
    await tx.rollback()
    throw e
  }
}
