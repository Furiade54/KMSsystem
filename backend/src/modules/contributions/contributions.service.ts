import { getDbPool, sql } from '../../shared/db/pool'
import { AppError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError'
import { logAuditRecord } from '../../shared/db/audit'
import { sqlLocalToIso, sqlLocalToIsoOrNull } from '../../shared/utils/date'
import type { Request } from 'express'
import type { ProjectContribution, ProjectContributionTopicLink } from '../../../../packages/shared-types/src'

type Auth = { organizationId: string; userId: string }
type AporteRow = {
  Id: string
  IdOrganizacion: string
  IdProyecto: string
  IdAutor: string | null
  AutorNombre: string | null
  AutorCorreo: string | null
  Titulo: string | null
  Contenido: string | null
  Tipo: string
  UrlExterno: string | null
  IdCarpeta: string | null
  IdArchivoAdjunto: string | null
  AdjuntoNombre: string | null
  AdjuntoTamano: number | null
  AdjuntoMimeType: string | null
  Estado: string
  Importancia: string
  Orden: number
  MeGustaCount: number
  ComentariosCount: number
  FechaCreacion: Date
  FechaActualizacion: Date | null
  FechaPublicacion: Date | null
}

const VALID_TIPOS = new Set([
  'IDEA', 'COMENTARIO', 'ENLACE', 'ARCHIVO', 'IMAGEN', 'ENCUESTA', 'MENSAJE', 'OTRO',
])
const VALID_ESTADOS = new Set(['BORRADOR', 'PUBLICADO', 'OCULTO', 'ELIMINADO', 'DESTACADO'])
const VALID_IMPORTANCIA = new Set(['BAJA', 'NORMAL', 'ALTA', 'URGENTE'])

function mapAporte(r: AporteRow, extra: {
  linkedTopics?: Array<{ id: string; title: string; linkedAt: string; linkedBy: string | null }> | null
  perms: { canEdit: boolean; canDelete: boolean; canShare: boolean }
}): ProjectContribution {
  return {
    id: String(r.Id),
    organizationId: String(r.IdOrganizacion),
    projectId: String(r.IdProyecto),
    authorId: r.IdAutor ? String(r.IdAutor) : null,
    authorName: r.AutorNombre ?? null,
    authorEmail: r.AutorCorreo ?? null,
    title: r.Titulo ?? null,
    content: r.Contenido ?? null,
    type: (r.Tipo as ProjectContribution['type']) ?? 'IDEA',
    externalUrl: r.UrlExterno ?? null,
    folderId: r.IdCarpeta ? String(r.IdCarpeta) : null,
    attachedFileId: r.IdArchivoAdjunto ? String(r.IdArchivoAdjunto) : null,
    attachedFileName: r.AdjuntoNombre ?? null,
    attachedFileSizeBytes: r.AdjuntoTamano != null ? Number(r.AdjuntoTamano) : null,
    attachedFileMimeType: r.AdjuntoMimeType ?? null,
    status: (r.Estado as ProjectContribution['status']) ?? 'PUBLICADO',
    priority: (r.Importancia as ProjectContribution['priority']) ?? 'NORMAL',
    order: Number(r.Orden),
    likesCount: Number(r.MeGustaCount ?? 0),
    commentsCount: Number(r.ComentariosCount ?? 0),
    createdAt: sqlLocalToIso(r.FechaCreacion as any),
    updatedAt: sqlLocalToIsoOrNull(r.FechaActualizacion as any),
    publishedAt: sqlLocalToIsoOrNull(r.FechaPublicacion as any),
    linkedTopics: extra.linkedTopics ?? undefined,
    _permissions: extra.perms,
  }
}

async function ensureProjectAccess(pool: any, auth: Auth, projectId: string): Promise<void> {
  const q = pool.request()
  q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  q.input('userId', sql.UniqueIdentifier, auth.userId)
  q.input('projectId', sql.UniqueIdentifier, projectId)
  const row = await q.query(`
    SELECT p.Id FROM Proyectos p
    WHERE p.Id = @projectId AND p.IdOrganizacion = @orgId
      AND (p.IdPropietario = @userId OR EXISTS (
        SELECT 1 FROM MiembrosProyecto mp WHERE mp.IdProyecto=p.Id AND mp.IdUsuario=@userId
      ))
  `)
  if (!row.recordset.length) throw new ForbiddenError('No tienes acceso al proyecto especificado')
}

async function getProjectOwnerId(pool: any, projectId: string): Promise<string | null> {
  const q = pool.request()
  q.input('projectId', sql.UniqueIdentifier, projectId)
  const r = await q.query('SELECT IdPropietario FROM Proyectos WHERE Id=@projectId')
  return r.recordset[0]?.IdPropietario ? String(r.recordset[0].IdPropietario) : null
}

function isOrgAdminFromAuth(auth: Auth & { isOrgAdmin?: boolean }): boolean {
  return !!(auth as any).isOrgAdmin
}

function permFor(auth: Auth, r: AporteRow, projectOwnerId: string | null): {
  canEdit: boolean; canDelete: boolean; canShare: boolean
} {
  const isAdmin = isOrgAdminFromAuth(auth)
  const isOwner = String(auth.userId).toLowerCase() === String(r.IdAutor ?? '').toLowerCase()
  const isProjectOwner = projectOwnerId
    ? String(auth.userId).toLowerCase() === String(projectOwnerId).toLowerCase()
    : false
  const canEdit = isAdmin || isOwner || isProjectOwner
  const canDelete = isAdmin || isOwner || isProjectOwner
  const canShare = isAdmin || isOwner || isProjectOwner
  return { canEdit, canDelete, canShare }
}

export async function listProjectContributions(
  auth: Auth,
  input: { projectId: string; tipo?: string | null; estado?: string | null; importancia?: string | null; search?: string | null; limit?: number; offset?: number }
): Promise<{ items: ProjectContribution[]; total: number }> {
  if (!input.projectId) throw new AppError('projectId requerido', 400)
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, input.projectId)
  const projectOwnerId = await getProjectOwnerId(pool, input.projectId)

  const whereClauses: string[] = [
    'a.IdProyecto=@projectId',
    'a.IdOrganizacion=@orgId',
    "a.Estado <> 'ELIMINADO'",
  ]
  const q = pool.request()
  q.input('projectId', sql.UniqueIdentifier, input.projectId)
  q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  if (input.tipo) { q.input('tipo', sql.VarChar(30), input.tipo); whereClauses.push('a.Tipo=@tipo') }
  if (input.estado) { q.input('estado', sql.VarChar(30), input.estado); whereClauses.push('a.Estado=@estado') }
  if (input.importancia) { q.input('imp', sql.VarChar(20), input.importancia); whereClauses.push('a.Importancia=@imp') }
  if (input.search) {
    q.input('srch', sql.NVarChar(500), `%${input.search}%`)
    whereClauses.push(`(
      ISNULL(a.Titulo,'') LIKE @srch
      OR ISNULL(a.Contenido,'') LIKE @srch
      OR ISNULL(a.UrlExterno,'') LIKE @srch
      OR ISNULL(a.Tipo,'') LIKE @srch
      OR ISNULL(a.Estado,'') LIKE @srch
      OR ISNULL(a.Importancia,'') LIKE @srch
      OR ISNULL(au.NombreCompleto,'') LIKE @srch
      OR ISNULL(au.Correo,'') LIKE @srch
      OR ISNULL(af.Nombre,'') LIKE @srch
      OR ISNULL(af.TipoMime,'') LIKE @srch
      OR EXISTS (
        SELECT 1 FROM AportesTemasVinculados atv
               INNER JOIN TemasProyecto tp ON tp.Id = atv.IdTema
        WHERE atv.IdAporte = a.Id AND ISNULL(tp.Titulo,'') LIKE @srch
      )
    )`)
  }
  const where = whereClauses.join(' AND ')

  const totalR = await q.query(`
    SELECT COUNT(*) C
    FROM AportesProyecto a
         LEFT JOIN Usuarios au ON au.Id = a.IdAutor
         LEFT JOIN Archivos af ON af.Id = a.IdArchivoAdjunto
    WHERE ${where}
  `)
  const total = Number(totalR.recordset[0].C ?? 0)
  const limit = Math.min(200, Number(input.limit ?? 50))
  const offset = Math.max(0, Number(input.offset ?? 0))

  const rows = await q.query(`
    SELECT a.Id, a.IdOrganizacion, a.IdProyecto, a.IdAutor, a.Titulo, a.Contenido, a.Tipo, a.UrlExterno,
           a.IdCarpeta, a.IdArchivoAdjunto, a.Estado, a.Importancia, a.Orden, a.MeGustaCount, a.ComentariosCount,
           a.FechaCreacion, a.FechaActualizacion, a.FechaPublicacion,
           AutorNombre = au.NombreCompleto, AutorCorreo = au.Correo,
           AdjuntoNombre = af.Nombre, AdjuntoTamano = af.Tamano, AdjuntoMimeType = af.TipoMime
    FROM AportesProyecto a
         LEFT JOIN Usuarios au ON au.Id = a.IdAutor
         LEFT JOIN Archivos af ON af.Id = a.IdArchivoAdjunto
    WHERE ${where}
    ORDER BY a.Orden ASC, a.FechaCreacion DESC
    OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
  `)
  const ids = rows.recordset.map((r: AporteRow) => String(r.Id))
  const linkedByContrib: Record<string, Array<{ id: string; title: string; linkedAt: string; linkedBy: string | null }>> = {}
  if (ids.length) {
    const tvIds = ids.map(i => `'${i.replace(/'/g, '')}'`).join(',')
    const atv = await pool.request().query(`
      SELECT atv.IdAporte, atv.IdTema, atv.FechaVinculacion, atv.IdUsuarioVinculante, t.Titulo
      FROM AportesTemasVinculados atv LEFT JOIN TemasProyecto t ON t.Id = atv.IdTema
      WHERE atv.IdAporte IN (${tvIds})
    `)
    for (const v of atv.recordset) {
      const key = String(v.IdAporte)
      const arr = (linkedByContrib[key] ??= [])
      arr.push({
        id: String(v.IdTema),
        title: v.Titulo ? String(v.Titulo) : '',
        linkedAt: sqlLocalToIso(v.FechaVinculacion as any),
        linkedBy: v.IdUsuarioVinculante ? String(v.IdUsuarioVinculante) : null,
      })
    }
  }
  const items = rows.recordset.map((r: AporteRow) => mapAporte(r, {
    linkedTopics: linkedByContrib[String(r.Id)] ?? null,
    perms: permFor(auth, r, projectOwnerId),
  }))
  return { items, total }
}

