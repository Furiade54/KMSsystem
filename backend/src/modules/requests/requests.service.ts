import type { Request } from 'express'
import { getDbPool, sql } from '../../shared/db/pool'
import { sqlLocalToIso } from '../../shared/utils/date'
import { logAuditRecord } from '../../shared/db/audit'
import { NotFoundError, ForbiddenError, ConflictError, AppError } from '../../shared/errors/AppError'

export type SolicitudEstado = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
export type TipoRecursoAcceso = 'proyecto' | 'carpeta' | 'archivo'

export interface ApiAccessRequest {
  id: string
  resourceType: TipoRecursoAcceso
  resourceId: string
  resourceName: string | null
  requesterId: string
  requesterName: string | null
  requesterEmail: string | null
  ownerId: string | null
  ownerName: string | null
  ownerEmail: string | null
  message: string | null
  status: SolicitudEstado
  createdAt: string
  resolvedAt: string | null
}

export interface RequesterAuth {
  userId: string
  organizationId: string
  email?: string
  token?: string
}

class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

function estadoValido(s: unknown): s is SolicitudEstado {
  return s === 'PENDIENTE' || s === 'APROBADO' || s === 'RECHAZADO'
}

function tipoValido(t: unknown): t is TipoRecursoAcceso {
  return t === 'proyecto' || t === 'carpeta' || t === 'archivo'
}

async function ownerFromResource(
  resourceType: TipoRecursoAcceso,
  resourceId: string
): Promise<{ ownerId: string | null; resourceName: string | null }> {
  const pool = await getDbPool()
  if (resourceType === 'proyecto') {
    const r = await pool
      .request()
      .input('id', sql.UniqueIdentifier, resourceId)
      .query(`
        SELECT IdPropietario as ownerId, Nombre as resourceName
        FROM Proyectos
        WHERE Id = @id AND ISNULL(Estado,'ACTIVO') <> 'ELIMINADO'
      `)
    return r.recordset[0] ? { ownerId: r.recordset[0].ownerId, resourceName: r.recordset[0].resourceName } : { ownerId: null, resourceName: null }
  }
  if (resourceType === 'carpeta') {
    const r = await pool
      .request()
      .input('id', sql.UniqueIdentifier, resourceId)
      .query(`
        SELECT IdPropietario as ownerId, Nombre as resourceName
        FROM Carpetas
        WHERE Id = @id
      `)
    return r.recordset[0] ? { ownerId: r.recordset[0].ownerId, resourceName: r.recordset[0].resourceName } : { ownerId: null, resourceName: null }
  }
  if (resourceType === 'archivo') {
    const r = await pool
      .request()
      .input('id', sql.UniqueIdentifier, resourceId)
      .query(`
        SELECT IdPropietario as ownerId, Nombre as resourceName
        FROM Archivos
        WHERE Id = @id
      `)
    return r.recordset[0] ? { ownerId: r.recordset[0].ownerId, resourceName: r.recordset[0].resourceName } : { ownerId: null, resourceName: null }
  }
  return { ownerId: null, resourceName: null }
}

function rowToApi(row: any): ApiAccessRequest {
  return {
    id: String(row.Id),
    resourceType: row.TipoRecurso as TipoRecursoAcceso,
    resourceId: String(row.IdRecurso),
    resourceName: row.ResourceName ? String(row.ResourceName) : null,
    requesterId: String(row.IdSolicitante),
    requesterName: row.RequesterName ? String(row.RequesterName) : null,
    requesterEmail: row.RequesterEmail ? String(row.RequesterEmail) : null,
    ownerId: row.IdPropietario ? String(row.IdPropietario) : null,
    ownerName: row.OwnerName ? String(row.OwnerName) : null,
    ownerEmail: row.OwnerEmail ? String(row.OwnerEmail) : null,
    message: row.Mensaje != null ? String(row.Mensaje) : null,
    status: estadoValido(row.Estado) ? row.Estado : 'PENDIENTE',
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    resolvedAt: sqlLocalToIso(row.FechaResolucion as any),
  }
}

