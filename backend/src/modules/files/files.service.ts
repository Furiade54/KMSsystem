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
  currentVersionId: string | null
  currentVersionNumber: number | null
  versionCount: number | null
  createdAt: string
  updatedAt: string | null
}

export interface FileVersionDto {
  id: string
  fileId: string
  versionNumber: number
  s3Bucket: string | null
  s3Key: string | null
  hash: string | null
  uploadedBy: string | null
  uploadedByName: string | null
  uploadedByEmail: string | null
  comment: string | null
  size: number | null
  createdAt: string
  downloadUrl: string
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
    IdVersionActual?: string | null
    CurrentVersionNumber?: number | null
    VersionCount?: number | null
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
    name: fixFilenameEncoding(row.Nombre),
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
    currentVersionId: row.IdVersionActual ? String(row.IdVersionActual) : null,
    currentVersionNumber: row.CurrentVersionNumber != null ? Number(row.CurrentVersionNumber) : null,
    versionCount: row.VersionCount != null ? Number(row.VersionCount) : null,
  }
}

function fixFilenameEncoding(input: string | null | undefined): string {
  const s = input == null ? '' : String(input)
  if (s.length === 0) return 'archivo'
  const mojibakeHint =
    s.includes('\u00c3\u00b1') ||
    s.includes('\u00c3\u2018') ||
    s.includes('\u00c3\u00a1') ||
    s.includes('\u00c3\u00a9') ||
    s.includes('\u00c3\u00ad') ||
    s.includes('\u00c3\u00b3') ||
    s.includes('\u00c3\u00ba') ||
    s.includes('\u00c3\u00bc') ||
    s.includes('\u00c2\u00bf') ||
    s.includes('\u00c2\u00a1')
  if (!mojibakeHint) return s
  try {
    const fixed = Buffer.from(s, 'latin1').toString('utf-8')
    if (fixed && fixed.length > 0) return fixed
  } catch {}
  return s
}

