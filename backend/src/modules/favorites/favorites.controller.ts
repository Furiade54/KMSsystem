import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError'

const VALID_RESOURCE_TYPES = new Set(['PROJECT', 'FOLDER', 'FILE'])

type FavoriteItem = {
  userId: string
  organizationId: string
  resourceType: 'PROJECT' | 'FOLDER' | 'FILE'
  resourceId: string
  createdAt: string
  name: string | null
  projectId: string | null
  projectName: string | null
  folderId: string | null
  folderName: string | null
  extension: string | null
  mime: string | null
}

function getAuth(req: Request) {
  return (req as unknown as { auth: { organizationId: string; userId: string; email?: string } }).auth
}

function validateResourceType(value: unknown, required?: true): 'PROJECT' | 'FOLDER' | 'FILE'
function validateResourceType(value: unknown, required: false): 'PROJECT' | 'FOLDER' | 'FILE' | null
function validateResourceType(value: unknown, required = true) {
  const s = value == null ? '' : String(value).trim().toUpperCase()
  if (!s) {
    if (!required) return null
    throw new BadRequestError('resourceType es requerido')
  }
  if (!VALID_RESOURCE_TYPES.has(s)) {
    throw new BadRequestError(`resourceType inválido. Usa uno de: ${Array.from(VALID_RESOURCE_TYPES).join(', ')}`)
  }
  return s as 'PROJECT' | 'FOLDER' | 'FILE'
}

function validateGuid(value: unknown, label = 'resourceId') {
  const s = value == null ? '' : String(value).trim()
  if (!s) throw new BadRequestError(`${label} es requerido`)
  return s
}

async function assertResourceInOrg(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  auth: { organizationId: string; userId: string },
  resourceType: 'PROJECT' | 'FOLDER' | 'FILE',
  resourceId: string
): Promise<{
  exists: boolean
  belongs: boolean
  projectId: string | null
  projectName: string | null
  resourceName: string | null
  folderId: string | null
  folderName: string | null
  extension: string | null
  mime: string | null
}> {
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  req.input('uid', sql.UniqueIdentifier, auth.userId)
  req.input('rid', sql.UniqueIdentifier, resourceId)

  if (resourceType === 'PROJECT') {
    const r = await req.query<{ Id: string; Nombre: string; IdOrganizacion: string; Miembro: number | null }>(`
      SELECT
        p.Id,
        p.Nombre,
        p.IdOrganizacion,
        CASE WHEN EXISTS (
          SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@uid
        ) OR p.IdPropietario=@uid THEN 1 ELSE NULL END Miembro
      FROM Proyectos p WHERE p.Id = @rid AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO';
    `)
    const row = r.recordset[0]
    if (!row) return { exists: false, belongs: false, projectId: null, projectName: null, resourceName: null, folderId: null, folderName: null, extension: null, mime: null }
    const belongs = String(row.IdOrganizacion).toLowerCase() === String(auth.organizationId).toLowerCase() && row.Miembro === 1
    return {
      exists: true,
      belongs,
      projectId: String(row.Id),
      projectName: row.Nombre,
      resourceName: row.Nombre,
      folderId: null,
      folderName: null,
      extension: null,
      mime: null,
    }
  }

  if (resourceType === 'FOLDER') {
    const r = await req.query<{ Id: string; Nombre: string; IdProyecto: string | null; Proyecto: string | null; IdOrganizacion: string; Miembro: number | null }>(`
      SELECT
        c.Id, c.Nombre, c.IdProyecto, p.Nombre Proyecto, p.IdOrganizacion,
        CASE WHEN EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@uid) OR p.IdPropietario=@uid THEN 1 ELSE NULL END Miembro
      FROM Carpetas c INNER JOIN Proyectos p ON p.Id = c.IdProyecto
      WHERE c.Id = @rid AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO';
    `)
    const row = r.recordset[0]
    if (!row) return { exists: false, belongs: false, projectId: null, projectName: null, resourceName: null, folderId: null, folderName: null, extension: null, mime: null }
    const belongs = String(row.IdOrganizacion).toLowerCase() === String(auth.organizationId).toLowerCase() && row.Miembro === 1
    return {
      exists: true,
      belongs,
      projectId: row.IdProyecto ? String(row.IdProyecto) : null,
      projectName: row.Proyecto ?? null,
      resourceName: row.Nombre,
      folderId: String(row.Id),
      folderName: row.Nombre,
      extension: null,
      mime: null,
    }
  }

  // FILE
  const r = await req.query<{
    Id: string; Nombre: string; Extension: string | null; TipoMime: string | null; IdCarpeta: string | null; CarpetaNombre: string | null; IdProyecto: string | null; Proyecto: string | null; IdOrganizacion: string; Miembro: number | null
  }>(`
    SELECT
      a.Id, a.Nombre, a.Extension, a.TipoMime, a.IdCarpeta, c.Nombre CarpetaNombre, a.IdProyecto, p.Nombre Proyecto, p.IdOrganizacion,
      CASE WHEN EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@uid) OR p.IdPropietario=@uid THEN 1 ELSE NULL END Miembro
    FROM Archivos a
         INNER JOIN Proyectos p ON p.Id = a.IdProyecto
         LEFT JOIN Carpetas c ON c.Id = a.IdCarpeta
    WHERE a.Id = @rid AND ISNULL(p.Estado,'ACTIVO') <> 'ELIMINADO';
  `)
  const row = r.recordset[0]
  if (!row) return { exists: false, belongs: false, projectId: null, projectName: null, resourceName: null, folderId: null, folderName: null, extension: null, mime: null }
  const belongs = String(row.IdOrganizacion).toLowerCase() === String(auth.organizationId).toLowerCase() && row.Miembro === 1
  return {
    exists: true,
    belongs,
    projectId: row.IdProyecto ? String(row.IdProyecto) : null,
    projectName: row.Proyecto ?? null,
    resourceName: row.Nombre,
    folderId: row.IdCarpeta ? String(row.IdCarpeta) : null,
    folderName: row.CarpetaNombre ?? null,
    extension: row.Extension ?? null,
    mime: row.TipoMime ?? null,
  }
}

