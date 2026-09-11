-- ============================================================
-- MIGRATION: TemasProyecto + conceptos/progreso derivado
-- Fecha: 2026-09-08
-- ============================================================

SET NOCOUNT ON;
GO

-- ===== 1/8: SOLO columnas nuevas en TemasProyecto =====
PRINT '=== [1/8] Agregando columnas nuevas a TemasProyecto ==='

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='TemasProyecto' AND COLUMN_NAME='Descripcion')
BEGIN
    ALTER TABLE dbo.TemasProyecto ADD Descripcion NVARCHAR(MAX) NULL;
    PRINT '   + Descripcion NVARCHAR(MAX) NULL';
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='TemasProyecto' AND COLUMN_NAME='Orden')
BEGIN
    ALTER TABLE dbo.TemasProyecto ADD Orden INT NOT NULL
        CONSTRAINT DF_TemasProyecto_Orden DEFAULT 0 WITH VALUES;
    PRINT '   + Orden INT DEFAULT 0';
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='TemasProyecto' AND COLUMN_NAME='Porcentaje')
BEGIN
    ALTER TABLE dbo.TemasProyecto ADD Porcentaje TINYINT NOT NULL
        CONSTRAINT DF_TemasProyecto_Porcentaje DEFAULT 0 WITH VALUES;
    PRINT '   + Porcentaje TINYINT DEFAULT 0';
END
GO

-- ===== 2/8: CHECK constraints e índices sobre columnas NUEVAS =====
PRINT '=== [2/8] CHECKs e índices TemasProyecto ==='

IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.TemasProyecto') AND name='CK_TemasProyecto_Porcentaje')
BEGIN
    ALTER TABLE dbo.TemasProyecto WITH NOCHECK ADD
        CONSTRAINT CK_TemasProyecto_Porcentaje CHECK (Porcentaje BETWEEN 0 AND 100);
    ALTER TABLE dbo.TemasProyecto CHECK CONSTRAINT CK_TemasProyecto_Porcentaje;
    PRINT '   + CK_TemasProyecto_Porcentaje';
END

IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.TemasProyecto') AND name='CK_TemasProyecto_Estado')
BEGIN
    ALTER TABLE dbo.TemasProyecto WITH NOCHECK ADD
        CONSTRAINT CK_TemasProyecto_Estado
        CHECK (Estado IN ('ABIERTO','EN_REVISION','RESUELTO','CERRADO','EN_PROGRESO'));
    ALTER TABLE dbo.TemasProyecto CHECK CONSTRAINT CK_TemasProyecto_Estado;
    PRINT '   + CK_TemasProyecto_Estado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TemasProyecto') AND name='IX_TemasProyecto_IdProyecto_Orden')
BEGIN
    CREATE INDEX IX_TemasProyecto_IdProyecto_Orden
        ON dbo.TemasProyecto(IdProyecto, Orden)
       INCLUDE (Id, Titulo, Estado, Porcentaje);
    PRINT '   + IX_TemasProyecto_IdProyecto_Orden';
END
GO

-- ===== 3/8: Tabla TemasProyectoItems =====
PRINT '=== [3/8] Creando TemasProyectoItems ==='

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='TemasProyectoItems')
BEGIN
    CREATE TABLE dbo.TemasProyectoItems (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_TemasProyectoItems PRIMARY KEY DEFAULT NEWID(),
        IdTema UNIQUEIDENTIFIER NOT NULL,
        Titulo NVARCHAR(255) NOT NULL,
        Descripcion NVARCHAR(MAX) NULL,
        Estado VARCHAR(30) NOT NULL CONSTRAINT DF_TemasProyectoItems_Estado DEFAULT 'PENDIENTE',
        Orden INT NOT NULL CONSTRAINT DF_TemasProyectoItems_Orden DEFAULT 0,
        FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_TemasProyectoItems_FechaCreacion DEFAULT GETDATE(),
        FechaActualizacion DATETIME2 NULL,
        CONSTRAINT CK_TemasProyectoItems_Estado
            CHECK (Estado IN ('PENDIENTE','EN_PROGRESO','COMPLETADO','BLOQUEADO')),
        CONSTRAINT FK_TemaItem_Tema
            FOREIGN KEY (IdTema) REFERENCES dbo.TemasProyecto(Id) ON DELETE CASCADE
    );
    PRINT '   + CREATE TABLE TemasProyectoItems';
END
GO

-- ===== 4/8: Índices TemasProyectoItems =====
PRINT '=== [4/8] Índices TemasProyectoItems ==='

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TemasProyectoItems') AND name='IX_TemasProyectoItems_IdTema_Orden')
BEGIN
    CREATE INDEX IX_TemasProyectoItems_IdTema_Orden
        ON dbo.TemasProyectoItems(IdTema, Orden)
       INCLUDE (Id, Titulo, Estado);
    PRINT '   + IX_TemasProyectoItems_IdTema_Orden';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TemasProyectoItems') AND name='IX_TemasProyectoItems_IdTema_Estado')
BEGIN
    CREATE INDEX IX_TemasProyectoItems_IdTema_Estado
        ON dbo.TemasProyectoItems(IdTema, Estado)
       INCLUDE (Id);
    PRINT '   + IX_TemasProyectoItems_IdTema_Estado';
END
GO

