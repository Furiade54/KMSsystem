import crypto from 'node:crypto'
import type { Request } from 'express'
import type {
  CreateResourcePermissionDto,
  ListResourcePermissionsParams,
  PaginatedResult,
  ResourceCapability,
  ResourcePermissionGrant,
  ResourceTypeApi,
  ResourceTypeDb,
  UpdateResourcePermissionDto,
} from '../../../../packages/shared-types/src'
import {
  RESOURCE_CAPABILITY_TO_COLUMN,
  RESOURCE_TYPE_API_TO_DB,
  RESOURCE_TYPE_DB_TO_API,
} from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError'
import type { AuthContext } from '../../shared/middleware/auth'
import { ensureAuthWithRoles, type AuthWithRoles } from '../../shared/middleware/rbac'
import { sqlLocalToIso } from '../../shared/utils/date'
import { logAuditRecord } from '../../shared/db/audit'

function normalizeResourceType(type: ResourceTypeApi | ResourceTypeDb | string): ResourceTypeApi {
  const t = String(type).trim()
  if (t === 'PROJECT' || t === 'proyecto') return 'PROJECT'
  if (t === 'FOLDER' || t === 'carpeta') return 'FOLDER'
  if (t === 'FILE' || t === 'archivo') return 'FILE'
  throw new BadRequestError(`Tipo de recurso inválido: ${type}`)
}

function resourceTypeToDb(api: ResourceTypeApi): ResourceTypeDb {
  return RESOURCE_TYPE_API_TO_DB[api]
}

const PERMISSION_CODE_FOR_VER: Record<ResourceTypeApi, string[]> = {
  PROJECT: ['proyectos.ver'],
  FOLDER: ['proyectos.ver', 'archivos.ver'],
  FILE: ['archivos.ver'],
}
const PERMISSION_CODE_FOR_EDIT: Record<ResourceTypeApi, string[]> = {
  PROJECT: ['proyectos.editar'],
  FOLDER: ['archivos.editar', 'archivos.subir'],
  FILE: ['archivos.editar', 'archivos.subir'],
}
const CAPABILITY_TO_GENERAL_PERMISSION: Partial<
  Record<ResourceCapability, Partial<Record<ResourceTypeApi, string[]>>>
> = {
  VER: PERMISSION_CODE_FOR_VER as any,
  DESCARGAR: { FILE: ['archivos.ver'], FOLDER: ['archivos.ver'], PROJECT: ['proyectos.ver'] },
  COMENTAR: {
    FILE: ['comentarios.crear', 'comentarios.gestionar', 'archivos.ver'],
    FOLDER: ['comentarios.crear', 'comentarios.gestionar', 'archivos.ver'],
    PROJECT: ['comentarios.crear', 'comentarios.gestionar', 'proyectos.ver'],
  },
  EDITAR: PERMISSION_CODE_FOR_EDIT as any,
  COMPARTIR: {
    FILE: ['archivos.compartir', 'archivos.editar'],
    FOLDER: ['archivos.compartir', 'archivos.editar'],
    PROJECT: ['proyectos.miembros.gestionar'],
  },
  ADMINISTRAR: {
    FILE: ['archivos.eliminar', 'archivos.editar'],
    FOLDER: ['archivos.eliminar', 'archivos.editar'],
    PROJECT: ['proyectos.eliminar', 'proyectos.editar'],
  },
}

const RESOURCE_TABLE: Record<
  ResourceTypeApi,
  { table: string; id: string; orgId: string; ownerId?: string; projectId?: string; name: string }
> = {
  PROJECT: { table: 'Proyectos', id: 'Id', orgId: 'IdOrganizacion', ownerId: 'IdPropietario', name: 'Nombre' },
  FOLDER: { table: 'Carpetas', id: 'Id', orgId: 'IdOrganizacion', ownerId: 'IdPropietario', projectId: 'IdProyecto', name: 'Nombre' },
  FILE: { table: 'Archivos', id: 'Id', orgId: 'IdOrganizacion', ownerId: 'IdPropietario', projectId: 'IdProyecto', name: 'Nombre' },
}

