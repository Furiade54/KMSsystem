import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse, Project, PaginatedResult } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'
import { permanentlyDeleteProject } from './projects.service'

type ProjectRow = {
  Id: string
  IdOrganizacion: string
  Nombre: string
  Descripcion: string | null
  Estado: string
  IdPropietario: string | null
  FechaCreacion: Date
  FechaActualizacion: Date | null
  Color?: string | null
  ProgresoPorcentaje?: number | null
  miembrosCount?: number | null
  archivosCount?: number | null
}

export type ProjectMemberRow = {
  Id: string
  NombreRol: string | null
  FechaIngreso: Date | null
  IdUsuario: string
  NombreCompleto: string | null
  Correo: string | null
  UrlAvatar: string | null
}

function resolveColor(row: Pick<ProjectRow, 'Color' | 'Nombre'>): string {
  if (row.Color) return String(row.Color)
  const n = (row.Nombre || '').toUpperCase()
  if (n.includes('SEGURIDAD') || n.includes('ISO')) return 'rose'
  if (n.includes('LMS') || n.includes('MOODLE')) return 'indigo'
  if (n.includes('INFRA') || n.includes('MANUAL')) return 'emerald'
  if (n.includes('LEY') || n.includes('PH')) return 'amber'
  return 'indigo'
}

function resolveProgress(row: Pick<ProjectRow, 'ProgresoPorcentaje' | 'archivosCount'>): number {
  if (typeof row.ProgresoPorcentaje === 'number') return Math.max(0, Math.min(100, row.ProgresoPorcentaje))
  const files = Number(row.archivosCount ?? 0)
  if (files <= 0) return 5
  return Math.max(5, Math.min(95, Math.round((files / 15) * 100)))
}

function mapProject(row: ProjectRow): Project & {
  color: string
  progress: number
  membersCount: number
  filesCount: number
  ownerName?: string | null
} {
  const raw = String(row.Estado).toUpperCase()
  const statusMap: Record<string, Project['status']> = {
    ACTIVO: 'ACTIVE',
    INACTIVO: 'INACTIVE',
    PENDIENTE: 'PENDING',
    ARCHIVADO: 'ARCHIVED',
    COMPLETADO: 'COMPLETED',
  }
  return {
    id: String(row.Id),
    organizationId: String(row.IdOrganizacion),
    name: row.Nombre,
    description: row.Descripcion ?? '',
    status: statusMap[raw] ?? 'ACTIVE',
    ownerId: row.IdPropietario ? String(row.IdPropietario) : null,
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
    color: resolveColor(row),
    progress: resolveProgress(row),
    membersCount: Number(row.miembrosCount ?? 0),
    filesCount: Number(row.archivosCount ?? 0),
  }
}

function memberAccessClause(
  orgParam: string,
  userParam: string,
  alias = 'p'
): string {
  return `(${alias}.IdOrganizacion = @${orgParam}
      AND (EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = ${alias}.Id AND mp.IdUsuario = @${userParam})
      OR ${alias}.IdPropietario = @${userParam}))`
}

