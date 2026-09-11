# Spec: Permisos granular por recurso (PermisosRecurso) end-to-end

## Problema
Hoy la tabla `dbo.PermisosRecurso` en MSSQL:
- Tiene 0 filas y 0 usos en el acceso real a recursos.
- Únicamente se escribe en ONE-SHOT cuando `resolveRequest(APROBADO)` pero sus 6 bits `PuedeVer|Descargar|Comentar|Editar|Compartir|Administrar` **nunca se consultan** antes de servir / modificar archivos, carpetas o proyectos.
- El frontend al aprobar una solicitud siempre concede `permissionScope='view'`, no hay selector `view/full`, no hay UI para listar, revocar ni editar manualmente una concesión.
- Un usuario no-miembro no-propietario a quien se le aprobó una solicitud, **sigue sin poder abrir el recurso**, porque los endpoints miran únicamente `IdOrganizacion + (Owner O EXISTS MiembrosProyecto) + RBAC por rol general`.

## Usuarios y objetivos
- **Propietario / Miembro con manage**: Conceder / revocar permisos de un recurso a usuarios o roles de la org, con niveles granulares.
- **Administrador de org**: Gestionar todas las concesiones sin restricciones, auditarlas, ver total otorgado.
- **Usuario normal**: Ver a qué recursos tiene acceso directo, sin depender del proyecto.
- **Meta**: Que aprobar una solicitud de acceso tenga EFECTO REAL: el solicitante pueda inmediatamente `GET archivo`, comentar, descargar, etc., según el scope concedido.

## Alcance / Capas a implementar (orden de capas, de más bajo nivel a más alto)
1. **Capa RBAC middleware** → `requireResourcePermission(resourceType, capability, {idFromParam, idFromBody?})` que une: (a) permisos del rol + (b) ownership + (c) membership proyecto + (d) permisos de la tabla `PermisosRecurso` (OR lógico).
2. **Capa backend service `resource-permissions.service.ts`** → CRUD sobre `PermisosRecurso` (get grants, grant user, grant role, edit bits, revoke, inherit/propagación carpeta→archivo opcional).
3. **Capa backend `resource-permissions.controller.ts` + routes** → endpoints para cada tipo de recurso `/proyectos/:id/permisos`, `/carpetas/:id/permisos`, `/archivos/:id/permisos`, `DELETE /:permId`, `PATCH /:permId`, `POST /` grant nuevo.
4. **Capa backend parches endpoints existentes** → aplicar `requireResourcePermission` a `folders`, `files` (GET list/detail, download, PATCH/editar metadata, DELETE, POST comentarios, POST compartir, upload, copy, move) y `projects` (detalle, ver miembros, etc.). **Cuidado**: preservar la compatibilidad. El permiso RBAC `archivos.ver` del rol sigue siendo suficiente, ahora se le suma OR el permiso granular.
5. **Capa shared-types + frontend service `resource-permissions.service.ts`** → tipos `ResourcePermissionId`, `GrantRequest {userId?, roleId?, capabilityBits...}`.
6. **Capa frontend RequestsPage** → aprobar con scope selector `Solo ver` / `Total (editar/compartir/administrar)` y refetch el listado de permisos del recurso tras aprobar.
7. **Capa frontend vistas de un recurso (ProjectDetail, FilePanel/ContextPanel, carpeta)** → pestaña nueva `Permisos` tipo `UsersPage` con listado paginado, selector usuario/rol, 6 toggles PuedeX, botón nuevo permiso, menú acciones revocar.

## Non-goals (no hacer en esta iteración)
- No migraciones BD de schema. Los 11 campos ya existen, solo añadir índices si convence.
- No implementar permisos por carpeta heredados automáticamente al subir/crear archivos nuevos (opcional v2).
- No notificaciones push cuando te conceden un permiso (hay notificaciones sistema para otra historia).
- No permitir recursos cross-organizacionales (permisos siempre dentro de la misma org, validado en handler).