export async function fetchResourceMeta(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  resourceType: ResourceTypeApi,
  resourceId: string
): Promise<{
  id: string
  organizationId: string
  ownerId: string | null
  projectId: string | null
  name: string
} | null> {
  const meta = RESOURCE_TABLE[resourceType]
  const req = pool
    .request()
    .input('id', sql.UniqueIdentifier, resourceId)
  const cols = [
    `${meta.id} as id`,
    `${meta.orgId} as organizationId`,
    meta.ownerId ? `${meta.ownerId} as ownerId` : `NULL as ownerId`,
    meta.projectId ? `${meta.projectId} as projectId` : `NULL as projectId`,
    `${meta.name} as name`,
  ].join(', ')
  const res = await req.query(`SELECT ${cols} FROM dbo.${meta.table} WHERE ${meta.id} = @id`)
  const row = (res.recordset as Array<any>)[0]
  if (!row) return null
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    ownerId: row.ownerId ? String(row.ownerId) : null,
    projectId: row.projectId ? String(row.projectId) : null,
    name: String(row.name ?? ''),
  }
}

function getCapabilityBitColumnName(capability: ResourceCapability): string {
  return RESOURCE_CAPABILITY_TO_COLUMN[capability] ?? 'PuedeVer'
}

export async function hasCapabilityOnResource(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  auth: AuthWithRoles,
  resourceType: ResourceTypeApi | ResourceTypeDb | string,
  resourceId: string,
  capability: ResourceCapability,
  opts?: {
    resourceMeta?: { id: string; organizationId: string; ownerId: string | null; projectId: string | null }
    bypassCache?: boolean
    cacheMap?: Map<string, any>
    req?: Request
  }
): Promise<boolean> {
  const cacheMap: Map<string, any> =
    opts?.cacheMap ??
    (((opts?.req as any)?.resourcePermissionCache as Map<string, any>) || new Map<string, any>())
  if (!opts?.bypassCache) {
    const key = `${auth.userId}:${resourceType}:${resourceId}:${capability}`
    if (cacheMap.has(key)) return Boolean(cacheMap.get(key))
  }
  if (!opts?.cacheMap && opts?.req) (opts.req as any).resourcePermissionCache = cacheMap

  const apiType = normalizeResourceType(resourceType)

  // 1. org admin todo permitido
  if (auth.isOrgAdmin) return true

  // 2. Permiso RBAC general equivalente (OR, backward compat)
  const permCodes = CAPABILITY_TO_GENERAL_PERMISSION[capability]?.[apiType] ?? []
  if (permCodes.some((c) => auth.permissions.has(c as any))) return true

  // Cargar metadatos del recurso si no se pasaron
  const meta =
    opts?.resourceMeta ?? (await fetchResourceMeta(pool, apiType, resourceId))
  if (!meta) return false

  // Cross-org check: si no pertenece a la org, false
  if (meta.organizationId !== auth.organizationId) return false

  // 3. Propietario: acceso total excepto si capability=ADMINISTRAR? Lo tratamos como admin total también si owner.
  if (meta.ownerId && meta.ownerId === auth.userId) return true

  // 4. Si pertenece a un proyecto y capability != ADMINISTRAR, chequeamos MiembrosProyecto.
  if (capability !== 'ADMINISTRAR' && meta.projectId) {
    const mp = await pool
      .request()
      .input('projectId', sql.UniqueIdentifier, meta.projectId)
      .input('userId', sql.UniqueIdentifier, auth.userId)
      .query(
        `SELECT 1 found FROM dbo.MiembrosProyecto WHERE IdProyecto=@projectId AND IdUsuario=@userId`
      )
    if ((mp.recordset as any[])[0]?.found === 1) return true
  }

  // 5. Tabla PermisosRecurso: bits (IdUsuario=auth.userId O IdRol en auth.roles.roleIds) Y capability=1 O ADMINISTRAR=1
  const col = getCapabilityBitColumnName(capability)
  const roleIds = (auth.roles ?? []).map((r) => r.roleId).filter(Boolean)
  const rolesPlaceholder =
    roleIds.length > 0
      ? `pr.IdRol IN (${roleIds
          .map((_, i) => `@rid${i}`)
          .join(',')})`
      : `1=0`
  let rq = pool.request()
  rq = rq
    .input('resourceType', sql.VarChar(20), resourceTypeToDb(apiType))
    .input('resourceId', sql.UniqueIdentifier, resourceId)
    .input('userId', sql.UniqueIdentifier, auth.userId)
  roleIds.forEach((id, i) => {
    rq = rq.input(`rid${i}`, sql.UniqueIdentifier, id)
  })
  const q = `
    SELECT TOP 1 1 ok
    FROM dbo.PermisosRecurso pr
    WHERE pr.TipoRecurso = @resourceType
      AND pr.IdRecurso = @resourceId
      AND (
        pr.IdUsuario = @userId
        OR ${rolesPlaceholder}
      )
      AND (
        pr.PuedeAdministrar = 1
        OR pr.${col} = 1
      )
  `
  const got = await rq.query(q)
  const yes = (got.recordset as any[])[0]?.ok === 1
  const key = `${auth.userId}:${resourceType}:${resourceId}:${capability}`
  cacheMap.set(key, yes)
  return yes
}

