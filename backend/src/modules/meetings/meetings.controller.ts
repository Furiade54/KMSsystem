import type { NextFunction, Request, Response } from 'express'
import type { ApiResponse, Meeting, MeetingLinkedTopic, MeetingStatus, PaginatedResult } from '../../../../packages/shared-types/src'
import { DB_MEETING_STATUS } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { logAuditRecord } from '../../shared/db/audit'
import { AppError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull, sqlWallClockToLocalIso, sqlWallClockToMssqlDatetime2 } from '../../shared/utils/date'

type MeetingRow = {
  Id: string
  IdProyecto: string
  Titulo: string
  Descripcion: string | null
  FechaReunion: Date | null
  IdCreador: string | null
  IdActaArchivo: string | null
  Estado: string
  FechaCreacion: Date
  FechaActualizacion: Date | null
}

type LinkedTopicRow = {
  topicId: string
  title: string
  linkedAt: Date
  linkedByUserId: string | null
  linkedByUserName: string | null
}

const DB_TO_API_STATUS: Record<string, MeetingStatus> = DB_MEETING_STATUS

const API_TO_DB_STATUS: Record<MeetingStatus, keyof typeof DB_MEETING_STATUS> = {
  SCHEDULED: 'PROGRAMADA',
  IN_PROGRESS: 'EN_CURSO',
  HELD: 'REALIZADA',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
}

function mapMeeting(row: MeetingRow, linkedTopicsIds?: string[]): Meeting {
  const rawStatus = String(row.Estado || '').toUpperCase()
  return {
    id: String(row.Id),
    projectId: String(row.IdProyecto),
    title: String(row.Titulo),
    description: row.Descripcion ?? null,
    meetingAt: sqlWallClockToLocalIso(row.FechaReunion as any),
    createdBy: row.IdCreador ? String(row.IdCreador) : null,
    minutesFileId: row.IdActaArchivo ? String(row.IdActaArchivo) : null,
    status: DB_TO_API_STATUS[rawStatus] ?? 'SCHEDULED',
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
    ...(linkedTopicsIds ? { linkedTopicsIds } : undefined),
  }
}

function mapLinkedTopic(row: LinkedTopicRow): MeetingLinkedTopic {
  return {
    topicId: String(row.topicId),
    title: String(row.title),
    linkedAt: sqlLocalToIso(row.linkedAt as any),
    linkedByUserId: row.linkedByUserId ? String(row.linkedByUserId) : null,
    linkedByUserName: row.linkedByUserName ?? null,
  }
}

async function fetchLinkedTopicsIds(meetingIds: string[]): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {}
  if (meetingIds.length === 0) return result
  const pool = await getDbPool()
  const guidsLiteral = meetingIds
    .map((id) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id) ? `CAST('${id}' AS UNIQUEIDENTIFIER)` : null)
    .filter((g): g is string => g != null)
    .join(', ')
  if (!guidsLiteral) return result
  const rows = await pool.request().query<{ IdReunion: string; IdTema: string }>(`
    SELECT rtv.IdReunion, rtv.IdTema
      FROM dbo.ReunionesTemasVinculados rtv
     WHERE rtv.IdReunion IN (${guidsLiteral})
     ORDER BY rtv.FechaVinculacion ASC
  `)
  for (const r of rows.recordset) {
    const mid = String(r.IdReunion)
    if (!result[mid]) result[mid] = []
    result[mid].push(String(r.IdTema))
  }
  return result
}

function parseOptionalMeetingDate(value: unknown, fieldName: string): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = sqlWallClockToMssqlDatetime2(value)
  if (parsed == null) {
    throw new AppError(`${fieldName} no es una fecha válida`, 400)
  }
  return parsed
}

function parseOptionalMeetingStatus(value: unknown): keyof typeof DB_MEETING_STATUS | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const raw = String(value).trim().toUpperCase()
  if ((raw as keyof typeof DB_MEETING_STATUS) in DB_MEETING_STATUS) {
    return raw as keyof typeof DB_MEETING_STATUS
  }
  if ((raw as MeetingStatus) in API_TO_DB_STATUS) {
    return API_TO_DB_STATUS[raw as MeetingStatus]
  }
  throw new AppError('Estado de reunión inválido', 400)
}