## Requisitos funcionales (FR)
1. Tipos de recurso soportados: `'PROJECT' | 'FOLDER' | 'FILE'` (case-sensitive o con mapping a requests.service).
2. Un registro `PermisosRecurso` solo puede contener **uno** de `IdUsuario` o `IdRol` con valor (XOR). Ambos NULL → rechazo.
3. Existe una operación `upsertPermission(resourceType, resourceId, {userId?, roleId?}, bits)` que hace IF NOT EXISTS INSERT ELSE UPDATE, devolviendo el registro final.
4. Revocar permiso es DELETE físico de la fila. No hay soft-delete.
5. Jerarquía de privilegios al conceder bits:
   - `PuedeAdministrar=1` automáticamente hace que los demás bits, aunque estén en 0, sean equivalentes a 1 en runtime (no se persiste como 1 para no romper data model).
   - `PuedeEditar=1` requiere PuedeVer implícitamente.
   - `PuedeCompartir=1` requiere PuedeVer implícitamente.
6. `requireResourcePermission(type, capability, lookup)`: retorna Next() si CUALQUIERA es true:
   a) auth.isOrgAdmin,
   b) auth.permissions.has(codigoRBAC correspondiente), (ej: capability=VER y permisos.rol tiene `archivos.ver`),
   c) usuario es IdPropietario del recurso,
   d) usuario es miembro del proyecto asociado y el scope no necesita capability=ADMINISTRAR,
   e) existe fila PermisosRecurso con resource match y (IdUsuario=auth.userId O IdRol en rolesDelUsuario) con bit correspondiente=1.
7. `GET /api/{proyectos|carpetas|archivos}/:id/permisos?page&pageSize&search&scope=users|roles|all` → `PaginatedResult<ResourcePermissionGrant>` + counts.
8. `POST /api/{proyectos|carpetas|archivos}/:id/permisos` → body `{ userId?: UUID, roleId?: UUID, puedeVer, puedeDescargar, puedeComentar, puedeEditar, puedeCompartir, puedeAdministrar }`
9. `PATCH /api/permisos-recurso/:id` → editar bits de un permiso existente.
10. `DELETE /api/permisos-recurso/:id` → revocar.
11. RequestsPage aprobación muestra 2 acciones: `Aprobar (solo ver)` y `Aprobar (total)` que envían `permissionScope` correcto. Aprobado total concede PuedeEditar, PuedeCompartir, PuedeAdministrar=1 sobre el recurso.
12. Auditoría `logAuditRecord` en cada operación de permiso: `permiso.otorgado`, `permiso.editado`, `permiso.revocado`.

## Requisitos no funcionales (NFR)
1. **Backward compat**: Toda request que hoy es 200 con el middleware `requirePermission(codigoRBAC)` tiene que seguir siendo 200. Nunca introducir 403 nuevos a usuarios que ya tenían acceso. Por eso el middleware nuevo evalúa la condición (b) primero OR.
2. **Performance**: tabla PermisosRecurso esperada > 10.000 filas en producción. Añadir índice nonclustered `IX_PermisosRecurso_Resource` en `(TipoRecurso, IdRecurso, IdUsuario, IdRol)` para búsquedas rápidas por recurso. Si MSSQL 2014 soporta (sí). Todo acceso vía SQL parametrizado SIN concatenación dinámica.
3. **Idempotencia**: upsertPermission no inserta filas duplicadas para el mismo (resource, userId) o (resource, roleId), usa la validación XOR antes.
4. **Seguridad**:
   - Nunca conceder permisos cross-org: el recurso debe pertenecer a `auth.organizationId`.
   - Para conceder/editar/revocar un permiso, el actor debe tener **PuedeAdministrar=1** sobre el recurso (por cualquiera de las 5 vías) O isOrgAdmin.
5. **TypeScript**: 0 nuevos `any` usados como escape de tipos. Los generics y los DTOs son exactos.
6. **Front UX compacta, alta densidad**: Tabla de permisos 1 fila por grant, columnas: `Tipo grantee (Usuario/Rol) | Nombre | 6 toggles PuedeX (readonly o editable según capacidad) | Acciones (editar / revocar)`; todo sticky header, panel sin padding excesivo vertical.

## Restricciones / dependencias / asunciones
- MSSQL Server 2014 (120) sin STRING_AGG — usar `STUFF + FOR XML PATH`.
- Frontend usa TanStack Query v5, Zustand authStore, lucide-react icons, clsx, Tailwind 3.
- Permiso RBAC granular `recursos.gestionar_permisos` se añade a shared-types, opcional (por defecto isOrgAdmin lo tiene automáticamente).
- Asunción: los 3 tipos recurso mapean así TipoRecurso DB ↔ URL API: `'proyecto'|'carpeta'|'archivo'` ↔ resource type `projects|folders|files`. Mantener lowercase y guiones bajos donde corresponda.

