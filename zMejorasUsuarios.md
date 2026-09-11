vamos a mejorar el tema de usuarios CRUD sobre usuarios, actualmente que tablas de mssqle stan implicadas?
10:25
OK. Análisis completo MSSQL para un CRUD de Usuarios.

Tablas directamente implicadas en Usuarios (identidad/seguridad)
dbo.Usuarios — tabla principal del usuario 000_KMS_RESET_TOTAL.sql#L59-L73

Id, IdOrganizacion, NombreCompleto, Correo (UQ), ClaveHash, UrlAvatar, Estado, UltimoInicio, FechaCreacion, FechaActualizacion
FK IdOrganizacion → Organizaciones (sin CASCADE)
dbo.Roles — catálogo de roles, con IdOrganizacion NULL para roles sistema/globales L78-L88

dbo.RolesUsuario — join User↔Role, con ON DELETE CASCADE en ambas FK L90-L99

dbo.Permisos + dbo.PermisosRol — roles-permisos (catálogo y asignación por rol) L101-L117

dbo.Organizaciones — requerida para listar/validar la org del usuario en creaciones y listados L48-L56

Tablas afectadas indirectamente al borrar/modificar usuario
Importante porque la mayoría de FK a Usuarios NO tienen CASCADE, así que un DELETE físico sin limpieza manual previa FALLARÁ en MSSQL:

Tabla	Campo FK	ON DELETE CASCADE?	Acción recomendada
Proyectos	IdPropietario	❌ NO_ACTION	Reasignar propietario o marcar proyecto como INACTIVO antes de borrar usuario
MiembrosProyecto	IdUsuario	❌ NO_ACTION	Hay que borrar manualmente todas sus membresías de proyectos
TemasProyecto.IdCreador		❌	dejar NULL o borrar temas
Reuniones.IdCreador		❌	dejar NULL
AsistentesReunion.IdUsuario		❌	borrar manualmente sus asistencias
ActasReunion.IdCreador		❌	dejar NULL
Carpetas.IdPropietario		❌	reasignar o NULL
Archivos.IdPropietario, IdCargador		❌	reasignar o NULL
VersionesArchivo.IdCreador		❌	NULL
Comentarios.IdUsuario		SÍ CASCADE ✅	OK, se limpia solo
ComentariosArchivos.IdUsuario		❌	borrar manual
Auditoria		❌	borrar manual
AccesosArchivos.IdUsuario, IdComparte, IdUsuarioDestino	❌ (incluye IdUsuario sí CASCADE)	IdComparte/IdUsuarioDestino requieren limpieza o NULL	
SolicitudesAcceso.IdSolicitante, IdPropietario	❌	borrar manual	
Favoritos.IdUsuario		SÍ CASCADE ✅	OK
Notificaciones.IdUsuario		SÍ CASCADE ✅	OK
ActividadReciente.IdUsuario		❌	borrar manual
En resumen: Create / Read / Update de usuarios son sencillos (solo Usuarios + RolesUsuario). El Delete es el paso complejo porque ~12 tablas no tienen ON DELETE CASCADE hacia Usuarios; hay que limpiar/reasignar antes.

¿Quieres que montemos el diseño exacto (endpoints, shape, política de borrado) antes de codear?

vamos a comenzar a analizar por capas, comienza mejorando la base de datos con las sugerencias
10:27
OK. Base de datos actualizada por capas:

Script de reset total actualizado
000_KMS_RESET_TOTAL.sql

Script incremental para BD existente (idempotente)
002_KMS_MEJORAS_USUARIOS_SBD.sql (no borra datos, usa IF NOT EXISTS / TRY-CATCH / sp_executesql).

