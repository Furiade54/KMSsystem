import type { Request } from 'express'
import { getDbPool, sql } from '../../shared/db/pool'
import { ensureAuditAndCommentTables, logAuditRecord } from '../../shared/db/audit'
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError'
import { getStorageProvider } from '../../shared/storage'

type ProjectAuth = {
  organizationId: string
  userId: string
}

type ProjectRow = {
  Id: string
  Nombre: string
  Estado: string
  IdPropietario: string | null
}

type ProjectFileRow = {
  Id: string
  IdProyecto: string
  IdCarpeta: string | null
  Nombre: string
  StorageKey: string | null
}

function buildFallbackStorageKey(row: ProjectFileRow): string {
  const cleanName = String(row.Nombre || 'archivo')
    .replace(/[^a-zA-Z0-9._\- ]/g, '_')
    .replace(/\s+/g, '-')
  const parts: string[] = ['projects', String(row.IdProyecto)]
  if (row.IdCarpeta) parts.push('folders', String(row.IdCarpeta))
  parts.push(`${String(row.Id)}_${cleanName}`)
  return parts.join('/')
}

export async function permanentlyDeleteProject(
  auth: ProjectAuth,
  projectId: string,
  req?: Request | null
): Promise<void> {
  await ensureAuditAndCommentTables()
  const pool = await getDbPool()
  const tx = pool.transaction()
  const storage = getStorageProvider()
  let projectName = ''
  let storageKeys: string[] = []

  try {
    await tx.begin()

    const projectReq = tx.request()
    projectReq.input('projectId', sql.UniqueIdentifier, projectId)
    projectReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    const projectRes = await projectReq.query<ProjectRow>(`
      SELECT p.Id, p.Nombre, p.Estado, p.IdPropietario
      FROM Proyectos p
      WHERE p.Id = @projectId AND p.IdOrganizacion = @orgId
    `)

    const project = projectRes.recordset[0]
    if (!project) throw new NotFoundError('Proyecto no encontrado')
    if (
      project.IdPropietario &&
      String(project.IdPropietario).toLowerCase() !== String(auth.userId).toLowerCase()
    ) {
      throw new ForbiddenError('Solo el propietario puede eliminar permanentemente el proyecto')
    }
    if (String(project.Estado || '').toUpperCase() !== 'ELIMINADO') {
      throw new AppError(
        'Solo se puede eliminar permanentemente un proyecto que ya esté en la papelera',
        400
      )
    }
    projectName = String(project.Nombre || '')

    const filesReq = tx.request()
    filesReq.input('projectId', sql.UniqueIdentifier, projectId)
    const filesRes = await filesReq.query<ProjectFileRow>(`
      SELECT Id, IdProyecto, IdCarpeta, Nombre, StorageKey
      FROM Archivos
      WHERE IdProyecto = @projectId
    `)
    storageKeys = filesRes.recordset.map((row) => row.StorageKey || buildFallbackStorageKey(row))

    const delReq = tx.request()
    delReq.input('projectId', sql.UniqueIdentifier, projectId)
    delReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    await delReq.batch(`
      SET NOCOUNT ON;

      /*
        FK reales en MSSQL verificadas contra la base KMS:
        - Archivos.IdProyecto -> Proyectos.Id = NO_ACTION
        - Carpetas.IdProyecto -> Proyectos.Id = CASCADE
        - MiembrosProyecto.IdProyecto -> Proyectos.Id = CASCADE
        - RecursosExternos.IdProyecto -> Proyectos.Id = CASCADE
        - Reuniones.IdProyecto -> Proyectos.Id = CASCADE
        - TemasProyecto.IdProyecto -> Proyectos.Id = CASCADE
        Por eso borramos Archivos manualmente antes de borrar Proyectos y dejamos que
        el motor elimine el resto de tablas hijas con ON DELETE CASCADE.
      */

      DELETE c
      FROM Comentarios c
      WHERE (c.TipoRecurso = 'project' AND c.IdRecurso = @projectId)
         OR (c.TipoRecurso = 'folder' AND EXISTS (
              SELECT 1 FROM Carpetas f WHERE f.Id = c.IdRecurso AND f.IdProyecto = @projectId
            ))
         OR (c.TipoRecurso = 'file' AND EXISTS (
              SELECT 1 FROM Archivos a WHERE a.Id = c.IdRecurso AND a.IdProyecto = @projectId
            ));

      DELETE ca
      FROM ComentariosArchivos ca
      WHERE ca.IdProyecto = @projectId;

      DELETE s
      FROM SolicitudesAcceso s
      WHERE (s.TipoRecurso = 'proyecto' AND s.IdRecurso = @projectId)
         OR (s.TipoRecurso = 'carpeta' AND EXISTS (
              SELECT 1 FROM Carpetas f WHERE f.Id = s.IdRecurso AND f.IdProyecto = @projectId
            ))
         OR (s.TipoRecurso = 'archivo' AND EXISTS (
              SELECT 1 FROM Archivos a WHERE a.Id = s.IdRecurso AND a.IdProyecto = @projectId
            ));

      DELETE au
      FROM Auditoria au
      WHERE (LOWER(au.TipoRecurso) = 'project' AND au.IdRecurso = @projectId)
         OR (LOWER(au.TipoRecurso) = 'folder' AND EXISTS (
              SELECT 1 FROM Carpetas f WHERE f.Id = au.IdRecurso AND f.IdProyecto = @projectId
            ))
         OR (LOWER(au.TipoRecurso) = 'file' AND EXISTS (
              SELECT 1 FROM Archivos a WHERE a.Id = au.IdRecurso AND a.IdProyecto = @projectId
            ));

      DELETE fv
      FROM Favoritos fv
      WHERE fv.IdOrganizacion = @orgId AND (
          (fv.TipoRecurso = 'PROJECT' AND fv.IdRecurso = @projectId)
          OR (fv.TipoRecurso = 'FOLDER' AND EXISTS (SELECT 1 FROM Carpetas c WHERE c.Id = fv.IdRecurso AND c.IdProyecto = @projectId))
          OR (fv.TipoRecurso = 'FILE' AND EXISTS (SELECT 1 FROM Archivos a WHERE a.Id = fv.IdRecurso AND a.IdProyecto = @projectId))
      );

      /*
        Archivos no tiene ON DELETE CASCADE hacia Proyectos y, ademas, VersionesArchivo
        cuelga de Archivos con CASCADE. Basta borrar Archivos para que SQL Server
        elimine VersionesArchivo automaticamente.
      */
      DELETE FROM Archivos WHERE IdProyecto = @projectId;

      /*
        El resto de dependencias con FK a Proyectos se resuelven via ON DELETE CASCADE:
        Carpetas, MiembrosProyecto, RecursosExternos, Reuniones y TemasProyecto.
        A su vez, Reuniones cascada a ActasReunion y AsistentesReunion.
      */
      DELETE FROM Proyectos WHERE Id = @projectId AND IdOrganizacion = @orgId;
    `)

    await tx.commit()
  } catch (err) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw err
  }

  for (const key of storageKeys) {
    await storage.deleteObject(key).catch(() => {})
  }

  await logAuditRecord({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: 'project.eliminado_permanente',
    resourceType: 'project',
    resourceId: projectId,
    resourceName: projectName || null,
    extra: { deletedFilesCount: storageKeys.length },
    req: req ?? null,
  })
}
