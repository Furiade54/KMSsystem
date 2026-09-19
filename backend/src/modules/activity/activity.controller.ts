import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { sqlLocalToIso } from '../../shared/utils/date'
import { ForbiddenError } from '../../shared/errors/AppError'

type ActivityItem = {
  id: string
  action: string
  resourceType: 'project' | 'folder' | 'file' | 'user' | string
  resourceId: string | null
  resourceName: string | null
  projectId: string | null
  userId: string | null
  userFullName: string | null
  userEmail: string | null
  occurredAt: string
  extra?: Record<string, unknown> | null
}

async function ensureProjectAccess(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  auth: { organizationId: string; userId: string },
  projectId: string
): Promise<void> {
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  req.input('userId', sql.UniqueIdentifier, auth.userId)
  req.input('projectId', sql.UniqueIdentifier, projectId)
  const row = await req.query(`
    SELECT p.Id FROM Proyectos p
    WHERE p.Id = @projectId AND p.IdOrganizacion = @orgId
      AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
      AND (p.IdPropietario = @userId OR EXISTS (
        SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId
      ))
  `)
  if (!row.recordset.length) throw new ForbiddenError('No tienes acceso al proyecto especificado')
}

async function fallbackFromEntities(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  auth: { organizationId: string; userId: string },
  limit: number,
  offset: number = 0,
  projectId?: string | null
): Promise<{ items: ActivityItem[]; total: number }> {
  try {
    const r = pool.request()
    r.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    r.input('userId', sql.UniqueIdentifier, auth.userId)
    const projectScope = projectId
      ? ' AND p.Id = @scopedProjectId'
      : ''
    if (projectId) r.input('scopedProjectId', sql.UniqueIdentifier, projectId)
    const cnt = await r.query<any>(`
      SELECT COUNT(*) c FROM (
        SELECT CAST(a.Id AS NVARCHAR(128)) _id
        FROM Archivos a INNER JOIN Proyectos p ON p.Id = a.IdProyecto
        WHERE p.IdOrganizacion = @orgId AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${projectScope}
        UNION ALL
        SELECT CAST(c.Id AS NVARCHAR(128)) _id
        FROM Carpetas c INNER JOIN Proyectos p ON p.Id = c.IdProyecto
        WHERE p.IdOrganizacion = @orgId AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${projectScope}
        UNION ALL
        SELECT CAST(p.Id AS NVARCHAR(128)) _id
        FROM Proyectos p
        WHERE p.IdOrganizacion = @orgId AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${projectScope}
        UNION ALL
        SELECT CAST(cm.Id AS NVARCHAR(128)) _id
        FROM Comentarios cm
          INNER JOIN Archivos af ON cm.TipoRecurso = 'file' AND af.Id = cm.IdRecurso
          INNER JOIN Proyectos p ON p.Id = af.IdProyecto
          INNER JOIN Usuarios u ON u.Id = cm.IdUsuario AND u.IdOrganizacion = @orgId
        WHERE ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${projectScope}
      ) X;
    `)
    const total = Number(cnt.recordset[0]?.c ?? 0)
    const r2 = pool.request()
    r2.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    r2.input('userId', sql.UniqueIdentifier, auth.userId)
    r2.input('off', sql.Int, Math.max(0, offset))
    r2.input('lim', sql.Int, Math.max(1, limit))
    const scope2 = projectId ? ' AND p.Id = @scopedProjectId2' : ''
    if (projectId) r2.input('scopedProjectId2', sql.UniqueIdentifier, projectId)
    const q = await r2.query<any>(`
      SELECT * FROM (
        SELECT CAST(a.Id AS NVARCHAR(128)) _id, 'file.subido' action, 'file' rt,
               CAST(a.Id AS NVARCHAR(128)) rid, a.Nombre rname,
               CAST(a.IdProyecto AS NVARCHAR(128)) pid,
               CAST(a.IdPropietario AS NVARCHAR(128)) uid,
               COALESCE(a.FechaActualizacion, a.FechaCreacion) fecha,
               NULL meta
        FROM Archivos a INNER JOIN Proyectos p ON p.Id = a.IdProyecto
        WHERE p.IdOrganizacion = @orgId AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${scope2}
        UNION ALL
        SELECT CAST(c.Id AS NVARCHAR(128)) _id, 'folder.creada' action, 'folder' rt,
               CAST(c.Id AS NVARCHAR(128)) rid, c.Nombre rname,
               CAST(c.IdProyecto AS NVARCHAR(128)) pid,
               CAST(c.IdPropietario AS NVARCHAR(128)) uid,
               COALESCE(c.FechaActualizacion, c.FechaCreacion) fecha,
               NULL meta
        FROM Carpetas c INNER JOIN Proyectos p ON p.Id = c.IdProyecto
        WHERE p.IdOrganizacion = @orgId AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${scope2}
        UNION ALL
        SELECT CAST(p.Id AS NVARCHAR(128)) _id, 'project.creado' action, 'project' rt,
               CAST(p.Id AS NVARCHAR(128)) rid, p.Nombre rname,
               CAST(p.Id AS NVARCHAR(128)) pid,
               CAST(p.IdPropietario AS NVARCHAR(128)) uid,
               COALESCE(p.FechaActualizacion, p.FechaCreacion) fecha,
               NULL meta
        FROM Proyectos p
        WHERE p.IdOrganizacion = @orgId AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${scope2}
        UNION ALL
        SELECT CAST(cm.Id AS NVARCHAR(128)) _id, 'file.comentado' action, 'file' rt,
               CAST(af.Id AS NVARCHAR(128)) rid,
               af.Nombre rname,
               CAST(af.IdProyecto AS NVARCHAR(128)) pid,
               CAST(cm.IdUsuario AS NVARCHAR(128)) uid,
               cm.FechaCreacion fecha,
               (SELECT [resourceName] = COALESCE(af.Nombre,''),
                       [comment] = CASE WHEN LEN(cm.Contenido)>280 THEN LEFT(cm.Contenido,279)+N'…' ELSE cm.Contenido END,
                       [commentId] = CAST(cm.Id AS NVARCHAR(128))
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES) meta
        FROM Comentarios cm
          INNER JOIN Archivos af ON cm.TipoRecurso = 'file' AND af.Id = cm.IdRecurso
          INNER JOIN Proyectos p ON p.Id = af.IdProyecto
          INNER JOIN Usuarios u ON u.Id = cm.IdUsuario AND u.IdOrganizacion = @orgId
        WHERE ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
          ${scope2}
      ) X
      ORDER BY fecha DESC
      OFFSET @off ROWS
      FETCH NEXT @lim ROWS ONLY;
    `)
    const idsUser = new Set<string>()
    for (const row of q.recordset) if (row.uid) idsUser.add(String(row.uid))
    const users = new Map<string, { fullName: string | null; email: string | null }>()
    if (idsUser.size > 0) {
      const idList = Array.from(idsUser).slice(0, 200)
      const uQ = pool.request()
      const plist: string[] = []
      idList.forEach((_v, i) => {
        const p = `uid${i}`
        uQ.input(p, sql.UniqueIdentifier, idList[i])
        plist.push(`@${p}`)
      })
      const uR = await uQ.query<any>(`SELECT Id, NombreCompleto, Correo FROM Usuarios WHERE Id IN (${plist.join(',')})`)
      for (const u of uR.recordset) {
        users.set(String(u.Id), { fullName: u.NombreCompleto ?? null, email: u.Correo ?? null })
      }
    }
    const items: ActivityItem[] = (q.recordset || []).map((row: any) => {
      const usr = users.get(String(row.uid))
      return {
        id: String(row._id),
        action: String(row.action),
        resourceType: String(row.rt),
        resourceId: row.rid ? String(row.rid) : null,
        resourceName: row.rname ? String(row.rname) : null,
        projectId: row.pid ? String(row.pid) : null,
        userId: row.uid ? String(row.uid) : null,
        userFullName: usr?.fullName ?? null,
        userEmail: usr?.email ?? null,
        occurredAt: sqlLocalToIso(row.fecha as any),
        meta: row.meta ? String(row.meta) : null,
      } as any
    })
    return { items, total }
  } catch {
    return { items: [], total: 0 }
  }
}

