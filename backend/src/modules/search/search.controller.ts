import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'

type SearchHit = {
  id: string
  type: 'project' | 'folder' | 'file' | 'user'
  name: string
  path: string
  projectId: string | null
  updatedAt: string | null
}

export async function searchAll(
  req: Request,
  res: Response<ApiResponse<{ items: SearchHit[]; total: number }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const q = String(req.query.q || '').trim()
    if (!q || q.length < 2) {
      return res.status(200).json({ success: true, data: { items: [], total: 0 } })
    }
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)))
    const pattern = `%${q}%`
    const pool = await getDbPool()
    const r = pool.request()
    r.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    r.input('userId', sql.UniqueIdentifier, auth.userId)
    r.input('q', sql.NVarChar(510), pattern)
    r.input('limit', sql.Int, limit + 1)

    const sqlText = `
      SELECT TOP (@limit) id, type, name, path, projectId, updatedAt, rank
      FROM (
        SELECT CAST(p.Id AS NVARCHAR(128)) id, 'project' type, p.Nombre name,
               CAST(NULL AS NVARCHAR(1000)) path,
               CAST(NULL AS NVARCHAR(128)) projectId,
               COALESCE(p.FechaActualizacion, p.FechaCreacion) updatedAt,
               CASE WHEN p.Nombre LIKE @q THEN 1 ELSE 2 END rank
        FROM Proyectos p
        WHERE p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId))
          AND (p.Nombre LIKE @q OR p.Descripcion LIKE @q)

        UNION ALL

        SELECT CAST(c.Id AS NVARCHAR(128)) id, 'folder' type, c.Nombre name,
               CAST(NULL AS NVARCHAR(1000)) path,
               CAST(c.IdProyecto AS NVARCHAR(128)) projectId,
               COALESCE(c.FechaActualizacion, c.FechaCreacion) updatedAt,
               CASE WHEN c.Nombre LIKE @q THEN 2 ELSE 3 END rank
        FROM Carpetas c INNER JOIN Proyectos p ON p.Id = c.IdProyecto
        WHERE p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId))
          AND c.Nombre LIKE @q

        UNION ALL

        SELECT CAST(a.Id AS NVARCHAR(128)) id, 'file' type, a.Nombre name,
               CAST(NULL AS NVARCHAR(1000)) path,
               CAST(a.IdProyecto AS NVARCHAR(128)) projectId,
               COALESCE(a.FechaActualizacion, a.FechaCreacion) updatedAt,
               CASE WHEN a.Nombre LIKE @q THEN 3 ELSE 4 END rank
        FROM Archivos a INNER JOIN Proyectos p ON p.Id = a.IdProyecto
        WHERE p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
          AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId))
          AND a.Nombre LIKE @q

        UNION ALL

        SELECT CAST(u.Id AS NVARCHAR(128)) id, 'user' type,
               COALESCE(NULLIF(u.NombreCompleto,''), u.Correo) name,
               u.Correo path, CAST(NULL AS NVARCHAR(128)) projectId,
               u.FechaActualizacion updatedAt,
               CASE WHEN u.NombreCompleto LIKE @q THEN 4 ELSE 5 END rank
        FROM Usuarios u
        WHERE u.IdOrganizacion = @orgId AND u.Estado = 'ACTIVO'
          AND (u.NombreCompleto LIKE @q OR u.Correo LIKE @q)
      ) X
      ORDER BY rank ASC, updatedAt DESC;
    `
    const data = await r.query<any>(sqlText)
    const items: SearchHit[] = (data.recordset || []).map((row: any) => ({
      id: String(row.id),
      type: String(row.type) as SearchHit['type'],
      name: String(row.name),
      path: row.path ? String(row.path) : String(row.type === 'user' ? '' : ''),
      projectId: row.projectId ? String(row.projectId) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    }))
    const total = items.length
    res.status(200).json({ success: true, data: { items, total } })
  } catch (e) {
    next(e)
  }
}

export function requireQuery(_: Request, __: Response, next: NextFunction) {
  next()
}
