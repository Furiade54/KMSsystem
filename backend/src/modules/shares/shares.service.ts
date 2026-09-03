import crypto from 'node:crypto'
import type { ConnectionPool, IRecordSet } from 'mssql'
import { sql } from '../../shared/db/pool'
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError'

export type TipoRecursoCompartido = 'ARCHIVO' | 'PROYECTO' | 'CARPETA'
export const TIPOS_RECURSO: readonly TipoRecursoCompartido[] = ['ARCHIVO', 'PROYECTO', 'CARPETA'] as const

export interface Shared {
  id: string
  resourceType: TipoRecursoCompartido
  resourceId: string
  sharedById: string
  targetUserId?: string | null
  accessToken?: string | null
  password?: string | null
  expiresAt?: string | null
  visits: number
  createdAt: string
}

function mapShared(r: any): Shared {
  return {
    id: String(r.Id),
    resourceType: String(r.TipoRecurso) as TipoRecursoCompartido,
    resourceId: String(r.IdRecurso),
    sharedById: String(r.IdComparte),
    targetUserId: r.IdUsuarioDestino ? String(r.IdUsuarioDestino) : null,
    accessToken: r.TokenAcceso ?? null,
    password: r.Contrasena ? (typeof r.Contrasena === 'string' ? '***' : null) : null,
    expiresAt: r.FechaVencimiento ? (r.FechaVencimiento.toISOString?.() ?? new Date(r.FechaVencimiento).toISOString()) : null,
    visits: Number(r.Visitas ?? 0),
    createdAt: r.FechaComparticion ? (r.FechaComparticion.toISOString?.() ?? new Date(r.FechaComparticion).toISOString()) : new Date().toISOString(),
  }
}

async function fileExistsInOrg(pool: ConnectionPool, organizationId: string, fileId: string): Promise<{ exists: boolean; projectId: string | null; name: string | null }> {
  const q = `SELECT a.IdProyecto, a.Nombre
             FROM dbo.Archivos a
             INNER JOIN dbo.Proyectos p ON p.Id = a.IdProyecto
             WHERE a.Id = @id AND p.IdOrganizacion = @org`
  const { recordset } = await pool
    .request()
    .input('id', sql.UniqueIdentifier, fileId)
    .input('org', sql.UniqueIdentifier, organizationId)
    .query(q)
  if (recordset.length === 0) return { exists: false, projectId: null, name: null }
  return {
    exists: true,
    projectId: recordset[0].IdProyecto ? String(recordset[0].IdProyecto) : null,
    name: recordset[0].Nombre ? String(recordset[0].Nombre) : null,
  }
}

async function isResourceOwner(pool: ConnectionPool, organizationId: string, sharedById: string, resourceType: TipoRecursoCompartido, resourceId: string): Promise<boolean> {
  let q = ''
  if (resourceType === 'ARCHIVO') {
    q = `SELECT 1 FROM dbo.Archivos a
         INNER JOIN dbo.Proyectos p ON p.Id = a.IdProyecto
         WHERE a.Id = @rid AND p.IdOrganizacion = @org AND (a.IdPropietario = @uid OR p.IdPropietario = @uid)`
  } else if (resourceType === 'PROYECTO') {
    q = `SELECT 1 FROM dbo.Proyectos p WHERE p.Id = @rid AND p.IdOrganizacion = @org AND p.IdPropietario = @uid`
  } else if (resourceType === 'CARPETA') {
    q = `SELECT 1 FROM dbo.Carpetas c
         INNER JOIN dbo.Proyectos p ON p.Id = c.IdProyecto
         WHERE c.Id = @rid AND p.IdOrganizacion = @org AND (c.IdPropietario = @uid OR p.IdPropietario = @uid)`
  }
  const { recordset } = await pool
    .request()
    .input('rid', sql.UniqueIdentifier, resourceId)
    .input('org', sql.UniqueIdentifier, organizationId)
    .input('uid', sql.UniqueIdentifier, sharedById)
    .query(q)
  return (recordset as any[]).length > 0
}

export async function createShared(pool: ConnectionPool, data: {
  organizationId: string
  sharedById: string
  resourceType: TipoRecursoCompartido
  resourceId: string
  targetUserId?: string | null
  password?: string | null
  expiresAt?: string | null
  createPublicLink?: boolean
}): Promise<Shared> {
  if (!TIPOS_RECURSO.includes(data.resourceType as any)) throw new BadRequestError('TipoRecurso inválido')
  const owner = await isResourceOwner(pool, data.organizationId, data.sharedById, data.resourceType, data.resourceId)
  if (!owner) throw new ForbiddenError('Solo el propietario del recurso puede compartirlo')
  if (data.targetUserId && data.targetUserId.trim() === '') data.targetUserId = null
  if (data.resourceType === 'ARCHIVO') {
    const f = await fileExistsInOrg(pool, data.organizationId, data.resourceId)
    if (!f.exists) throw new NotFoundError('Archivo no existe')
  }
  const token = data.createPublicLink === false && !data.targetUserId ? null : (
    data.createPublicLink || !data.targetUserId ? crypto.randomBytes(24).toString('base64url') : null
  )
  const passwordHash = data.password && String(data.password).trim().length > 0
    ? crypto.createHash('sha256').update(String(data.password)).digest('hex')
    : null
  const id = crypto.randomUUID()
  await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('tipo', sql.VarChar(20), data.resourceType)
    .input('rid', sql.UniqueIdentifier, data.resourceId)
    .input('uid', sql.UniqueIdentifier, data.sharedById)
    .input('tuid', sql.UniqueIdentifier, data.targetUserId ?? null)
    .input('token', sql.VarChar(128), token)
    .input('pwd', sql.VarChar(256), passwordHash)
    .input('exp', sql.DateTime2, data.expiresAt ? new Date(data.expiresAt) : null)
    .query(
      `INSERT INTO dbo.Compartidos (Id, TipoRecurso, IdRecurso, IdComparte, IdUsuarioDestino, TokenAcceso, Contrasena, FechaVencimiento)
       VALUES (@id, @tipo, @rid, @uid, @tuid, @token, @pwd, @exp)`
    )
  return await getSharedById(pool, data.organizationId, id)
}