function buildContentDispositionFilename(filename: string): string {
  const raw = String(filename || 'archivo')
  const safe = raw.replace(/[^a-zA-Z0-9._\- ]/g, '_').replace(/\s+/g, '-')
  try {
    const encoded = encodeURIComponent(raw).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`
  } catch {
    return `attachment; filename="${safe}"`
  }
}

export { buildContentDispositionFilename as _buildContentDispositionFilename, fixFilenameEncoding as _fixFilenameEncoding }

function buildStorageKey(row: {
  IdProyecto: string
  IdCarpeta?: string | null
  Id: string
  Nombre: string
  Extension?: string | null
}): string {
  const proj = String(row.IdProyecto)
  const fixedName = fixFilenameEncoding(String(row.Nombre))
  const cleanName = fixedName.replace(/[^a-zA-Z0-9._\- ]/g, '_').replace(/\s+/g, '-')
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
  const rawFilename = fixFilenameEncoding(file.originalname || '')
  const ext = path.extname(rawFilename).replace(/^\./, '') || null
  const name = rawFilename || 'archivo'
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

  const ver1Req = pool.request()
  ver1Req.input('idArchivo', sql.UniqueIdentifier, id)
  ver1Req.input('numeroVersion', sql.Int, 1)
  ver1Req.input('bucket', sql.NVarChar(200), bucket)
  ver1Req.input('clave', sql.NVarChar(sql.MAX), storageKey)
  ver1Req.input('hash', sql.VarChar(256), sha256)
  ver1Req.input('cargador', sql.UniqueIdentifier, auth.userId)
  ver1Req.input('tamano', sql.BigInt, Number(file.size || 0))
  const vIdRow = await ver1Req.query(`
    DECLARE @VId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO VersionesArchivo (Id,IdArchivo,NumeroVersion,BucketS3,ClaveS3,Hash,IdCargador,Tamano)
    VALUES (@VId,@idArchivo,@numeroVersion,@bucket,@clave,@hash,@cargador,@tamano);
    UPDATE Archivos SET IdVersionActual=@VId WHERE Id=@idArchivo;
    SELECT @VId AS Vid;
  `)
  const vId = vIdRow.recordset[0]?.Vid

  const getReq = pool.request()
  getReq.input('id', sql.UniqueIdentifier, id)
  const row = await getReq.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo,
      ca.NumeroVersion AS CurrentVersionNumber, vc.Cnt AS VersionCount
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN VersionesArchivo ca ON ca.Id = a.IdVersionActual
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM VersionesArchivo v WHERE v.IdArchivo = a.Id) vc
    WHERE a.Id=@id
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
    projectId: body.projectId,
    extra: { folderId: body.folderId ? String(body.folderId) : null, sizeBytes: Number(file.size || 0), versionId: vId ? String(vId) : undefined },
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
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo,
      ca.NumeroVersion AS CurrentVersionNumber, vc.Cnt AS VersionCount
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN VersionesArchivo ca ON ca.Id = a.IdVersionActual
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM VersionesArchivo v WHERE v.IdArchivo = a.Id) vc
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
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo, p.Nombre AS ProjectName,
      ca.NumeroVersion AS CurrentVersionNumber, vc.Cnt AS VersionCount
    FROM Archivos a
    LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN Proyectos p ON p.Id = a.IdProyecto
    LEFT JOIN VersionesArchivo ca ON ca.Id = a.IdVersionActual
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM VersionesArchivo v WHERE v.IdArchivo = a.Id) vc
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
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo,
      ca.NumeroVersion AS CurrentVersionNumber, vc.Cnt AS VersionCount
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN VersionesArchivo ca ON ca.Id = a.IdVersionActual
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM VersionesArchivo v WHERE v.IdArchivo = a.Id) vc
    WHERE a.Id=@id
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
  if (!isFileOwner && !isProjectOwner) {
    const metaQ = pool.request()
    metaQ.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    metaQ.input('fid', sql.UniqueIdentifier, id)
    metaQ.input('aid', sql.UniqueIdentifier, auth.userId)
    const meta = await metaQ.query<{
      ownerFullName: string | null
      ownerCorreo: string | null
      requesterFullName: string | null
      requesterCorreo: string | null
      fileName: string | null
    }>(`
      SELECT
        (SELECT NombreCompleto FROM dbo.Usuarios WHERE Id = a.IdPropietario) AS ownerFullName,
        (SELECT Correo FROM dbo.Usuarios WHERE Id = a.IdPropietario) AS ownerCorreo,
        (SELECT NombreCompleto FROM dbo.Usuarios WHERE Id = @aid AND IdOrganizacion = @orgId) AS requesterFullName,
        (SELECT Correo FROM dbo.Usuarios WHERE Id = @aid AND IdOrganizacion = @orgId) AS requesterCorreo,
        (CASE WHEN a.Extension IS NULL OR LTRIM(a.Extension) = '' THEN a.Nombre ELSE CONCAT(a.Nombre, '.', a.Extension) END) AS fileName
      FROM dbo.Archivos a WHERE a.Id = @fid;
    `)
    const m = meta.recordset[0]
    const displayOwner = (m?.ownerFullName && m?.ownerCorreo)
      ? `${m.ownerFullName} (${m.ownerCorreo})`
      : (m?.ownerFullName ?? m?.ownerCorreo ?? 'el propietario actual')
    const msg = `No puedes eliminar el archivo "${m?.fileName ?? String(r.Nombre ?? '')}" porque no eres su propietario. Solo ${displayOwner} o el propietario del proyecto pueden eliminarlo.`
    throw new ForbiddenError(msg, undefined, {
      kind: 'FILE_NOT_OWNER',
      scope: 'file',
      fileName: m?.fileName ?? (r.Nombre ? String(r.Nombre) + (r.Extension ? `.${String(r.Extension)}` : '') : null),
      ownerFullName: m?.ownerFullName ?? null,
      ownerCorreo: m?.ownerCorreo ?? null,
      requesterFullName: m?.requesterFullName ?? null,
      requesterCorreo: m?.requesterCorreo ?? null,
    })
  }
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
  const patchNameRaw = patch.name != null ? fixFilenameEncoding(String(patch.name).trim()) : null
  const originalExt = r.Extension ? String(r.Extension).toLowerCase() : null
  const origNombreFixed = fixFilenameEncoding(String(r.Nombre))
  const originalBase = origNombreFixed
    ? originalExt
      ? origNombreFixed.slice(0, -(originalExt.length + 1))
      : origNombreFixed
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
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo,
      ca.NumeroVersion AS CurrentVersionNumber, vc.Cnt AS VersionCount
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN VersionesArchivo ca ON ca.Id = a.IdVersionActual
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM VersionesArchivo v WHERE v.IdArchivo = a.Id) vc
    WHERE a.Id=@id
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
      projectId: finalRow.IdProyecto,
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
      projectId: finalRow.IdProyecto,
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

  let baseName = fixFilenameEncoding(String(src.Nombre))
  if (opts.name) {
    const trimmed = fixFilenameEncoding(String(opts.name).trim())
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

  const ver1Req = pool.request()
  ver1Req.input('idArchivo', sql.UniqueIdentifier, newId)
  ver1Req.input('numeroVersion', sql.Int, 1)
  ver1Req.input('bucket', sql.NVarChar(200), bucket)
  ver1Req.input('clave', sql.NVarChar(sql.MAX), newKey)
  ver1Req.input('hash', sql.VarChar(256), sha256)
  ver1Req.input('cargador', sql.UniqueIdentifier, auth.userId)
  ver1Req.input('tamano', sql.BigInt, Number(buf.length || putResult.sizeBytes || src.Tamano || 0))
  const vIdRow = await ver1Req.query(`
    DECLARE @VId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO VersionesArchivo (Id,IdArchivo,NumeroVersion,BucketS3,ClaveS3,Hash,IdCargador,Tamano)
    VALUES (@VId,@idArchivo,@numeroVersion,@bucket,@clave,@hash,@cargador,@tamano);
    UPDATE Archivos SET IdVersionActual=@VId WHERE Id=@idArchivo;
    SELECT @VId AS Vid;
  `)
  const vId = vIdRow.recordset[0]?.Vid

  const getReq = pool.request()
  getReq.input('id', sql.UniqueIdentifier, newId)
  const detail = await getReq.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo,
      ca.NumeroVersion AS CurrentVersionNumber, vc.Cnt AS VersionCount
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN VersionesArchivo ca ON ca.Id = a.IdVersionActual
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM VersionesArchivo v WHERE v.IdArchivo = a.Id) vc
    WHERE a.Id=@id
  `)
  const downloadUrl = await storage.getPresignedDownloadUrl(newKey)
  logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'file.copiado',
    resourceType: 'file',
    resourceId: newId,
    resourceName: baseName,
    projectId,
    extra: { copiedFrom: String(src.Id), toFolder: targetFolderId ? String(targetFolderId) : null, versionId: vId ? String(vId) : undefined },
    req: callOpts?.req ?? null,
  })
  return mapArchivo(detail.recordset[0], downloadUrl)
}

