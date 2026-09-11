# Proyecto: KnowledgeManagementSystem

> Generado desde: `D:\DesarrolloWeb\KnowledgeManagementSystem`

## 📁 Estructura de archivos

```
infra\sql\000_KMS_SETUP_PRODUCCION.sql
PRESCINDIBLES\infra\sql\001_initial_schema.sql
PRESCINDIBLES\infra\sql\002_schema_espanol.sql
PRESCINDIBLES\infra\sql\run-schema.mjs
PRESCINDIBLES\scripts\delete-folder-3-exact.cjs
PRESCINDIBLES\scripts\find-folder-3.cjs
PRESCINDIBLES\scripts\setup-3-hija-de-2.cjs
PRESCINDIBLES\scripts\smoke-e2e-paso12.js
PRESCINDIBLES\scripts\smoke-e2e-paso12.ts
PRESCINDIBLES\scripts\verify-folder3-deleted.cjs
```

## 📄 Contenido de archivos

### infra\sql\000_KMS_SETUP_PRODUCCION.sql

```sql
-- ============================================================================
--  KMS - Knowledge Management System
--  Script Único de Aprovisionamiento para Producción / Nuevos Equipos
--  Versión: 1.0  (esquema en español, idempotente, con datos semilla)
--
--  MODO DE USO EN SSMS:
--    1. Abre este archivo en SQL Server Management Studio
--    2. Selecciona como destino tu instancia MSSQL (servidor + autenticación)
--    3. Pulsa F5 o clic en "Ejecutar"
--    4. El script es SEGURO ante re-ejecuciones:
--         - Crea la BD KMS SÓLO si no existe (NUNCA borra datos)
--         - Crea cada tabla / índice SÓLO si no existe
--         - Inserta datos semilla SÓLO si no hay usuarios registrados
--
--  CREDENCIALES INICIALES (después del primer arranque, CAMBIA la contraseña):
--      Correo:      admin@kms.local
--      Contraseña:  Admin123456
-- ============================================================================

SET NOCOUNT ON;
GO

-- ----------------------------------------------------------------------------
--  0. CREAR BASE DE DATOS (sólo si no existe)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'KMS')
BEGIN
    CREATE DATABASE KMS;
    PRINT '✓ Base de datos [KMS] creada.';
END
ELSE
BEGIN
    PRINT 'ℹ Base de datos [KMS] ya existe. Se omite creación.';
END
GO

USE KMS;
GO

-- ============================================================
--  1. IDENTIDAD Y SEGURIDAD
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Organizaciones')
CREATE TABLE Organizaciones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Nombre NVARCHAR(200) NOT NULL,
    NIT NVARCHAR(50),
    LogoUrl NVARCHAR(MAX),
    Estado VARCHAR(20) DEFAULT 'ACTIVO',
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Usuarios')
CREATE TABLE Usuarios (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    NombreCompleto NVARCHAR(150),
    Correo NVARCHAR(200) NOT NULL,
    ClaveHash NVARCHAR(MAX),
    UrlAvatar NVARCHAR(MAX),
    Estado VARCHAR(20) DEFAULT 'ACTIVO',
    UltimoInicio DATETIME2,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Usuario_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_Correo' AND object_id = OBJECT_ID('Usuarios'))
    CREATE UNIQUE INDEX IX_Usuarios_Correo ON Usuarios(Correo);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Roles')
CREATE TABLE Roles (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER,
    Nombre NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(500),
    EsRolSistema BIT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Rol_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RolesUsuario')
CREATE TABLE RolesUsuario (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdRol UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT FK_RolesUsuario_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RolesUsuario_Rol FOREIGN KEY(IdRol) REFERENCES Roles(Id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Permisos')
CREATE TABLE Permisos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Codigo VARCHAR(100) NOT NULL UNIQUE,
    Descripcion NVARCHAR(200)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PermisosRol')
CREATE TABLE PermisosRol (
    IdRol UNIQUEIDENTIFIER NOT NULL,
    IdPermiso UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY(IdRol, IdPermiso),
    CONSTRAINT FK_PermisosRol_Rol FOREIGN KEY(IdRol) REFERENCES Roles(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PermisosRol_Permiso FOREIGN KEY(IdPermiso) REFERENCES Permisos(Id) ON DELETE CASCADE
);
GO

-- ============================================================
--  2. TRABAJO COLABORATIVO
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Proyectos')
CREATE TABLE Proyectos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(200) NOT NULL,
    Descripcion NVARCHAR(MAX),
    Estado VARCHAR(30) DEFAULT 'ACTIVO',
    IdPropietario UNIQUEIDENTIFIER,
    Color NVARCHAR(30) DEFAULT 'indigo',
    ProgresoPorcentaje TINYINT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Proyecto_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id),
    CONSTRAINT FK_Proyecto_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MiembrosProyecto')
CREATE TABLE MiembrosProyecto (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    NombreRol NVARCHAR(100),
    FechaIngreso DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Miembro_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Miembro_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TemasProyecto')
CREATE TABLE TemasProyecto (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    Titulo NVARCHAR(255) NOT NULL,
    IdCreador UNIQUEIDENTIFIER,
    Estado VARCHAR(30) DEFAULT 'ABIERTO',
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Tema_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Tema_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Reuniones')
CREATE TABLE Reuniones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    Titulo NVARCHAR(255) NOT NULL,
    Descripcion NVARCHAR(MAX),
    FechaReunion DATETIME2,
    IdCreador UNIQUEIDENTIFIER,
    IdActaArchivo UNIQUEIDENTIFIER NULL,
    Estado VARCHAR(30) DEFAULT 'PROGRAMADA',
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Reunion_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Reunion_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AsistentesReunion')
CREATE TABLE AsistentesReunion (
    IdReunion UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    NombreRol NVARCHAR(100) NULL,
    Asistio BIT DEFAULT 0,
    PRIMARY KEY(IdReunion, IdUsuario),
    CONSTRAINT FK_Asistente_Reunion FOREIGN KEY(IdReunion) REFERENCES Reuniones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Asistente_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ActasReunion')
CREATE TABLE ActasReunion (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdReunion UNIQUEIDENTIFIER NOT NULL,
    IdCreador UNIQUEIDENTIFIER,
    Contenido NVARCHAR(MAX),
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Acta_Reunion FOREIGN KEY(IdReunion) REFERENCES Reuniones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Acta_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);
GO

-- ============================================================
--  3. RECURSOS
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Carpetas')
CREATE TABLE Carpetas (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdCarpetaPadre UNIQUEIDENTIFIER NULL,
    IdPropietario UNIQUEIDENTIFIER,
    Nombre NVARCHAR(255) NOT NULL,
    HeredaPermisos BIT DEFAULT 1,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Carpeta_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Carpeta_Padre FOREIGN KEY(IdCarpetaPadre) REFERENCES Carpetas(Id),
    CONSTRAINT FK_Carpeta_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Carpetas_Nombre' AND object_id = OBJECT_ID('Carpetas'))
    CREATE INDEX IX_Carpetas_Nombre ON Carpetas(Nombre);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Archivos')
CREATE TABLE Archivos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdCarpeta UNIQUEIDENTIFIER,
    IdProyecto UNIQUEIDENTIFIER,
    IdPropietario UNIQUEIDENTIFIER,
    Nombre NVARCHAR(255) NOT NULL,
    Extension VARCHAR(20),
    TipoMime VARCHAR(100),
    IdVersionActual UNIQUEIDENTIFIER NULL,
    Tamano BIGINT,
    StorageProvider VARCHAR(10) NOT NULL CONSTRAINT DF_Archivos_StorageProvider DEFAULT 'local',
    StorageKey NVARCHAR(1000),
    S3Bucket NVARCHAR(200),
    S3ETag VARCHAR(256),
    S3VersionId VARCHAR(256),
    ChecksumSHA256 VARCHAR(64),
    HeredaPermisos BIT DEFAULT 1,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Archivo_Carpeta FOREIGN KEY(IdCarpeta) REFERENCES Carpetas(Id),
    CONSTRAINT FK_Archivo_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id),
    CONSTRAINT FK_Archivo_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Archivos_Nombre' AND object_id = OBJECT_ID('Archivos'))
    CREATE INDEX IX_Archivos_Nombre ON Archivos(Nombre);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Archivos_StorageKey' AND object_id = OBJECT_ID('Archivos'))
    CREATE INDEX IX_Archivos_StorageKey ON Archivos(StorageKey);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'VersionesArchivo')
CREATE TABLE VersionesArchivo (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdArchivo UNIQUEIDENTIFIER NOT NULL,
    NumeroVersion INT NOT NULL,
    BucketS3 NVARCHAR(200),
    ClaveS3 NVARCHAR(MAX),
    Hash VARCHAR(256),
    IdCargador UNIQUEIDENTIFIER,
    Comentario NVARCHAR(MAX),
    Tamano BIGINT,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Version_Archivo FOREIGN KEY(IdArchivo) REFERENCES Archivos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Version_Cargador FOREIGN KEY(IdCargador) REFERENCES Usuarios(Id),
    CONSTRAINT UQ_VersionArchivo UNIQUE(IdArchivo, NumeroVersion)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VersionesArchivo_IdArchivo' AND object_id = OBJECT_ID('VersionesArchivo'))
    CREATE INDEX IX_VersionesArchivo_IdArchivo ON VersionesArchivo(IdArchivo);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RecursosExternos')
CREATE TABLE RecursosExternos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdCarpeta UNIQUEIDENTIFIER NULL,
    Titulo NVARCHAR(255),
    Url NVARCHAR(MAX) NOT NULL,
    Tipo VARCHAR(50),
    IdCreador UNIQUEIDENTIFIER,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Externo_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Externo_Carpeta FOREIGN KEY(IdCarpeta) REFERENCES Carpetas(Id),
    CONSTRAINT FK_Externo_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);
GO

-- ============================================================
--  4. ACCESO Y COMPARTICION
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PermisosRecurso')
CREATE TABLE PermisosRecurso (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NULL,
    IdRol UNIQUEIDENTIFIER NULL,
    PuedeVer BIT DEFAULT 0,
    PuedeDescargar BIT DEFAULT 0,
    PuedeComentar BIT DEFAULT 0,
    PuedeEditar BIT DEFAULT 0,
    PuedeCompartir BIT DEFAULT 0,
    PuedeAdministrar BIT DEFAULT 0,
    CONSTRAINT FK_PermisoRecurso_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PermisoRecurso_Rol FOREIGN KEY(IdRol) REFERENCES Roles(Id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Compartidos')
CREATE TABLE Compartidos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdComparte UNIQUEIDENTIFIER NOT NULL,
    IdUsuarioDestino UNIQUEIDENTIFIER NULL,
    TokenAcceso VARCHAR(128) NULL,
    Contrasena VARCHAR(256) NULL,
    FechaVencimiento DATETIME2 NULL,
    Visitas INT NOT NULL CONSTRAINT DF_Compartidos_Visitas DEFAULT 0,
    FechaComparticion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Compartido_Comparte FOREIGN KEY(IdComparte) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Compartido_Destino FOREIGN KEY(IdUsuarioDestino) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Compartidos_TokenAcceso' AND object_id = OBJECT_ID('Compartidos'))
    CREATE UNIQUE INDEX IX_Compartidos_TokenAcceso ON Compartidos(TokenAcceso) WHERE TokenAcceso IS NOT NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SolicitudesAcceso')
CREATE TABLE SolicitudesAcceso (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdSolicitante UNIQUEIDENTIFIER NOT NULL,
    IdPropietario UNIQUEIDENTIFIER,
    Mensaje NVARCHAR(MAX),
    Estado VARCHAR(20) DEFAULT 'PENDIENTE',
    FechaResolucion DATETIME2 NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Solicitud_Solicitante FOREIGN KEY(IdSolicitante) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Solicitud_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);
GO

-- ============================================================
--  5. CONOCIMIENTO Y COLABORACION
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Comentarios')
CREATE TABLE Comentarios (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdComentarioPadre UNIQUEIDENTIFIER NULL,
    Contenido NVARCHAR(MAX) NOT NULL,
    Resuelto BIT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Comentario_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Comentario_Padre FOREIGN KEY(IdComentarioPadre) REFERENCES Comentarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Comentarios_IdRecurso' AND object_id = OBJECT_ID('Comentarios'))
    CREATE INDEX IX_Comentarios_IdRecurso ON Comentarios(IdRecurso);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Menciones')
CREATE TABLE Menciones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdComentario UNIQUEIDENTIFIER NOT NULL,
    TipoMencion VARCHAR(20) NOT NULL,
    IdMencion UNIQUEIDENTIFIER NOT NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Mencion_Comentario FOREIGN KEY(IdComentario) REFERENCES Comentarios(Id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Menciones_IdMencion' AND object_id = OBJECT_ID('Menciones'))
    CREATE INDEX IX_Menciones_IdMencion ON Menciones(IdMencion);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Revisiones')
CREATE TABLE Revisiones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) DEFAULT 'ARCHIVO',
    IdSolicitante UNIQUEIDENTIFIER NOT NULL,
    IdRevisor UNIQUEIDENTIFIER NOT NULL,
    Estado VARCHAR(30) DEFAULT 'BORRADOR',
    Comentarios NVARCHAR(MAX),
    FechaLimite DATETIME2 NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaResolucion DATETIME2 NULL,
    CONSTRAINT FK_Revision_Solicitante FOREIGN KEY(IdSolicitante) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Revision_Revisor FOREIGN KEY(IdRevisor) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Notificaciones')
CREATE TABLE Notificaciones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    Tipo VARCHAR(50),
    Titulo NVARCHAR(255),
    Mensaje NVARCHAR(MAX),
    TipoRecursoRelacionado VARCHAR(20),
    IdRecursoRelacionado UNIQUEIDENTIFIER,
    Leido BIT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Notificacion_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Etiquetas')
CREATE TABLE Etiquetas (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    Color VARCHAR(20),
    CONSTRAINT FK_Etiqueta_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EtiquetasRecurso')
CREATE TABLE EtiquetasRecurso (
    IdEtiqueta UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY(IdEtiqueta, TipoRecurso, IdRecurso),
    CONSTRAINT FK_EtiquetasRecurso_Etiqueta FOREIGN KEY(IdEtiqueta) REFERENCES Etiquetas(Id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Favoritos')
CREATE TABLE Favoritos (
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY(IdUsuario, TipoRecurso, IdRecurso),
    CONSTRAINT FK_Favorito_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE
);
GO

-- ============================================================
--  6. TRAZABILIDAD
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Auditoria')
CREATE TABLE Auditoria (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER,
    IdUsuario UNIQUEIDENTIFIER,
    Accion VARCHAR(100) NOT NULL,
    TipoRecurso VARCHAR(50),
    IdRecurso UNIQUEIDENTIFIER,
    Ip VARCHAR(50),
    AgenteUsuario NVARCHAR(500),
    Metadatos NVARCHAR(MAX),
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Auditoria_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id),
    CONSTRAINT FK_Auditoria_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_FechaCreacion' AND object_id = OBJECT_ID('Auditoria'))
    CREATE INDEX IX_Auditoria_FechaCreacion ON Auditoria(FechaCreacion DESC);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_Accion' AND object_id = OBJECT_ID('Auditoria'))
    CREATE INDEX IX_Auditoria_Accion ON Auditoria(Accion);
GO

-- ============================================================
--  7. DATOS SEMILLA  (sólo si no existen usuarios aún)
-- ============================================================
IF NOT EXISTS (SELECT TOP 1 1 FROM Usuarios)
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdOrganizacion UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
    DECLARE @IdAdminUser    UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
    DECLARE @IdRolAdmin     UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
    DECLARE @IdRolMiembro   UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';
    DECLARE @AdminHash      NVARCHAR(MAX)    = '$2b$12$dQ3nz21TttUZKS4.L6zyT.7RlLw5PsBnfNIntQyfqBvDjZBaKQF3y';

    -- Organización por defecto
    INSERT INTO Organizaciones (Id, Nombre, NIT, Estado, FechaCreacion)
    VALUES (@IdOrganizacion, 'Organización KMS', NULL, 'ACTIVO', GETDATE());
    PRINT '✓ Dato semilla: Organización por defecto creada.';

    -- Rol: Administrador (rol de sistema)
    INSERT INTO Roles (Id, IdOrganizacion, Nombre, Descripcion, EsRolSistema, FechaCreacion)
    VALUES (@IdRolAdmin, @IdOrganizacion, 'Administrador', 'Acceso total a la organización y sus proyectos', 1, GETDATE());
    PRINT '✓ Dato semilla: Rol "Administrador" creado.';

    -- Rol: Miembro
    INSERT INTO Roles (Id, IdOrganizacion, Nombre, Descripcion, EsRolSistema, FechaCreacion)
    VALUES (@IdRolMiembro, @IdOrganizacion, 'Miembro', 'Rol estándar para miembros de la organización', 1, GETDATE());
    PRINT '✓ Dato semilla: Rol "Miembro" creado.';

    -- Usuario Administrador inicial
    INSERT INTO Usuarios (Id, IdOrganizacion, NombreCompleto, Correo, ClaveHash, Estado, FechaCreacion)
    VALUES (@IdAdminUser, @IdOrganizacion, 'Administrador KMS', 'admin@kms.local', @AdminHash, 'ACTIVO', GETDATE());
    PRINT '✓ Dato semilla: Usuario "Administrador KMS" creado.';
    PRINT '    ℹ Correo:     admin@kms.local';
    PRINT '    ℹ Password:   Admin123456';
    PRINT '    ⚠ CAMBIA LA CONTRASEÑA EN EL PRIMER INICIO DE SESIÓN.';

    -- Asignar rol admin al usuario
    INSERT INTO RolesUsuario (IdUsuario, IdRol)
    VALUES (@IdAdminUser, @IdRolAdmin);
    PRINT '✓ Dato semilla: Rol de Administrador asignado a usuario inicial.';

    -- Resumen
    PRINT '';
    PRINT '═══════════════════════════════════════════════════════════════';
    PRINT '  KMS: Script de aprovisionamiento completado.';
    DECLARE @cntTablas INT;
    SELECT @cntTablas = COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0;
    PRINT '  Tablas creadas: ' + LTRIM(STR(@cntTablas));
    PRINT '═══════════════════════════════════════════════════════════════';
END
ELSE
BEGIN
    PRINT '';
    PRINT 'ℹ Ya existen usuarios en la base de datos. Se omiten datos semilla.';
    DECLARE @cntTablasFinal INT;
    SELECT @cntTablasFinal = COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0;
    PRINT '  Tablas detectadas: ' + LTRIM(STR(@cntTablasFinal));
END
GO

```

