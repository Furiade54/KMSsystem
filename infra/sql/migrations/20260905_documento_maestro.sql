-- ====================================================================
--  KMS - Migration 20260905_documento_maestro.sql
--  Añade Documento maestro a Proyectos (IdDocMaestroCarpeta / IdDocMaestroArchivo)
--  Ejecutable 2+ veces (idempotente) sobre BD existentes
-- ====================================================================
SET NOCOUNT ON;
GO

USE KMS;
GO

/* Paso 1: Añadir columnas si no existen */
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Proyectos') AND name = 'IdDocMaestroCarpeta')
BEGIN
    ALTER TABLE dbo.Proyectos ADD IdDocMaestroCarpeta UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Proyectos') AND name = 'IdDocMaestroArchivo')
BEGIN
    ALTER TABLE dbo.Proyectos ADD IdDocMaestroArchivo UNIQUEIDENTIFIER NULL;
END
GO

/* Paso 2: FK Carpetas (NO ACTION en ON DELETE para evitar multiple cascade path, pues Carpetas.IdProyecto ya tiene ON DELETE CASCADE a Proyectos).
   La limpieza al borrar una carpeta designada como MASTER la hacemos manualmente en folders.service.ts / projects.service.ts permanentDelete. */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Proyectos_DocMaestroCarpeta' AND parent_object_id = OBJECT_ID('dbo.Proyectos'))
BEGIN
    ALTER TABLE dbo.Proyectos WITH NOCHECK
    ADD CONSTRAINT FK_Proyectos_DocMaestroCarpeta
        FOREIGN KEY (IdDocMaestroCarpeta) REFERENCES dbo.Carpetas(Id) ON DELETE NO ACTION;
END
GO

/* Paso 3: FK ON DELETE SET NULL Archivos */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Proyectos_DocMaestroArchivo' AND parent_object_id = OBJECT_ID('dbo.Proyectos'))
BEGIN
    ALTER TABLE dbo.Proyectos WITH NOCHECK
    ADD CONSTRAINT FK_Proyectos_DocMaestroArchivo
        FOREIGN KEY (IdDocMaestroArchivo) REFERENCES dbo.Archivos(Id) ON DELETE SET NULL;
END
GO

/* Paso 4: CHECK XOR (máximo 1 de los 2 NOT NULL) */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Proyectos_DocMaestro_Xor' AND parent_object_id = OBJECT_ID('dbo.Proyectos'))
BEGIN
    ALTER TABLE dbo.Proyectos WITH NOCHECK
    ADD CONSTRAINT CK_Proyectos_DocMaestro_Xor
    CHECK (
        CASE WHEN IdDocMaestroCarpeta IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN IdDocMaestroArchivo IS NOT NULL THEN 1 ELSE 0 END <= 1
    );
END
GO

/* Paso 5: Índices NONCLUSTERED por las 2 FK (lectura GET detail + joins) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Proyectos_IdDocMaestroCarpeta' AND object_id = OBJECT_ID('dbo.Proyectos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proyectos_IdDocMaestroCarpeta
        ON dbo.Proyectos(IdDocMaestroCarpeta)
        INCLUDE (IdOrganizacion, Nombre, Estado);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Proyectos_IdDocMaestroArchivo' AND object_id = OBJECT_ID('dbo.Proyectos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Proyectos_IdDocMaestroArchivo
        ON dbo.Proyectos(IdDocMaestroArchivo)
        INCLUDE (IdOrganizacion, Nombre, Estado);
END
GO

PRINT 'MIGRATION OK: 20260905_documento_maestro.sql aplicada o ya aplicada.';
GO