function validateGranteeBody(body: any): { userId: string | null; roleId: string | null } {
  const hasUserId = typeof body?.userId === 'string' && body.userId.length > 0
  const hasRoleId = typeof body?.roleId === 'string' && body.roleId.length > 0
  if (hasUserId && hasRoleId) {
    throw new BadRequestError('Solo se permite uno de userId o roleId por permiso, no ambos.')
  }
  if (!hasUserId && !hasRoleId) {
    throw new BadRequestError('Se requiere uno de: userId o roleId para conceder el permiso.')
  }
  return { userId: hasUserId ? body.userId : null, roleId: hasRoleId ? body.roleId : null }
}

function bitsFromBody(body: any): {
  puedeVer: boolean
  puedeDescargar: boolean
  puedeComentar: boolean
  puedeEditar: boolean
  puedeCompartir: boolean
  puedeAdministrar: boolean
} {
  const norm = (v: any): boolean => v === true || v === 1 || v === '1' || v === 'true'
  let ver = norm(body?.puedeVer)
  const descargar = norm(body?.puedeDescargar)
  const comentar = norm(body?.puedeComentar)
  const editar = norm(body?.puedeEditar)
  const compartir = norm(body?.puedeCompartir)
  const admin = norm(body?.puedeAdministrar)
  // Jerarquía: editar/compartir/admin → implica puedeVer
  if (descargar || comentar || editar || compartir || admin) ver = true
  return {
    puedeVer: ver,
    puedeDescargar: admin ? true : descargar,
    puedeComentar: admin ? true : comentar,
    puedeEditar: admin ? true : editar,
    puedeCompartir: admin ? true : compartir,
    puedeAdministrar: admin,
  }
}

function mapGrant(row: any): ResourcePermissionGrant {
  const rt = String(row.TipoRecurso ?? '').toLowerCase() as ResourceTypeDb
  const resourceType = RESOURCE_TYPE_DB_TO_API[rt] ?? 'FILE'
  return {
    id: String(row.Id),
    resourceType,
    resourceId: String(row.IdRecurso),
    userId: row.IdUsuario ? String(row.IdUsuario) : null,
    userName: row.NombreUsuario ?? null,
    userEmail: row.CorreoUsuario ?? null,
    roleId: row.IdRol ? String(row.IdRol) : null,
    roleName: row.NombreRol ?? null,
    puedeVer: Boolean(row.PuedeVer),
    puedeDescargar: Boolean(row.PuedeDescargar),
    puedeComentar: Boolean(row.PuedeComentar),
    puedeEditar: Boolean(row.PuedeEditar),
    puedeCompartir: Boolean(row.PuedeCompartir),
    puedeAdministrar: Boolean(row.PuedeAdministrar),
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    grantedByUserId: row.IdConcedidoPor ? String(row.IdConcedidoPor) : null,
    grantedByUserName: row.NombreConcedidoPor ?? null,
  }
}

