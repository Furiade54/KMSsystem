import type { NextFunction, Request, Response } from 'express'
import type { ApiResponse, MeetingAgendaItem, PaginatedResult } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { logAuditRecord } from '../../shared/db/audit'
import { AppError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

type AgendaState = MeetingAgendaItem['state']

const VALID_AGENDA_STATES: AgendaState[] = [
  'PENDIENTE',
  'EN_CURSO',
  'COMPLETADO',
  'OMITIDO',
  'DIFERIDO',
]

type AgendaRow = {
  Id: string
  IdReunion: string
  IdItemPadre: string | null
  Orden: number
  Titulo: string
  Descripcion: string | null
  DuracionEstimadaMinutos: number | null
  Estado: string
  IdUsuarioResponsable: string | null
  FechaCreacion: Date
  FechaActualizacion: Date | null
}

function mapAgendaRow(row: AgendaRow): MeetingAgendaItem {
  const raw = String(row.Estado || 'PENDIENTE').toUpperCase() as AgendaState
  const state = VALID_AGENDA_STATES.includes(raw) ? raw : 'PENDIENTE'
  return {
    id: String(row.Id),
    meetingId: String(row.IdReunion),
    parentId: row.IdItemPadre ? String(row.IdItemPadre) : null,
    order: Number(row.Orden) || 0,
    title: String(row.Titulo),
    description: row.Descripcion ?? null,
    estimatedMinutes:
      row.DuracionEstimadaMinutos == null ? null : Number(row.DuracionEstimadaMinutos),
    state,
    responsibleUserId: row.IdUsuarioResponsable ? String(row.IdUsuarioResponsable) : null,
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any) ?? null,
  }
}

function parseAgendaState(value: unknown): AgendaState | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const s = String(value).trim().toUpperCase() as AgendaState
  if (VALID_AGENDA_STATES.includes(s)) return s
  throw new AppError(
    'Estado inválido. Valores permitidos: PENDIENTE | EN_CURSO | COMPLETADO | OMITIDO | DIFERIDO',
    400
  )
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

