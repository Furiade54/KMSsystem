import type { ConnectionPool, IRecordSet } from 'mssql'
import { sql } from '../../shared/db/pool'
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError'

export type RevisionEstado = 'BORRADOR' | 'ASIGNADA' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA'
export const REVISION_ESTADOS: readonly RevisionEstado[] = [
  'BORRADOR', 'ASIGNADA', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA',
] as const

export interface Revision {
  id: string
  resourceId: string
  resourceType: 'ARCHIVO' | string
  requesterId: string
  reviewerId: string
  status: RevisionEstado
  comments?: string | null
  deadlineAt?: string | null
  createdAt: string
  resolvedAt?: string | null
}

function mapRevision(row: any): Revision {
  return {
    id: String(row.Id),
    resourceId: String(row.IdRecurso),
    resourceType: String(row.TipoRecurso || 'ARCHIVO'),
    requesterId: String(row.IdSolicitante),
    reviewerId: String(row.IdRevisor),
    status: String(row.Estado) as RevisionEstado,
    comments: row.Comentarios ?? null,
    deadlineAt: row.FechaLimite
      ? row.FechaLimite.toISOString?.() ?? new Date(row.FechaLimite).toISOString()
      : null,
    createdAt: row.FechaCreacion?.toISOString?.() ?? new Date(row.FechaCreacion).toISOString(),
    resolvedAt: row.FechaResolucion
      ? row.FechaResolucion.toISOString?.() ?? new Date(row.FechaResolucion).toISOString()
      : null,
  }
}

async function userExists(pool: ConnectionPool, organizationId: string, userId: string): Promise<boolean> {
  const { recordset } = await pool
    .request()
    .input('org', sql.UniqueIdentifier, organizationId)
    .input('uid', sql.UniqueIdentifier, userId)
    .query(`SELECT Id FROM dbo.Usuarios WHERE Id = @uid AND IdOrganizacion = @org AND Estado = 'ACTIVO'`)
  return recordset.length > 0
}

export interface RevisionFilter {
  organizationId: string
  forUserId?: string | null
  status?: RevisionEstado | null
  resourceId?: string | null
  page?: number
  pageSize?: number
}

export async function listRevisions(pool: ConnectionPool, f: RevisionFilter): Promise<{
  items: Revision[]; total: number; page: number; pageSize: number
}> {
  const page = Math.max(1, f.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25))
  const req = pool.request()
    .input('org', sql.UniqueIdentifier, f.organizationId)
  const where: string[] = [
    `(EXISTS (SELECT 1 FROM dbo.Usuarios u WHERE u.Id = r.IdSolicitante AND u.IdOrganizacion = @org))`
  ]
  if (f.forUserId) {
    req.input('uid', sql.UniqueIdentifier, f.forUserId)
    where.push(`(r.IdSolicitante = @uid OR r.IdRevisor = @uid)`)
  }
  if (f.status) {
    req.input('st', sql.VarChar(30), f.status)
    where.push(`r.Estado = @st`)
  }
  if (f.resourceId) {
    req.input('rid', sql.UniqueIdentifier, f.resourceId)
    where.push(`r.IdRecurso = @rid`)
  }
  const whereSQL = where.join(' AND ')
  const qCount = `SELECT COUNT_BIG(*) AS N FROM dbo.Revisiones r WHERE ${whereSQL}`
  const { recordset: c } = await req.query(qCount)
  const total = Number((c as IRecordSet<any>)[0].N ?? 0)
  const q = `
    SELECT r.*
    FROM dbo.Revisiones r
    WHERE ${whereSQL}
    ORDER BY r.FechaCreacion DESC
    OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY`
  const { recordset } = await req.query(q)
  return {
    items: (recordset as IRecordSet<any>).map(mapRevision),
    total, page, pageSize,
  }
}

export async function getRevisionById(pool: ConnectionPool, organizationId: string, id: string): Promise<Revision> {
  const { recordset } = await pool.request()
    .input('org', sql.UniqueIdentifier, organizationId)
    .input('id', sql.UniqueIdentifier, id)
    .query(
      `SELECT r.*
       FROM dbo.Revisiones r
       WHERE r.Id = @id
         AND EXISTS (SELECT 1 FROM dbo.Usuarios u WHERE u.Id = r.IdSolicitante AND u.IdOrganizacion = @org)`
    )
  if (recordset.length === 0) throw new NotFoundError('Revisión no encontrada')
  return mapRevision((recordset as IRecordSet<any>)[0])
}