export async function getPermissionsForResource(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  actorAuth: AuthWithRoles,
  resourceType: ResourceTypeApi | ResourceTypeDb,
  resourceId: string,
  params: ListResourcePermissionsParams = {}
): Promise<PaginatedResult<ResourcePermissionGrant>> {
  const apiType = normalizeResourceType(resourceType)
  const meta = await fetchResourceMeta(pool, apiType, resourceId)
  if (!meta) throw new NotFoundError('Recurso no encontrado')
  if (meta.organizationId !== actorAuth.organizationId) throw new ForbiddenError('Acceso denegado')
  const can = await hasCapabilityOnResource(pool, actorAuth, apiType, resourceId, 'ADMINISTRAR', { resourceMeta: meta })
  const canVerPermisos = actorAuth.isOrgAdmin || actorAuth.permissions.has('recursos.permisos.ver' as any) || can
  if (!canVerPermisos) throw new ForbiddenError('No tienes permiso para ver los permisos del recurso')

  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25))
  const offset = (page - 1) * pageSize
  const scope = params.scope ?? 'all'
  const search = typeof params.search === 'string' ? params.search.trim() : ''

  let where = `pr.TipoRecurso = @resourceType AND pr.IdRecurso = @resourceId`
  if (scope === 'users') where += ' AND pr.IdUsuario IS NOT NULL'
  if (scope === 'roles') where += ' AND pr.IdRol IS NOT NULL'
  if (search) where += ` AND (LOWER(ISNULL(u.NombreCompleto,'') + ' ' + ISNULL(u.Correo,'') + ' ' + ISNULL(r.Nombre,'')) LIKE @search)`

  const dbType = resourceTypeToDb(apiType)
  const sharedInputs: { k: string; t: any; v: any }[] = [
    { k: 'resourceType', t: sql.VarChar(20), v: dbType },
    { k: 'resourceId', t: sql.UniqueIdentifier, v: resourceId },
    { k: 'offset', t: sql.Int, v: offset },
    { k: 'pageSize', t: sql.Int, v: pageSize },
  ]
  if (search) sharedInputs.push({ k: 'search', t: sql.VarChar(500), v: `%${search.toLowerCase()}%` })

  const newRequest = () => {
    let r = pool.request()
    for (const s of sharedInputs) r = r.input(s.k, s.t, s.v)
    return r
  }

  const qCount = `
    SELECT COUNT(*) total
    FROM dbo.PermisosRecurso pr
    LEFT JOIN dbo.Usuarios u ON u.Id = pr.IdUsuario
    LEFT JOIN dbo.Roles r ON r.Id = pr.IdRol
    WHERE ${where}
  `
  const total = Number((await newRequest().query(qCount)).recordset[0]?.total ?? 0)

  const qRows = `
    SELECT pr.Id, pr.TipoRecurso, pr.IdRecurso, pr.IdUsuario, pr.IdRol,
           pr.PuedeVer, pr.PuedeDescargar, pr.PuedeComentar, pr.PuedeEditar, pr.PuedeCompartir, pr.PuedeAdministrar,
           pr.FechaCreacion, pr.IdConcedidoPor,
           u.NombreCompleto NombreUsuario, u.Correo CorreoUsuario,
           r.Nombre NombreRol,
           uC.NombreCompleto NombreConcedidoPor
    FROM dbo.PermisosRecurso pr
    LEFT JOIN dbo.Usuarios u ON u.Id = pr.IdUsuario
    LEFT JOIN dbo.Roles r ON r.Id = pr.IdRol
    LEFT JOIN dbo.Usuarios uC ON uC.Id = pr.IdConcedidoPor
    WHERE ${where}
    ORDER BY pr.FechaCreacion DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `
  const rows = (await newRequest().query(qRows)).recordset.map(mapGrant)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { items: rows, total, page, pageSize, totalPages }
}