export async function getContribution(
  auth: Auth,
  input: { projectId: string; contributionId: string }
): Promise<ProjectContribution> {
  if (!input.projectId || !input.contributionId) throw new AppError('projectId y contributionId requeridos', 400)
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, input.projectId)
  const projectOwnerId = await getProjectOwnerId(pool, input.projectId)

  const q = pool.request()
  q.input('cid', sql.UniqueIdentifier, input.contributionId)
  q.input('projectId', sql.UniqueIdentifier, input.projectId)
  q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  const rows = await q.query(`
    SELECT a.Id, a.IdOrganizacion, a.IdProyecto, a.IdAutor, a.Titulo, a.Contenido, a.Tipo, a.UrlExterno,
           a.IdCarpeta, a.IdArchivoAdjunto, a.Estado, a.Importancia, a.Orden, a.MeGustaCount, a.ComentariosCount,
           a.FechaCreacion, a.FechaActualizacion, a.FechaPublicacion,
           AutorNombre = au.NombreCompleto, AutorCorreo = au.Correo,
           AdjuntoNombre = af.Nombre, AdjuntoTamano = af.Tamano, AdjuntoMimeType = af.TipoMime
    FROM AportesProyecto a
         LEFT JOIN Usuarios au ON au.Id = a.IdAutor
         LEFT JOIN Archivos af ON af.Id = a.IdArchivoAdjunto
    WHERE a.Id=@cid AND a.IdProyecto=@projectId AND a.IdOrganizacion=@orgId
  `)
  if (!rows.recordset.length) throw new NotFoundError('Aporte no encontrado')
  const r: AporteRow = rows.recordset[0]
  const atv = await pool.request().input('cid', sql.UniqueIdentifier, input.contributionId).query(`
    SELECT atv.IdAporte, atv.IdTema, atv.FechaVinculacion, atv.IdUsuarioVinculante, t.Titulo
    FROM AportesTemasVinculados atv LEFT JOIN TemasProyecto t ON t.Id = atv.IdTema
    WHERE atv.IdAporte=@cid
  `)
  const linkedTopics = atv.recordset.map((v: any) => ({
    id: String(v.IdTema),
    title: v.Titulo ? String(v.Titulo) : '',
    linkedAt: sqlLocalToIso(v.FechaVinculacion as any),
    linkedBy: v.IdUsuarioVinculante ? String(v.IdUsuarioVinculante) : null,
  }))
  return mapAporte(r, { linkedTopics, perms: permFor(auth, r, projectOwnerId) })
}

