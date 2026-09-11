-- ====================================================================
--  KMS - Migration 20260907_reuniones_acta_archivo_fk.sql
--  Cierra la relacion implicita Reuniones.IdActaArchivo -> Archivos.Id
--  ON DELETE SET NULL (no borra la reunion al borrar el archivo).
--  Idempotente: seguro ejecutar 2+ veces sobre BDs existentes.
-- ====================================================================
SET NOCOUNT ON;
GO

USE KMS;
GO

/* Paso 1: FK Reuniones.IdActaArchivo -> Archivos.Id ON DELETE SET NULL */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Reunion_ActaArchivo' AND parent_object_id = OBJECT_ID('dbo.Reuniones'))
BEGIN
    ALTER TABLE dbo.Reuniones WITH NOCHECK
    ADD CONSTRAINT FK_Reunion_ActaArchivo
        FOREIGN KEY (IdActaArchivo) REFERENCES dbo.Archivos(Id) ON DELETE SET NULL;
END
GO

/* Paso 2: Indice NONCLUSTERED por la FK para busquedas y joins */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Reuniones_IdActaArchivo' AND object_id = OBJECT_ID('dbo.Reuniones'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Reuniones_IdActaArchivo
        ON dbo.Reuniones(IdActaArchivo)
        INCLUDE (IdProyecto, Titulo, Estado, FechaReunion);
END
GO

PRINT 'MIGRATION OK: 20260907_reuniones_acta_archivo_fk.sql aplicada o ya aplicada.';
GO
