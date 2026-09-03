import path from 'node:path'
import crypto from 'node:crypto'
import { getDbPool, sql } from '../../shared/db/pool'
import { getStorageProvider } from '../../shared/storage'
import { env } from '../../shared/config/env'
import { AppError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError'
import { ensureAuditAndCommentTables, logAuditRecord, truncateForActivity } from '../../shared/db/audit'
import type { Request } from 'express'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'

export interface ArchivoDto {
  id: string
  folderId: string | null
  projectId: string
  ownerId: string
  ownerName: string | null
  ownerEmail: string | null
  name: string
  extension: string | null
  mimeType: string | null
  sizeBytes: number
  storageKey: string
  storageProvider: 'local' | 's3'
  downloadUrl: string
  s3Bucket: string | null
  s3ETag: string | null
  s3VersionId: string | null
  checksumSHA256: string | null
  createdAt: string
  updatedAt: string | null
}

function mapArchivo(
  row: {
    Id: string
    IdCarpeta: string | null
    IdProyecto: string
    IdPropietario: string
    Nombre: string
    Extension: string | null
    TipoMime: string | null
    Tamano: number | null
    StorageProvider: string | null
    StorageKey: string | null
    S3Bucket: string | null
    S3ETag: string | null
    S3VersionId: string | null
    ChecksumSHA256: string | null
    FechaCreacion: Date
    FechaActualizacion: Date | null
    OwnerNombre?: string | null
    OwnerCorreo?: string | null
  },
  downloadUrl: string
): ArchivoDto {
  const fallbackKey = row.StorageKey || buildStorageKey(row)
  return {
    id: String(row.Id),
    folderId: row.IdCarpeta ? String(row.IdCarpeta) : null,
    projectId: String(row.IdProyecto),
    ownerId: String(row.IdPropietario),
    ownerName: row.OwnerNombre ?? null,
    ownerEmail: row.OwnerCorreo ?? null,
    name: row.Nombre,
    extension: row.Extension ?? null,
    mimeType: row.TipoMime ?? null,
    sizeBytes: Number(row.Tamano ?? 0),
    storageKey: fallbackKey,
    storageProvider: ((String(row.StorageProvider || getStorageProvider().name)) as 'local' | 's3'),
    downloadUrl,
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(row.FechaActualizacion as any),
    s3Bucket: row.S3Bucket ?? null,
    s3ETag: row.S3ETag ?? null,
    s3VersionId: row.S3VersionId ?? null,
    checksumSHA256: row.ChecksumSHA256 ?? null,
  }
}

function buildStorageKey(row: {
  IdProyecto: string
  IdCarpeta?: string | null
  Id: string
  Nombre: string
  Extension?: string | null
}): string {
  const proj = String(row.IdProyecto)
  const cleanName = String(row.Nombre).replace(/[^a-zA-Z0-9._\- ]/g, '_').replace(/\s+/g, '-')
  const parts: string[] = ['projects', proj]
  if (row.IdCarpeta) parts.push('folders', String(row.IdCarpeta))
  parts.push(`${String(row.Id)}_${cleanName}`)
  return parts.join('/')
}

async function ensureProjectAccess(pool: any, auth: { organizationId: string; userId: string }, projectId: string): Promise<void> {
  const req = pool.request()
  req.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  req.input('userId', sql.UniqueIdentifier, auth.userId)
  req.input('projectId', sql.UniqueIdentifier, projectId)
  const row = await req.query(`
    SELECT p.Id FROM Proyectos p
    WHERE p.Id = @projectId AND p.IdOrganizacion = @orgId
      AND (p.IdPropietario = @userId OR EXISTS (
        SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId
      ))
  `)
  if (!row.recordset.length) throw new ForbiddenError('No tienes acceso al proyecto especificado')
}

export async function uploadFile(
  auth: { organizationId: string; userId: string },
  file: Express.Multer.File,
  body: { projectId: string; folderId?: string | null; description?: string },
  opts?: { req?: Request | null }
): Promise<ArchivoDto> {
  if (!file) throw new AppError('Archivo requerido', 400)
  if (!body.projectId) throw new AppError('projectId requerido', 400)

  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, body.projectId)

  const storage = getStorageProvider()
  const ext = path.extname(file.originalname).replace(/^\./, '') || null
  const name = file.originalname || 'archivo'
  const providerName = storage.name
  const bucket = env.AWS_S3_BUCKET || null
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')

  const idReq = pool.request()
  idReq.input('projectId', sql.UniqueIdentifier, body.projectId)
  idReq.input('folderId', sql.UniqueIdentifier, body.folderId || null)
  idReq.input('ownerId', sql.UniqueIdentifier, auth.userId)
  idReq.input('name', sql.NVarChar(255), name)
  idReq.input('extension', sql.VarChar(20), ext)
  idReq.input('mime', sql.VarChar(100), file.mimetype)
  idReq.input('size', sql.BigInt, Number(file.size) || 0)
  idReq.input('provider', sql.VarChar(10), providerName)
  idReq.input('bucket', sql.NVarChar(200), bucket)
  idReq.input('sha256', sql.VarChar(64), sha256)
  const idRow = await idReq.query(`
    DECLARE @NuevoId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO Archivos (Id,IdCarpeta,IdProyecto,IdPropietario,Nombre,Extension,TipoMime,Tamano,HeredaPermisos,FechaCreacion,FechaActualizacion,StorageProvider,S3Bucket,ChecksumSHA256)
    OUTPUT INSERTED.Id
    VALUES (@NuevoId,@folderId,@projectId,@ownerId,@name,@extension,@mime,@size,1,GETDATE(),GETDATE(),@provider,@bucket,@sha256);
  `)
  const id = String(idRow.recordset[0].Id)
  const storageKey = buildStorageKey({
    IdProyecto: body.projectId,
    IdCarpeta: body.folderId || null,
    Id: id,
    Nombre: name,
    Extension: ext,
  })
  let putResult: { etag?: string; sizeBytes: number; s3VersionId?: string } | null = null
  try {
    const res = await storage.putObject(storageKey, file.buffer, {
      contentType: file.mimetype,
      metadata: {
        owner: auth.userId,
        organization: auth.organizationId,
        project: body.projectId,
        sha256,
      },
    })
    putResult = { etag: res.etag?.replace(/^"|"$/g, ''), sizeBytes: res.sizeBytes, s3VersionId: (res as any).versionId }
  } catch (e: any) {
    const del = pool.request()
    del.input('id', sql.UniqueIdentifier, id)
    await del.query('DELETE FROM Archivos WHERE Id=@id')
    throw e
  }

  const upd = pool.request()
  upd.input('id', sql.UniqueIdentifier, id)
  upd.input('storageKey', sql.NVarChar(1000), storageKey)
  upd.input('etag', sql.VarChar(256), putResult.etag)
  upd.input('s3VersionId', sql.VarChar(256), putResult.s3VersionId)
  await upd.query(`
    UPDATE Archivos
    SET StorageKey=@storageKey, S3ETag=@etag, S3VersionId=@s3VersionId, FechaActualizacion=GETDATE()
    WHERE Id=@id
  `)

  const getReq = pool.request()
  getReq.input('id', sql.UniqueIdentifier, id)
  const row = await getReq.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario WHERE a.Id=@id
  `)
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const finalRow = row.recordset[0]
  const downloadUrl = await storage.getPresignedDownloadUrl(storageKey)
  logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'file.subido',
    resourceType: 'file',
    resourceId: id,
    resourceName: name,
    extra: { folderId: body.folderId ? String(body.folderId) : null, sizeBytes: Number(file.size || 0) },
    req: opts?.req ?? null,
  })
  return mapArchivo(finalRow, downloadUrl)
}

export async function listFiles(
  auth: { organizationId: string; userId: string },
  params: { projectId: string; folderId?: string | null; search?: string | null; page?: number; pageSize?: number }
): Promise<{ items: ArchivoDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 50)))
  const offset = (page - 1) * pageSize
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, params.projectId)

  const where: string[] = ['a.IdProyecto=@projectId']
  const cReq = pool.request()
  cReq.input('projectId', sql.UniqueIdentifier, params.projectId)
  const folderRaw = params.folderId === undefined ? undefined : params.folderId
  const folderNormalized = folderRaw === '' ? undefined : folderRaw
  if (folderNormalized === 'root') {
    where.push('a.IdCarpeta IS NULL')
  } else if (folderNormalized != null) {
    where.push('a.IdCarpeta=@folderId')
    cReq.input('folderId', sql.UniqueIdentifier, folderNormalized)
  }
  if (params.search) {
    where.push('(a.Nombre LIKE @search)')
    cReq.input('search', sql.NVarChar(300), `%${params.search}%`)
  }
  const whereClause = 'WHERE ' + where.join(' AND ')
  const countRes = await cReq.query(`SELECT COUNT(*) AS total FROM Archivos a ${whereClause}`)
  const total = Number(countRes.recordset[0].total)
  const dReq = pool.request()
  dReq.input('projectId', sql.UniqueIdentifier, params.projectId)
  if (folderNormalized != null && folderNormalized !== 'root') dReq.input('folderId', sql.UniqueIdentifier, folderNormalized)
  if (params.search) dReq.input('search', sql.NVarChar(300), `%${params.search}%`)
  dReq.input('offset', sql.Int, offset)
  dReq.input('limit', sql.Int, pageSize)
  const rows = await dReq.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    ${whereClause}
    ORDER BY a.FechaActualizacion DESC, a.FechaCreacion DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `)
  const storage = getStorageProvider()
  const items: ArchivoDto[] = []
  for (const r of rows.recordset) {
    const key = r.StorageKey || buildStorageKey(r)
    const url = await storage.getPresignedDownloadUrl(key)
    items.push(mapArchivo(r, url))
  }
  return { items, total, page, pageSize }
}