export async function upsertGrant(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  actorAuth: AuthWithRoles,
  resourceType: ResourceTypeApi | ResourceTypeDb | string,
  resourceId: string,
  body: CreateResourcePermissionDto,
  req?: Request
): Promise<ResourcePermissionGrant> {
  const apiType = normalizeResourceType(resourceType)
  const meta = await fetchResourceMeta(pool, apiType, resourceId)
  if (!meta) throw new NotFoundError('Recurso no encontrado')
  if (meta.organizationId !== actorAuth.organizationId) throw new ForbiddenError('Acceso denegado')

  const canAdmin = await hasCapabilityOnResource(pool, actorAuth, apiType, resourceId, 'ADMINISTRAR', { resourceMeta: meta })
  const canEditPerms = actorAuth.isOrgAdmin || actorAuth.permissions.has('recursos.permisos.editar' as any)
  if (!canAdmin && !canEditPerms) throw new ForbiddenError('No puedes gestionar permisos de este recurso')

  const { userId, roleId } = validateGranteeBody(body as any)
  const bits = bitsFromBody(body)

  // Validar que usuario/rol existan en la org.
  if (userId) {
    const u = await pool.request().input('id', sql.UniqueIdentifier, userId).input('orgId', sql.UniqueIdentifier, actorAuth.organizationId)
      .query(`SELECT 1 ok FROM dbo.Usuarios WHERE Id=@id AND IdOrganizacion=@orgId`)
    if (!(u.recordset as any[])[0]) throw new BadRequestError('Usuario no pertenece a la organización')
  }
  if (roleId) {
    const r = await pool.request().input('id', sql.UniqueIdentifier, roleId).input('orgId', sql.UniqueIdentifier, actorAuth.organizationId)
      .query(`SELECT 1 ok FROM dbo.Roles WHERE Id=@id AND IdOrganizacion=@orgId`)
    if (!(r.recordset as any[])[0]) throw new BadRequestError('Rol no pertenece a la organización')
  }

  const dbType = resourceTypeToDb(apiType)
  // Buscar fila existente por XOR (TipoRecurso, IdRecurso, IdUsuario) o (..., IdRol)
  let existReq = pool.request()
    .input('resourceType', sql.VarChar(20), dbType)
    .input('resourceId', sql.UniqueIdentifier, resourceId)
  let existWhere = `TipoRecurso = @resourceType AND IdRecurso = @resourceId`
  if (userId) {
    existReq = existReq.input('userId', sql.UniqueIdentifier, userId)
    existWhere += ` AND IdUsuario = @userId`
  } else if (roleId) {
    existReq = existReq.input('roleId', sql.UniqueIdentifier, roleId)
    existWhere += ` AND IdRol = @roleId`
  }
  const exist = await existReq.query(`SELECT Id FROM dbo.PermisosRecurso WHERE ${existWhere}`)
  const id: string = (exist.recordset as any[])[0]?.Id ?? crypto.randomUUID()

  const sets = [
    `PuedeVer = @p1`,
    `PuedeDescargar = @p2`,
    `PuedeComentar = @p3`,
    `PuedeEditar = @p4`,
    `PuedeCompartir = @p5`,
    `PuedeAdministrar = @p6`,
    `FechaActualizacion = GETDATE()`,
    `IdConcedidoPor = @by`,
  ]
  const insCols = [
    `Id`, `TipoRecurso`, `IdRecurso`, userId ? `IdUsuario` : `IdRol`,
    `PuedeVer`, `PuedeDescargar`, `PuedeComentar`, `PuedeEditar`, `PuedeCompartir`, `PuedeAdministrar`,
    `FechaCreacion`, `IdConcedidoPor`,
  ]
  const insVals = [
    `@id`, `@resourceType`, `@resourceId`, userId ? `@userId` : `@roleId`,
    `@p1`, `@p2`, `@p3`, `@p4`, `@p5`, `@p6`,
    `GETDATE()`, `@by`,
  ]

  const op = (exist.recordset as any[])[0] ? 'editado' : 'otorgado'
  const action = op === 'editado' ? 'permiso.editado' : 'permiso.otorgado'

  let q = ''
  let req2 = pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('resourceType', sql.VarChar(20), dbType)
    .input('resourceId', sql.UniqueIdentifier, resourceId)
    .input('p1', sql.Bit, bits.puedeVer)
    .input('p2', sql.Bit, bits.puedeDescargar)
    .input('p3', sql.Bit, bits.puedeComentar)
    .input('p4', sql.Bit, bits.puedeEditar)
    .input('p5', sql.Bit, bits.puedeCompartir)
    .input('p6', sql.Bit, bits.puedeAdministrar)
    .input('by', sql.UniqueIdentifier, actorAuth.userId)
  if (userId) req2 = req2.input('userId', sql.UniqueIdentifier, userId)
  if (roleId) req2 = req2.input('roleId', sql.UniqueIdentifier, roleId)

  if ((exist.recordset as any[])[0]) {
    q = `UPDATE dbo.PermisosRecurso SET ${sets.join(', ')} WHERE Id = @id`
  } else {
    q = `INSERT INTO dbo.PermisosRecurso (${insCols.join(', ')}) VALUES (${insVals.join(', ')})`
  }
  try {
    await req2.query(q)
  } catch (e: any) {
    if (/Violation of UNIQUE KEY constraint|Cannot insert duplicate key/i.test(e?.message || '')) {
      throw new ConflictError('Ya existe un permiso equivalente para este grantee y recurso')
    }
    throw e
  }

  try {
    await logAuditRecord({
      organizationId: actorAuth.organizationId,
      userId: actorAuth.userId,
      action,
      resourceType: 'PERMISO_RECURSO',
      resourceId: id,
      resourceName: `${apiType}:${meta.name}${userId ? `|u:${userId}` : `|r:${roleId}`}`,
      extra: {
        resourceType: apiType,
        resourceId,
        resourceName: meta.name,
        granteeUserId: userId ?? undefined,
        granteeRoleId: roleId ?? undefined,
        bits,
      },
      req: req ?? null,
    })
  } catch {}

  const detail = await getGrantById(pool, actorAuth, id, { skipAdminCheck: true })
  if (!detail) throw new NotFoundError('Permiso no encontrado después de guardar')
  return detail
}