async function getMeetingRowOrThrow(
  projectId: string,
  meetingId: string,
  organizationId: string
): Promise<MeetingRow> {
  const pool = await getDbPool()
  const q = pool.request()
  q.input('projectId', sql.UniqueIdentifier, projectId)
  q.input('meetingId', sql.UniqueIdentifier, meetingId)
  q.input('orgId', sql.UniqueIdentifier, organizationId)
  const r = await q.query<MeetingRow>(`
    SELECT
      r.Id, r.IdProyecto, r.Titulo, r.Descripcion, r.FechaReunion,
      r.IdCreador, r.IdActaArchivo, r.Estado, r.FechaCreacion, r.FechaActualizacion
    FROM dbo.Reuniones r
    INNER JOIN dbo.Proyectos p ON p.Id = r.IdProyecto
    WHERE r.Id = @meetingId
      AND r.IdProyecto = @projectId
      AND p.IdOrganizacion = @orgId
      AND ISNULL(p.Estado, 'ACTIVO') <> 'ELIMINADO';
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Reunión no encontrada')
  return row
}

export async function setMeetingMinutesFile(
  req: Request,
  res: Response<ApiResponse<Meeting>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const current = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)

    const rawMinutesFileId = req.body?.minutesFileId
    const minutesFileId =
      rawMinutesFileId === undefined
        ? undefined
        : rawMinutesFileId === null || rawMinutesFileId === ''
          ? null
          : String(rawMinutesFileId)

    if (minutesFileId !== undefined) {
      const pool = await getDbPool()
      const up = pool.request()
      up.input('meetingId', sql.UniqueIdentifier, meetingId)
      up.input('minutesFileId', sql.UniqueIdentifier, minutesFileId)

      let sets: string[] = []
      if (minutesFileId === null) {
        sets.push('IdActaArchivo = NULL')
      } else {
        sets.push('IdActaArchivo = @minutesFileId')
      }
      sets.push('FechaActualizacion = GETDATE()')

      await up.query(`
        UPDATE dbo.Reuniones
        SET ${sets.join(', ')}
        WHERE Id = @meetingId;
      `)
    } else if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'minutesFileId')) {
      // explicit null via body (undefined vs missing)
    }

    const updated = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    const linked = await fetchLinkedTopicsIds([meetingId])
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.minutesFile.updated',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: updated.Titulo,
      projectId,
      extra: { previousMinutesFileId: current.IdActaArchivo, minutesFileId: updated.IdActaArchivo },
      req,
    })
    res.status(200).json({ success: true, data: mapMeeting(updated, linked[meetingId]) })
  } catch (err) {
    next(err)
  }
}

export async function listMeetings(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<Meeting>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    if (!projectId) throw new AppError('projectId es requerido', 400)

    const page = Math.max(1, Number(req.query.page || '1'))
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || '20')))
    const search = req.query.search ? String(req.query.search).trim() : ''
    const status = parseOptionalMeetingStatus(req.query.status)

    const pool = await getDbPool()
    const countReq = pool.request()
    const dataReq = pool.request()
    countReq.input('projectId', sql.UniqueIdentifier, projectId)
    countReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    dataReq.input('projectId', sql.UniqueIdentifier, projectId)
    dataReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)

    let where = `
      r.IdProyecto = @projectId
      AND p.IdOrganizacion = @orgId
      AND ISNULL(p.Estado, 'ACTIVO') <> 'ELIMINADO'
    `

    if (search) {
      countReq.input('search', sql.NVarChar(255), `%${search}%`)
      dataReq.input('search', sql.NVarChar(255), `%${search}%`)
      where += ` AND (r.Titulo LIKE @search OR r.Descripcion LIKE @search)`
    }

    if (status) {
      countReq.input('status', sql.VarChar(30), status)
      dataReq.input('status', sql.VarChar(30), status)
      where += ` AND r.Estado = @status`
    }

    const countResult = await countReq.query<{ total: number }>(`
      SELECT COUNT(*) total
      FROM dbo.Reuniones r
      INNER JOIN dbo.Proyectos p ON p.Id = r.IdProyecto
      WHERE ${where};
    `)
    const total = Number(countResult.recordset[0]?.total ?? 0)
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const dataResult = await dataReq.query<MeetingRow>(`
      SELECT
        r.Id, r.IdProyecto, r.Titulo, r.Descripcion, r.FechaReunion,
        r.IdCreador, r.IdActaArchivo, r.Estado, r.FechaCreacion, r.FechaActualizacion
      FROM dbo.Reuniones r
      INNER JOIN dbo.Proyectos p ON p.Id = r.IdProyecto
      WHERE ${where}
      ORDER BY
        CASE WHEN r.FechaReunion IS NULL THEN 1 ELSE 0 END,
        r.FechaReunion DESC,
        r.FechaCreacion DESC
      OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `)
    const ids = dataResult.recordset.map((r) => String(r.Id))
    const linkedMap = await fetchLinkedTopicsIds(ids)

    res.status(200).json({
      success: true,
      data: {
        items: dataResult.recordset.map((r) => mapMeeting(r, linkedMap[String(r.Id)])),
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

export async function getMeeting(
  req: Request,
  res: Response<ApiResponse<Meeting>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const row = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    const linkedMap = await fetchLinkedTopicsIds([meetingId])
    res.status(200).json({ success: true, data: mapMeeting(row, linkedMap[meetingId]) })
  } catch (err) {
    next(err)
  }
}

export async function createMeeting(
  req: Request,
  res: Response<ApiResponse<Meeting>>,
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

    const description = req.body?.description == null ? null : String(req.body.description)
    const meetingAt = parseOptionalMeetingDate(req.body?.meetingAt, 'meetingAt')
    const status = parseOptionalMeetingStatus(req.body?.status) ?? 'PROGRAMADA'

    const pool = await getDbPool()
    const ins = pool.request()
    ins.input('projectId', sql.UniqueIdentifier, projectId)
    ins.input('title', sql.NVarChar(255), title)
    ins.input('description', sql.NVarChar(sql.MAX), description)
    ins.input('meetingAt', sql.DateTime2, meetingAt ?? null)
    ins.input('createdBy', sql.UniqueIdentifier, auth.userId)
    ins.input('status', sql.VarChar(30), status)
    const created = await ins.query<{ Id: string }>(`
      INSERT INTO dbo.Reuniones (
        IdProyecto, Titulo, Descripcion, FechaReunion, IdCreador, Estado, FechaCreacion, FechaActualizacion
      )
      OUTPUT INSERTED.Id
      VALUES (
        @projectId, @title, @description, @meetingAt, @createdBy, @status, GETDATE(), GETDATE()
      );
    `)
    const meetingId = String(created.recordset[0]?.Id || '')
    if (!meetingId) throw new AppError('No se pudo crear la reunión', 500)

    const row = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    const linkedMap = await fetchLinkedTopicsIds([meetingId])
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.creada',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: title,
      projectId,
      req,
    })
    res.status(201).json({ success: true, data: mapMeeting(row, linkedMap[meetingId]) })
  } catch (err) {
    next(err)
  }
}

export async function updateMeeting(
  req: Request,
  res: Response<ApiResponse<Meeting>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const current = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)

    const patchTitle = req.body?.title !== undefined ? String(req.body.title || '').trim() : undefined
    const patchDescription = req.body?.description !== undefined
      ? (req.body.description == null ? null : String(req.body.description))
      : undefined
    const patchMeetingAt = parseOptionalMeetingDate(req.body?.meetingAt, 'meetingAt')
    const patchStatus = parseOptionalMeetingStatus(req.body?.status)

    if (patchTitle !== undefined && (patchTitle.length < 1 || patchTitle.length > 255)) {
      throw new AppError('Título inválido (1..255)', 400)
    }

    const sets: string[] = []
    const up = (await getDbPool()).request()
    up.input('meetingId', sql.UniqueIdentifier, meetingId)
    if (patchTitle !== undefined) {
      up.input('title', sql.NVarChar(255), patchTitle)
      sets.push('Titulo = @title')
    }
    if (patchDescription !== undefined) {
      up.input('description', sql.NVarChar(sql.MAX), patchDescription)
      sets.push('Descripcion = @description')
    }
    if (patchMeetingAt !== undefined) {
      up.input('meetingAt', sql.DateTime2, patchMeetingAt)
      sets.push('FechaReunion = @meetingAt')
    }
    if (patchStatus !== undefined) {
      up.input('status', sql.VarChar(30), patchStatus)
      sets.push('Estado = @status')
    }

    if (sets.length === 0) {
      res.status(200).json({ success: true, data: mapMeeting(current) })
      return
    }

    sets.push('FechaActualizacion = GETDATE()')
    await up.query(`
      UPDATE dbo.Reuniones
      SET ${sets.join(', ')}
      WHERE Id = @meetingId;
    `)

    const updated = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    const linkedMap = await fetchLinkedTopicsIds([meetingId])
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.actualizada',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: updated.Titulo,
      projectId,
      extra: { previousTitle: current.Titulo },
      req,
    })
    res.status(200).json({ success: true, data: mapMeeting(updated, linkedMap[meetingId]) })
  } catch (err) {
    next(err)
  }
}

export async function deleteMeeting(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const current = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)

    const q = (await getDbPool()).request()
    q.input('meetingId', sql.UniqueIdentifier, meetingId)
    await q.query(`DELETE FROM dbo.Reuniones WHERE Id = @meetingId;`)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.eliminada',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: current.Titulo,
      projectId,
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
//  VINCULACIÓN REUNIÓN <-> TEMAS (ReunionesTemasVinculados)
// ---------------------------------------------------------------------------

async function getTopicRowOrThrowSameProject(
  projectId: string,
  topicId: string,
  organizationId: string
): Promise<{ Id: string; Titulo: string }> {
  const pool = await getDbPool()
  const r = await pool
    .request()
    .input('projectId', sql.UniqueIdentifier, projectId)
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('orgId', sql.UniqueIdentifier, organizationId)
    .query<{ Id: string; Titulo: string }>(`
      SELECT t.Id, t.Titulo
        FROM dbo.TemasProyecto t
        INNER JOIN dbo.Proyectos p ON p.Id = t.IdProyecto
       WHERE t.Id = @topicId
         AND t.IdProyecto = @projectId
         AND p.IdOrganizacion = @orgId
         AND ISNULL(p.Estado, 'ACTIVO') <> 'ELIMINADO'
    `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Tema no encontrado en el proyecto')
  return row
}

export async function listMeetingLinkedTopics(
  req: Request,
  res: Response<ApiResponse<MeetingLinkedTopic[]>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)

    const pool = await getDbPool()
    const r = await pool
      .request()
      .input('meetingId', sql.UniqueIdentifier, meetingId)
      .input('projectId', sql.UniqueIdentifier, projectId)
      .input('orgId', sql.UniqueIdentifier, auth.organizationId)
      .query<LinkedTopicRow>(`
        SELECT
          t.Id           AS topicId,
          t.Titulo       AS title,
          rtv.FechaVinculacion   AS linkedAt,
          rtv.IdUsuarioVinculante AS linkedByUserId,
          u.Correo + ' (' + ISNULL(u.NombreCompleto, '') + ')' AS linkedByUserName
        FROM dbo.ReunionesTemasVinculados rtv
        INNER JOIN dbo.TemasProyecto t
           ON t.Id = rtv.IdTema
          AND t.IdProyecto = @projectId
        LEFT JOIN dbo.Usuarios u
           ON u.Id = rtv.IdUsuarioVinculante
        WHERE rtv.IdReunion = @meetingId
          AND EXISTS (
            SELECT 1 FROM dbo.Proyectos p
             WHERE p.Id = @projectId AND p.IdOrganizacion = @orgId
          )
        ORDER BY rtv.FechaVinculacion ASC
      `)
    res.status(200).json({ success: true, data: r.recordset.map(mapLinkedTopic) })
  } catch (err) {
    next(err)
  }
}

export async function linkTopicToMeeting(
  req: Request,
  res: Response<ApiResponse<Meeting>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const topicId = String(req.params.topicId || '')

    // Validar reunión pertenece al proyecto + tenant
    const meeting = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    // Validar tema pertenece al MISMO proyecto + tenant (evita cruce entre proyectos)
    const tema = await getTopicRowOrThrowSameProject(projectId, topicId, auth.organizationId)

    const pool = await getDbPool()
    // Insert idempotente (PK compuesta): si ya existe, sin error
    const ins = pool.request()
    ins.input('meetingId', sql.UniqueIdentifier, meetingId)
    ins.input('topicId', sql.UniqueIdentifier, topicId)
    ins.input('userId', sql.UniqueIdentifier, auth.userId)
    await ins.query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.ReunionesTemasVinculados
         WHERE IdReunion = @meetingId AND IdTema = @topicId
      )
      INSERT INTO dbo.ReunionesTemasVinculados
        (IdReunion, IdTema, IdUsuarioVinculante, FechaVinculacion)
      VALUES
        (@meetingId, @topicId, @userId, GETDATE());
    `)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.tema.vinculado',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: { topicId, topicTitle: tema.Titulo },
      req,
    })

    // Refetch completo con linkedTopicsIds
    const updatedRow = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    const linkedMap = await fetchLinkedTopicsIds([meetingId])
    res.status(200).json({ success: true, data: mapMeeting(updatedRow, linkedMap[meetingId]) })
  } catch (err) {
    next(err)
  }
}

