# Especificación: CRUD completo de Organizaciones

## Problema
Actualmente el módulo de organizaciones (backend `/api/organizacion`) solo implementa **2 de las 4 operaciones CRUD**:
- ✅ **Read** (GET `/` — solo tu propia organización via `req.auth.organizationId`)
- ✅ **Update** (PATCH `/` — solo tu propia organización via `req.auth.organizationId`)
- ❌ **Create** (no existe endpoint para crear organizaciones)
- ❌ **Delete** (no existe soft-delete ni hard-delete)
- ❌ **List** (no existe listado paginado de organizaciones para administrador multi-tenant)
- ❌ **Por ID** (no existe obtener/editar/eliminar otra organización distinta a la del token)

En el **frontend** no existe ninguna UI para organizaciones: ni servicio, ni página, ni rutas, ni entrada en el menú sidebar. El dato `organizationId` solo se usa implícitamente en el JWT.

El usuario ha pedido explícitamente: "implementar CRUD de organizaciones".

---

## Usuarios
1. **Administrador de organización** (rol con `priorityLevel ≤ 25` = `isOrgAdmin`): puede ver/editar **su propia organización**, ver listado completo (solo dentro de su org), pero no borrarse a sí misma.
2. **Usuario estándar**: `org.ver` si se lo asignan → puede leer los datos públicos de su org (nombre/NIT/logo), pero sin edición.
3. **Usuario con permisos org.crear / org.eliminar / org.listar**: futura cuenta de administración de plataforma multi-tenant (hoy no existen usuarios cross-org, pero los permisos se definen en la matriz RBAC consistente con `usuarios.*` y `proyectos.*`).

---

## Objetivos
1. Completar CRUD organizaciones en el backend siguiendo el patrón **exacto de `usuarios.*`**.
2. Exponer 2 UIs en frontend:
   - **Mi organización** (`/organizations/me`) — para cualquier usuario con `org.ver` o isOrgAdmin → visualiza y edita su propia organización (nombre, NIT, logo URL, estado).
   - **Organizaciones** (`/organizations`) — solo para isOrgAdmin o permiso `org.listar` → tabla paginada con crear/editar/eliminar (soft-delete) + filtros.
3. Registrar auditoría (tabla `Auditoria`) en CREATE, UPDATE y DELETE de org.
4. Definir permisos RBAC faltantes y agregarlos al `PermissionCode` del paquete compartido, de forma consistente con los ya existentes.

## No Objetivos
- ❌ Registro auto-servicio de organizaciones (sign-up público).
- ❌ Borrado permanente hard-delete + limpieza de cascada de usuarios/proyectos/archivos de una organización en esta entrega (solo soft-delete: `Estado = 'ELIMINADO'`). En el futuro se puede agregar `/:id/permanent` igual que usuarios.
- ❌ Upload de logo del org a S3; solo `logoUrl` string.
- ❌ Gestión de miembros dentro de una organización (eso ya se hace en `/users`).
- ❌ Cambios en el esquema de tabla `Organizaciones` (ya existe: `Id, Nombre, NIT, LogoUrl, Estado, FechaCreacion, FechaActualizacion`).

---

## Requisitos Funcionales (FR)

### Backend
- **FR1**: Compatibilidad con los endpoints existentes (backward compatible):
  - `GET /api/organizacion/` → retorna datos de **TU** organización (misma respuesta actual).
  - `PATCH /api/organizacion/` → actualiza **TU** organización (mismos campos y validaciones actuales).
