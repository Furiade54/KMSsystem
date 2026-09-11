# Tasks: Permisos granular por recurso (PermisosRecurso) — implementación por capas

Cada task es una **capa vertical completa**, ejecutable una por una en orden. Ninguna toca archivos de otra capa más allá de lo estrictamente necesario.
Objetivo de esta primera fase: Implementar **Task 1 → 8** (core de permisos real sobre recursos).

---

## Task 1: Index MSSQL + bootstrap idempotent
**Prioridad**: high
**Dependencies**: ninguna.
**Files que crea/edita**:
- `backend/src/modules/resource-permissions/migrations.sql` (script aplicable standalone; opcional si ejecuta en DB) o añadir `ensureIndexes()` llamado desde bootstrap del backend.
**Descripción**:
1. Crear índice nonclustered `IX_PermisosRecurso_Resource(IdRecurso, TipoRecurso, IdUsuario, IdRol)`.
2. Comprobar si falta UNIQUE compuesto `UQ_PermisosRecurso_Grantee(TipoRecurso, IdRecurso, IdUsuario)` (WHERE IdUsuario IS NOT NULL) y `UQ_PermisosRecurso_Grantee_Rol(TipoRecurso, IdRecurso, IdRol)` (WHERE IdRol IS NOT NULL) para evitar duplicados a nivel SQL.
3. `Status: completed` tras ejecutar en DB con 0 errores.
**Evidence**: `SELECT name, is_unique FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.PermisosRecurso')` muestre los 2 índices + PK.
**Test Requirements**:
- TR 1.1 (rule): 2 índices nuevos existen (IX_Resource y 2 filtros unique) si no existían.
- TR 1.2 (rule): re-ejecutar `ensureIndexes` dos veces no arroja errores (idempotente).

## Task 2: shared-types (capa de tipos)
**Prioridad**: high
**Dependencies**: Task 1.
**Files que crea/edita**: `packages/shared-types/src/index.ts`
**Descripción**:
1. Añadir `export type ResourceType = 'PROJECT' | 'FOLDER' | 'FILE' | 'proyecto' | 'carpeta' | 'archivo'` con helper internalizado.
2. Añadir `export interface ResourcePermissionGrant` { id, resourceType, resourceId, userId?, userName?, userEmail?, roleId?, roleName?, puedeVer, puedeDescargar, puedeComentar, puedeEditar, puedeCompartir, puedeAdministrar, createdAt, grantedByUserId?, grantedByUserName? }
3. Añadir `type PermissionCode` y `PERMISSION_CODES` nuevos opcionales: `'recursos.permisos.ver' | 'recursos.permisos.editar'`. (Por defecto isOrgAdmin auto-los tiene).
4. Añadir DTOs `CreateResourcePermissionDto`, `UpdateResourcePermissionDto`, `UpsertResourcePermissionBody` con XOR userId/roleId.
5. `export const CAPABILITY_TO_PERMISSION_CODE = { VER: 'archivos.ver', ... }` o función de mapping capability → código RBAC equivalente.
**Evidence**: tsc packages noEmit 0.
**Test Requirements**:
- TR 2.1 (rule): `tsc --noEmit packages/shared-types` exit 0.
- TR 2.2 (rubric: 0-3, ≥2) cobertura types resource permission: create/update/list DTOs + enums + helper normalizer resourceType.

## Task 3: Backend `resource-permissions.service.ts` (core capa service)
**Prioridad**: high
**Dependencies**: Task 2.
**Files que crea/edita**: `backend/src/modules/resource-permissions/resource-permissions.service.ts`
**Descripción**:
1. `const RESOURCE_TYPE_NORM`: mapea lowercase DB `proyecto/carpeta/archivo` ↔ uppercase FRONT `PROJECT/FOLDER/FILE`.
2. `normalizeResourceType(type)` + `assertSameOrganizationResource(auth, resourceType, resourceId)`: lanza 404 si no existe + 403 si es cross-org.
3. `getPermissionsForResource(pool, resourceType, resourceId, opts): PaginatedResult<ResourcePermissionGrant>` con joins Usuarios/Roles para traer nombres, pageSize=25.
4. `hasCapabilityOnResource(pool, auth, resourceType, resourceId, capability: VER|DESCARGAR|COMENTAR|EDITAR|COMPARTIR|ADMINISTRAR): Promise<boolean>` — esta es la pieza clave que consume el middleware. Evalúa todas las vías de acceso: isOrgAdmin, RBAC code, owner, MiembrosProyecto, SELECT FROM PermisosRecurso (user y roles del usuario).
5. `upsertGrant(pool, actorAuth, resourceType, resourceId, body, req?)` — XOR userId/roleId, check actor tiene ADMINISTRAR, inserta/actualiza y log auditoría `permiso.otorgado`.
6. `updateGrantById(pool, actorAuth, permId, patch, req?)` — 404 si no, 403 si no es admin, audit `permiso.editado`.
7. `revokeGrantById(pool, actorAuth, permId, req?)` — DELETE físico, 403 si no admin, audit `permiso.revocado`.
8. `syncGrantFromRequestApproval(pool, approverAuth, resourceType, resourceId, requesterUserId, scope: view|full)` — wrapper usado por requests.service.ts para no duplicar lógica.
**Evidence**: ts-check backend pasa.
**Test Requirements**:
- TR 3.1 (rule): upsertGrant XOR userId/roleId — ambos no-null → 400; ambos null → 400.
- TR 3.2 (rule): syncGrantFromRequestApproval scope=full pone PuedeAdministrar=1; scope=view solo PuedeVer/Descargar/Comentar=1 y el resto 0 o mantiene si existía.
- TR 3.3 (rule): hasCapabilityOnResource retorna true si isOrgAdmin, sin consultar tabla.
- TR 3.4 (rubric: 0-3, ≥2): `hasCapabilityOnResource` cachea dentro de un mismo request (Map adjunto a `req`) para evitar 5 queries iguales al servir 1 endpoint.

