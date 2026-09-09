import type { NextFunction, Request, Response } from 'express'
import {
  type ApiResponse,
  type PaginatedResult,
  type ProjectTopic,
  type ProjectTopicItem,
  type ProjectTopicItemMember,
  type TopicItemStatus,
  type TopicStatus,
  DB_TOPIC_ITEM_STATUS,
  DB_TOPIC_STATUS,
} from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { logAuditRecord } from '../../shared/db/audit'
import { AppError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

type TopicRow = {
  Id: string
  IdProyecto: string
  Titulo: string
  Descripcion: string | null
  IdCreador: string | null
  Estado: string
  Orden: number
  Porcentaje: number
  FechaCreacion: Date
  FechaActualizacion: Date | null
}

type TopicItemRow = {
  Id: string
  IdTema: string
  Titulo: string
  Descripcion: string | null
  Estado: string
  Orden: number
  FechaCreacion: Date
  FechaActualizacion: Date | null
}

type TopicItemMemberRow = {
  Id: string
  IdTemaItem: string
  IdMiembroProyecto: string
  IdUsuario: string | null
  NombreUsuario: string | null
  NombreRol: string | null
  FechaAsignacion: Date
}

const DB_TO_API_STATUS: Record<string, TopicStatus> = DB_TOPIC_STATUS

const API_TO_DB_STATUS: Record<TopicStatus, keyof typeof DB_TOPIC_STATUS> = {
  OPEN: 'ABIERTO',
  IN_REVIEW: 'EN_REVISION',
  RESOLVED: 'RESUELTO',
  CLOSED: 'CERRADO',
  IN_PROGRESS: 'EN_PROGRESO',
}

const DB_TO_API_ITEM_STATUS: Record<string, TopicItemStatus> = DB_TOPIC_ITEM_STATUS

const API_TO_DB_ITEM_STATUS: Record<TopicItemStatus, keyof typeof DB_TOPIC_ITEM_STATUS> = {
  PENDING: 'PENDIENTE',
  IN_PROGRESS: 'EN_PROGRESO',
  COMPLETED: 'COMPLETADO',
  BLOCKED: 'BLOQUEADO',
}

function mapTopic(row: TopicRow): ProjectTopic {
  const rawStatus = String(row.Estado || '').toUpperCase()
  return {
    id: String(row.Id),
    projectId: String(row.IdProyecto),
    title: String(row.Titulo),
    description: row.Descripcion ?? null,
    createdBy: row.IdCreador ? String(row.IdCreador) : null,
    status: DB_TO_API_STATUS[rawStatus] ?? 'OPEN',
    order: Number(row.Orden || 0),
    percentage: Math.max(0, Math.min(100, Number(row.Porcentaje || 0))),
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
  }
}

function mapTopicItem(row: TopicItemRow, membersByItem: Map<string, TopicItemMemberRow[]>): ProjectTopicItem {
  const rawStatus = String(row.Estado || '').toUpperCase()
  const rowMembers = membersByItem.get(String(row.Id)) || []
  const assignedMembers = rowMembers.map(m => ({
    assignmentId: String(m.Id),
    projectMemberId: String(m.IdMiembroProyecto),
    userId: m.IdUsuario ? String(m.IdUsuario) : '',
    userName: m.NombreUsuario ?? null,
    roleName: m.NombreRol ?? null,
    assignedAt: sqlLocalToIso(m.FechaAsignacion as any),
  }))
  return {
    id: String(row.Id),
    topicId: String(row.IdTema),
    title: String(row.Titulo),
    description: row.Descripcion ?? null,
    status: DB_TO_API_ITEM_STATUS[rawStatus] ?? 'PENDING',
    order: Number(row.Orden || 0),
    assignedMemberIds: assignedMembers.map(m => m.projectMemberId),
    assignedMembers,
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
  }
}

function mapTopicItemMember(r: TopicItemMemberRow): ProjectTopicItemMember {
  return {
    id: String(r.Id),
    topicItemId: String(r.IdTemaItem),
    projectMemberId: String(r.IdMiembroProyecto),
    assignedAt: sqlLocalToIso(r.FechaAsignacion as any),
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

function parseOptionalTopicItemStatus(value: unknown): keyof typeof DB_TOPIC_ITEM_STATUS | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const raw = String(value).trim().toUpperCase()
  if ((raw as keyof typeof DB_TOPIC_ITEM_STATUS) in DB_TOPIC_ITEM_STATUS) {
    return raw as keyof typeof DB_TOPIC_ITEM_STATUS
  }
  if ((raw as TopicItemStatus) in API_TO_DB_ITEM_STATUS) {
    return API_TO_DB_ITEM_STATUS[raw as TopicItemStatus]
  }
  throw new AppError('Estado de ítem inválido', 400)
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
      t.Id, t.IdProyecto, t.Titulo, t.Descripcion, t.IdCreador, t.Estado, t.Orden, t.Porcentaje,
      t.FechaCreacion, t.FechaActualizacion
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

async function getTopicItemRowOrThrow(
  projectId: string,
  topicId: string,
  itemId: string,
  organizationId: string
): Promise<TopicItemRow> {
  const pool = await getDbPool()
  const q = pool.request()
  q.input('projectId', sql.UniqueIdentifier, projectId)
  q.input('topicId', sql.UniqueIdentifier, topicId)
  q.input('itemId', sql.UniqueIdentifier, itemId)
  q.input('orgId', sql.UniqueIdentifier, organizationId)
  const r = await q.query<TopicItemRow>(`
    SELECT
      i.Id, i.IdTema, i.Titulo, i.Descripcion, i.Estado, i.Orden,
      i.FechaCreacion, i.FechaActualizacion
    FROM dbo.TemasProyectoItems i
    INNER JOIN dbo.TemasProyecto t ON t.Id = i.IdTema
    INNER JOIN dbo.Proyectos p ON p.Id = t.IdProyecto
    WHERE i.Id = @itemId
      AND i.IdTema = @topicId
      AND t.IdProyecto = @projectId
      AND p.IdOrganizacion = @orgId
      AND ISNULL(p.Estado, 'ACTIVO') <> 'ELIMINADO';
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Ítem del tema no encontrado')
  return row
}

export async function recalculateProjectProgress(projectId: string): Promise<{ projectPercentage: number; affectedTopics: number }> {
  if (!projectId) throw new AppError('projectId requerido para recálculo', 400)
  const pool = await getDbPool()
  const transaction = new sql.Transaction(pool)
  let affectedTopics = 0
  let projectPercentage = 0
  try {
    await transaction.begin()

    // 1. Recalcular % por cada tema del proyecto
    const temasRows = await transaction
      .request()
      .input('projectId', sql.UniqueIdentifier, projectId)
      .query(`
        SELECT
          t.Id,
          COUNT(i.Id)                                                             AS total_items,
          COUNT(CASE WHEN i.Estado = 'COMPLETADO' THEN 1 END)                    AS completados
        FROM dbo.TemasProyecto t
        LEFT JOIN dbo.TemasProyectoItems i ON i.IdTema = t.Id
        WHERE t.IdProyecto = @projectId
        GROUP BY t.Id
      `)

    for (const row of temasRows.recordset as Array<{ Id: string; total_items: number; completados: number }>) {
      const pctRaw = row.total_items === 0 ? 0 : Math.round(100 * row.completados / row.total_items)
      const pct = Math.max(0, Math.min(100, pctRaw))
      const result = await transaction
        .request()
        .input('topicId', sql.UniqueIdentifier, row.Id)
        .input('pct', sql.TinyInt, pct)
        .query(`
          UPDATE dbo.TemasProyecto
             SET Porcentaje = @pct,
                 FechaActualizacion = GETDATE()
           WHERE Id = @topicId AND Porcentaje <> @pct
        `)
      affectedTopics += Number(result.rowsAffected[0] || 0)
    }

    // 2. Calcular % promedio de todos los temas del proyecto
    const avgRow = await transaction
      .request()
      .input('projectId', sql.UniqueIdentifier, projectId)
      .query(`
        SELECT
          CASE WHEN COUNT(t.Id) = 0 THEN 0
               ELSE CAST(AVG(CAST(t.Porcentaje AS DECIMAL(10, 2))) AS TINYINT) END AS pct
        FROM dbo.TemasProyecto t
        WHERE t.IdProyecto = @projectId
      `)
    const pctRaw = Number(avgRow.recordset[0]?.pct ?? 0)
    projectPercentage = Math.max(0, Math.min(100, pctRaw))

    await transaction
      .request()
      .input('projectId', sql.UniqueIdentifier, projectId)
      .input('pct', sql.TinyInt, projectPercentage)
      .query(`
        UPDATE dbo.Proyectos
           SET ProgresoPorcentaje = @pct,
               FechaActualizacion = GETDATE()
         WHERE Id = @projectId AND ProgresoPorcentaje <> @pct
      `)

    await transaction.commit()
    return { projectPercentage, affectedTopics }
  } catch (err) {
    try { await transaction.rollback() } catch(_) { /* ignore */ }
    throw err
  }
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
        t.Id, t.IdProyecto, t.Titulo, t.Descripcion, t.IdCreador, t.Estado, t.Orden, t.Porcentaje,
        t.FechaCreacion, t.FechaActualizacion
      FROM dbo.TemasProyecto t
      INNER JOIN dbo.Proyectos p ON p.Id = t.IdProyecto
      WHERE ${where}
      ORDER BY t.Orden ASC, t.FechaActualizacion DESC, t.FechaCreacion DESC
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
    if (title.length < 1 || title.length > 255) throw new AppError('Título inválido (1..255)', 400)
    const description = (req.body?.description === null || req.body?.description === undefined) ? null : String(req.body.description)
    const order = req.body?.order === undefined ? 0 : Math.max(0, Math.min(1_000_000, Number(req.body.order || 0)))
    const status = parseOptionalTopicStatus(req.body?.status) ?? 'ABIERTO'

    const pool = await getDbPool()
    const ins = pool.request()
    ins.input('projectId', sql.UniqueIdentifier, projectId)
    ins.input('title', sql.NVarChar(255), title)
    ins.input('description', sql.NVarChar(sql.MAX), description)
    ins.input('createdBy', sql.UniqueIdentifier, auth.userId)
    ins.input('status', sql.VarChar(30), status)
    ins.input('order', sql.Int, order)
    const created = await ins.query<{ Id: string }>(`
      INSERT INTO dbo.TemasProyecto (
        IdProyecto, Titulo, Descripcion, IdCreador, Estado, Orden, Porcentaje, FechaCreacion, FechaActualizacion
      )
      OUTPUT INSERTED.Id
      VALUES (
        @projectId, @title, @description, @createdBy, @status, @order, 0, GETDATE(), GETDATE()
      );
    `)
    const topicId = String(created.recordset[0]?.Id || '')
    if (!topicId) throw new AppError('No se pudo crear el tema', 500)

    await recalculateProjectProgress(projectId)
    const row = await getTopicRowOrThrow(projectId, topicId, auth.organizationId)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic.creado',
      resourceType: 'topic',
      resourceId: topicId,
      resourceName: title,
      extra: { projectId, order, status },
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
    const patchDescription = req.body?.description === undefined
      ? undefined
      : (req.body?.description === null || req.body?.description === undefined) ? null : String(req.body.description)
    const patchOrder = req.body?.order === undefined
      ? undefined
      : Math.max(0, Math.min(1_000_000, Number(req.body.order || 0)))

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
    if (patchDescription !== undefined) {
      up.input('description', sql.NVarChar(sql.MAX), patchDescription)
      sets.push('Descripcion = @description')
    }
    if (patchOrder !== undefined) {
      up.input('order', sql.Int, patchOrder)
      sets.push('Orden = @order')
    }
    if (sets.length === 0) {
      res.status(200).json({ success: true, data: mapTopic(current) })
      return
    }
    sets.push('FechaActualizacion = GETDATE()')
    await up.query(`UPDATE dbo.TemasProyecto SET ${sets.join(', ')} WHERE Id = @topicId`)

    await recalculateProjectProgress(projectId)
    const row = await getTopicRowOrThrow(projectId, topicId, auth.organizationId)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic.actualizado',
      resourceType: 'topic',
      resourceId: topicId,
      resourceName: String(row.Titulo),
      extra: { projectId, changes: sets.length },
      req,
    })
    res.status(200).json({ success: true, data: mapTopic(row) })
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

    const pool = await getDbPool()
    const del = pool.request()
    del.input('topicId', sql.UniqueIdentifier, topicId)

    // Pre-cleanup for NO ACTION FKs (manual per project_memory):
    //   * ReunionesTemasVinculados (FK_RTV_Tema → NO_ACTION para evitar ciclos CASCADE)
    //   * TemasProyectoItemMiembros → Items → Tema
    await del.query(`
      DELETE FROM dbo.ReunionesTemasVinculados WHERE IdTema = @topicId;
      DELETE FROM dbo.TemasProyectoItemMiembros
       WHERE IdTemaItem IN (SELECT Id FROM dbo.TemasProyectoItems WHERE IdTema = @topicId);
      DELETE FROM dbo.TemasProyectoItems WHERE IdTema = @topicId;
      DELETE FROM dbo.TemasProyecto WHERE Id = @topicId;
    `)
    await recalculateProjectProgress(projectId)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic.eliminado',
      resourceType: 'topic',
      resourceId: topicId,
      resourceName: String(current.Titulo),
      extra: { projectId },
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ============================================================
// ITEMS (conceptos / checklist)
// ============================================================

export async function listTopicItems(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<ProjectTopicItem>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    await getTopicRowOrThrow(projectId, topicId, auth.organizationId) // scope

    const page = Math.max(1, Number(req.query.page || '1'))
    const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize || '50')))
    const pool = await getDbPool()

    const countRow = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, topicId)
      .query<{ total: number }>(`SELECT COUNT(*) total FROM dbo.TemasProyectoItems WHERE IdTema = @topicId`)
    const total = Number(countRow.recordset[0]?.total ?? 0)
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const itemsRows = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, topicId)
      .query<TopicItemRow>(`
        SELECT Id, IdTema, Titulo, Descripcion, Estado, Orden, FechaCreacion, FechaActualizacion
          FROM dbo.TemasProyectoItems
         WHERE IdTema = @topicId
         ORDER BY Orden ASC, FechaCreacion ASC
         OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY
      `)

    const itemIds = itemsRows.recordset.map(r => String(r.Id))
    const membersByItem = new Map<string, TopicItemMemberRow[]>()
    if (itemIds.length > 0) {
      const guidsLiteral = itemIds
        .map((id) => {
          return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)
            ? `CAST('${id}' AS UNIQUEIDENTIFIER)`
            : null
        })
        .filter((v): v is string => v !== null && v !== undefined)
        .join(', ')
      const inClause = guidsLiteral.length > 0
        ? `WHERE m.IdTemaItem IN (${guidsLiteral})`
        : `WHERE 1 = 0`
      const membersRows = await pool
        .request()
        .query<TopicItemMemberRow>(`
          SELECT m.Id,
                 m.IdTemaItem,
                 m.IdMiembroProyecto,
                 u.Id                              AS IdUsuario,
                 COALESCE(u.NombreCompleto, u.Correo, NULL) AS NombreUsuario,
                 mp.NombreRol                      AS NombreRol,
                 m.FechaAsignacion
            FROM dbo.TemasProyectoItemMiembros m
            JOIN dbo.MiembrosProyecto mp ON mp.Id = m.IdMiembroProyecto
            LEFT JOIN dbo.Usuarios u ON u.Id = mp.IdUsuario
            ${inClause}
        `)
      for (const mr of membersRows.recordset as TopicItemMemberRow[]) {
        const key = String(mr.IdTemaItem)
        const arr = membersByItem.get(key) ?? []
        arr.push(mr)
        membersByItem.set(key, arr)
      }
    }

    res.status(200).json({
      success: true,
      data: {
        items: itemsRows.recordset.map(r => mapTopicItem(r, membersByItem)),
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

export async function getTopicItem(
  req: Request,
  res: Response<ApiResponse<ProjectTopicItem>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const itemId = String(req.params.itemId || '')
    const row = await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const pool = await getDbPool()
    const mr = await pool
      .request()
      .input('itemId', sql.UniqueIdentifier, itemId)
      .query<TopicItemMemberRow>(`
        SELECT m.Id, m.IdTemaItem, m.IdMiembroProyecto,
               u.Id                              AS IdUsuario,
               COALESCE(u.NombreCompleto, u.Correo, NULL) AS NombreUsuario,
               mp.NombreRol                      AS NombreRol,
               m.FechaAsignacion
          FROM dbo.TemasProyectoItemMiembros m
          JOIN dbo.MiembrosProyecto mp ON mp.Id = m.IdMiembroProyecto
          LEFT JOIN dbo.Usuarios u ON u.Id = mp.IdUsuario
         WHERE m.IdTemaItem = @itemId
      `)
    const map = new Map<string, TopicItemMemberRow[]>()
    map.set(itemId, mr.recordset as TopicItemMemberRow[])
    res.status(200).json({ success: true, data: mapTopicItem(row, map) })
  } catch (err) {
    next(err)
  }
}

export async function createTopicItem(
  req: Request,
  res: Response<ApiResponse<ProjectTopicItem>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    await getTopicRowOrThrow(projectId, topicId, auth.organizationId)

    const title = String(req.body?.title || '').trim()
    if (title.length < 1 || title.length > 255) throw new AppError('Título ítem inválido (1..255)', 400)
    const description = (req.body?.description === null || req.body?.description === undefined) ? null : String(req.body.description)
    const order = req.body?.order === undefined ? 0 : Math.max(0, Math.min(1_000_000, Number(req.body.order || 0)))
    const status = parseOptionalTopicItemStatus(req.body?.status) ?? 'PENDIENTE'
    const assignedMemberIdsRaw = req.body?.assignedMemberIds
    const assignedMemberIds: string[] = Array.isArray(assignedMemberIdsRaw)
      ? assignedMemberIdsRaw.map((v) => String(v).trim()).filter((v) => v.length > 0)
      : []

    const pool = await getDbPool()
    const ins = pool.request()
    ins.input('topicId', sql.UniqueIdentifier, topicId)
    ins.input('title', sql.NVarChar(255), title)
    ins.input('description', sql.NVarChar(sql.MAX), description)
    ins.input('status', sql.VarChar(30), status)
    ins.input('order', sql.Int, order)
    const created = await ins.query<{ Id: string }>(`
      INSERT INTO dbo.TemasProyectoItems (IdTema, Titulo, Descripcion, Estado, Orden, FechaCreacion, FechaActualizacion)
      OUTPUT INSERTED.Id
      VALUES (@topicId, @title, @description, @status, @order, GETDATE(), GETDATE());
    `)
    const itemId = String(created.recordset[0]?.Id || '')
    if (!itemId) throw new AppError('No se pudo crear el ítem', 500)

    if (assignedMemberIds.length > 0) {
      for (const pmId of assignedMemberIds) {
        try {
          await pool
            .request()
            .input('itemId', sql.UniqueIdentifier, itemId)
            .input('projectMemberId', sql.UniqueIdentifier, pmId)
            .input('projectId', sql.UniqueIdentifier, projectId)
            .query(`
              INSERT INTO dbo.TemasProyectoItemMiembros (IdTemaItem, IdMiembroProyecto, FechaAsignacion)
              SELECT TOP (1) @itemId, @projectMemberId, GETDATE()
               WHERE EXISTS (
                 SELECT 1 FROM dbo.MiembrosProyecto mp
                  WHERE mp.Id = @projectMemberId AND mp.IdProyecto = @projectId
               )
                 AND NOT EXISTS (
                 SELECT 1 FROM dbo.TemasProyectoItemMiembros ex
                  WHERE ex.IdTemaItem = @itemId AND ex.IdMiembroProyecto = @projectMemberId
               );
            `)
        } catch {
          /* skip duplicates / invalid ids - safe to ignore; consistency kept by filter above */
        }
      }
    }

    await recalculateProjectProgress(projectId)
    const row = await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const members = await pool
      .request()
      .input('itemId', sql.UniqueIdentifier, itemId)
      .query<TopicItemMemberRow>(`
        SELECT m.Id, m.IdTemaItem, m.IdMiembroProyecto,
               u.Id                              AS IdUsuario,
               COALESCE(u.NombreCompleto, u.Correo, NULL) AS NombreUsuario,
               mp.NombreRol                      AS NombreRol,
               m.FechaAsignacion
          FROM dbo.TemasProyectoItemMiembros m
          JOIN dbo.MiembrosProyecto mp ON mp.Id = m.IdMiembroProyecto
          LEFT JOIN dbo.Usuarios u ON u.Id = mp.IdUsuario
         WHERE m.IdTemaItem = @itemId
      `)
    const map = new Map<string, TopicItemMemberRow[]>()
    map.set(itemId, members.recordset as TopicItemMemberRow[])

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic_item.creado',
      resourceType: 'topic_item',
      resourceId: itemId,
      resourceName: title,
      extra: { projectId, topicId, assignedCount: assignedMemberIds.length },
      req,
    })
    res.status(201).json({ success: true, data: mapTopicItem(row, map) })
  } catch (err) {
    next(err)
  }
}

export async function updateTopicItem(
  req: Request,
  res: Response<ApiResponse<ProjectTopicItem>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const itemId = String(req.params.itemId || '')
    await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const patchTitle = req.body?.title !== undefined ? String(req.body.title || '').trim() : undefined
    const patchStatus = parseOptionalTopicItemStatus(req.body?.status)
    const patchDescription = req.body?.description === undefined
      ? undefined
      : (req.body?.description === null || req.body?.description === undefined) ? null : String(req.body.description)
    const patchOrder = req.body?.order === undefined
      ? undefined
      : Math.max(0, Math.min(1_000_000, Number(req.body.order || 0)))
    const patchMembers = Array.isArray(req.body?.assignedMemberIds)
      ? (req.body.assignedMemberIds as unknown[]).map((v) => String(v).trim()).filter((v) => v.length > 0)
      : undefined

    if (patchTitle !== undefined && (patchTitle.length < 1 || patchTitle.length > 255)) {
      throw new AppError('Título ítem inválido (1..255)', 400)
    }

    const sets: string[] = []
    const pool = await getDbPool()
    const up = pool.request()
    up.input('itemId', sql.UniqueIdentifier, itemId)
    if (patchTitle !== undefined) {
      up.input('title', sql.NVarChar(255), patchTitle)
      sets.push('Titulo = @title')
    }
    if (patchStatus !== undefined) {
      up.input('status', sql.VarChar(30), patchStatus)
      sets.push('Estado = @status')
    }
    if (patchDescription !== undefined) {
      up.input('description', sql.NVarChar(sql.MAX), patchDescription)
      sets.push('Descripcion = @description')
    }
    if (patchOrder !== undefined) {
      up.input('order', sql.Int, patchOrder)
      sets.push('Orden = @order')
    }
    if (sets.length > 0) {
      sets.push('FechaActualizacion = GETDATE()')
      await up.query(`UPDATE dbo.TemasProyectoItems SET ${sets.join(', ')} WHERE Id = @itemId`)
    }

    if (patchMembers !== undefined) {
      await pool
        .request()
        .input('itemId', sql.UniqueIdentifier, itemId)
        .query(`DELETE FROM dbo.TemasProyectoItemMiembros WHERE IdTemaItem = @itemId;`)

      for (const pmId of patchMembers) {
        try {
          await pool
            .request()
            .input('itemId', sql.UniqueIdentifier, itemId)
            .input('projectMemberId', sql.UniqueIdentifier, pmId)
            .input('projectId', sql.UniqueIdentifier, projectId)
            .query(`
              INSERT INTO dbo.TemasProyectoItemMiembros (IdTemaItem, IdMiembroProyecto, FechaAsignacion)
              SELECT TOP (1) @itemId, @projectMemberId, GETDATE()
               WHERE EXISTS (
                 SELECT 1 FROM dbo.MiembrosProyecto mp
                  WHERE mp.Id = @projectMemberId AND mp.IdProyecto = @projectId
               );
            `)
        } catch {
          /* skip malformed guids / duplicates */
        }
      }
    }

    await recalculateProjectProgress(projectId)
    const row = await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const members = await pool
      .request()
      .input('itemId', sql.UniqueIdentifier, itemId)
      .query<TopicItemMemberRow>(`
        SELECT m.Id, m.IdTemaItem, m.IdMiembroProyecto,
               u.Id                              AS IdUsuario,
               COALESCE(u.NombreCompleto, u.Correo, NULL) AS NombreUsuario,
               mp.NombreRol                      AS NombreRol,
               m.FechaAsignacion
          FROM dbo.TemasProyectoItemMiembros m
          JOIN dbo.MiembrosProyecto mp ON mp.Id = m.IdMiembroProyecto
          LEFT JOIN dbo.Usuarios u ON u.Id = mp.IdUsuario
         WHERE m.IdTemaItem = @itemId
      `)
    const map = new Map<string, TopicItemMemberRow[]>()
    map.set(itemId, members.recordset as TopicItemMemberRow[])
    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic_item.actualizado',
      resourceType: 'topic_item',
      resourceId: itemId,
      resourceName: String(row.Titulo),
      extra: { projectId, topicId, changes: sets.length, membersChanged: patchMembers !== undefined },
      req,
    })
    res.status(200).json({ success: true, data: mapTopicItem(row, map) })
  } catch (err) {
    next(err)
  }
}

export async function deleteTopicItem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const itemId = String(req.params.itemId || '')
    const current = await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const pool = await getDbPool()
    const del = pool.request()
    del.input('itemId', sql.UniqueIdentifier, itemId)
    await del.query(`
      DELETE FROM dbo.TemasProyectoItemMiembros WHERE IdTemaItem = @itemId;
      DELETE FROM dbo.TemasProyectoItems WHERE Id = @itemId;
    `)
    await recalculateProjectProgress(projectId)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic_item.eliminado',
      resourceType: 'topic_item',
      resourceId: itemId,
      resourceName: String(current.Titulo),
      extra: { projectId, topicId },
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ============================================================
// ITEM -> MIEMBROS PROYECTO
// ============================================================

export async function listTopicItemMembers(
  req: Request,
  res: Response<ApiResponse<ProjectTopicItemMember[]>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const itemId = String(req.params.itemId || '')
    await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const pool = await getDbPool()
    const rs = await pool
      .request()
      .input('itemId', sql.UniqueIdentifier, itemId)
      .query<TopicItemMemberRow>(`
        SELECT Id, IdTemaItem, IdMiembroProyecto, FechaAsignacion
          FROM dbo.TemasProyectoItemMiembros
         WHERE IdTemaItem = @itemId
         ORDER BY FechaAsignacion ASC
      `)
    res.status(200).json({
      success: true,
      data: (rs.recordset as TopicItemMemberRow[]).map(mapTopicItemMember),
    })
  } catch (err) {
    next(err)
  }
}

export async function getProjectMembersForTopicItem(
  req: Request,
  res: Response<ApiResponse<Array<{
    projectMemberId: string
    userId: string
    userName: string | null
    roleName: string | null
    joinedAt: string
    alreadyAssigned: boolean
    assignmentId?: string | null
  }>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const itemId = String(req.params.itemId || '')
    await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const pool = await getDbPool()
    const rows = await pool
      .request()
      .input('projectId', sql.UniqueIdentifier, projectId)
      .input('itemId', sql.UniqueIdentifier, itemId)
      .query(`
        SELECT
          mp.Id                 AS IdMiembroProyecto,
          mp.IdUsuario          AS IdUsuario,
          COALESCE(u.NombreCompleto, u.Correo, NULL) AS NombreUsuario,
          mp.NombreRol          AS NombreRol,
          mp.FechaIngreso       AS FechaIngreso,
          CASE WHEN m.Id IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS already_assigned,
          m.Id                  AS AsignacionId
        FROM dbo.MiembrosProyecto mp
        LEFT JOIN dbo.Usuarios u ON u.Id = mp.IdUsuario
        LEFT JOIN dbo.TemasProyectoItemMiembros m
               ON m.IdMiembroProyecto = mp.Id AND m.IdTemaItem = @itemId
        WHERE mp.IdProyecto = @projectId
        ORDER BY COALESCE(u.NombreCompleto, u.Correo, '') ASC
      `)
    const data = rows.recordset.map(r => ({
      projectMemberId: String(r.IdMiembroProyecto),
      userId: String(r.IdUsuario),
      userName: r.NombreUsuario ?? null,
      roleName: r.NombreRol ?? null,
      joinedAt: sqlLocalToIso(r.FechaIngreso as any),
      alreadyAssigned: Boolean(r.already_assigned),
      assignmentId: r.AsignacionId ? String(r.AsignacionId) : null,
    }))
    res.status(200).json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function assignMemberToItem(
  req: Request,
  res: Response<ApiResponse<ProjectTopicItemMember>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const itemId = String(req.params.itemId || '')
    await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)

    const projectMemberId = String(req.body?.projectMemberId || '').trim()
    if (!projectMemberId) throw new AppError('projectMemberId requerido', 400)

    const pool = await getDbPool()
    const verifyReq = pool.request()
    verifyReq.input('projectId', sql.UniqueIdentifier, projectId)
    verifyReq.input('projectMemberId', sql.UniqueIdentifier, projectMemberId)
    const verifyRow = await verifyReq.query<{ n: number }>(`
      SELECT COUNT(*) n
        FROM dbo.MiembrosProyecto
       WHERE Id = @projectMemberId AND IdProyecto = @projectId
    `)
    if (Number(verifyRow.recordset[0]?.n ?? 0) === 0) {
      throw new NotFoundError('Miembro del proyecto no encontrado')
    }

    const ins = pool.request()
    ins.input('itemId', sql.UniqueIdentifier, itemId)
    ins.input('projectMemberId', sql.UniqueIdentifier, projectMemberId)
    const created = await ins.query<{ Id: string }>(`
      INSERT INTO dbo.TemasProyectoItemMiembros (IdTemaItem, IdMiembroProyecto, FechaAsignacion)
      OUTPUT INSERTED.Id
      VALUES (@itemId, @projectMemberId, GETDATE());
    `)
    const assignmentId = String(created.recordset[0]?.Id || '')
    if (!assignmentId) throw new AppError('No se pudo asignar el miembro', 500)

    const rowQ = await pool
      .request()
      .input('assignmentId', sql.UniqueIdentifier, assignmentId)
      .query<TopicItemMemberRow>(`
        SELECT Id, IdTemaItem, IdMiembroProyecto, FechaAsignacion
          FROM dbo.TemasProyectoItemMiembros
         WHERE Id = @assignmentId
      `)

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic_item.miembro_asignado',
      resourceType: 'topic_item',
      resourceId: itemId,
      resourceName: projectMemberId,
      extra: { projectId, topicId, assignmentId },
      req,
    })
    res.status(201).json({ success: true, data: mapTopicItemMember(rowQ.recordset[0]) })
  } catch (err) {
    next(err)
  }
}

export async function unassignMemberFromItem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.projectId || '')
    const topicId = String(req.params.topicId || '')
    const itemId = String(req.params.itemId || '')
    const assignmentId = String(req.params.assignmentId || '')

    // Scope check through project-org chain
    await getTopicItemRowOrThrow(projectId, topicId, itemId, auth.organizationId)
    const pool = await getDbPool()
    const del = pool.request()
    del.input('assignmentId', sql.UniqueIdentifier, assignmentId)
    del.input('itemId', sql.UniqueIdentifier, itemId)
    const r = await del.query(`
      DELETE FROM dbo.TemasProyectoItemMiembros
       WHERE Id = @assignmentId AND IdTemaItem = @itemId
    `)
    if (Number(r.rowsAffected[0] || 0) === 0) {
      throw new NotFoundError('Asignación no encontrada')
    }

    await logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'topic_item.miembro_desasignado',
      resourceType: 'topic_item',
      resourceId: itemId,
      resourceName: assignmentId,
      extra: { projectId, topicId },
      req,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