export async function listAllFiles(
  auth: { organizationId: string; userId: string },
  params: { mine?: boolean; search?: string | null; page?: number; pageSize?: number }
): Promise<{ items: ArchivoDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Number(params.page || 1))
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 20)))
  const offset = (page - 1) * pageSize
  const pool = await getDbPool()

  const where: string[] = [
    `EXISTS (
      SELECT 1 FROM Proyectos p WHERE p.Id = a.IdProyecto
        AND p.IdOrganizacion=@orgId
        AND p.Estado <> 'ELIMINADO'
        AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto = p.Id AND mp.IdUsuario = @userId))
    )`
  ]
  const cReq = pool.request()
  cReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  cReq.input('userId', sql.UniqueIdentifier, auth.userId)
  if (params.mine) {
    where.push('a.IdPropietario = @userId')
  }
  if (params.search) {
    where.push('(a.Nombre LIKE @search)')
    cReq.input('search', sql.NVarChar(300), `%${params.search}%`)
  }
  const whereClause = 'WHERE ' + where.join(' AND ')
  const countRes = await cReq.query(`SELECT COUNT(*) AS total FROM Archivos a ${whereClause}`)
  const total = Number(countRes.recordset[0].total)
  const dReq = pool.request()
  dReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  dReq.input('userId', sql.UniqueIdentifier, auth.userId)
  if (params.search) dReq.input('search', sql.NVarChar(300), `%${params.search}%`)
  dReq.input('offset', sql.Int, offset)
  dReq.input('limit', sql.Int, pageSize)
  const rows = await dReq.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo, p.Nombre AS ProjectName
    FROM Archivos a
    LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN Proyectos p ON p.Id = a.IdProyecto
    ${whereClause}
    ORDER BY a.FechaActualizacion DESC, a.FechaCreacion DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `)
  const storage = getStorageProvider()
  const items: ArchivoDto[] = []
  for (const r of rows.recordset) {
    const key = r.StorageKey || buildStorageKey(r)
    const url = await storage.getPresignedDownloadUrl(key)
    const mapped = mapArchivo(r, url) as any
    if (r.ProjectName != null) mapped.projectName = String(r.ProjectName)
    items.push(mapped)
  }
  return { items, total, page, pageSize }
}

export async function getFileById(
  auth: { organizationId: string; userId: string },
  id: string
): Promise<ArchivoDto> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('id', sql.UniqueIdentifier, id)
  const row = await g.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario WHERE a.Id=@id
  `)
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const r = row.recordset[0]
  await ensureProjectAccess(pool, auth, String(r.IdProyecto))
  const storage = getStorageProvider()
  const key = r.StorageKey || buildStorageKey(r)
  const url = await storage.getPresignedDownloadUrl(key)
  return mapArchivo(r, url)
}

