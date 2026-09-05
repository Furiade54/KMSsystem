import type { Request } from 'express'
import { getDbPool, sql } from '../../shared/db/pool'
import { ensureAuditAndCommentTables, logAuditRecord } from '../../shared/db/audit'
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError'
import { getStorageProvider } from '../../shared/storage'
import { cleanupAllGrantsForProjectTree } from '../resource-permissions/resource-permissions.service'

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
  let deletedGrants = 0
  let deletedOrphanRows = 0

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

    deletedGrants = await cleanupAllGrantsForProjectTree(tx, projectId)

    const delReq = tx.request()
    delReq.input('projectId', sql.UniqueIdentifier, projectId)
    delReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    const delRes = await delReq.query<{ orphanRows: number }>(`
      SET NOCOUNT OFF;
      SET XACT_ABORT ON;

      /* ============================================================
         PASO 1: Construir tablas variables con la jerarquia COMPLETA
         de carpetas (recursiva) + archivos, incluyendo huerfanos
         antiguos con IdProyecto NULL. Reutilizamos en TODOS los
         DELETE posteriores para no recalcular CTE 5 veces.
         ============================================================ */
      DECLARE @Carpetas TABLE (Id UNIQUEIDENTIFIER PRIMARY KEY);
      WITH FolderHierarchy AS (
        SELECT Id
        FROM Carpetas
        WHERE IdProyecto = @projectId
        UNION ALL
        SELECT c.Id
        FROM Carpetas c
        INNER JOIN FolderHierarchy p ON p.Id = c.IdCarpetaPadre
      )
      INSERT INTO @Carpetas (Id)
      SELECT DISTINCT Id FROM FolderHierarchy;

      DECLARE @Archivos TABLE (Id UNIQUEIDENTIFIER PRIMARY KEY);
      INSERT INTO @Archivos (Id)
      SELECT Id FROM Archivos WHERE IdProyecto = @projectId;
      INSERT INTO @Archivos (Id)
      SELECT a.Id
      FROM Archivos a
      WHERE a.IdProyecto IS NULL AND a.IdCarpeta IN (SELECT Id FROM @Carpetas);

      DECLARE @orphan INT = 0;

      /* ============================================================
         PASO 1.5: Limpiar refs FK doc maestro (IdDocMaestroCarpeta
         tiene ON DELETE NO ACTION para evitar multiple cascade path;
         el SET NULL de Archivos es automatico pero lo hacemos manual
         tambien para robustez y orden de borrado).
         ============================================================ */
      UPDATE Proyectos SET IdDocMaestroCarpeta = NULL, IdDocMaestroArchivo = NULL, FechaActualizacion = GETDATE()
      WHERE Id = @projectId AND IdOrganizacion = @orgId;

      /* ============================================================
         PASO 2: Borrar dependencias de TABLAS sin FK CASCADE o que
         puedan apuntar a carpetas/archivos HUERFANOS sin IdProyecto.
         ============================================================ */

      /* PermisosRecurso: grants sobre carpetas/archivos de este arbol
         (el cleanup de grants del scope proyecto ya corre en deletedGrants) */
      DELETE pr FROM PermisosRecurso pr
      WHERE pr.TipoRecurso IN ('CARPETA','ARCHIVO')
        AND ((pr.TipoRecurso = 'CARPETA' AND pr.IdRecurso IN (SELECT Id FROM @Carpetas))
          OR (pr.TipoRecurso = 'ARCHIVO' AND pr.IdRecurso IN (SELECT Id FROM @Archivos)));
      SET @orphan = @orphan + @@ROWCOUNT;

      /* ComentariosArchivos huerfanos (sin IdProyecto) de estos archivos;
         los que si tienen IdProyecto se borran con el CASCADE Proyectos. */
      DELETE ca FROM ComentariosArchivos ca
      WHERE ca.IdProyecto IS NULL AND ca.IdArchivo IN (SELECT Id FROM @Archivos);
      SET @orphan = @orphan + @@ROWCOUNT;

      /* Comentarios: proyecto + carpeta (incluye huerfanas via @Carpetas)
         + archivo (incluye huerfanos via @Archivos). Mejor IN/EXISTS en vars. */
      DELETE c
      FROM Comentarios c
      WHERE (c.TipoRecurso = 'project' AND c.IdRecurso = @projectId)
         OR (c.TipoRecurso = 'folder' AND c.IdRecurso IN (SELECT Id FROM @Carpetas))
         OR (c.TipoRecurso = 'file' AND c.IdRecurso IN (SELECT Id FROM @Archivos));

      /* ComentariosArchivos con IdProyecto (por si el FK NO_ACTION viejo). */
      DELETE ca FROM ComentariosArchivos ca WHERE ca.IdProyecto = @projectId;

      /* SolicitudesAcceso: mismo patron que Comentarios. */
      DELETE s
      FROM SolicitudesAcceso s
      WHERE (s.TipoRecurso = 'proyecto' AND s.IdRecurso = @projectId)
         OR (s.TipoRecurso = 'carpeta' AND s.IdRecurso IN (SELECT Id FROM @Carpetas))
         OR (s.TipoRecurso = 'archivo' AND s.IdRecurso IN (SELECT Id FROM @Archivos));

      /* Auditoria: proyecto + carpeta arbol + archivos set.
         TipoRecurso guardado lowercase/project/folder/file en BD vieja. */
      DELETE au
      FROM Auditoria au
      WHERE (LOWER(au.TipoRecurso) = 'project' AND au.IdRecurso = @projectId)
         OR (LOWER(au.TipoRecurso) = 'folder' AND au.IdRecurso IN (SELECT Id FROM @Carpetas))
         OR (LOWER(au.TipoRecurso) = 'file' AND au.IdRecurso IN (SELECT Id FROM @Archivos));

      /* Favoritos: mismo patron. */
      DELETE fv
      FROM Favoritos fv
      WHERE fv.IdOrganizacion = @orgId AND (
            (fv.TipoRecurso = 'PROJECT' AND fv.IdRecurso = @projectId)
         OR (fv.TipoRecurso = 'FOLDER'  AND fv.IdRecurso IN (SELECT Id FROM @Carpetas))
         OR (fv.TipoRecurso = 'FILE'    AND fv.IdRecurso IN (SELECT Id FROM @Archivos))
      );

      /* ============================================================
         PASO 3: Tablas que requieren borrado manual antes de CASCADE.
         Archivos no tiene ON DELETE CASCADE hacia Proyectos; pero
         VersionesArchivo cuelga de Archivos con CASCADE y se borra
         sola al borrar Archivos.
         ============================================================ */
      DELETE a
      FROM Archivos a
      WHERE a.Id IN (SELECT Id FROM @Archivos);

      /* ============================================================
         PASO 4: BORRAR PROYECTO. ON DELETE CASCADE de la FK
         Proyectos.Id se encarga automaticamente de:
         Carpetas, MiembrosProyecto, RecursosExternos, Reuniones,
         TemasProyecto. Reuniones a su vez cascada ActasReunion y
         AsistentesReunion.
         ============================================================ */
      DELETE FROM Proyectos WHERE Id = @projectId AND IdOrganizacion = @orgId;

      SELECT @orphan AS orphanRows;
    `)
    deletedOrphanRows = Number(delRes.recordset[0]?.orphanRows ?? 0)

    await tx.commit()
  } catch (err) {
    try {
      if (tx) await tx.rollback()
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
    extra: {
      deletedFilesCount: storageKeys.length,
      deletedGrantsCount: deletedGrants,
      deletedOrphanRows,
    },
    req: req ?? null,
  }).catch(() => {})
}