export async function getSharedById(pool: ConnectionPool, organizationId: string, id: string): Promise<Shared> {
  const req = pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('org', sql.UniqueIdentifier, organizationId)
  const { recordset } = await req.query(
    `SELECT c.*
       FROM dbo.Compartidos c
       WHERE c.Id = @id
         AND EXISTS (SELECT 1 FROM dbo.Usuarios u WHERE u.Id = c.IdComparte AND u.IdOrganizacion = @org)`
  )
  if (recordset.length === 0) throw new NotFoundError('Enlace no encontrado')
  return mapShared((recordset as IRecordSet<any>)[0] as any)
}

export async function listSharedByUser(pool: ConnectionPool, organizationId: string, userId: string, opts?: { resourceType?: TipoRecursoCompartido }): Promise<Shared[]> {
  const req = pool
    .request()
    .input('org', sql.UniqueIdentifier, organizationId)
    .input('uid', sql.UniqueIdentifier, userId)
  let where = `(c.IdComparte = @uid OR c.IdUsuarioDestino = @uid) AND EXISTS (SELECT 1 FROM dbo.Usuarios u WHERE u.Id = c.IdComparte AND u.IdOrganizacion = @org)`
  if (opts?.resourceType) {
    req.input('tipo', sql.VarChar(20), opts.resourceType)
    where += ' AND c.TipoRecurso = @tipo'
  }
  const q = `SELECT c.* FROM dbo.Compartidos c WHERE ${where} ORDER BY c.FechaComparticion DESC`
  const { recordset } = await req.query(q)
  return (recordset as any[]).map(mapShared)
}

export async function deleteShared(pool: ConnectionPool, organizationId: string, userId: string, id: string, isOrgAdmin?: boolean): Promise<void> {
  const s = await getSharedById(pool, organizationId, id)
  if (s.sharedById !== userId && !isOrgAdmin) throw new ForbiddenError('No puedes eliminar este enlace')
  await pool.request().input('id', sql.UniqueIdentifier, id).query(`DELETE FROM dbo.Compartidos WHERE Id = @id`)
}

export interface PublicAccessResult {
  ok: boolean
  reason?: 'not_found' | 'expired' | 'bad_password' | 'ok'
  share?: Shared
  fileInfo?: { id: string; name: string | null; projectId: string | null }
}

export async function publicAccessShared(pool: ConnectionPool, token: string, opts?: { password?: string | null }): Promise<PublicAccessResult> {
  const { recordset } = await pool
    .request()
    .input('token', sql.VarChar(128), token)
    .query(`SELECT c.* FROM dbo.Compartidos c WHERE c.TokenAcceso = @token`)
  if (recordset.length === 0) return { ok: false, reason: 'not_found' }
  const row = (recordset as any[])[0]
  const share = mapShared(row)
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'expired', share }
  }
  if (typeof row.Contrasena === 'string' && row.Contrasena.length > 0) {
    const pwd = String(opts?.password ?? '')
    if (!pwd) return { ok: false, reason: 'bad_password', share }
    if (crypto.createHash('sha256').update(pwd).digest('hex') !== String(row.Contrasena)) {
      return { ok: false, reason: 'bad_password', share }
    }
  }
  // Registrar visita
  await pool.request().input('id', sql.UniqueIdentifier, share.id).query(`UPDATE dbo.Compartidos SET Visitas = ISNULL(Visitas,0)+1 WHERE Id = @id`)
  let fileInfo: PublicAccessResult['fileInfo'] = undefined
  if (share.resourceType === 'ARCHIVO') {
    const q = `SELECT Id, IdProyecto, Nombre FROM dbo.Archivos WHERE Id = @id`
    const { recordset: rs } = await pool.request().input('id', sql.UniqueIdentifier, share.resourceId).query(q)
    if (rs.length > 0) fileInfo = {
      id: String(rs[0].Id),
      name: rs[0].Nombre ? String(rs[0].Nombre) : null,
      projectId: rs[0].IdProyecto ? String(rs[0].IdProyecto) : null,
    }
  }
  return { ok: true, reason: 'ok', share, fileInfo }
}
