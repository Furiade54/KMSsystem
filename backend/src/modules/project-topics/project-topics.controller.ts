import type { NextFunction, Request, Response } from 'express'
import type { ApiResponse, PaginatedResult, ProjectTopic, TopicStatus } from '../../../../packages/shared-types/src'
import { DB_TOPIC_STATUS } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { logAuditRecord } from '../../shared/db/audit'
import { AppError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

type TopicRow = {
  Id: string
  IdProyecto: string
  Titulo: string
  IdCreador: string | null
  Estado: string
  FechaCreacion: Date
  FechaActualizacion: Date | null
}

const DB_TO_API_STATUS: Record<string, TopicStatus> = DB_TOPIC_STATUS

const API_TO_DB_STATUS: Record<TopicStatus, keyof typeof DB_TOPIC_STATUS> = {
  OPEN: 'ABIERTO',
  IN_REVIEW: 'EN_REVISION',
  RESOLVED: 'RESUELTO',
  CLOSED: 'CERRADO',
  IN_PROGRESS: 'EN_PROGRESO',
}

function mapTopic(row: TopicRow): ProjectTopic {
  const rawStatus = String(row.Estado || '').toUpperCase()
  return {
    id: String(row.Id),
    projectId: String(row.IdProyecto),
    title: String(row.Titulo),
    createdBy: row.IdCreador ? String(row.IdCreador) : null,
    status: DB_TO_API_STATUS[rawStatus] ?? 'OPEN',
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
  }
}

function parseOptionalTopicStatus(value: unknown): keyof typeof DB_TOPIC_STATUS | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const raw = String(value).trim().toUpperCase()
  if ((raw as keyof typeof DB_TOPIC_STATUS) in DB_TOPIC_STATUS) {
    return raw as keyof typeof DB_TOPIC_STATUS
  }
  if ((raw as TopicStatus) in API_TO_DB_STATUS) {
    return API_TO_DB_STATUS[raw as TopicStatus]
  }
  throw new AppError('Estado de tema inválido', 400)
}