const BASE_SELECT = `
SELECT
  s.Id, s.TipoRecurso, s.IdRecurso, s.IdSolicitante, s.IdPropietario,
  s.Mensaje, s.Estado, s.FechaCreacion, s.FechaResolucion,
  req.NombreCompleto as RequesterName, req.Correo as RequesterEmail,
  own.NombreCompleto as OwnerName, own.Correo as OwnerEmail,
  CASE
    WHEN s.TipoRecurso = 'proyecto' THEN p.Nombre
    WHEN s.TipoRecurso = 'carpeta'  THEN c.Nombre
    WHEN s.TipoRecurso = 'archivo'  THEN a.Nombre
    ELSE NULL
  END as ResourceName
FROM SolicitudesAcceso s
INNER JOIN Usuarios req ON req.Id = s.IdSolicitante
LEFT JOIN  Usuarios own ON own.Id = s.IdPropietario
LEFT JOIN  Proyectos p ON p.Id = s.IdRecurso AND s.TipoRecurso = 'proyecto' AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
LEFT JOIN  Carpetas  c ON c.Id = s.IdRecurso AND s.TipoRecurso = 'carpeta'
LEFT JOIN  Archivos  a ON a.Id = s.IdRecurso AND s.TipoRecurso = 'archivo'
`