export type CreateContributionInput = {
  projectId: string
  title?: string | null
  content?: string | null
  type?: ProjectContribution['type'] | null
  externalUrl?: string | null
  folderId?: string | null
  attachedFileId?: string | null
  status?: ProjectContribution['status'] | null
  priority?: ProjectContribution['priority'] | null
  order?: number | null
  publishNow?: boolean | null
  topicIds?: string[] | null
}

export async function createContribution(
  auth: Auth,
  body: CreateContributionInput,
  opts?: { req?: Request | null }
): Promise<ProjectContribution> {
  if (!body.projectId) throw new AppError('projectId requerido', 400)
  if (!body.title && !body.content) throw new AppError('Se requiere al menos titulo o contenido', 400)
  const type = (body.type ?? 'IDEA').toUpperCase()
  if (!VALID_TIPOS.has(type)) throw new AppError('Tipo de aporte inválido', 400)
  if (type === 'ENLACE' && !body.externalUrl) throw new AppError('Tipo ENLACE requiere externalUrl', 400)
  const status = (body.status ?? 'PUBLICADO').toUpperCase()
  if (!VALID_ESTADOS.has(status)) throw new AppError('Estado inválido', 400)
  const importancia = (body.priority ?? 'NORMAL').toUpperCase()
  if (!VALID_IMPORTANCIA.has(importancia)) throw new AppError('Importancia inválida', 400)
  const publishNow = body.publishNow == null ? status === 'PUBLICADO' : !!body.publishNow
  const effStatus = publishNow ? 'PUBLICADO' : status
  const orden = body.order != null ? Number(body.order) : 0

  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, body.projectId)

  if (body.attachedFileId) {
    const q = pool.request()
    q.input('fid', sql.UniqueIdentifier, body.attachedFileId)
    q.input('projectId', sql.UniqueIdentifier, body.projectId)
    const f = await q.query(`
      SELECT TOP 1 Id FROM Archivos
      WHERE Id=@fid AND IdProyecto=@projectId
    `)
    if (!f.recordset.length) throw new NotFoundError('Archivo adjunto no existe en el proyecto')
  }
  if (body.folderId) {
    const q = pool.request()
    q.input('foid', sql.UniqueIdentifier, body.folderId)
    q.input('projectId', sql.UniqueIdentifier, body.projectId)
    const f = await q.query('SELECT TOP 1 Id FROM Carpetas WHERE Id=@foid AND IdProyecto=@projectId')
    if (!f.recordset.length) throw new NotFoundError('Carpeta no existe en el proyecto')
  }
  if (body.topicIds?.length) {
    const q = pool.request()
    q.input('projectId', sql.UniqueIdentifier, body.projectId)
    const ts = await q.query('SELECT Id FROM TemasProyecto WHERE IdProyecto=@projectId')
    const validos = new Set(ts.recordset.map((r: any) => String(r.Id).toLowerCase()))
    for (const t of body.topicIds) {
      if (!validos.has(String(t).toLowerCase())) throw new NotFoundError(`Tema ${t} no pertenece al proyecto`)
    }
  }

  const tx = pool.transaction()
  await tx.begin()
  try {
    const iq = tx.request()
    iq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    iq.input('projectId', sql.UniqueIdentifier, body.projectId)
    iq.input('autor', sql.UniqueIdentifier, auth.userId)
    iq.input('titulo', sql.NVarChar(255), body.title ?? null)
    iq.input('contenido', sql.NVarChar(sql.MAX), body.content ?? null)
    iq.input('tipo', sql.VarChar(30), type)
    iq.input('url', sql.NVarChar(500), body.externalUrl ?? null)
    iq.input('folderId', sql.UniqueIdentifier, body.folderId ?? null)
    iq.input('archivo', sql.UniqueIdentifier, body.attachedFileId ?? null)
    iq.input('estado', sql.VarChar(30), effStatus)
    iq.input('imp', sql.VarChar(20), importancia)
    iq.input('orden', sql.Int, orden)
    iq.input('fpub', sql.DateTime2, (effStatus === 'PUBLICADO' && publishNow) ? new Date() : null)
    const ins = await iq.query(`
      DECLARE @NuevoId UNIQUEIDENTIFIER = NEWID();
      INSERT INTO AportesProyecto (
        Id,IdOrganizacion,IdProyecto,IdAutor,Titulo,Contenido,Tipo,UrlExterno,IdCarpeta,IdArchivoAdjunto,
        Estado,Importancia,Orden,FechaCreacion,FechaActualizacion,FechaPublicacion
      ) OUTPUT INSERTED.Id
      VALUES (
        @NuevoId,@orgId,@projectId,@autor,@titulo,@contenido,@tipo,@url,@folderId,@archivo,
        @estado,@imp,@orden,GETDATE(),GETDATE(),@fpub
      );
      UPDATE Proyectos SET FechaActualizacion=GETDATE() WHERE Id=@projectId;
    `)
    const newId = String(ins.recordset[0].Id)
    if (body.topicIds?.length) {
      for (const t of body.topicIds) {
        const lq = tx.request()
        lq.input('cid', sql.UniqueIdentifier, newId)
        lq.input('tid', sql.UniqueIdentifier, t)
        lq.input('uid', sql.UniqueIdentifier, auth.userId)
        await lq.query(`
          IF NOT EXISTS (SELECT 1 FROM AportesTemasVinculados WHERE IdAporte=@cid AND IdTema=@tid)
            INSERT INTO AportesTemasVinculados (IdAporte,IdTema,IdUsuarioVinculante,FechaVinculacion)
            VALUES (@cid,@tid,@uid,GETDATE())
        `)
      }
    }
    await tx.commit()
    await logAuditRecord({
      organizationId: auth.organizationId, userId: auth.userId,
      action: 'APORTE.CREAR', resourceType: 'contribution', resourceId: newId,
      resourceName: body.title ?? null, projectId: body.projectId,
      extra: { type, topicCount: body.topicIds?.length ?? 0 },
      req: opts?.req ?? null,
    })
    return getContribution(auth, { projectId: body.projectId, contributionId: newId })
  } catch (e) {
    try { await tx.rollback() } catch { /* ignore */ }
    throw e
  }
}