type ParsedMeta = { resourceName?: string | null; comment?: string | null; commentId?: string | null } & Record<string, unknown>

function parseMeta(raw: string | null | undefined): ParsedMeta {
  if (!raw) return {}
  const r = String(raw).trim()
  if (r.length === 0) return {}
  if (r.startsWith('{')) {
    try {
      const o = JSON.parse(r)
      return o && typeof o === 'object' ? (o as ParsedMeta) : { resourceName: r }
    } catch {
      return { resourceName: r }
    }
  }
  return { resourceName: r }
}

function tryFromAuditoria(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  auth: { organizationId: string; userId: string },
  pageSize: number,
  offset: number,
  projectId?: string | null
): Promise<{ ok: true; items: ActivityItem[]; total: number } | { ok: false }> {
  return (async () => {
    const countQ = pool.request()
    countQ.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    countQ.input('userId', sql.UniqueIdentifier, auth.userId)
    let projectFilter = ''
    if (projectId) {
      countQ.input('pid', sql.UniqueIdentifier, projectId)
      projectFilter = ' AND a.IdProyecto = @pid'
    }
    let cntSql = `
      SELECT COUNT(*) c FROM Auditoria a
      LEFT JOIN Archivos af ON a.TipoRecurso = 'file' AND af.Id = a.IdRecurso
      LEFT JOIN Carpetas cf ON a.TipoRecurso = 'folder' AND cf.Id = a.IdRecurso
      LEFT JOIN Proyectos pf ON a.TipoRecurso = 'project' AND pf.Id = a.IdRecurso
      LEFT JOIN Proyectos p ON p.Id = COALESCE(af.IdProyecto, cf.IdProyecto, pf.Id)
      WHERE a.IdOrganizacion = @orgId
        ${projectFilter}
        AND (
          a.IdUsuario = @userId
          OR (p.Id IS NOT NULL AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
            AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId)))
        );
    `
    if (projectId) {
      cntSql = `
        SELECT COUNT(*) c FROM Auditoria a
        WHERE a.IdOrganizacion = @orgId AND a.IdProyecto = @pid;
      `
    }
    const cnt = await countQ.query<{ c: number }>(cntSql)
    const totalAudit = Number(cnt.recordset[0]?.c ?? 0)
    if (totalAudit <= 0) throw new Error('no-audit')
    const r = pool.request()
    r.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    r.input('userId', sql.UniqueIdentifier, auth.userId)
    r.input('off', sql.Int, offset)
    r.input('pgsz', sql.Int, pageSize)
    let audSql = `
      SELECT a.Id, a.Accion, a.TipoRecurso, a.IdRecurso, a.IdUsuario, a.Metadatos, a.FechaCreacion,
             u.NombreCompleto, u.Correo,
             CAST(COALESCE(af.IdProyecto, cf.IdProyecto, CASE WHEN a.TipoRecurso = 'project' THEN a.IdRecurso ELSE NULL END) AS NVARCHAR(128)) ResolvedProjectId
      FROM Auditoria a
        LEFT JOIN Usuarios u ON u.Id = a.IdUsuario
        LEFT JOIN Archivos af ON a.TipoRecurso = 'file' AND af.Id = a.IdRecurso
        LEFT JOIN Carpetas cf ON a.TipoRecurso = 'folder' AND cf.Id = a.IdRecurso
        LEFT JOIN Proyectos pf ON a.TipoRecurso = 'project' AND pf.Id = a.IdRecurso
        LEFT JOIN Proyectos p ON p.Id = COALESCE(af.IdProyecto, cf.IdProyecto, pf.Id)
      WHERE a.IdOrganizacion = @orgId
        AND (
          a.IdUsuario = @userId
          OR (p.Id IS NOT NULL AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO'
            AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId)))
        )
      ORDER BY a.FechaCreacion DESC
      OFFSET @off ROWS
      FETCH NEXT @pgsz ROWS ONLY;
    `
    if (projectId) {
      r.input('pid', sql.UniqueIdentifier, projectId)
      audSql = `
        SELECT a.Id, a.Accion, a.TipoRecurso, a.IdRecurso, a.IdUsuario, a.Metadatos, a.FechaCreacion,
               u.NombreCompleto, u.Correo,
               CAST(a.IdProyecto AS NVARCHAR(128)) ResolvedProjectId
        FROM Auditoria a
          LEFT JOIN Usuarios u ON u.Id = a.IdUsuario
        WHERE a.IdOrganizacion = @orgId AND a.IdProyecto = @pid
        ORDER BY a.FechaCreacion DESC
        OFFSET @off ROWS
        FETCH NEXT @pgsz ROWS ONLY;
      `
    }
    const aud = await r.query<any>(audSql)
    const items: ActivityItem[] = (aud.recordset || []).map((row: any) => {
        const meta = parseMeta(row.Metadatos)
        const rt = row.TipoRecurso ? String(row.TipoRecurso).toLowerCase() : 'system'
        const action = String(row.Accion)
        let resourceName: string | null = (meta.resourceName as any) ?? null
        const fn = (meta as any).fromName
        const tn = (meta as any).toName
        if ((action.endsWith('.renombrado') || action.endsWith('.renombrada')) && fn && tn) {
          resourceName = `${fn} por ${tn}`
        }
        return {
          id: String(row.Id),
          action,
          resourceType: rt,
          resourceId: row.IdRecurso ? String(row.IdRecurso) : null,
          resourceName,
          projectId: row.ResolvedProjectId ? String(row.ResolvedProjectId) : null,
          userId: row.IdUsuario ? String(row.IdUsuario) : null,
          userFullName: row.NombreCompleto ?? null,
          userEmail: row.Correo ?? null,
          occurredAt: sqlLocalToIso(row.FechaCreacion as any),
          comment: (meta.comment as any) ?? null,
          commentId: (meta.commentId as any) ?? null,
          extra: meta && typeof meta === 'object' ? (meta as any) : null,
        } as any
      })
    return { ok: true as const, items, total: totalAudit }
  })().catch((): { ok: false } => ({ ok: false }))
}