### PRESCINDIBLES\infra\sql\001_initial_schema.sql

```sql
-- KMS - Knowledge Management System
-- Esquema inicial de base de datos SQL Server
-- Versión: 0.1.0

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'KMS')
BEGIN
    CREATE DATABASE KMS;
END
GO

USE KMS;
GO

-- ============================================================
-- 1. IDENTIDAD Y SEGURIDAD
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Organizations')
CREATE TABLE Organizations (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(200) NOT NULL,
    TaxId NVARCHAR(50),
    LogoUrl NVARCHAR(MAX),
    Status VARCHAR(20) DEFAULT 'ACTIVE',
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
CREATE TABLE Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizationId UNIQUEIDENTIFIER NOT NULL,
    FullName NVARCHAR(150),
    Email NVARCHAR(200) NOT NULL,
    PasswordHash NVARCHAR(MAX),
    AvatarUrl NVARCHAR(MAX),
    Status VARCHAR(20) DEFAULT 'ACTIVE',
    LastLogin DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_User_Organization FOREIGN KEY(OrganizationId) REFERENCES Organizations(Id)
);

CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_Email ON Users(Email);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Roles')
CREATE TABLE Roles (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizationId UNIQUEIDENTIFIER,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    IsSystemRole BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Role_Organization FOREIGN KEY(OrganizationId) REFERENCES Organizations(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserRoles')
CREATE TABLE UserRoles (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT FK_UserRoles_User FOREIGN KEY(UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY(RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Permissions')
CREATE TABLE Permissions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Code VARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(200)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RolePermissions')
CREATE TABLE RolePermissions (
    RoleId UNIQUEIDENTIFIER NOT NULL,
    PermissionId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY(RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY(RoleId) REFERENCES Roles(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY(PermissionId) REFERENCES Permissions(Id) ON DELETE CASCADE
);

-- ============================================================
-- 2. TRABAJO COLABORATIVO
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Projects')
CREATE TABLE Projects (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizationId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    Status VARCHAR(30) DEFAULT 'ACTIVE',
    OwnerId UNIQUEIDENTIFIER,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Project_Organization FOREIGN KEY(OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Project_Owner FOREIGN KEY(OwnerId) REFERENCES Users(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ProjectMembers')
CREATE TABLE ProjectMembers (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProjectId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    RoleName NVARCHAR(100),
    JoinedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_ProjectMember_Project FOREIGN KEY(ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ProjectMember_User FOREIGN KEY(UserId) REFERENCES Users(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ProjectTopics')
CREATE TABLE ProjectTopics (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProjectId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    CreatedBy UNIQUEIDENTIFIER,
    Status VARCHAR(30) DEFAULT 'OPEN',
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Topic_Project FOREIGN KEY(ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Topic_Creator FOREIGN KEY(CreatedBy) REFERENCES Users(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Meetings')
CREATE TABLE Meetings (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProjectId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    MeetingAt DATETIME2,
    CreatedBy UNIQUEIDENTIFIER,
    MinutesFileId UNIQUEIDENTIFIER NULL,
    Status VARCHAR(30) DEFAULT 'SCHEDULED',
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Meeting_Project FOREIGN KEY(ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Meeting_Creator FOREIGN KEY(CreatedBy) REFERENCES Users(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MeetingParticipants')
CREATE TABLE MeetingParticipants (
    MeetingId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    RoleName NVARCHAR(100) NULL,
    Attended BIT DEFAULT 0,
    PRIMARY KEY(MeetingId, UserId),
    CONSTRAINT FK_MeetingParticipant_Meeting FOREIGN KEY(MeetingId) REFERENCES Meetings(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MeetingParticipant_User FOREIGN KEY(UserId) REFERENCES Users(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MeetingMinutes')
CREATE TABLE MeetingMinutes (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    MeetingId UNIQUEIDENTIFIER NOT NULL,
    CreatedBy UNIQUEIDENTIFIER,
    Content NVARCHAR(MAX),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Minutes_Meeting FOREIGN KEY(MeetingId) REFERENCES Meetings(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Minutes_Creator FOREIGN KEY(CreatedBy) REFERENCES Users(Id)
);

-- ============================================================
-- 3. RECURSOS
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Folders')
CREATE TABLE Folders (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProjectId UNIQUEIDENTIFIER NOT NULL,
    ParentFolderId UNIQUEIDENTIFIER NULL,
    OwnerId UNIQUEIDENTIFIER,
    Name NVARCHAR(255) NOT NULL,
    InheritPermissions BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Folder_Project FOREIGN KEY(ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Folder_Parent FOREIGN KEY(ParentFolderId) REFERENCES Folders(Id),
    CONSTRAINT FK_Folder_Owner FOREIGN KEY(OwnerId) REFERENCES Users(Id)
);

CREATE INDEX IF NOT EXISTS IX_Folders_Name ON Folders(Name);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Files')
CREATE TABLE Files (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    FolderId UNIQUEIDENTIFIER,
    ProjectId UNIQUEIDENTIFIER,
    OwnerId UNIQUEIDENTIFIER,
    Name NVARCHAR(255) NOT NULL,
    Extension VARCHAR(20),
    MimeType VARCHAR(100),
    CurrentVersionId UNIQUEIDENTIFIER NULL,
    Size BIGINT,
    InheritPermissions BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_File_Folder FOREIGN KEY(FolderId) REFERENCES Folders(Id),
    CONSTRAINT FK_File_Project FOREIGN KEY(ProjectId) REFERENCES Projects(Id),
    CONSTRAINT FK_File_Owner FOREIGN KEY(OwnerId) REFERENCES Users(Id)
);

CREATE INDEX IF NOT EXISTS IX_Files_Name ON Files(Name);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FileVersions')
CREATE TABLE FileVersions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    FileId UNIQUEIDENTIFIER NOT NULL,
    VersionNumber INT NOT NULL,
    S3Bucket NVARCHAR(200),
    S3Key NVARCHAR(MAX),
    Hash VARCHAR(256),
    UploadedBy UNIQUEIDENTIFIER,
    Comment NVARCHAR(MAX),
    Size BIGINT,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_FileVersion_File FOREIGN KEY(FileId) REFERENCES Files(Id) ON DELETE CASCADE,
    CONSTRAINT FK_FileVersion_Uploader FOREIGN KEY(UploadedBy) REFERENCES Users(Id),
    CONSTRAINT UQ_FileVersion UNIQUE(FileId, VersionNumber)
);

CREATE INDEX IF NOT EXISTS IX_FileVersions_FileId ON FileVersions(FileId);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ExternalResources')
CREATE TABLE ExternalResources (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProjectId UNIQUEIDENTIFIER NOT NULL,
    FolderId UNIQUEIDENTIFIER NULL,
    Title NVARCHAR(255),
    Url NVARCHAR(MAX) NOT NULL,
    Type VARCHAR(50),
    CreatedBy UNIQUEIDENTIFIER,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_External_Project FOREIGN KEY(ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_External_Folder FOREIGN KEY(FolderId) REFERENCES Folders(Id),
    CONSTRAINT FK_External_Creator FOREIGN KEY(CreatedBy) REFERENCES Users(Id)
);

-- ============================================================
-- 4. ACCESO Y COMPARTICION
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ResourcePermissions')
CREATE TABLE ResourcePermissions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ResourceType VARCHAR(20) NOT NULL,
    ResourceId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NULL,
    RoleId UNIQUEIDENTIFIER NULL,
    CanView BIT DEFAULT 0,
    CanDownload BIT DEFAULT 0,
    CanComment BIT DEFAULT 0,
    CanEdit BIT DEFAULT 0,
    CanShare BIT DEFAULT 0,
    CanAdmin BIT DEFAULT 0,
    CONSTRAINT FK_ResourcePermission_User FOREIGN KEY(UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ResourcePermission_Role FOREIGN KEY(RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Shares')
CREATE TABLE Shares (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ResourceType VARCHAR(20) NOT NULL,
    ResourceId UNIQUEIDENTIFIER NOT NULL,
    SharedBy UNIQUEIDENTIFIER NOT NULL,
    SharedWithUser UNIQUEIDENTIFIER NULL,
    ExpiresAt DATETIME2 NULL,
    SharedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Share_SharedBy FOREIGN KEY(SharedBy) REFERENCES Users(Id),
    CONSTRAINT FK_Share_SharedWith FOREIGN KEY(SharedWithUser) REFERENCES Users(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AccessRequests')
CREATE TABLE AccessRequests (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ResourceType VARCHAR(20) NOT NULL,
    ResourceId UNIQUEIDENTIFIER NOT NULL,
    RequestedBy UNIQUEIDENTIFIER NOT NULL,
    OwnerId UNIQUEIDENTIFIER,
    Message NVARCHAR(MAX),
    Status VARCHAR(20) DEFAULT 'PENDING',
    ResolvedAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_AccessRequest_Requester FOREIGN KEY(RequestedBy) REFERENCES Users(Id),
    CONSTRAINT FK_AccessRequest_Owner FOREIGN KEY(OwnerId) REFERENCES Users(Id)
);

-- ============================================================
-- 5. CONOCIMIENTO Y COLABORACIÓN
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Comments')
CREATE TABLE Comments (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ResourceType VARCHAR(20) NOT NULL,
    ResourceId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    ParentCommentId UNIQUEIDENTIFIER NULL,
    Content NVARCHAR(MAX) NOT NULL,
    IsResolved BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Comment_User FOREIGN KEY(UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Comment_Parent FOREIGN KEY(ParentCommentId) REFERENCES Comments(Id)
);

CREATE INDEX IF NOT EXISTS IX_Comments_ResourceId ON Comments(ResourceId);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Mentions')
CREATE TABLE Mentions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CommentId UNIQUEIDENTIFIER NOT NULL,
    MentionType VARCHAR(20) NOT NULL,
    MentionId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Mention_Comment FOREIGN KEY(CommentId) REFERENCES Comments(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_Mentions_MentionId ON Mentions(MentionId);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Reviews')
CREATE TABLE Reviews (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ResourceId UNIQUEIDENTIFIER NOT NULL,
    ResourceType VARCHAR(20) DEFAULT 'FILE',
    RequestedBy UNIQUEIDENTIFIER NOT NULL,
    ReviewerId UNIQUEIDENTIFIER NOT NULL,
    Status VARCHAR(30) DEFAULT 'DRAFT',
    Comments NVARCHAR(MAX),
    Deadline DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    ResolvedAt DATETIME2 NULL,
    CONSTRAINT FK_Review_Requester FOREIGN KEY(RequestedBy) REFERENCES Users(Id),
    CONSTRAINT FK_Review_Reviewer FOREIGN KEY(ReviewerId) REFERENCES Users(Id)
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Notifications')
CREATE TABLE Notifications (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    Type VARCHAR(50),
    Title NVARCHAR(255),
    Message NVARCHAR(MAX),
    RelatedResourceType VARCHAR(20),
    RelatedResourceId UNIQUEIDENTIFIER,
    IsRead BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Notification_User FOREIGN KEY(UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tags')
CREATE TABLE Tags (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizationId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Color VARCHAR(20),
    CONSTRAINT FK_Tag_Organization FOREIGN KEY(OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ResourceTags')
CREATE TABLE ResourceTags (
    TagId UNIQUEIDENTIFIER NOT NULL,
    ResourceType VARCHAR(20) NOT NULL,
    ResourceId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY(TagId, ResourceType, ResourceId),
    CONSTRAINT FK_ResourceTag_Tag FOREIGN KEY(TagId) REFERENCES Tags(Id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Favorites')
CREATE TABLE Favorites (
    UserId UNIQUEIDENTIFIER NOT NULL,
    ResourceType VARCHAR(20) NOT NULL,
    ResourceId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY(UserId, ResourceType, ResourceId),
    CONSTRAINT FK_Favorite_User FOREIGN KEY(UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

-- ============================================================
-- 6. TRAZABILIDAD
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditLogs')
CREATE TABLE AuditLogs (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizationId UNIQUEIDENTIFIER,
    UserId UNIQUEIDENTIFIER,
    Action VARCHAR(100) NOT NULL,
    ResourceType VARCHAR(50),
    ResourceId UNIQUEIDENTIFIER,
    IpAddress VARCHAR(50),
    UserAgent NVARCHAR(500),
    Metadata NVARCHAR(MAX),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Audit_Organization FOREIGN KEY(OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Audit_User FOREIGN KEY(UserId) REFERENCES Users(Id)
);

CREATE INDEX IF NOT EXISTS IX_AuditLogs_CreatedAt ON AuditLogs(CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_AuditLogs_Action ON AuditLogs(Action);

GO

PRINT '✓ Esquema KMS creado correctamente.';

```

