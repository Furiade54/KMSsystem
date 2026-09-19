import type { NextFunction, Request, Response } from 'express'
import type { ApiResponse, MeetingMinutes, PaginatedResult } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { logAuditRecord } from '../../shared/db/audit'
import { AppError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

type MinutesState = MeetingMinutes['state']

const VALID_MINUTES_STATES: MinutesState[] = ['BORRADOR', 'FINALIZADO', 'OBSOLETO']

type MinutesRow = {
  Id: string
  IdReunion: string
  IdCreador: string | null
  Contenido: string | null
  Titulo: string | null
  Estado: string
  FechaFinalizacion: Date | null
  FechaCreacion: Date
  FechaActualizacion: Date | null
  NombreCreador: string | null
  EmailCreador: string | null
}

function mapMinutes(row: MinutesRow): MeetingMinutes & {
  createdByName?: string | null
  createdByEmail?: string | null
} {
  const rawState = String(row.Estado || 'BORRADOR').toUpperCase() as MinutesState
  const state = VALID_MINUTES_STATES.includes(rawState) ? rawState : 'BORRADOR'
  return {
    id: String(row.Id),
    meetingId: String(row.IdReunion),
    createdBy: row.IdCreador ? String(row.IdCreador) : null,
    content: row.Contenido ?? null,
    title: row.Titulo ?? null,
    state,
    finalizedAt: sqlLocalToIsoOrNull(row.FechaFinalizacion as any) ?? null,
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any) ?? null,
    createdByName: row.NombreCreador ?? null,
    createdByEmail: row.EmailCreador ?? null,
  }
}

function parseMinutesState(value: unknown): MinutesState | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const s = String(value).trim().toUpperCase() as MinutesState
  if (VALID_MINUTES_STATES.includes(s)) return s
  throw new AppError('Estado de acta inválido (BORRADOR | FINALIZADO | OBSOLETO)', 400)
}