export async function listActivity(
  req: Request,
  res: Response<ApiResponse<{ items: ActivityItem[]; total: number; source: 'auditoria' | 'fallback'; page: number; pageSize: number; totalPages: number }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize ?? req.query.limit ?? 20)))
    const offset = (page - 1) * pageSize
    const projectIdRaw = req.query.projectId ? String(req.query.projectId).trim() : null
    const projectId = projectIdRaw && projectIdRaw.length > 0 ? projectIdRaw : null
    const pool = await getDbPool()

    if (projectId) {
      await ensureProjectAccess(pool, auth, projectId)
    }

    const aud = await tryFromAuditoria(pool, auth, pageSize, offset, projectId)
    if (aud.ok) {
      const totalPages = Math.max(1, Math.ceil(aud.total / pageSize))
      return res.status(200).json({
        success: true,
        data: { items: aud.items, total: aud.total, source: 'auditoria', page, pageSize, totalPages },
      })
    }

    function composeResourceName(action: string, baseName: string | null, m: Record<string, unknown>): string | null {
      const fn = (m as any).fromName
      const tn = (m as any).toName
      if ((action.endsWith('.renombrado') || action.endsWith('.renombrada')) && fn && tn) return `${fn} por ${tn}`
      if ((action.endsWith('.copiado') || action.endsWith('.copiada')) && (m as any).copiedFrom && baseName) return `${baseName} (copia)`
      return baseName
    }
    const fb = await fallbackFromEntities(pool, auth, pageSize, offset, projectId)
    const items: ActivityItem[] = (fb.items || []).map((x: any) => {
      const m = parseMeta((x as any).meta)
      const action = String((x as any).action || '')
      const base = (m.resourceName as any) ?? (x as any).resourceName ?? null
      return {
        ...x,
        resourceName: composeResourceName(action, base, m as any),
        comment: (m.comment as any) ?? null,
        commentId: (m.commentId as any) ?? null,
        extra: m && typeof m === 'object' ? (m as any) : null,
      } as any
    })
    const total = fb.total
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    res.status(200).json({
      success: true,
      data: { items, total, source: 'fallback', page, pageSize, totalPages },
    })
  } catch (e) {
    next(e)
  }
}