export async function deleteFileById(
  auth: { organizationId: string; userId: string },
  id: string
): Promise<void> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('id', sql.UniqueIdentifier, id)
  const row = await g.query('SELECT * FROM Archivos WHERE Id=@id')
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const r = row.recordset[0]
  await ensureProjectAccess(pool, auth, String(r.IdProyecto))
  const projQ = pool.request()
  projQ.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  projQ.input('userId', sql.UniqueIdentifier, auth.userId)
  projQ.input('pid', sql.UniqueIdentifier, String(r.IdProyecto))
  const projR = await projQ.query<{ ProjectOwner: string }>(`
    SELECT p.IdPropietario AS ProjectOwner FROM Proyectos p
    WHERE p.Id = @pid AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
      AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
  `)
  if (!projR.recordset[0]) throw new ForbiddenError('No tienes acceso a este proyecto')
  const isFileOwner = String(r.IdPropietario).toLowerCase() === String(auth.userId).toLowerCase()
  const isProjectOwner = String(projR.recordset[0].ProjectOwner).toLowerCase() === String(auth.userId).toLowerCase()
  if (!isFileOwner && !isProjectOwner) throw new ForbiddenError('Solo el propietario puede eliminar el archivo')
  const storage = getStorageProvider()
  const key = r.StorageKey || buildStorageKey(r)
  await storage.deleteObject(key).catch(() => {})
  const d = pool.request()
  d.input('id', sql.UniqueIdentifier, id)
  await d.query('DELETE FROM Archivos WHERE Id=@id')
}

