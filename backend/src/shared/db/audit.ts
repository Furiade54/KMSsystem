import { getDbPool, sql } from './pool'
import type { Request } from 'express'

let ensured = false
let ensuredPermCatalog = false

type PermissionCatalogRow = {
  Codigo: string
  Nombre_: string
  Descripcion: string
  Nivel: 'ORGANIZACION' | 'PROYECTO' | 'RECURSO' | 'SISTEMA'
  Categoria: string
}

const PERMISSION_CATALOG_SEED: PermissionCatalogRow[] = [
  // ===== NIVEL: ORGANIZACIÓN =====
  { Codigo: 'org.ver', Nombre_: 'Ver organización', Descripcion: 'Ver la información básica de la organización', Nivel: 'ORGANIZACION', Categoria: 'Organización' },
  { Codigo: 'org.editar', Nombre_: 'Editar organización', Descripcion: 'Editar la información, logo o configuración de la organización', Nivel: 'ORGANIZACION', Categoria: 'Organización' },
  { Codigo: 'org.crear', Nombre_: 'Crear organizaciones', Descripcion: 'Registrar nuevas organizaciones en el sistema', Nivel: 'ORGANIZACION', Categoria: 'Organización' },
  { Codigo: 'org.eliminar', Nombre_: 'Eliminar organización', Descripcion: 'Eliminar (soft delete) la organización', Nivel: 'ORGANIZACION', Categoria: 'Organización' },
  { Codigo: 'org.eliminar_permanente', Nombre_: 'Eliminar organización permanentemente', Descripcion: 'Borrar físicamente la organización y sus datos', Nivel: 'ORGANIZACION', Categoria: 'Organización' },
  { Codigo: 'org.listar', Nombre_: 'Listar organizaciones', Descripcion: 'Ver el listado global de organizaciones del sistema', Nivel: 'ORGANIZACION', Categoria: 'Organización' },
  { Codigo: 'usuarios.ver', Nombre_: 'Ver usuarios', Descripcion: 'Ver el listado de usuarios de la organización y su detalle', Nivel: 'ORGANIZACION', Categoria: 'Usuarios' },
  { Codigo: 'usuarios.crear', Nombre_: 'Crear usuarios', Descripcion: 'Invitar / crear nuevos usuarios en la organización', Nivel: 'ORGANIZACION', Categoria: 'Usuarios' },
  { Codigo: 'usuarios.editar', Nombre_: 'Editar usuarios', Descripcion: 'Actualizar datos, estado o roles de usuarios existentes', Nivel: 'ORGANIZACION', Categoria: 'Usuarios' },
  { Codigo: 'usuarios.eliminar', Nombre_: 'Eliminar usuarios', Descripcion: 'Desactivar / eliminar usuarios de la organización', Nivel: 'ORGANIZACION', Categoria: 'Usuarios' },
  { Codigo: 'roles.ver', Nombre_: 'Ver roles', Descripcion: 'Listar y ver roles y sus permisos', Nivel: 'ORGANIZACION', Categoria: 'Roles' },
  { Codigo: 'roles.asignar', Nombre_: 'Asignar roles', Descripcion: 'Asignar o quitar roles a los usuarios', Nivel: 'ORGANIZACION', Categoria: 'Roles' },
  { Codigo: 'roles.crear', Nombre_: 'Crear roles', Descripcion: 'Crear roles personalizados nuevos', Nivel: 'ORGANIZACION', Categoria: 'Roles' },
  { Codigo: 'roles.editar', Nombre_: 'Editar roles', Descripcion: 'Editar el nombre o permisos de un rol existente', Nivel: 'ORGANIZACION', Categoria: 'Roles' },
  { Codigo: 'roles.eliminar', Nombre_: 'Eliminar roles', Descripcion: 'Eliminar roles personalizados (no los de sistema)', Nivel: 'ORGANIZACION', Categoria: 'Roles' },
  { Codigo: 'solicitudes.gestionar', Nombre_: 'Gestionar solicitudes', Descripcion: 'Aprobar, rechazar y administrar las solicitudes de acceso', Nivel: 'ORGANIZACION', Categoria: 'Solicitudes' },

  // ===== NIVEL: PROYECTO =====
  { Codigo: 'proyectos.ver', Nombre_: 'Ver proyectos', Descripcion: 'Ver el listado de proyectos y su detalle', Nivel: 'PROYECTO', Categoria: 'Proyectos' },
  { Codigo: 'proyectos.crear', Nombre_: 'Crear proyectos', Descripcion: 'Crear proyectos nuevos dentro de la organización', Nivel: 'PROYECTO', Categoria: 'Proyectos' },
  { Codigo: 'proyectos.editar', Nombre_: 'Editar proyectos', Descripcion: 'Editar datos, estado o configuración de proyectos existentes', Nivel: 'PROYECTO', Categoria: 'Proyectos' },
  { Codigo: 'proyectos.eliminar', Nombre_: 'Eliminar proyectos', Descripcion: 'Archivar o eliminar proyectos', Nivel: 'PROYECTO', Categoria: 'Proyectos' },
  { Codigo: 'proyectos.miembros.gestionar', Nombre_: 'Gestionar miembros de proyecto', Descripcion: 'Invitar, quitar o cambiar roles de los miembros de un proyecto', Nivel: 'PROYECTO', Categoria: 'Proyectos' },
  { Codigo: 'reuniones.ver', Nombre_: 'Ver reuniones', Descripcion: 'Ver el listado y detalle de reuniones de un proyecto', Nivel: 'PROYECTO', Categoria: 'Reuniones' },
  { Codigo: 'reuniones.crear', Nombre_: 'Crear reuniones', Descripcion: 'Crear reuniones nuevas en un proyecto', Nivel: 'PROYECTO', Categoria: 'Reuniones' },
  { Codigo: 'reuniones.editar', Nombre_: 'Editar reuniones', Descripcion: 'Editar datos, fecha o estado de una reunión', Nivel: 'PROYECTO', Categoria: 'Reuniones' },
  { Codigo: 'reuniones.eliminar', Nombre_: 'Eliminar reuniones', Descripcion: 'Cancelar o eliminar reuniones', Nivel: 'PROYECTO', Categoria: 'Reuniones' },
  { Codigo: 'reuniones.asistentes.gestionar', Nombre_: 'Gestionar asistentes', Descripcion: 'Agregar o quitar asistentes a la reunión', Nivel: 'PROYECTO', Categoria: 'Reuniones' },
  { Codigo: 'reuniones.acta.gestionar', Nombre_: 'Gestionar acta', Descripcion: 'Redactar, editar o publicar el acta de la reunión', Nivel: 'PROYECTO', Categoria: 'Reuniones' },
  { Codigo: 'temas.ver', Nombre_: 'Ver temas', Descripcion: 'Ver temas de agenda de proyectos', Nivel: 'PROYECTO', Categoria: 'Temas' },
  { Codigo: 'temas.crear', Nombre_: 'Crear temas', Descripcion: 'Crear temas de agenda nuevos en un proyecto', Nivel: 'PROYECTO', Categoria: 'Temas' },
  { Codigo: 'temas.editar', Nombre_: 'Editar temas', Descripcion: 'Editar la información o contenido de los temas', Nivel: 'PROYECTO', Categoria: 'Temas' },
  { Codigo: 'temas.eliminar', Nombre_: 'Eliminar temas', Descripcion: 'Eliminar temas de agenda existentes', Nivel: 'PROYECTO', Categoria: 'Temas' },
  { Codigo: 'temas.items.ver', Nombre_: 'Ver items del tema', Descripcion: 'Ver los items (puntos) dentro de cada tema', Nivel: 'PROYECTO', Categoria: 'TemasItems' },
  { Codigo: 'temas.items.crear', Nombre_: 'Crear items del tema', Descripcion: 'Agregar nuevos items/puntos a un tema', Nivel: 'PROYECTO', Categoria: 'TemasItems' },
  { Codigo: 'temas.items.editar', Nombre_: 'Editar items del tema', Descripcion: 'Modificar items/puntos de un tema', Nivel: 'PROYECTO', Categoria: 'TemasItems' },
  { Codigo: 'temas.items.eliminar', Nombre_: 'Eliminar items del tema', Descripcion: 'Quitar items/puntos de un tema', Nivel: 'PROYECTO', Categoria: 'TemasItems' },
  { Codigo: 'aportes.ver', Nombre_: 'Ver aportes', Descripcion: 'Ver el listado y detalle de aportes en un proyecto', Nivel: 'PROYECTO', Categoria: 'Aportes' },
  { Codigo: 'aportes.crear', Nombre_: 'Crear aportes', Descripcion: 'Registrar un nuevo aporte (idea, propuesta, mejora)', Nivel: 'PROYECTO', Categoria: 'Aportes' },
  { Codigo: 'aportes.editar', Nombre_: 'Editar aportes', Descripcion: 'Editar los aportes que tú has creado', Nivel: 'PROYECTO', Categoria: 'Aportes' },
  { Codigo: 'aportes.eliminar', Nombre_: 'Eliminar aportes', Descripcion: 'Eliminar aportes propios o cualquier aporte según ACL', Nivel: 'PROYECTO', Categoria: 'Aportes' },
  { Codigo: 'aportes.compartir', Nombre_: 'Compartir aportes', Descripcion: 'Compartir aportes con otros miembros o con links públicos', Nivel: 'PROYECTO', Categoria: 'Aportes' },

  // ===== NIVEL: RECURSO =====
  { Codigo: 'archivos.ver', Nombre_: 'Ver archivos', Descripcion: 'Ver, descargar y previsualizar archivos', Nivel: 'RECURSO', Categoria: 'Archivos' },
  { Codigo: 'archivos.subir', Nombre_: 'Subir archivos', Descripcion: 'Subir archivos y crear versiones', Nivel: 'RECURSO', Categoria: 'Archivos' },
  { Codigo: 'archivos.editar', Nombre_: 'Editar archivos', Descripcion: 'Editar metadata, nombre, versiones o mover archivos', Nivel: 'RECURSO', Categoria: 'Archivos' },
  { Codigo: 'archivos.eliminar', Nombre_: 'Eliminar archivos', Descripcion: 'Eliminar (a papelera) archivos y carpetas', Nivel: 'RECURSO', Categoria: 'Archivos' },
  { Codigo: 'archivos.compartir', Nombre_: 'Compartir archivos', Descripcion: 'Crear y administrar links compartidos de archivos', Nivel: 'RECURSO', Categoria: 'Archivos' },
  { Codigo: 'comentarios.crear', Nombre_: 'Crear comentarios', Descripcion: 'Agregar comentarios en recursos y aportes', Nivel: 'RECURSO', Categoria: 'Comentarios' },
  { Codigo: 'comentarios.gestionar', Nombre_: 'Gestionar comentarios', Descripcion: 'Editar, resolver o eliminar comentarios (incluyendo ajenos)', Nivel: 'RECURSO', Categoria: 'Comentarios' },
  { Codigo: 'favoritos.gestionar', Nombre_: 'Gestionar favoritos', Descripcion: 'Marcar y desmarcar recursos como favoritos', Nivel: 'RECURSO', Categoria: 'Favoritos' },
  { Codigo: 'revisiones.ver', Nombre_: 'Ver revisiones', Descripcion: 'Ver revisiones y aprobaciones pendientes', Nivel: 'RECURSO', Categoria: 'Revisiones' },
  { Codigo: 'revisiones.crear', Nombre_: 'Crear revisiones', Descripcion: 'Solicitar revisión de un recurso', Nivel: 'RECURSO', Categoria: 'Revisiones' },
  { Codigo: 'revisiones.asignar', Nombre_: 'Asignar revisiones', Descripcion: 'Asignar revisores a una revisión', Nivel: 'RECURSO', Categoria: 'Revisiones' },
  { Codigo: 'recursos.permisos.ver', Nombre_: 'Ver permisos por recurso', Descripcion: 'Ver los permisos granulares específicos sobre cada recurso', Nivel: 'RECURSO', Categoria: 'PermisosRecurso' },
  { Codigo: 'recursos.permisos.editar', Nombre_: 'Editar permisos por recurso', Descripcion: 'Conceder o revocar permisos sobre recursos específicos', Nivel: 'RECURSO', Categoria: 'PermisosRecurso' },

  // ===== NIVEL: SISTEMA =====
  { Codigo: 'auditoria.ver', Nombre_: 'Ver auditoría', Descripcion: 'Ver el registro de auditoría y la actividad del sistema', Nivel: 'SISTEMA', Categoria: 'Auditoría' },
]