- **FR2**: Endpoint Create `POST /api/organizacion/` → permiso `org.crear`. Body: `{ name: required, nit?: string|null, logoUrl?: string|null, status?: ACTIVO|INACTIVO }`. Retorna `201` + el objeto `Organization` creado. Registra auditoría `ORG_CREATED`.
- **FR3**: List `GET /api/organizacion/list` (o `GET /api/organizacion/` con query `?scope=all` — para no romper compat actual) → permiso `org.listar` **o** `isOrgAdmin`. Soporta `page`, `pageSize`, `search` (busca en Nombre/NIT), `status` (filtro Estado), `includeDeleted`. Retorna `PaginatedResult<Organization>` siguiendo el patrón de `listUsers`.
- **FR4**: Get por ID `GET /api/organizacion/:id` → permiso `org.ver` (si es la tuya) **o** `org.listar` (si es otra).
- **FR5**: Update por ID `PATCH /api/organizacion/:id` → permiso `org.editar` (si es la tuya) **o** `isOrgAdmin` de plataforma (hoy solo isOrgAdmin de la misma org, por consistencia con usuarios que no permiten cross-org editar sin permiso explícito). Validaciones mismas de FR1 + nombre no vacío.
- **FR6**: Soft Delete `DELETE /api/organizacion/:id` → permiso `org.eliminar`. No permite borrar la organización del usuario actual (igual que softDeleteUser impide borrarse a sí mismo). Hace `UPDATE Organizaciones SET Estado='ELIMINADO', FechaActualizacion=GETDATE() WHERE Id=@id`. Retorna `204`. Auditoría `ORG_DELETED`.
- **FR7**: Validación Zod/throw de BadRequest: nombre required ≥ 2, NIT ≤ 50, logoUrl ≤ 1000, status ∈ {ACTIVO, INACTIVO, ELIMINADO} para update, y status ELIMINADO solo se puede setear via DELETE (no permitir PATCH directo a ELIMINADO).
- **FR8**: Validación de nombre único global (o por nada si la BD lo permite). Si existe UNIQUE en `Nombre` en MSSQL → atrapar excepción y convertir a ConflictError.
- **FR9**: Permisos RBAC añadidos a `PermissionCode` type + `PERMISSION_CODES` Set en `packages/shared-types`:
  - `org.crear`
  - `org.eliminar`
  - `org.listar`
  (dejan existentes `org.ver` y `org.editar`)
- **FR10**: Auditoría para cada mutación usando `logAuditRecord` existente: `resourceType='ORGANIZATION'`, `action=ORG_CREATED|ORG_UPDATED|ORG_DELETED`, `resourceId=orgId`, `resourceName=org.name`.

### Frontend
- **FR11**: Servicio `frontend/src/services/organizations.service.ts` siguiendo el patrón de `users.service.ts`: `getMyOrganization`, `updateMyOrganization`, `listOrganizations`, `createOrganization`, `getOrganization`, `updateOrganization`, `deleteOrganization`.
- **FR12**: Página `OrganizationSettingsPage.tsx` en ruta `/organizations/me`:
  - Título "Mi organización".
  - Formulario con: Nombre (required), NIT (opcional), Logo URL (opcional string), badge Estado (readonly: Activo/Inactivo/Eliminado, texto descriptivo).
  - Botón Guardar (mutation PATCH /me o /) + Cancelar reset.
  - Muestra fecha creación y actualización.
  - Si el usuario NO tiene `org.editar`, el formulario está readonly.
  - Uso de React Query `useQuery` + `useMutation` con invalidate queries.
- **FR13**: Página `OrganizationsPage.tsx` en ruta `/organizations`, visible solo `isOrgAdmin` (igual que `/users` usa `Navigate to /projects replace` sin permiso):
  - Toolbar: `[+ Nueva organización]` | buscador "Buscar organización..." | filtro estado (Todos / Activos / Inactivos / Eliminados) | botón Filtros expandible.
  - Tabla con columnas: Nombre, NIT, Estado, Creado, Actualizado, Acciones (Editar · Eliminar).
  - Paginación al pie (pageSize 25, default).
  - Modal crear/editar organización con los campos de FR12 + selector Estado para admin.
  - Modal de confirmación al eliminar (soft) que advierte: "Al eliminar la organización se marcarán todos los recursos como ELIMINADOS en próximas versiones; hoy solo se marca la organización".
  - Estado visual con status badge (mismo mapping de colores que `userStatusMap`).
- **FR14**: Sidebar agrega 2 entradas después de "Usuarios" (grupo Administración):
  - `Mi organización` → `/organizations/me` icono `Building2` (ya importado). Visible para TODOS los usuarios autenticados.
  - `Organizaciones` → `/organizations` icono `Landmark` o `Shield`. Visible solo si `isOrgAdmin` (igual que Usuarios).
- **FR15**: Rutas en `App.tsx` → `path organizations` element OrganizationsPage; `path organizations/me` element OrganizationSettingsPage.

---

## Requisitos No Funcionales (NFR)