export async function getGrantById(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  actorAuth: AuthWithRoles,
  permId: string,
  opts?: { skipAdminCheck?: boolean }
): Promise<ResourcePermissionGrant | null> {
  const r = await pool.request().input('id', sql.UniqueIdentifier, permId).query(`
    SELECT pr.Id, pr.TipoRecurso, pr.IdRecurso, pr.IdUsuario, pr.IdRol,
           pr.PuedeVer, pr.PuedeDescargar, pr.PuedeComentar, pr.PuedeEditar, pr.PuedeCompartir, pr.PuedeAdministrar,
           pr.FechaCreacion, pr.IdConcedidoPor,
           u.NombreCompleto NombreUsuario, u.Correo CorreoUsuario,
           r.Nombre NombreRol,
           uC.NombreCompleto NombreConcedidoPor,
           uO.IdOrganizacion,
           m.IdOrganizacion OrgRol
    FROM dbo.PermisosRecurso pr
    LEFT JOIN dbo.Usuarios u ON u.Id = pr.IdUsuario
    LEFT JOIN dbo.Roles r ON r.Id = pr.IdRol
    LEFT JOIN dbo.Usuarios uC ON uC.Id = pr.IdConcedidoPor
    LEFT JOIN dbo.Usuarios uO ON uO.Id = pr.IdUsuario
    LEFT JOIN dbo.Roles m ON m.Id = pr.IdRol
    WHERE pr.Id = @id
  `)
  const row = (r.recordset as any[])[0]
  if (!row) return null
  const org = (row?.IdOrganizacion ?? row?.OrgRol) || null
  if (org && org !== actorAuth.organizationId) return null
  const grant = mapGrant(row)
  if (!opts?.skipAdminCheck) {
    const canAdmin = await hasCapabilityOnResource(pool, actorAuth, grant.resourceType, grant.resourceId, 'ADMINISTRAR')
    const canVerPermisos = actorAuth.isOrgAdmin || actorAuth.permissions.has('recursos.permisos.ver' as any) || canAdmin
    if (!canVerPermisos) return null
  }
  return grant
}