export type PermissionCatalogSyncResult = {
  inserted: number
  updated: number
  total: number
}

export async function ensurePermissionCatalog(): Promise<PermissionCatalogSyncResult> {
  const result: PermissionCatalogSyncResult = { inserted: 0, updated: 0, total: 0 }
  if (ensuredPermCatalog) return result
  try {
    const pool = await getDbPool()
    for (const p of PERMISSION_CATALOG_SEED) {
      const q = pool.request()
      q.input('Codigo', sql.VarChar(100), p.Codigo)
      q.input('Nombre', sql.NVarChar(255), p.Nombre_)
      q.input('Descripcion', sql.NVarChar(500), p.Descripcion)
      q.input('Nivel', sql.VarChar(30), p.Nivel)
      q.input('Categoria', sql.NVarChar(100), p.Categoria)
      const r = await q.query<{ id: string; acc: string }>(`
        SET NOCOUNT ON;
        DECLARE @out TABLE (action VARCHAR(20));
        MERGE dbo.Permisos WITH (HOLDLOCK) AS T
        USING (SELECT @Codigo AS Codigo) AS S
        ON T.Codigo = S.Codigo
        WHEN MATCHED THEN
          UPDATE SET
            Nombre = ISNULL(T.Nombre, @Nombre),
            Descripcion = @Descripcion,
            Categoria = @Categoria,
            Nivel = @Nivel
        WHEN NOT MATCHED BY TARGET THEN
          INSERT (Id, Codigo, Nombre, Descripcion, Categoria, Nivel, FechaCreacion)
          VALUES (NEWID(), @Codigo, @Nombre, @Descripcion, @Categoria, @Nivel, GETDATE())
        OUTPUT $action INTO @out;
        SELECT TOP 1 action AS acc FROM @out;
      `)
      const action = (r.recordset[0] as { acc: string } | undefined)?.acc
      if (action === 'INSERT') result.inserted += 1
      else if (action === 'UPDATE') result.updated += 1
      result.total += 1
    }
    ensuredPermCatalog = true
  } catch (e) {
    /* ignore; best-effort sync; fail only on insert would be weird */
  }
  return result
}