async function getAgendaItemRowOrThrowSameProject(
  projectId: string,
  agendaId: string,
  organizationId: string
): Promise<AgendaRow> {
  const pool = await getDbPool()
  const q = pool.request()
  q.input('projectId', sql.UniqueIdentifier, projectId)
  q.input('agendaId', sql.UniqueIdentifier, agendaId)
  q.input('orgId', sql.UniqueIdentifier, organizationId)
  const r = await q.query<AgendaRow>(`
    SELECT
      rod.Id, rod.IdReunion, rod.IdItemPadre, rod.Orden, rod.Titulo,
      rod.Descripcion, rod.DuracionEstimadaMinutos, rod.Estado,
      rod.IdUsuarioResponsable, rod.FechaCreacion, rod.FechaActualizacion
    FROM dbo.ReunionesOrdenDia rod
    INNER JOIN dbo.Reuniones r ON r.Id = rod.IdReunion
    INNER JOIN dbo.Proyectos p ON p.Id = r.IdProyecto
    WHERE rod.Id = @agendaId
      AND r.IdProyecto = @projectId
      AND p.IdOrganizacion = @orgId
      AND ISNULL(p.Estado, 'ACTIVO') <> 'ELIMINADO';
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Item de Orden del día no encontrado')
  return row
}

async function getAgendaItemRowOrThrowSameMeeting(
  meetingId: string,
  agendaId: string
): Promise<AgendaRow> {
  const pool = await getDbPool()
  const q = pool.request()
  q.input('meetingId', sql.UniqueIdentifier, meetingId)
  q.input('agendaId', sql.UniqueIdentifier, agendaId)
  const r = await q.query<AgendaRow>(`
    SELECT
      Id, IdReunion, IdItemPadre, Orden, Titulo,
      Descripcion, DuracionEstimadaMinutos, Estado,
      IdUsuarioResponsable, FechaCreacion, FechaActualizacion
    FROM dbo.ReunionesOrdenDia
    WHERE Id = @agendaId AND IdReunion = @meetingId;
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Item de Orden del día no encontrado')
  return row
}

async function assertParentBelongsToSameMeeting(
  meetingId: string,
  parentId: string | null,
  agendaIdSelf?: string
) {
  if (parentId == null) return
  if (agendaIdSelf && parentId === agendaIdSelf) {
    throw new AppError('No se puede usar el propio item como padre', 400)
  }
  const pool = await getDbPool()
  const q = pool.request()
  q.input('meetingId', sql.UniqueIdentifier, meetingId)
  q.input('parentId', sql.UniqueIdentifier, parentId)
  const r = await q.query<{ Id: string }>(`
    SELECT Id FROM dbo.ReunionesOrdenDia
     WHERE Id = @parentId AND IdReunion = @meetingId;
  `)
  if (!r.recordset[0]) {
    throw new AppError('parentId debe pertenecer a la misma reunión', 400)
  }
}

export async function listMeetingAgenda(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<MeetingAgendaItem>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const page = Math.max(1, Number(req.query.page || '1'))
    const pageSize = Math.max(1, Math.min(500, Number(req.query.pageSize || '500')))
    const parentIdRaw = req.query.parentId === '__ROOT__' ? null : req.query.parentId == null ? undefined : String(req.query.parentId)
    const onlyRoot = req.query.parentId === '__ROOT__'

    const pool = await getDbPool()
    const countReq = pool.request()
    const dataReq = pool.request()
    countReq.input('meetingId', sql.UniqueIdentifier, meetingId)
    dataReq.input('meetingId', sql.UniqueIdentifier, meetingId)

    let where = 'IdReunion = @meetingId'
    if (onlyRoot) {
      where += ' AND IdItemPadre IS NULL'
    } else if (parentIdRaw != null) {
      countReq.input('parentId', sql.UniqueIdentifier, parentIdRaw)
      dataReq.input('parentId', sql.UniqueIdentifier, parentIdRaw)
      where += ' AND IdItemPadre = @parentId'
    }

    const total = Number(
      (await countReq.query<{ total: number }>(`
        SELECT COUNT(*) total FROM dbo.ReunionesOrdenDia WHERE ${where};
      `)).recordset[0]?.total ?? 0
    )
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const rows = (await dataReq.query<AgendaRow>(`
      SELECT
        Id, IdReunion, IdItemPadre, Orden, Titulo,
        Descripcion, DuracionEstimadaMinutos, Estado,
        IdUsuarioResponsable, FechaCreacion, FechaActualizacion
      FROM dbo.ReunionesOrdenDia
      WHERE ${where}
      ORDER BY Orden ASC, FechaCreacion ASC
      OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;
    `)).recordset

    res.status(200).json({
      success: true,
      data: {
        items: rows.map(mapAgendaRow),
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

export async function getMeetingAgendaItem(
  req: Request,
  res: Response<ApiResponse<MeetingAgendaItem>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const itemId = String(req.params.itemId || '')
    const row = await getAgendaItemRowOrThrowSameProject(projectId, itemId, auth.organizationId)
    res.status(200).json({ success: true, data: mapAgendaRow(row) })
  } catch (err) {
    next(err)
  }
}

export async function createMeetingAgendaItem(
  req: Request,
  res: Response<ApiResponse<MeetingAgendaItem>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const parentIdRaw = req.body?.parentId == null
      ? null
      : String(req.body.parentId)
    await assertParentBelongsToSameMeeting(meetingId, parentIdRaw)

    const title = String(req.body?.title || '').trim()
    if (!title || title.length > 255) {
      throw new AppError('Título inválido (1..255 caracteres)', 400)
    }

    const description = req.body?.description == null
      ? null
      : String(req.body.description)

    const estimated = req.body?.estimatedMinutes
    const estimatedMinutes =
      estimated === undefined || estimated === null
        ? undefined
        : (() => {
            const n = Number(estimated)
            if (!Number.isFinite(n)) throw new AppError('estimatedMinutes inválido', 400)
            if (n <= 0) throw new AppError('estimatedMinutes debe ser > 0', 400)
            return Math.trunc(n)
          })()

    const order =
      req.body?.order == null ? undefined : Math.trunc(Number(req.body.order)) || 0

    const state = parseAgendaState(req.body?.state) ?? 'PENDIENTE'

    const responsibleRaw =
      req.body?.responsibleUserId == null
        ? null
        : String(req.body.responsibleUserId)

    const pool = await getDbPool()

    let nextOrder = order
    if (nextOrder === undefined) {
      const maxQ = pool.request()
      maxQ.input('meetingId', sql.UniqueIdentifier, meetingId)
      if (parentIdRaw == null) {
        const r = await maxQ.query<{ m: number | null }>(`
          SELECT ISNULL(MAX(Orden), -1) m FROM dbo.ReunionesOrdenDia
           WHERE IdReunion = @meetingId AND IdItemPadre IS NULL;
        `)
        nextOrder = Number(r.recordset[0]?.m ?? -1) + 1
      } else {
        maxQ.input('parentId', sql.UniqueIdentifier, parentIdRaw)
        const r = await maxQ.query<{ m: number | null }>(`
          SELECT ISNULL(MAX(Orden), -1) m FROM dbo.ReunionesOrdenDia
           WHERE IdReunion = @meetingId AND IdItemPadre = @parentId;
        `)
        nextOrder = Number(r.recordset[0]?.m ?? -1) + 1
      }
    }

    const ins = pool.request()
    ins.input('meetingId', sql.UniqueIdentifier, meetingId)
    ins.input('parentId', sql.UniqueIdentifier, parentIdRaw)
    ins.input('title', sql.NVarChar(255), title)
    ins.input('description', sql.NVarChar(sql.MAX), description)
    ins.input('estimatedMinutes', sql.Int, estimatedMinutes ?? null)
    ins.input('order', sql.Int, nextOrder)
    ins.input('state', sql.VarChar(30), state)
    ins.input('responsibleUserId', sql.UniqueIdentifier, responsibleRaw)

    const created = await ins.query<{ Id: string }>(`
      INSERT INTO dbo.ReunionesOrdenDia (
        IdReunion, IdItemPadre, Orden, Titulo, Descripcion,
        DuracionEstimadaMinutos, Estado, IdUsuarioResponsable,
        FechaCreacion, FechaActualizacion
      )
      OUTPUT INSERTED.Id
      VALUES (
        @meetingId,
        @parentId,
        @order,
        @title,
        @description,
        @estimatedMinutes,
        @state,
        @responsibleUserId,
        GETDATE(),
        GETDATE()
      );
    `)

    const itemId = String(created.recordset[0]?.Id || '')
    if (!itemId) throw new AppError('No se pudo crear el item', 500)

    const row = await getAgendaItemRowOrThrowSameMeeting(meetingId, itemId)
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.agenda.item.created',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: { agendaId: itemId, title, parentId: parentIdRaw },
      req,
    })
    res.status(201).json({ success: true, data: mapAgendaRow(row) })
  } catch (err) {
    next(err)
  }
}

export async function updateMeetingAgendaItem(
  req: Request,
  res: Response<ApiResponse<MeetingAgendaItem>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const itemId = String(req.params.itemId || '')
    const current = await getAgendaItemRowOrThrowSameProject(projectId, itemId, auth.organizationId)
    const meetingId = String(current.IdReunion)
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    let patchParentId: string | null | undefined
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'parentId')) {
      patchParentId = req.body.parentId == null ? null : String(req.body.parentId)
    }
    if (patchParentId !== undefined) {
      await assertParentBelongsToSameMeeting(meetingId, patchParentId, itemId)
    }

    const patchTitle = req.body?.title === undefined
      ? undefined
      : String(req.body.title).trim()
    if (patchTitle !== undefined && (!patchTitle || patchTitle.length > 255)) {
      throw new AppError('Título inválido (1..255 caracteres)', 400)
    }

    const patchDescription = req.body?.description === undefined
      ? undefined
      : (req.body.description == null ? null : String(req.body.description))

    let patchEstimated: number | null | undefined
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'estimatedMinutes')) {
      const v = req.body.estimatedMinutes
      if (v === null) {
        patchEstimated = null
      } else if (v === undefined) {
        patchEstimated = undefined
      } else {
        const n = Number(v)
        if (!Number.isFinite(n)) throw new AppError('estimatedMinutes inválido', 400)
        if (n <= 0) throw new AppError('estimatedMinutes debe ser > 0', 400)
        patchEstimated = Math.trunc(n)
      }
    }

    const patchOrder = req.body?.order === undefined
      ? undefined
      : Math.trunc(Number(req.body.order)) || 0

    const patchState = parseAgendaState(req.body?.state)

    let patchResponsible: string | null | undefined
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'responsibleUserId')) {
      patchResponsible = req.body.responsibleUserId == null
        ? null
        : String(req.body.responsibleUserId)
    }

    const sets: string[] = []
    const pool = await getDbPool()
    const up = pool.request()
    up.input('itemId', sql.UniqueIdentifier, itemId)

    if (patchParentId !== undefined) {
      up.input('parentId', sql.UniqueIdentifier, patchParentId)
      sets.push('IdItemPadre = @parentId')
    }
    if (patchTitle !== undefined) {
      up.input('title', sql.NVarChar(255), patchTitle)
      sets.push('Titulo = @title')
    }
    if (patchDescription !== undefined) {
      up.input('description', sql.NVarChar(sql.MAX), patchDescription)
      sets.push('Descripcion = @description')
    }
    if (patchEstimated !== undefined) {
      up.input('estimatedMinutes', sql.Int, patchEstimated)
      sets.push('DuracionEstimadaMinutos = @estimatedMinutes')
    }
    if (patchOrder !== undefined) {
      up.input('order', sql.Int, patchOrder)
      sets.push('Orden = @order')
    }
    if (patchState !== undefined) {
      up.input('state', sql.VarChar(30), patchState)
      sets.push('Estado = @state')
    }
    if (patchResponsible !== undefined) {
      up.input('responsibleUserId', sql.UniqueIdentifier, patchResponsible)
      sets.push('IdUsuarioResponsable = @responsibleUserId')
    }

    if (sets.length === 0) {
      res.status(200).json({ success: true, data: mapAgendaRow(current) })
      return
    }
    sets.push('FechaActualizacion = GETDATE()')

    await up.query(`
      UPDATE dbo.ReunionesOrdenDia
      SET ${sets.join(', ')}
      WHERE Id = @itemId;
    `)

    const updated = await getAgendaItemRowOrThrowSameMeeting(meetingId, itemId)
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.agenda.item.updated',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: {
        agendaId: itemId,
        previous: {
          title: current.Titulo,
          parentId: current.IdItemPadre,
          state: current.Estado,
        },
        next: {
          title: updated.Titulo,
          parentId: updated.IdItemPadre,
          state: updated.Estado,
        },
      },
      req,
    })
    res.status(200).json({ success: true, data: mapAgendaRow(updated) })
  } catch (err) {
    next(err)
  }
}

