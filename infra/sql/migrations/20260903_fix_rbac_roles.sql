-- ============================================================================
--  Migration: Fix RBAC roles + seed PermisosRol
--  Fecha: 2026-09-03
--  BBDD: KMS (SQL Server 2014)
--  Objetivos:
--    1) Asignar rol Miembro al usuario asd@kms.local que no tenía rol.
--    2) Poblar tabla PermisosRol: Administrador = TODOS los 26 permisos,
--       Miembro = permisos básicos (no administrativos).
--  NOTA: Script IDEMPOTENTE — usa IF NOT EXISTS en cada inserción.
-- ============================================================================

SET NOCOUNT ON;
GO

USE KMS;
GO

PRINT '============================================================';
PRINT '  Paso 1/2 - Asignar rol Miembro a usuario asd@kms.local';
PRINT '============================================================';
GO

DECLARE @IdOrg UNIQUEIDENTIFIER;
DECLARE @IdUsuario UNIQUEIDENTIFIER;
DECLARE @IdRolMiembro UNIQUEIDENTIFIER;
DECLARE @IdAdmin UNIQUEIDENTIFIER;
DECLARE @nUsuarios INT;
DECLARE @nRoles INT;

SELECT TOP 1 @IdOrg = o.Id FROM dbo.Organizaciones o ORDER BY o.FechaCreacion ASC;

SELECT @IdUsuario = u.Id FROM dbo.Usuarios u WHERE LOWER(u.Correo) = 'asd@kms.local';

SELECT TOP 1 @IdRolMiembro = r.Id
FROM dbo.Roles r
WHERE r.Nombre = N'Miembro'
  AND (r.IdOrganizacion = @IdOrg OR r.IdOrganizacion IS NULL)
ORDER BY ISNULL(r.NivelPrioridad, 255) ASC;

SELECT TOP 1 @IdAdmin = u.Id
FROM dbo.Usuarios u
WHERE EXISTS (
    SELECT 1 FROM dbo.RolesUsuario ru
    INNER JOIN dbo.Roles rr ON rr.Id = ru.IdRol
    WHERE ru.IdUsuario = u.Id AND rr.Nombre = N'Administrador'
)
ORDER BY u.FechaCreacion ASC;

IF @IdUsuario IS NOT NULL AND @IdRolMiembro IS NOT NULL AND @IdOrg IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM dbo.RolesUsuario x
        WHERE x.IdUsuario = @IdUsuario AND x.IdRol = @IdRolMiembro
    )
    BEGIN
        INSERT INTO dbo.RolesUsuario (IdOrganizacion, IdUsuario, IdRol, AsignadoPor)
        VALUES (@IdOrg, @IdUsuario, @IdRolMiembro, @IdAdmin);
        SET @nUsuarios = 1;
    END
    ELSE
    BEGIN
        SET @nUsuarios = 0;
    END
END
ELSE
BEGIN
    SET @nUsuarios = -1;
END

IF @nUsuarios = 1     PRINT 'OK: Asignado rol Miembro a asd@kms.local';
IF @nUsuarios = 0     PRINT 'INFO: asd@kms.local ya tiene el rol Miembro (sin cambios).';
IF @nUsuarios = -1    PRINT 'WARN: No se pudo localizar usuario/organizacion/rol - paso 1 omitido.';
GO

PRINT '';
PRINT '============================================================';
PRINT '  Paso 2/2 - Poblar PermisosRol (Administrador + Miembro)';
PRINT '============================================================';
GO

DECLARE @IdOrg2 UNIQUEIDENTIFIER;
DECLARE @IdRolAdmin UNIQUEIDENTIFIER;
DECLARE @IdRolMiembro2 UNIQUEIDENTIFIER;
DECLARE @nAdmin INT;
DECLARE @nMiembro INT;

SELECT TOP 1 @IdOrg2 = o.Id FROM dbo.Organizaciones o ORDER BY o.FechaCreacion ASC;

SELECT TOP 1 @IdRolAdmin = r.Id
FROM dbo.Roles r
WHERE r.Nombre = N'Administrador'
  AND (r.IdOrganizacion = @IdOrg2 OR r.IdOrganizacion IS NULL)
ORDER BY ISNULL(r.NivelPrioridad, 255) ASC;

SELECT TOP 1 @IdRolMiembro2 = r.Id
FROM dbo.Roles r
WHERE r.Nombre = N'Miembro'
  AND (r.IdOrganizacion = @IdOrg2 OR r.IdOrganizacion IS NULL)
ORDER BY ISNULL(r.NivelPrioridad, 255) ASC;

SET @nAdmin = 0;
SET @nMiembro = 0;

IF @IdRolAdmin IS NOT NULL
BEGIN
    INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
    SELECT @IdRolAdmin, p.Id
    FROM dbo.Permisos p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.PermisosRol pr
        WHERE pr.IdRol = @IdRolAdmin AND pr.IdPermiso = p.Id
    );
    SET @nAdmin = @@ROWCOUNT;
END

IF @IdRolMiembro2 IS NOT NULL
BEGIN
    INSERT INTO dbo.PermisosRol (IdRol, IdPermiso)
    SELECT @IdRolMiembro2, p.Id
    FROM dbo.Permisos p
    WHERE p.Codigo IN (
        'org.ver',
        'proyectos.ver',
        'proyectos.crear',
        'revisiones.ver',
        'archivos.ver',
        'archivos.subir',
        'archivos.editar',
        'comentarios.crear',
        'favoritos.gestionar'
    )
    AND NOT EXISTS (
        SELECT 1 FROM dbo.PermisosRol pr
        WHERE pr.IdRol = @IdRolMiembro2 AND pr.IdPermiso = p.Id
    );
    SET @nMiembro = @@ROWCOUNT;
END

IF @nAdmin > 0     PRINT 'OK: Rol Administrador - ' + CAST(@nAdmin AS VARCHAR(10)) + ' permisos asignados.';
ELSE IF @IdRolAdmin IS NOT NULL PRINT 'INFO: Rol Administrador ya tenia todos los permisos (0 nuevos).';
ELSE PRINT 'WARN: Rol "Administrador" no encontrado - parte 2A omitida.';

IF @nMiembro > 0   PRINT 'OK: Rol Miembro       - ' + CAST(@nMiembro AS VARCHAR(10)) + ' permisos asignados.';
ELSE IF @IdRolMiembro2 IS NOT NULL PRINT 'INFO: Rol Miembro ya tenia sus permisos (0 nuevos).';
ELSE PRINT 'WARN: Rol "Miembro" no encontrado - parte 2B omitida.';
GO

PRINT '';
PRINT '============================================================';
PRINT '  Resumen final';
PRINT '============================================================';
GO

SELECT
    r.Nombre AS Rol,
    COUNT(pr.IdPermiso) AS Cantidad_Permisos
FROM dbo.Roles r
LEFT JOIN dbo.PermisosRol pr ON pr.IdRol = r.Id
GROUP BY r.Nombre
ORDER BY Cantidad_Permisos DESC;
GO

SELECT
    u.Correo,
    u.NombreCompleto,
    COUNT(r.Id) AS Cantidad_roles
FROM dbo.Usuarios u
LEFT JOIN dbo.RolesUsuario ru ON ru.IdUsuario = u.Id
LEFT JOIN dbo.Roles r ON r.Id = ru.IdRol
WHERE u.Estado <> 'ELIMINADO'
GROUP BY u.Correo, u.NombreCompleto
ORDER BY u.Correo;
GO

PRINT '';
PRINT 'OK: Migracion 20260903_fix_rbac_roles completada.';
GO