- **NFR1**: **Backward compatible** — ningún endpoint existente cambia su contrato. Los clientes antiguos que usan GET/PATCH `/api/organizacion/` siguen funcionando sin cambios.
- **NFR2**: Consistencia de patrones: organiza service/controller/routes debe seguir idéntico estilo de `users.service|controller|routes.ts` (Zod schemas separados, `extractUserError` style helper, `logAuditRecord` al final, `sql.UniqueIdentifier` para IDs, etc.).
- **NFR3**: TypeScript estricto, `tsc --noEmit` sin errores en `backend/`, `frontend/` y `packages/shared-types`.
- **NFR4**: No agregar dependencias nuevas al proyecto. Usar solo Tailwind 3, lucide-react, TanStack Query, Zustand, clsx, zod (backend sí usa zod).
- **NFR5**: No hacer migraciones BD (la tabla ya está creada). Si se necesita validación nombre único, hacerla en capa service con SELECT TOP 1 antes de INSERT/UPDATE; dejar el fallback de capturar excepción si existe UNIQUE constraint real en MSSQL.
- **NFR6**: Soft-delete pattern: `Estado = 'ELIMINADO'` y las listas por defecto `includeDeleted = false`, igual que usuarios.
- **NFR7**: UI responsive: la tabla en OrganizationsPage se colapsa en mobile (usar misma estrategia que UsersPage: `w-full overflow-x-auto`).
- **NFR8**: Mapping entre `EntityStatus` frontend (enum EN `ACTIVE/INACTIVE/DELETED/...`) y DB español (`ACTIVO/INACTIVO/ELIMINADO`) debe seguir los `DB_ENTITY_STATUS` en shared-types, igual que `toEsStatus`/`mapStatus` de users.service.

---

## Restricciones
- Solo organizaciones single-tenant operables por sesión en cuanto a permisos de "tu propia org". Cross-org listar/editar requiere permiso explícito `org.listar`/`org.editar` + permiso (hoy solo usuarios isOrgAdmin lo ven, por consistencia con el resto del KMS).
- No se puede eliminar tu propia organización en DELETE `/:id` con el usuario actual — ForbiddenError, igual que softDeleteUser no permite suicidio.
- No cambiar la tabla `Organizaciones` de MSSQL.
- No crear seeds de datos nuevos.

## Suposiciones
- `Estado ELIMINADO` en Organizaciones significa soft-delete y se excluye del listado default.
- El nombre de organización debe ser único globalmente en toda la BD (lo enforcamos en service SELECT + fallback catch).
- `NIT` es opcional, nullable, y no hay restricción unique a menos que la BD lo tenga.
- El icono `Landmark` para Organizations y `Building2` para Mi organización existen en lucide-react instalado; de no estar disponible `Landmark` se usa `Shield` igual que Usuarios para ambos.

## Preguntas abiertas (ninguna bloqueante; los defaults son arriba)
1. ¿Desea que se agregue endpoint `DELETE /:id/permanent` (borrado físico + cascada) **en esta entrega**? R/ No — fuera de scope, se agrega en una siguiente.
2. ¿Desea que `OrganizationsPage` lista sea visible solo para usuarios con permiso explícito `org.listar`, o ampliar a todos `isOrgAdmin` automáticamente? R/ Ambos: isOrgAdmin auto-gana el permiso (comportamiento actual `loadUserRolesToAuth` establece `isOrgAdmin → new Set(PERMISSION_CODES)` todos los códigos).

---

## Criterios de Aceptación

### Rule AC1 (RBAC codes added)
Los códigos `org.crear`, `org.eliminar`, `org.listar` aparecen tanto en el `type PermissionCode` como dentro del `PERMISSION_CODES` Set del paquete `packages/shared-types/src/index.ts`; `tsc --noEmit` en packages pasa.

### Rule AC2 (Backward compat)
Llamar `GET /api/organizacion/` y `PATCH /api/organizacion/` exactamente con los mismos payloads de la versión main produce exactamente la misma respuesta JSON (campos `id, name, nit/logoUrl, status, createdAt, updatedAt`); no hay campos removidos ni renombrados. Evidencia: diff contrato API vacío contra main.

