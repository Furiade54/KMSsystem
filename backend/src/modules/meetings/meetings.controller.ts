import type { NextFunction, Request, Response } from 'express'
import type { ApiResponse, Meeting, MeetingStatus, PaginatedResult } from '../../../../packages/shared-types/src'
import { DB_MEETING_STATUS } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { logAuditRecord } from '../../shared/db/audit'
import { AppError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

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

const DB_TO_API_STATUS: Record<string, MeetingStatus> = DB_MEETING_STATUS

const API_TO_DB_STATUS: Record<MeetingStatus, keyof typeof DB_MEETING_STATUS> = {
  SCHEDULED: 'PROGRAMADA',
  IN_PROGRESS: 'EN_CURSO',
  HELD: 'REALIZADA',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
}

function mapMeeting(row: MeetingRow): Meeting {
  const rawStatus = String(row.Estado || '').toUpperCase()
  return {
    id: String(row.Id),
    projectId: String(row.IdProyecto),
    title: String(row.Titulo),
    description: row.Descripcion ?? null,
    meetingAt: sqlLocalToIsoOrNull(row.FechaReunion as any),
    createdBy: row.IdCreador ? String(row.IdCreador) : null,
    minutesFileId: row.IdActaArchivo ? String(row.IdActaArchivo) : null,
    status: DB_TO_API_STATUS[rawStatus] ?? 'SCHEDULED',
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
  }
}

function parseOptionalMeetingDate(value: unknown, fieldName: string): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
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
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.minutesFile.updated',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: updated.Titulo,
      extra: { projectId, previousMinutesFileId: current.IdActaArchivo, minutesFileId: updated.IdActaArchivo },
      req,
    })
    res.status(200).json({ success: true, data: mapMeeting(updated) })
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

    res.status(200).json({
      success: true,
      data: {
        items: dataResult.recordset.map(mapMeeting),
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
    const row = await getMeetingRowOrThrow(String(req.params.projectId || ''), String(req.params.meetingId || ''), auth.organizationId)
    res.status(200).json({ success: true, data: mapMeeting(row) })
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
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.creada',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: title,
      extra: { projectId },
      req,
    })
    res.status(201).json({ success: true, data: mapMeeting(row) })
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
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.actualizada',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: updated.Titulo,
      extra: { previousTitle: current.Titulo, projectId },
      req,
    })
    res.status(200).json({ success: true, data: mapMeeting(updated) })
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
      extra: { projectId },
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
