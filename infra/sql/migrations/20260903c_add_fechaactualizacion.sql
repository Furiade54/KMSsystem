-- ============================================================================
--  Patch 20260903c: Añade FechaActualizacion a tablas que la heredaron sin ella
--  en el deployment (Roles, Revisiones, y otras para mantener consistencia)
-- ============================================================================
SET NOCOUNT ON;
GO
USE KMS;
GO

-- 1) Roles.FechaActualizacion
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.name = 'Roles' AND c.name = 'FechaActualizacion'
)
BEGIN
  ALTER TABLE dbo.Roles ADD FechaActualizacion DATETIME2 NULL;
  PRINT 'Roles.FechaActualizacion añadida';
END
ELSE PRINT 'Roles.FechaActualizacion ya existe';
GO

-- 2) Revisiones.FechaActualizacion
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.name = 'Revisiones' AND c.name = 'FechaActualizacion'
)
BEGIN
  ALTER TABLE dbo.Revisiones ADD FechaActualizacion DATETIME2 NULL;
  PRINT 'Revisiones.FechaActualizacion añadida';
END
ELSE PRINT 'Revisiones.FechaActualizacion ya existe';
GO

-- 3) Comentarios.FechaActualizacion (ya que hacemos updateFileCommentById SET FechaActualizacion)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.name = 'Comentarios' AND c.name = 'FechaActualizacion'
)
BEGIN
  ALTER TABLE dbo.Comentarios ADD FechaActualizacion DATETIME2 NULL;
  PRINT 'Comentarios.FechaActualizacion añadida';
END
ELSE PRINT 'Comentarios.FechaActualizacion ya existe';
GO
