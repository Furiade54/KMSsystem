-- =============================================================================
-- Migration: Módulo Aportes Proyecto (Tablas + Relaciones + Permisos RBAC)
-- Fecha: 2026-09-09
-- Objetivo: Cablear [dbo].[AportesProyecto] y tabla puente con TemasProyecto,
--           alinear con convenciones KMS v3.1 (multi-tenant IdOrganizacion,
--           MSSQL 2014 sin ciclos FK, RBAC por códigos).
-- =============================================================================
SET NOCOUNT ON;
GO

DECLARE @msg NVARCHAR(400);
SET @msg = CONVERT(VARCHAR, GETDATE(), 120) + ' | [Migration Aportes] INICIO';
RAISERROR(@msg, 0, 1) WITH NOWAIT;

-- =============================================================================
-- 1. TABLA PRINCIPAL: dbo.AportesProyecto
-- =============================================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'AportesProyecto'
)
BEGIN
    RAISERROR('>>> CREAR dbo.AportesProyecto', 0, 1) WITH NOWAIT;

    CREATE TABLE dbo.AportesProyecto (
        Id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_AportesProyecto PRIMARY KEY DEFAULT NEWID(),
        IdOrganizacion UNIQUEIDENTIFIER NOT NULL,
        IdProyecto UNIQUEIDENTIFIER NOT NULL,
        IdAutor UNIQUEIDENTIFIER NULL,
        Titulo NVARCHAR(255) NULL,
        Contenido NVARCHAR(MAX) NULL,
        Tipo VARCHAR(30) NOT NULL
            CONSTRAINT DF_Aportes_Tipo DEFAULT 'IDEA',
        UrlExterno NVARCHAR(500) NULL,
        IdCarpeta UNIQUEIDENTIFIER NULL,
        IdArchivoAdjunto UNIQUEIDENTIFIER NULL,
        Estado VARCHAR(30) NOT NULL
            CONSTRAINT DF_Aportes_Estado DEFAULT 'PUBLICADO',
        Importancia VARCHAR(20) NOT NULL
            CONSTRAINT DF_Aportes_Importancia DEFAULT 'NORMAL',
        Orden INT NOT NULL
            CONSTRAINT DF_Aportes_Orden DEFAULT 0,
        MeGustaCount INT NOT NULL
            CONSTRAINT DF_Aportes_MeGusta DEFAULT 0,
        ComentariosCount INT NOT NULL
            CONSTRAINT DF_Aportes_ComentariosCount DEFAULT 0,
        FechaCreacion DATETIME2 NOT NULL
            CONSTRAINT DF_Aportes_FechaCreacion DEFAULT GETDATE(),
        FechaActualizacion DATETIME2 NULL,
        FechaPublicacion DATETIME2 NULL,

        CONSTRAINT FK_Aportes_Organizacion
            FOREIGN KEY (IdOrganizacion) REFERENCES dbo.Organizaciones(Id) ON DELETE NO ACTION,
        -- IMPORTANTE MSSQL 2014: FK_Aportes_Organizacion NO_ACTION para evitar multiple cascade path
        -- (camino1: Organizaciones->Aportes ; camino2: Organizaciones->Proyectos->Aportes)
        CONSTRAINT FK_Aportes_Proyecto
            FOREIGN KEY (IdProyecto) REFERENCES dbo.Proyectos(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Aportes_Autor
            FOREIGN KEY (IdAutor) REFERENCES dbo.Usuarios(Id) ON DELETE NO ACTION,
        -- IMPORTANTE MSSQL 2014: FK_Carpeta / FK_ArchivoAdjunto NO_ACTION para evitar multiple cascade
        -- (Proyectos->Carpetas/Archivos CASCADE + Aportes->Proyectos CASCADE genera SET NULL indirecto prohibido).
        -- El borrado de carpeta/archivo setea IdCarpeta/IdArchivoAdjunto=NULL MANUALMENTE EN EL SERVICIO.
        CONSTRAINT FK_Aportes_Carpeta
            FOREIGN KEY (IdCarpeta) REFERENCES dbo.Carpetas(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_Aportes_ArchivoAdjunto
            FOREIGN KEY (IdArchivoAdjunto) REFERENCES dbo.Archivos(Id) ON DELETE NO ACTION,

        CONSTRAINT CK_Aportes_TituloOContenido
            CHECK (Titulo IS NOT NULL OR Contenido IS NOT NULL),
        CONSTRAINT CK_Aportes_Tipo
            CHECK (Tipo IN ('IDEA','COMENTARIO','ENLACE','ARCHIVO','IMAGEN','ENCUESTA','MENSAJE','OTRO')),
        CONSTRAINT CK_Aportes_Estado
            CHECK (Estado IN ('BORRADOR','PUBLICADO','OCULTO','ELIMINADO','DESTACADO')),
        CONSTRAINT CK_Aportes_Importancia
            CHECK (Importancia IN ('BAJA','NORMAL','ALTA','URGENTE')),
        CONSTRAINT CK_Aportes_UrlSiEnlace
            CHECK (Tipo <> 'ENLACE' OR UrlExterno IS NOT NULL),
        CONSTRAINT CK_Aportes_ArchivoSiTipoArchivo
            CHECK (Tipo <> 'ARCHIVO' OR IdArchivoAdjunto IS NOT NULL OR Contenido IS NOT NULL),
        CONSTRAINT CK_Aportes_MeGustaCountNoNegativo
            CHECK (MeGustaCount >= 0),
        CONSTRAINT CK_Aportes_ComentariosCountNoNegativo
            CHECK (ComentariosCount >= 0)
    );

    -- Indices
    CREATE INDEX IX_Aportes_IdOrganizacion_Estado
        ON dbo.AportesProyecto(IdOrganizacion, Estado)
        INCLUDE (IdProyecto, Tipo, FechaCreacion);

    CREATE INDEX IX_Aportes_IdProyecto_FechaCreacion
        ON dbo.AportesProyecto(IdProyecto, FechaCreacion DESC)
        INCLUDE (IdOrganizacion, IdAutor, Tipo, Estado, Orden);

    CREATE INDEX IX_Aportes_IdAutor
        ON dbo.AportesProyecto(IdAutor, Estado)
        INCLUDE (IdProyecto, Tipo, FechaCreacion);

    CREATE INDEX IX_Aportes_IdCarpeta
        ON dbo.AportesProyecto(IdCarpeta)
        INCLUDE (IdProyecto, Tipo, Estado, Orden);

    CREATE INDEX IX_Aportes_IdArchivoAdjunto
        ON dbo.AportesProyecto(IdArchivoAdjunto)
        INCLUDE (IdProyecto, Estado);

    RAISERROR('>>> CREADA dbo.AportesProyecto OK', 0, 1) WITH NOWAIT;
END
ELSE BEGIN
    RAISERROR('>>> SKIP: dbo.AportesProyecto ya existe', 0, 1) WITH NOWAIT;
END
GO

-- =============================================================================
-- 2. TABLA PUENTE M-N: dbo.AportesTemasVinculados (igual patron RTV)
-- =============================================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'AportesTemasVinculados'
)
BEGIN
    RAISERROR('>>> CREAR dbo.AportesTemasVinculados', 0, 1) WITH NOWAIT;

    CREATE TABLE dbo.AportesTemasVinculados (
        IdAporte            UNIQUEIDENTIFIER NOT NULL,
        IdTema              UNIQUEIDENTIFIER NOT NULL,
        IdUsuarioVinculante UNIQUEIDENTIFIER NULL,
        FechaVinculacion    DATETIME2 NOT NULL
            CONSTRAINT DF_ATV_FechaVinculacion DEFAULT GETDATE(),
        CONSTRAINT PK_AportesTemasVinculados
            PRIMARY KEY CLUSTERED (IdAporte, IdTema),
        CONSTRAINT FK_ATV_Aporte
            FOREIGN KEY (IdAporte) REFERENCES dbo.AportesProyecto(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ATV_Tema
            FOREIGN KEY (IdTema) REFERENCES dbo.TemasProyecto(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_ATV_Vinculante
            FOREIGN KEY (IdUsuarioVinculante) REFERENCES dbo.Usuarios(Id) ON DELETE NO ACTION
    );

    CREATE NONCLUSTERED INDEX IX_ATV_IdTema
        ON dbo.AportesTemasVinculados(IdTema, IdAporte);

    CREATE NONCLUSTERED INDEX IX_ATV_IdUsuarioVinculante
        ON dbo.AportesTemasVinculados(IdUsuarioVinculante, IdAporte, IdTema);

    RAISERROR('>>> CREADA dbo.AportesTemasVinculados OK', 0, 1) WITH NOWAIT;
END
ELSE BEGIN
    RAISERROR('>>> SKIP: dbo.AportesTemasVinculados ya existe', 0, 1) WITH NOWAIT;
END
GO

-- =============================================================================
-- 3. CATÁLOGO PERMISOS RBAC (5 nuevos RECURSO / Categoria Aportes)
-- =============================================================================
RAISERROR('>>> INSERT permisos Aportes (idempotente)', 0, 1) WITH NOWAIT;
INSERT INTO dbo.Permisos (Codigo, Descripcion, Nivel, Categoria)
SELECT src.Codigo, src.Descripcion, src.Nivel, src.Categoria
FROM (VALUES
    ('aportes.crear',      N'Crear aportes e ideas dentro de proyectos colaborativos',                                     'RECURSO', N'Aportes'),
    ('aportes.ver',        N'Ver y leer los aportes y comentarios asociados del proyecto',                                 'RECURSO', N'Aportes'),
    ('aportes.editar',     N'Editar aportes propios (titulo, contenido, tipo, adjuntos, importancia)',                    'RECURSO', N'Aportes'),
    ('aportes.eliminar',   N'Eliminar aportes del proyecto o moverlos a papelera (requiere admin o propietario)',          'RECURSO', N'Aportes'),
    ('aportes.compartir',  N'Compartir aportes con usuarios fuera del proyecto via enlaces externos o ACL',                'RECURSO', N'Aportes')
) src (Codigo, Descripcion, Nivel, Categoria)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Permisos p WHERE p.Codigo = src.Codigo
);
GO

-- =============================================================================
-- 4. ASIGNACIÓN SEMILLA PERMISOS A ROLES (Admin todos / Miembro básicos)
-- =============================================================================
RAISERROR('>>> Asignar PermisosRol Admin (todos los permisos existentes) idempotente', 0, 1) WITH NOWAIT;
DECLARE @IdRolAdmin UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
SELECT @IdRolAdmin, p.Id
FROM dbo.Permisos p
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolAdmin AND pr.IdPermiso = p.Id
);
GO

RAISERROR('>>> Asignar PermisosRol Miembro (13 permisos: 10 originales + 3 aportes básicos) idempotente', 0, 1) WITH NOWAIT;
DECLARE @IdRolMiembro UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';
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
    'recursos.permisos.ver',
    'aportes.ver',
    'aportes.crear',
    'aportes.editar'
)
AND NOT EXISTS (
    SELECT 1 FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolMiembro AND pr.IdPermiso = p.Id
);
GO