export async function listFavoritesEndpoint(
  req: Request,
  res: Response<ApiResponse<{ items: FavoriteItem[]; total: number }>>,
  next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const pool = await getDbPool()
    const rawType = validateResourceType(req.query.resourceType, false)
    const page = Math.max(1, Number(req.query.page ?? 1) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50) || 50))
    const offset = (page - 1) * pageSize

    const r = pool.request()
    r.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    r.input('uid', sql.UniqueIdentifier, auth.userId)
    if (rawType) r.input('rt', sql.VarChar(20), rawType)

    const filterRt = rawType ? ' AND f.TipoRecurso = @rt' : ''

    const countQ = await r.query<{ c: number }>(`
      SELECT COUNT(*) c
      FROM Favoritos f
      WHERE f.IdUsuario = @uid AND f.IdOrganizacion = @orgId
        ${filterRt}
        AND (
          (f.TipoRecurso='PROJECT' AND EXISTS (SELECT 1 FROM Proyectos p WHERE p.Id=f.IdRecurso AND p.IdOrganizacion=f.IdOrganizacion AND ISNULL(p.Estado,'ACTIVO')<>'ELIMINADO'))
          OR (f.TipoRecurso='FOLDER'  AND EXISTS (SELECT 1 FROM Carpetas c INNER JOIN Proyectos p ON p.Id=c.IdProyecto WHERE c.Id=f.IdRecurso AND p.IdOrganizacion=f.IdOrganizacion AND ISNULL(p.Estado,'ACTIVO')<>'ELIMINADO'))
          OR (f.TipoRecurso='FILE'    AND EXISTS (SELECT 1 FROM Archivos a INNER JOIN Proyectos p ON p.Id=a.IdProyecto WHERE a.Id=f.IdRecurso AND p.IdOrganizacion=f.IdOrganizacion AND ISNULL(p.Estado,'ACTIVO')<>'ELIMINADO'))
        )
    `)
    const total = Number(countQ.recordset[0]?.c ?? 0)

    const q = await r.query<any>(`
      SELECT * FROM (
        SELECT
          CAST(f.IdUsuario AS NVARCHAR(128)) userId,
          CAST(f.IdOrganizacion AS NVARCHAR(128)) organizationId,
          f.TipoRecurso resourceType,
          CAST(f.IdRecurso AS NVARCHAR(128)) resourceId,
          f.FechaCreacion createdAt,
          CASE
            WHEN f.TipoRecurso='PROJECT' THEN p.Nombre
            WHEN f.TipoRecurso='FOLDER'  THEN c.Nombre
            WHEN f.TipoRecurso='FILE'    THEN a.Nombre
          END name,
          CASE
            WHEN f.TipoRecurso='PROJECT' THEN CAST(p.Id AS NVARCHAR(128))
            WHEN f.TipoRecurso='FOLDER'  THEN CAST(cp.Id AS NVARCHAR(128))
            WHEN f.TipoRecurso='FILE'    THEN CAST(ap.Id AS NVARCHAR(128))
          END projectId,
          CASE
            WHEN f.TipoRecurso='PROJECT' THEN p.Nombre
            WHEN f.TipoRecurso='FOLDER'  THEN cp.Nombre
            WHEN f.TipoRecurso='FILE'    THEN ap.Nombre
          END projectName,
          CASE
            WHEN f.TipoRecurso='FOLDER'  THEN CAST(c.Id AS NVARCHAR(128))
            WHEN f.TipoRecurso='FILE'    THEN CAST(a.IdCarpeta AS NVARCHAR(128))
          END folderId,
          CASE
            WHEN f.TipoRecurso='FOLDER'  THEN c.Nombre
            WHEN f.TipoRecurso='FILE'    THEN cf.Nombre
          END folderName,
          CASE WHEN f.TipoRecurso='FILE' THEN a.Extension END extension,
          CASE WHEN f.TipoRecurso='FILE' THEN a.TipoMime END mime
        FROM Favoritos f
        LEFT JOIN Proyectos p ON p.Id=f.IdRecurso AND f.TipoRecurso='PROJECT'
        LEFT JOIN Carpetas c  ON c.Id=f.IdRecurso AND f.TipoRecurso='FOLDER'
        LEFT JOIN Proyectos cp ON cp.Id=c.IdProyecto AND f.TipoRecurso='FOLDER'
        LEFT JOIN Archivos a  ON a.Id=f.IdRecurso AND f.TipoRecurso='FILE'
        LEFT JOIN Proyectos ap ON ap.Id=a.IdProyecto AND f.TipoRecurso='FILE'
        LEFT JOIN Carpetas cf ON cf.Id=a.IdCarpeta AND f.TipoRecurso='FILE'
        WHERE f.IdUsuario = @uid AND f.IdOrganizacion = @orgId
          ${filterRt}
          AND (
            (f.TipoRecurso='PROJECT' AND p.Id IS NOT NULL)
            OR (f.TipoRecurso='FOLDER'  AND c.Id IS NOT NULL AND cp.Id IS NOT NULL AND ISNULL(cp.Estado,'ACTIVO')<>'ELIMINADO')
            OR (f.TipoRecurso='FILE'    AND a.Id IS NOT NULL AND ap.Id IS NOT NULL AND ISNULL(ap.Estado,'ACTIVO')<>'ELIMINADO')
          )
      ) X
      ORDER BY createdAt DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSize} ROWS ONLY;
    `)

    const items: FavoriteItem[] = q.recordset.map((row) => ({
      userId: String(row.userId),
      organizationId: String(row.organizationId),
      resourceType: (String(row.resourceType) || 'FILE') as FavoriteItem['resourceType'],
      resourceId: String(row.resourceId),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      name: row.name ?? null,
      projectId: row.projectId ? String(row.projectId) : null,
      projectName: row.projectName ?? null,
      folderId: row.folderId ? String(row.folderId) : null,
      folderName: row.folderName ?? null,
      extension: row.extension ?? null,
      mime: row.mime ?? null,
    }))

    res.status(200).json({ success: true, data: { items, total } })
  } catch (err) {
    next(err)
  }
}