export type UpdateContributionInput = Partial<{
  title: string | null
  content: string | null
  type: ProjectContribution['type'] | null
  externalUrl: string | null
  folderId: string | null
  attachedFileId: string | null
  status: ProjectContribution['status'] | null
  priority: ProjectContribution['priority'] | null
  order: number | null
  publishNow: boolean | null
}>

export async function updateContribution(
  auth: Auth,
  input: { projectId: string; contributionId: string; body: UpdateContributionInput },
  opts?: { req?: Request | null }
): Promise<ProjectContribution> {
  if (!input.projectId || !input.contributionId) throw new AppError('projectId y contributionId requeridos', 400)
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, input.projectId)
  const projectOwnerId = await getProjectOwnerId(pool, input.projectId)
  const current = await getContributionRaw(pool, input.projectId, input.contributionId, auth.organizationId)
  if (!current) throw new NotFoundError('Aporte no encontrado')
  const perms = permFor(auth, current, projectOwnerId)
  if (!perms.canEdit) throw new ForbiddenError('No puedes editar este aporte')

  const sets: string[] = ['FechaActualizacion=GETDATE()']
  const up = pool.request()
  up.input('cid', sql.UniqueIdentifier, input.contributionId)
  up.input('projectId', sql.UniqueIdentifier, input.projectId)
  up.input('orgId', sql.UniqueIdentifier, auth.organizationId)

  const b = input.body
  if (b.title !== undefined) {
    if (!b.title && !(b.content ?? current.Contenido)) throw new AppError('No se puede dejar aporte sin titulo ni contenido', 400)
    up.input('t', sql.NVarChar(255), b.title ?? null); sets.push('Titulo=@t')
  }
  if (b.content !== undefined) {
    if (!b.content && !(b.title ?? current.Titulo)) throw new AppError('No se puede dejar aporte sin titulo ni contenido', 400)
    up.input('c', sql.NVarChar(sql.MAX), b.content ?? null); sets.push('Contenido=@c')
  }
  if (b.type !== undefined) {
    const ty = String(b.type ?? 'IDEA').toUpperCase()
    if (!VALID_TIPOS.has(ty)) throw new AppError('Tipo de aporte inválido', 400)
    if (ty === 'ENLACE' && !(b.externalUrl ?? current.UrlExterno)) throw new AppError('Tipo ENLACE requiere externalUrl', 400)
    up.input('ty', sql.VarChar(30), ty); sets.push('Tipo=@ty')
  }
  if (b.externalUrl !== undefined) {
    const ty = (b.type ?? current.Tipo).toUpperCase()
    if (ty === 'ENLACE' && !b.externalUrl) throw new AppError('Tipo ENLACE requiere externalUrl', 400)
    up.input('u', sql.NVarChar(500), b.externalUrl ?? null); sets.push('UrlExterno=@u')
  }
  if (b.folderId !== undefined) {
    if (b.folderId) {
      const f = await pool.request().input('foid', sql.UniqueIdentifier, b.folderId).input('pid', sql.UniqueIdentifier, input.projectId)
        .query('SELECT TOP 1 Id FROM Carpetas WHERE Id=@foid AND IdProyecto=@pid')
      if (!f.recordset.length) throw new NotFoundError('Carpeta no existe en el proyecto')
    }
    up.input('foid', sql.UniqueIdentifier, b.folderId ?? null); sets.push('IdCarpeta=@foid')
  }
  if (b.attachedFileId !== undefined) {
    if (b.attachedFileId) {
      const f = await pool.request().input('fid', sql.UniqueIdentifier, b.attachedFileId).input('pid', sql.UniqueIdentifier, input.projectId)
        .query(`SELECT TOP 1 Id FROM Archivos WHERE Id=@fid AND IdProyecto=@pid`)
      if (!f.recordset.length) throw new NotFoundError('Archivo adjunto no existe en el proyecto')
    }
    up.input('fid', sql.UniqueIdentifier, b.attachedFileId ?? null); sets.push('IdArchivoAdjunto=@fid')
  }
  if (b.status !== undefined) {
    const st = String(b.status ?? 'PUBLICADO').toUpperCase()
    if (!VALID_ESTADOS.has(st)) throw new AppError('Estado inválido', 400)
    up.input('st', sql.VarChar(30), st); sets.push('Estado=@st')
  }
  if (b.priority !== undefined) {
    const im = String(b.priority ?? 'NORMAL').toUpperCase()
    if (!VALID_IMPORTANCIA.has(im)) throw new AppError('Importancia inválida', 400)
    up.input('im', sql.VarChar(20), im); sets.push('Importancia=@im')
  }
  if (b.order !== undefined) {
    up.input('o', sql.Int, b.order ?? 0); sets.push('Orden=@o')
  }
  if (b.publishNow === true) {
    sets.push('FechaPublicacion=CASE WHEN FechaPublicacion IS NULL THEN GETDATE() ELSE FechaPublicacion END')
    sets.push("Estado=CASE WHEN Estado='BORRADOR' THEN 'PUBLICADO' ELSE Estado END")
  }

  if (sets.length <= 1) return getContribution(auth, { projectId: input.projectId, contributionId: input.contributionId })
  const setSql = sets.join(', ')
  await up.query(`
    UPDATE AportesProyecto SET ${setSql} WHERE Id=@cid AND IdProyecto=@projectId AND IdOrganizacion=@orgId;
    UPDATE Proyectos SET FechaActualizacion=GETDATE() WHERE Id=@projectId;
  `)
  await logAuditRecord({
    organizationId: auth.organizationId, userId: auth.userId,
    action: 'APORTE.EDITAR', resourceType: 'contribution', resourceId: input.contributionId,
    resourceName: b.title ?? current.Titulo ?? null, projectId: input.projectId,
    req: opts?.req ?? null,
  })
  return getContribution(auth, { projectId: input.projectId, contributionId: input.contributionId })
}