export async function ensureAuditAndCommentTables(): Promise<void> {
  if (ensured) return
  try {
    const pool = await getDbPool()
    await pool.request().batch(`
      IF OBJECT_ID('dbo.Comentarios', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Comentarios (
          Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          TipoRecurso VARCHAR(20) NOT NULL,
          IdRecurso UNIQUEIDENTIFIER NOT NULL,
          IdUsuario UNIQUEIDENTIFIER NOT NULL,
          IdComentarioPadre UNIQUEIDENTIFIER NULL,
          Contenido NVARCHAR(MAX) NOT NULL,
          Resuelto BIT DEFAULT 0,
          FechaCreacion DATETIME2 DEFAULT GETDATE(),
          FechaActualizacion DATETIME2
        );
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Comentarios_IdRecurso' AND object_id = OBJECT_ID('dbo.Comentarios'))
          CREATE INDEX IX_Comentarios_IdRecurso ON dbo.Comentarios(IdRecurso);
      END

      IF OBJECT_ID('dbo.Auditoria', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Auditoria (
          Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          IdOrganizacion UNIQUEIDENTIFIER,
          IdUsuario UNIQUEIDENTIFIER,
          IdProyecto UNIQUEIDENTIFIER,
          Accion VARCHAR(100) NOT NULL,
          TipoRecurso VARCHAR(50),
          IdRecurso UNIQUEIDENTIFIER,
          Ip VARCHAR(50),
          AgenteUsuario NVARCHAR(500),
          Metadatos NVARCHAR(MAX),
          FechaCreacion DATETIME2 DEFAULT GETDATE()
        );
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_FechaCreacion' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_FechaCreacion ON dbo.Auditoria(FechaCreacion DESC);
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_Accion' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_Accion ON dbo.Auditoria(Accion);
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_TipoRecurso_IdRecurso' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_TipoRecurso_IdRecurso ON dbo.Auditoria(TipoRecurso, IdRecurso);
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_IdOrganizacion_IdUsuario' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_IdOrganizacion_IdUsuario
            ON dbo.Auditoria(IdOrganizacion, IdUsuario, FechaCreacion DESC) INCLUDE (Accion, TipoRecurso, IdRecurso);
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_IdOrganizacion_IdProyecto_Fecha' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_IdOrganizacion_IdProyecto_Fecha
            ON dbo.Auditoria(IdOrganizacion, IdProyecto, FechaCreacion DESC);
      END
      ELSE
      BEGIN
        IF COL_LENGTH('dbo.Auditoria', 'IdProyecto') IS NULL
          ALTER TABLE dbo.Auditoria ADD IdProyecto UNIQUEIDENTIFIER NULL;
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_IdOrganizacion_IdProyecto_Fecha' AND object_id = OBJECT_ID('dbo.Auditoria'))
          CREATE NONCLUSTERED INDEX IX_Auditoria_IdOrganizacion_IdProyecto_Fecha
            ON dbo.Auditoria(IdOrganizacion, IdProyecto, FechaCreacion DESC);
      END
    `)
    ensured = true
  } catch {
    /* ignore; run on startup best-effort */
  }
}

