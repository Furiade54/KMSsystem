-- ============================================================================
--  MIGRACION 20260908_versionesarchivo_fk_ck.sql
--  Aplica FK_Archivo_VersionActual (ON DELETE NO ACTION para evitar ciclo
--  MSSQL #1785) + 3 CHECK constraints para tabla VersionesArchivo.
--  Objetivo: alinear schema BD actual con 000_KMS_RESET_TOTAL.sql v3.3
--  Idempotente: SKIPS si los constraints ya existen.
--  Requisitos: VersionesArchivo esta VACIA (0 filas). Archivos.IdVersionActual
--   pueden ser NULL o GUID sin referencia (WITH NOCHECK).
-- ============================================================================

SET NOCOUNT ON;
GO

PRINT '[VersionesArchivo] Aplicando FK_Archivo_VersionActual...';
IF OBJECT_ID('dbo.FK_Archivo_VersionActual', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Archivos WITH NOCHECK
      ADD CONSTRAINT FK_Archivo_VersionActual
          FOREIGN KEY (IdVersionActual)
          REFERENCES dbo.VersionesArchivo(Id)
          ON DELETE NO ACTION
          ON UPDATE NO ACTION;
    PRINT '   -> OK: FK creada (WITH NOCHECK).';
END
ELSE PRINT '   -> SKIP: FK ya existe.';
GO

ALTER TABLE dbo.Archivos WITH NOCHECK CHECK CONSTRAINT FK_Archivo_VersionActual;
GO


PRINT '[VersionesArchivo] Aplicando CK_VerArchivo_NumeroVersionPositivo...';
IF OBJECT_ID('dbo.CK_VerArchivo_NumeroVersionPositivo', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.VersionesArchivo WITH NOCHECK
      ADD CONSTRAINT CK_VerArchivo_NumeroVersionPositivo
          CHECK (NumeroVersion >= 1);
    PRINT '   -> OK: CK NumeroVersion>=1 creada.';
END
ELSE PRINT '   -> SKIP: CK ya existe.';
GO

PRINT '[VersionesArchivo] Aplicando CK_VerArchivo_TamanoNoNegativo...';
IF OBJECT_ID('dbo.CK_VerArchivo_TamanoNoNegativo', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.VersionesArchivo WITH NOCHECK
      ADD CONSTRAINT CK_VerArchivo_TamanoNoNegativo
          CHECK (Tamano IS NULL OR Tamano >= 0);
    PRINT '   -> OK: CK Tamano>=0 creada.';
END
ELSE PRINT '   -> SKIP: CK ya existe.';
GO

PRINT '[VersionesArchivo] Aplicando CK_VerArchivo_Bucket_SiClave...';
IF OBJECT_ID('dbo.CK_VerArchivo_Bucket_SiClave', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.VersionesArchivo WITH NOCHECK
      ADD CONSTRAINT CK_VerArchivo_Bucket_SiClave
          CHECK ((ClaveS3 IS NULL AND BucketS3 IS NULL) OR BucketS3 IS NOT NULL);
    PRINT '   -> OK: CK Bucket+Clave coherentes creada.';
END
ELSE PRINT '   -> SKIP: CK ya existe.';
GO

ALTER TABLE dbo.VersionesArchivo WITH NOCHECK CHECK CONSTRAINT ALL;
GO

PRINT 'Migration 20260908_versionesarchivo_fk_ck.sql finalizada OK.';
GO