### Rule AC3 (CRUD backend redondo)
Para un usuario isOrgAdmin (todos los permisos) autenticado:
- `POST /api/organizacion/` → `201` + org nueva con id UUID.
- `GET /api/organizacion/list?page=1&pageSize=25` → `{ items, total, page, pageSize, totalPages }` paginación correcta.
- `GET /api/organizacion/:id` → retorna esa org.
- `PATCH /api/organizacion/:id` → actualiza nombre/nit/logoUrl/estado (no ELIMINADO directo) y retorna updated org con updatedAt nuevo.
- `DELETE /api/organizacion/:id` → `204`. Después GET directo con includeDeleted=false lanza NotFound, includeDeleted=true retorna status=DELETED.
- Intentar `DELETE /api/organizacion/<TU PROPIA ORG ID>` → ForbiddenError 403.
- Intentar `PATCH /` o `GET /` sin token → 401 Unauthorized.
- Intentar cualquier endpoint cross-org sin permiso (usuario normal) → 403.

### Rule AC4 (Auditoría)
Después de cada create/update/delete existe una fila nueva en `Auditoria` con `TipoRecurso='ORGANIZATION'`, `IdRecurso=orgId`, `Accion ∈ {ORG_CREATED, ORG_UPDATED, ORG_DELETED}`. Evidencia: SELECT TOP 3 from Auditoria ORDER BY DESC después de ejecutar mutaciones.

### Rule AC5 (Frontend Mi organización)
Navegar `/organizations/me`:
- Muestra formulario con el nombre/nit/logoUrl/status actuales cargados via TanStack Query (no hay skeleton infinito).
- Al editar nombre y guardar, muestra estado exitoso y actualiza los datos en la página y en el store/query.
- Si se cierra sesión e inicia con usuario SIN `org.editar` (ej: Miembro normal), los campos son readonly y no aparece el botón Guardar.

### Rule AC6 (Frontend Organizaciones list CRUD)
Navegar `/organizations` como isOrgAdmin:
- Botón [+ Nueva organización] abre modal → crea org → aparece primer fila.
- Click Editar en la nueva fila → cambia el nombre y guardar → tabla actualiza nombre.
- Click Eliminar → confirmar → desaparece de la tabla (default includeDeleted=false).
- Filtro estado = Eliminados → vuelve a aparecer con badge "Eliminado".
- Paginación muestra totalPages correcto.
- Search por substring nombre filtra.

### Rule AC7 (Sidebar + Rutas)
- Existen `/organizations` y `/organizations/me` en App.tsx `<Route>`, no hay rutas huérfanas; `react-router-dom` navega con `<Link/>` sin recarga.
- Sidebar muestra "Mi organización" para todos los usuarios logueados y "Organizaciones" visible solo si `isOrgAdmin === true`. Evidencia: capture snapshot sidebar con usuario estándar vs admin.

### Rule AC8 (Typecheck)
- `cd packages/shared-types && npx tsc --noEmit` exit 0.
- `cd backend && npm run typecheck` exit 0.
- `cd frontend && npm run typecheck` exit 0 (ignorar los 7 warnings preexistentes de imports unused favorites/projects).

### Rule AC9 (No romper módulo actual users/proyectos)
`GET /api/usuarios` y `GET /api/projects` retorna exactamente lo mismo que en main. No se tocó ningún componente de `users.service.ts` ni `projects.service.ts` salvo imports que no afecten.

### Rubric AC10 (Calidad código UI/UX organizaciones page) — 0 a 4, pass ≥ 3
- (4) Visual idéntico a UsersPage: mismo badge de status, misma tabla, misma paginación flechas izquierda/derecha, modal overlay z-40 con overlay blur igual que crear usuario.
- (3) Casi idéntico pero difiere en 1-2 detalles visuales (spacing, iconos) sin romper UX.
- (2) Funciona pero estilos difieren significativamente del resto del sistema.
- (1) Crashea o no muestra datos.

### Rubric AC11 (Consistencia código backend organizaciones) — 0 a 4, pass ≥ 3
- (4) 1:1 paralelo a users.ts (schemas zod separados arriba del controller, helpers auth, mapping status ES↔EN función, auditoría al final de cada mutación, tx cuando sea necesario).
- (3) Cumple todo pero esquema zod inline sin separar const o falta mapping status.
- (2) Sin zod schema, validaciones a mano.
- (1) Errores runtime o queries sin parámetros (SQL injection riesgo).