### PRESCINDIBLES\infra\sql\002_schema_espanol.sql

```sql
-- KMS - Knowledge Management System
-- Esquema en ESPAÑOL. Compatible con SQL Server 2014 (12.x).
-- IMPORTANTE: Valores de estado también en español.

IF EXISTS (SELECT name FROM sys.databases WHERE name = 'KMS')
BEGIN
    ALTER DATABASE KMS SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE KMS;
END
GO

CREATE DATABASE KMS;
GO

USE KMS;
GO

-- ============================================================
-- 1. IDENTIDAD Y SEGURIDAD
-- ============================================================

CREATE TABLE Organizaciones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Nombre NVARCHAR(200) NOT NULL,
    NIT NVARCHAR(50),
    LogoUrl NVARCHAR(MAX),
    Estado VARCHAR(20) DEFAULT 'ACTIVO',
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2
);

CREATE TABLE Usuarios (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    NombreCompleto NVARCHAR(150),
    Correo NVARCHAR(200) NOT NULL,
    ClaveHash NVARCHAR(MAX),
    UrlAvatar NVARCHAR(MAX),
    Estado VARCHAR(20) DEFAULT 'ACTIVO',
    UltimoInicio DATETIME2,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Usuario_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_Correo' AND object_id = OBJECT_ID('Usuarios'))
    CREATE UNIQUE INDEX IX_Usuarios_Correo ON Usuarios(Correo);

CREATE TABLE Roles (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER,
    Nombre NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(500),
    EsRolSistema BIT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Rol_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id)
);

CREATE TABLE RolesUsuario (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdRol UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT FK_RolesUsuario_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RolesUsuario_Rol FOREIGN KEY(IdRol) REFERENCES Roles(Id) ON DELETE CASCADE
);

CREATE TABLE Permisos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Codigo VARCHAR(100) NOT NULL UNIQUE,
    Descripcion NVARCHAR(200)
);

CREATE TABLE PermisosRol (
    IdRol UNIQUEIDENTIFIER NOT NULL,
    IdPermiso UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY(IdRol, IdPermiso),
    CONSTRAINT FK_PermisosRol_Rol FOREIGN KEY(IdRol) REFERENCES Roles(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PermisosRol_Permiso FOREIGN KEY(IdPermiso) REFERENCES Permisos(Id) ON DELETE CASCADE
);

-- ============================================================
-- 2. TRABAJO COLABORATIVO
-- ============================================================

CREATE TABLE Proyectos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(200) NOT NULL,
    Descripcion NVARCHAR(MAX),
    Estado VARCHAR(30) DEFAULT 'ACTIVO',
    IdPropietario UNIQUEIDENTIFIER,
    Color NVARCHAR(30) DEFAULT 'indigo',
    ProgresoPorcentaje TINYINT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Proyecto_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id),
    CONSTRAINT FK_Proyecto_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);

CREATE TABLE MiembrosProyecto (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    NombreRol NVARCHAR(100),
    FechaIngreso DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Miembro_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Miembro_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id)
);

CREATE TABLE TemasProyecto (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    Titulo NVARCHAR(255) NOT NULL,
    IdCreador UNIQUEIDENTIFIER,
    Estado VARCHAR(30) DEFAULT 'ABIERTO',
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Tema_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Tema_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);

CREATE TABLE Reuniones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    Titulo NVARCHAR(255) NOT NULL,
    Descripcion NVARCHAR(MAX),
    FechaReunion DATETIME2,
    IdCreador UNIQUEIDENTIFIER,
    IdActaArchivo UNIQUEIDENTIFIER NULL,
    Estado VARCHAR(30) DEFAULT 'PROGRAMADA',
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Reunion_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Reunion_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);

CREATE TABLE AsistentesReunion (
    IdReunion UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    NombreRol NVARCHAR(100) NULL,
    Asistio BIT DEFAULT 0,
    PRIMARY KEY(IdReunion, IdUsuario),
    CONSTRAINT FK_Asistente_Reunion FOREIGN KEY(IdReunion) REFERENCES Reuniones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Asistente_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id)
);

CREATE TABLE ActasReunion (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdReunion UNIQUEIDENTIFIER NOT NULL,
    IdCreador UNIQUEIDENTIFIER,
    Contenido NVARCHAR(MAX),
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Acta_Reunion FOREIGN KEY(IdReunion) REFERENCES Reuniones(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Acta_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);

-- ============================================================
-- 3. RECURSOS
-- ============================================================

CREATE TABLE Carpetas (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdCarpetaPadre UNIQUEIDENTIFIER NULL,
    IdPropietario UNIQUEIDENTIFIER,
    Nombre NVARCHAR(255) NOT NULL,
    HeredaPermisos BIT DEFAULT 1,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Carpeta_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Carpeta_Padre FOREIGN KEY(IdCarpetaPadre) REFERENCES Carpetas(Id),
    CONSTRAINT FK_Carpeta_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Carpetas_Nombre' AND object_id = OBJECT_ID('Carpetas'))
    CREATE INDEX IX_Carpetas_Nombre ON Carpetas(Nombre);

CREATE TABLE Archivos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdCarpeta UNIQUEIDENTIFIER,
    IdProyecto UNIQUEIDENTIFIER,
    IdPropietario UNIQUEIDENTIFIER,
    Nombre NVARCHAR(255) NOT NULL,
    Extension VARCHAR(20),
    TipoMime VARCHAR(100),
    IdVersionActual UNIQUEIDENTIFIER NULL,
    Tamano BIGINT,
    StorageProvider VARCHAR(10) NOT NULL CONSTRAINT DF_Archivos_StorageProvider DEFAULT 'local',
    StorageKey NVARCHAR(1000),
    S3Bucket NVARCHAR(200),
    S3ETag VARCHAR(256),
    S3VersionId VARCHAR(256),
    ChecksumSHA256 VARCHAR(64),
    HeredaPermisos BIT DEFAULT 1,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Archivo_Carpeta FOREIGN KEY(IdCarpeta) REFERENCES Carpetas(Id),
    CONSTRAINT FK_Archivo_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id),
    CONSTRAINT FK_Archivo_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Archivos_Nombre' AND object_id = OBJECT_ID('Archivos'))
    CREATE INDEX IX_Archivos_Nombre ON Archivos(Nombre);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Archivos_StorageKey' AND object_id = OBJECT_ID('Archivos'))
    CREATE INDEX IX_Archivos_StorageKey ON Archivos(StorageKey);

CREATE TABLE VersionesArchivo (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdArchivo UNIQUEIDENTIFIER NOT NULL,
    NumeroVersion INT NOT NULL,
    BucketS3 NVARCHAR(200),
    ClaveS3 NVARCHAR(MAX),
    Hash VARCHAR(256),
    IdCargador UNIQUEIDENTIFIER,
    Comentario NVARCHAR(MAX),
    Tamano BIGINT,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Version_Archivo FOREIGN KEY(IdArchivo) REFERENCES Archivos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Version_Cargador FOREIGN KEY(IdCargador) REFERENCES Usuarios(Id),
    CONSTRAINT UQ_VersionArchivo UNIQUE(IdArchivo, NumeroVersion)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VersionesArchivo_IdArchivo' AND object_id = OBJECT_ID('VersionesArchivo'))
    CREATE INDEX IX_VersionesArchivo_IdArchivo ON VersionesArchivo(IdArchivo);

CREATE TABLE RecursosExternos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdProyecto UNIQUEIDENTIFIER NOT NULL,
    IdCarpeta UNIQUEIDENTIFIER NULL,
    Titulo NVARCHAR(255),
    Url NVARCHAR(MAX) NOT NULL,
    Tipo VARCHAR(50),
    IdCreador UNIQUEIDENTIFIER,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Externo_Proyecto FOREIGN KEY(IdProyecto) REFERENCES Proyectos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Externo_Carpeta FOREIGN KEY(IdCarpeta) REFERENCES Carpetas(Id),
    CONSTRAINT FK_Externo_Creador FOREIGN KEY(IdCreador) REFERENCES Usuarios(Id)
);

-- ============================================================
-- 4. ACCESO Y COMPARTICION
-- ============================================================

CREATE TABLE PermisosRecurso (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NULL,
    IdRol UNIQUEIDENTIFIER NULL,
    PuedeVer BIT DEFAULT 0,
    PuedeDescargar BIT DEFAULT 0,
    PuedeComentar BIT DEFAULT 0,
    PuedeEditar BIT DEFAULT 0,
    PuedeCompartir BIT DEFAULT 0,
    PuedeAdministrar BIT DEFAULT 0,
    CONSTRAINT FK_PermisoRecurso_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PermisoRecurso_Rol FOREIGN KEY(IdRol) REFERENCES Roles(Id) ON DELETE CASCADE
);

CREATE TABLE Compartidos (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdComparte UNIQUEIDENTIFIER NOT NULL,
    IdUsuarioDestino UNIQUEIDENTIFIER NULL,
    TokenAcceso VARCHAR(128) NULL,
    Contrasena VARCHAR(256) NULL,
    FechaVencimiento DATETIME2 NULL,
    Visitas INT NOT NULL CONSTRAINT DF_Compartidos_Visitas DEFAULT 0,
    FechaComparticion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Compartido_Comparte FOREIGN KEY(IdComparte) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Compartido_Destino FOREIGN KEY(IdUsuarioDestino) REFERENCES Usuarios(Id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Compartidos_TokenAcceso' AND object_id = OBJECT_ID('Compartidos'))
    CREATE UNIQUE INDEX IX_Compartidos_TokenAcceso ON Compartidos(TokenAcceso) WHERE TokenAcceso IS NOT NULL;

CREATE TABLE SolicitudesAcceso (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdSolicitante UNIQUEIDENTIFIER NOT NULL,
    IdPropietario UNIQUEIDENTIFIER,
    Mensaje NVARCHAR(MAX),
    Estado VARCHAR(20) DEFAULT 'PENDIENTE',
    FechaResolucion DATETIME2 NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Solicitud_Solicitante FOREIGN KEY(IdSolicitante) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Solicitud_Propietario FOREIGN KEY(IdPropietario) REFERENCES Usuarios(Id)
);

-- ============================================================
-- 5. CONOCIMIENTO Y COLABORACION
-- ============================================================

CREATE TABLE Comentarios (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    IdComentarioPadre UNIQUEIDENTIFIER NULL,
    Contenido NVARCHAR(MAX) NOT NULL,
    Resuelto BIT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaActualizacion DATETIME2,
    CONSTRAINT FK_Comentario_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Comentario_Padre FOREIGN KEY(IdComentarioPadre) REFERENCES Comentarios(Id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Comentarios_IdRecurso' AND object_id = OBJECT_ID('Comentarios'))
    CREATE INDEX IX_Comentarios_IdRecurso ON Comentarios(IdRecurso);

CREATE TABLE Menciones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdComentario UNIQUEIDENTIFIER NOT NULL,
    TipoMencion VARCHAR(20) NOT NULL,
    IdMencion UNIQUEIDENTIFIER NOT NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Mencion_Comentario FOREIGN KEY(IdComentario) REFERENCES Comentarios(Id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Menciones_IdMencion' AND object_id = OBJECT_ID('Menciones'))
    CREATE INDEX IX_Menciones_IdMencion ON Menciones(IdMencion);

CREATE TABLE Revisiones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) DEFAULT 'ARCHIVO',
    IdSolicitante UNIQUEIDENTIFIER NOT NULL,
    IdRevisor UNIQUEIDENTIFIER NOT NULL,
    Estado VARCHAR(30) DEFAULT 'BORRADOR',
    Comentarios NVARCHAR(MAX),
    FechaLimite DATETIME2 NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    FechaResolucion DATETIME2 NULL,
    CONSTRAINT FK_Revision_Solicitante FOREIGN KEY(IdSolicitante) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Revision_Revisor FOREIGN KEY(IdRevisor) REFERENCES Usuarios(Id)
);

CREATE TABLE Notificaciones (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    Tipo VARCHAR(50),
    Titulo NVARCHAR(255),
    Mensaje NVARCHAR(MAX),
    TipoRecursoRelacionado VARCHAR(20),
    IdRecursoRelacionado UNIQUEIDENTIFIER,
    Leido BIT DEFAULT 0,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Notificacion_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE
);

CREATE TABLE Etiquetas (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    Color VARCHAR(20),
    CONSTRAINT FK_Etiqueta_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id) ON DELETE CASCADE
);

CREATE TABLE EtiquetasRecurso (
    IdEtiqueta UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY(IdEtiqueta, TipoRecurso, IdRecurso),
    CONSTRAINT FK_EtiquetasRecurso_Etiqueta FOREIGN KEY(IdEtiqueta) REFERENCES Etiquetas(Id) ON DELETE CASCADE
);

CREATE TABLE Favoritos (
    IdUsuario UNIQUEIDENTIFIER NOT NULL,
    TipoRecurso VARCHAR(20) NOT NULL,
    IdRecurso UNIQUEIDENTIFIER NOT NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY(IdUsuario, TipoRecurso, IdRecurso),
    CONSTRAINT FK_Favorito_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id) ON DELETE CASCADE
);

-- ============================================================
-- 6. TRAZABILIDAD
-- ============================================================

CREATE TABLE Auditoria (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    IdOrganizacion UNIQUEIDENTIFIER,
    IdUsuario UNIQUEIDENTIFIER,
    Accion VARCHAR(100) NOT NULL,
    TipoRecurso VARCHAR(50),
    IdRecurso UNIQUEIDENTIFIER,
    Ip VARCHAR(50),
    AgenteUsuario NVARCHAR(500),
    Metadatos NVARCHAR(MAX),
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Auditoria_Organizacion FOREIGN KEY(IdOrganizacion) REFERENCES Organizaciones(Id),
    CONSTRAINT FK_Auditoria_Usuario FOREIGN KEY(IdUsuario) REFERENCES Usuarios(Id)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_FechaCreacion' AND object_id = OBJECT_ID('Auditoria'))
    CREATE INDEX IX_Auditoria_FechaCreacion ON Auditoria(FechaCreacion DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Auditoria_Accion' AND object_id = OBJECT_ID('Auditoria'))
    CREATE INDEX IX_Auditoria_Accion ON Auditoria(Accion);

GO

PRINT '✓ Esquema KMS creado en ESPAÑOL (27 tablas + 8 índices).';

```