export async function listMyRequests(
  auth: RequesterAuth,
  opts: { scope: 'received' | 'sent' | 'all'; status?: SolicitudEstado | null; page?: number; pageSize?: number }
): Promise<{ items: ApiAccessRequest[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const { scope, status = null, page = 1, pageSize = 20 } = opts
  if (page < 1) throw new BadRequestError('page debe ser >= 1')
  if (pageSize < 1 || pageSize > 100) throw new BadRequestError('pageSize debe ser 1..100')
  const pool = await getDbPool()

  const where: string[] = []
  const req = pool.request()
  if (scope === 'received') {
    where.push('s.IdPropietario = @uid')
    req.input('uid', sql.UniqueIdentifier, auth.userId)
  } else if (scope === 'sent') {
    where.push('s.IdSolicitante = @uid')
    req.input('uid', sql.UniqueIdentifier, auth.userId)
  } else {
    where.push('(s.IdSolicitante = @uid OR s.IdPropietario = @uid)')
    req.input('uid', sql.UniqueIdentifier, auth.userId)
  }
  if (status) {
    where.push('s.Estado = @st')
    req.input('st', sql.VarChar(20), status)
  }
  where.push('(req.IdOrganizacion IS NULL OR req.IdOrganizacion = @org)')
  req.input('org', sql.UniqueIdentifier, auth.organizationId)

  const sqlWhere = 'WHERE ' + where.join(' AND ')
  const totalQ = `SELECT COUNT_BIG(1) as c FROM SolicitudesAcceso s INNER JOIN Usuarios req ON req.Id = s.IdSolicitante ${sqlWhere}`
  let totalRow: any = null
  try {
    totalRow = (await req.query(totalQ)).recordset[0]
  } catch (sqlerr: any) {
    throw sqlerr
  }
  const total = Number(totalRow?.c ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const offset = (page - 1) * pageSize
  const rowsQ = `
    ${BASE_SELECT}
    ${sqlWhere}
    ORDER BY s.FechaCreacion DESC
    OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
  `
  const req2 = pool.request()
  if (scope !== 'all') req2.input('uid', sql.UniqueIdentifier, auth.userId)
  if (status) req2.input('st', sql.VarChar(20), status)
  req2.input('org', sql.UniqueIdentifier, auth.organizationId)
  let rows: any[] = []
  try {
    rows = (await req2.query(rowsQ)).recordset
  } catch (sqlerr: any) {
    throw sqlerr
  }
  const items: ApiAccessRequest[] = rows.map(rowToApi)
  return { items, total, page, pageSize, totalPages }
}

export async function pendingCount(auth: RequesterAuth): Promise<{ pendingReceived: number; pendingSent: number; totalPending: number }> {
  const pool = await getDbPool()
  const uid = auth.userId
  const org = auth.organizationId
  const req = pool.request()
  req.input('uid', sql.UniqueIdentifier, uid)
  req.input('org', sql.UniqueIdentifier, org)
  const q = `
    SELECT
      (SELECT COUNT_BIG(1) FROM SolicitudesAcceso s INNER JOIN Usuarios u ON u.Id = s.IdSolicitante WHERE s.IdPropietario = @uid AND s.Estado = 'PENDIENTE' AND (u.IdOrganizacion IS NULL OR u.IdOrganizacion = @org)) as rc,
      (SELECT COUNT_BIG(1) FROM SolicitudesAcceso s INNER JOIN Usuarios u ON u.Id = s.IdPropietario  WHERE s.IdSolicitante  = @uid AND s.Estado = 'PENDIENTE' AND (u.IdOrganizacion IS NULL OR u.IdOrganizacion = @org)) as sc
  `
  try {
    const r = (await req.query(q)).recordset[0]
    const pendingReceived = Number(r?.rc ?? 0)
    const pendingSent = Number(r?.sc ?? 0)
    return { pendingReceived, pendingSent, totalPending: pendingReceived + pendingSent }
  } catch (sqlerr: any) {
    throw sqlerr
  }
}

export async function createRequest(
  auth: RequesterAuth,
  body: { resourceType: unknown; resourceId: unknown; message?: unknown },
  opts?: { req?: Request | null }
): Promise<ApiAccessRequest> {
  const resourceType = String(body.resourceType || '').trim()
  const resourceId = String(body.resourceId || '').trim()
  const message = body.message != null ? String(body.message).slice(0, 2000) : null

  if (!tipoValido(resourceType)) throw new BadRequestError('TipoRecurso debe ser: proyecto | carpeta | archivo')
  if (!resourceId) throw new BadRequestError('IdRecurso requerido')

  const { ownerId, resourceName } = await ownerFromResource(resourceType, resourceId)
  if (!ownerId) throw new NotFoundError('No se encontró el recurso (o fue eliminado)')
  if (ownerId === auth.userId) throw new ConflictError('No puedes solicitar acceso a tu propio recurso')

  const pool = await getDbPool()
  const prev = await pool
    .request()
    .input('rt', sql.VarChar(20), resourceType)
    .input('rid', sql.UniqueIdentifier, resourceId)
    .input('uid', sql.UniqueIdentifier, auth.userId)
    .query(`
      SELECT TOP 1 Id, Estado FROM SolicitudesAcceso
      WHERE TipoRecurso = @rt AND IdRecurso = @rid AND IdSolicitante = @uid
      ORDER BY FechaCreacion DESC
    `)
  if (prev.recordset.length && prev.recordset[0].Estado === 'PENDIENTE') {
    throw new ConflictError('Ya tienes una solicitud pendiente para este recurso')
  }

  const ins = await pool
    .request()
    .input('rt', sql.VarChar(20), resourceType)
    .input('rid', sql.UniqueIdentifier, resourceId)
    .input('sid', sql.UniqueIdentifier, auth.userId)
    .input('oid', sql.UniqueIdentifier, ownerId)
    .input('msg', sql.NVarChar(sql.MAX), message)
    .query(`
      INSERT INTO SolicitudesAcceso (TipoRecurso, IdRecurso, IdSolicitante, IdPropietario, Mensaje, Estado, FechaCreacion)
      OUTPUT INSERTED.Id, INSERTED.FechaCreacion
      VALUES (@rt, @rid, @sid, @oid, @msg, 'PENDIENTE', GETDATE())
    `)
  const id = String(ins.recordset[0].Id)
  const createdAt = sqlLocalToIso(ins.recordset[0].FechaCreacion)

  try {
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'solicitud.creada',
      resourceType,
      resourceId,
      resourceName: resourceName ?? null,
      extra: { ownerId, message: message ?? null },
      req: opts?.req ?? null,
    })
  } catch { /* ignore audit */ }

  return {
    id,
    resourceType,
    resourceId,
    resourceName,
    requesterId: auth.userId,
    requesterName: null,
    requesterEmail: null,
    ownerId,
    ownerName: null,
    ownerEmail: null,
    message,
    status: 'PENDIENTE',
    createdAt,
    resolvedAt: null,
  }
}