async function getContributionRaw(
  pool: any, projectId: string, contributionId: string, orgId: string
): Promise<AporteRow | null> {
  const q = pool.request()
  q.input('cid', sql.UniqueIdentifier, contributionId)
  q.input('projectId', sql.UniqueIdentifier, projectId)
  q.input('orgId', sql.UniqueIdentifier, orgId)
  const rs = await q.query(`
    SELECT a.Id, a.IdOrganizacion, a.IdProyecto, a.IdAutor, a.Titulo, a.Contenido, a.Tipo, a.UrlExterno,
           a.IdCarpeta, a.IdArchivoAdjunto, a.Estado, a.Importancia, a.Orden, a.MeGustaCount, a.ComentariosCount,
           a.FechaCreacion, a.FechaActualizacion, a.FechaPublicacion,
           AutorNombre = au.NombreCompleto, AutorCorreo = au.Correo,
           AdjuntoNombre = af.Nombre, AdjuntoTamano = af.Tamano, AdjuntoMimeType = af.TipoMime
    FROM AportesProyecto a
         LEFT JOIN Usuarios au ON au.Id = a.IdAutor
         LEFT JOIN Archivos af ON af.Id = a.IdArchivoAdjunto
    WHERE a.Id=@cid AND a.IdProyecto=@projectId AND a.IdOrganizacion=@orgId
  `)
  return rs.recordset[0] ? (rs.recordset[0] as AporteRow) : null
}