### PRESCINDIBLES\infra\sql\run-schema.mjs

```
// run-schema.mjs - Ejecuta 001_initial_schema.sql contra el servidor definido en las variables de entorno del .bat
import process from 'node:process'
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('tls-min-v1')) {
  const prev = process.env.NODE_OPTIONS ?? ''
  process.env.NODE_OPTIONS = (prev + ' --tls-min-v1.0 --tls-max-v1.2').trim()
}
import * as tls from 'node:tls'
try {
  const tlsAny = tls
  if (typeof tlsAny.DEFAULT_MIN_VERSION !== 'undefined') tlsAny.DEFAULT_MIN_VERSION = 'TLSv1'
  if (typeof tlsAny.DEFAULT_MAX_VERSION !== 'undefined') tlsAny.DEFAULT_MAX_VERSION = 'TLSv1.2'
  const orig = tlsAny.createSecureContext
  tlsAny.createSecureContext = function (options) {
    return orig.call(tls, { ...(options ?? {}), minVersion: 'TLSv1', maxVersion: 'TLSv1.2', secureOptions: 0 })
  }
} catch { /* ignore */ }
import * as mssql from 'mssql'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const envPath = path.join(projectRoot, 'backend', '.env')
if (existsSync(envPath)) dotenv.config({ path: envPath })

const server = process.env.SQL_SERVER ?? 'HP2023'
const instanceName = process.env.SQL_INSTANCE_NAME ?? 'IST'
const port = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 1433
const database = process.env.SQL_DATABASE ?? 'master'
const user = process.env.SQL_USER ?? 'pipe'
const password = process.env.SQL_PASSWORD ?? '123456'
const encrypt = process.env.SQL_ENCRYPT ? process.env.SQL_ENCRYPT === 'true' : false
const schemaFile = path.resolve(__dirname, '001_initial_schema.sql')

console.log(`\n═══════════════════════════════════════════════`)
console.log(`KMS - Inicializacion via Node.js + mssql`)
console.log(`   Target: ${server}\\${instanceName}`)
console.log(`   DB    : ${database}`)
console.log(`   User  : ${user}`)
console.log(`   Script: ${schemaFile}`)
console.log(`═══════════════════════════════════════════════\n`)

const cfg = {
  server,
  ...(instanceName ? {} : { port }),
  user,
  password,
  options: {
    encrypt,
    trustServerCertificate: true,
    ...(instanceName ? { instanceName } : {}),
    enableArithAbort: true,
    connectTimeout: 15000,
    requestTimeout: 60000,
    cryptoCredentialsDetails: {
      minVersion: 'TLSv1',
      maxVersion: 'TLSv1.2',
    },
  },
}

if (!existsSync(schemaFile)) {
  console.error(`❌ No existe el script SQL: ${schemaFile}`)
  process.exit(1)
}
const rawScript = readFileSync(schemaFile, 'utf8')
const statements = rawScript
  .split(/\nGO\s*\n/gi)
  .map((s) => s.trim())
  .filter(Boolean)

console.log(`✅ Script parseado: ${statements.length} lotes a ejecutar.`)
console.log()

let pool
try {
  pool = await mssql.connect(cfg)
  console.log(`✅ Conectado al servidor.\n`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt.trim().length) continue
    try {
      await pool.batch(stmt)
      process.stdout.write(`  [${String(i + 1).padStart(2, '0')}/${statements.length}] OK\n`)
    } catch (err) {
      const msg = err.message.split('\n')[0]
      process.stdout.write(`  [${String(i + 1).padStart(2, '0')}/${statements.length}] SKIP: ${msg}\n`)
    }
  }

  console.log(`\n✅ Schema aplicado. Verificando tablas en [${database}]...`)
  try {
    const r = await pool.request().query(`
      SELECT COUNT(*) AS [count] FROM ${database}.sys.tables WHERE name NOT LIKE 'sys%' AND name NOT LIKE 'MS%'
    `)
    const count = Number(r.recordset[0]?.count ?? 0)
    if (count === 0) throw new Error('Tablas no detectadas - tal vez la BD no existe?')
    console.log(`   Tablas detectadas: ${count}\n`)
  } catch (e) {
    console.log(`   (i) No se conto: ${e.message}\n`)
  }

  await pool.close()
  process.exit(0)
} catch (err) {
  console.error(`❌ Error fatal: ${err.message}`)
  try { if (pool) await pool.close() } catch {}
  process.exit(1)
}

```

