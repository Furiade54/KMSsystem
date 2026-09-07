import type { NextFunction, Request, Response } from 'express'
import type { ApiResponse, MeetingParticipant, PaginatedResult } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { logAuditRecord } from '../../shared/db/audit'
import { AppError, NotFoundError } from '../../shared/errors/AppError'

type ParticipantRow = {
  IdReunion: string
  IdUsuario: string
  NombreRol: string | null
  Asistio: boolean
  NombreCompleto: string | null
  Correo: string | null
}

function mapParticipant(row: ParticipantRow): MeetingParticipant & {
  userFullName?: string | null
  userEmail?: string | null
} {
  return {
    meetingId: String(row.IdReunion),
    userId: String(row.IdUsuario),
    roleName: row.NombreRol ?? null,
    attended: Boolean(row.Asistio),
    userFullName: row.NombreCompleto ?? null,
    userEmail: row.Correo ?? null,
  }
}

function parseAttended(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  const s = String(value).trim().toUpperCase()
  if (['1', 'TRUE', 'YES', 'SI', 'SÍ'].includes(s)) return true
  if (['0', 'FALSE', 'NO'].includes(s)) return false
  return undefined
}

function parseRoleName(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const s = String(value).trim()
  if (s.length > 100) throw new AppError('NombreRol excede 100 caracteres', 400)
  return s
}