export async function deleteContribution(
  auth: Auth,
  input: { projectId: string; contributionId: string; permanent?: boolean },
  opts?: { req?: Request | null }
): Promise<void> {
  if (!input.projectId || !input.contributionId) throw new AppError('projectId y contributionId requeridos', 400)
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, input.projectId)
  const projectOwnerId = await getProjectOwnerId(pool, input.projectId)
  const current = await getContributionRaw(pool, input.projectId, input.contributionId, auth.organizationId)
  if (!current) throw new NotFoundError('Aporte no encontrado')
  const perms = permFor(auth, current, projectOwnerId)
  if (!perms.canDelete) throw new ForbiddenError('No puedes eliminar este aporte')

  const q = pool.request()
  q.input('cid', sql.UniqueIdentifier, input.contributionId)
  q.input('projectId', sql.UniqueIdentifier, input.projectId)
  q.input('orgId', sql.UniqueIdentifier, auth.organizationId)
  if (input.permanent) {
    await q.query(`
      DELETE FROM AportesTemasVinculados WHERE IdAporte=@cid;
      DELETE FROM AportesProyecto WHERE Id=@cid AND IdProyecto=@projectId AND IdOrganizacion=@orgId;
      UPDATE Proyectos SET FechaActualizacion=GETDATE() WHERE Id=@projectId;
    `)
  } else {
    await q.query(`
      UPDATE AportesProyecto SET Estado='ELIMINADO', FechaActualizacion=GETDATE()
      WHERE Id=@cid AND IdProyecto=@projectId AND IdOrganizacion=@orgId;
      UPDATE Proyectos SET FechaActualizacion=GETDATE() WHERE Id=@projectId;
    `)
  }
  await logAuditRecord({
    organizationId: auth.organizationId, userId: auth.userId,
    action: input.permanent ? 'APORTE.ELIMINAR_PERMANENTE' : 'APORTE.ELIMINAR',
    resourceType: 'contribution', resourceId: input.contributionId,
    resourceName: current.Titulo ?? null, projectId: input.projectId,
    req: opts?.req ?? null,
  })
}

