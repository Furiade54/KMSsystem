import type { Request } from 'express'
import crypto from 'crypto'
import { getDbPool, sql } from '../../shared/db/pool'
import { hashPassword } from '../../shared/auth/crypto'
import { logAuditRecord } from '../../shared/db/audit'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'
import type {
  User,
  Role,
  RoleAssignment,
  CreateUserDto,
  UpdateUserDto,
  EntityStatus,
  PaginatedResult,
} from '../../../../packages/shared-types/src'

type UserAuth = { organizationId: string; userId: string }

const STATUS_ES_TO_EN: Record<string, EntityStatus> = {
  ACTIVO: 'ACTIVE',
  INACTIVO: 'INACTIVE',
  BLOQUEADO: 'BLOCKED',
  ELIMINADO: 'DELETED',
  PENDIENTE: 'PENDING',
}

const STATUS_EN_TO_ES: Record<string, string> = {
  ACTIVE: 'ACTIVO',
  INACTIVE: 'INACTIVO',
  BLOCKED: 'BLOQUEADO',
  DELETED: 'ELIMINADO',
  PENDING: 'PENDING',
}

function mapStatus(es: unknown): EntityStatus {
  const key = String(es || 'ACTIVO').toUpperCase()
  return STATUS_ES_TO_EN[key] ?? 'ACTIVE'
}

function toEsStatus(en: EntityStatus | undefined): string {
  if (!en) return 'ACTIVO'
  return STATUS_EN_TO_ES[en] ?? en
}

type UserRow = {
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
  proyectosCount?: number
}

export function mapUserRow(row: UserRow, withRoles: RoleAssignment[] = []): User {
  return {
    id: String(row.Id),
    organizationId: String(row.IdOrganizacion),
    fullName: row.NombreCompleto ?? null,
    email: String(row.Correo),
    avatarUrl: row.UrlAvatar ?? null,
    phone: row.Telefono ?? null,
    position: row.Cargo ?? null,
    status: mapStatus(row.Estado),
    lastLogin: sqlLocalToIsoOrNull(row.UltimoInicio as any),
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
    roles: withRoles.length > 0 ? withRoles.map((r) => ({
      id: r.roleId,
      name: r.roleName,
      isSystemRole: r.isSystemRole,
      assignedAt: r.assignedAt ?? null,
      assignedBy: r.assignedBy ?? null,
    })) : undefined,
  }
}

type RoleRow = {
  Id: string
  IdOrganizacion: string | null
  Nombre: string
  Descripcion: string | null
  NivelPrioridad: number | null
  FechaCreacion: Date
}

export function mapRoleRow(row: RoleRow): Role {
  return {
    id: String(row.Id),
    organizationId: row.IdOrganizacion ? String(row.IdOrganizacion) : null,
    name: String(row.Nombre),
    description: row.Descripcion ?? null,
    isSystemRole: row.IdOrganizacion === null,
    priorityLevel: row.NivelPrioridad ? Number(row.NivelPrioridad) : undefined,
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: null,
  }
}

type RoleAssignmentRow = {
  Id: string
  IdUsuario: string
  IdRol: string
  Nombre: string
  Descripcion: string | null
  IdOrganizacionRol: string | null
  NivelPrioridad: number | null
  FechaAsignacion: Date | null
  AsignadoPor: string | null
  AsignadoPorNombre: string | null
}

function mapRoleAssignment(row: RoleAssignmentRow): RoleAssignment {
  return {
    id: String(row.Id),
    userId: String(row.IdUsuario),
    roleId: String(row.IdRol),
    roleName: String(row.Nombre),
    roleDescription: row.Descripcion ?? null,
    isSystemRole: row.IdOrganizacionRol === null,
    priorityLevel: row.NivelPrioridad ? Number(row.NivelPrioridad) : undefined,
    assignedAt: sqlLocalToIsoOrNull(row.FechaAsignacion as any),
    assignedBy: row.AsignadoPor ? String(row.AsignadoPor) : null,
    assignedByName: row.AsignadoPorNombre ?? null,
  }
}

function buildInClause(
  req: import('mssql').Request,
  prefix: string,
  values: string[],
  type: any = sql.NVarChar(64)
): string {
  const placeholders: string[] = []
  values.forEach((v, i) => {
    const key = `${prefix}${i}`
    req.input(key, type, String(v))
    placeholders.push(`@${key}`)
  })
  return placeholders.join(', ')
}