export async function unlinkTopicFromMeeting(
  req: Request,
  res: Response<ApiResponse<Meeting>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const topicId = String(req.params.topicId || '')

    const meeting = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    // Validación tema pertenece al mismo proyecto (si no existe lo tratamos como no-existe 200/Meeting actual)
    let temaTitulo: string | null = null
    try {
      const t = await getTopicRowOrThrowSameProject(projectId, topicId, auth.organizationId)
      temaTitulo = t.Titulo
    } catch (_e) { /* no-op */ }

    const pool = await getDbPool()
    const del = pool.request()
    del.input('meetingId', sql.UniqueIdentifier, meetingId)
    del.input('topicId', sql.UniqueIdentifier, topicId)
    await del.query(`
      DELETE FROM dbo.ReunionesTemasVinculados
       WHERE IdReunion = @meetingId AND IdTema = @topicId
    `)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.tema.desvinculado',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: { topicId, topicTitle: temaTitulo },
      req,
    })

    const updatedRow = await getMeetingRowOrThrow(projectId, meetingId, auth.organizationId)
    const linkedMap = await fetchLinkedTopicsIds([meetingId])
    res.status(200).json({ success: true, data: mapMeeting(updatedRow, linkedMap[meetingId]) })
  } catch (err) {
    next(err)
  }
}