-- =============================================================================
-- 5. VALIDACION FINAL (counts)
-- =============================================================================
RAISERROR('================== VALIDACION MIGRACION APORTES ==================', 0, 1) WITH NOWAIT;
DECLARE @cntAportes INT = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AportesProyecto');
DECLARE @cntATV     INT = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AportesTemasVinculados');
DECLARE @cntPermApt INT = (SELECT COUNT(*) FROM dbo.Permisos WHERE Codigo LIKE 'aportes.%');
DECLARE @cntPermRolA INT = (SELECT COUNT(pr.IdPermiso) FROM dbo.PermisosRol pr WHERE pr.IdRol='33333333-3333-3333-3333-333333333333');
DECLARE @cntPermRolM INT = (SELECT COUNT(pr.IdPermiso) FROM dbo.PermisosRol pr WHERE pr.IdRol='44444444-4444-4444-4444-444444444444');
RAISERROR('  Tabla AportesProyecto   : %d (esperado 1)', 0, 1, @cntAportes) WITH NOWAIT;
RAISERROR('  Tabla AportesTemasVinc  : %d (esperado 1)', 0, 1, @cntATV) WITH NOWAIT;
RAISERROR('  Permisos aportes.%      : %d (esperado 5)', 0, 1, @cntPermApt) WITH NOWAIT;
RAISERROR('  PermisosRol ADMIN total : %d (esperado >= 33)', 0, 1, @cntPermRolA) WITH NOWAIT;
RAISERROR('  PermisosRol MIEMBRO tot : %d (esperado 13)', 0, 1, @cntPermRolM) WITH NOWAIT;

SET @msg = CONVERT(VARCHAR, GETDATE(), 120) + ' | [Migration Aportes] FIN OK';
RAISERROR(@msg, 0, 1) WITH NOWAIT;
GO