## Task 4: Backend `resource-permissions.controller.ts` + routes montadas
**Prioridad**: high
**Dependencies**: Task 3.
**Files que crea/edita**:
- `backend/src/modules/resource-permissions/resource-permissions.controller.ts`
- `backend/src/modules/resource-permissions/resource-permissions.routes.ts`
- Montar en `backend/src/app.ts` bajo `app.use('/api', resourcePermissionsRouter)` (ruta unificada) o alternativamente unir a routers existentes.
**Descripción**:
1. Zod schemas: `ResourceGrantCreateSchema`, `ResourceGrantUpdateSchema` (6 bits, userId, roleId XOR).
2. Endpoints:
   - `GET /api/permisos-recurso/:permId` (detail).
   - `PATCH /api/permisos-recurso/:permId` (editar bits, requires admin sobre el recurso).
   - `DELETE /api/permisos-recurso/:permId` (revocar, requires admin).
   - `GET /api/proyectos/:id/permisos`, `GET /api/carpetas/:id/permisos`, `GET /api/archivos/:id/permisos` → paginado.
   - `POST /api/proyectos/:id/permisos`, `POST /api/carpetas/:id/permisos`, `POST /api/archivos/:id/permisos` → nuevo grant / upsert si duplicate XOR.
3. Cada endpoint valida `auth.organizationId === resource.orgId`.
4. Middleware helper: `injectResourceToReq('archivos'|'proyectos'|'carpetas')` que carga el recurso en `req.resource` y rechaza 404/403.
**Evidence**: endpoint list returns 200 con total 0 cuando tabla vacía.
**Test Requirements**:
- TR 4.1 (rule): `POST /api/archivos/:id/permisos` sin `userId` ni `roleId` → 400.
- TR 4.2 (rule): GET /proyectos/:id/permisos de un proyecto de otra org → 403.
- TR 4.3 (rule): montaje sin conflictos de rutas en app.ts.

## Task 5: Backend middleware `requireResourcePermission` + parches routers files/folders/projects
**Prioridad**: high
**Dependencies**: Task 4 (depende service de capa 3).
**Files que crea/edita**:
- `backend/src/shared/middleware/rbac.ts` (nuevo export `requireResourcePermission`).
- `backend/src/modules/files/files.routes.ts`
- `backend/src/modules/folders/folders.routes.ts`
- `backend/src/modules/projects/projects.routes.ts`
**Descripción**:
1. Crear `requireResourcePermission(resourceType: ResourceType, capability: CAP_ENUM, getResourceId = (req) => req.params.id, getResourceFromDb = lookupFn)`.
   - Si cualquiera de las vías (isOrgAdmin, permiso RBAC general, owner, miembro, tabla PermisosRecurso) da true → `next()`.
   - Sino → 403 con `AppError` message en español.
2. Aplicar a:
   - `files`: GET /, GET /:id, GET /:id/download-like, PATCH, POST compartir, POST comentarios, DELETE, PATCH comentario, DELETE comentario, copy, upload a un archivo (no), upload a FOLDER/PROYECTO que sí.
   - `folders`: GET, POST, PATCH, DELETE, copy.
   - `projects`: GET /:id, GET /:id/miembros, PATCH, DELETE, temas, reuniones, recursos.
3. **No romper compatibilidad**: el middleware antiguo `requirePermission('archivos.ver')` sigue activo como una condición OR. Si el usuario lo tiene, se salta la consulta a PermisosRecurso.
**Evidence**: typecheck backend.
**Test Requirements**:
- TR 5.1 (rule): GET archivo de un no-miembro que tiene fila PermisosRecurso(PuedeVer=1) → 200; sin fila → 403.
- TR 5.2 (rule): GET archivo de isOrgAdmin → 200 sin consultar tabla.
- TR 5.3 (rule): Owner de archivo → 200 por ownership branch.
- TR 5.4 (rubric: 0-4, ≥3): middleware es reusable, parametrizado, no tiene side effects más allá de loggeo en caso de errores; no introduce 403 regresivos en rutas existentes que antes daban 200.