export async function listProjects(
  req: Request,
  res: Response<ApiResponse<PaginatedResult<Project & { color: string; progress: number; membersCount: number; filesCount: number }>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const recent = req.query.recent === 'true'
    const destacados = req.query.destacados === 'true' || req.query.featured === 'true'
    const page = Math.max(1, Number(req.query.page || '1'))
    const pageSizeRaw = Number(req.query.pageSize || (destacados ? 4 : recent ? 3 : 20))
    const pageSize = Math.max(1, Math.min(100, pageSizeRaw))
    const search = req.query.search ? String(req.query.search) : null
    const status = req.query.status ? String(req.query.status) : null

    const pool = await getDbPool()
    const countReq = pool.request()
    countReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    countReq.input('userId', sql.UniqueIdentifier, auth.userId)
    const dataReq = pool.request()
    dataReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    dataReq.input('userId', sql.UniqueIdentifier, auth.userId)

    let whereClauses = `${memberAccessClause('orgId', 'userId')}`
    const statusTranslateEnToEs: Record<string, string> = {
      ACTIVE: 'ACTIVO', INACTIVE: 'INACTIVO', PENDING: 'PENDIENTE',
      ARCHIVED: 'ARCHIVADO', COMPLETED: 'COMPLETADO', DELETED: 'ELIMINADO',
    }

    if (status && status.trim().length > 0) {
      const stRaw = status.trim().toUpperCase()
      const st = statusTranslateEnToEs[stRaw] ?? stRaw
      countReq.input('st', sql.VarChar(30), st)
      dataReq.input('st', sql.VarChar(30), st)
      whereClauses += ` AND p.Estado = @st`
    } else {
      whereClauses += ` AND p.Estado <> 'ELIMINADO'`
    }
    if (search && search.trim().length > 0) {
      countReq.input('s', sql.NVarChar(255), `%${search.trim()}%`)
      dataReq.input('s', sql.NVarChar(255), `%${search.trim()}%`)
      whereClauses += ` AND (p.Nombre LIKE @s OR p.Descripcion LIKE @s)`
    }

    const countSql = `
      SELECT COUNT(*) total
      FROM Proyectos p
      WHERE ${whereClauses};
    `
    const totalRow = await countReq.query<{ total: number }>(countSql)
    const total = Number(totalRow.recordset[0]?.total ?? 0)
    const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize))

    const effectiveOrder = destacados
      ? `(SELECT COUNT(*) FROM Archivos a WHERE a.IdProyecto=p.Id) DESC, p.FechaActualizacion DESC`
      : `p.FechaActualizacion DESC, p.FechaCreacion DESC`

    const dataSql = `
      SELECT
        p.Id, p.IdOrganizacion, p.Nombre, p.Descripcion, p.Estado, p.IdPropietario,
        p.FechaCreacion, p.FechaActualizacion,
        (SELECT COUNT(*) FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id) miembrosCount,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdProyecto=p.Id) archivosCount
      FROM Proyectos p
      WHERE ${whereClauses}
      ORDER BY ${effectiveOrder}
      ${recent || destacados ? `OFFSET 0 ROWS FETCH NEXT ${pageSize} ROWS ONLY;` : `OFFSET ${(page - 1) * pageSize} ROWS FETCH NEXT ${pageSize} ROWS ONLY;`}
    `
    const data = await dataReq.query<ProjectRow>(dataSql)
    const items = data.recordset.map(mapProject)

    res.status(200).json({
      success: true,
      message: search ? `Resultados para "${search}"` : undefined,
      data: { items, total, page: recent || destacados ? 1 : page, pageSize: recent || destacados ? pageSize : pageSize, totalPages },
    })
  } catch (err) {
    next(err)
  }
}

