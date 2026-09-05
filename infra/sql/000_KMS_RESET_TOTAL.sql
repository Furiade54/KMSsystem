-- ============================================================================
--  KMS - Knowledge Management System
--  Script TOTAL de recreacion de base de datos (DROP + CREATE + schema + seed)
--  VERSION UNIFICADA v3.1 PRODUCCION — incorpora todas las mejoras de:
--    * Mejoras usuarios / RBAC / trazabilidad (antiguo 002_KMS_MEJORAS_USUARIOS_SBD)
--    * Favoritos con IdOrganizacion y PK compuesta
--    * Tablas ActividadReciente y SolicitudesPendientes
--    * Catalogo semilla de Permisos (28) organizados por Nivel/Categoria
--      (incluye recursos.permisos.ver y recursos.permisos.editar)
--    * Tabla PermisosRecurso con 14 cols (FechaCreacion / FechaActualizacion
--      / IdConcedidoPor) + 1 IX compuesto + 2 UQ filtrados (grantee XOR)
--  Destino: Microsoft SQL Server 2014 (COMPATIBILITY_LEVEL 120) — listo para PROD.
--
--  ⚠  ADVERTENCIA PARA PRODUCCION (LEER ANTES):
--     1. ESTE SCRIPT ELIMINA LA BASE [KMS] SI EXISTE. Toma BACKUP FULL antes.
--     2. Usuarios semilla tienen contras PUBLICAS documentadas: admin@kms.local /
--        Admin123456 — carlos.perez@ejemplo.com / Admin123456. CAMBIA LOS
--        PASSWORDS inmediatamente despues del reset (block POST-RESET al final).
--     3. No crea LOGINS a nivel INSTANCIA (ej: 'pipe' o 'kms_app_pool').
--        Debes crearlos tu y mapearlos a la BD con db_datareader + db_datawriter.
--     4. Finaliza con RECOVERY FULL + PAGE_VERIFY CHECKSUM + COMPAT 120. Realiza
--        BACKUP FULL INMEDIATO despues del reset para habilitar backups LOG.
--
--  USO:
--    1. TOMAR BACKUP FULL DE BD ACTUAL (si existe) — obligatorio en prod).
--    2. Ejecutar en SSMS conectado con login sysadmin a la instancia PROD.
--    3. El script ELIMINA KMS (si existe), crea tablas, FK, IX y seed.
--    4. NO es necesario correr migrations de infra/sql/migrations/ despues.
--
--  ORDEN DE MIGRATIONS (SOLO si se preserva BD actual, SIN reset):
--    1) 20260903_fix_rbac_roles.sql
--    2) 20260903b_patch_permisos_miembro.sql
--    3) 20260903c_add_fechaactualizacion.sql
--    4) 20260905_permisos_recurso.sql   ← ACL granular por recurso
--
--  IMPORTANTE (CASCADE PATHS):
--    - FK_Archivo_Proyecto NO usa ON DELETE CASCADE a proposito.
--    - SQL Server fallaria por MULTIPLE CASCADE PATHS:
--         Proyectos -> Carpetas -> Archivos
--         Proyectos -> Archivos
--    - Borrado permanente proyectos: borra Archivos manual ANTES de Proyectos,
--      el resto de hijas caen por CASCADE.
--    - Borrado permanente Usuarios requiere limpieza manual FK NO_ACTION.
-- ============================================================================

SET NOCOUNT ON;
GO

USE master;
GO

IF DB_ID(N'KMS') IS NOT NULL
BEGIN
    ALTER DATABASE KMS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE KMS;
    PRINT 'Base de datos [KMS] eliminada.';
END
GO

-------------------------------------------------------------------------------
--  CREATE DATABASE — configuracion PRODUCCION optimizada para SQL 2014
-------------------------------------------------------------------------------
CREATE DATABASE KMS
 COLLATE Modern_Spanish_CI_AS
 ON PRIMARY
( NAME = N'KMS_Data',
  FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL12.MSSQLSERVER\MSSQL\DATA\KMS.mdf',
  SIZE = 256 MB,
  MAXSIZE = UNLIMITED,
  FILEGROWTH = 64 MB
)
 LOG ON
( NAME = N'KMS_Log',
  FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL12.MSSQLSERVER\MSSQL\DATA\KMS_log.ldf',
  SIZE = 64 MB,
  MAXSIZE = UNLIMITED,
  FILEGROWTH = 32 MB
);
GO
PRINT 'Base de datos [KMS] creada (Collate Modern_Spanish_CI_AS, Data 256MB, Log 64MB).';
GO

-- Nivel compatibilidad 120 = SQL Server 2014 (portable aunque engine sea superior)
ALTER DATABASE KMS SET COMPATIBILITY_LEVEL = 120;
GO

-- Recuperacion FULL (obligatorio para point-in-time / backups LOG).
-- Entorno STAGING: cambiar a SIMPLE manualmente DESPUES del reset si lo deseas.
ALTER DATABASE KMS SET RECOVERY FULL;
GO

-- Detecta corrupcion en paginas de disco ANTES de propagarla en backup/reads.
ALTER DATABASE KMS SET PAGE_VERIFY CHECKSUM;
GO

-- Apagamos stats auto DURANTE el seed para evitar sampleos sesgados; lo
-- re-encendemos en el block POST-RESET al final del script.
ALTER DATABASE KMS SET AUTO_CREATE_STATISTICS OFF;
ALTER DATABASE KMS SET AUTO_UPDATE_STATISTICS OFF;
GO

USE KMS;
GO

-- Seed en modo RESTRICTED: solo sysadmins y db_owner pueden conectarse
-- durante la carga. Evita que el app pool se conecte a medias y cause
-- deadlocks / datos semilla parciales.
ALTER DATABASE KMS SET RESTRICTED_USER WITH ROLLBACK IMMEDIATE;
GO
PRINT 'Modo RESTRICTED_USER activado. Iniciando carga de tablas + seed.';
GO

-- ============================================================
--  1. IDENTIDAD Y SEGURIDAD
-- ============================================================

CREATE TABLE dbo.Organizaciones (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Organizaciones PRIMARY KEY DEFAULT NEWID(),
    Nombre NVARCHAR(200) NOT NULL,
    NIT NVARCHAR(50) NULL,
    LogoUrl NVARCHAR(MAX) NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Organizaciones_Estado DEFAULT 'ACTIVO',
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Organizaciones_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL
);
GO