async function fetchRolesForUsers(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  organizationId: string,
  userIds: string[]
): Promise<Map<string, RoleAssignment[]>> {
  const out = new Map<string, RoleAssignment[]>()
  if (userIds.length === 0) return out
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, organizationId)
  const inClause = buildInClause(req, 'uid_', userIds, sql.UniqueIdentifier)
  const r = await req.query<RoleAssignmentRow>(`
    SELECT ru.Id, ru.IdUsuario, ru.IdRol, r.Nombre, r.Descripcion, r.IdOrganizacion IdOrganizacionRol,
           r.NivelPrioridad, ru.FechaAsignacion, ru.AsignadoPor,
           ua.NombreCompleto AsignadoPorNombre
    FROM RolesUsuario ru
      INNER JOIN Roles r ON r.Id = ru.IdRol
      LEFT JOIN Usuarios ua ON ua.Id = ru.AsignadoPor
    WHERE ru.IdOrganizacion = @orgId
      AND ru.IdUsuario IN (${inClause})
    ORDER BY ISNULL(r.NivelPrioridad, 255), r.Nombre
  `)
  for (const row of r.recordset) {
    const uid = String(row.IdUsuario)
    const arr = out.get(uid) ?? []
    arr.push(mapRoleAssignment(row))
    out.set(uid, arr)
  }
  return out
}

export async function fetchRolesForUser(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  organizationId: string,
  userId: string
): Promise<RoleAssignment[]> {
  const m = await fetchRolesForUsers(pool, organizationId, [userId])
  return m.get(userId) ?? []
}

export async function listUsers(
  auth: UserAuth,
  opts: {
    page: number
    pageSize: number
    search?: string | null
    status?: string | null
    includeDeleted?: boolean
  }
): Promise<PaginatedResult<User & { projectsCount: number; rolesCount: number }>> {
  const page = Math.max(1, opts.page)
  const pageSize = Math.max(1, Math.min(100, opts.pageSize))
  const offset = (page - 1) * pageSize
  const pool = await getDbPool()
  const where: string[] = ['u.IdOrganizacion = @orgId']
  const countReq = pool.request()
  const dataReq = pool.request()
  countReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  dataReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)

  const search = opts.search?.trim()
  if (search && search.length > 0) {
    countReq.input('s', sql.NVarChar(255), `%${search}%`)
    dataReq.input('s', sql.NVarChar(255), `%${search}%`)
    where.push('(u.NombreCompleto LIKE @s OR u.Correo LIKE @s OR u.Cargo LIKE @s)')
  }

  const stRaw = opts.status?.trim().toUpperCase()
  if (stRaw) {
    const stEs = STATUS_EN_TO_ES[stRaw] ?? stRaw
    countReq.input('st', sql.VarChar(30), stEs)
    dataReq.input('st', sql.VarChar(30), stEs)
    where.push('u.Estado = @st')
  } else if (!opts.includeDeleted) {
    where.push("u.Estado <> 'ELIMINADO'")
  }

  const whereStr = 'WHERE ' + where.join(' AND ')

  const cnt = await countReq.query<{ total: number }>(
    `SELECT COUNT(*) total FROM Usuarios u ${whereStr}`
  )
  const total = Number(cnt.recordset[0]?.total ?? 0)
  const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize))

  dataReq.input('off', sql.Int, offset)
  dataReq.input('lim', sql.Int, pageSize)
  const rows = await dataReq.query<UserRow>(`
    SELECT u.Id, u.IdOrganizacion, u.NombreCompleto, u.Correo, u.UrlAvatar, u.Telefono, u.Cargo,
           u.Estado, u.UltimoInicio, u.FechaCreacion, u.FechaActualizacion,
           (SELECT COUNT(*) FROM MiembrosProyecto mp INNER JOIN Proyectos p ON p.Id = mp.IdProyecto WHERE mp.IdUsuario = u.Id AND p.Estado <> 'ELIMINADO') proyectosCount
    FROM Usuarios u ${whereStr}
    ORDER BY ISNULL(u.NombreCompleto, u.Correo) ASC, u.FechaCreacion ASC
    OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
  `)

  const ids = rows.recordset.map((r) => String(r.Id))
  const rolesMap = await fetchRolesForUsers(pool, auth.organizationId, ids)

  const items = rows.recordset.map((r) => {
    const roles = rolesMap.get(String(r.Id)) ?? []
    const base = mapUserRow(r, roles) as User & { projectsCount: number; rolesCount: number }
    base.projectsCount = Number(r.proyectosCount ?? 0)
    base.rolesCount = roles.length
    return base
  })

  return { items, total, page, pageSize, totalPages }
}