### PRESCINDIBLES\scripts\delete-folder-3-exact.cjs

```
const http = require('http');
function req({ method = 'GET', path, token = null, body = null }) {
  return new Promise((res, rej) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const r = http.request({ host: 'localhost', port: 51478, path, method, headers }, (resp) => {
      let b = '';
      resp.on('data', (c) => (b += c));
      resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}
(async () => {
  const login = await req({
    method: 'POST',
    path: '/api/auth/login',
    body: JSON.stringify({ email: 'carlos.perez@ejemplo.com', password: 'Demo1234' }),
  });
  const token = JSON.parse(login.body).data.token;
  const folder3Id = '99E55819-9C3B-4ECE-B9DF-C48FA5267335';
  const projectId = '3F06BE5E-5263-4373-B893-C4CE233A6D53';

  const listBefore = await req({ path: '/api/carpetas?projectId=' + projectId + '&includeAll=true&pageSize=100', token });
  const jBefore = JSON.parse(listBefore.body);
  console.log('ANTES total', jBefore.data?.items?.length);
  jBefore.data?.items?.forEach((f) => console.log(' -', f.id, f.name, 'parent=' + (f.parentId ?? 'ROOT')));

  const del = await req({ method: 'DELETE', path: '/api/carpetas/' + folder3Id, token });
  console.log('\nDELETE /api/carpetas/' + folder3Id + ' status =', del.status, del.status === 204 ? '✅ 204 OK' : del.body);

  const listAfter = await req({ path: '/api/carpetas?projectId=' + projectId + '&includeAll=true&pageSize=100', token });
  const jAfter = JSON.parse(listAfter.body);
  console.log('\nDESPUES total', jAfter.data?.items?.length);
  jAfter.data?.items?.forEach((f) => console.log(' -', f.id, f.name, 'parent=' + (f.parentId ?? 'ROOT'), 'childrenCount='+f.childrenCount));
  const f3 = jAfter.data?.items?.find((f) => f.id === folder3Id);
  console.log('\ncarpeta 3 (hija 2) ELIMINADA?', !f3 ? '✅ SÍ (desapareció)' : '❌ NO');
})().catch((e) => console.error(e));

```

