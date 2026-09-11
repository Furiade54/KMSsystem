# Correcciones RBAC y Seguridad — Implementation Plan

## Repository Research

Diagnóstico confirmado en la BD `KMS` (SQL Server 2014 instancia `IST`) y código fuente:

| # | Problema | Severidad | Ubicación |
|---|---|---|---|
| 1 | Usuario `asd@kms.local` ACTIVO pero **sin fila en `RolesUsuario`** | Medio | BD tabla `RolesUsuario` |
| 2 | Tabla `PermisosRol` vacía (0 filas) con 26 permisos catálogo sin asignar | Alto | BD tablas `Permisos`, `PermisosRol` |
| 3 | No existe middleware/validación RBAC: cualquier usuario autenticado puede acceder a `GET/POST/PATCH/DELETE /api/usuarios/*` sin restricción | Alto | [users.routes.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/users/users.routes.ts) |
| 4 | El token JWT y `req.auth` no incluyen roles del usuario — el middleware no puede resolver roles sin consultar BD en cada request | Alto | [auth.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/shared/middleware/auth.ts), [auth.service.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/auth/auth.service.ts) |
| 5 | Frontend `UserShape` en `authStore` no tiene campo `roles` — `Sidebar` muestra link "Usuarios" a TODO el mundo sin filtrar | Medio | [authStore.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/store/authStore.ts), [Sidebar.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/components/layout/Sidebar.tsx) |
| 6 | `auth.service.login` devuelve user sin roles; `/auth/me` (hydrate) tampoco adjunta roles | Alto | [auth.service.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/auth/auth.service.ts) |

### Diseño del modelo RBAC pragmático (no romper existing code)

**Criterio de rol administrativo**: un usuario tiene "privilegios de administración org" si **alguno de sus roles** tiene `NivelPrioridad <= 25` (o sea, el rol "Administrador" que en seed tiene NivelPrioridad=10 entra, "Miembro" con 50 no). Esto es extensible: cualquier rol nuevo con prioridad alta (<=25) otorga acceso admin.

**No usaremos `Permisos`/`PermisosRol` en runtime por ahora** (vacío y no integrado). En cambio se siembra la tabla `PermisosRol` con una asignación 1:1 por coherencia con el catálogo, y la validación real en código se basa en `NivelPrioridad` del rol.

## Files and Modules

### Backend (BD + API)
- Script de seed SQL + perm asignaciones:
  - `infra/sql/migrations/20260903_fix_rbac_roles.sql` (CREATE if not exist)
- Middleware RBAC:
  - `backend/src/shared/middleware/auth.ts` — añadir `requireRole` y extender `AuthContext` con `roles` + `isOrgAdmin`.
  - `backend/src/shared/middleware/rbac.ts` (nuevo) — helper `loadUserRolesToAuth`, `requireOrgAdmin`.
- Servicios:
  - `backend/src/modules/auth/auth.service.ts` — `login` y `getUserById` devuelven `User.roles` poblados.
  - `backend/src/modules/users/users.service.ts` — reutilizar `fetchRolesForUser`.
- Rutas protegidas:
  - `backend/src/modules/users/users.routes.ts` — `requireAuth` + `requireOrgAdmin` en todas las rutas.

### Frontend (UI guard)
- `packages/shared-types/src/index.ts` — asegurar `User.roles` presente.
- `frontend/src/store/authStore.ts` — extender `UserShape` con `roles` y `isOrgAdmin`.
- `frontend/src/components/layout/Sidebar.tsx` — ocultar link "Usuarios" a no-admins.
- `frontend/src/pages/UsersPage.tsx` — redirect / guard si no es admin.

## Implementation Steps

1. **Seed BD: script SQL `20260903_fix_rbac_roles.sql`**
   - Asignar rol "Miembro" al usuario `asd@kms.local` (fix punto 1).
   - Poblar `PermisosRol` asignando los 26 permisos catálogo:
     - Administrador → TODOS los 26 permisos (cobertura total).
     - Miembro → permisos no-admin (org.ver, proyectos.ver/crear, archivos.*, comentarios.crear, favoritos.gestionar, revisiones.ver, solicitudes.* (no aprobar)).
   - Ser idempotente: `IF NOT EXISTS` en cada INSERT.

2. **Backend: extender AuthContext con roles y helpers RBAC**
   - En `auth.ts` o nuevo `rbac.ts`:
     - `async loadUserRolesToAuth(req)` → consulta `fetchRolesForUser`, adjunta `roles: RoleAssignment[]` y `isOrgAdmin: boolean` (algún rol con `priorityLevel <= 25`) a `req.auth`.
     - `requireOrgAdmin(req, res, next)` → 403 si `!req.auth?.isOrgAdmin`.
   - `requireAuth` seguirá siendo liviano (no consulta BD). `requireOrgAdmin` será el segundo middleware en cadena (solo en rutas que lo necesiten). Debe cargar los roles si aún no están.

