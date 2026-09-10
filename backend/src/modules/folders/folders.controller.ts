import type { Request, Response, NextFunction } from 'express'
import type { ApiResponse } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError'
import { copyFileById } from '../files/files.service'
import { logAuditRecord } from '../../shared/db/audit'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

export type CarpetaRow = {
  Id: string
  IdProyecto: string
  IdCarpetaPadre: string | null
  IdPropietario: string | null
  Nombre: string
  HeredaPermisos: boolean | number | null
  FechaCreacion: Date
  FechaActualizacion: Date | null
  archivosCount?: number | null
  hijosCount?: number | null
}

function mapCarpeta(row: CarpetaRow) {
  return {
    id: String(row.Id),
    projectId: String(row.IdProyecto),
    parentId: row.IdCarpetaPadre ? String(row.IdCarpetaPadre) : null,
    ownerId: row.IdPropietario ? String(row.IdPropietario) : null,
    name: row.Nombre,
    inheritPermissions: Boolean(row.HeredaPermisos ?? true),
    filesCount: Number(row.archivosCount ?? 0),
    childrenCount: Number(row.hijosCount ?? 0),
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
  }
}

async function assertProjectMembership(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  auth: { organizationId: string; userId: string },
  projectId: string
): Promise<void> {
  const q = pool.request()
  q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  q.input('userId', sql.UniqueIdentifier, auth.userId)
  q.input('pid', sql.UniqueIdentifier, projectId)
  const r = await q.query<{ ok: number }>(`
    SELECT 1 ok FROM Proyectos p
    WHERE p.Id = @pid AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
      AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId));
  `)
  if (!r.recordset[0]) throw new ForbiddenError('No tienes acceso a este proyecto')
}

export async function listFolders(
  req: Request,
  res: Response<ApiResponse<{ items: unknown[]; total: number }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.query.projectId || '')
    if (!projectId) throw new AppError('projectId es requerido', 400)
    const parentIdRaw = req.query.parentId
    const rootOnly = req.query.rootOnly === 'true'
    const includeAll = req.query.includeAll === 'true' || req.query.flat === 'true'

    const pool = await getDbPool()
    await assertProjectMembership(pool, auth, projectId)

    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('pid', sql.UniqueIdentifier, projectId)

    let where = `c.IdProyecto = @pid`
    if (includeAll) {
      // todas las carpetas del proyecto, cliente arma árbol
    } else if (rootOnly || parentIdRaw == null || parentIdRaw === '') {
      where += ` AND c.IdCarpetaPadre IS NULL`
    } else {
      q.input('parent', sql.UniqueIdentifier, String(parentIdRaw))
      where += ` AND c.IdCarpetaPadre = @parent`
    }
    const sqlText = `
      SELECT
        c.Id, c.IdProyecto, c.IdCarpetaPadre, c.IdPropietario, c.Nombre, c.HeredaPermisos,
        c.FechaCreacion, c.FechaActualizacion,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdCarpeta = c.Id) archivosCount,
        (SELECT COUNT(*) FROM Carpetas cc WHERE cc.IdCarpetaPadre = c.Id) hijosCount
      FROM Carpetas c
        INNER JOIN Proyectos p ON p.Id = c.IdProyecto
      WHERE ${where} AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
      ORDER BY c.Nombre ASC;

      SELECT COUNT(*) total FROM Carpetas WHERE IdProyecto=@pid;
    `
    const r: any = await q.query<any>(sqlText)
    const rows: CarpetaRow[] = r.recordsets && r.recordsets[0] ? (r.recordsets[0] as CarpetaRow[]) : (r.recordset as any)
    const totalRaw: any = r.recordsets && r.recordsets[1] ? r.recordsets[1][0] : null
    const total = totalRaw ? Number(totalRaw.total ?? rows.length) : rows.length
    res.status(200).json({ success: true, data: { items: rows.map(mapCarpeta), total } })
  } catch (err) {
    next(err)
  }
}