export function buildStorageKeyFromRow(row: any): string {
  return buildStorageKey(row)
}

function mapFileVersion(
  row: {
    Id: string
    IdArchivo: string
    NumeroVersion: number
    BucketS3: string | null
    ClaveS3: string | null
    Hash: string | null
    IdCargador: string | null
    Comentario: string | null
    Tamano: number | null
    FechaCreacion: Date
    NombreCompleto?: string | null
    Correo?: string | null
  },
  downloadUrl: string
): FileVersionDto {
  return {
    id: String(row.Id),
    fileId: String(row.IdArchivo),
    versionNumber: Number(row.NumeroVersion),
    s3Bucket: row.BucketS3 ?? null,
    s3Key: row.ClaveS3 ?? null,
    hash: row.Hash ?? null,
    uploadedBy: row.IdCargador ? String(row.IdCargador) : null,
    uploadedByName: row.NombreCompleto ?? null,
    uploadedByEmail: row.Correo ?? null,
    comment: row.Comentario ?? null,
    size: row.Tamano != null ? Number(row.Tamano) : null,
    createdAt: sqlLocalToIso(row.FechaCreacion as any),
    downloadUrl,
  }
}

export async function listFileVersions(
  auth: { organizationId: string; userId: string },
  fileId: string
): Promise<FileVersionDto[]> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('fileId', sql.UniqueIdentifier, fileId)
  const row = await g.query<{ IdProyecto: string }>('SELECT IdProyecto FROM Archivos WHERE Id=@fileId')
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const r = row.recordset[0]
  await ensureProjectAccess(pool, auth, String(r.IdProyecto))
  const q = pool.request()
  q.input('fileId', sql.UniqueIdentifier, fileId)
  const vers = await q.query(`
    SELECT v.*, u.NombreCompleto, u.Correo
    FROM VersionesArchivo v LEFT JOIN Usuarios u ON u.Id = v.IdCargador
    WHERE v.IdArchivo = @fileId
    ORDER BY v.NumeroVersion DESC
  `)
  const storage = getStorageProvider()
  const items: FileVersionDto[] = []
  for (const vr of vers.recordset) {
    const key = vr.ClaveS3 || vr.BucketS3 || null
    let url = ''
    if (key) {
      try { url = await storage.getPresignedDownloadUrl(key) } catch {}
    }
    items.push(mapFileVersion(vr, url))
  }
  return items
}