async function getTopicRowOrThrow(
  projectId: string,
  topicId: string,
  organizationId: string
): Promise<TopicRow> {
  const pool = await getDbPool()
  const q = pool.request()
  q.input('projectId', sql.UniqueIdentifier, projectId)
  q.input('topicId', sql.UniqueIdentifier, topicId)
  q.input('orgId', sql.UniqueIdentifier, organizationId)
  const r = await q.query<TopicRow>(`
    SELECT
      t.Id, t.IdProyecto, t.Titulo, t.IdCreador, t.Estado, t.FechaCreacion, t.FechaActualizacion
    FROM dbo.TemasProyecto t
    INNER JOIN dbo.Proyectos p ON p.Id = t.IdProyecto
    WHERE t.Id = @topicId
      AND t.IdProyecto = @projectId
      AND p.IdOrganizacion = @orgId
      AND ISNULL(p.Estado, 'ACTIVO') <> 'ELIMINADO';
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Tema no encontrado')
  return row
}

export async function listTopics(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<ProjectTopic>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    if (!projectId) throw new AppError('projectId es requerido', 400)

    const page = Math.max(1, Number(req.query.page || '1'))
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || '20')))
    const search = req.query.search ? String(req.query.search).trim() : ''
    const status = parseOptionalTopicStatus(req.query.status)

    const pool = await getDbPool()
    const countReq = pool.request()
    const dataReq = pool.request()
    countReq.input('projectId', sql.UniqueIdentifier, projectId)
    countReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    dataReq.input('projectId', sql.UniqueIdentifier, projectId)
    dataReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)

    let where = `
      t.IdProyecto = @projectId
      AND p.IdOrganizacion = @orgId
      AND ISNULL(p.Estado, 'ACTIVO') <> 'ELIMINADO'
    `

    if (search) {
      countReq.input('search', sql.NVarChar(255), `%${search}%`)
      dataReq.input('search', sql.NVarChar(255), `%${search}%`)
      where += ` AND t.Titulo LIKE @search`
    }

    if (status) {
      countReq.input('status', sql.VarChar(30), status)
      dataReq.input('status', sql.VarChar(30), status)
      where += ` AND t.Estado = @status`
    }

    const countResult = await countReq.query<{ total: number }>(`
      SELECT COUNT(*) total
      FROM dbo.TemasProyecto t
      INNER JOIN dbo.Proyectos p ON p.Id = t.IdProyecto
      WHERE ${where};
    `)
    const total = Number(countResult.recordset[0]?.total ?? 0)
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const dataResult = await dataReq.query<TopicRow>(`
      SELECT
        t.Id, t.IdProyecto, t.Titulo, t.IdCreador, t.Estado, t.FechaCreacion, t.FechaActualizacion
      FROM dbo.TemasProyecto t
      INNER JOIN dbo.Proyectos p ON p.Id = t.IdProyecto
      WHERE ${where}
      ORDER BY t.FechaActualizacion DESC, t.FechaCreacion DESC
      OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `)

    res.status(200).json({
      success: true,
      data: {
        items: dataResult.recordset.map(mapTopic),
        total,
        page,
        pageSize,
        totalPages,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function getTopic(
  req: Request,
  res: Response<ApiResponse<ProjectTopic>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const row = await getTopicRowOrThrow(
      String(req.params.projectId || ''),
      String(req.params.topicId || ''),
      auth.organizationId
    )
    res.status(200).json({ success: true, data: mapTopic(row) })
  } catch (err) {
    next(err)
  }
}

export async function createTopic(
  req: Request,
  res: Response<ApiResponse<ProjectTopic>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    if (!projectId) throw new AppError('projectId es requerido', 400)

    const title = String(req.body?.title || '').trim()
    if (title.length < 1 || title.length > 255) {
      throw new AppError('Título inválido (1..255)', 400)
    }

    const status = parseOptionalTopicStatus(req.body?.status) ?? 'ABIERTO'

    const pool = await getDbPool()
    const ins = pool.request()
    ins.input('projectId', sql.UniqueIdentifier, projectId)
    ins.input('title', sql.NVarChar(255), title)
    ins.input('createdBy', sql.UniqueIdentifier, auth.userId)
    ins.input('status', sql.VarChar(30), status)
    const created = await ins.query<{ Id: string }>(`
      INSERT INTO dbo.TemasProyecto (
        IdProyecto, Titulo, IdCreador, Estado, FechaCreacion, FechaActualizacion
      )
      OUTPUT INSERTED.Id
      VALUES (
        @projectId, @title, @createdBy, @status, GETDATE(), GETDATE()
      );
    `)
    const topicId = String(created.recordset[0]?.Id || '')
    if (!topicId) throw new AppError('No se pudo crear el tema', 500)

    const row = await getTopicRowOrThrow(projectId, topicId, auth.organizationId)
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic.creado',
      resourceType: 'topic',
      resourceId: topicId,
      resourceName: title,
      extra: { projectId },
      req,
    })
    res.status(201).json({ success: true, data: mapTopic(row) })
  } catch (err) {
    next(err)
  }
}

export async function updateTopic(
  req: Request,
  res: Response<ApiResponse<ProjectTopic>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const current = await getTopicRowOrThrow(projectId, topicId, auth.organizationId)

    const patchTitle = req.body?.title !== undefined ? String(req.body.title || '').trim() : undefined
    const patchStatus = parseOptionalTopicStatus(req.body?.status)

    if (patchTitle !== undefined && (patchTitle.length < 1 || patchTitle.length > 255)) {
      throw new AppError('Título inválido (1..255)', 400)
    }

    const sets: string[] = []
    const up = (await getDbPool()).request()
    up.input('topicId', sql.UniqueIdentifier, topicId)
    if (patchTitle !== undefined) {
      up.input('title', sql.NVarChar(255), patchTitle)
      sets.push('Titulo = @title')
    }
    if (patchStatus !== undefined) {
      up.input('status', sql.VarChar(30), patchStatus)
      sets.push('Estado = @status')
    }

    if (sets.length === 0) {
      res.status(200).json({ success: true, data: mapTopic(current) })
      return
    }

    sets.push('FechaActualizacion = GETDATE()')
    await up.query(`
      UPDATE dbo.TemasProyecto
      SET ${sets.join(', ')}
      WHERE Id = @topicId;
    `)

    const updated = await getTopicRowOrThrow(projectId, topicId, auth.organizationId)
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic.actualizado',
      resourceType: 'topic',
      resourceId: topicId,
      resourceName: updated.Titulo,
      extra: { previousTitle: current.Titulo, projectId },
      req,
    })
    res.status(200).json({ success: true, data: mapTopic(updated) })
  } catch (err) {
    next(err)
  }
}

export async function deleteTopic(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const current = await getTopicRowOrThrow(projectId, topicId, auth.organizationId)

    const q = (await getDbPool()).request()
    q.input('topicId', sql.UniqueIdentifier, topicId)
    await q.query(`DELETE FROM dbo.TemasProyecto WHERE Id = @topicId;`)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic.eliminado',
      resourceType: 'topic',
      resourceId: topicId,
      resourceName: current.Titulo,
      extra: { projectId },
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