export async function updateGrantById(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  actorAuth: AuthWithRoles,
  permId: string,
  patch: UpdateResourcePermissionDto,
  req?: Request
): Promise<ResourcePermissionGrant> {
  const current = await getGrantById(pool, actorAuth, permId)
  if (!current) throw new NotFoundError('Permiso no encontrado')
  const canAdmin = await hasCapabilityOnResource(pool, actorAuth, current.resourceType, current.resourceId, 'ADMINISTRAR')
  const canEditPerms = actorAuth.isOrgAdmin || actorAuth.permissions.has('recursos.permisos.editar' as any)
  if (!canAdmin && !canEditPerms) throw new ForbiddenError('No puedes editar permisos de este recurso')

  const merged: any = {
    ...current,
    ...patch,
  }
  const bits = bitsFromBody(merged)
  await pool.request()
    .input('id', sql.UniqueIdentifier, permId)
    .input('p1', sql.Bit, bits.puedeVer)
    .input('p2', sql.Bit, bits.puedeDescargar)
    .input('p3', sql.Bit, bits.puedeComentar)
    .input('p4', sql.Bit, bits.puedeEditar)
    .input('p5', sql.Bit, bits.puedeCompartir)
    .input('p6', sql.Bit, bits.puedeAdministrar)
    .input('by', sql.UniqueIdentifier, actorAuth.userId)
    .query(`
      UPDATE dbo.PermisosRecurso
      SET PuedeVer=@p1, PuedeDescargar=@p2, PuedeComentar=@p3, PuedeEditar=@p4, PuedeCompartir=@p5, PuedeAdministrar=@p6,
          FechaActualizacion = GETDATE(), IdConcedidoPor = @by
      WHERE Id = @id
    `)

  try {
    const meta = await fetchResourceMeta(pool, current.resourceType, current.resourceId)
    await logAuditRecord({
      organizationId: actorAuth.organizationId,
      userId: actorAuth.userId,
      action: 'permiso.editado',
      resourceType: 'PERMISO_RECURSO',
      resourceId: permId,
      resourceName: meta ? `${current.resourceType}:${meta.name}` : current.id,
      extra: {
        resourceType: current.resourceType,
        resourceId: current.resourceId,
        granteeUserId: current.userId ?? undefined,
        granteeRoleId: current.roleId ?? undefined,
        bits,
        previous: {
          puedeVer: current.puedeVer,
          puedeDescargar: current.puedeDescargar,
          puedeComentar: current.puedeComentar,
          puedeEditar: current.puedeEditar,
          puedeCompartir: current.puedeCompartir,
          puedeAdministrar: current.puedeAdministrar,
        },
      },
      req: req ?? null,
    })
  } catch {}

  const out = await getGrantById(pool, actorAuth, permId, { skipAdminCheck: true })
  if (!out) throw new NotFoundError('Permiso no encontrado tras actualizar')
  return out
}

export async function revokeGrantById(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  actorAuth: AuthWithRoles,
  permId: string,
  req?: Request
): Promise<void> {
  const current = await getGrantById(pool, actorAuth, permId)
  if (!current) return
  const canAdmin = await hasCapabilityOnResource(pool, actorAuth, current.resourceType, current.resourceId, 'ADMINISTRAR')
  const canEditPerms = actorAuth.isOrgAdmin || actorAuth.permissions.has('recursos.permisos.editar' as any)
  if (!canAdmin && !canEditPerms) throw new ForbiddenError('No puedes revocar permisos de este recurso')

  await pool.request().input('id', sql.UniqueIdentifier, permId).query(`DELETE FROM dbo.PermisosRecurso WHERE Id = @id`)

  try {
    const meta = await fetchResourceMeta(pool, current.resourceType, current.resourceId)
    await logAuditRecord({
      organizationId: actorAuth.organizationId,
      userId: actorAuth.userId,
      action: 'permiso.revocado',
      resourceType: 'PERMISO_RECURSO',
      resourceId: permId,
      resourceName: meta ? `${current.resourceType}:${meta.name}` : current.id,
      extra: {
        resourceType: current.resourceType,
        resourceId: current.resourceId,
        granteeUserId: current.userId ?? undefined,
        granteeRoleId: current.roleId ?? undefined,
        bits: {
          puedeVer: current.puedeVer,
          puedeDescargar: current.puedeDescargar,
          puedeComentar: current.puedeComentar,
          puedeEditar: current.puedeEditar,
          puedeCompartir: current.puedeCompartir,
          puedeAdministrar: current.puedeAdministrar,
        },
      },
      req: req ?? null,
    })
  } catch {}
}

export async function syncGrantFromRequestApproval(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  approverAuth: AuthContext,
  resourceTypeRaw: ResourceTypeApi | ResourceTypeDb,
  resourceId: string,
  requesterUserId: string,
  scope: 'view' | 'full' = 'view',
  req?: Request
): Promise<ResourcePermissionGrant | null> {
  try {
    const auth = (await ensureAuthWithRoles(Object.assign({ headers: {}, ip: (req as any)?.ip } as any, { auth: approverAuth }) as any)) as any as AuthWithRoles
    const body = {
      userId: requesterUserId,
      roleId: null,
      puedeVer: true,
      puedeDescargar: scope === 'full' ? true : true,
      puedeComentar: scope === 'full' ? true : true,
      puedeEditar: scope === 'full' ? true : false,
      puedeCompartir: scope === 'full' ? true : false,
      puedeAdministrar: scope === 'full' ? true : false,
    } as CreateResourcePermissionDto
    const grant = await upsertGrant(pool, auth, resourceTypeRaw, resourceId, body, req)
    return grant
  } catch (e) {
    // best-effort: log interno; no propagar para no romper aprobación
    try {
      console.warn('[resource-permissions] syncGrantFromRequestApproval fail:', e instanceof Error ? e.message : String(e))
    } catch {}
    return null
  }
}