CREATE TABLE dbo.Usuarios (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Usuarios PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    NombreCompleto NVARCHAR(150) NULL,
    Correo NVARCHAR(200) NOT NULL,
    ClaveHash NVARCHAR(MAX) NULL,
    UrlAvatar NVARCHAR(MAX) NULL,
    Telefono NVARCHAR(50) NULL,
    Cargo NVARCHAR(100) NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Usuarios_Estado DEFAULT 'ACTIVO',
    UltimoInicio DATETIME2 NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Usuarios_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Usuario_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id) ON DELETE CASCADE,
    CONSTRAINT CK_Usuarios_Estado
        CHECK (Estado IN ('ACTIVO','INACTIVO','BLOQUEADO','ELIMINADO'))
);
GO

CREATE UNIQUE INDEX IX_Usuarios_Correo ON dbo.Usuarios(Correo);
GO

CREATE INDEX IX_Usuarios_IdOrganizacion_Estado
    ON dbo.Usuarios(IdOrganizacion, Estado)
    INCLUDE (NombreCompleto, Correo, FechaCreacion, UltimoInicio);
GO

CREATE INDEX IX_Usuarios_NombreCompleto
    ON dbo.Usuarios(NombreCompleto);
GO

CREATE TABLE dbo.Roles (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Roles PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NULL,
    Nombre NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(500) NULL,
    EsRolSistema BIT NOT NULL CONSTRAINT DF_Roles_EsRolSistema DEFAULT 0,
    NivelPrioridad TINYINT NOT NULL CONSTRAINT DF_Roles_NivelPrioridad DEFAULT 50,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Roles_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Rol_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id) ON DELETE CASCADE,
    CONSTRAINT CK_Roles_NivelPrioridad
        CHECK (NivelPrioridad BETWEEN 0 AND 255)
);
GO

CREATE UNIQUE INDEX IX_Roles_Organizacion_Nombre
    ON dbo.Roles(IdOrganizacion, Nombre)
    WHERE IdOrganizacion IS NOT NULL;
GO

CREATE INDEX IX_Roles_IdOrganizacion
    ON dbo.Roles(IdOrganizacion, EsRolSistema)
    INCLUDE (Nombre, NivelPrioridad);
GO

CREATE TABLE dbo.RolesUsuario (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_RolesUsuario PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdRol UNIQUEIDENTIFIER NOT NULL,
    FechaAsignacion DATETIME2 NOT NULL CONSTRAINT DF_RolesUsuario_FechaAsignacion DEFAULT GETDATE(),
    AsignadoPor UNIQUEIDENTIFIER NULL,
    CONSTRAINT FK_RolesUsuario_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RolesUsuario_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT FK_RolesUsuario_Rol
        FOREIGN KEY (IdRol) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RolesUsuario_AsignadoPor
        FOREIGN KEY (AsignadoPor) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT UQ_RolesUsuario_Usuario_Rol
        UNIQUE (IdUsuario, IdRol)
);
GO

CREATE INDEX IX_RolesUsuario_IdOrganizacion
    ON dbo.RolesUsuario(IdOrganizacion)
    INCLUDE (IdUsuario, IdRol);
GO

CREATE INDEX IX_RolesUsuario_IdUsuario
    ON dbo.RolesUsuario(IdUsuario)
    INCLUDE (IdRol, IdOrganizacion);
GO

CREATE INDEX IX_RolesUsuario_IdRol
    ON dbo.RolesUsuario(IdRol)
    INCLUDE (IdUsuario, IdOrganizacion);
GO

CREATE TABLE dbo.Permisos (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Permisos PRIMARY KEY DEFAULT NEWID(),
    Codigo VARCHAR(100) NOT NULL CONSTRAINT UQ_Permisos_Codigo UNIQUE,
    Descripcion NVARCHAR(200) NULL,
    Nivel VARCHAR(20) NOT NULL CONSTRAINT DF_Permisos_Nivel DEFAULT 'ORGANIZACION',
    Categoria NVARCHAR(50) NULL,
    CONSTRAINT CK_Permisos_Nivel
        CHECK (Nivel IN ('ORGANIZACION','PROYECTO','RECURSO','SISTEMA'))
);
GO

CREATE INDEX IX_Permisos_Nivel_Categoria
    ON dbo.Permisos(Nivel, Categoria)
    INCLUDE (Codigo);
GO