export async function getUserDetail(
  auth: UserAuth,
  userId: string
): Promise<User & { projectsCount: number }> {
  const pool = await getDbPool()
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  req.input('userId', sql.UniqueIdentifier, userId)
  const r = await req.query<UserRow>(`
    SELECT u.Id, u.IdOrganizacion, u.NombreCompleto, u.Correo, u.UrlAvatar, u.Telefono, u.Cargo,
           u.Estado, u.UltimoInicio, u.FechaCreacion, u.FechaActualizacion,
           (SELECT COUNT(*) FROM MiembrosProyecto mp INNER JOIN Proyectos p ON p.Id = mp.IdProyecto WHERE mp.IdUsuario = u.Id AND p.Estado <> 'ELIMINADO') proyectosCount
    FROM Usuarios u
    WHERE u.Id = @userId AND u.IdOrganizacion = @orgId
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Usuario no encontrado')
  const roles = await fetchRolesForUser(pool, auth.organizationId, userId)
  const user = mapUserRow(row, roles) as User & { projectsCount: number }
  user.projectsCount = Number(row.proyectosCount ?? 0)
  return user
}

async function assertRoleIdsInOrg(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  organizationId: string,
  roleIds: string[]
): Promise<void> {
  if (roleIds.length === 0) return
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, organizationId)
  const inClause = buildInClause(req, 'rid_', roleIds, sql.UniqueIdentifier)
  const r = await req.query<{ Id: string }>(`
    SELECT Id FROM Roles
    WHERE Id IN (${inClause}) AND (IdOrganizacion = @orgId OR IdOrganizacion IS NULL)
  `)
  if (r.recordset.length !== roleIds.length) {
    throw new BadRequestError('Uno o más roles no existen en la organización')
  }
}

async function resolveDefaultMemberRoleId(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  organizationId: string
): Promise<string | null> {
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, organizationId)
  const { recordset } = await req.query<{ Id: string }>(`
    SELECT TOP 1 Id
    FROM dbo.Roles
    WHERE IdOrganizacion = @orgId
      AND EsRolSistema = 1
      AND LOWER(Nombre) = 'miembro'
    ORDER BY NivelPrioridad DESC
  `)
  return recordset[0]?.Id ?? null
}

export async function createUser(
  auth: UserAuth,
  dto: CreateUserDto,
  req?: Request | null
): Promise<User> {
  const fullName = dto.fullName.trim()
  const email = dto.email.trim().toLowerCase()
  if (fullName.length < 2) throw new BadRequestError('Nombre completo requerido')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError('Correo inválido')

  const pool = await getDbPool()
  const dup = pool.request()
  dup.input('email', sql.NVarChar(200), email)
  dup.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  const d = await dup.query<{ Id: string }>(
    `SELECT TOP 1 Id FROM Usuarios WHERE LOWER(Correo)=LOWER(@email) AND IdOrganizacion=@orgId`
  )
  if (d.recordset[0]) throw new ConflictError('Ya existe un usuario con ese correo en la organización')

  const status = toEsStatus(dto.status ?? 'ACTIVE')
  const passwordPlain = dto.password ?? crypto.randomBytes(8).toString('base64url')
  const passwordHash = await hashPassword(passwordPlain)
  let roleIds = Array.from(new Set(dto.roleIds ?? []))

  if (roleIds.length === 0) {
    const defaultId = await resolveDefaultMemberRoleId(pool, auth.organizationId)
    if (defaultId) roleIds = [defaultId]
  }

  await assertRoleIdsInOrg(pool, auth.organizationId, roleIds)

  const tx = pool.transaction()
  let newId = ''
  try {
    await tx.begin()
    newId = crypto.randomUUID()
    const ins = tx.request()
    ins.input('id', sql.UniqueIdentifier, newId)
    ins.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    ins.input('name', sql.NVarChar(150), fullName)
    ins.input('email', sql.NVarChar(200), email)
    ins.input('hash', sql.NVarChar(sql.MAX), passwordHash)
    ins.input('phone', sql.NVarChar(50), dto.phone?.trim() || null)
    ins.input('position', sql.NVarChar(150), dto.position?.trim() || null)
    ins.input('st', sql.VarChar(30), status)
    await ins.query(`
      INSERT Usuarios(Id,IdOrganizacion,NombreCompleto,Correo,ClaveHash,UrlAvatar,Telefono,Cargo,Estado,UltimoInicio,FechaCreacion,FechaActualizacion)
      VALUES (@id,@orgId,@name,@email,@hash,NULL,@phone,@position,@st,NULL,GETDATE(),GETDATE())
    `)

    if (roleIds.length > 0) {
      const rolesReq = tx.request()
      rolesReq.input('userId', sql.UniqueIdentifier, newId)
      rolesReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
      rolesReq.input('by', sql.UniqueIdentifier, auth.userId)
      const inClause = buildInClause(rolesReq, 'rid_', roleIds, sql.UniqueIdentifier)
      await rolesReq.query(`
        INSERT RolesUsuario(IdUsuario, IdRol, IdOrganizacion, FechaAsignacion, AsignadoPor)
        SELECT @userId, r.Id, @orgId, GETDATE(), @by
        FROM Roles r
        WHERE r.Id IN (${inClause})
          AND NOT EXISTS (
            SELECT 1 FROM RolesUsuario x
            WHERE x.IdUsuario = @userId AND x.IdRol = r.Id AND x.IdOrganizacion = @orgId
          )
      `)
    }

    await tx.commit()
  } catch (e) {
    try { await tx.rollback() } catch { /* ignore */ }
    throw e
  }

  const detail = await getUserDetail(auth, newId)

  await logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'USER_CREATED',
    resourceType: 'USER' as any,
    resourceId: newId,
    resourceName: fullName,
    extra: { email },
    req: req ?? null,
  })

  return detail
}

export async function updateUser(
  auth: UserAuth,
  userId: string,
  dto: UpdateUserDto,
  req?: Request | null
): Promise<User> {
  const pool = await getDbPool()
  const cur = pool.request()
  cur.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  cur.input('userId', sql.UniqueIdentifier, userId)
  const existing = await cur.query<{ Id: string; Correo: string; Estado: string }>(
    `SELECT Id, Correo, Estado FROM Usuarios WHERE Id=@userId AND IdOrganizacion=@orgId`
  )
  const row = existing.recordset[0]
  if (!row) throw new NotFoundError('Usuario no encontrado')

  const sets: string[] = []
  const up = pool.request()

  if (dto.fullName !== undefined) {
    const v = dto.fullName.trim()
    if (v.length < 2) throw new BadRequestError('Nombre completo requerido')
    up.input('name', sql.NVarChar(150), v)
    sets.push('NombreCompleto = @name')
  }
  if (dto.email !== undefined) {
    const v = dto.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new BadRequestError('Correo inválido')
    if (v !== String(row.Correo).toLowerCase()) {
      const dup = pool.request()
      dup.input('email', sql.NVarChar(200), v)
      dup.input('orgId', sql.UniqueIdentifier, auth.organizationId)
      dup.input('self', sql.UniqueIdentifier, userId)
      const d = await dup.query<{ Id: string }>(
        `SELECT TOP 1 Id FROM Usuarios WHERE LOWER(Correo)=LOWER(@email) AND IdOrganizacion=@orgId AND Id<>@self`
      )
      if (d.recordset[0]) throw new ConflictError('Ya existe un usuario con ese correo en la organización')
    }
    up.input('email', sql.NVarChar(200), v)
    sets.push('Correo = @email')
  }
  if (dto.phone !== undefined) {
    up.input('phone', sql.NVarChar(50), dto.phone?.trim() || null)
    sets.push('Telefono = @phone')
  }
  if (dto.position !== undefined) {
    up.input('position', sql.NVarChar(150), dto.position?.trim() || null)
    sets.push('Cargo = @position')
  }
  if (dto.avatarUrl !== undefined) {
    up.input('avatar', sql.NVarChar(500), dto.avatarUrl?.trim() || null)
    sets.push('UrlAvatar = @avatar')
  }
  if (dto.status !== undefined) {
    const st = toEsStatus(dto.status)
    up.input('st', sql.VarChar(30), st)
    sets.push('Estado = @st')
  }
  if (dto.password !== undefined) {
    const v = dto.password
    if (v.length < 6) throw new BadRequestError('Contraseña debe tener al menos 6 caracteres')
    const h = await hashPassword(v)
    up.input('hash', sql.NVarChar(sql.MAX), h)
    sets.push('ClaveHash = @hash')
  }

  const tx = pool.transaction()
  try {
    await tx.begin()
    if (sets.length > 0) {
      sets.push('FechaActualizacion = GETDATE()')
      const upTx = tx.request()
      Object.keys(up.parameters ?? {}).forEach((k) => {
        const v = (up.parameters as any)[k]
        if (v && v.value !== undefined) {
          ;(upTx as any).input(k, v.type, v.value)
        }
      })
      upTx.input('userId', sql.UniqueIdentifier, userId)
      upTx.input('orgId', sql.UniqueIdentifier, auth.organizationId)
      await upTx.query(`UPDATE Usuarios SET ${sets.join(', ')} WHERE Id = @userId AND IdOrganizacion = @orgId`)
    }

    if (dto.roleIds) {
      const desired = Array.from(new Set(dto.roleIds))
      await assertRoleIdsInOrg(pool, auth.organizationId, desired)
      const syncDel = tx.request()
      syncDel.input('userId', sql.UniqueIdentifier, userId)
      syncDel.input('orgId', sql.UniqueIdentifier, auth.organizationId)
      await syncDel.query(`DELETE FROM RolesUsuario WHERE IdUsuario = @userId AND IdOrganizacion = @orgId`)
      if (desired.length > 0) {
        const ins = tx.request()
        ins.input('userId', sql.UniqueIdentifier, userId)
        ins.input('orgId', sql.UniqueIdentifier, auth.organizationId)
        ins.input('by', sql.UniqueIdentifier, auth.userId)
        const inClause = buildInClause(ins, 'rid_', desired, sql.UniqueIdentifier)
        await ins.query(`
          INSERT RolesUsuario(IdUsuario, IdRol, IdOrganizacion, FechaAsignacion, AsignadoPor)
          SELECT @userId, r.Id, @orgId, GETDATE(), @by FROM Roles r WHERE r.Id IN (${inClause})
        `)
      }
    }
    await tx.commit()
  } catch (e) {
    try { await tx.rollback() } catch { /* ignore */ }
    throw e
  }

  const detail = await getUserDetail(auth, userId)
  await logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'USER_UPDATED',
    resourceType: 'USER' as any,
    resourceId: userId,
    resourceName: detail.fullName ?? undefined,
    extra: { fields: sets.map((s) => s.split(' ')[0]), rolesChanged: dto.roleIds !== undefined },
    req: req ?? null,
  })
  return detail
}

export async function softDeleteUser(
  auth: UserAuth,
  userId: string,
  req?: Request | null
): Promise<void> {
  if (String(auth.userId).toLowerCase() === String(userId).toLowerCase()) {
    throw new ForbiddenError('No puedes desactivar tu propio usuario')
  }
  const pool = await getDbPool()
  const cur = pool.request()
  cur.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  cur.input('userId', sql.UniqueIdentifier, userId)
  const r = await cur.query<{ Id: string; NombreCompleto: string | null }>(
    `SELECT Id, NombreCompleto FROM Usuarios WHERE Id=@userId AND IdOrganizacion=@orgId AND Estado <> 'ELIMINADO'`
  )
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Usuario no encontrado')
  await cur.query(
    `UPDATE Usuarios SET Estado='ELIMINADO', FechaActualizacion=GETDATE() WHERE Id=@userId AND IdOrganizacion=@orgId`
  )
  await logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'USER_DELETED',
    resourceType: 'USER' as any,
    resourceId: userId,
    resourceName: row.NombreCompleto ?? undefined,
    req: req ?? null,
  })
}

export async function permanentlyDeleteUser(
  auth: UserAuth,
  userId: string,
  req?: Request | null
): Promise<void> {
  if (String(auth.userId).toLowerCase() === String(userId).toLowerCase()) {
    throw new ForbiddenError('No puedes eliminar tu propio usuario permanentemente')
  }
  const pool = await getDbPool()
  const tx = pool.transaction()
  let userName: string | null = null
  try {
    await tx.begin()
    const cur = tx.request()
    cur.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    cur.input('userId', sql.UniqueIdentifier, userId)
    const r = await cur.query<{ Id: string; NombreCompleto: string | null; Estado: string }>(
      `SELECT Id, NombreCompleto, Estado FROM Usuarios WHERE Id=@userId AND IdOrganizacion=@orgId`
    )
    const row = r.recordset[0]
    if (!row) throw new NotFoundError('Usuario no encontrado')
    userName = row.NombreCompleto ?? null

    const clean = tx.request()
    clean.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    clean.input('userId', sql.UniqueIdentifier, userId)
    await clean.batch(`
      SET NOCOUNT ON;

      UPDATE RolesUsuario SET AsignadoPor = NULL WHERE AsignadoPor = @userId AND IdOrganizacion = @orgId;
      UPDATE SolicitudesAcceso SET IdPropietario = NULL WHERE IdPropietario = @userId;
      UPDATE Revisiones SET IdSolicitante = NULL WHERE IdSolicitante = @userId;
      UPDATE Revisiones SET IdRevisor = NULL WHERE IdRevisor = @userId;
      UPDATE Compartidos SET IdComparte = NULL WHERE IdComparte = @userId;
      UPDATE Compartidos SET IdUsuarioDestino = NULL WHERE IdUsuarioDestino = @userId;

      DELETE FROM RolesUsuario WHERE IdUsuario = @userId AND IdOrganizacion = @orgId;
      DELETE FROM MiembrosProyecto WHERE IdUsuario = @userId AND EXISTS (
        SELECT 1 FROM Proyectos p WHERE p.Id = MiembrosProyecto.IdProyecto AND p.IdOrganizacion = @orgId
      );
      DELETE FROM AsistentesReunion WHERE IdUsuario = @userId AND EXISTS (
        SELECT 1 FROM Reuniones r INNER JOIN Proyectos p ON p.Id=r.IdProyecto WHERE r.Id = AsistentesReunion.IdReunion AND p.IdOrganizacion = @orgId
      );
      DELETE FROM ComentariosArchivos WHERE IdUsuario = @userId AND IdOrganizacion = @orgId;
      DELETE FROM Comentarios WHERE IdUsuario = @userId;
      DELETE FROM Favoritos WHERE IdUsuario = @userId AND IdOrganizacion = @orgId;
      DELETE FROM Notificaciones WHERE IdUsuario = @userId;
      DELETE FROM ActividadReciente WHERE IdUsuario = @userId AND IdOrganizacion = @orgId;
      DELETE FROM SolicitudesPendientes WHERE IdUsuario = @userId;
      DELETE FROM SolicitudesAcceso WHERE IdPropietario = @userId;

      UPDATE Proyectos SET IdPropietario = NULL, FechaActualizacion = GETDATE()
      WHERE IdPropietario = @userId AND IdOrganizacion = @orgId;

      UPDATE Carpetas SET IdPropietario = NULL, FechaActualizacion = GETDATE()
      WHERE IdPropietario = @userId AND EXISTS (
        SELECT 1 FROM Proyectos p WHERE p.Id = Carpetas.IdProyecto AND p.IdOrganizacion = @orgId
      );

      UPDATE Archivos SET IdPropietario = NULL, FechaActualizacion = GETDATE()
      WHERE IdPropietario = @userId AND EXISTS (
        SELECT 1 FROM Proyectos p WHERE p.Id = Archivos.IdProyecto AND p.IdOrganizacion = @orgId
      );

      UPDATE VersionesArchivo SET IdCargador = NULL WHERE IdCargador = @userId AND EXISTS (
        SELECT 1 FROM Archivos a INNER JOIN Proyectos p ON p.Id = a.IdProyecto WHERE a.Id = VersionesArchivo.IdArchivo AND p.IdOrganizacion = @orgId
      );

      UPDATE TemasProyecto SET IdCreador = NULL WHERE IdCreador = @userId AND EXISTS (
        SELECT 1 FROM Proyectos p WHERE p.Id = TemasProyecto.IdProyecto AND p.IdOrganizacion = @orgId
      );

      UPDATE Reuniones SET IdCreador = NULL WHERE IdCreador = @userId AND EXISTS (
        SELECT 1 FROM Proyectos p WHERE p.Id = Reuniones.IdProyecto AND p.IdOrganizacion = @orgId
      );

      UPDATE ActasReunion SET IdCreador = NULL WHERE IdCreador = @userId AND EXISTS (
        SELECT 1 FROM Reuniones r INNER JOIN Proyectos p ON p.Id=r.IdProyecto WHERE r.Id = ActasReunion.IdReunion AND p.IdOrganizacion = @orgId
      );

      UPDATE RecursosExternos SET IdCreador = NULL WHERE IdCreador = @userId AND EXISTS (
        SELECT 1 FROM Proyectos p WHERE p.Id = RecursosExternos.IdProyecto AND p.IdOrganizacion = @orgId
      );

      DELETE FROM Usuarios WHERE Id = @userId AND IdOrganizacion = @orgId;
    `)
    await tx.commit()
  } catch (e) {
    try { await tx.rollback() } catch { /* ignore */ }
    throw e
  }

  await logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'USER_PERMANENTLY_DELETED',
    resourceType: 'USER' as any,
    resourceId: userId,
    resourceName: userName ?? undefined,
    req: req ?? null,
  })
}

export async function listRoles(
  auth: UserAuth,
  opts?: { includeSystem?: boolean }
): Promise<Role[]> {
  const pool = await getDbPool()
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  const where = opts?.includeSystem === false
    ? 'r.IdOrganizacion = @orgId'
    : '(r.IdOrganizacion = @orgId OR r.IdOrganizacion IS NULL)'
  const r = await req.query<RoleRow>(`
    SELECT r.Id, r.IdOrganizacion, r.Nombre, r.Descripcion, r.NivelPrioridad, r.FechaCreacion
    FROM Roles r
    WHERE ${where}
    ORDER BY ISNULL(r.NivelPrioridad, 255), r.Nombre
  `)
  return r.recordset.map(mapRoleRow)
}

export async function assignRoles(
  auth: UserAuth,
  userId: string,
  roleIds: string[],
  req?: Request | null
): Promise<RoleAssignment[]> {
  if (String(auth.userId).toLowerCase() === String(userId).toLowerCase()) {
    throw new ForbiddenError('No puedes modificar tus propios roles')
  }
  const pool = await getDbPool()
  const check = pool.request()
  check.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  check.input('userId', sql.UniqueIdentifier, userId)
  const ex = await check.query<{ Id: string }>(`SELECT Id FROM Usuarios WHERE Id=@userId AND IdOrganizacion=@orgId`)
  if (!ex.recordset[0]) throw new NotFoundError('Usuario no encontrado')

  const desired = Array.from(new Set(roleIds))
  await assertRoleIdsInOrg(pool, auth.organizationId, desired)

  const tx = pool.transaction()
  try {
    await tx.begin()
    const del = tx.request()
    del.input('userId', sql.UniqueIdentifier, userId)
    del.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    await del.query(`DELETE FROM RolesUsuario WHERE IdUsuario = @userId AND IdOrganizacion = @orgId`)
    if (desired.length > 0) {
      const ins = tx.request()
      ins.input('userId', sql.UniqueIdentifier, userId)
      ins.input('orgId', sql.UniqueIdentifier, auth.organizationId)
      ins.input('by', sql.UniqueIdentifier, auth.userId)
      const inClause = buildInClause(ins, 'rid_', desired, sql.UniqueIdentifier)
      await ins.query(`
        INSERT RolesUsuario(IdUsuario, IdRol, IdOrganizacion, FechaAsignacion, AsignadoPor)
        SELECT @userId, r.Id, @orgId, GETDATE(), @by FROM Roles r WHERE r.Id IN (${inClause})
      `)
    }
    await tx.commit()
  } catch (e) {
    try { await tx.rollback() } catch { /* ignore */ }
    throw e
  }
  const roles = await fetchRolesForUser(pool, auth.organizationId, userId)
  await logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'USER_ROLES_UPDATED',
    resourceType: 'USER' as any,
    resourceId: userId,
    extra: { roleIds: desired },
    req: req ?? null,
  })
  return roles
}