export async function ensureActorCanManagePermissions(
  req: Request,
  resourceType: ResourceTypeApi | ResourceTypeDb,
  resourceId: string
): Promise<{ auth: AuthWithRoles; resourceMeta: { id: string; organizationId: string; ownerId: string | null; projectId: string | null } }> {
  const auth = await ensureAuthWithRoles(req)
  const pool = await getDbPool()
  const apiType = normalizeResourceType(resourceType)
  const meta = await fetchResourceMeta(pool, apiType, resourceId)
  if (!meta) throw new NotFoundError('Recurso no encontrado')
  if (meta.organizationId !== auth.organizationId) throw new ForbiddenError('Acceso denegado')
  const canAdmin = await hasCapabilityOnResource(pool, auth, apiType, resourceId, 'ADMINISTRAR', { resourceMeta: meta, req })
  const canEditPerms = auth.isOrgAdmin || auth.permissions.has('recursos.permisos.editar' as any)
  if (!canAdmin && !canEditPerms) throw new ForbiddenError('No puedes gestionar permisos de este recurso')
  return { auth, resourceMeta: meta }
}

type Queryable = {
  request(): import('mssql').Request
}

export async function cleanupGrantsForUserInProject(
  queryable: Queryable,
  projectId: string,
  userId: string
): Promise<number> {
  if (!projectId || !userId) return 0
  const r = queryable.request()
  r.input('pid', sql.UniqueIdentifier, projectId)
  r.input('uid', sql.UniqueIdentifier, userId)
  const res = await r.query<{ rows: number }>(`
    SET NOCOUNT OFF;
    DELETE pr
    FROM dbo.PermisosRecurso pr
    WHERE pr.IdUsuario = @uid
      AND pr.TipoRecurso IN ('PROJECT','CARPETA','ARCHIVO')
      AND (
        (pr.TipoRecurso = 'PROJECT'  AND pr.IdRecurso = @pid)
        OR
        (pr.TipoRecurso = 'CARPETA' AND pr.IdRecurso IN (SELECT c.Id FROM dbo.Carpetas c WHERE c.IdProyecto = @pid))
        OR
        (pr.TipoRecurso = 'ARCHIVO' AND pr.IdRecurso IN (
          SELECT a.Id FROM dbo.Archivos a
            LEFT JOIN dbo.Carpetas c2 ON c2.Id = a.IdCarpeta
           WHERE a.IdProyecto = @pid OR c2.IdProyecto = @pid
        ))
      );
    SELECT @@ROWCOUNT AS rows;
  `)
  return Number(res.recordset?.[0]?.rows ?? 0)
}

export async function cleanupAllGrantsForProjectTree(
  queryable: Queryable,
  projectId: string
): Promise<number> {
  if (!projectId) return 0
  const r = queryable.request()
  r.input('pid', sql.UniqueIdentifier, projectId)
  const res = await r.query<{ rows: number }>(`
    SET NOCOUNT OFF;
    DELETE pr
    FROM dbo.PermisosRecurso pr
    WHERE pr.TipoRecurso IN ('PROJECT','CARPETA','ARCHIVO')
      AND (
        (pr.TipoRecurso = 'PROJECT'  AND pr.IdRecurso = @pid)
        OR
        (pr.TipoRecurso = 'CARPETA' AND pr.IdRecurso IN (SELECT c.Id FROM dbo.Carpetas c WHERE c.IdProyecto = @pid))
        OR
        (pr.TipoRecurso = 'ARCHIVO' AND pr.IdRecurso IN (
          SELECT a.Id FROM dbo.Archivos a
            LEFT JOIN dbo.Carpetas c2 ON c2.Id = a.IdCarpeta
           WHERE a.IdProyecto = @pid OR c2.IdProyecto = @pid
        ))
      );
    SELECT @@ROWCOUNT AS rows;
  `)
  return Number(res.recordset?.[0]?.rows ?? 0)
}