export async function resolveRequest(
  auth: RequesterAuth,
  id: string,
  decision: 'APROBADO' | 'RECHAZADO',
  opts?: { req?: Request | null; permissionScope?: 'view' | 'full' }
): Promise<ApiAccessRequest> {
  if (!decision || (decision !== 'APROBADO' && decision !== 'RECHAZADO')) {
    throw new BadRequestError('Decisión debe ser APROBADO o RECHAZADO')
  }
  const pool = await getDbPool()
  const rowQ = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`
      ${BASE_SELECT}
      WHERE s.Id = @id
    `)
  if (!rowQ.recordset.length) throw new NotFoundError('Solicitud no encontrada')
  const current = rowToApi(rowQ.recordset[0])

  if (current.ownerId !== auth.userId) throw new ForbiddenError('Solo el propietario del recurso puede resolver esta solicitud')
  if (current.status !== 'PENDIENTE') throw new ConflictError(`La solicitud ya fue ${current.status === 'APROBADO' ? 'aprobada' : 'rechazada'}`)

  await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('dec', sql.VarChar(20), decision)
    .query(`UPDATE SolicitudesAcceso SET Estado = @dec, FechaResolucion = GETDATE() WHERE Id = @id`)

  if (decision === 'APROBADO') {
    try {
      const perm = opts?.permissionScope === 'full' ? 'full' : 'view'
      const adminBit = perm === 'full' ? 1 : 0
      const sets = perm === 'full'
        ? 'PuedeVer=1, PuedeDescargar=1, PuedeComentar=1, PuedeEditar=1, PuedeCompartir=1, PuedeAdministrar=@adm'
        : 'PuedeVer=1, PuedeDescargar=1, PuedeComentar=1, PuedeAdministrar=PuedeAdministrar'
      const upd = await pool
        .request()
        .input('tr', sql.VarChar(20), current.resourceType)
        .input('rid', sql.UniqueIdentifier, current.resourceId)
        .input('uid', sql.UniqueIdentifier, current.requesterId)
        .input('adm', sql.Bit, adminBit)
        .query(`
          IF EXISTS (SELECT 1 FROM PermisosRecurso WHERE TipoRecurso = @tr AND IdRecurso = @rid AND IdUsuario = @uid)
            UPDATE PermisosRecurso SET ${sets} WHERE TipoRecurso = @tr AND IdRecurso = @rid AND IdUsuario = @uid
          ELSE
            INSERT INTO PermisosRecurso (TipoRecurso, IdRecurso, IdUsuario, PuedeVer, PuedeDescargar, PuedeComentar, PuedeEditar, PuedeCompartir, PuedeAdministrar)
            VALUES (@tr, @rid, @uid, 1, 1, 1, ${perm === 'full' ? 1 : 0}, ${perm === 'full' ? 1 : 0}, ${adminBit})
        `)
      void upd
    } catch { /* ignore perms best-effort */ }
  }

  try {
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: decision === 'APROBADO' ? 'solicitud.aprobada' : 'solicitud.rechazada',
      resourceType: current.resourceType,
      resourceId: current.resourceId,
      resourceName: current.resourceName ?? null,
      extra: { requesterId: current.requesterId, decision },
      req: opts?.req ?? null,
    })
  } catch { /* ignore audit */ }

  const final = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`${BASE_SELECT} WHERE s.Id = @id`)
  return rowToApi(final.recordset[0])
}