export async function createRevision(pool: ConnectionPool, data: {
  organizationId: string
  requesterId: string
  reviewerId: string
  resourceId: string
  resourceType?: string
  comments?: string | null
  deadlineAt?: string | null
  status?: RevisionEstado
}): Promise<Revision> {
  if (!data.reviewerId) throw new BadRequestError('revisorId es requerido')
  if (!data.resourceId) throw new BadRequestError('resourceId es requerido')
  if (!(await userExists(pool, data.organizationId, data.reviewerId)))
    throw new BadRequestError('Revisor no existe en la organización')
  if (!(await userExists(pool, data.organizationId, data.requesterId)))
    throw new BadRequestError('Solicitante inválido')
  const status: RevisionEstado = data.status ?? 'ASIGNADA'
  if (!REVISION_ESTADOS.includes(status)) throw new BadRequestError('Estado inválido')
  const id = crypto.randomUUID()
  await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('recurso', sql.UniqueIdentifier, data.resourceId)
    .input('tipo', sql.VarChar(20), data.resourceType ?? 'ARCHIVO')
    .input('req', sql.UniqueIdentifier, data.requesterId)
    .input('rev', sql.UniqueIdentifier, data.reviewerId)
    .input('st', sql.VarChar(30), status)
    .input('cmt', sql.NVarChar(Number.MAX_SAFE_INTEGER), data.comments ?? null)
    .input('dl', sql.DateTime2, data.deadlineAt ? new Date(data.deadlineAt) : null)
    .query(
      `INSERT INTO dbo.Revisiones (Id, IdRecurso, TipoRecurso, IdSolicitante, IdRevisor, Estado, Comentarios, FechaLimite)
       VALUES (@id, @recurso, @tipo, @req, @rev, @st, @cmt, @dl)`
    )
  return getRevisionById(pool, data.organizationId, id)
}

export async function updateRevisionStatus(pool: ConnectionPool, data: {
  organizationId: string
  revisionId: string
  status: RevisionEstado
  comments?: string | null
}): Promise<Revision> {
  const rev = await getRevisionById(pool, data.organizationId, data.revisionId)
  if (!REVISION_ESTADOS.includes(data.status)) throw new BadRequestError('Estado inválido')
  const finaliza = ['APROBADA', 'RECHAZADA', 'CANCELADA'].includes(data.status)
  await pool.request()
    .input('id', sql.UniqueIdentifier, data.revisionId)
    .input('st', sql.VarChar(30), data.status)
    .input('cmt', sql.NVarChar(Number.MAX_SAFE_INTEGER), data.comments ?? rev.comments)
    .input('res', sql.DateTime2, finaliza ? new Date() : null)
    .query(
      `UPDATE dbo.Revisiones SET Estado = @st,
         Comentarios = ISNULL(@cmt, Comentarios),
         FechaResolucion = CASE WHEN @st IN ('APROBADA','RECHAZADA','CANCELADA') THEN ISNULL(@res, FechaResolucion) ELSE FechaResolucion END,
         FechaActualizacion = SYSUTCDATETIME()
       WHERE Id = @id`)
  return getRevisionById(pool, data.organizationId, data.revisionId)
}

export async function assignRevision(pool: ConnectionPool, data: {
  organizationId: string
  revisionId: string
  reviewerId: string
  deadlineAt?: string | null
  comments?: string | null
}): Promise<Revision> {
  await getRevisionById(pool, data.organizationId, data.revisionId)
  if (!(await userExists(pool, data.organizationId, data.reviewerId)))
    throw new BadRequestError('Revisor no existe en la organización')
  await pool.request()
    .input('id', sql.UniqueIdentifier, data.revisionId)
    .input('rev', sql.UniqueIdentifier, data.reviewerId)
    .input('st', sql.VarChar(30), 'ASIGNADA')
    .input('cmt', sql.NVarChar(Number.MAX_SAFE_INTEGER), data.comments ?? null)
    .input('dl', sql.DateTime2, data.deadlineAt ? new Date(data.deadlineAt) : null)
    .query(
      `UPDATE dbo.Revisiones SET IdRevisor = @rev, Estado = @st,
         Comentarios = ISNULL(@cmt, Comentarios),
         FechaLimite = ISNULL(@dl, FechaLimite)
       WHERE Id = @id`)
  return getRevisionById(pool, data.organizationId, data.revisionId)
}