export async function updateFileById(
  auth: { organizationId: string; userId: string },
  id: string,
  patch: { folderId?: string | null; name?: string },
  opts?: { req?: Request | null }
): Promise<ArchivoDto> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('id', sql.UniqueIdentifier, id)
  const row = await g.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario WHERE a.Id=@id
  `)
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const r = row.recordset[0]
  await ensureProjectAccess(pool, auth, String(r.IdProyecto))

  const patchFolderId = patch.folderId !== undefined ? (patch.folderId || null) : undefined
  const patchNameRaw = patch.name != null ? String(patch.name).trim() : null
  const originalExt = r.Extension ? String(r.Extension).toLowerCase() : null
  const originalBase = r.Nombre
    ? originalExt
      ? String(r.Nombre).slice(0, -(originalExt.length + 1))
      : String(r.Nombre)
    : 'archivo'

  function finalizeName(raw: string): { name: string; ext: string | null } {
    const trimmed = raw.trim()
    if (trimmed.length === 0) throw new AppError('Nombre inválido (1..255)', 400)
    const thisExt = path.extname(trimmed).replace(/^\./, '').toLowerCase() || null
    let base = thisExt ? trimmed.slice(0, -(thisExt.length + 1)) : trimmed
    if (base.length === 0) base = originalBase.length > 0 ? originalBase : 'archivo'
    const finalExt = originalExt
    const finalName = finalExt ? `${base}.${finalExt}` : base
    return { name: finalName, ext: finalExt }
  }

  const patchName = patchNameRaw != null ? finalizeName(patchNameRaw).name : null
  if (patchName != null && (patchName.length === 0 || patchName.length > 255)) {
    throw new AppError('Nombre inválido (1..255)', 400)
  }
  if (patchFolderId != null) {
    const pc = pool.request()
    pc.input('pid', sql.UniqueIdentifier, String(r.IdProyecto))
    pc.input('folder', sql.UniqueIdentifier, String(patchFolderId))
    const pcheck = await pc.query<{ Id: string }>('SELECT Id FROM Carpetas WHERE Id=@folder AND IdProyecto=@pid')
    if (!pcheck.recordset[0]) throw new NotFoundError('Carpeta destino no existe en este proyecto')
  }

  const sets: string[] = []
  const up = pool.request()
  if (patchFolderId !== undefined) {
    up.input('folderId', sql.UniqueIdentifier, patchFolderId)
    sets.push('IdCarpeta=@folderId')
  }
  if (patchName != null) {
    const { name, ext } = finalizeName(patchNameRaw!)
    up.input('name', sql.NVarChar(255), name)
    sets.push('Nombre=@name')
    up.input('ext', sql.VarChar(20), ext)
    sets.push('Extension=@ext')
  }
  if (sets.length === 0) {
    const storage = getStorageProvider()
    const key = r.StorageKey || buildStorageKey(r)
    const downloadUrl = await storage.getPresignedDownloadUrl(key)
    return mapArchivo(r, downloadUrl)
  }
  const didRename = patchName != null && patchName !== String(r.Nombre)
  const didMove = patchFolderId !== undefined && String(patchFolderId ?? 'NULL') !== String(r.IdCarpeta ?? 'NULL')
  const oldName = String(r.Nombre)

  sets.push('FechaActualizacion=GETDATE()')
  up.input('id', sql.UniqueIdentifier, id)
  await up.query(`UPDATE Archivos SET ${sets.join(', ')} WHERE Id=@id`)

  const g2 = pool.request()
  g2.input('id', sql.UniqueIdentifier, id)
  const after = await g2.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario WHERE a.Id=@id
  `)
  const storage = getStorageProvider()
  const finalRow = after.recordset[0]
  const finalName = String(finalRow.Nombre)
  const key = finalRow.StorageKey || buildStorageKey(finalRow)
  const downloadUrl = await storage.getPresignedDownloadUrl(key)

  if (didRename) {
    logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'file.renombrado',
      resourceType: 'file',
      resourceId: id,
      resourceName: finalName,
      extra: { fromName: oldName, toName: finalName },
      req: opts?.req ?? null,
    })
  }
  if (didMove) {
    logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'file.movido',
      resourceType: 'file',
      resourceId: id,
      resourceName: finalName,
      extra: { fromFolder: r.IdCarpeta ? String(r.IdCarpeta) : null, toFolder: patchFolderId ? String(patchFolderId) : null },
      req: opts?.req ?? null,
    })
  }
  return mapArchivo(finalRow, downloadUrl)
}