### PRESCINDIBLES\scripts\find-folder-3.cjs

```
const http = require('http');
function req({ method = 'GET', path, token = null, body = null }) {
  return new Promise((res, rej) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const r = http.request({ host: 'localhost', port: 51478, path, method, headers }, (resp) => {
      let b = '';
      resp.on('data', (c) => (b += c));
      resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}
(async () => {
  const login = await req({
    method: 'POST',
    path: '/api/auth/login',
    body: JSON.stringify({ email: 'carlos.perez@ejemplo.com', password: 'Demo1234' }),
  });
  const token = JSON.parse(login.body).data.token;
  const projectId = '3F06BE5E-5263-4373-B893-C4CE233A6D53';
  const list = await req({ path: '/api/carpetas?projectId=' + projectId + '&includeAll=true&pageSize=100', token });
  const j = JSON.parse(list.body);
  console.log('total carpetas', j.data?.items?.length);
  j.data?.items?.forEach((f) => console.log(' id=' + f.id, ' name=' + f.name, ' parent=' + (f.parentId ?? 'ROOT'), ' filesCount='+f.filesCount, ' childrenCount='+f.childrenCount));
  const f2 = j.data?.items?.find((f) => f.name === '2' && !f.parentId);
  console.log('\ncarpeta 2 (ROOT) id =', f2.id);
  const f3ChildOf2 = j.data?.items?.find((f) => f.name === '3' && f.parentId === f2.id);
  console.log('CARPETA 3 HIJA DE 2 id =', f3ChildOf2?.id, 'EXISTE?', !!f3ChildOf2);
  const f3Root = j.data?.items?.find((f) => f.name === '3' && !f.parentId);
  console.log('carpeta 3 RAIZ (smoke anterior) id =', f3Root?.id, 'EXISTE?', !!f3Root);
  if (!f3ChildOf2) process.exit(1);
})().catch((e) => console.error(e));

```

### PRESCINDIBLES\scripts\setup-3-hija-de-2.cjs

```
const http = require('http');
function req({ method = 'GET', path, token = null, body = null }) {
  return new Promise((res, rej) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const r = http.request({ host: 'localhost', port: 51478, path, method, headers }, (resp) => {
      let b = '';
      resp.on('data', (c) => (b += c));
      resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}
(async () => {
  const login = await req({
    method: 'POST',
    path: '/api/auth/login',
    body: JSON.stringify({ email: 'carlos.perez@ejemplo.com', password: 'Demo1234' }),
  });
  const token = JSON.parse(login.body).data.token;
  const projectId = '3F06BE5E-5263-4373-B893-C4CE233A6D53';
  // delete the orphan 3 (ROOT) E86F0E32
  const delOrphan = await req({ method: 'DELETE', path: '/api/carpetas/E86F0E32-8896-4B7A-A8C2-CC334FDC14C0', token });
  console.log('DELETE huerfana 3 ROOT', delOrphan.status);
  // crear 3 hija de 2
  const f2Id = 'EC2C5DA6-2363-4F6A-9114-35F6856DAF9B';
  const c3 = await req({
    method: 'POST', path: '/api/carpetas', token,
    body: JSON.stringify({ projectId, parentId: f2Id, name: '3' }),
  });
  console.log('POST 3 hija de 2:', c3.status, JSON.parse(c3.body).data?.folder?.id);

  const list = await req({ path: '/api/carpetas?projectId=' + projectId + '&includeAll=true&pageSize=100', token });
  const j = JSON.parse(list.body);
  j.data?.items?.forEach((f) => console.log(' -', f.id, f.name, 'parent=' + (f.parentId ?? 'ROOT'), 'childrenCount='+f.childrenCount));
})();

```

### PRESCINDIBLES\scripts\smoke-e2e-paso12.js