export async function getFileVersionById(
  auth: { organizationId: string; userId: string },
  fileId: string,
  versionId: string
): Promise<FileVersionDto> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('fileId', sql.UniqueIdentifier, fileId)
  g.input('versionId', sql.UniqueIdentifier, versionId)
  const row = await g.query(`
    SELECT v.*, u.NombreCompleto, u.Correo, a.IdProyecto
    FROM VersionesArchivo v
    LEFT JOIN Usuarios u ON u.Id = v.IdCargador
    INNER JOIN Archivos a ON a.Id = v.IdArchivo
    WHERE v.Id = @versionId AND v.IdArchivo = @fileId
  `)
  if (!row.recordset.length) throw new NotFoundError('Versión no encontrada')
  const r = row.recordset[0]
  await ensureProjectAccess(pool, auth, String(r.IdProyecto))
  const storage = getStorageProvider()
  const key = r.ClaveS3 || r.BucketS3 || null
  let url = ''
  if (key) {
    try { url = await storage.getPresignedDownloadUrl(key) } catch {}
  }
  return mapFileVersion(r, url)
}

export async function uploadNewVersion(
  auth: { organizationId: string; userId: string },
  fileId: string,
  file: Express.Multer.File,
  body: { comment?: string },
  opts?: { req?: Request | null }
): Promise<FileVersionDto> {
  if (!file) throw new AppError('Archivo requerido', 400)
  const pool = await getDbPool()
  const g = pool.request()
  g.input('fileId', sql.UniqueIdentifier, fileId)
  const row = await g.query('SELECT * FROM Archivos WHERE Id=@fileId')
  if (!row.recordset.length) throw new NotFoundError('Archivo no encontrado')
  const a = row.recordset[0]
  await ensureProjectAccess(pool, auth, String(a.IdProyecto))

  const storage = getStorageProvider()
  const bucket = env.AWS_S3_BUCKET || null
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const providerName = storage.name

  const storageKey = buildStorageKey({
    IdProyecto: String(a.IdProyecto),
    IdCarpeta: a.IdCarpeta ? String(a.IdCarpeta) : null,
    Id: String(a.Id),
    Nombre: String(a.Nombre),
    Extension: a.Extension ? String(a.Extension) : null,
  })
  let putResult: { etag?: string; sizeBytes: number; s3VersionId?: string } | null = null
  try {
    const res = await storage.putObject(storageKey, file.buffer, {
      contentType: file.mimetype || String(a.TipoMime || 'application/octet-stream'),
      metadata: {
        owner: auth.userId,
        organization: auth.organizationId,
        project: String(a.IdProyecto),
        sha256,
        previousVersionId: a.IdVersionActual ? String(a.IdVersionActual) : 'first',
      },
    })
    putResult = { etag: res.etag?.replace(/^"|"$/g, ''), sizeBytes: res.sizeBytes, s3VersionId: (res as any).versionId }
  } catch (e: any) {
    throw e
  }
  const tr = pool.request()
  tr.input('fileId', sql.UniqueIdentifier, fileId)
  tr.input('cargador', sql.UniqueIdentifier, auth.userId)
  tr.input('bucket', sql.NVarChar(200), bucket)
  tr.input('clave', sql.NVarChar(sql.MAX), storageKey)
  tr.input('hash', sql.VarChar(256), sha256)
  tr.input('tamano', sql.BigInt, Number(file.size || putResult.sizeBytes || 0))
  tr.input('comentario', sql.NVarChar(sql.MAX), body.comment ? String(body.comment).trim() || null : null)
  tr.input('provider', sql.VarChar(10), providerName)
  tr.input('etag', sql.VarChar(256), putResult.etag)
  tr.input('s3VersionId', sql.VarChar(256), putResult.s3VersionId)
  const verRow = await tr.query(`
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;
    DECLARE @NuevoNum INT;
    SELECT @NuevoNum = ISNULL(MAX(NumeroVersion), 0) + 1
    FROM VersionesArchivo WITH (UPDLOCK, HOLDLOCK) WHERE IdArchivo = @fileId;
    DECLARE @VId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO VersionesArchivo (Id,IdArchivo,NumeroVersion,BucketS3,ClaveS3,Hash,IdCargador,Comentario,Tamano)
    VALUES (@VId,@fileId,@NuevoNum,@bucket,@clave,@hash,@cargador,@comentario,@tamano);
    UPDATE Archivos SET
      IdVersionActual = @VId,
      StorageProvider = ISNULL(NULLIF(@provider,''), StorageProvider),
      StorageKey = @clave,
      S3Bucket = ISNULL(NULLIF(@bucket,''), S3Bucket),
      S3ETag = @etag,
      S3VersionId = @s3VersionId,
      ChecksumSHA256 = @hash,
      Tamano = @tamano,
      FechaActualizacion = GETDATE()
    WHERE Id = @fileId;
    COMMIT TRANSACTION;
    SELECT @VId AS Vid, @NuevoNum AS NumeroVersion;
  `)
  const vId = String(verRow.recordset[0].Vid)
  const num = Number(verRow.recordset[0].NumeroVersion)

  const detail = await pool.request().input('vid', sql.UniqueIdentifier, vId).query(`
    SELECT v.*, u.NombreCompleto, u.Correo
    FROM VersionesArchivo v LEFT JOIN Usuarios u ON u.Id = v.IdCargador
    WHERE v.Id = @vid
  `)
  const downloadUrl = await storage.getPresignedDownloadUrl(storageKey)
  logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'file.version.creada',
    resourceType: 'file',
    resourceId: fileId,
    resourceName: String(a.Nombre),
    projectId: a.IdProyecto,
    extra: { versionId: vId, versionNumber: num, sizeBytes: Number(file.size || putResult.sizeBytes || 0) },
    req: opts?.req ?? null,
  })
  return mapFileVersion(detail.recordset[0], downloadUrl)
}