async function getMeetingAndAssertScope(
  projectId: string,
  meetingId: string,
  organizationId: string
): Promise<{ Id: string; IdProyecto: string; Titulo: string }> {
  const pool = await getDbPool()
  const q = pool.request()
  q.input('projectId', sql.UniqueIdentifier, projectId)
  q.input('meetingId', sql.UniqueIdentifier, meetingId)
  q.input('orgId', sql.UniqueIdentifier, organizationId)
  const r = await q.query<{ Id: string; IdProyecto: string; Titulo: string }>(`
    SELECT r.Id, r.IdProyecto, r.Titulo
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

export async function listMeetingParticipants(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<MeetingParticipant & { userFullName?: string | null; userEmail?: string | null }>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    if (!projectId) throw new AppError('projectId es requerido', 400)
    if (!meetingId) throw new AppError('meetingId es requerido', 400)
    await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const page = Math.max(1, Number(req.query.page || '1'))
    const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize || '100')))
    const search = req.query.search ? String(req.query.search).trim() : ''

    const pool = await getDbPool()
    const countReq = pool.request()
    const dataReq = pool.request()
    countReq.input('meetingId', sql.UniqueIdentifier, meetingId)
    dataReq.input('meetingId', sql.UniqueIdentifier, meetingId)

    let where = `ar.IdReunion = @meetingId`
    if (search) {
      countReq.input('search', sql.NVarChar(255), `%${search}%`)
      dataReq.input('search', sql.NVarChar(255), `%${search}%`)
      where += ` AND (u.NombreCompleto LIKE @search OR u.Correo LIKE @search OR ar.NombreRol LIKE @search)`
    }

    const countResult = await countReq.query<{ total: number }>(`
      SELECT COUNT(*) total
      FROM dbo.AsistentesReunion ar
      INNER JOIN dbo.Usuarios u ON u.Id = ar.IdUsuario
      WHERE ${where};
    `)
    const total = Number(countResult.recordset[0]?.total ?? 0)
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const dataResult = await dataReq.query<ParticipantRow>(`
      SELECT
        ar.IdReunion, ar.IdUsuario, ar.NombreRol, ar.Asistio,
        u.NombreCompleto, u.Correo
      FROM dbo.AsistentesReunion ar
      INNER JOIN dbo.Usuarios u ON u.Id = ar.IdUsuario
      WHERE ${where}
      ORDER BY u.NombreCompleto ASC
      OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `)

    res.status(200).json({
      success: true,
      data: {
        items: dataResult.recordset.map(mapParticipant),
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

export async function upsertMeetingParticipant(
  req: Request,
  res: Response<ApiResponse<MeetingParticipant & { userFullName?: string | null; userEmail?: string | null }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const userId = String(req.body?.userId || '').trim()
    if (!userId) throw new AppError('userId es requerido', 400)
    const roleName = parseRoleName(req.body?.roleName)
    const attended = parseAttended(req.body?.attended) ?? false

    const pool = await getDbPool()
    const up = pool.request()
    up.input('meetingId', sql.UniqueIdentifier, meetingId)
    up.input('userId', sql.UniqueIdentifier, userId)
    up.input('roleName', sql.NVarChar(100), roleName ?? null)
    up.input('attended', sql.Bit, attended)
    up.input('now', sql.DateTime2, new Date())

    await up.query(`
      IF EXISTS (SELECT 1 FROM dbo.AsistentesReunion WHERE IdReunion = @meetingId AND IdUsuario = @userId)
      BEGIN
        UPDATE dbo.AsistentesReunion
        SET NombreRol = @roleName, Asistio = @attended
        WHERE IdReunion = @meetingId AND IdUsuario = @userId;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.AsistentesReunion (IdReunion, IdUsuario, NombreRol, Asistio)
        VALUES (@meetingId, @userId, @roleName, @attended);
      END;
    `)

    const rowReq = pool.request()
    rowReq.input('meetingId', sql.UniqueIdentifier, meetingId)
    rowReq.input('userId', sql.UniqueIdentifier, userId)
    const row = (await rowReq.query<ParticipantRow>(`
      SELECT
        ar.IdReunion, ar.IdUsuario, ar.NombreRol, ar.Asistio,
        u.NombreCompleto, u.Correo
      FROM dbo.AsistentesReunion ar
      INNER JOIN dbo.Usuarios u ON u.Id = ar.IdUsuario
      WHERE ar.IdReunion = @meetingId AND ar.IdUsuario = @userId;
    `)).recordset[0]
    if (!row) throw new AppError('No se pudo persistir el asistente', 500)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.participant.upserted',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      extra: { projectId, participantUserId: userId, attended: Boolean(row.Asistio) },
      req,
    })

    res.status(200).json({ success: true, data: mapParticipant(row) })
  } catch (err) {
    next(err)
  }
}

export async function removeMeetingParticipant(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const userId = String(req.params.userId || '')
    if (!userId) throw new AppError('userId es requerido', 400)
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const pool = await getDbPool()
    const d = pool.request()
    d.input('meetingId', sql.UniqueIdentifier, meetingId)
    d.input('userId', sql.UniqueIdentifier, userId)
    await d.query(`DELETE FROM dbo.AsistentesReunion WHERE IdReunion = @meetingId AND IdUsuario = @userId;`)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.participant.removed',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      extra: { projectId, participantUserId: userId },
      req,
    })

    res.status(200).json({ success: true, data: undefined })
  } catch (err) {
    next(err)
  }
}

export async function setAttendance(
  req: Request,
  res: Response<ApiResponse<MeetingParticipant & { userFullName?: string | null; userEmail?: string | null }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const userId = String(req.params.userId || '')
    if (!userId) throw new AppError('userId es requerido', 400)
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const attended = parseAttended(req.body?.attended)
    if (attended === undefined) throw new AppError('attended es requerido', 400)

    const pool = await getDbPool()
    const up = pool.request()
    up.input('meetingId', sql.UniqueIdentifier, meetingId)
    up.input('userId', sql.UniqueIdentifier, userId)
    up.input('attended', sql.Bit, attended)
    await up.query(`
      UPDATE dbo.AsistentesReunion
      SET Asistio = @attended
      WHERE IdReunion = @meetingId AND IdUsuario = @userId;
    `)

    const rowReq = pool.request()
    rowReq.input('meetingId', sql.UniqueIdentifier, meetingId)
    rowReq.input('userId', sql.UniqueIdentifier, userId)
    const row = (await rowReq.query<ParticipantRow>(`
      SELECT
        ar.IdReunion, ar.IdUsuario, ar.NombreRol, ar.Asistio,
        u.NombreCompleto, u.Correo
      FROM dbo.AsistentesReunion ar
      INNER JOIN dbo.Usuarios u ON u.Id = ar.IdUsuario
      WHERE ar.IdReunion = @meetingId AND ar.IdUsuario = @userId;
    `)).recordset[0]
    if (!row) throw new NotFoundError('Asistente no encontrado')

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.attendance.updated',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      extra: { projectId, participantUserId: userId, attended },
      req,
    })

    res.status(200).json({ success: true, data: mapParticipant(row) })
  } catch (err) {
    next(err)
  }
}