CREATE TABLE dbo.PermisosRol (
    IdRol UNIQUEIDENTIFIER NOT NULL,
    IdPermiso UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_PermisosRol PRIMARY KEY (IdRol, IdPermiso),
    CONSTRAINT FK_PermisosRol_Rol
        FOREIGN KEY (IdRol) REFERENCES dbo.Roles(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PermisosRol_Permiso
        FOREIGN KEY (IdPermiso) REFERENCES dbo.Permisos(Id) ON DELETE CASCADE
);
GO

-- ============================================================
--  2. TRABAJO COLABORATIVO
-- ============================================================

CREATE TABLE dbo.Proyectos (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Proyectos PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(200) NOT NULL,
    Descripcion NVARCHAR(MAX) NULL,
    Estado VARCHAR(30) NOT NULL CONSTRAINT DF_Proyectos_Estado DEFAULT 'ACTIVO',
    IdPropietario UNIQUEIDENTIFIER NULL,
    Color NVARCHAR(30) NOT NULL CONSTRAINT DF_Proyectos_Color DEFAULT 'indigo',
    ProgresoPorcentaje TINYINT NOT NULL CONSTRAINT DF_Proyectos_Progreso DEFAULT 0,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Proyectos_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Proyecto_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Proyecto_Propietario
        FOREIGN KEY (IdPropietario) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT CK_Proyectos_Estado
        CHECK (Estado IN ('ACTIVO','PENDIENTE','COMPLETADO','INACTIVO','ARCHIVADO','ELIMINADO'))
);
GO

CREATE INDEX IX_Proyectos_IdOrganizacion_Estado
    ON dbo.Proyectos(IdOrganizacion, Estado)
    INCLUDE (Nombre, IdPropietario, FechaCreacion);
GO

CREATE INDEX IX_Proyectos_IdPropietario
    ON dbo.Proyectos(IdPropietario, Estado)
    INCLUDE (IdOrganizacion, Nombre);
GO

CREATE TABLE dbo.MiembrosProyecto (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_MiembrosProyecto PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    NombreRol NVARCHAR(100) NULL,
    FechaIngreso DATETIME2 NOT NULL CONSTRAINT DF_MiembrosProyecto_FechaIngreso DEFAULT GETDATE(),
    CONSTRAINT FK_Miembro_Proyecto
        FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Miembro_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT UQ_MiembrosProyecto_Proyecto_Usuario
        UNIQUE (IdProyecto, IdUsuario)
);
GO

CREATE INDEX IX_MiembrosProyecto_IdUsuario
    ON dbo.MiembrosProyecto(IdUsuario)
    INCLUDE (IdProyecto, NombreRol);
GO

CREATE TABLE dbo.TemasProyecto (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_TemasProyecto PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    Titulo NVARCHAR(255) NOT NULL,
    IdCreador UNIQUEIDENTIFIER NULL,
    Estado VARCHAR(30) NOT NULL CONSTRAINT DF_TemasProyecto_Estado DEFAULT 'ABIERTO',
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_TemasProyecto_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Tema_Proyecto
        FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Tema_Creador
        FOREIGN KEY (IdCreador) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_TemasProyecto_IdCreador
    ON dbo.TemasProyecto(IdCreador, Estado)
    INCLUDE (IdProyecto, Titulo, FechaCreacion);
GO

CREATE TABLE dbo.Reuniones (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Reuniones PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    Titulo NVARCHAR(255) NOT NULL,
    Descripcion NVARCHAR(MAX) NULL,
    FechaReunion DATETIME2 NULL,
    IdCreador UNIQUEIDENTIFIER NULL,
    IdActaArchivo UNIQUEIDENTIFIER NULL,
    Estado VARCHAR(30) NOT NULL CONSTRAINT DF_Reuniones_Estado DEFAULT 'PROGRAMADA',
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Reuniones_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Reunion_Proyecto
        FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Reunion_Creador
        FOREIGN KEY (IdCreador) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_Reuniones_IdCreador
    ON dbo.Reuniones(IdCreador, Estado)
    INCLUDE (IdProyecto, FechaReunion);
GO

CREATE TABLE dbo.AsistentesReunion (
    IdReunion UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    NombreRol NVARCHAR(100) NULL,
    Asistio BIT NOT NULL CONSTRAINT DF_AsistentesReunion_Asistio DEFAULT 0,
    CONSTRAINT PK_AsistentesReunion PRIMARY KEY (IdReunion, IdUsuario),
    CONSTRAINT FK_Asistente_Reunion
        FOREIGN KEY (IdReunion) REFERENCES dbo.Reuniones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Asistente_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_AsistentesReunion_IdUsuario
    ON dbo.AsistentesReunion(IdUsuario)
    INCLUDE (IdReunion, Asistio);
GO

CREATE TABLE dbo.ActasReunion (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ActasReunion PRIMARY KEY DEFAULT NEWID(),
    IdReunion UNIQUEIDENTIFIER NOT NULL,
    IdCreador UNIQUEIDENTIFIER NULL,
    Contenido NVARCHAR(MAX) NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_ActasReunion_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Acta_Reunion
        FOREIGN KEY (IdReunion) REFERENCES dbo.Reuniones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Acta_Creador
        FOREIGN KEY (IdCreador) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_ActasReunion_IdCreador
    ON dbo.ActasReunion(IdCreador)
    INCLUDE (IdReunion);
GO

-- ============================================================
--  3. RECURSOS
-- ============================================================

CREATE TABLE dbo.Carpetas (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Carpetas PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdCarpetaPadre UNIQUEIDENTIFIER NULL,
    IdPropietario UNIQUEIDENTIFIER NULL,
    Nombre NVARCHAR(255) NOT NULL,
    HeredaPermisos BIT NOT NULL CONSTRAINT DF_Carpetas_HeredaPermisos DEFAULT 1,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Carpetas_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Carpeta_Proyecto
        FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Carpeta_Padre
        FOREIGN KEY (IdCarpetaPadre) REFERENCES dbo.Carpetas(Id),
    CONSTRAINT FK_Carpeta_Propietario
        FOREIGN KEY (IdPropietario) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_Carpetas_Nombre ON dbo.Carpetas(Nombre);
GO

CREATE INDEX IX_Carpetas_IdPropietario
    ON dbo.Carpetas(IdPropietario)
    INCLUDE (IdProyecto, IdCarpetaPadre);
GO

CREATE TABLE dbo.Archivos (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Archivos PRIMARY KEY DEFAULT NEWID(),
    IdCarpeta UNIQUEIDENTIFIER NULL,
    IdProyecto UNIQUEIDENTIFIER NULL,
    IdPropietario UNIQUEIDENTIFIER NULL,
    Nombre NVARCHAR(255) NOT NULL,
    Extension VARCHAR(20) NULL,
    TipoMime VARCHAR(100) NULL,
    IdVersionActual UNIQUEIDENTIFIER NULL,
    Tamano BIGINT NULL,
    StorageProvider VARCHAR(10) NOT NULL CONSTRAINT DF_Archivos_StorageProvider DEFAULT 'local',
    StorageKey NVARCHAR(1000) NULL,
    S3Bucket NVARCHAR(200) NULL,
    S3ETag VARCHAR(256) NULL,
    S3VersionId VARCHAR(256) NULL,
    ChecksumSHA256 VARCHAR(64) NULL,
    HeredaPermisos BIT NOT NULL CONSTRAINT DF_Archivos_HeredaPermisos DEFAULT 1,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Archivos_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Archivo_Carpeta
        FOREIGN KEY (IdCarpeta) REFERENCES dbo.Carpetas(Id),
    CONSTRAINT FK_Archivo_Proyecto
        FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id),
    CONSTRAINT FK_Archivo_Propietario
        FOREIGN KEY (IdPropietario) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_Archivos_Nombre ON dbo.Archivos(Nombre);
GO

CREATE INDEX IX_Archivos_IdPropietario
    ON dbo.Archivos(IdPropietario)
    INCLUDE (IdProyecto, IdCarpeta, Extension);
GO

CREATE INDEX IX_Archivos_IdProyecto_IdCarpeta
    ON dbo.Archivos(IdProyecto, IdCarpeta);
GO

CREATE TABLE dbo.VersionesArchivo (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_VersionesArchivo PRIMARY KEY DEFAULT NEWID(),
    IdArchivo UNIQUEIDENTIFIER NOT NULL,
    NumeroVersion INT NOT NULL,
    BucketS3 NVARCHAR(200) NULL,
    ClaveS3 NVARCHAR(MAX) NULL,
    Hash VARCHAR(256) NULL,
    IdCargador UNIQUEIDENTIFIER NULL,
    Comentario NVARCHAR(MAX) NULL,
    Tamano BIGINT NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_VersionesArchivo_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_Version_Archivo
        FOREIGN KEY (IdArchivo) REFERENCES dbo.Archivos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Version_Cargador
        FOREIGN KEY (IdCargador) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT UQ_VersionArchivo UNIQUE (IdArchivo, NumeroVersion)
);
GO

CREATE INDEX IX_VersionesArchivo_IdArchivo ON dbo.VersionesArchivo(IdArchivo);
GO

CREATE INDEX IX_VersionesArchivo_IdCargador
    ON dbo.VersionesArchivo(IdCargador)
    INCLUDE (IdArchivo, NumeroVersion);
GO

CREATE TABLE dbo.RecursosExternos (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_RecursosExternos PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdCarpeta UNIQUEIDENTIFIER NULL,
    Titulo NVARCHAR(255) NULL,
    Url NVARCHAR(MAX) NOT NULL,
    Tipo VARCHAR(50) NULL,
    IdCreador UNIQUEIDENTIFIER NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_RecursosExternos_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_Externo_Proyecto
        FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Externo_Carpeta
        FOREIGN KEY (IdCarpeta) REFERENCES dbo.Carpetas(Id),
    CONSTRAINT FK_Externo_Creador
        FOREIGN KEY (IdCreador) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_RecursosExternos_IdCreador
    ON dbo.RecursosExternos(IdCreador)
    INCLUDE (IdProyecto, IdCarpeta);
GO

CREATE TABLE dbo.ComentariosArchivos (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ComentariosArchivos PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdArchivo UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    Contenido NVARCHAR(2000) NOT NULL,
    FechaCreacion DATETIMEOFFSET(7) NOT NULL CONSTRAINT DF_ComentariosArchivos_FechaCreacion DEFAULT SYSDATETIMEOFFSET(),
    Estado NVARCHAR(20) NOT NULL CONSTRAINT DF_ComentariosArchivos_Estado DEFAULT N'ACTIVO',
    CONSTRAINT FK_ComentarioArchivo_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ComentarioArchivo_Proyecto
        FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id),
    CONSTRAINT FK_ComentarioArchivo_Archivo
        FOREIGN KEY (IdArchivo) REFERENCES dbo.Archivos(Id),
    CONSTRAINT FK_ComentarioArchivo_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_ComentariosArchivos_IdProyecto ON dbo.ComentariosArchivos(IdProyecto);
GO

CREATE INDEX IX_ComentariosArchivos_IdArchivo ON dbo.ComentariosArchivos(IdArchivo);
GO

CREATE INDEX IX_ComentariosArchivos_IdUsuario
    ON dbo.ComentariosArchivos(IdUsuario, Estado)
    INCLUDE (IdProyecto, IdArchivo, FechaCreacion);
GO

-- ============================================================
--  4. ACCESO Y COMPARTICION
-- ============================================================

CREATE TABLE dbo.PermisosRecurso (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PermisosRecurso PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NULL,
    IdRol UNIQUEIDENTIFIER NULL,
    PuedeVer BIT NOT NULL CONSTRAINT DF_PermisosRecurso_PuedeVer DEFAULT 0,
    PuedeDescargar BIT NOT NULL CONSTRAINT DF_PermisosRecurso_PuedeDescargar DEFAULT 0,
    PuedeComentar BIT NOT NULL CONSTRAINT DF_PermisosRecurso_PuedeComentar DEFAULT 0,
    PuedeEditar BIT NOT NULL CONSTRAINT DF_PermisosRecurso_PuedeEditar DEFAULT 0,
    PuedeCompartir BIT NOT NULL CONSTRAINT DF_PermisosRecurso_PuedeCompartir DEFAULT 0,
    PuedeAdministrar BIT NOT NULL CONSTRAINT DF_PermisosRecurso_PuedeAdministrar DEFAULT 0,
    FechaCreacion DATETIME NOT NULL CONSTRAINT DF_PermisosRecurso_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME NULL,
    IdConcedidoPor UNIQUEIDENTIFIER NULL,
    CONSTRAINT FK_PermisoRecurso_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PermisoRecurso_Rol
        FOREIGN KEY (IdRol) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_PermisoRecurso_ConcedidoPor
        FOREIGN KEY (IdConcedidoPor) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_PermisosRecurso_Resource
    ON dbo.PermisosRecurso(IdRecurso, TipoRecurso, IdUsuario, IdRol)
    INCLUDE (PuedeVer, PuedeDescargar, PuedeComentar, PuedeEditar, PuedeCompartir, PuedeAdministrar);
GO

CREATE UNIQUE NONCLUSTERED INDEX UQ_PermisosRecurso_Grantee_User
    ON dbo.PermisosRecurso(TipoRecurso, IdRecurso, IdUsuario)
    WHERE IdUsuario IS NOT NULL;
GO

CREATE UNIQUE NONCLUSTERED INDEX UQ_PermisosRecurso_Grantee_Rol
    ON dbo.PermisosRecurso(TipoRecurso, IdRecurso, IdRol)
    WHERE IdRol IS NOT NULL;
GO

CREATE TABLE dbo.Compartidos (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Compartidos PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdComparte UNIQUEIDENTIFIER NOT NULL,
    IdUsuarioDestino UNIQUEIDENTIFIER NULL,
    TokenAcceso VARCHAR(128) NULL,
    Contrasena VARCHAR(256) NULL,
    FechaVencimiento DATETIME2 NULL,
    Visitas INT NOT NULL CONSTRAINT DF_Compartidos_Visitas DEFAULT 0,
    FechaComparticion DATETIME2 NOT NULL CONSTRAINT DF_Compartidos_FechaComparticion DEFAULT GETDATE(),
    CONSTRAINT FK_Compartido_Comparte
        FOREIGN KEY (IdComparte) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT FK_Compartido_Destino
        FOREIGN KEY (IdUsuarioDestino) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE UNIQUE INDEX IX_Compartidos_TokenAcceso
ON dbo.Compartidos(TokenAcceso)
WHERE TokenAcceso IS NOT NULL;
GO

CREATE INDEX IX_Compartidos_IdComparte
    ON dbo.Compartidos(IdComparte)
    INCLUDE (TipoRecurso, IdRecurso, FechaComparticion);
GO

CREATE INDEX IX_Compartidos_IdUsuarioDestino
    ON dbo.Compartidos(IdUsuarioDestino)
    INCLUDE (TipoRecurso, IdRecurso, FechaComparticion)
    WHERE IdUsuarioDestino IS NOT NULL;
GO

CREATE TABLE dbo.SolicitudesAcceso (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SolicitudesAcceso PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdSolicitante UNIQUEIDENTIFIER NOT NULL,
    IdPropietario UNIQUEIDENTIFIER NULL,
    Mensaje NVARCHAR(MAX) NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_SolicitudesAcceso_Estado DEFAULT 'PENDIENTE',
    FechaResolucion DATETIME2 NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_SolicitudesAcceso_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_Solicitud_Solicitante
        FOREIGN KEY (IdSolicitante) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Solicitud_Propietario
        FOREIGN KEY (IdPropietario) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT CK_SolicitudesAcceso_Estado
        CHECK (Estado IN ('PENDIENTE','APROBADA','RECHAZADA','CANCELADA','EXPIRADA'))
);
GO

CREATE INDEX IX_SolicitudesAcceso_IdSolicitante
    ON dbo.SolicitudesAcceso(IdSolicitante, Estado)
    INCLUDE (IdRecurso, TipoRecurso);
GO

CREATE INDEX IX_SolicitudesAcceso_IdPropietario
    ON dbo.SolicitudesAcceso(IdPropietario, Estado)
    INCLUDE (IdSolicitante, IdRecurso, TipoRecurso);
GO

-- ============================================================
--  5. CONOCIMIENTO Y COLABORACION
-- ============================================================

CREATE TABLE dbo.Comentarios (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Comentarios PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdComentarioPadre UNIQUEIDENTIFIER NULL,
    Contenido NVARCHAR(MAX) NOT NULL,
    Resuelto BIT NOT NULL CONSTRAINT DF_Comentarios_Resuelto DEFAULT 0,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Comentarios_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    CONSTRAINT FK_Comentario_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Comentario_Padre
        FOREIGN KEY (IdComentarioPadre) REFERENCES dbo.Comentarios(Id)
);
GO

CREATE INDEX IX_Comentarios_IdRecurso ON dbo.Comentarios(IdRecurso);
GO

CREATE INDEX IX_Comentarios_IdUsuario
    ON dbo.Comentarios(IdUsuario, Resuelto)
    INCLUDE (IdRecurso, TipoRecurso);
GO

CREATE TABLE dbo.Menciones (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Menciones PRIMARY KEY DEFAULT NEWID(),
    IdComentario UNIQUEIDENTIFIER NOT NULL,
    TipoMencion VARCHAR(20) NOT NULL,
    IdMencion UNIQUEIDENTIFIER NOT NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Menciones_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_Mencion_Comentario
        FOREIGN KEY (IdComentario) REFERENCES dbo.Comentarios(Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_Menciones_IdMencion ON dbo.Menciones(IdMencion);
GO

CREATE TABLE dbo.Revisiones (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Revisiones PRIMARY KEY DEFAULT NEWID(),
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL CONSTRAINT DF_Revisiones_TipoRecurso DEFAULT 'ARCHIVO',
    IdSolicitante UNIQUEIDENTIFIER NOT NULL,
    IdRevisor UNIQUEIDENTIFIER NOT NULL,
    Estado VARCHAR(30) NOT NULL CONSTRAINT DF_Revisiones_Estado DEFAULT 'BORRADOR',
    Comentarios NVARCHAR(MAX) NULL,
    FechaLimite DATETIME2 NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Revisiones_FechaCreacion DEFAULT GETDATE(),
    FechaActualizacion DATETIME2 NULL,
    FechaResolucion DATETIME2 NULL,
    CONSTRAINT FK_Revision_Solicitante
        FOREIGN KEY (IdSolicitante) REFERENCES dbo.Usuarios(Id),
    CONSTRAINT FK_Revision_Revisor
        FOREIGN KEY (IdRevisor) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_Revisiones_IdSolicitante
    ON dbo.Revisiones(IdSolicitante, Estado)
    INCLUDE (IdRecurso, TipoRecurso);
GO

CREATE INDEX IX_Revisiones_IdRevisor
    ON dbo.Revisiones(IdRevisor, Estado)
    INCLUDE (IdSolicitante, IdRecurso, TipoRecurso);
GO

CREATE TABLE dbo.Notificaciones (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Notificaciones PRIMARY KEY DEFAULT NEWID(),
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    Tipo VARCHAR(50) NULL,
    Titulo NVARCHAR(255) NULL,
    Mensaje NVARCHAR(MAX) NULL,
    TipoRecursoRelacionado VARCHAR(20) NULL,
    IdRecursoRelacionado UNIQUEIDENTIFIER NULL,
    Leido BIT NOT NULL CONSTRAINT DF_Notificaciones_Leido DEFAULT 0,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Notificaciones_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_Notificacion_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_Notificaciones_IdUsuario
    ON dbo.Notificaciones(IdUsuario, Leido, FechaCreacion DESC);
GO

CREATE TABLE dbo.Etiquetas (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Etiquetas PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    Color VARCHAR(20) NULL,
    CONSTRAINT FK_Etiqueta_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_Etiquetas_Organizacion_Nombre
        UNIQUE (IdOrganizacion, Nombre)
);
GO

CREATE TABLE dbo.EtiquetasRecurso (
    IdEtiqueta UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_EtiquetasRecurso PRIMARY KEY (IdEtiqueta, TipoRecurso, IdRecurso),
    CONSTRAINT FK_EtiquetasRecurso_Etiqueta
        FOREIGN KEY (IdEtiqueta) REFERENCES dbo.Etiquetas(Id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Favoritos (
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Favoritos_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT PK_Favoritos PRIMARY KEY (IdUsuario, IdOrganizacion, TipoRecurso, IdRecurso),
    CONSTRAINT FK_Favorito_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Favorito_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_Favoritos_Usuario_Org
    ON dbo.Favoritos (IdUsuario, IdOrganizacion)
    INCLUDE (TipoRecurso, IdRecurso, FechaCreacion);
GO

CREATE NONCLUSTERED INDEX IX_Favoritos_Recurso
    ON dbo.Favoritos (TipoRecurso, IdRecurso)
    INCLUDE (IdUsuario, IdOrganizacion, FechaCreacion);
GO

-- ============================================================
--  6. TRAZABILIDAD
-- ============================================================

CREATE TABLE dbo.Auditoria (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Auditoria PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NULL,
    IdUsuario UNIQUEIDENTIFIER NULL,
    Accion VARCHAR(100) NOT NULL,
    TipoRecurso VARCHAR(50) NULL,
    IdRecurso UNIQUEIDENTIFIER NULL,
    Ip VARCHAR(50) NULL,
    AgenteUsuario NVARCHAR(500) NULL,
    Metadatos NVARCHAR(MAX) NULL,
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Auditoria_FechaCreacion DEFAULT GETDATE(),
    CONSTRAINT FK_Auditoria_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id),
    CONSTRAINT FK_Auditoria_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id)
);
GO

CREATE INDEX IX_Auditoria_IdOrganizacion_IdUsuario
    ON dbo.Auditoria(IdOrganizacion, IdUsuario, FechaCreacion DESC)
    INCLUDE (Accion, TipoRecurso, IdRecurso);
GO

CREATE INDEX IX_Auditoria_FechaCreacion ON dbo.Auditoria(FechaCreacion DESC);
GO

CREATE INDEX IX_Auditoria_Accion ON dbo.Auditoria(Accion);
GO

CREATE INDEX IX_Auditoria_TipoRecurso_IdRecurso ON dbo.Auditoria(TipoRecurso, IdRecurso);
GO

CREATE TABLE dbo.ActividadReciente (
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL,
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    IdProyecto UNIQUEIDENTIFIER NULL,
    NombreRecurso NVARCHAR(255) NULL,
    FechaAcceso DATETIME2 NOT NULL CONSTRAINT DF_ActividadReciente_FechaAcceso DEFAULT GETDATE(),
    CONSTRAINT PK_ActividadReciente PRIMARY KEY (IdUsuario, TipoRecurso, IdRecurso),
    CONSTRAINT FK_ActividadReciente_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ActividadReciente_Organizacion
        FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id)
);
GO

CREATE INDEX IX_ActividadReciente_IdUsuario_Fecha
    ON dbo.ActividadReciente(IdUsuario, FechaAcceso DESC)
    INCLUDE (IdRecurso, TipoRecurso, NombreRecurso, IdProyecto);
GO

CREATE INDEX IX_ActividadReciente_IdProyecto
    ON dbo.ActividadReciente(IdProyecto)
    INCLUDE (IdUsuario, IdRecurso, TipoRecurso)
    WHERE IdProyecto IS NOT NULL;
GO

CREATE TABLE dbo.SolicitudesPendientes (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SolicitudesPendientes PRIMARY KEY DEFAULT NEWID(),
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdRol UNIQUEIDENTIFIER NULL,
    TipoSolicitud VARCHAR(30) NOT NULL,
    TokenConfirmacion VARCHAR(128) NULL,
    FechaExpiracion DATETIME2 NULL,
    Estado VARCHAR(20) NOT NULL CONSTRAINT DF_SolicitudesPendientes_Estado DEFAULT 'PENDIENTE',
    FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_SolicitudesPendientes_FechaCreacion DEFAULT GETDATE(),
    Metadatos NVARCHAR(MAX) NULL,
    CONSTRAINT FK_SolicitudesPendientes_Usuario
        FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_SolicitudesPendientes_Rol
        FOREIGN KEY (IdRol) REFERENCES dbo.Roles(Id),
    CONSTRAINT CK_SolicitudesPendientes_Tipo
        CHECK (TipoSolicitud IN ('INVITACION_ORG','INVITACION_PROYECTO','REINICIO_CLAVE','CAMBIO_CORREO','VALIDACION_CORREO')),
    CONSTRAINT CK_SolicitudesPendientes_Estado
        CHECK (Estado IN ('PENDIENTE','CONFIRMADA','EXPIRADA','CANCELADA'))
);
GO

CREATE UNIQUE INDEX IX_SolicitudesPendientes_Token
    ON dbo.SolicitudesPendientes(TokenConfirmacion)
    WHERE TokenConfirmacion IS NOT NULL;
GO

CREATE INDEX IX_SolicitudesPendientes_IdUsuario_Estado
    ON dbo.SolicitudesPendientes(IdUsuario, Estado, TipoSolicitud, FechaExpiracion);
GO

-- ============================================================
--  7. DATOS SEMILLA
-- ============================================================

DECLARE @IdOrganizacion UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @IdAdminUser    UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @IdMiembroUser  UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555555';
DECLARE @IdCarlosUser   UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666666';
DECLARE @IdAsdUser      UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777777';
DECLARE @IdRolAdmin     UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @IdRolMiembro   UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';
DECLARE @AdminHash      NVARCHAR(MAX)    = '$2b$12$fCw23xYn/zfWd65VR6BzU.LbyRGyDtzHqQcl.B3RxgJXr0VNlJIx.';
DECLARE @MiembroHash    NVARCHAR(MAX)    = '$2b$12$fCw23xYn/zfWd65VR6BzU.LbyRGyDtzHqQcl.B3RxgJXr0VNlJIx.';

INSERT INTO dbo.Organizaciones (Id, Nombre, NIT, Estado, FechaCreacion)
VALUES (@IdOrganizacion, N'Organización KMS', NULL, 'ACTIVO', GETDATE());

INSERT INTO dbo.Roles (Id, IdOrganizacion, Nombre, Descripcion, EsRolSistema, NivelPrioridad, FechaCreacion)
VALUES
(@IdRolAdmin,   @IdOrganizacion, N'Administrador', N'Acceso total a la organización y sus proyectos', 1, 10, GETDATE()),
(@IdRolMiembro, @IdOrganizacion, N'Miembro',       N'Rol estándar para miembros de la organización',   1, 50, GETDATE());

INSERT INTO dbo.Usuarios (Id, IdOrganizacion, NombreCompleto, Correo, ClaveHash, Telefono, Cargo, Estado, FechaCreacion)
VALUES
(@IdAdminUser,   @IdOrganizacion, N'Administrador KMS', N'admin@kms.local',   @AdminHash,   N'+57 300 0000001', N'Administrador de Plataforma', 'ACTIVO', GETDATE()),
(@IdMiembroUser, @IdOrganizacion, N'Ana María López',   N'ana@kms.local',     @MiembroHash, N'+57 300 0000002', N'Gestora de Proyectos',        'ACTIVO', GETDATE()),
(@IdCarlosUser,  @IdOrganizacion, N'Carlos Pérez',      N'carlos.perez@ejemplo.com', @MiembroHash, N'+57 300 0000003', N'Arquitecto de Soluciones', 'ACTIVO', GETDATE()),
(@IdAsdUser,     @IdOrganizacion, N'Usuario ASD',       N'asd@kms.local',    @MiembroHash, N'+57 300 0000004', N'Colaborador',                 'ACTIVO', GETDATE());

INSERT INTO dbo.RolesUsuario (IdOrganizacion, IdUsuario, IdRol, AsignadoPor)
VALUES
(@IdOrganizacion, @IdAdminUser,   @IdRolAdmin,   NULL),
(@IdOrganizacion, @IdMiembroUser, @IdRolMiembro, @IdAdminUser),
(@IdOrganizacion, @IdCarlosUser,  @IdRolMiembro, @IdAdminUser),
(@IdOrganizacion, @IdAsdUser,     @IdRolMiembro, @IdAdminUser);

-- Catálogo semilla de permisos (cobertura inicial para RBAC por niveles)
INSERT INTO dbo.Permisos (Codigo, Descripcion, Nivel, Categoria)
VALUES
('org.ver',                      N'Ver la organizacion',                                         'ORGANIZACION', N'Organizacion'),
('org.editar',                   N'Editar datos basicos de la organizacion',                      'ORGANIZACION', N'Organizacion'),
('usuarios.ver',                 N'Ver usuarios de la organizacion',                              'ORGANIZACION', N'Usuarios'),
('usuarios.crear',               N'Crear usuarios dentro de la organizacion',                     'ORGANIZACION', N'Usuarios'),
('usuarios.editar',              N'Editar usuarios (nombre, cargo, estado, roles)',               'ORGANIZACION', N'Usuarios'),
('usuarios.eliminar',            N'Deshabilitar o eliminar usuarios de la organizacion',          'ORGANIZACION', N'Usuarios'),
('roles.ver',                    N'Ver roles y permisos asignados',                               'ORGANIZACION', N'Roles'),
('roles.asignar',                N'Asignar/quitar roles a un usuario',                            'ORGANIZACION', N'Roles'),
('roles.crear',                  N'Crear roles personalizados de organizacion',                   'ORGANIZACION', N'Roles'),
('proyectos.ver',                N'Ver listado de proyectos',                                     'PROYECTO',     N'Proyectos'),
('proyectos.crear',              N'Crear proyectos nuevos',                                       'PROYECTO',     N'Proyectos'),
('proyectos.editar',             N'Editar datos basicos del proyecto (nombre, color, descrip)',   'PROYECTO',     N'Proyectos'),
('proyectos.eliminar',           N'Mover proyecto a papelera / eliminar permanentemente',         'PROYECTO',     N'Proyectos'),
('proyectos.miembros.gestionar', N'Invitar/retirar miembros del proyecto y cambiar su rol',      'PROYECTO',     N'Proyectos'),
('archivos.subir',               N'Subir archivos al proyecto',                                   'RECURSO',      N'Archivos'),
('archivos.ver',                 N'Ver y descargar archivos',                                     'RECURSO',      N'Archivos'),
('archivos.editar',              N'Renombrar, mover, versionar, subir nueva version',            'RECURSO',      N'Archivos'),
('archivos.eliminar',            N'Eliminar carpetas y archivos del proyecto',                    'RECURSO',      N'Archivos'),
('archivos.compartir',           N'Compartir recursos con enlaces externos y permisos ACL',       'RECURSO',      N'Archivos'),
('comentarios.crear',            N'Crear comentarios y menciones en archivos y temas',            'RECURSO',      N'Comentarios'),
('comentarios.gestionar',        N'Resolver, editar o eliminar comentarios ajenos',               'RECURSO',      N'Comentarios'),
('favoritos.gestionar',          N'Aniadir o quitar favoritos personales',                        'RECURSO',      N'Favoritos'),
('revisiones.asignar',           N'Asignar revisiones a pares del proyecto',                      'PROYECTO',     N'Revisiones'),
('revisiones.ver',               N'Ver revisiones asignadas y del proyecto',                      'PROYECTO',     N'Revisiones'),
('auditoria.ver',                N'Ver los registros de auditoria de la organizacion',            'SISTEMA',      N'Auditoria'),
('solicitudes.gestionar',        N'Aprobar/rechazar solicitudes de acceso a recursos',             'ORGANIZACION', N'Solicitudes'),
('recursos.permisos.ver',        N'Ver el listado de permisos ACL de un recurso concreto',        'RECURSO',      N'PermisosRecurso'),
('recursos.permisos.editar',     N'Crear, editar y revocar permisos ACL en recursos',             'RECURSO',      N'PermisosRecurso');
GO

-- =============================================================================
--  7.1 ASIGNACIÓN SEMILLA DE PERMISOS A ROLES (RBAC POR CODIGO)
--  Permite que el motor requirePermission(code) funcione inmediatamente
--  después de un reset sin pasos extra.
-- =============================================================================

DECLARE @IdOrganizacion UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @IdRolAdmin     UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @IdRolMiembro   UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';

-- ADMINISTRADOR = TODOS LOS 28 PERMISOS
INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
SELECT @IdRolAdmin, p.Id FROM dbo.Permisos p
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolAdmin AND pr.IdPermiso = p.Id
);

-- MIEMBRO = 10 permisos de la matriz aprobada (incluye ver permisos de recursos)
INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
SELECT @IdRolMiembro, p.Id FROM dbo.Permisos p
WHERE p.Codigo IN (
    'org.ver',
    'proyectos.ver',
    'proyectos.crear',
    'revisiones.ver',
    'archivos.ver',
    'archivos.subir',
    'archivos.editar',
    'comentarios.crear',
    'favoritos.gestionar',
    'recursos.permisos.ver'
)
AND NOT EXISTS (
  SELECT 1 FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolMiembro AND pr.IdPermiso = p.Id
);
GO

DECLARE @IdRolAdmin   UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @IdRolMiembro UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';
SELECT 'Administrador' AS Rol, COUNT(pr.IdPermiso) AS PermisosAsignados
FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolAdmin
UNION ALL
SELECT 'Miembro', COUNT(pr.IdPermiso)
FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolMiembro;
GO

PRINT '==============================================';
PRINT 'KMS recreado correctamente.';
PRINT 'Base de datos: KMS';
PRINT 'VERSION: Unificada v3.1 PRODUCCION (incorpora 002 Mejoras Usuarios + Favoritos + ' +
      'Tablas ActividadReciente / SolicitudesPendientes + RBAC por ' +
      'codigo 28 permisos / PermisosRol / PermisosRecurso 14 cols + IX + UQ XOR)';
PRINT '';
PRINT 'Usuarios semilla (PRODUCCION: CAMBIA SUS PASSWORDS INMEDIATAMENTE):';
PRINT '  1) Administrador  — admin@kms.local          / Admin123456 (Rol: Administrador)  NivelPrioridad 10 = isOrgAdmin';
PRINT '  2) Ana María López — ana@kms.local            / Admin123456 (Rol: Miembro)';
PRINT '  3) Carlos Pérez    — carlos.perez@ejemplo.com / Admin123456 (Rol: Miembro)';
PRINT '  4) Usuario ASD     — asd@kms.local            / Admin123456 (Rol: Miembro)';
PRINT '';
PRINT 'Matriz permisos por rol (seed):';
PRINT '  • Administrador = 28 permisos (catalogo completo) — isOrgAdmin=true';
PRINT '  • Miembro       = 10 permisos (org.ver, proyectos.ver/crear, revisiones.ver,';
PRINT '                                   archivos.ver/subir/editar, comentarios.crear,';
PRINT '                                   favoritos.gestionar, recursos.permisos.ver)';
PRINT '';
PRINT 'NUEVOS ENDPOINTS RBAC DISPONIBLES (HTTP):';
PRINT '  • /api/organizacion (GET org.ver / PATCH org.editar)';
PRINT '  • /api/roles (CRUD roles.ver / roles.crear / roles.asignar permisos)';
PRINT '  • /api/revisiones (revisiones.ver / revisiones.asignar)';
PRINT '  • /api/compartidos (archivos.compartir / public/:token)';
PRINT '  • /api/archivos/:id/comentarios/:cid PATCH/DELETE (comentarios.gestionar)';
PRINT '  • /api/permisos-recurso (CRUD ACL granular por recurso + 3x /:id/permisos en proyectos/carpetas/archivos)';
PRINT '==============================================';
GO

-------------------------------------------------------------------------------
--  POST-RESET PRODUCCION — PASOS OBLIGATORIOS ANTES DE PONER EN PRODUCCION
-------------------------------------------------------------------------------
--  ╔══════════════════════════════════════════════════════════════════════╗
--  ║  EJECUTA TODO ESTE BLOQUE EN PRODUCCION DESPUES DEL MENSAJE DE OK.  ║
--  ║  Las instrucciones marcadas "/* ENABLE IN PROD */" debes DESCOMENTAR║
--  ║  y adaptar con tus credenciales reales (nunca dejar Admin123456).   ║
--  ╚══════════════════════════════════════════════════════════════════════╝

USE KMS;
GO

-- 1) Re-encender estadisticas auto (optimizador de consultas)
ALTER DATABASE KMS SET AUTO_CREATE_STATISTICS ON;
ALTER DATABASE KMS SET AUTO_UPDATE_STATISTICS ON;
ALTER DATABASE KMS SET AUTO_UPDATE_STATISTICS_ASYNC ON;
GO
-- 2) AUTO_SHRINK OFF (nunca en produccion, causa fragmentacion)
ALTER DATABASE KMS SET AUTO_SHRINK OFF;
GO

-- 3) Integridad fisica completa + chequeo checksum de todas las paginas.
DBCC CHECKDB (N'KMS') WITH ALL_ERRORMSGS, EXTENDED_LOGICAL_CHECKS, DATA_PURITY, NO_INFOMSGS;
GO

-- 4) Volver la base a modo MULTI_USER para que el app pool IIS / conexiones entren.
ALTER DATABASE KMS SET MULTI_USER WITH ROLLBACK IMMEDIATE;
GO
PRINT 'Base [KMS] — MULTI_USER. Aplicaciones pueden conectarse.';
GO

-------------------------------------------------------------------------------
--  5) CAMBIAR CONTRASEÑAS SEMILLA (BLOQUE DESCOMENTAR EN PROD)
--     Reemplaza <HASH_BCRYPT_ADMIN_$2b$12$...> por un bcrypt generado desde:
--     backend:  (await bcrypt.hash('TU_PASSWORD_REAL', 12))
--     o via script npm/powershell bcrypt-cli. NUNCA uses Admin123456.
-------------------------------------------------------------------------------
/* ENABLE IN PROD
UPDATE dbo.Usuarios SET
    PasswordHash = '<HASH_BCRYPT_ADMIN_$2b$12$xxxxxx>',
    FechaActualizacion = GETDATE()
WHERE Correo = N'admin@kms.local';

UPDATE dbo.Usuarios SET
    PasswordHash = '<HASH_BCRYPT_ANA>',
    FechaActualizacion = GETDATE()
WHERE Correo = N'ana@kms.local';

UPDATE dbo.Usuarios SET
    PasswordHash = '<HASH_BCRYPT_CARLOS>',
    FechaActualizacion = GETDATE()
WHERE Correo = N'carlos.perez@ejemplo.com';

-- (Opcional) Eliminar los usuarios demo que NO vas a usar en prod:
-- DELETE FROM dbo.Usuarios WHERE Correo IN (N'asd@kms.local', N'carlos.perez@ejemplo.com');
GO
*/

-------------------------------------------------------------------------------
--  6) CREAR LOGIN DE SERVICIO A NIVEL INSTANCIA Y MAPEAR A [KMS]
--     Usa un login de DOMINIO (IIS APPPOOL\KMSAppPool o DOMINIO\svc_kms) o
--     SQL autenticación 'kms_app' con password fuerte en Azure Key Vault.
-------------------------------------------------------------------------------
/* ENABLE IN PROD
USE master;
GO
-- 6a) Si usas SQL Authentication:
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'kms_app')
BEGIN
    CREATE LOGIN [kms_app] WITH PASSWORD = N'<TU_PASSWORD_FUERTE_AQUI>',
         DEFAULT_DATABASE = [KMS],
         DEFAULT_LANGUAGE = [Español],
         CHECK_EXPIRATION = ON,
         CHECK_POLICY   = ON;
END
GO
-- 6b) Mapear login a usuario de BD y asignar roles de servicio (NO db_owner):
USE KMS;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'kms_app')
BEGIN
    CREATE USER [kms_app] FOR LOGIN [kms_app];
END
GO
ALTER ROLE db_datareader ADD MEMBER [kms_app];
ALTER ROLE db_datawriter ADD MEMBER [kms_app];
ALTER ROLE db_ddladmin  ADD MEMBER [kms_app];   -- solo si necesitas ALTER TABLE en deployments futuros (sino quitar)
GO
*/

-------------------------------------------------------------------------------
--  7) BACKUP FULL OBLIGATORIO para habilitar cadena LOG.
--     Agrega tu ruta de backups compartido (ej: \\bkpsrv\sqlbkps\PROD\).
-------------------------------------------------------------------------------
/* ENABLE IN PROD
USE master;
GO
BACKUP DATABASE [KMS]
 TO DISK = N'\\bkpsrv\sqlbkps\PROD\KMS\FULL\KMS_FULL_<YYYYMMDD_HHMM>.bak'
 WITH COMPRESSION, CHECKSUM, FORMAT, MEDIANAME = N'KMS_PROD_FULL',
      DESCRIPTION = N'Reset inicial KMS v3.1 - primer backup FULL post-creacion',
      STATS = 5;
GO
BACKUP LOG [KMS]
 TO DISK = N'\\bkpsrv\sqlbkps\PROD\KMS\LOG\KMS_LOG_<YYYYMMDD_HHMM>.trn'
 WITH COMPRESSION, CHECKSUM, FORMAT, STATS = 5;
GO
*/

PRINT '';
PRINT '================================================================';
PRINT '  POST-RESET PRODUCCION: checklist 7 pasos aplicado (salvo los';
PRINT '  bloques ENABLE IN PROD que debes DESCOMENTAR manualmente).';
PRINT '  Si todo ok:       • dbcc checkdb sin errores';
PRINT '                    • login servicio creado y asignado roles';
PRINT '                    • passwords semilla cambiados';
PRINT '                    • backup FULL hecho + backup LOG 1er tail';
PRINT '  KMS lista para PRODUCCION.';
PRINT '================================================================';
GO