export async function createFolder(
  req: Request,
  res: Response<ApiResponse<{ folder: ReturnType<typeof mapCarpeta> }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const projectId = String(req.body?.projectId || '')
    if (!projectId) throw new AppError('projectId es requerido', 400)
    const name = String(req.body?.name || '').trim()
    if (name.length === 0 || name.length > 255) throw new AppError('Nombre de carpeta inválido (1..255)', 400)
    const parentId = req.body?.parentId ? String(req.body.parentId) : null

    const pool = await getDbPool()
    await assertProjectMembership(pool, auth, projectId)

    if (parentId) {
      const pq = pool.request()
      pq.input('pid', sql.UniqueIdentifier, projectId)
      pq.input('parent', sql.UniqueIdentifier, parentId)
      const pcheck = await pq.query<{ Id: string }>(`SELECT Id FROM Carpetas WHERE Id=@parent AND IdProyecto=@pid;`)
      if (!pcheck.recordset[0]) throw new NotFoundError('Carpeta padre no existe en este proyecto')
    }

    const ins = pool.request()
    ins.input('pid', sql.UniqueIdentifier, projectId)
    ins.input('parent', sql.UniqueIdentifier, parentId || null)
    ins.input('uid', sql.UniqueIdentifier, auth.userId)
    ins.input('name', sql.NVarChar(255), name)
    const r = await ins.query<{ Id: string; FechaCreacion: Date; FechaActualizacion: Date | null }>(`
      INSERT INTO Carpetas (IdProyecto, IdCarpetaPadre, IdPropietario, Nombre, FechaCreacion, FechaActualizacion)
      OUTPUT INSERTED.Id, INSERTED.FechaCreacion, INSERTED.FechaActualizacion
      VALUES (@pid, @parent, @uid, @name, GETDATE(), GETDATE());
    `)
    const newId = String(r.recordset[0]?.Id)
    if (!newId) throw new AppError('No se pudo crear la carpeta', 500)

    const dq = pool.request()
    dq.input('id', sql.UniqueIdentifier, newId)
    const detail = await dq.query<CarpetaRow>(`
      SELECT
        c.Id, c.IdProyecto, c.IdCarpetaPadre, c.IdPropietario, c.Nombre, c.HeredaPermisos,
        c.FechaCreacion, c.FechaActualizacion,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdCarpeta = c.Id) archivosCount,
        (SELECT COUNT(*) FROM Carpetas cc WHERE cc.IdCarpetaPadre = c.Id) hijosCount
      FROM Carpetas c WHERE c.Id = @id;
    `)
    const row = detail.recordset[0] as CarpetaRow
    logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'folder.creada',
      resourceType: 'folder',
      resourceId: newId,
      resourceName: name,
      projectId: row.IdProyecto,
      extra: { parentId: parentId ? String(parentId) : null },
      req,
    })
    res.status(201).json({ success: true, data: { folder: mapCarpeta(row) } })
  } catch (err) {
    next(err)
  }
}