export async function setCurrentFileVersion(
  auth: { organizationId: string; userId: string },
  fileId: string,
  versionId: string,
  opts?: { req?: Request | null }
): Promise<ArchivoDto> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('fileId', sql.UniqueIdentifier, fileId)
  g.input('versionId', sql.UniqueIdentifier, versionId)
  const row = await g.query(`
    SELECT a.*,
      v.IdArchivo AS VArchivo,
      v.ClaveS3 AS VClaveS3,
      v.BucketS3 AS VBucketS3,
      v.Hash AS VHash,
      v.Tamano AS VTamano
    FROM Archivos a LEFT JOIN VersionesArchivo v ON v.Id=@versionId
    WHERE a.Id=@fileId
  `)
  if (!row.recordset.length) throw new NotFoundError('Archivo o versión no encontrados')
  const r = row.recordset[0]
  if (!r.VArchivo || String(r.VArchivo).toLowerCase() !== String(fileId).toLowerCase()) {
    throw new NotFoundError('Versión no pertenece a este archivo')
  }
  await ensureProjectAccess(pool, auth, String(r.IdProyecto))
  const up = pool.request()
  up.input('fileId', sql.UniqueIdentifier, fileId)
  up.input('versionId', sql.UniqueIdentifier, versionId)
  up.input('key', sql.NVarChar(1000), r.VClaveS3 ?? null)
  up.input('bucket', sql.NVarChar(200), r.VBucketS3 ?? null)
  up.input('sha', sql.VarChar(256), r.VHash ?? null)
  const sizeNum = r.VTamano == null ? null : Number(r.VTamano)
  up.input('sz', sql.BigInt, Number.isFinite(sizeNum) ? sizeNum : null)
  await up.query(`
    UPDATE Archivos
    SET IdVersionActual=@versionId,
        StorageKey=ISNULL(NULLIF(@key,''), StorageKey),
        S3Bucket=ISNULL(NULLIF(@bucket,''), S3Bucket),
        ChecksumSHA256=ISNULL(NULLIF(@sha,''), ChecksumSHA256),
        Tamano=ISNULL(@sz, Tamano),
        FechaActualizacion=GETDATE()
    WHERE Id=@fileId;
  `)
  const g2 = pool.request()
  g2.input('id', sql.UniqueIdentifier, fileId)
  const after = await g2.query(`
    SELECT a.*, u.NombreCompleto AS OwnerNombre, u.Correo AS OwnerCorreo,
      ca.NumeroVersion AS CurrentVersionNumber, vc.Cnt AS VersionCount
    FROM Archivos a LEFT JOIN Usuarios u ON u.Id = a.IdPropietario
    LEFT JOIN VersionesArchivo ca ON ca.Id = a.IdVersionActual
    OUTER APPLY (SELECT COUNT(*) AS Cnt FROM VersionesArchivo v WHERE v.IdArchivo = a.Id) vc
    WHERE a.Id=@id
  `)
  const storage = getStorageProvider()
  const finalRow = after.recordset[0]
  const key = finalRow.StorageKey || buildStorageKey(finalRow)
  const downloadUrl = await storage.getPresignedDownloadUrl(key)
  logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'file.version.establecida_actual',
    resourceType: 'file',
    resourceId: fileId,
    resourceName: String(finalRow.Nombre),
    projectId: finalRow.IdProyecto,
    extra: { versionId },
    req: opts?.req ?? null,
  })
  return mapArchivo(finalRow, downloadUrl)
}