## Preguntas abiertas (por ahora cerradas con defaults)
1. ¿Permitir grants a ROLE (IdRol) o solo a USUARIO? → **Ambos** (columna IdRol ya existe y es FK; mejor implementarlo desde el principio y UI con dropdown dual tipo grantee usuario/rol).
2. Cuando borras PROYECTO o CARPETA o ARCHIVO (soft o permanent), ¿se borran sus PermisosRecurso en cascada? → **NO en esta iteración**. Se dephan filas huérfanas si se hace hard delete. Soft delete seguirá mostrando sus permisos hasta que revocar manual o v2.
3. ¿El permiso PuedeCompartir concede poder de subir archivos a una carpeta? → En esta primera capa solo controlamos verbos leídos del router; POST files/upload lo controlará `requireResourcePermission('FILE'|'FOLDER'|'PROJECT'?=parent capability=EDITAR o SUBIR), se decide en implementación`.

---

## Acceptance Criteria
| ID | Tipo | Descripción |
|---|---|---|
| AC1 | rule | `requirePermission('archivos.ver')` no se rompe: si el usuario tiene el rol con ese código, pasa igual que hoy; NO se requiere fila en PermisosRecurso. |
| AC2 | rule | Si se aprueba `POST /solicitudes/:id/aprobar permissionScope='full'`, se inserta/actualiza PermisosRecurso con 6 bits = 1; GET `/archivos/:id` del archivo concedido devuelve 200 al usuario solicitante aunque no sea miembro ni propietario. |
| AC3 | rule | `POST /api/archivos/:id/permisos` {roleId:UUID, puedeVer=1} concede permiso. Todos los usuarios que tienen ese rol pueden GET el archivo. |
| AC4 | rule | `DELETE /api/permisos-recurso/:id` borra la fila; después el usuario de esa fila recibe 403 al intentar GET el archivo (a menos que siga teniendo acceso por otra vía: membership/rol RBAC/owner). |
| AC5 | rule | Actor sin PuedeAdministrar ni isOrgAdmin que intenta POST/DELETE/PATCH permiso recibe 403. |
| AC6 | rule | Intentar insertar permiso cross-org (resource pertenece a org B y auth de org A) → 403. |
| AC7 | rule | ResourcePermission grant solo acepta uno de userId o roleId (no ambos, no ninguno); si ambos o ninguno BadRequest 400. |
| AC8 | rule | RequestsPage Approve muestra 2 botones scope; Aprobar total concede PuedeAdministrar=1; Approve view concede solo 3 bits. Al aprobar se muestra toast o actualización inmediata de la UI. |
| AC9 | rule | Indice no clustered `IX_PermisosRecurso_Resource` existente en MSSQL (o al menos creado create index si no existe en start up o script). |
| AC10 | rule | 3 typechecks `npx tsc --noEmit` para shared-types, backend y frontend retornan 0 nuevos errores (sin contar los preexistentes de favorites/projects/crud-organizations que no se tocan). |
| AC11 | rubric | Middleware requireResourcePermission arquitectura (0-4). ≥3 si: se comporta como express middleware, usa cache por (userId, resourceType, resourceId) dentro del request para no consultar PermisosRecurso múltiples veces en el mismo request, fallback a ownership y membership, XOR checks, logging errors no silenciosos. |
| AC12 | rubric | UI listado permisos recurso ProjectDetail/FileDetail (0-4). ≥3 si: grilla 1 permiso/fila, 6 toggles, icon distinto usuario vs rol, buscador, scope selector (todos/usuarios/roles), acciones menu dropdown, botón nuevo permiso. |
| AC13 | rubric | Backward compatibility tras deploy (0-4). ≥3 si: todos los endpoints de files/projects/folders existentes devuelven 200/404 igual, y un script de login como carlos.perez → GET proyectos → GET archivos del proyecto 1er id retorna 200 igual que antes. |
| AC14 | rubric | Consistencia nomenclatura + types (0-4). ≥3 si: todas las funciones/services/controllers/DTOs usan nombres uniformes, PermissionCode enum no se toca salvo añadir opcional `recursos.gestionar_permisos` si convence, y los 6 bits tienen mismos nombres de columna que las booleanas typescript (puedeVer ↔ PuedeVer case mapping). |