function readRequestTrace(req?: Request | null): { ip: string | null; ua: string | null } {
  if (!req) return { ip: null, ua: null }
  try {
    let ip: string | null =
      (req.headers && (req.headers['x-forwarded-for'] as string)) ||
      (req.ip as string) ||
      null
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim()
    if (ip && ip.length > 50) ip = ip.slice(0, 50)
    const uaRaw = (req.headers && (req.headers['user-agent'] as string)) || null
    const ua = uaRaw ? uaRaw.slice(0, 500) : null
    return { ip, ua }
  } catch {
    return { ip: null, ua: null }
  }
}

export async function logAuditRecord(params: {
  organizationId: string
  userId: string
  action: string
  resourceType: string
  resourceId: string | null
  resourceName?: string | null
  projectId?: string | null
  extra?: Record<string, unknown> | null
  req?: Request | null
}): Promise<void> {
  try {
    await ensureAuditAndCommentTables()
    const pool = await getDbPool()
    const metadataRaw: Record<string, unknown> = {
      ...(params.resourceName != null ? { resourceName: String(params.resourceName) } : {}),
      ...(params.projectId != null ? { projectId: String(params.projectId) } : {}),
      ...(params.extra ?? {}),
    }
    const metadataStr = Object.keys(metadataRaw).length > 0 ? JSON.stringify(metadataRaw) : null
    const trace = readRequestTrace(params.req ?? null)
    const q = pool.request()
    q.input('orgId', sql.UniqueIdentifier, params.organizationId)
    q.input('userId', sql.UniqueIdentifier, params.userId)
    q.input('projectId', sql.UniqueIdentifier, params.projectId ?? null)
    q.input('accion', sql.VarChar(100), String(params.action ?? '').slice(0, 100))
    q.input('tipo', sql.VarChar(50), String(params.resourceType ?? '').slice(0, 50) || null)
    q.input('rid', sql.UniqueIdentifier, params.resourceId || null)
    q.input('ip', sql.VarChar(50), trace.ip ? trace.ip.slice(0, 50) : null)
    q.input('ua', sql.NVarChar(500), trace.ua ? trace.ua.slice(0, 500) : null)
    q.input('meta', sql.NVarChar(sql.MAX), metadataStr)
    await q.query(`
      INSERT INTO Auditoria (IdOrganizacion, IdUsuario, IdProyecto, Accion, TipoRecurso, IdRecurso, Ip, AgenteUsuario, Metadatos)
      VALUES (@orgId, @userId, @projectId, @accion, @tipo, @rid, @ip, @ua, @meta);
    `)
  } catch {
    /* auditoría es best-effort; nunca debe romper el flujo principal */
  }
}

export function truncateForActivity(text: string, max = 280): string {
  if (!text) return ''
  const cleaned = String(text).replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max - 1).trimEnd() + '…'
}

export function resolveAuditProjectIdExpr(): string {
  return `CASE LOWER(a.TipoRecurso)
    WHEN 'project' THEN CAST(a.IdRecurso AS NVARCHAR(128))
    WHEN 'folder'  THEN CAST(f.IdProyecto  AS NVARCHAR(128))
    WHEN 'file'    THEN CAST(af.IdProyecto AS NVARCHAR(128))
    ELSE NULL END`
}