export async function deleteFileVersion(
  auth: { organizationId: string; userId: string },
  fileId: string,
  versionId: string,
  opts?: { req?: Request | null }
): Promise<void> {
  const pool = await getDbPool()
  const g = pool.request()
  g.input('fileId', sql.UniqueIdentifier, fileId)
  g.input('versionId', sql.UniqueIdentifier, versionId)
  const row = await g.query(`
    SELECT a.*,
      v.Id AS VId,
      v.NumeroVersion AS VNumeroVersion,
      v.IdCargador AS VIdCargador
    FROM Archivos a LEFT JOIN VersionesArchivo v ON v.Id=@versionId
    WHERE a.Id=@fileId
  `)
  if (!row.recordset.length) throw new NotFoundError('Archivo o versión no encontrados')
  const r = row.recordset[0]
  if (!r.VId) throw new NotFoundError('Versión no encontrada')
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
  if (!isFileOwner && !isProjectOwner) throw new ForbiddenError('Solo el propietario puede eliminar una versión')
  const isVersionLoader = r.VIdCargador && String(r.VIdCargador).toLowerCase() === String(auth.userId).toLowerCase()
  if (!isFileOwner && !isProjectOwner && !isVersionLoader) {
    throw new ForbiddenError('Solo propietarios pueden eliminar una versión histórica')
  }
  const isCurrent = String(r.IdVersionActual || '').toLowerCase() === String(versionId).toLowerCase()
  try {
    if (isCurrent) {
      const unlink = pool.request()
      unlink.input('fileId', sql.UniqueIdentifier, fileId)
      await unlink.query('UPDATE Archivos SET IdVersionActual = NULL WHERE Id=@fileId;')
    }
    const del = pool.request()
    del.input('versionId', sql.UniqueIdentifier, versionId)
    del.input('fileId', sql.UniqueIdentifier, fileId)
    await del.query('DELETE FROM VersionesArchivo WHERE Id=@versionId AND IdArchivo=@fileId;')
    logAuditRecord({
      organizationId: auth.organizationId,
      userId: auth.userId,
      action: 'file.version.eliminada',
      resourceType: 'file',
      resourceId: fileId,
      resourceName: String(r.Nombre),
      projectId: r.IdProyecto,
      extra: { versionId, versionNumber: Number(r.VNumeroVersion), wasCurrent: isCurrent },
      req: opts?.req ?? null,
    })
  } catch (e: any) {
    if (e?.message && /FOREIGN KEY.*FK_Archivo_VersionActual/i.test(e.message)) {
      throw new AppError('No se puede eliminar esta versión: hay archivos que la referencian como actual.', 409)
    }
    throw e
  }
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
    projectId,
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
    projectId,
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
    resourceName: String(f.recordset[0].Nombre), projectId, extra: { commentId },
    req: opts?.req ?? null,
  })
}