```javascript
/**
 * SMOKE TEST E2E AUTOMATIZADO — Paso 12 KMS  (Node.js puro, SIN dependencias)
 * Ejecución: `node scripts/smoke-e2e-paso12.js`
 *
 * Flujo completo API sin navegador, emulando al usuario Carlos Pérez:
 *   1. Login (JWT)
 *   2. Listar proyectos
 *   3. Crear proyecto smoke E2E
 *   4. Detalle proyecto
 *   5. Crear carpeta root
 *   6. Subir archivo test.txt multipart
 *   7. Editar proyecto PATCH
 *   8. Borrar archivo 204
 *   9. Soft delete proyecto (papelera) 204
 *  10. Restaurar desde papelera (Fix Paso9, PATCH ACTIVO)
 *  11. Limpieza: mover a papelera (204)
 *  12. Actividad global
 *  13. Miembros organización
 *  14. Mis documentos (mine=true)
 *
 * CRITERIO PASO 12: 0 errores HTTP 401/403/404/500
 */

const BASE = 'http://localhost:51478/api'
const LOGIN = { email: 'carlos.perez@ejemplo.com', password: 'Demo1234' }
const PROJECT_SUFFIX = 'E2E_P12_' + Date.now()

let TOKEN = ''
const ids = { project: '', folder: '', file: '' }
const errores = []

function authHeaders() { return { Authorization: 'Bearer ' + TOKEN } }

function buildFormData(fields, file) {
  const boundary = '----KMS_E2E_P12_' + Date.now()
  const chunks = []
  for (const [k, v] of fields) {
    chunks.push(Buffer.from('--' + boundary + '\r\n'))
    chunks.push(Buffer.from('Content-Disposition: form-data; name="' + k + '"\r\n\r\n'))
    chunks.push(Buffer.from(String(v)))
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from('--' + boundary + '\r\n'))
  chunks.push(Buffer.from(
    'Content-Disposition: form-data; name="' + file.field + '"; filename="' + file.name + '"\r\n' +
    'Content-Type: ' + file.mime + '\r\n\r\n'
  ))
  chunks.push(file.content)
  chunks.push(Buffer.from('\r\n--' + boundary + '--\r\n'))
  const body = Buffer.concat(chunks)
  return { body, contentType: 'multipart/form-data; boundary=' + boundary }
}

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, { credentials: 'omit', ...init })
  const text = await res.text()
  let data = text
  try {
    if (text.length > 0 && (res.headers.get('content-type') || '').includes('application/json')) {
      data = JSON.parse(text)
    }
  } catch (e) { /* ignore */ }
  return { code: res.status, data, raw: res }
}

async function paso(nombre, fn, codigosOk = [200, 201, 204]) {
  const start = Date.now()
  process.stdout.write('  \u2022 ' + nombre + ' ... ')
  try {
    const res = await fn()
    const ok = codigosOk.includes(res.code)
    const ms = Date.now() - start
    if (!ok) {
      errores.push({ step: nombre, code: res.code, body: res.data })
      process.stdout.write('\u274C  FAIL HTTP ' + res.code + ' (' + ms + 'ms)\n')
      if (res.data != null) {
        console.log('       Body:', JSON.stringify(res.data).slice(0, 400))
      }
      process.exitCode = 1
    } else {
      process.stdout.write('\u2705  OK HTTP ' + res.code + ' (' + ms + 'ms)\n')
    }
    return res.data
  } catch (e) {
    errores.push({ step: nombre, code: 0, body: String(e) })
    process.stdout.write('\u274C  EXCEPTION: ' + e.message + '\n')
    process.exitCode = 1
    return undefined
  }
}

async function main() {
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550')
  console.log('  SMOKE TEST E2E KMS \u2014 Paso 12  ')
  console.log('  Base API : ' + BASE)
  console.log('  Usuario  : ' + LOGIN.email)
  console.log('  Sufijo   : ' + PROJECT_SUFFIX)
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n')

  // 1. Login
  const login = await paso('01. Login (POST /auth/login)', async () => {
    const r = await jsonFetch(BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(LOGIN),
    })
    if (r.code === 200 && r.data && r.data.success && r.data.data && r.data.data.token) {
      TOKEN = r.data.data.token
    }
    return r
  })

  if (!TOKEN) {
    console.log('\n\uD83D\uDEA8 ABORTO: No obtuve JWT. Revisa backend / credenciales.')
    process.exit(1)
  }

  // 2. Listar proyectos
  await paso('02. Listar proyectos (GET /projects?pageSize=20)', async () =>
    jsonFetch(BASE + '/projects?pageSize=20', { headers: authHeaders() })
  )

  // 3. Crear proyecto smoke
  const nombreProyecto = '[PASO12] Proyecto Smoke E2E ' + PROJECT_SUFFIX
  await paso('03. Crear proyecto smoke (POST /projects)', async () => {
    const r = await jsonFetch(BASE + '/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: nombreProyecto, description: 'Smoke test E2E Paso 12', status: 'ACTIVE', color: 'indigo' }),
    })
    if (r.data && r.data.data && r.data.data.project && r.data.data.project.id) {
      ids.project = String(r.data.data.project.id)
    }
    return r
  }, [200, 201])

  if (!ids.project) {
    console.log('\uD83D\uDEA8  No obtuve projectId. Salto flujo dependiente.')
  } else {
    // 4. Detalle proyecto
    await paso('04. Detalle proyecto (GET /projects/:id)', async () =>
      jsonFetch(BASE + '/projects/' + ids.project, { headers: authHeaders() })
    )

    // 5. Crear carpeta
    const nombreCarpeta = '00 Smoke E2E Carpeta ' + PROJECT_SUFFIX
    await paso('05. Crear carpeta root (POST /carpetas)', async () => {
      const r = await jsonFetch(BASE + '/carpetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ projectId: ids.project, parentId: null, name: nombreCarpeta }),
      })
      if (r.data && r.data.data && r.data.data.id) ids.folder = String(r.data.data.id)
      return r
    }, [200, 201])

    // 6. Subir archivo multipart (manual, sin libs)
    const fileContent = Buffer.from(
      'Archivo smoke test Paso 12 KMS\nCreado ' + new Date().toISOString() + '\nUser ' + LOGIN.email + '\nProjectId ' + ids.project + '\n',
      'utf-8'
    )
    const fileName = 'smoke-paso12-' + PROJECT_SUFFIX + '.txt'
    await paso('06. Subir archivo ' + fileName + ' (POST /archivos)', async () => {
      const fields = [['projectId', ids.project]]
      if (ids.folder) fields.push(['folderId', ids.folder])
      const fd = buildFormData(fields, { field: 'file', name: fileName, mime: 'text/plain', content: fileContent })
      const r = await fetch(BASE + '/archivos', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': fd.contentType }, body: fd.body })
      const text = await r.text()
      let data = text
      try { if (text) data = JSON.parse(text) } catch (e) { /* ignore */ }
      if (data && data.data && data.data.id) ids.file = String(data.data.id)
      return { code: r.status, data, raw: r }
    }, [200, 201])

    // 7. Editar proyecto PATCH
    await paso('07. Editar proyecto (PATCH /projects/:id)', async () =>
      jsonFetch(BASE + '/projects/' + ids.project, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: nombreProyecto + ' [E2E EDITADO]', description: 'Descripción modificada por smoke E2E Paso 12' }),
      })
    )

    // 8. Borrar archivo HARD 204
    if (ids.file) {
      await paso('08. Borrar archivo HARD (DELETE /archivos/:id → 204)', async () =>
        jsonFetch(BASE + '/archivos/' + ids.file, { method: 'DELETE', headers: authHeaders() }),
      [204])
    } else {
      console.log('  \u23ED\uFE0F  08. Borrar archivo: SKIP (no tuve fileId)')
    }

    // 9. Soft delete papelera 204
    await paso('09. Soft delete PAPELERA (DELETE /projects/:id → 204)', async () =>
      jsonFetch(BASE + '/projects/' + ids.project, { method: 'DELETE', headers: authHeaders() }),
    [204])

    // 10. Restaurar desde papelera (PATCH ACTIVE → traduce backend → ACTIVO Fix Paso9)
    const restoreOk = await paso('10. Restaurar desde papelera (PATCH status ACTIVE Fix Paso9)', async () =>
      jsonFetch(BASE + '/projects/' + ids.project, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
    )
    const restored = restoreOk && (restoreOk.code === 200)

    // 11. Limpieza: SOLO si el restore fue OK, volvemos a enviar a papelera 204
    if (restored) {
      await paso('11. Limpieza: volver papelera (DELETE 204)', async () =>
        jsonFetch(BASE + '/projects/' + ids.project, { method: 'DELETE', headers: authHeaders() }),
      [204])
    } else {
      console.log('  \u23ED\uFE0F  11. Limpieza: SKIP (no se pudo restaurar, proyecto ya en papelera)')
    }
  }

  // 12. Actividad
  const actividad = await paso('12. Actividad (GET /actividad?pageSize=100)', async () =>
    jsonFetch(BASE + '/actividad?pageSize=100', { headers: authHeaders() })
  )
  if (actividad && actividad.data && typeof actividad.data.total === 'number') {
    console.log('       Total eventos: ' + actividad.data.total)
  }

  // 13. Miembros organización
  const miembros = await paso('13. Miembros organización (GET /auth/organization/members)', async () =>
    jsonFetch(BASE + '/auth/organization/members', { headers: authHeaders() })
  )
  if (miembros && miembros.data && miembros.data.data && Array.isArray(miembros.data.data.items)) {
    console.log('       Miembros organización: ' + miembros.data.data.items.length)
  }

  // 14. Mis documentos
  const misDocs = await paso('14. Mis documentos (GET /archivos?mine=true)', async () =>
    jsonFetch(BASE + '/archivos?mine=true&pageSize=20', { headers: authHeaders() })
  )
  if (misDocs && misDocs.data && misDocs.data.data && typeof misDocs.data.data.total === 'number') {
    console.log('       Archivos propios (owner Carlos): ' + misDocs.data.data.total)
  }

  // Resumen
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550')
  console.log('  RESUMEN PASO 12 \u2014 SMOKE E2E API')
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550')
  if (errores.length === 0) {
    console.log('\u2705  TODOS LOS PASOS OK (0 errores 401/403/404/500)')
    console.log('   ProjectId      : ' + (ids.project || '(n/a)'))
    console.log('   FolderId       : ' + (ids.folder || '(n/a)'))
    console.log('   FileId         : ' + (ids.file || '(n/a)'))
    console.log('\n\uD83C\uDF89  CRITERIO PASO 12 CUMPLIDO: 0 errores HTTP.')
    process.exitCode = 0
  } else {
    console.log('\uD83D\uDEA8  ' + errores.length + ' paso(s) FALLARON:')
    for (const e of errores) {
      console.log('   \u2022 ' + e.step + ' \u2192 ' + e.code)
      console.log('       ' + JSON.stringify(e.body).slice(0, 240))
    }
    console.log('\n\u274C  CRITERIO PASO 12 NO CUMPLIDO.')
    process.exitCode = 1
  }
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n')
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })

```

### PRESCINDIBLES\scripts\smoke-e2e-paso12.ts

```typescript
/**
 * SMOKE TEST E2E AUTOMATIZADO — Paso 12 KMS
 * Ejecución: `npx tsx scripts/smoke-e2e-paso12.ts` o `node --import=tsx scripts/smoke-e2e-paso12.ts`
 *
 * Flujo completo API sin navegador, emulando al usuario Carlos Pérez:
 *   1.  Login (JWT)
 *   2.  GET /api/proyectos (listado inicial)
 *   3.  POST /api/proyectos (crear proyecto smoke E2E)
 *   4.  GET /api/proyectos/:id (detalle + stats)
 *   5.  POST /api/carpetas (crear carpeta dentro proyecto, root)
 *   6.  POST /api/archivos (subir archivo test.txt multipart a la carpeta)
 *   7.  PATCH /api/proyectos/:id (editar nombre proyecto: " [E2E EDITADO]")
 *   8.  DELETE /api/archivos/:id (HTTP 204 No Content)
 *   9.  DELETE /api/proyectos/:id (soft delete papelera, HTTP 204)
 *  10. PATCH /api/proyectos/:id (restaurar desde papelera status ACTIVO, usando fix Paso9)
 *  11. DELETE /api/proyectos/:id (volver a papelera, limpieza)
 *  12. GET /api/actividad?pageSize=100 (últimos eventos debe incluir nuestras acciones)
 *  13. GET /api/auth/organization/members (Paso 11, 5 miembros min)
 *  14. GET /api/archivos?mine=true (Paso 11, Mis documentos)
 *
 * CRITERIOS PASO 12: NINGÚN error HTTP 401 / 403 / 404 / 500 en todo el flujo.
 * Todos los endpoints deben responder con los códigos esperados (200/201/204).
 */

const BASE = 'http://localhost:51478/api'
const LOGIN = { email: 'carlos.perez@ejemplo.com', password: 'Demo1234' }
const PROJECT_SUFFIX = `E2E_P12_${Date.now()}`

let TOKEN = ''
let userId = ''
const ids = { project: '', projectEditado: '', folder: '', file: '' }
const errores: Array<{ step: string; code: number; body: unknown }> = []

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` }
}

async function paso<T extends unknown>(
  nombre: string,
  fn: () => Promise<{ code: number; data: T; raw: Response }>,
  codigosOk: number[] = [200, 201, 204],
): Promise<T> {
  const start = Date.now()
  process.stdout.write(`  • ${nombre} ... `)
  try {
    const res = await fn()
    const ok = codigosOk.includes(res.code)
    const ms = Date.now() - start
    if (!ok) {
      errores.push({ step: nombre, code: res.code, body: res.data })
      console.log(`❌  FAIL HTTP ${res.code} (${ms}ms)`)
      if (res.data != null) {
        console.log('       Body:', JSON.stringify(res.data).slice(0, 400))
      }
      process.exitCode = 1
    } else {
      console.log(`✅  OK HTTP ${res.code} (${ms}ms)`)
    }
    return res.data
  } catch (e) {
    errores.push({ step: nombre, code: 0, body: String(e) })
    console.log(`❌  EXCEPTION: ${(e as Error).message}`)
    process.exitCode = 1
    return undefined as T
  }
}

async function jsonFetch(url: string, init: RequestInit & { expectNoBody?: boolean } = {}): Promise<{ code: number; data: unknown; raw: Response }> {
  const res = await fetch(url, { credentials: 'omit', ...init })
  const text = await res.text()
  let data: unknown = text
  try {
    if (text.length > 0 && res.headers.get('content-type')?.includes('application/json')) {
      data = JSON.parse(text)
    }
  } catch {
    /* ignore */
  }
  return { code: res.status, data, raw: res }
}