async function recursiveCollectDescendantsIds(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  rootIds: string[]
): Promise<string[]> {
  const result: string[] = []
  let frontier: string[] = [...rootIds]
  while (frontier.length > 0) {
    const tbl = new Set(frontier)
    const placeholders = [...tbl].map((_, i) => `@id${i}`).join(',')
    const q = pool.request()
    ;[...tbl].forEach((g, i) => q.input(`id${i}`, sql.UniqueIdentifier, g))
    const rows = await q.query<{ Id: string }>(`
      SELECT Id FROM dbo.ReunionesOrdenDia WHERE IdItemPadre IN (${placeholders});
    `)
    const next: string[] = rows.recordset.map((r) => String(r.Id)).filter((x) => tbl.has(x) === false)
    frontier = next
    result.push(...next)
  }
  return result
}

export async function deleteMeetingAgendaItem(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const itemId = String(req.params.itemId || '')
    const current = await getAgendaItemRowOrThrowSameProject(projectId, itemId, auth.organizationId)
    const meetingId = String(current.IdReunion)
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const orphanStrategy =
      req.body?.orphanStrategy === 'DELETE_CHILDREN'
        ? 'DELETE_CHILDREN'
        : 'PROMOTE_CHILDREN'

    const pool = await getDbPool()
    const tx = pool.transaction()

    try {
      await tx.begin()
      if (orphanStrategy === 'PROMOTE_CHILDREN') {
        const q1 = tx.request()
        q1.input('parentId', sql.UniqueIdentifier, itemId)
        await q1.query(`
          UPDATE dbo.ReunionesOrdenDia SET IdItemPadre = NULL WHERE IdItemPadre = @parentId;
        `)
        const q2 = tx.request()
        q2.input('itemId', sql.UniqueIdentifier, itemId)
        await q2.query(`DELETE FROM dbo.ReunionesOrdenDia WHERE Id = @itemId;`)
      } else {
        const descendants = await recursiveCollectDescendantsIds(pool, [itemId])
        const allIds = [...descendants, itemId]
        for (const id of allIds) {
          const qu = tx.request()
          qu.input('id', sql.UniqueIdentifier, id)
          await qu.query(
            `UPDATE dbo.ReunionesOrdenDia SET IdItemPadre = NULL WHERE IdItemPadre = @id;`
          )
        }
        for (const id of allIds) {
          const qd = tx.request()
          qd.input('id', sql.UniqueIdentifier, id)
          await qd.query(`DELETE FROM dbo.ReunionesOrdenDia WHERE Id = @id;`)
        }
      }
      await tx.commit()
    } catch (txErr) {
      try {
        await tx.rollback()
      } catch {
        /* noop */
      }
      throw txErr
    }

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.agenda.item.deleted',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: {
        agendaId: itemId,
        title: current.Titulo,
        orphanStrategy,
      },
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function reorderMeetingAgenda(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const meetingId = String(req.params.meetingId || '')
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const parentIdRaw =
      req.body?.parentId === undefined || req.body?.parentId == null
        ? null
        : String(req.body.parentId)
    await assertParentBelongsToSameMeeting(meetingId, parentIdRaw)

    const ordering: Array<{ itemId: string; order: number }> = Array.isArray(
      req.body?.ordering
    )
      ? req.body.ordering
      : []
    if (ordering.length === 0) {
      throw new AppError('ordering es requerido (array no vacío)', 400)
    }

    const normalized = ordering.map((o) => ({
      itemId: String(o.itemId),
      order: Math.trunc(Number(o.order)) || 0,
    }))

    const pool = await getDbPool()
    const tx = pool.transaction()
    try {
      await tx.begin()
      for (const entry of normalized) {
        const qItem = tx.request()
        qItem.input('meetingId', sql.UniqueIdentifier, meetingId)
        qItem.input('itemId', sql.UniqueIdentifier, entry.itemId)
        if (parentIdRaw == null) {
          qItem.input('parentIsNull', sql.Bit, 1)
        } else {
          qItem.input('parentId', sql.UniqueIdentifier, parentIdRaw)
        }
        const check = await qItem.query<{ Id: string }>(
          parentIdRaw == null
            ? `
              SELECT Id FROM dbo.ReunionesOrdenDia
               WHERE Id = @itemId AND IdReunion = @meetingId AND IdItemPadre IS NULL;
            `
            : `
              SELECT Id FROM dbo.ReunionesOrdenDia
               WHERE Id = @itemId AND IdReunion = @meetingId AND IdItemPadre = @parentId;
            `
        )
        if (!check.recordset[0]) {
          throw new AppError(
            `itemId ${entry.itemId} no pertenece al nivel solicitado en esta reunión`,
            400
          )
        }
        const up = tx.request()
        up.input('itemId', sql.UniqueIdentifier, entry.itemId)
        up.input('order', sql.Int, entry.order)
        await up.query(`
          UPDATE dbo.ReunionesOrdenDia
             SET Orden = @order, FechaActualizacion = GETDATE()
           WHERE Id = @itemId;
        `)
      }
      await tx.commit()
    } catch (txErr) {
      try {
        await tx.rollback()
      } catch {
        /* noop */
      }
      throw txErr
    }

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.agenda.reordered',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: { parentId: parentIdRaw, count: normalized.length },
      req,
    })
    res.status(200).json({ success: true, data: undefined })
  } catch (err) {
    next(err)
  }
}