function resolveStateAndFinalize(
  explicitState: MinutesState | undefined,
  finalize: boolean | undefined,
  currentState: MinutesState
): { nextState: MinutesState; setFinalizedAt: 'NOW' | 'NULL' | 'KEEP' } {
  if (finalize === true) {
    return { nextState: 'FINALIZADO', setFinalizedAt: 'NOW' }
  }
  const nextState = explicitState ?? currentState
  if (nextState === 'FINALIZADO') {
    return { nextState, setFinalizedAt: 'NOW' }
  }
  return { nextState, setFinalizedAt: 'NULL' }
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

async function getMinutesRowOrThrow(meetingId: string, minutesId: string): Promise<MinutesRow> {
  const pool = await getDbPool()
  const q = pool.request()
  q.input('meetingId', sql.UniqueIdentifier, meetingId)
  q.input('minutesId', sql.UniqueIdentifier, minutesId)
  const r = await q.query<MinutesRow>(`
    SELECT
      a.Id, a.IdReunion, a.IdCreador, a.Contenido, a.Titulo, a.Estado, a.FechaFinalizacion,
      a.FechaCreacion, a.FechaActualizacion,
      u.NombreCompleto NombreCreador, u.Correo EmailCreador
    FROM dbo.ActasReunion a
    LEFT JOIN dbo.Usuarios u ON u.Id = a.IdCreador
    WHERE a.Id = @minutesId AND a.IdReunion = @meetingId;
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Acta no encontrada')
  return row
}

export async function listMeetingMinutes(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<MeetingMinutes & { createdByName?: string | null; createdByEmail?: string | null }>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const page = Math.max(1, Number(req.query.page || '1'))
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || '50')))
    const pool = await getDbPool()

    const countReq = pool.request()
    countReq.input('meetingId', sql.UniqueIdentifier, meetingId)
    const total = Number(
      (await countReq.query<{ total: number }>(`
        SELECT COUNT(*) total FROM dbo.ActasReunion WHERE IdReunion = @meetingId;
      `)).recordset[0]?.total ?? 0
    )
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const dataReq = pool.request()
    dataReq.input('meetingId', sql.UniqueIdentifier, meetingId)
    const rows = (await dataReq.query<MinutesRow>(`
      SELECT
        a.Id, a.IdReunion, a.IdCreador, a.Contenido, a.Titulo, a.Estado, a.FechaFinalizacion,
        a.FechaCreacion, a.FechaActualizacion,
        u.NombreCompleto NombreCreador, u.Correo EmailCreador
      FROM dbo.ActasReunion a
      LEFT JOIN dbo.Usuarios u ON u.Id = a.IdCreador
      WHERE a.IdReunion = @meetingId
      ORDER BY a.FechaCreacion DESC, a.Id DESC
      OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `)).recordset

    res.status(200).json({
      success: true,
      data: {
        items: rows.map(mapMinutes),
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

export async function createMeetingMinutes(
  req: Request,
  res: Response<ApiResponse<MeetingMinutes & { createdByName?: string | null; createdByEmail?: string | null }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const content = req.body?.content == null ? null : String(req.body.content)
    const title = req.body?.title == null ? null : String(req.body.title)
    const explicitState = parseMinutesState(req.body?.state)
    const finalize = req.body?.finalize === true

    const { nextState, setFinalizedAt } = resolveStateAndFinalize(
      explicitState,
      finalize,
      'BORRADOR'
    )

    const pool = await getDbPool()
    const ins = pool.request()
    ins.input('meetingId', sql.UniqueIdentifier, meetingId)
    ins.input('createdBy', sql.UniqueIdentifier, auth.userId)
    ins.input('content', sql.NVarChar(sql.MAX), content)
    ins.input('title', sql.NVarChar(255), title)
    ins.input('state', sql.VarChar(30), nextState)
    const created = await ins.query<{ Id: string }>(`
      INSERT INTO dbo.ActasReunion (
        IdReunion, IdCreador, Contenido, Titulo, Estado, FechaFinalizacion,
        FechaCreacion, FechaActualizacion
      )
      OUTPUT INSERTED.Id
      VALUES (
        @meetingId,
        @createdBy,
        @content,
        @title,
        @state,
        ${setFinalizedAt === 'NOW' ? 'GETDATE()' : 'NULL'},
        GETDATE(),
        GETDATE()
      );
    `)
    const minutesId = String(created.recordset[0]?.Id || '')
    if (!minutesId) throw new AppError('No se pudo crear el acta', 500)

    const row = await getMinutesRowOrThrow(meetingId, minutesId)
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.minutes.created',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: { minutesId, title: row.Titulo, state: row.Estado },
      req,
    })

    res.status(201).json({ success: true, data: mapMinutes(row) })
  } catch (err) {
    next(err)
  }
}

export async function updateMeetingMinutes(
  req: Request,
  res: Response<ApiResponse<MeetingMinutes & { createdByName?: string | null; createdByEmail?: string | null }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const minutesId = String(req.params.minutesId || '')
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)
    const current = await getMinutesRowOrThrow(meetingId, minutesId)

    const patchContent = req.body?.content === undefined
      ? undefined
      : (req.body.content == null ? null : String(req.body.content))
    const patchTitle = req.body?.title === undefined
      ? undefined
      : (req.body.title == null ? null : String(req.body.title))
    const patchState = parseMinutesState(req.body?.state)
    const finalize = req.body?.finalize === true

    const currentStateRaw = String(current.Estado || 'BORRADOR').toUpperCase() as MinutesState
    const currentState = VALID_MINUTES_STATES.includes(currentStateRaw)
      ? currentStateRaw
      : 'BORRADOR'
    const { nextState, setFinalizedAt } = resolveStateAndFinalize(
      patchState,
      finalize,
      currentState
    )

    let hasChanges =
      patchContent !== undefined ||
      patchTitle !== undefined ||
      patchState !== undefined ||
      finalize === true

    if (!hasChanges) {
      res.status(200).json({ success: true, data: mapMinutes(current) })
      return
    }

    const sets: string[] = []
    const pool = await getDbPool()
    const up = pool.request()
    up.input('minutesId', sql.UniqueIdentifier, minutesId)
    if (patchContent !== undefined) {
      up.input('content', sql.NVarChar(sql.MAX), patchContent)
      sets.push('Contenido = @content')
    }
    if (patchTitle !== undefined) {
      up.input('title', sql.NVarChar(255), patchTitle)
      sets.push('Titulo = @title')
    }
    if (patchState !== undefined || finalize === true) {
      up.input('state', sql.VarChar(30), nextState)
      sets.push('Estado = @state')
      if (setFinalizedAt === 'NOW') {
        sets.push('FechaFinalizacion = GETDATE()')
      } else if (setFinalizedAt === 'NULL') {
        sets.push('FechaFinalizacion = NULL')
      }
    }
    sets.push('FechaActualizacion = GETDATE()')

    await up.query(`
      UPDATE dbo.ActasReunion
      SET ${sets.join(', ')}
      WHERE Id = @minutesId;
    `)

    const updated = await getMinutesRowOrThrow(meetingId, minutesId)
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.minutes.updated',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: {
        minutesId,
        previous: { title: current.Titulo, state: current.Estado },
        next: { title: updated.Titulo, state: updated.Estado },
      },
      req,
    })
    res.status(200).json({ success: true, data: mapMinutes(updated) })
  } catch (err) {
    next(err)
  }
}

export async function deleteMeetingMinutes(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const minutesId = String(req.params.minutesId || '')
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)
    const current = await getMinutesRowOrThrow(meetingId, minutesId)

    const pool = await getDbPool()
    const d = pool.request()
    d.input('minutesId', sql.UniqueIdentifier, minutesId)
    await d.query(`DELETE FROM dbo.ActasReunion WHERE Id = @minutesId;`)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.minutes.deleted',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: { minutesId, title: current.Titulo, state: current.Estado },
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