function multipartForm(fields: Array<[string, string]>, file: { field: string; name: string; mime: string; content: Buffer }): { body: FormData } {
  const fd = new FormData()
  for (const [k, v] of fields) fd.append(k, v)
  const blob = new Blob([file.content], { type: file.mime })
  fd.append(file.field, blob, file.name)
  return { body: fd }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  SMOKE TEST E2E KMS — Paso 12  ')
  console.log(`  Base API : ${BASE}`)
  console.log(`  Usuario  : ${LOGIN.email}`)
  console.log(`  Sufijo   : ${PROJECT_SUFFIX}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Login
  const loginRes = await paso<{ success: boolean; data: { token: string; user: { Id: string } } }>('01. Login (POST /auth/login)', async () => {
    const r = await jsonFetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(LOGIN),
    })
    const body = r.data as any
    if (r.code === 200 && body?.success && body?.data?.token) {
      TOKEN = body.data.token
      userId = body.data.user?.Id ?? ''
    }
    return r
  })

  if (!TOKEN) {
    console.log('\n🚨 ABORTO: No obtuve JWT. Revisa backend / credenciales.')
    process.exit(1)
  }

  // 2. Listado proyectos
  await paso('02. Listar proyectos (GET /proyectos?pageSize=20)', async () =>
    jsonFetch(`${BASE}/proyectos?pageSize=20`, { headers: authHeaders() })
  )

  // 3. Crear proyecto smoke
  const nombreProyecto = `[PASO12] Proyecto Smoke E2E ${PROJECT_SUFFIX}`
  const createRes = await paso<any>('03. Crear proyecto smoke (POST /proyectos)', async () => {
    const r = await jsonFetch(`${BASE}/proyectos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: nombreProyecto, description: 'Smoke test E2E Paso 12', status: 'ACTIVE', color: 'indigo' }),
    })
    const body = r.data as any
    if (body?.data?.project?.id) ids.project = String(body.data.project.id)
    return r
  }, [200, 201])

  if (!ids.project) {
    console.log('🚨  No obtuve projectId. Aborto flujo dependiente.')
  } else {
    // 4. Detalle proyecto
    await paso('04. Detalle proyecto (GET /proyectos/:id)', async () =>
      jsonFetch(`${BASE}/proyectos/${ids.project}`, { headers: authHeaders() })
    )

    // 5. Crear carpeta root
    const nombreCarpeta = `00 Smoke E2E Carpeta ${PROJECT_SUFFIX}`
    const carpetaRes = await paso<any>('05. Crear carpeta root (POST /carpetas)', async () => {
      const r = await jsonFetch(`${BASE}/carpetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ projectId: ids.project, parentId: null, name: nombreCarpeta }),
      })
      const body = r.data as any
      if (body?.data?.id) ids.folder = String(body.data.id)
      return r
    }, [200, 201])

    // 6. Subir archivo multipart a la carpeta
    const fileContent = Buffer.from(
      `Archivo smoke test Paso 12 KMS\nCreado ${new Date().toISOString()}\nUser ${LOGIN.email}\nProjectId ${ids.project}\n`,
      'utf-8'
    )
    const fileName = `smoke-paso12-${PROJECT_SUFFIX}.txt`
    const uploadRes = await paso<any>(`06. Subir archivo (POST /archivos) ${fileName}`, async () => {
      const fields: Array<[string, string]> = [['projectId', ids.project]]
      if (ids.folder) fields.push(['folderId', ids.folder])
      const { body } = multipartForm(fields, { field: 'file', name: fileName, mime: 'text/plain', content: fileContent })
      const r = await fetch(`${BASE}/archivos`, { method: 'POST', headers: authHeaders(), body })
      const text = await r.text()
      let data: any = text
      try { if (text) data = JSON.parse(text) } catch { /* ignore */ }
      if (data?.data?.id) ids.file = String(data.data.id)
      return { code: r.status, data, raw: r }
    }, [200, 201])

    // 7. Editar proyecto PATCH
    const nombreEditado = nombreProyecto + ' [E2E EDITADO]'
    const editRes = await paso<any>('07. Editar proyecto (PATCH /proyectos/:id)', async () => {
      const r = await jsonFetch(`${BASE}/proyectos/${ids.project}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: nombreEditado, description: 'Descripción modificada por smoke E2E Paso 12' }),
      })
      const body = r.data as any
      if (body?.data?.project?.name) ids.projectEditado = String(body.data.project.name)
      return r
    })

    // 8. Borrar archivo 204
    if (ids.file) {
      await paso('08. Borrar archivo HARD (DELETE /archivos/:id → 204)', async () => {
        const r = await jsonFetch(`${BASE}/archivos/${ids.file}`, { method: 'DELETE', headers: authHeaders() })
        return r
      }, [204])
    } else {
      console.log('  ⏭️  08. Borrar archivo: SKIP (no tuve fileId upload)')
    }

    // 9. Soft delete proyecto papelera 204
    await paso('09. Soft delete proyecto → PAPELERA (DELETE /proyectos/:id → 204)', async () =>
      jsonFetch(`${BASE}/proyectos/${ids.project}`, { method: 'DELETE', headers: authHeaders() }),
    [204])

    // 10. Restaurar desde papelera (PATCH status ACTIVO, usa fix Paso9)
    await paso('10. Restaurar proyecto desde papelera (PATCH status ACTIVO — Fix Paso9)', async () =>
      jsonFetch(`${BASE}/proyectos/${ids.project}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
    )

    // 11. Volver a papelera para limpiar
    await paso('11. Limpieza: mover proyecto a papelera (DELETE 204)', async () =>
      jsonFetch(`${BASE}/proyectos/${ids.project}`, { method: 'DELETE', headers: authHeaders() }),
    [204])
  }

  // 12. Actividad global
  const actividadRes = await paso<any>('12. Listar actividad (GET /actividad?pageSize=100)', async () =>
    jsonFetch(`${BASE}/actividad?pageSize=100`, { headers: authHeaders() })
  )
  if (actividadRes && (actividadRes as any)?.total) {
    console.log(`       Total eventos actividad global : ${(actividadRes as any).total}`)
  }

  // 13. Miembros organización
  const miembrosRes = await paso<any>('13. Miembros organización (GET /auth/organization/members — Paso11)', async () =>
    jsonFetch(`${BASE}/auth/organization/members`, { headers: authHeaders() })
  )
  if (miembrosRes && (miembrosRes as any)?.data?.items?.length) {
    console.log(`       Miembros organización : ${(miembrosRes as any).data.items.length}`)
  }

  // 14. Mis documentos
  const misDocsRes = await paso<any>('14. Mis documentos (GET /archivos?mine=true — Paso11)', async () =>
    jsonFetch(`${BASE}/archivos?mine=true&pageSize=20`, { headers: authHeaders() })
  )
  if (misDocsRes && (misDocsRes as any)?.data?.total != null) {
    console.log(`       Archivos propios (owner Carlos): ${(misDocsRes as any).data.total}`)
  }

  // Resumen
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  RESUMEN PASO 12 — SMOKE E2E API')
  console.log('═══════════════════════════════════════════════════════════════')
  if (errores.length === 0) {
    console.log('✅  TODOS LOS PASOS OK (0 errores 401/403/404/500)')
    console.log(`   ProjectId creado      : ${ids.project || '(n/a)'}`)
    console.log(`   FolderId  creado      : ${ids.folder || '(n/a)'}`)
    console.log(`   FileId    subido      : ${ids.file || '(n/a)'}`)
    console.log(`   Proyecto editado OK   : ${ids.projectEditado ? 'SÍ' : 'no'}`)
    console.log('\n🎉  CRITERIO PASO 12 CUMPLIDO: 0 errores HTTP.')
    process.exitCode = 0
  } else {
    console.log(`🚨  ${errores.length} paso(s) FALLARON:`)
    for (const e of errores) {
      console.log(`   • ${e.step} → ${e.code}`)
      console.log(`       ${JSON.stringify(e.body).slice(0, 240)}`)
    }
    console.log('\n❌  CRITERIO PASO 12 NO CUMPLIDO (hay errores HTTP).')
    process.exitCode = 1
  }
  console.log('═══════════════════════════════════════════════════════════════\n')
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})

```

### PRESCINDIBLES\scripts\verify-folder3-deleted.cjs

```
const http = require('http');
function req({ method = 'GET', path, token = null, body = null }) {
  return new Promise((res, rej) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const r = http.request({ host: 'localhost', port: 51478, path, method, headers }, (resp) => {
      let b = '';
      resp.on('data', (c) => (b += c));
      resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}
(async () => {
  const login = await req({
    method: 'POST',
    path: '/api/auth/login',
    body: JSON.stringify({ email: 'carlos.perez@ejemplo.com', password: 'Demo1234' }),
  });
  const token = JSON.parse(login.body).data.token;
  const projectId = '3F06BE5E-5263-4373-B893-C4CE233A6D53';
  const list = await req({ path: '/api/carpetas?projectId=' + projectId + '&includeAll=true&pageSize=100', token });
  const j = JSON.parse(list.body);
  console.log('total carpetas proyecto:', j.data?.items?.length ?? 0);
  j.data?.items?.forEach((f) => console.log(' - id=' + f.id, 'name=' + f.name, 'parent=' + (f.parentId ?? 'ROOT'), 'filesCount=' + f.filesCount, 'childrenCount=' + f.childrenCount));
  const folder3ChildOf2 = j.data?.items?.find((f) => f.name === '3' && f.parentId && f.parentId !== 'ROOT' && String(f.parentId).toUpperCase() === 'EC2C5DA6-2363-4F6A-9114-35F6856DAF9B');
  console.log('\ncarpeta 3 (hija de 2) EXISTS?', !!folder3ChildOf2, folder3ChildOf2 ? '❌ NO BORRADA' : '✅ BORRADA (hija)');
  const folder3Root = j.data?.items?.find((f) => f.name === '3' && !f.parentId);
  console.log('carpeta 3 (ROOT huerfana) EXISTS?', !!folder3Root, folder3Root ? 'OK (la dejamos)' : 'borrada por error');
  const folder2 = j.data?.items?.find((f) => f.id === 'EC2C5DA6-2363-4F6A-9114-35F6856DAF9B');
  console.log('carpeta 2 EXISTS?', !!folder2, folder2 ? 'OK (intacta). childrenCount=' + folder2.childrenCount : 'ERROR (borrada por error)');
})();

```
