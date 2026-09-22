import { getDbPool, sql } from '../../shared/db/pool'
import { comparePassword, signToken, getTokenExpiration } from '../../shared/auth/crypto'
import { UnauthorizedError, ConflictError } from '../../shared/errors/AppError'
import type { LoginResponse, PermissionCode, User } from '../../../../packages/shared-types/src'
import { PERMISSION_CODES } from '../../../../packages/shared-types/src'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'
import { fetchRolesForUser } from '../users/users.service'
import { userIsOrgAdmin } from '../../shared/middleware/rbac'

export const SYSTEM_ROLE_MEMBER_PERMISSIONS: readonly string[] = [
  'org.ver',
  'proyectos.ver',
  'proyectos.crear',
  'reuniones.ver',
  'reuniones.crear',
  'temas.ver',
  'temas.crear',
  'temas.items.ver',
  'temas.items.crear',
  'revisiones.ver',
  'revisiones.crear',
  'archivos.ver',
  'archivos.subir',
  'archivos.editar',
  'archivos.eliminar',
  'archivos.compartir',
  'aportes.ver',
  'aportes.crear',
  'aportes.editar',
  'aportes.compartir',
  'comentarios.crear',
  'comentarios.gestionar',
  'favoritos.gestionar',
  'recursos.permisos.ver',
  'auditoria.ver',
] as const

export const SYSTEM_ROLE_MEMBER_NAME = 'Miembro'
export const SYSTEM_ROLE_ADMIN_NAME = 'Administrador'

interface RegisterInput {
  fullName: string
  email: string
  password: string
  organizationName: string
}

