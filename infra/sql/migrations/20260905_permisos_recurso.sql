-- ============================================================================
--  Migration 20260905: Implementacion completa PermisosRecurso (6-bit ACL)
--  Fecha: 2026-09-05
--  BBDD: KMS (SQL Server 2014)
--  Objetivos:
--    1) Extender tabla dbo.PermisosRecurso con columnas de auditoria faltantes.
--    2) Crear indice compuesto + 2 indices unicos filtrados (grantee XOR).
--    3) Dar alta catalogo Permisos: recursos.permisos.ver y recursos.permisos.editar.
--    4) Asignar ambos al Rol Administrador; solo .ver al Rol Miembro.
--
--  ⚠  ORDEN DE EJECUCION (SOLO si NO usaste 000_KMS_RESET_TOTAL.sql v3.1):
--      1) 20260903_fix_rbac_roles.sql
--      2) 20260903b_patch_permisos_miembro.sql
--      3) 20260903c_add_fechaactualizacion.sql
--      4) ESTE SCRIPT (20260905_permisos_recurso.sql)
--
--  ⚠  SI CORRISTE 000_KMS_RESET_TOTAL.sql v3.1: SALTA ESTA MIGRACION — todos
--     estos cambios ya estan aplicados en el seed del reset (DDL + seed).
--     Para confirmar: si dbo.PermisosRecurso ya tiene columnas
--     FechaCreacion / FechaActualizacion / IdConcedidoPor y existe el
--     indice UQ_PermisosRecurso_Grantee_User, no hay nada que hacer.
--
--  NOTA: Script IDEMPOTENTE — todo con IF NOT EXISTS. Seguro de correr 2+ veces.
-- ============================================================================

SET NOCOUNT ON;
GO
USE KMS;
GO

PRINT '============================================================';
PRINT '  1/5 — Columnas faltantes en dbo.PermisosRecurso';
PRINT '============================================================';
GO

-- 1a) FechaCreacion (NOT NULL con DEFAULT para que rellene filas preexistentes)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.name = 'PermisosRecurso' AND c.name = 'FechaCreacion'
)
BEGIN
  ALTER TABLE dbo.PermisosRecurso
    ADD FechaCreacion DATETIME NOT NULL
      CONSTRAINT DF_PermisosRecurso_FechaCreacion DEFAULT GETDATE();
  PRINT 'OK: PermisosRecurso.FechaCreacion añadida (DEFAULT GETDATE).';
END
ELSE PRINT 'INFO: PermisosRecurso.FechaCreacion ya existe.';
GO

-- 1b) FechaActualizacion (NULLABLE, sin default, se actualiza solo al editar)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.name = 'PermisosRecurso' AND c.name = 'FechaActualizacion'
)
BEGIN
  ALTER TABLE dbo.PermisosRecurso ADD FechaActualizacion DATETIME NULL;
  PRINT 'OK: PermisosRecurso.FechaActualizacion añadida.';
END
ELSE PRINT 'INFO: PermisosRecurso.FechaActualizacion ya existe.';
GO

-- 1c) IdConcedidoPor (usuario que otorga el grant) + FK opcional
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE s.name = 'dbo' AND t.name = 'PermisosRecurso' AND c.name = 'IdConcedidoPor'
)
BEGIN
  ALTER TABLE dbo.PermisosRecurso ADD IdConcedidoPor UNIQUEIDENTIFIER NULL;
  PRINT 'OK: PermisosRecurso.IdConcedidoPor añadida.';
END
ELSE PRINT 'INFO: PermisosRecurso.IdConcedidoPor ya existe.';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys fk
  WHERE fk.parent_object_id = OBJECT_ID('dbo.PermisosRecurso')
    AND fk.name = 'FK_PermisoRecurso_ConcedidoPor'
)
BEGIN
  ALTER TABLE dbo.PermisosRecurso
    ADD CONSTRAINT FK_PermisoRecurso_ConcedidoPor
    FOREIGN KEY (IdConcedidoPor) REFERENCES dbo.Usuarios(Id);
  PRINT 'OK: FK FK_PermisoRecurso_ConcedidoPor creada.';
END
ELSE PRINT 'INFO: FK FK_PermisoRecurso_ConcedidoPor ya existe.';
GO

PRINT '';
PRINT '============================================================';
PRINT '  2/5 — Indice compuesto + 2 indices unicos filtrados (XOR)';
PRINT '============================================================';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID('dbo.PermisosRecurso')
    AND i.name = 'IX_PermisosRecurso_Resource'
)
BEGIN
  CREATE INDEX IX_PermisosRecurso_Resource
    ON dbo.PermisosRecurso(IdRecurso, TipoRecurso, IdUsuario, IdRol)
    INCLUDE (PuedeVer, PuedeDescargar, PuedeComentar, PuedeEditar, PuedeCompartir, PuedeAdministrar);
  PRINT 'OK: IX_PermisosRecurso_Resource creado.';
END
ELSE PRINT 'INFO: IX_PermisosRecurso_Resource ya existe.';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID('dbo.PermisosRecurso')
    AND i.name = 'UQ_PermisosRecurso_Grantee_User'
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_PermisosRecurso_Grantee_User
    ON dbo.PermisosRecurso(TipoRecurso, IdRecurso, IdUsuario)
    WHERE IdUsuario IS NOT NULL;
  PRINT 'OK: UQ_PermisosRecurso_Grantee_User creado.';
END
ELSE PRINT 'INFO: UQ_PermisosRecurso_Grantee_User ya existe.';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID('dbo.PermisosRecurso')
    AND i.name = 'UQ_PermisosRecurso_Grantee_Rol'
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_PermisosRecurso_Grantee_Rol
    ON dbo.PermisosRecurso(TipoRecurso, IdRecurso, IdRol)
    WHERE IdRol IS NOT NULL;
  PRINT 'OK: UQ_PermisosRecurso_Grantee_Rol creado.';