export async function moveMeetingAgendaItem(
  req: Request,
  res: Response<ApiResponse<MeetingAgendaItem>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const itemId = String(req.params.itemId || '')
    const current = await getAgendaItemRowOrThrowSameProject(projectId, itemId, auth.organizationId)
    const meetingId = String(current.IdReunion)
    const meeting = await getMeetingAndAssertScope(projectId, meetingId, auth.organizationId)

    const parentIdRaw =
      req.body?.parentId === undefined || req.body?.parentId == null
        ? null
        : String(req.body.parentId)
    await assertParentBelongsToSameMeeting(meetingId, parentIdRaw, itemId)

    const hasOrderPatch =
      req.body?.order !== undefined && req.body?.order !== null
    const nextOrder = hasOrderPatch
      ? Math.trunc(Number(req.body.order)) || 0
      : null

    const previousParent = current.IdItemPadre ? String(current.IdItemPadre) : null

    const pool = await getDbPool()
    const tx = pool.transaction()
    try {
      await tx.begin()

      const sets: string[] = []
      const up = tx.request()
      up.input('itemId', sql.UniqueIdentifier, itemId)

      up.input('parentId', sql.UniqueIdentifier, parentIdRaw)
      sets.push('IdItemPadre = @parentId')

      if (hasOrderPatch) {
        up.input('order', sql.Int, nextOrder)
        sets.push('Orden = @order')
      } else {
        const maxQ = tx.request()
        maxQ.input('meetingId', sql.UniqueIdentifier, meetingId)
        let computedOrder: number
        if (parentIdRaw == null) {
          const r = await maxQ.query<{ m: number | null }>(`
            SELECT ISNULL(MAX(Orden), -1) m FROM dbo.ReunionesOrdenDia
             WHERE IdReunion = @meetingId AND IdItemPadre IS NULL;
          `)
          computedOrder = Number(r.recordset[0]?.m ?? -1) + 1
        } else {
          maxQ.input('parentId', sql.UniqueIdentifier, parentIdRaw)
          const r = await maxQ.query<{ m: number | null }>(`
            SELECT ISNULL(MAX(Orden), -1) m FROM dbo.ReunionesOrdenDia
             WHERE IdReunion = @meetingId AND IdItemPadre = @parentId;
          `)
          computedOrder = Number(r.recordset[0]?.m ?? -1) + 1
        }
        up.input('order', sql.Int, computedOrder)
        sets.push('Orden = @order')
      }
      sets.push('FechaActualizacion = GETDATE()')

      await up.query(`
        UPDATE dbo.ReunionesOrdenDia
        SET ${sets.join(', ')}
        WHERE Id = @itemId;
      `)
      await tx.commit()
    } catch (txErr) {
      try {
        await tx.rollback()
      } catch {
        /* noop */
      }
      throw txErr
    }

    const updated = await getAgendaItemRowOrThrowSameMeeting(meetingId, itemId)
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'meeting.agenda.item.moved',
      resourceType: 'meeting',
      resourceId: meetingId,
      resourceName: meeting.Titulo,
      projectId,
      extra: {
        agendaId: itemId,
        previousParent,
        nextParent: parentIdRaw,
        order: hasOrderPatch ? nextOrder : null,
      },
      req,
    })
    res.status(200).json({ success: true, data: mapAgendaRow(updated) })
  } catch (err) {
    next(err)
  }
}