Resumen de mejoras por capa
1. Usuarios (core)
Nuevas columnas: Telefono + Cargo.
FK_Usuario_Organizacion pasa a ON DELETE CASCADE.
CK_Usuarios_Estado enumera: ACTIVO / INACTIVO / BLOQUEADO / ELIMINADO.
Índices: IX_Usuarios_IdOrganizacion_Estado + IX_Usuarios_NombreCompleto.
2. Roles
NivelPrioridad TINYINT (0-255, Admin=10, Miembro=50) para ordenar jerarquías y evitar elevación.
FK_Rol_Organizacion pasa a ON DELETE CASCADE.
UQ + IX IX_Roles_Organizacion_Nombre para evitar roles duplicados por organización.
IX_Roles_IdOrganizacion cubre el catálogo por rol sistema.
3. RolesUsuario (RBAC)
Nuevas columnas: IdOrganizacion NOT NULL (backfill desde Usuarios/Roles si existen datos), FechaAsignacion, AsignadoPor (FK a Usuarios, con trazabilidad de quién asignó).
UQ_RolesUsuario_Usuario_Rol para evitar asignaciones duplicadas.
Quité ON DELETE CASCADE de FK_RolesUsuario_Usuario para evitar múltiples rutas de cascada con la FK a Organizaciones (SQL Server no permite múltiples caminos); ahora es NO_ACTION y la limpieza previa se hace en service.
Índices por IdOrganizacion, IdUsuario, IdRol.
4. Permisos (catálogo RBAC por niveles)
Nuevas columnas: Nivel (ORGANIZACION / PROYECTO / RECURSO / SISTEMA) + Categoria.
IX_Permisos_Nivel_Categoria.
Catálogo semilla de 26 permisos insertado (usuarios.ver/crear/editar/eliminar, roles.asignar, proyectos.miembros.gestionar, archivos.compartir, comentarios.gestionar, auditoria.ver, etc.).
5. Proyectos
FK_Proyecto_Organizacion pasa a ON DELETE CASCADE.
CK_Proyectos_Estado enumera 6 estados.
IX_Proyectos_IdPropietario resuelve “qué proyectos posee X usuario” en 1 consulta.
6. Eliminación segura de usuario (ahora con CASCADE donde era posible)
Tablas que sí eliminan en cascada al borrar usuario: RolesUsuario, MiembrosProyecto, AsistentesReunion, ComentariosArchivos, PermisosRecurso, SolicitudesAcceso (Solicitante), Comentarios, Notificaciones, Favoritos, ActividadReciente, SolicitudesPendientes.

Quedan manuales (por integridad referencial o ciclos): Proyectos (reasignar IdPropietario o NULL), Carpetas/Archivos IdPropietario, VersionesArchivo IdCargador, Comentarios, Revisiones (Solicitante/Revisor — no cascada), Compartidos (IdComparte/IdDestino), Auditoria (conservar).

7. FKs + IX faltantes (operaciones CRUD usuarios)
UQ_MiembrosProyecto_Proyecto_Usuario + IX_MiembrosProyecto_IdUsuario.
IX en TemasProyecto.IdCreador, Reuniones.IdCreador, AsistentesReunion.IdUsuario, ActasReunion.IdCreador, Carpetas.IdPropietario, Archivos.IdPropietario + IdProyecto_IdCarpeta, VersionesArchivo.IdCargador, RecursosExternos.IdCreador, ComentariosArchivos.IdUsuario, SolicitudesAcceso.IdSolicitante + IdPropietario, Compartidos.IdComparte + IdUsuarioDestino, Comentarios.IdUsuario, Revisiones.IdSolicitante + IdRevisor, Notificaciones.IdUsuario, Auditoria.IdOrganizacion+IdUsuario (composite), Favoritos.IdOrganizacion CASCADE, UQ_Etiquetas_Organizacion_Nombre.
8. Tablas NUEVAS (preparación para CRUD)
dbo.ActividadReciente — acceso reciente por usuario (PK compuesta, CASCADE Usuario y Org).
dbo.SolicitudesPendientes — tokens de invitación/reinicio/cambio correo (CK de Tipo y Estado, CASCADE Usuarios y ON DELETE SET NULL en roles).
9. Datos semilla
Roles Administrador(10) y Miembro(50) usan NivelPrioridad.
Usuario admin@kms.local → Cargo = 'Administrador de Plataforma'.
26 permisos insertados si no existen.
Listo para proceder a la siguiente capa (back-end de Usuarios).