export async function linkTopicToContribution(
  auth: Auth,
  input: { projectId: string; contributionId: string; topicId: string },
  opts?: { req?: Request | null }
): Promise<ProjectContributionTopicLink> {
  if (!input.projectId || !input.contributionId || !input.topicId) throw new AppError('IDs requeridos', 400)
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, input.projectId)
  const current = await getContributionRaw(pool, input.projectId, input.contributionId, auth.organizationId)
  if (!current) throw new NotFoundError('Aporte no encontrado')
  const ts = await pool.request().input('tid', sql.UniqueIdentifier, input.topicId).input('pid', sql.UniqueIdentifier, input.projectId)
    .query('SELECT TOP 1 Id, Titulo FROM TemasProyecto WHERE Id=@tid AND IdProyecto=@pid')
  if (!ts.recordset.length) throw new NotFoundError('Tema no pertenece al proyecto')
  const lq = pool.request()
  lq.input('cid', sql.UniqueIdentifier, input.contributionId)
  lq.input('tid', sql.UniqueIdentifier, input.topicId)
  lq.input('uid', sql.UniqueIdentifier, auth.userId)
  lq.input('pid', sql.UniqueIdentifier, input.projectId)
  await lq.query(`
    IF NOT EXISTS (SELECT 1 FROM AportesTemasVinculados WHERE IdAporte=@cid AND IdTema=@tid)
      INSERT INTO AportesTemasVinculados (IdAporte,IdTema,IdUsuarioVinculante,FechaVinculacion)
      VALUES (@cid,@tid,@uid,GETDATE())
    UPDATE Proyectos SET FechaActualizacion=GETDATE() WHERE Id=@pid;
  `)
  const vq = await pool.request().input('cid', sql.UniqueIdentifier, input.contributionId).input('tid', sql.UniqueIdentifier, input.topicId)
    .query(`
      SELECT TOP 1 atv.IdAporte, atv.IdTema, atv.IdUsuarioVinculante, atv.FechaVinculacion, t.Titulo
      FROM AportesTemasVinculados atv LEFT JOIN TemasProyecto t ON t.Id = atv.IdTema
      WHERE atv.IdAporte=@cid AND atv.IdTema=@tid
    `)
  const v = vq.recordset[0]
  await logAuditRecord({
    organizationId: auth.organizationId, userId: auth.userId,
    action: 'APORTE.VINCULAR_TEMA', resourceType: 'contribution', resourceId: input.contributionId,
    resourceName: current.Titulo ?? null, projectId: input.projectId,
    extra: { topicId: input.topicId, topicTitle: v?.Titulo ?? null },
    req: opts?.req ?? null,
  })
  return {
    contributionId: String(v.IdAporte),
    topicId: String(v.IdTema),
    topicTitle: v?.Titulo ? String(v.Titulo) : null,
    linkedByUserId: v?.IdUsuarioVinculante ? String(v.IdUsuarioVinculante) : null,
    linkedAt: sqlLocalToIso(v.FechaVinculacion as any),
  }
}