export async function checkFavoriteEndpoint(
  req: Request,
  res: Response<ApiResponse<{ favorited: boolean; createdAt: string | null }>>,
  next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const resourceType = validateResourceType(req.query.resourceType)
    const resourceId = validateGuid(req.query.resourceId, 'resourceId')
    const pool = await getDbPool()

    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('uid', sql.UniqueIdentifier, auth.userId)
    q.input('rid', sql.UniqueIdentifier, resourceId)
    q.input('rt', sql.VarChar(20), resourceType)
    const r = await q.query<{ FechaCreacion: Date | null }>(`
      SELECT FechaCreacion FROM Favoritos
      WHERE IdUsuario=@uid AND IdOrganizacion=@orgId AND TipoRecurso=@rt AND IdRecurso=@rid;
    `)
    const row = r.recordset[0]
    const favorited = !!row
    res.status(200).json({
      success: true,
      data: {
        favorited,
        createdAt: row?.FechaCreacion ? new Date(row.FechaCreacion).toISOString() : null,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function addFavoriteEndpoint(
  req: Request,
  res: Response<ApiResponse<{ favorited: boolean; createdAt: string | null }>>,
  next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const resourceType = validateResourceType(req.body?.resourceType)
    const resourceId = validateGuid(req.body?.resourceId, 'resourceId')
    const pool = await getDbPool()

    const meta = await assertResourceInOrg(pool, auth, resourceType, resourceId)
    if (!meta.exists || !meta.belongs) throw new NotFoundError('Recurso no encontrado')

    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('uid', sql.UniqueIdentifier, auth.userId)
    q.input('rid', sql.UniqueIdentifier, resourceId)
    q.input('rt', sql.VarChar(20), resourceType)

    const r = await q.query<{ FechaCreacion: Date }>(`
      IF EXISTS (SELECT 1 FROM Favoritos WHERE IdUsuario=@uid AND IdOrganizacion=@orgId AND TipoRecurso=@rt AND IdRecurso=@rid)
        SELECT FechaCreacion FROM Favoritos WHERE IdUsuario=@uid AND IdOrganizacion=@orgId AND TipoRecurso=@rt AND IdRecurso=@rid;
      ELSE
        INSERT INTO Favoritos (IdUsuario, IdOrganizacion, TipoRecurso, IdRecurso)
        OUTPUT INSERTED.FechaCreacion
        VALUES (@uid, @orgId, @rt, @rid);
    `)
    const row = r.recordset[0]
    res.status(200).json({
      success: true,
      data: {
        favorited: true,
        createdAt: row?.FechaCreacion ? new Date(row.FechaCreacion).toISOString() : null,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function removeFavoriteEndpoint(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const resourceType = validateResourceType(req.params.resourceType)
    const resourceId = validateGuid(req.params.resourceId, 'resourceId')
    const pool = await getDbPool()
    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('uid', sql.UniqueIdentifier, auth.userId)
    q.input('rid', sql.UniqueIdentifier, resourceId)
    q.input('rt', sql.VarChar(20), resourceType)
    await q.query(`DELETE FROM Favoritos WHERE IdUsuario=@uid AND IdOrganizacion=@orgId AND TipoRecurso=@rt AND IdRecurso=@rid;`)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function toggleFavoriteEndpoint(
  req: Request,
  res: Response<ApiResponse<{ favorited: boolean; createdAt: string | null }>>,
  next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const resourceType = validateResourceType(req.body?.resourceType)
    const resourceId = validateGuid(req.body?.resourceId, 'resourceId')
    const pool = await getDbPool()

    const meta = await assertResourceInOrg(pool, auth, resourceType, resourceId)
    if (!meta.exists || !meta.belongs) throw new NotFoundError('Recurso no encontrado')

    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('uid', sql.UniqueIdentifier, auth.userId)
    q.input('rid', sql.UniqueIdentifier, resourceId)
    q.input('rt', sql.VarChar(20), resourceType)
    const check = await q.query<{ FechaCreacion: Date | null }>(`
      SELECT FechaCreacion FROM Favoritos WHERE IdUsuario=@uid AND IdOrganizacion=@orgId AND TipoRecurso=@rt AND IdRecurso=@rid;
    `)
    const exists = !!check.recordset[0]
    if (exists) {
      await q.query(`DELETE FROM Favoritos WHERE IdUsuario=@uid AND IdOrganizacion=@orgId AND TipoRecurso=@rt AND IdRecurso=@rid;`)
      res.status(200).json({ success: true, data: { favorited: false, createdAt: null } })
      return
    }
    const r = await q.query<{ FechaCreacion: Date }>(`
      INSERT INTO Favoritos (IdUsuario, IdOrganizacion, TipoRecurso, IdRecurso)
      OUTPUT INSERTED.FechaCreacion
      VALUES (@uid, @orgId, @rt, @rid);
    `)
    const row = r.recordset[0]
    res.status(200).json({
      success: true,
      data: {
        favorited: true,
        createdAt: row?.FechaCreacion ? new Date(row.FechaCreacion).toISOString() : null,
      },
    })
  } catch (err) {
    next(err)
  }
}