END
ELSE PRINT 'INFO: UQ_PermisosRecurso_Grantee_Rol ya existe.';
GO

PRINT '';
PRINT '============================================================';
PRINT '  3/5 — Alta catalogo Permisos: recursos.permisos.{ver,editar}';
PRINT '============================================================';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'recursos.permisos.ver')
BEGIN
  INSERT INTO dbo.Permisos (Codigo, Descripcion, Nivel, Categoria)
  VALUES ('recursos.permisos.ver', N'Ver el listado de permisos ACL de un recurso concreto', 'RECURSO', N'PermisosRecurso');
  PRINT 'OK: Permiso recursos.permisos.ver dado de alta.';
END
ELSE PRINT 'INFO: recursos.permisos.ver ya estaba registrado.';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Permisos WHERE Codigo = 'recursos.permisos.editar')
BEGIN
  INSERT INTO dbo.Permisos (Codigo, Descripcion, Nivel, Categoria)
  VALUES ('recursos.permisos.editar', N'Crear, editar y revocar permisos ACL en recursos', 'RECURSO', N'PermisosRecurso');
  PRINT 'OK: Permiso recursos.permisos.editar dado de alta.';
END
ELSE PRINT 'INFO: recursos.permisos.editar ya estaba registrado.';
GO

PRINT '';
PRINT '============================================================';
PRINT '  4/5 — Asignacion a Rol Administrador (ambos permisos)';
PRINT '============================================================';
GO

DECLARE @IdOrgA UNIQUEIDENTIFIER;
DECLARE @IdRolAdmin UNIQUEIDENTIFIER;
DECLARE @nA INT = 0;
SELECT TOP 1 @IdOrgA = o.Id FROM dbo.Organizaciones o ORDER BY o.FechaCreacion ASC;

SELECT TOP 1 @IdRolAdmin = r.Id
FROM dbo.Roles r
WHERE r.Nombre = N'Administrador'
  AND (r.IdOrganizacion = @IdOrgA OR r.IdOrganizacion IS NULL)
ORDER BY ISNULL(r.NivelPrioridad, 255) ASC;

IF @IdRolAdmin IS NOT NULL
BEGIN
  INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
  SELECT @IdRolAdmin, p.Id
  FROM dbo.Permisos p
  WHERE p.Codigo IN ('recursos.permisos.ver', 'recursos.permisos.editar')
    AND NOT EXISTS (
      SELECT 1 FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolAdmin AND pr.IdPermiso = p.Id
    );
  SET @nA = @@ROWCOUNT;
END
IF @nA > 0            PRINT 'OK: Rol Administrador — ' + CAST(@nA AS VARCHAR(10)) + ' permisos asignados.';
ELSE IF @IdRolAdmin IS NOT NULL PRINT 'INFO: Rol Administrador ya tenia ambos permisos (0 nuevos).';
ELSE                   PRINT 'WARN: Rol Administrador no localizado, paso 4 omitido.';
GO

PRINT '';
PRINT '============================================================';
PRINT '  5/5 — Asignacion a Rol Miembro (solo recursos.permisos.ver)';
PRINT '============================================================';
GO

DECLARE @IdOrgM UNIQUEIDENTIFIER;
DECLARE @IdRolMiembro UNIQUEIDENTIFIER;
DECLARE @nM INT = 0;
SELECT TOP 1 @IdOrgM = o.Id FROM dbo.Organizaciones o ORDER BY o.FechaCreacion ASC;

SELECT TOP 1 @IdRolMiembro = r.Id
FROM dbo.Roles r
WHERE r.Nombre = N'Miembro'
  AND (r.IdOrganizacion = @IdOrgM OR r.IdOrganizacion IS NULL)
ORDER BY ISNULL(r.NivelPrioridad, 255) ASC;

IF @IdRolMiembro IS NOT NULL
BEGIN
  INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
  SELECT @IdRolMiembro, p.Id
  FROM dbo.Permisos p
  WHERE p.Codigo = 'recursos.permisos.ver'
    AND NOT EXISTS (
      SELECT 1 FROM dbo.PermisosRol pr WHERE pr.IdRol = @IdRolMiembro AND pr.IdPermiso = p.Id
    );
  SET @nM = @@ROWCOUNT;
END
IF @nM > 0             PRINT 'OK: Rol Miembro — ' + CAST(@nM AS VARCHAR(10)) + ' permisos asignados.';
ELSE IF @IdRolMiembro IS NOT NULL PRINT 'INFO: Rol Miembro ya tenia recursos.permisos.ver (0 nuevos).';
ELSE                   PRINT 'WARN: Rol Miembro no localizado, paso 5 omitido.';
GO

PRINT '';
PRINT '============================================================';
PRINT '  Resumen final';
PRINT '============================================================';
GO

SELECT c.name AS Columna
FROM sys.columns c
WHERE c.object_id = OBJECT_ID('dbo.PermisosRecurso')
ORDER BY c.column_id;
GO

SELECT p.Codigo, p.Nivel, p.Categoria
FROM dbo.Permisos p
WHERE p.Codigo LIKE 'recursos.permisos.%'
ORDER BY p.Codigo;
GO

SELECT r.Nombre AS Rol, COUNT(pr.IdPermiso) AS Permisos_Asignados
FROM dbo.Roles r
LEFT JOIN dbo.PermisosRol pr ON pr.IdRol = r.Id
WHERE r.Nombre IN ('Administrador', 'Miembro')
GROUP BY r.Nombre
ORDER BY Permisos_Asignados DESC;
GO

PRINT '';
PRINT 'OK: Migracion 20260905_permisos_recurso completada.';
GO