-- ===== 5/8: Tabla TemasProyectoItemMiembros =====
PRINT '=== [5/8] Creando TemasProyectoItemMiembros ==='

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='TemasProyectoItemMiembros')
BEGIN
    CREATE TABLE dbo.TemasProyectoItemMiembros (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_TemasProyectoItemMiembros PRIMARY KEY DEFAULT NEWID(),
        IdTemaItem UNIQUEIDENTIFIER NOT NULL,
        IdMiembroProyecto UNIQUEIDENTIFIER NOT NULL,
        FechaAsignacion DATETIME2 NOT NULL CONSTRAINT DF_TemasProyectoItemMiembros_FechaAsignacion DEFAULT GETDATE(),
        CONSTRAINT UQ_TemasProyectoItemMiembros_Item_Miembro
            UNIQUE (IdTemaItem, IdMiembroProyecto),
        -- NOTA: FKs en ON DELETE NO ACTION porque SQL Server NO acepta multiple cascade paths
        -- Path1: Proyecto -> MiembrosProyecto -> ItemMiembros
        -- Path2: Proyecto -> TemasProyecto -> Items -> ItemMiembros
        -- Cleanup manual en controllers:
        --   a) Borrar ItemMiembros ANTES de borrar MiembroProyecto / Item / Tema / Proyecto
        CONSTRAINT FK_TemaItemMiembro_Item
            FOREIGN KEY (IdTemaItem) REFERENCES dbo.TemasProyectoItems(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_TemaItemMiembro_Miembro
            FOREIGN KEY (IdMiembroProyecto) REFERENCES dbo.MiembrosProyecto(Id) ON DELETE NO ACTION
    );
    PRINT '   + CREATE TABLE TemasProyectoItemMiembros';
END
GO

-- ===== 6/8: Índices TemasProyectoItemMiembros =====
PRINT '=== [6/8] Índices TemasProyectoItemMiembros ==='

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TemasProyectoItemMiembros') AND name='IX_TemasProyectoItemMiembros_IdTemaItem')
BEGIN
    CREATE INDEX IX_TemasProyectoItemMiembros_IdTemaItem
        ON dbo.TemasProyectoItemMiembros(IdTemaItem)
       INCLUDE (IdMiembroProyecto, FechaAsignacion);
    PRINT '   + IX_TemasProyectoItemMiembros_IdTemaItem';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TemasProyectoItemMiembros') AND name='IX_TemasProyectoItemMiembros_IdMiembroProyecto')
BEGIN
    CREATE INDEX IX_TemasProyectoItemMiembros_IdMiembroProyecto
        ON dbo.TemasProyectoItemMiembros(IdMiembroProyecto)
       INCLUDE (IdTemaItem);
    PRINT '   + IX_TemasProyectoItemMiembros_IdMiembroProyecto';
END
GO

-- ===== 7/8: Recalcular Porcentaje TEMA =====
PRINT '=== [7/8] Recalculando Porcentaje inicial por Tema ==='
DECLARE @RowsA INT = 0;

;WITH ItemsPorTema AS (
    SELECT
        t.Id,
        COUNT(i.Id)                                 AS total_items,
        COUNT(CASE WHEN i.Estado = 'COMPLETADO' THEN 1 END)  AS completados
    FROM dbo.TemasProyecto t
    LEFT JOIN dbo.TemasProyectoItems i ON i.IdTema = t.Id
    GROUP BY t.Id
)
UPDATE dbo.TemasProyecto
   SET Porcentaje = CASE WHEN ipt.total_items = 0 THEN 0
                         ELSE CAST(100.0 * ipt.completados / ipt.total_items AS TINYINT) END,
       FechaActualizacion = GETDATE()
  FROM dbo.TemasProyecto t
  JOIN ItemsPorTema ipt ON ipt.Id = t.Id
 WHERE t.Porcentaje <> CASE WHEN ipt.total_items = 0 THEN 0
                            ELSE CAST(100.0 * ipt.completados / ipt.total_items AS TINYINT) END;
SET @RowsA += @@ROWCOUNT;
PRINT '   + Temas actualizados: ' + CAST(@RowsA AS VARCHAR(12));
GO

-- ===== 8/8: Recalcular ProgresoPorcentaje PROYECTO =====
PRINT '=== [8/8] Recalculando ProgresoPorcentaje por PROYECTO ==='
DECLARE @RowsP INT = 0;

;WITH AvgTemas AS (
    SELECT
        p.Id                                                                AS IdProyecto,
        CASE WHEN COUNT(t.Id) = 0 THEN 0
             ELSE CAST(AVG(CAST(t.Porcentaje AS DECIMAL(10,2))) AS TINYINT) END  AS pct
    FROM dbo.Proyectos p
    LEFT JOIN dbo.TemasProyecto t ON t.IdProyecto = p.Id
    GROUP BY p.Id
)
UPDATE dbo.Proyectos
   SET ProgresoPorcentaje = a.pct,
       FechaActualizacion = GETDATE()
  FROM dbo.Proyectos p
  JOIN AvgTemas a ON a.IdProyecto = p.Id
 WHERE p.ProgresoPorcentaje <> a.pct;
SET @RowsP += @@ROWCOUNT;
PRINT '   + Proyectos actualizados: ' + CAST(@RowsP AS VARCHAR(12));
PRINT '';
PRINT '🏁 Migration 20260908_temas_items_progreso FINALIZADA';
GO