export async function copyFileById(
  auth: { organizationId: string; userId: string },
  id: string,
  opts: { targetFolderId?: string | null; name?: string },
  callOpts?: { req?: Request | null }
): Promise<ArchivoDto> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('id', sql.UniqueIdentifier, id)
  const row = await g.query('SELECT * FROM Archivos WHERE Id=@id')
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const src = row.recordset[0]
  const projectId = String(src.IdProyecto)
  await ensureProjectAccess(pool, auth, projectId)
  const projQ = pool.request()
  projQ.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  projQ.input('userId', sql.UniqueIdentifier, auth.userId)
  projQ.input('pid', sql.UniqueIdentifier, projectId)
  const projR = await projQ.query<{ ProjectOwner: string }>(`
    SELECT p.IdPropietario AS ProjectOwner FROM Proyectos p
    WHERE p.Id = @pid AND p.IdOrganizacion = @orgId AND p.Estado <> 'ELIMINADO'
      AND (p.IdPropietario = @userId OR EXISTS (SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId));
  `)
  if (!projR.recordset[0]) throw new ForbiddenError('No tienes acceso a este proyecto')
  const isFileOwner = String(src.IdPropietario).toLowerCase() === String(auth.userId).toLowerCase()
  const isProjectOwner = String(projR.recordset[0].ProjectOwner).toLowerCase() === String(auth.userId).toLowerCase()
  if (!isFileOwner && !isProjectOwner) throw new ForbiddenError('Solo el propietario puede copiar el archivo')

  const targetFolderId = opts.targetFolderId !== undefined ? (opts.targetFolderId || null) : (src.IdCarpeta ? String(src.IdCarpeta) : null)
  if (targetFolderId != null) {
    const pc = pool.request()
    pc.input('pid', sql.UniqueIdentifier, projectId)
    pc.input('folder', sql.UniqueIdentifier, String(targetFolderId))
    const pcheck = await pc.query<{ Id: string }>('SELECT Id FROM Carpetas WHERE Id=@folder AND IdProyecto=@pid')
    if (!pcheck.recordset[0]) throw new NotFoundError('Carpeta destino no existe en este proyecto')
  }

  const storage = getStorageProvider()
  const srcKey = src.StorageKey || buildStorageKey(src)
  const buf = await storage.getObject(srcKey)
  if (!buf) throw new NotFoundError('Contenido del archivo no encontrado en almacenamiento')

  let baseName = String(src.Nombre)
  if (opts.name) {
    const trimmed = String(opts.name).trim()
    if (trimmed.length > 0 && trimmed.length <= 255) baseName = trimmed
  }
  const ext = path.extname(baseName).replace(/^\./, '') || String(src.Extension || '')
  const providerName = storage.name
  const bucket = env.AWS_S3_BUCKET || null
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex')

  const ins = pool.request()
  ins.input('projectId', sql.UniqueIdentifier, projectId)
  ins.input('folderId', sql.UniqueIdentifier, targetFolderId || null)
  ins.input('ownerId', sql.UniqueIdentifier, auth.userId)
  ins.input('name', sql.NVarChar(255), baseName)
  ins.input('extension', sql.VarChar(20), ext || null)
  ins.input('mime', sql.VarChar(100), src.TipoMime)
  ins.input('size', sql.BigInt, Number(src.Tamano ?? buf.length))
  ins.input('provider', sql.VarChar(10), providerName)
  ins.input('bucket', sql.NVarChar(200), bucket)
  ins.input('sha256', sql.VarChar(64), sha256)
  const idRow = await ins.query(`
    DECLARE @NuevoId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO Archivos (Id,IdCarpeta,IdProyecto,IdPropietario,Nombre,Extension,TipoMime,Tamano,HeredaPermisos,FechaCreacion,FechaActualizacion,StorageProvider,S3Bucket,ChecksumSHA256)
    OUTPUT INSERTED.Id
    VALUES (@NuevoId,@folderId,@projectId,@ownerId,@name,@extension,@mime,@size,1,GETDATE(),GETDATE(),@provider,@bucket,@sha256);
  `)
  const newId = String(idRow.recordset[0].Id)
  const newKey = buildStorageKey({
    IdProyecto: projectId,
    IdCarpeta: targetFolderId || null,
    Id: newId,
    Nombre: baseName,
    Extension: ext || null,
  })
  let putResult: { etag?: string; sizeBytes: number; s3VersionId?: string } | null = null
  try {
    const res = await storage.putObject(newKey, buf, {
      contentType: String(src.TipoMime || 'application/octet-stream'),
      metadata: {
        owner: auth.userId,
        organization: auth.organizationId,
        project: projectId,
        sha256,
        copiedFrom: String(src.Id),
      },
    })
    putResult = { etag: res.etag?.replace(/^"|"$/g, ''), sizeBytes: res.sizeBytes, s3VersionId: (res as any).versionId }
  } catch (e) {
    const d = pool.request()
    d.input('id', sql.UniqueIdentifier, newId)
    await d.query('DELETE FROM Archivos WHERE Id=@id')
    throw e
  }
  const upd = pool.request()
  upd.input('id', sql.UniqueIdentifier, newId)
  upd.input('storageKey', sql.NVarChar(1000), newKey)
  upd.input('etag', sql.VarChar(256), putResult.etag)
  upd.input('s3VersionId', sql.VarChar(256), putResult.s3VersionId)
  await upd.query(`
    UPDATE Archivos
    SET StorageKey=@storageKey, S3ETag=@etag, S3VersionId=@s3VersionId, FechaActualizacion=GETDATE()
    WHERE Id=@id
  `)
  const getReq = pool.request()
  getReq.input('id', sql.UniqueIdentifier, newId)
  const detail = await getReq.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario WHERE a.Id=@id
  `)
  const downloadUrl = await storage.getPresignedDownloadUrl(newKey)
  logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'file.copiado',
    resourceType: 'file',
    resourceId: newId,
    resourceName: baseName,
    extra: { copiedFrom: String(src.Id), toFolder: targetFolderId ? String(targetFolderId) : null },
    req: callOpts?.req ?? null,
  })
  return mapArchivo(detail.recordset[0], downloadUrl)
}

export function buildStorageKeyFromRow(row: any): string {
  return buildStorageKey(row)
}

export function verifyLocalDownloadSignature(req: Request): { ok: boolean; key?: string } {
  const key = decodeURIComponent(req.params?.key ?? '')
  const exp = req.query?.exp ? Number(req.query.exp) : 0
  const sig = req.query?.sig ? String(req.query.sig) : ''
  if (!key || !exp || !sig) return { ok: false }
  if (Date.now() / 1000 > exp) return { ok: false }
  const crypto = require('node:crypto')
  const expected = crypto.createHmac('sha256', env.JWT_SECRET).update(`${exp}:${key}`).digest('hex')
  if (sig !== expected) return { ok: false }
  return { ok: true, key }
}

export async function commentFileById(
  auth: { organizationId: string; userId: string },
  id: string,
  contentRaw: string,
  opts?: { req?: Request | null; parentId?: string | null }
): Promise<{
  id: string
  fileId: string
  projectId: string
  userId: string
  content: string
  parentId: string | null
  createdAt: string
}> {
  await ensureAuditAndCommentTables()
  const content = String(contentRaw || '').trim()
  if (content.length === 0 || content.length > 2000) {
    throw new AppError('El comentario debe tener entre 1 y 2000 caracteres', 400)
  }
  const pool = await getDbPool()
  const g = pool.request()
  g.input('id', sql.UniqueIdentifier, id)
  const row = await g.query<any>('SELECT IdProyecto, Nombre FROM Archivos WHERE Id=@id')
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const r = row.recordset[0]
  const projectId = String(r.IdProyecto)
  await ensureProjectAccess(pool, auth, projectId)
  let parentIdNormalized: string | null = null
  if (opts?.parentId && String(opts.parentId).trim().length > 0) {
    const pId = String(opts.parentId).trim()
    const chk = pool.request()
    chk.input('pid', sql.UniqueIdentifier, pId)
    chk.input('fileId', sql.UniqueIdentifier, id)
    const exist = await chk.query<any>(`SELECT TOP 1 Id FROM Comentarios WHERE Id=@pid AND IdRecurso=@fileId AND TipoRecurso='file'`)
    if (!exist.recordset.length) throw new NotFoundError('Comentario padre no encontrado en este archivo')
    parentIdNormalized = pId
  }
  const newId = crypto.randomUUID()
  const ins = pool.request()
  ins.input('newId', sql.UniqueIdentifier, newId)
  ins.input('tipo', sql.VarChar(20), 'file')
  ins.input('rid', sql.UniqueIdentifier, id)
  ins.input('userId', sql.UniqueIdentifier, auth.userId)
  ins.input('content', sql.NVarChar(sql.MAX), content)
  if (parentIdNormalized) {
    ins.input('parentId', sql.UniqueIdentifier, parentIdNormalized)
  }
  await ins.query(`
    INSERT INTO Comentarios (Id, TipoRecurso, IdRecurso, IdUsuario, IdComentarioPadre, Contenido)
    VALUES (@newId, @tipo, @rid, @userId, ${parentIdNormalized ? '@parentId' : 'NULL'}, @content);
  `)
  const fileName = String(r.Nombre || 'archivo')
  logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'file.comentado',
    resourceType: 'file',
    resourceId: id,
    resourceName: fileName,
    extra: {
      commentId: newId,
      comment: truncateForActivity(content, 280),
      parentCommentId: parentIdNormalized ?? undefined,
    },
    req: opts?.req ?? null,
  })
  return {
    id: newId,
    fileId: id,
    projectId,
    userId: auth.userId,
    content,
    parentId: parentIdNormalized,
    createdAt: new Date().toISOString(),
  }
}

export async function listFileComments(
  auth: { organizationId: string; userId: string },
  fileId: string
): Promise<{
  id: string
  fileId: string
  projectId: string
  userId: string
  userFullName: string | null
  userEmail: string | null
  content: string
  parentId: string | null
  createdAt: string
}[]> {
  await ensureAuditAndCommentTables()
  const pool = await getDbPool()
  const g = pool.request()
  g.input('id', sql.UniqueIdentifier, fileId)
  const row = await g.query<any>('SELECT IdProyecto FROM Archivos WHERE Id=@id')
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const projectId = String(row.recordset[0].IdProyecto)
  await ensureProjectAccess(pool, auth, projectId)
  const q = pool.request()
  q.input('fileId', sql.UniqueIdentifier, fileId)
  const res = await q.query<any>(`
    SELECT c.Id, c.TipoRecurso, c.IdRecurso, c.IdUsuario, c.IdComentarioPadre, c.Contenido, c.FechaCreacion,
           a.IdProyecto,
           u.NombreCompleto, u.Correo
    FROM Comentarios c
      INNER JOIN Archivos a ON a.Id = c.IdRecurso AND c.TipoRecurso = 'file'
      LEFT JOIN Usuarios u ON u.Id = c.IdUsuario
    WHERE c.IdRecurso = @fileId AND c.TipoRecurso = 'file'
    ORDER BY c.FechaCreacion ASC;
  `)
  return (res.recordset || []).map((r: any) => ({
    id: String(r.Id),
    fileId: String(r.IdRecurso),
    projectId: String(r.IdProyecto),
    userId: String(r.IdUsuario),
    userFullName: r.NombreCompleto ?? null,
    userEmail: r.Correo ?? null,
    content: String(r.Contenido || ''),
    parentId: r.IdComentarioPadre ? String(r.IdComentarioPadre) : null,
    createdAt: sqlLocalToIso(r.FechaCreacion as any),
  }))
}

export async function updateFileCommentById(
  auth: { organizationId: string; userId: string } & { isOrgAdmin?: boolean; permissions?: ReadonlySet<string> },
  fileId: string,
  commentId: string,
  patch: { content?: string; resolved?: boolean },
  opts?: { req?: Request | null }
): Promise<{ id: string; fileId: string; userId: string; content?: string; resolved?: boolean }> {
  await ensureAuditAndCommentTables()
  if (patch.content !== undefined) {
    const content = String(patch.content ?? '').trim()
    if (content.length === 0 || content.length > 2000) throw new AppError('Comentario inválido', 400)
  }
  const pool = await getDbPool()
  const gf = pool.request()
  gf.input('fileId', sql.UniqueIdentifier, fileId)
  const f = await gf.query<any>('SELECT IdProyecto, Nombre FROM Archivos WHERE Id=@fileId')
  if (!f.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const projectId = String(f.recordset[0].IdProyecto)
  await ensureProjectAccess(pool, auth, projectId)
  const gc = pool.request()
  gc.input('cid', sql.UniqueIdentifier, commentId)
  gc.input('fileId', sql.UniqueIdentifier, fileId)
  const row = await gc.query<any>(`SELECT Id, IdUsuario, Contenido, Resuelto FROM Comentarios WHERE Id=@cid AND IdRecurso=@fileId AND TipoRecurso='file'`)
  if (!row.recordset.length) throw new NotFoundError('Comentario no encontrado')
  const c = row.recordset[0]
  const canManage = auth?.permissions?.has('comentarios.gestionar') || !!auth?.isOrgAdmin
  if (String(c.IdUsuario) !== String(auth.userId) && !canManage) throw new ForbiddenError('No puedes editar este comentario')
  const content = patch.content !== undefined ? String(patch.content).trim() : c.Contenido
  const resolved = patch.resolved !== undefined ? (patch.resolved ? 1 : 0) : null
  const up = pool.request()
  up.input('cid', sql.UniqueIdentifier, commentId)
  up.input('content', sql.NVarChar(sql.MAX), content)
  if (resolved !== null) up.input('res', sql.Bit, resolved)
  await up.query(`UPDATE Comentarios SET Contenido=@content, FechaActualizacion=SYSUTCDATETIME()${resolved !== null ? ', Resuelto=@res' : ''} WHERE Id=@cid`)
  logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'file.comentario.editado',
    resourceType: 'file',
    resourceId: fileId,
    resourceName: String(f.recordset[0].Nombre),
    extra: { commentId, byOwner: String(c.IdUsuario) === auth.userId ? 'owner' : 'gestor', managed: canManage },
    req: opts?.req ?? null,
  })
  return {
    id: commentId,
    fileId,
    userId: String(c.IdUsuario),
    content,
    resolved: resolved !== null ? !!resolved : !!c.Resuelto,
  }
}

export async function deleteFileCommentById(
  auth: { organizationId: string; userId: string } & { isOrgAdmin?: boolean; permissions?: ReadonlySet<string> },
  fileId: string,
  commentId: string,
  opts?: { req?: Request | null }
): Promise<void> {
  await ensureAuditAndCommentTables()
  const pool = await getDbPool()
  const gf = pool.request()
  gf.input('fileId', sql.UniqueIdentifier, fileId)
  const f = await gf.query<any>('SELECT IdProyecto, Nombre FROM Archivos WHERE Id=@fileId')
  if (!f.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const projectId = String(f.recordset[0].IdProyecto)
  await ensureProjectAccess(pool, auth, projectId)
  const gc = pool.request()
  gc.input('cid', sql.UniqueIdentifier, commentId)
  gc.input('fileId', sql.UniqueIdentifier, fileId)
  const row = await gc.query<any>(`SELECT Id, IdUsuario FROM Comentarios WHERE Id=@cid AND IdRecurso=@fileId AND TipoRecurso='file'`)
  if (!row.recordset.length) throw new NotFoundError('Comentario no encontrado')
  const c = row.recordset[0]
  const canManage = !!auth?.isOrgAdmin || auth?.permissions?.has('comentarios.gestionar')
  if (String(c.IdUsuario) !== String(auth.userId) && !canManage) throw new ForbiddenError('No puedes eliminar este comentario')
  await pool.request().input('cid', sql.UniqueIdentifier, commentId).query(`DELETE FROM Comentarios WHERE Id=@cid`)
  logAuditRecord({
    organizationId: auth.organizationId, userId: auth.userId,
    action: 'file.comentario.eliminado', resourceType: 'file', resourceId: fileId,
    resourceName: String(f.recordset[0].Nombre), extra: { commentId },
    req: opts?.req ?? null,
  })
}