## Task 6: Backend parche `requests.service.ts` para delegar a capa nueva
**Prioridad**: medium
**Dependencies**: Task 3, 4 (no rompe, si no se llama, el código de before funciona con duplicado).
**Files que crea/edita**: `backend/src/modules/requests/requests.service.ts`.
**Descripción**:
1. Reemplazar la transacción SQL hardcodeada de `resolveRequest(APROBADO)` (líneas 316-337 que hoy hace `IF EXISTS UPDATE ELSE INSERT`) por `await syncGrantFromRequestApproval(pool, auth, current.resourceType, current.resourceId, current.requesterId, scope = opts.permissionScope || 'view')`.
2. Mantener `catch {} ignore best-effort` igual que hoy, para evitar que un error de permisos aborte la aprobación de la solicitud.
**Evidence**: approve una solicitud → se ve 1 fila en PermisosRecurso (0 antes), bits correctos según scope.
**Test Requirements**:
- TR 6.1 (rule): aprobar scope=view no concede PuedeAdministrar.
- TR 6.2 (rule): aprobar scope=full concede PuedeAdministrar=1.
- TR 6.3 (rule): el registro de auditoría ORG_DELETED_PERMANENT de organizaciones no se ve afectado (no tocar organizaciones).

## Task 7: Frontend service `resource-permissions.service.ts`
**Prioridad**: high
**Dependencies**: Task 2, 4 (tipos y endpoints listos).
**Files que crea/edita**: `frontend/src/services/resource-permissions.service.ts`
**Descripción**:
1. Importar tipos `ResourcePermissionGrant`, etc. de shared-types.
2. `orgStatusMap`-like: `capabilityLabels = { puedeVer: 'Ver', ... }`.
3. `listResourcePermissions(resourceType: 'projects'|'folders'|'files', id, params?): PaginatedResult<ResourcePermissionGrant>`
4. `grantPermission(resourceType, id, body): ResourcePermissionGrant`
5. `updatePermission(permId, patch): ResourcePermissionGrant`
6. `revokePermission(permId): Promise<void>` (HTTP 204)
7. `extractResourcePermissionError()` igual que otros services.
**Evidence**: typecheck frontend.
**Test Requirements**:
- TR 7.1 (rule): `grantPermission` envía userId sin roleId → pasa; envía los dos → validación backend lo atrapa y devuelve error message español.

## Task 8: Frontend RequestsPage scope selector aprobar view/full
**Prioridad**: medium
**Dependencies**: Task 7 (no necesita, es UI sobre requests service que ya existe).
**Files que crea/edita**: `frontend/src/pages/RequestsPage.tsx`
**Descripción**:
1. Añadir segunda mutation `approveFullMut = useMutation(id => approveRequest(id, {permissionScope:'full'}))`.
2. En la fila recibida, botones: `Aprobar (solo ver)` (verde), `Aprobar (total)` (azul), `Rechazar` (gris).
3. Tooltip breve explicativo sobre la diferencia de scope.
4. Al terminar cualquiera de las dos aprobaciones, invocar `qc.invalidateQueries(['permissions', ...])` si quisiésemos, o al menos `invalidate` los queries que ahora existan.
**Evidence**: RequestsPage renderiza 3 botones.
**Test Requirements**:
- TR 8.1 (rule): pending state spinner mientras corre approveMut y approveFullMut.
- TR 8.2 (rubric: 0-3, ≥2): UI compacta sin padding excesivo; botones inline con iconos distintivos (Eye vs ShieldCheck vs X).

## Task 9 (Opcional, segunda iteración): Frontend pestaña Permisos en ProjectDetail / FileDetail + modales grant
**Prioridad**: low (fuera del scope inicial, mencionado por completitud)
**Dependencies**: Task 7.
**Files que crea/edita**: `frontend/src/pages/ProjectDetailPage.tsx`, `frontend/src/components/layout/ContextPanel.tsx`, `frontend/src/pages/*FilesPanel*` o file viewer.
**Descripción**:
1. Añadir tab `'permissions'` en TabsBar permitidos.
2. Tabla listado con row por grant, 6 booleanos como toggle switches o badges.
3. Modal nuevo permiso: dual selector tipo grantee `Usuario` / `Rol` + searcher usuario/rol + 6 toggles (con "Preselección view only" y "Preselección total").
4. Modal confirmación revocar.
**Fuera de scope si no hay tiempo; pero dejar estructura del task para futuro.**

## Task 10: Typecheck global y smoke tests endpoints
**Prioridad**: high
**Dependencies**: Tasks 1..8 todos completed.
**Files**: ninguno nuevo (solo corre).
**Descripción**:
1. `packages/shared-types tsc --noEmit` exit 0.
2. `backend npm run typecheck` exit 0 (ignorar 3 preexistentes favorites.controller).
3. `frontend npm run typecheck` exit 0 (ignorar preexistentes favorites.service/projects/projectDetail).
4. Smoke script Node: login carlos.perez → GET proyecto existente → 200; GET archivo existente → 200; POST file/:id/permisos a otro usuario con PuedeVer=1 → 200; login otro usuario (no admin, no miembro) → GET archivo → 200 (demuestra que la capa funciona). Revocar DELETE permisos-recurso/:id → 204; GET archivo como usuario2 → 403; prueba regresiva exit.
**Evidence**: terminal de cada command OK.