export async function updateFolder(
  req: Request,
  res: Response<ApiResponse<{ folder: ReturnType<typeof mapCarpeta> }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const patchName = req.body?.name != null ? String(req.body.name).trim() : null
    const patchParentId = req.body?.parentId != null ? (req.body.parentId ? String(req.body.parentId) : null) : undefined
    if (patchName !== null && (patchName.length === 0 || patchName.length > 255)) {
      throw new AppError('Nombre inválido (1..255)', 400)
    }

    const pool = await getDbPool()
    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('userId', sql.UniqueIdentifier, auth.userId)
    q.input('id', sql.UniqueIdentifier, id)
    const row = await q.query<{ Id: string; IdProyecto: string; IdPropietario: string | null; Nombre: string; IdCarpetaPadre: string | null }>(`
      SELECT c.Id, c.IdProyecto, c.IdPropietario, c.Nombre, c.IdCarpetaPadre FROM Carpetas c
        INNER JOIN Proyectos p ON p.Id = c.IdProyecto
      WHERE c.Id = @id AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const cur = row.recordset[0]
    if (!cur) throw new NotFoundError('Carpeta no encontrada')
    const oldFolderName = String(cur.Nombre)
    const oldParentId = cur.IdCarpetaPadre ? String(cur.IdCarpetaPadre) : null
    const didRenameFolder = patchName !== null && patchName !== oldFolderName
    const didMoveFolder =
      patchParentId !== undefined &&
      String(patchParentId ?? 'NULL') !== String(oldParentId ?? 'NULL')

    const sets: string[] = []
    const up = pool.request()
    if (patchName !== null) { up.input('n', sql.NVarChar(255), patchName); sets.push(`Nombre=@n`) }
    if (patchParentId !== undefined) {
      if (patchParentId === id) throw new AppError('Una carpeta no puede ser padre de sí misma', 400)
      if (patchParentId !== null) {
        const pc = pool.request()
        pc.input('pid', sql.UniqueIdentifier, cur.IdProyecto)
        pc.input('parent', sql.UniqueIdentifier, patchParentId)
        const pcheck = await pc.query<{ Id: string }>(`SELECT Id FROM Carpetas WHERE Id=@parent AND IdProyecto=@pid;`)
        if (!pcheck.recordset[0]) throw new NotFoundError('Carpeta padre no existe en este proyecto')
        const isDesc = await isDescendantFolder(pool, cur.IdProyecto, id, patchParentId)
        if (isDesc) throw new AppError('No se puede mover una carpeta dentro de su propio subárbol', 400)
      }
      up.input('parent', sql.UniqueIdentifier, patchParentId)
      sets.push(`IdCarpetaPadre=@parent`)
    }
    if (sets.length > 0) {
      sets.push(`FechaActualizacion=GETDATE()`)
      up.input('id', sql.UniqueIdentifier, id)
      await up.query(`UPDATE Carpetas SET ${sets.join(', ')} WHERE Id=@id;`)
    }

    const dq = pool.request()
    dq.input('id', sql.UniqueIdentifier, id)
    const detail = await dq.query<CarpetaRow>(`
      SELECT
        c.Id, c.IdProyecto, c.IdCarpetaPadre, c.IdPropietario, c.Nombre, c.HeredaPermisos,
        c.FechaCreacion, c.FechaActualizacion,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdCarpeta = c.Id) archivosCount,
        (SELECT COUNT(*) FROM Carpetas cc WHERE cc.IdCarpetaPadre = c.Id) hijosCount
      FROM Carpetas c WHERE c.Id = @id;
    `)
    const updated = detail.recordset[0] as CarpetaRow
    if (didRenameFolder) {
      logAuditRecord({
        organizationId: auth.organizationId,
        userId: auth.userId,
        action: 'folder.renombrada',
        resourceType: 'folder',
        resourceId: id,
        resourceName: updated.Nombre,
        projectId: updated.IdProyecto,
        extra: { fromName: oldFolderName, toName: updated.Nombre },
        req,
      })
    }
    if (didMoveFolder) {
      logAuditRecord({
        organizationId: auth.organizationId,
        userId: auth.userId,
        action: 'folder.movida',
        resourceType: 'folder',
        resourceId: id,
        resourceName: updated.Nombre,
        projectId: updated.IdProyecto,
        extra: { fromParent: oldParentId, toParent: patchParentId ? String(patchParentId) : null },
        req,
      })
    }
    res.status(200).json({ success: true, data: { folder: mapCarpeta(updated) } })
  } catch (err) {
    next(err)
  }
}

export async function deleteFolder(
  req: Request,
  res: Response<ApiResponse<void>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const pool = await getDbPool()
    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('userId', sql.UniqueIdentifier, auth.userId)
    q.input('id', sql.UniqueIdentifier, id)
    const cur = await q.query<{ Id: string; IdProyecto: string; IdPropietario: string | null; ProjectOwner: string | null }>(`
      SELECT c.Id, c.IdProyecto, c.IdPropietario, p.IdPropietario ProjectOwner
      FROM Carpetas c INNER JOIN Proyectos p ON p.Id = c.IdProyecto
      WHERE c.Id = @id AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const row = cur.recordset[0]
    if (!row) throw new NotFoundError('Carpeta no encontrada')
    const isOwner =
      (row.ProjectOwner && String(row.ProjectOwner).toLowerCase() === String(auth.userId).toLowerCase()) ||
      (row.IdPropietario && String(row.IdPropietario).toLowerCase() === String(auth.userId).toLowerCase())
    if (!isOwner) throw new ForbiddenError('Solo el propietario puede eliminar la carpeta')

    const del = pool.request()
    del.input('id', sql.UniqueIdentifier, id)
    del.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    await del.query(`
      SET NOCOUNT ON;
      DECLARE @IdsCarpeta TABLE (Id UNIQUEIDENTIFIER PRIMARY KEY);
      WITH cte AS (
        SELECT Id FROM Carpetas WHERE Id = @id
        UNION ALL
        SELECT c.Id FROM Carpetas c INNER JOIN cte ON c.IdCarpetaPadre = cte.Id
      )
      INSERT INTO @IdsCarpeta (Id) SELECT Id FROM cte;

      UPDATE Proyectos SET IdDocMaestroCarpeta = NULL, FechaActualizacion = GETDATE()
      WHERE IdDocMaestroCarpeta IN (SELECT Id FROM @IdsCarpeta) AND IdOrganizacion = @orgId;

      DELETE a FROM Archivos a INNER JOIN @IdsCarpeta i ON a.IdCarpeta=i.Id;
      DELETE r FROM Auditoria r INNER JOIN @IdsCarpeta i ON r.TipoRecurso='folder' AND r.IdRecurso=i.Id;
      DELETE c FROM Carpetas c INNER JOIN @IdsCarpeta i ON c.Id=i.Id;
    `)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function getFolderEndpoint(
  req: Request,
  res: Response<ApiResponse<ReturnType<typeof mapCarpeta>>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const pool = await getDbPool()
    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('userId', sql.UniqueIdentifier, auth.userId)
    q.input('id', sql.UniqueIdentifier, id)
    const r = await q.query<CarpetaRow>(`
      SELECT
        c.Id, c.IdProyecto, c.IdCarpetaPadre, c.IdPropietario, c.Nombre, c.HeredaPermisos,
        c.FechaCreacion, c.FechaActualizacion,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdCarpeta = c.Id) archivosCount,
        (SELECT COUNT(*) FROM Carpetas cc WHERE cc.IdCarpetaPadre = c.Id) hijosCount
      FROM Carpetas c
        INNER JOIN Proyectos p ON p.Id = c.IdProyecto
      WHERE c.Id = @id AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const row = r.recordset[0]
    if (!row) throw new NotFoundError('Carpeta no encontrada')
    res.status(200).json({ success: true, data: mapCarpeta(row) })
  } catch (err) {
    next(err)
  }
}

async function isDescendantFolder(
  pool: Awaited<ReturnType<typeof getDbPool>>,
  projectId: string,
  ancestorId: string,
  candidateId: string
): Promise<boolean> {
  const q = pool.request()
  q.input('pid', sql.UniqueIdentifier, projectId)
  q.input('ancestor', sql.UniqueIdentifier, ancestorId)
  q.input('candidate', sql.UniqueIdentifier, candidateId)
  const r = await q.query<{ ok: number }>(`
    WITH cte AS (
      SELECT Id FROM Carpetas WHERE Id = @candidate AND IdProyecto = @pid
      UNION ALL
      SELECT c.IdCarpetaPadre Id
      FROM Carpetas c
      INNER JOIN cte ON cte.Id = c.Id AND c.IdCarpetaPadre IS NOT NULL
    )
    SELECT 1 ok WHERE EXISTS (SELECT 1 FROM cte WHERE Id = @ancestor);
  `)
  return Boolean(r.recordset && r.recordset.length && r.recordset[0])
}

export async function copyFolder(
  req: Request,
  res: Response<ApiResponse<{ folder: ReturnType<typeof mapCarpeta>; copiedFolders: number; copiedFiles: number }>>,
  next: NextFunction
) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const id = String(req.params.id)
    const targetParentId =
      req.body && req.body.targetParentId !== undefined
        ? req.body.targetParentId
          ? String(req.body.targetParentId)
          : null
        : undefined
    const newName = req.body && req.body.name != null ? String(req.body.name).trim() : null

    const pool = await getDbPool()
    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    q.input('userId', sql.UniqueIdentifier, auth.userId)
    q.input('id', sql.UniqueIdentifier, id)
    const row = await q.query<CarpetaRow & { ProjectOwner: string | null }>(`
      SELECT c.*, p.IdPropietario ProjectOwner
      FROM Carpetas c INNER JOIN Proyectos p ON p.Id = c.IdProyecto
      WHERE c.Id = @id AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
    `)
    const src = row.recordset[0] as any
    if (!src) throw new NotFoundError('Carpeta no encontrada')
    const projectId = String(src.IdProyecto)
    const ProjectOwner = String(src.ProjectOwner)
    const isOwner =
      ProjectOwner.toLowerCase() === String(auth.userId).toLowerCase() ||
      (src.IdPropietario && String(src.IdPropietario).toLowerCase() === String(auth.userId).toLowerCase())
    if (!isOwner) throw new ForbiddenError('Solo el propietario puede copiar la carpeta')

    const resolvedParent = targetParentId !== undefined ? targetParentId : (src.IdCarpetaPadre ? String(src.IdCarpetaPadre) : null)
    if (resolvedParent != null) {
      if (resolvedParent === String(src.Id)) throw new AppError('Una carpeta no puede copiarse dentro de sí misma', 400)
      const pc = pool.request()
      pc.input('pid', sql.UniqueIdentifier, projectId)
      pc.input('parent', sql.UniqueIdentifier, String(resolvedParent))
      const pcheck = await pc.query<{ Id: string }>('SELECT Id FROM Carpetas WHERE Id=@parent AND IdProyecto=@pid')
      if (!pcheck.recordset[0]) throw new NotFoundError('Carpeta destino no existe en este proyecto')
      const isDesc = await isDescendantFolder(pool, projectId, String(src.Id), resolvedParent)
      if (isDesc) throw new AppError('No se puede copiar una carpeta dentro de su propio subárbol', 400)
    }

    const allReq = pool.request()
    allReq.input('pid', sql.UniqueIdentifier, projectId)
    const allFolders = await allReq.query<CarpetaRow>('SELECT * FROM Carpetas WHERE IdProyecto=@pid')
    const byParent = new Map<string, CarpetaRow[]>()
    for (const f of allFolders.recordset) {
      const key = f.IdCarpetaPadre ? String(f.IdCarpetaPadre) : '__root__'
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key)!.push(f)
    }

    async function collectFilesRec(folderId: string): Promise<string[]> {
      const ids: string[] = []
      const fq = pool.request()
      fq.input('folder', sql.UniqueIdentifier, folderId)
      const rfiles = await fq.query<{ Id: string }>('SELECT Id FROM Archivos WHERE IdCarpeta=@folder')
      for (const a of rfiles.recordset) ids.push(String(a.Id))
      const kids = byParent.get(folderId) || []
      for (const k of kids) {
        const more = await collectFilesRec(String(k.Id))
        ids.push(...more)
      }
      return ids
    }

    let copiedFolders = 0
    let copiedFiles = 0
    const idMap = new Map<string, string>()

    const baseFolderName = newName && newName.length > 0 && newName.length <= 255 ? newName : String(src.Nombre)
    async function cloneFolder(srcFolderId: string, newParentId: string | null): Promise<string> {
      const isRoot = srcFolderId === String(src.Id)
      const curSrc: any = isRoot
        ? src
        : allFolders.recordset.find((rf) => String(rf.Id) === srcFolderId)
      if (!curSrc) throw new NotFoundError('Carpeta fuente no encontrada')
      const name = isRoot ? baseFolderName : String(curSrc.Nombre)
      const ins = pool.request()
      ins.input('pid', sql.UniqueIdentifier, projectId)
      ins.input('parent', sql.UniqueIdentifier, newParentId || null)
      ins.input('uid', sql.UniqueIdentifier, auth.userId)
      ins.input('name', sql.NVarChar(255), name)
      const insRes = await ins.query<{ Id: string; FechaCreacion: Date }>(`
        DECLARE @NuevoId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO Carpetas (IdProyecto, IdCarpetaPadre, IdPropietario, Nombre, HeredaPermisos, FechaCreacion, FechaActualizacion)
        OUTPUT INSERTED.Id, INSERTED.FechaCreacion
        VALUES (@pid, @parent, @uid, @name, 1, GETDATE(), GETDATE());
      `)
      const newId = String(insRes.recordset[0].Id)
      idMap.set(srcFolderId, newId)
      copiedFolders += 1
      const fileIds = isRoot
        ? (await (async () => {
            const fq = pool.request()
            fq.input('folder', sql.UniqueIdentifier, srcFolderId)
            const r = await fq.query<{ Id: string }>('SELECT Id FROM Archivos WHERE IdCarpeta=@folder')
            return r.recordset.map((x) => String(x.Id))
          })())
        : await collectFilesRec(srcFolderId)
      for (const fid of fileIds) {
          await copyFileById(auth, fid, { targetFolderId: newId })
          copiedFiles += 1
        }
      const kids = byParent.get(srcFolderId) || []
      for (const k of kids) {
        await cloneFolder(String(k.Id), newId)
      }
      return newId
    }

    const newRootId = await cloneFolder(String(src.Id), resolvedParent)

    const dq = pool.request()
    dq.input('id', sql.UniqueIdentifier, newRootId)
    const detail = await dq.query<CarpetaRow>(`
      SELECT
        c.Id, c.IdProyecto, c.IdCarpetaPadre, c.IdPropietario, c.Nombre, c.HeredaPermisos,
        c.FechaCreacion, c.FechaActualizacion,
        (SELECT COUNT(*) FROM Archivos a WHERE a.IdCarpeta = c.Id) archivosCount,
        (SELECT COUNT(*) FROM Carpetas cc WHERE cc.IdCarpetaPadre = c.Id) hijosCount
      FROM Carpetas c WHERE c.Id = @id;
    `)
    const created = detail.recordset[0]
    logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'folder.copiada',
      resourceType: 'folder',
      resourceId: String(created.Id),
      resourceName: String(created.Nombre),
      projectId: String(created.IdProyecto),
      extra: { copiedFrom: id, toParent: created.IdCarpetaPadre ? String(created.IdCarpetaPadre) : null },
      req,
    })
    res.status(201).json({
      success: true,
      data: { folder: mapCarpeta(created), copiedFolders, copiedFiles },
    })
  } catch (err) {
    next(err)
  }
}
