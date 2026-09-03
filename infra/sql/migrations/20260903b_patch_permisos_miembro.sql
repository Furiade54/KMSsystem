-- ============================================================================
--  Patch 20260903b: Ajuste granular permisos Rol Miembro segun matriz aprobada
-- ============================================================================
SET NOCOUNT ON;
GO
USE KMS;
GO

DECLARE @IdOrg UNIQUEIDENTIFIER;
DECLARE @IdRolMiembro UNIQUEIDENTIFIER;
SELECT TOP 1 @IdOrg = o.Id FROM dbo.Organizaciones o ORDER BY o.FechaCreacion ASC;

SELECT TOP 1 @IdRolMiembro = r.Id
FROM dbo.Roles r
WHERE r.Nombre = N'Miembro'
  AND (r.IdOrganizacion = @IdOrg OR r.IdOrganizacion IS NULL)
ORDER BY ISNULL(r.NivelPrioridad, 255) ASC;

IF @IdRolMiembro IS NOT NULL
BEGIN
    -- Quitar permisos QUE NO PERTENECEN a Miembro segun matriz:
    DELETE pr
    FROM dbo.PermisosRol pr
    INNER JOIN dbo.Permisos p ON p.Id = pr.IdPermiso
    WHERE pr.IdRol = @IdRolMiembro
      AND p.Codigo IN (
        'proyectos.editar',
        'proyectos.eliminar',
        'proyectos.miembros.gestionar',
        'archivos.eliminar',
        'archivos.compartir',
        'comentarios.gestionar',
        'revisiones.asignar'
      );
    PRINT 'Ajuste Miembro: permisos eliminados = ' + CAST(@@ROWCOUNT AS VARCHAR(10));
END
GO

SELECT r.Nombre Rol, COUNT(pr.IdPermiso) cant_permisos
FROM dbo.Roles r LEFT JOIN dbo.PermisosRol pr ON pr.IdRol = r.Id
WHERE r.Nombre IN ('Administrador','Miembro')
GROUP BY r.Nombre
ORDER BY cant_permisos DESC;
GO

SELECT r.Nombre Rol, p.Codigo Permiso, p.Categoria
FROM dbo.PermisosRol pr
INNER JOIN dbo.Roles r ON r.Id = pr.IdRol
INNER JOIN dbo.Permisos p ON p.Id = pr.IdPermiso
WHERE r.Nombre = 'Miembro'
ORDER BY p.Categoria, p.Codigo;
GO