3. **Backend: `auth.service.login` y `getUserById` retornan roles**
   - `login`: después de generar el token, invocar `fetchRolesForUser(row.Id)` y adjuntar `.roles` al User devuelto.
   - `getUserById` (usado por `/auth/me` / hydrate): mismo paso — cargar roles.
   - Exportar `fetchRolesForUser` desde `users.service.ts` si no lo está.

4. **Backend: proteger rutas `/usuarios/*`**
   - En `users.routes.ts`, tras `requireAuth`, componer `requireOrgAdmin` para TODO el router o por ruta (todo el módulo es admin-only).
   - Añadir una validación extra: el usuario no admin que acceda recibe 403.

5. **Frontend: extender tipos**
   - En `authStore.ts`, añadir a `UserShape` los campos:
     - `roles?: Array<{ id: string; name: string; isSystemRole: boolean; priorityLevel?: number; assignedAt?: string | null; assignedBy?: string | null }>`
     - `isOrgAdmin?: boolean`
   - Al hidratar / hacer login, calcular `isOrgAdmin` a partir de los roles.

6. **Frontend: Sidebar oculta link "Usuarios" a no admins**
   - En `Sidebar.tsx`, filtrar `navItems`: el link `/users` solo se renderiza si `authStore.user?.isOrgAdmin === true`.

7. **Frontend: `UsersPage` redirect guard**
   - Si `!isOrgAdmin`, redirigir a `/projects` o mostrar aviso. Mantener el guard de backend (403) como fuente de verdad.

## Dependencies and Considerations

- **SQL Server 2014**: usar sintaxis compatible (NO `OUTPUT` con subqueries). El script de seed usa `IF NOT EXISTS` + `INSERT`.
- **Compatibilidad hacia atrás**: `AuthContext` extendido usa campos opcionales; código existente que solo usa `userId/organizationId` no se rompe.
- **`NivelPrioridad <= 25` como umbral admin**: elegido porque el rol Administrador seed tiene 10 y Miembro 50. Cualquier rol futuro con valor entre 1-25 contará como admin. Este umbral se define como constante en el módulo RBAC y es fácil de cambiar.
- **Evitar N+1**: `requireOrgAdmin` consulta roles una sola vez por request y los guarda en `req.auth`. Si un mismo request necesita los roles varias veces, se reutilizan.
- **Frontend UserShape compatible con storage existente**: `roles` e `isOrgAdmin` son opcionales (`?`). Si un usuario tiene localStorage antiguo (sin roles), al hacer `/auth/me` se refresca y se hidrata correctamente.
- **No tocar `PermisosRecurso`**: está vacío y no es requerido; lo dejamos para fases posteriores.

## Validation

1. **Script SQL**: ejecutar `20260903_fix_rbac_roles.sql` y re-correr `check_roles_tables.ts` para confirmar:
   - Usuario `asd@kms.local` aparece en asignaciones de roles.
   - `PermisosRol` tiene ~30+ filas (26 Admin + ~15 Miembro).
2. **API**:
   - Login como `admin@kms.local` → respuesta incluye `user.roles` y puede acceder a `GET /api/usuarios` → 200.
   - Login como `ana@kms.local` (Miembro) → `GET /api/usuarios` → 403 Forbidden.
   - `/auth/me` con ambos usuarios devuelve `roles` e `isOrgAdmin` correcto.
3. **Typecheck**:
   - `backend`: `npm run typecheck` sin errores.
   - `frontend`: `npx tsc --noEmit` sin errores.
4. **UI Sidebar**: logueado como Ana → no aparece "Usuarios" en sidebar; logueado como Admin → sí aparece.
5. **Lint**: opcional `npm run lint` en backend.

## Risks

| Riesgo | Mitigación |
|---|---|
| Login response schema cambia y rompe frontend | `roles` se añade como campo opcional en `User` (ya lo está en `shared-types`). Frontend lo acepta sin cambios inmediatos si no lo usa. |
| Usuario con roles antiguos en localStorage no tiene `isOrgAdmin` | Al hydrate se llama a `/auth/me` y pisa `user` con el fresco que sí trae roles. Caso offline: se considera no-admin hasta revalidación. |
| Performance: consulta roles en cada request admin | Se carga una sola vez en `req.auth` dentro del lifecycle de un request. Para endpoints no-admin el costo es cero. |
| Script SQL de seed con IDs hardcodeados de roles y org | Usar lookups por `Nombre` y `Correo` (no IDs) para ser resiliente. |