export async function unlinkTopicFromContribution(
  auth: Auth,
  input: { projectId: string; contributionId: string; topicId: string },
  opts?: { req?: Request | null }
): Promise<void> {
  if (!input.projectId || !input.contributionId || !input.topicId) throw new AppError('IDs requeridos', 400)
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, input.projectId)
  const current = await getContributionRaw(pool, input.projectId, input.contributionId, auth.organizationId)
  if (!current) throw new NotFoundError('Aporte no encontrado')
  const projectOwnerId = await getProjectOwnerId(pool, input.projectId)
  const perms = permFor(auth, current, projectOwnerId)
  if (!perms.canEdit) throw new ForbiddenError('No puedes desvincular temas de este aporte')
  const dq = pool.request()
  dq.input('cid', sql.UniqueIdentifier, input.contributionId)
  dq.input('tid', sql.UniqueIdentifier, input.topicId)
  dq.input('pid', sql.UniqueIdentifier, input.projectId)
  await dq.query(`
    DELETE FROM AportesTemasVinculados WHERE IdAporte=@cid AND IdTema=@tid
      AND EXISTS (SELECT 1 FROM AportesProyecto a WHERE a.Id=@cid AND a.IdProyecto=@pid);
    UPDATE Proyectos SET FechaActualizacion=GETDATE() WHERE Id=@pid;
  `)
  await logAuditRecord({
    organizationId: auth.organizationId, userId: auth.userId,
    action: 'APORTE.DESVINCULAR_TEMA', resourceType: 'contribution', resourceId: input.contributionId,
    resourceName: current.Titulo ?? null, projectId: input.projectId,
    extra: { topicId: input.topicId },
    req: opts?.req ?? null,
  })
}

export async function listLinkedTopics(
  auth: Auth,
  input: { projectId: string; contributionId: string }
): Promise<ProjectContributionTopicLink[]> {
  if (!input.projectId || !input.contributionId) throw new AppError('IDs requeridos', 400)
  const pool = await getDbPool()
  await ensureProjectAccess(pool, auth, input.projectId)
  const q = pool.request()
  q.input('cid', sql.UniqueIdentifier, input.contributionId)
  q.input('pid', sql.UniqueIdentifier, input.projectId)
  q.input('oid', sql.UniqueIdentifier, auth.organizationId)
  const rs = await q.query(`
    SELECT atv.IdAporte, atv.IdTema, atv.IdUsuarioVinculante, atv.FechaVinculacion, t.Titulo
    FROM AportesTemasVinculados atv
         LEFT JOIN TemasProyecto t ON t.Id = atv.IdTema
         LEFT JOIN AportesProyecto a ON a.Id = atv.IdAporte
    WHERE atv.IdAporte=@cid AND a.IdProyecto=@pid AND a.IdOrganizacion=@oid
    ORDER BY atv.FechaVinculacion ASC
  `)
  return rs.recordset.map((v: any) => ({
    contributionId: String(v.IdAporte),
    topicId: String(v.IdTema),
    topicTitle: v?.Titulo ? String(v.Titulo) : null,
    linkedByUserId: v?.IdUsuarioVinculante ? String(v.IdUsuarioVinculante) : null,
    linkedAt: sqlLocalToIso(v.FechaVinculacion as any),
  }))
}