export async function getProject(
  req: Request,
  res: Response<ApiResponse<unknown>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const pool = await getDbPool()
    const qry = pool.request()
    qry.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    qry.input('userId', sql.UniqueIdentifier, auth.userId)
    qry.input('id', sql.UniqueIdentifier, id)
    const r = await qry.query<ProjectRow>(`
      SELECT
        p.Id, p.IdOrganizacion, p.Nombre, p.Descripcion, p.Estado, p.IdPropietario,
        p.FechaCreacion, p.FechaActualizacion,
        (SELECT COUNT(*) FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id) miembrosCount,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdProyecto=p.Id) archivosCount
      FROM Proyectos p
      WHERE p.Id = @id AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId))
    `)
    const row = r.recordset[0]
    if (!row) throw new NotFoundError('Proyecto no encontrado')
    const project = mapProject(row)

    const stats = await pool
      .request()
      .input('pid', sql.UniqueIdentifier, id)
      .query(`
        SELECT
         (SELECT COUNT(*) FROM MiembrosProyecto WHERE IdProyecto=@pid) miembrosCount,
         (SELECT COUNT(*) FROM TemasProyecto WHERE IdProyecto=@pid) temasCount,
         (SELECT COUNT(*) FROM Reuniones WHERE IdProyecto=@pid) reunionesCount,
         (SELECT COUNT(*) FROM Carpetas WHERE IdProyecto=@pid) carpetasCount,
         (SELECT COUNT(*) FROM Archivos WHERE IdProyecto=@pid) archivosCount
      `)
    const s = stats.recordset[0] ?? {}
    res.status(200).json({
      success: true,
      data: {
        project,
        stats: {
          membersCount: Number(s.miembrosCount ?? 0),
          topicsCount: Number(s.temasCount ?? 0),
          meetingsCount: Number(s.reunionesCount ?? 0),
          foldersCount: Number(s.carpetasCount ?? 0),
          filesCount: Number(s.archivosCount ?? 0),
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function getProjectMembers(
  req: Request,
  res: Response<ApiResponse<{ items: unknown[]; total: number }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const pool = await getDbPool()
    const qry = pool.request()
    qry.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    qry.input('userId', sql.UniqueIdentifier, auth.userId)
    qry.input('projectId', sql.UniqueIdentifier, id)

    const r = await qry.query<ProjectMemberRow & { total: number }>(`
      SELECT
        mp.Id, mp.NombreRol, mp.FechaIngreso, mp.IdUsuario,
        u.NombreCompleto, u.Correo, u.UrlAvatar
      FROM MiembrosProyecto mp
        INNER JOIN Proyectos p ON p.Id = mp.IdProyecto
        INNER JOIN Usuarios u ON u.Id = mp.IdUsuario
      WHERE p.Id = @projectId AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mpm WHERE mpm.IdProyecto = p.Id AND mpm.IdUsuario = @userId))
      ORDER BY mp.FechaIngreso ASC;

      SELECT COUNT(*) total FROM MiembrosProyecto WHERE IdProyecto=@projectId;
    `)
    const rows: ProjectMemberRow[] = r.recordsets && r.recordsets[0] ? (r.recordsets[0] as ProjectMemberRow[]) : r.recordset as any
    const totalRaw: any = r.recordsets && r.recordsets[1] ? r.recordsets[1][0] : null
    const total = totalRaw ? Number(totalRaw.total ?? rows.length) : rows.length

    const items = rows.map((m) => ({
      id: String(m.Id),
      userId: String(m.IdUsuario),
      roleName: m.NombreRol ?? null,
      joinedAt: m.FechaIngreso ? new Date(m.FechaIngreso).toISOString() : null,
      fullName: m.NombreCompleto ?? null,
      email: m.Correo ?? null,
      avatarUrl: m.UrlAvatar ?? null,
    }))
    res.status(200).json({ success: true, data: { items, total } })
  } catch (err) {
    next(err)
  }
}

export async function createProject(
  req: Request,
  res: Response<ApiResponse<{ project: Project & { color: string; progress: number; membersCount: number; filesCount: number } }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const name = String(req.body?.name || '').trim()
    if (name.length === 0) throw new AppError('El nombre del proyecto es obligatorio', 400)
    if (name.length > 200) throw new AppError('El nombre excede 200 caracteres', 400)
    const description = req.body?.description ? String(req.body.description).trim() : null
    const statusRaw = String(req.body?.status || 'ACTIVO').toUpperCase()
    const statusTranslateEnToEs: Record<string, string> = {
      ACTIVE: 'ACTIVO', INACTIVE: 'INACTIVO', PENDING: 'PENDIENTE',
      ARCHIVED: 'ARCHIVADO', COMPLETED: 'COMPLETADO', DELETED: 'ELIMINADO',
    }
    const statusMapped = statusTranslateEnToEs[statusRaw] ?? statusRaw
    const allowedStatus = ['ACTIVO', 'INACTIVO', 'PENDIENTE', 'ARCHIVADO', 'COMPLETADO']
    const status = allowedStatus.includes(statusMapped) ? statusMapped : 'ACTIVO'

    const pool = await getDbPool()
    const insert = pool.request()
    insert.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    insert.input('ownerId', sql.UniqueIdentifier, auth.userId)
    insert.input('name', sql.NVarChar(200), name)
    insert.input('desc', sql.NVarChar(sql.MAX), description || null)
    insert.input('st', sql.VarChar(30), status)
    const r = await insert.query<{ Id: string; FechaCreacion: Date; FechaActualizacion: Date | null }>(`
      INSERT INTO Proyectos (IdOrganizacion, Nombre, Descripcion, Estado, IdPropietario, FechaCreacion, FechaActualizacion)
      OUTPUT INSERTED.Id, INSERTED.FechaCreacion, INSERTED.FechaActualizacion
      VALUES (@orgId, @name, @desc, @st, @ownerId, GETDATE(), GETDATE());
    `)
    const newId = String(r.recordset[0]?.Id)
    if (!newId) throw new AppError('No se pudo crear el proyecto', 500)

    await pool.request()
      .input('pid', sql.UniqueIdentifier, newId)
      .input('uid', sql.UniqueIdentifier, auth.userId)
      .input('rol', sql.NVarChar(100), 'Propietario')
      .query(`
        IF NOT EXISTS (SELECT 1 FROM MiembrosProyecto WHERE IdProyecto=@pid AND IdUsuario=@uid)
          INSERT INTO MiembrosProyecto (IdProyecto, IdUsuario, NombreRol, FechaIngreso)
          VALUES (@pid, @uid, @rol, GETDATE());
      `)

    const qry = pool.request()
    qry.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    qry.input('userId', sql.UniqueIdentifier, auth.userId)
    qry.input('id', sql.UniqueIdentifier, newId)
    const detail = await qry.query<ProjectRow>(`
      SELECT
        p.Id, p.IdOrganizacion, p.Nombre, p.Descripcion, p.Estado, p.IdPropietario,
        p.FechaCreacion, p.FechaActualizacion,
        (SELECT COUNT(*) FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id) miembrosCount,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdProyecto=p.Id) archivosCount
      FROM Proyectos p WHERE p.Id = @id AND p.IdOrganizacion = @orgId AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const row = detail.recordset[0] as ProjectRow
    res.status(201).json({ success: true, data: { project: mapProject(row) } })
  } catch (err) {
    next(err)
  }
}

export async function updateProject(
  req: Request,
  res: Response<ApiResponse<{ project: Project & { color: string; progress: number; membersCount: number; filesCount: number } }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const pool = await getDbPool()

    const ownerQ = pool.request()
    ownerQ.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    ownerQ.input('userId', sql.UniqueIdentifier, auth.userId)
    ownerQ.input('id', sql.UniqueIdentifier, id)
    const existing = await ownerQ.query<{ Id: string; IdPropietario: string | null; Estado: string }>(`
      SELECT Id, IdPropietario, Estado FROM Proyectos p
      WHERE p.Id = @id AND p.IdOrganizacion = @orgId
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const row = existing.recordset[0]
    if (!row) throw new NotFoundError('Proyecto no encontrado')
    if (row.IdPropietario && String(row.IdPropietario).toLowerCase() !== String(auth.userId).toLowerCase()) {
      const hasAnyPayload = req.body && (req.body.name || req.body.description || req.body.status)
      if (!hasAnyPayload) { /* allow no-op */ }
      // Solo propietario puede cambiar estado; cualquier miembro puede editar nombre/descripcion
      if (req.body?.status && String(row.IdPropietario).toLowerCase() !== String(auth.userId).toLowerCase()) {
        throw new ForbiddenError('Solo el propietario puede cambiar el estado del proyecto')
      }
    }

    const patchName = req.body?.name != null ? String(req.body.name).trim() : null
    const patchDescription = req.body?.description != null ? String(req.body.description).trim() : null
    let patchStatus = req.body?.status != null ? String(req.body.status).toUpperCase() : null
    const statusTranslateEnToEs: Record<string, string> = {
      ACTIVE: 'ACTIVO', INACTIVE: 'INACTIVO', PENDING: 'PENDIENTE',
      ARCHIVED: 'ARCHIVADO', COMPLETED: 'COMPLETADO', DELETED: 'ELIMINADO',
    }
    if (patchStatus && statusTranslateEnToEs[patchStatus]) patchStatus = statusTranslateEnToEs[patchStatus]
    if (patchName !== null && (patchName.length === 0 || patchName.length > 200)) {
      throw new AppError('Nombre inválido (1..200 caracteres)', 400)
    }
    const allowedStatus = ['ACTIVO', 'INACTIVO', 'PENDIENTE', 'ARCHIVADO', 'COMPLETADO', 'ELIMINADO']
    if (patchStatus !== null && !allowedStatus.includes(patchStatus)) {
      throw new AppError(`Estado inválido: ${patchStatus}`, 400)
    }

    const up = pool.request()
    const sets: string[] = []
    if (patchName !== null) { up.input('n', sql.NVarChar(200), patchName); sets.push(`Nombre = @n`) }
    if (patchDescription !== null) { up.input('d', sql.NVarChar(sql.MAX), patchDescription || null); sets.push(`Descripcion = @d`) }
    if (patchStatus !== null) { up.input('s', sql.VarChar(30), patchStatus); sets.push(`Estado = @s`) }
    if (sets.length === 0) { /* no-op */ } else {
      sets.push(`FechaActualizacion = GETDATE()`)
      up.input('pid', sql.UniqueIdentifier, id)
      up.input('orgId', sql.UniqueIdentifier, auth.organizationId)
      await up.query(`UPDATE Proyectos SET ${sets.join(', ')} WHERE Id = @pid AND IdOrganizacion = @orgId;`)
    }

    const qry = pool.request()
    qry.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    qry.input('userId', sql.UniqueIdentifier, auth.userId)
    qry.input('id', sql.UniqueIdentifier, id)
    const detail = await qry.query<ProjectRow>(`
      SELECT
        p.Id, p.IdOrganizacion, p.Nombre, p.Descripcion, p.Estado, p.IdPropietario,
        p.FechaCreacion, p.FechaActualizacion,
        (SELECT COUNT(*) FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id) miembrosCount,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdProyecto=p.Id) archivosCount
      FROM Proyectos p WHERE p.Id = @id AND p.IdOrganizacion = @orgId AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const updated = detail.recordset[0] as ProjectRow
    res.status(200).json({ success: true, data: { project: mapProject(updated) } })
  } catch (err) {
    next(err)
  }
}

export async function deleteProject(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const pool = await getDbPool()
    const qry = pool.request()
    qry.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    qry.input('userId', sql.UniqueIdentifier, auth.userId)
    qry.input('id', sql.UniqueIdentifier, id)
    const exist = await qry.query<{ Id: string; IdPropietario: string | null }>(`
      SELECT Id, IdPropietario FROM Proyectos p
      WHERE p.Id = @id AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const row = exist.recordset[0]
    if (!row) throw new NotFoundError('Proyecto no encontrado')
    if (row.IdPropietario && String(row.IdPropietario).toLowerCase() !== String(auth.userId).toLowerCase()) {
      throw new ForbiddenError('Solo el propietario puede eliminar el proyecto')
    }
    await pool.request()
      .input('pid', sql.UniqueIdentifier, id)
      .input('orgId', sql.UniqueIdentifier, auth.organizationId)
      .query(`UPDATE Proyectos SET Estado='ELIMINADO', FechaActualizacion=GETDATE() WHERE Id=@pid AND IdOrganizacion=@orgId;`)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function permanentlyDeleteProjectEndpoint(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    await permanentlyDeleteProject(auth, id, req)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

async function assertCanManageProjectMembers(
  auth: { organizationId: string; userId: string },
  projectId: string
): Promise<{ IdProyecto: string; IdPropietario: string | null }> {
  const pool = await getDbPool()
  const qry = pool.request()
  qry.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  qry.input('userId', sql.UniqueIdentifier, auth.userId)
  qry.input('projectId', sql.UniqueIdentifier, projectId)
  const r = await qry.query<{ Id: string; IdPropietario: string | null }>(`
    SELECT Id, IdPropietario FROM Proyectos p
    WHERE p.Id = @projectId AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
      AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
  `)
  const row = r.recordset[0]
  if (!row) throw new NotFoundError('Proyecto no encontrado')
  const isOwner = row.IdPropietario && String(row.IdPropietario).toLowerCase() === String(auth.userId).toLowerCase()
  if (!isOwner) throw new ForbiddenError('Solo el propietario del proyecto puede gestionar sus miembros')
  return { IdProyecto: String(row.Id), IdPropietario: row.IdPropietario }
}

export async function addProjectMemberEndpoint(
  req: Request,
  res: Response<ApiResponse<unknown>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.id)
    const targetUserId = String(req.body?.userId || '').trim()
    const roleName = req.body?.roleName ? String(req.body.roleName).trim() : 'Miembro'
    if (!targetUserId) throw new AppError('Se requiere el usuario a agregar', 400)

    await assertCanManageProjectMembers(auth, projectId)

    const pool = await getDbPool()
    const checkUser = pool.request()
    checkUser.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    checkUser.input('uid', sql.UniqueIdentifier, targetUserId)
    const userRow = await checkUser.query<{ Id: string }>(`
      SELECT u.Id FROM Usuarios u
      INNER JOIN MiembrosOrganizacion mo ON mo.IdUsuario = u.Id
      WHERE u.Id = @uid AND mo.IdOrganizacion = @orgId;
    `)
    if (!userRow.recordset[0]) throw new NotFoundError('Usuario no encontrado en la organización')

    const insert = pool.request()
    insert.input('pid', sql.UniqueIdentifier, projectId)
    insert.input('uid', sql.UniqueIdentifier, targetUserId)
    insert.input('rol', sql.NVarChar(100), roleName)
    const r = await insert.query<{ Id: string; NombreRol: string | null; FechaIngreso: Date | null; IdUsuario: string; NombreCompleto: string | null; Correo: string | null; UrlAvatar: string | null }>(`
      IF EXISTS (SELECT 1 FROM MiembrosProyecto WHERE IdProyecto=@pid AND IdUsuario=@uid)
        SELECT mp.Id, mp.NombreRol, mp.FechaIngreso, mp.IdUsuario, u.NombreCompleto, u.Correo, u.UrlAvatar
        FROM MiembrosProyecto mp
        INNER JOIN Usuarios u ON u.Id = mp.IdUsuario
        WHERE mp.IdProyecto=@pid AND mp.IdUsuario=@uid;
      ELSE
        INSERT INTO MiembrosProyecto (IdProyecto, IdUsuario, NombreRol, FechaIngreso)
        OUTPUT INSERTED.Id, INSERTED.NombreRol, INSERTED.FechaIngreso, INSERTED.IdUsuario,
               (SELECT NombreCompleto FROM Usuarios WHERE Id=INSERTED.IdUsuario) NombreCompleto,
               (SELECT Correo FROM Usuarios WHERE Id=INSERTED.IdUsuario) Correo,
               (SELECT UrlAvatar FROM Usuarios WHERE Id=INSERTED.IdUsuario) UrlAvatar
        VALUES (@pid, @uid, @rol, GETDATE());
    `)
    const m = r.recordset[0]
    const data = {
      id: String(m.Id),
      userId: String(m.IdUsuario),
      roleName: m.NombreRol ?? null,
      joinedAt: m.FechaIngreso ? new Date(m.FechaIngreso).toISOString() : null,
      fullName: m.NombreCompleto ?? null,
      email: m.Correo ?? null,
      avatarUrl: m.UrlAvatar ?? null,
    }
    res.status(200).json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function removeProjectMemberEndpoint(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.id)
    const memberId = String(req.params.memberId || '').trim()
    if (!memberId) throw new AppError('Se requiere el miembro a retirar', 400)

    const proj = await assertCanManageProjectMembers(auth, projectId)

    const pool = await getDbPool()
    const del = pool.request()
    del.input('pid', sql.UniqueIdentifier, projectId)
    del.input('mid', sql.UniqueIdentifier, memberId)
    const ownerCheck = await del.query<{ IdUsuario: string }>(`
      SELECT IdUsuario FROM MiembrosProyecto WHERE Id=@mid AND IdProyecto=@pid;
    `)
    const targetRow = ownerCheck.recordset[0]
    if (!targetRow) throw new NotFoundError('Miembro no encontrado en el proyecto')
    if (proj.IdPropietario && String(targetRow.IdUsuario).toLowerCase() === String(proj.IdPropietario).toLowerCase()) {
      throw new AppError('No se puede retirar al propietario del proyecto', 400)
    }
    await pool.request()
      .input('mid', sql.UniqueIdentifier, memberId)
      .input('pid', sql.UniqueIdentifier, projectId)
      .query(`DELETE FROM MiembrosProyecto WHERE Id=@mid AND IdProyecto=@pid;`)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function updateProjectMemberRoleEndpoint(
  req: Request,
  res: Response<ApiResponse<unknown>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.params.id)
    const memberId = String(req.params.memberId || '').trim()
    const roleName = req.body?.roleName ? String(req.body.roleName).trim() : null
    if (!memberId) throw new AppError('Se requiere el miembro a actualizar', 400)

    await assertCanManageProjectMembers(auth, projectId)

    const pool = await getDbPool()
    const upd = pool.request()
    upd.input('pid', sql.UniqueIdentifier, projectId)
    upd.input('mid', sql.UniqueIdentifier, memberId)
    upd.input('rol', sql.NVarChar(100), roleName)
    const r = await upd.query<{ Id: string; NombreRol: string | null; FechaIngreso: Date | null; IdUsuario: string; NombreCompleto: string | null; Correo: string | null; UrlAvatar: string | null }>(`
      UPDATE MiembrosProyecto SET NombreRol = @rol
      OUTPUT INSERTED.Id, INSERTED.NombreRol, INSERTED.FechaIngreso, INSERTED.IdUsuario,
             (SELECT NombreCompleto FROM Usuarios WHERE Id=INSERTED.IdUsuario) NombreCompleto,
             (SELECT Correo FROM Usuarios WHERE Id=INSERTED.IdUsuario) Correo,
             (SELECT UrlAvatar FROM Usuarios WHERE Id=INSERTED.IdUsuario) UrlAvatar
      WHERE Id=@mid AND IdProyecto=@pid;
    `)
    const m = r.recordset[0]
    if (!m) throw new NotFoundError('Miembro no encontrado en el proyecto')
    const data = {
      id: String(m.Id),
      userId: String(m.IdUsuario),
      roleName: m.NombreRol ?? null,
      joinedAt: m.FechaIngreso ? new Date(m.FechaIngreso).toISOString() : null,
      fullName: m.NombreCompleto ?? null,
      email: m.Correo ?? null,
      avatarUrl: m.UrlAvatar ?? null,
    }
    res.status(200).json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