function mapUser(row: {
  Id: string
  IdOrganizacion: string
  NombreCompleto: string | null
  Correo: string
  UrlAvatar: string | null
  Telefono: string | null
  Cargo: string | null
  Estado: string
  UltimoInicio: Date | null
  FechaCreacion: Date
  FechaActualizacion: Date | null
}, extra: {
  roles?: User['roles']
  isOrgAdmin?: boolean
} = {}): User {
  const raw = String(row.Estado).toUpperCase()
  const statusMap: Record<string, User['status']> = {
    ACTIVO: 'ACTIVE',
    INACTIVO: 'INACTIVE',
    PENDIENTE: 'PENDING',
    BLOQUEADO: 'BLOCKED',
    ELIMINADO: 'DELETED',
  }
  return {
    id: String(row.Id),
    organizationId: String(row.IdOrganizacion),
    fullName: row.NombreCompleto ?? '',
    email: row.Correo,
    avatarUrl: row.UrlAvatar ?? null,
    phone: row.Telefono ?? null,
    position: row.Cargo ?? null,
    status: statusMap[raw] ?? 'ACTIVE',
    lastLogin: sqlLocalToIsoOrNull(row.UltimoInicio as any),
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
    roles: extra.roles,
    isOrgAdmin: extra.isOrgAdmin,
  } as User & { isOrgAdmin?: boolean }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const pool = await getDbPool()
  const req = pool.request()
  req.input('email', sql.NVarChar(200), email)
  const result = await req.query<{
    Id: string
    IdOrganizacion: string
    NombreCompleto: string | null
    Correo: string
    ClaveHash: string
    UrlAvatar: string | null
    Telefono: string | null
    Cargo: string | null
    Estado: string
    UltimoInicio: Date | null
    FechaCreacion: Date
    FechaActualizacion: Date | null
  }>(`
    SELECT TOP 1
      u.Id, u.IdOrganizacion, u.NombreCompleto, u.Correo, u.ClaveHash, u.UrlAvatar,
      u.Telefono, u.Cargo, u.Estado, u.UltimoInicio, u.FechaCreacion, u.FechaActualizacion
    FROM Usuarios u
    INNER JOIN Organizaciones o ON o.Id = u.IdOrganizacion
    WHERE LOWER(u.Correo) = LOWER(@email)
      AND u.Estado='ACTIVO' AND o.Estado='ACTIVO'
  `)
  const row = result.recordset[0]
  if (!row) throw new UnauthorizedError('Credenciales inválidas')
  if (!row.ClaveHash) throw new UnauthorizedError('Credenciales inválidas')

  const ok = await comparePassword(password, row.ClaveHash)
  if (!ok) throw new UnauthorizedError('Credenciales inválidas')

  try {
    const upd = pool.request()
    upd.input('userId', sql.UniqueIdentifier, row.Id)
    await upd.query(
      `UPDATE Usuarios SET UltimoInicio=GETDATE(), FechaActualizacion=GETDATE() WHERE Id=@userId`
    )
  } catch {
    /* ignore */
  }

  const token = signToken({
    sub: String(row.Id),
    organizationId: String(row.IdOrganizacion),
    email: row.Correo,
  })
  const expiresAt = getTokenExpiration()
  const roles = await fetchRolesForUser(pool, String(row.IdOrganizacion), String(row.Id))
  const isOrgAdmin = userIsOrgAdmin(roles)
  const userRoles: User['roles'] = roles.map((r) => ({
    id: r.roleId,
    name: r.roleName,
    isSystemRole: r.isSystemRole,
    priorityLevel: r.priorityLevel,
    assignedAt: r.assignedAt ?? null,
    assignedBy: r.assignedBy ?? null,
  }))
  const user = mapUser(row, { roles: userRoles, isOrgAdmin })
  return {
    token,
    user,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function register(input: RegisterInput): Promise<LoginResponse> {
  const pool = await getDbPool()
  const chk = pool.request()
  chk.input('email', sql.NVarChar(200), input.email)
  const dup = await chk.query(`SELECT Id FROM Usuarios WHERE LOWER(Correo)=LOWER(@email)`)
  if (dup.recordset.length > 0) throw new ConflictError('Ya existe un usuario con ese correo')

  const tx = pool.transaction()
  try {
    await tx.begin()
    const orgId = crypto.randomUUID()
    const userId = crypto.randomUUID()
    const rolAdminId = crypto.randomUUID()
    const rolMiembroId = crypto.randomUUID()

    await tx
      .request()
      .input('orgId', sql.UniqueIdentifier, orgId)
      .input('orgName', sql.NVarChar(200), input.organizationName).query(`
      INSERT Organizaciones(Id,Nombre,Estado,FechaCreacion,FechaActualizacion)
      VALUES (@orgId,@orgName,'ACTIVO',GETDATE(),GETDATE());
    `)

    const { hashPassword } = await import('../../shared/auth/crypto')
    const passwordHash = await hashPassword(input.password)
    await tx
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('orgId', sql.UniqueIdentifier, orgId)
      .input('full', sql.NVarChar(150), input.fullName)
      .input('email', sql.NVarChar(200), input.email)
      .input('hash', sql.NVarChar(sql.MAX), passwordHash).query(`
      INSERT Usuarios(Id,IdOrganizacion,NombreCompleto,Correo,ClaveHash,Estado,UltimoInicio,FechaCreacion,FechaActualizacion)
      VALUES (@userId,@orgId,@full,@email,@hash,'ACTIVO',NULL,GETDATE(),GETDATE());
    `)

    await tx
      .request()
      .input('orgId', sql.UniqueIdentifier, orgId)
      .input('rolAdminId', sql.UniqueIdentifier, rolAdminId)
      .input('rolMiembroId', sql.UniqueIdentifier, rolMiembroId).query(`
      INSERT Roles(Id,IdOrganizacion,Nombre,Descripcion,EsRolSistema,NivelPrioridad,FechaCreacion,FechaActualizacion)
      VALUES
        (@rolAdminId,  @orgId, N'Administrador', N'Acceso total a la organizacion y sus proyectos', 1, 10, GETDATE(), GETDATE()),
        (@rolMiembroId,@orgId, N'Miembro',       N'Rol estandar para miembros de la organizacion',   1, 50, GETDATE(), GETDATE());
    `)

    await tx
      .request()
      .input('orgId', sql.UniqueIdentifier, orgId)
      .input('userId', sql.UniqueIdentifier, userId)
      .input('rolAdminId', sql.UniqueIdentifier, rolAdminId).query(`
      INSERT RolesUsuario(IdOrganizacion,IdUsuario,IdRol,AsignadoPor,FechaAsignacion)
      VALUES (@orgId,@userId,@rolAdminId,NULL,GETDATE());
    `)

    await tx
      .request()
      .input('rolAdminId', sql.UniqueIdentifier, rolAdminId)
      .input('rolMiembroId', sql.UniqueIdentifier, rolMiembroId).query(`
      INSERT PermisosRol(IdRol,IdPermiso)
      SELECT @rolAdminId, p.Id FROM Permisos p
      UNION ALL
      SELECT @rolMiembroId, p.Id FROM Permisos p
      WHERE p.Codigo IN (${SYSTEM_ROLE_MEMBER_PERMISSIONS.map((c) => `'${c.replace(/'/g, "''")}'`).join(',')});
    `)

    await tx.commit()

    return login(input.email, input.password)
  } catch (e) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw e
  }
}

export async function getUserById(id: string): Promise<User> {
  const pool = await getDbPool()
  const req = pool.request()
  req.input('id', sql.UniqueIdentifier, id)
  const r = await req.query<{
    Id: string
    IdOrganizacion: string
    NombreCompleto: string | null
    Correo: string
    UrlAvatar: string | null
    Telefono: string | null
    Cargo: string | null
    Estado: string
    UltimoInicio: Date | null
    FechaCreacion: Date
    FechaActualizacion: Date | null
  }>(`
    SELECT Id,IdOrganizacion,NombreCompleto,Correo,UrlAvatar,Telefono,Cargo,Estado,UltimoInicio,FechaCreacion,FechaActualizacion
    FROM Usuarios
    WHERE Id=@id AND Estado='ACTIVO'
  `)
  const row = r.recordset[0]
  if (!row) throw new UnauthorizedError('Usuario no encontrado')
  const roles = await fetchRolesForUser(pool, String(row.IdOrganizacion), String(row.Id))
  const isOrgAdmin = userIsOrgAdmin(roles)
  const userRoles: User['roles'] = roles.map((r) => ({
    id: r.roleId,
    name: r.roleName,
    isSystemRole: r.isSystemRole,
    priorityLevel: r.priorityLevel,
    assignedAt: r.assignedAt ?? null,
    assignedBy: r.assignedBy ?? null,
  }))
  return mapUser(row, { roles: userRoles, isOrgAdmin })
}

export async function listUserPermissionCodes(userId: string, organizationId: string): Promise<PermissionCode[]> {
  const pool = await getDbPool()
  const r = await pool.request()
    .input('uid', sql.UniqueIdentifier, userId)
    .input('oid', sql.UniqueIdentifier, organizationId)
    .query<{ Codigo: string }>(`
      SELECT DISTINCT p.Codigo
      FROM dbo.RolesUsuario ru
      INNER JOIN dbo.PermisosRol pr ON pr.IdRol = ru.IdRol
      INNER JOIN dbo.Permisos p ON p.Id = pr.IdPermiso
      WHERE ru.IdUsuario = @uid AND ru.IdOrganizacion = @oid
        AND p.Codigo IS NOT NULL
      UNION
      SELECT DISTINCT p.Codigo
      FROM dbo.RolesUsuario ru
      INNER JOIN dbo.Roles r ON r.Id = ru.IdRol
      INNER JOIN dbo.PermisosRol pr ON pr.IdRol = r.Id
      INNER JOIN dbo.Permisos p ON p.Id = pr.IdPermiso
      WHERE ru.IdUsuario = @uid AND ru.IdOrganizacion = @oid AND r.IdOrganizacion IS NULL
        AND p.Codigo IS NOT NULL
    `)
  const set = new Set<PermissionCode>()
  for (const row of r.recordset) if (row.Codigo && PERMISSION_CODES.has(row.Codigo as PermissionCode)) set.add(row.Codigo as PermissionCode)
  return [...set]
}
