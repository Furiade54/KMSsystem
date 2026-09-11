# Tasks — CRUD Organizaciones

Plan de implementación vertical. Cada task cubre una tarea pequeña, atómica y verificable.

Prioridad:
- `high`: Bloquea otros tasks o es requisito AC obligatorio.
- `medium`: Se puede posponer pero está en scope.
- `low`: Opcional o mejora UX.

---

## Task 1: Ampliar permisos RBAC + DTOs en shared-types

**Depends on**: —  
**Status**: pending  
**Priority**: high  

### Descripción
En `packages/shared-types/src/index.ts` agregar:
1. Añadir 3 literales a `PermissionCode`:
   - `org.crear`
   - `org.eliminar`
   - `org.listar`
2. Añadir esos 3 strings al `PERMISSION_CODES` Set (líneas ~135-162).
3. Añadir tipos DTO arriba de `Organization` o junto a CreateUserDto:
   ```ts
   export interface CreateOrganizationDto {
     name: string
     taxId?: string | null
     logoUrl?: string | null
     status?: EntityStatus // default ACTIVE
   }
   export interface UpdateOrganizationDto {
     name?: string
     taxId?: string | null
     logoUrl?: string | null
     status?: EntityStatus // no permitir DELETED directo; validar en controller
   }
   ```
4. Actualizar `Organization` type para que coincida exactamente con lo que retorna `mapOrg` actual (campo `taxId` vs `nit`: actualmente `taxId` en el type compartido vs `nit`/`NIT` en BD). Dejar consistente (todo `taxId` en tipos compartidos; en el service mapear NIT → taxId). Alinear con `mapOrg` actual en service (retorna `nit`; renombrarlo a `taxId` para que coincida el shared type).

### Test Requirements (TR)
- **TR1 (rule)**: `tsc --noEmit` dentro de `packages/shared-types` exit 0.
- **TR2 (rule)**: Search `type PermissionCode = ` ahora incluye 5 strings empezando por `org.` (ver, editar, crear, eliminar, listar).
- **TR3 (rule)**: Los DTOs `CreateOrganizationDto` y `UpdateOrganizationDto` se exportan y tienen las propiedades requeridas sin optional incorrectos.

### Completion Evidence
Link a diff de `index.ts`; salida tsc exitosa.

---

## Task 2: Ampliar organizations.service (backend)

**Depends on**: Task 1 (packages types)  
**Status**: pending  
**Priority**: high

### Descripción
Modificar `backend/src/modules/organizations/organizations.service.ts`:

1. **Consistencia naming**: cambiar `Organization` interface interna `nit` por `taxId` para alinear con shared type; actualizar `mapOrg` → `taxId: row.NIT ?? null`.
2. Añadir mappings status ES↔EN (igual que users):
   ```ts
   const STATUS_ES_TO_EN: Record<string, EntityStatus> = { ACTIVO:'ACTIVE', INACTIVO:'INACTIVE', ELIMINADO:'DELETED' }
   const STATUS_EN_TO_ES: Record<string,string> = { ACTIVE:'ACTIVO', INACTIVE:'INACTIVE', DELETED:'ELIMINADO' }
   function mapStatus(es:unknown): EntityStatus {...}
   function toEsStatus(en: EntityStatus|undefined): string {...}
   ```
3. **Añadir funciones**:
   - `async listOrganizations(pool, authOrgId, opts: {page?, pageSize?, search?, status?, includeDeleted?}): Promise<PaginatedResult<Organization & { usersCount?: number; projectsCount?: number }>>`:
     - COUNT total con WHERE filters.
     - SELECT rows con OFFSET/FETCH order by FechaCreacion DESC.
     - Scope default: SOLO tu propia org si el usuario no tiene `org.listar` (revisar más adelante en controller; en el service scope cross-org por authOrgId lo decide el caller). Para ser consistente con `listUsers`, scope por `IdOrganizacion=@orgId`. Dado que Organizaciones no tiene IdOrganizacion (la tabla es propia), listOrganizations scope: por default incluir SOLO la org del usuario; si el controller confirma que el caller tiene permiso `org.listar` (administración plataforma), pasar un flag `crossOrg: true`. Implementar flexible.
   - `async createOrganization(pool, dto: CreateOrganizationDto, creatorAuth: { organizationId:string; userId:string }, req?): Promise<Organization>`:
     - Generar UUID crypto.
     - Validar nombre not empty + dup check `SELECT TOP 1 Id FROM Organizaciones WHERE Nombre = @nombre`.
     - INSERT INTO (Id, Nombre, NIT, LogoUrl, Estado, FechaCreacion, FechaActualizacion) values (UUID, ..., GETDATE(), NULL).
     - `logAuditRecord` action=ORG_CREATED.
     - Retornar getOrganizationById.
   - `async softDeleteOrganization(pool, auth: {organizationId, userId}, orgId: string, req?): Promise<void>`:
     - Check `orgId === auth.organizationId` → Forbidden.
     - SELECT check EXISTS; if not → NotFound.
     - UPDATE SET Estado='ELIMINADO', FechaActualizacion=GETDATE().
     - Auditoría ORG_DELETED.
   - Añadir flag en `updateOrganization` que rechace `status === 'DELETED'` → BadRequestError (prohibido actualizar a ELIMINADO via PATCH; solo via DELETE).

### Test Requirements
- **TR1 (rule)**: `tsc --noEmit backend` exit 0.
- **TR2 (rule)**: `mapOrg` retorna `taxId` (renombrado desde NIT) compatible con shared type.
- **TR3 (rule)**: `updateOrganization` con status=DELETED lanza BadRequestError.
- **TR4 (rule)**: `softDeleteOrganization` con la misma org del usuario lanza ForbiddenError.

### Completion Evidence
Salida tsc + tests de funciones manual (o al menos verificación por código source).

---

## Task 3: Controller + Routes (endpoints CRUD completo)

**Depends on**: Task 2  
**Status**: pending  
**Priority**: high

### Descripción

#### 3.1 Controller `organizations.controller.ts`
Añadir Zod schemas:
```ts
const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Nombre requerido').max(200),
  taxId: z.string().max(50, 'NIT demasiado largo').nullable().optional(),
  logoUrl: z.string().max(1000, 'URL logo demasiado larga').nullable().optional(),
  status: z.enum(['ACTIVE','INACTIVE']).optional(),
})

const UpdateOrgSchema = z.object({
  name: z.string().min(2, 'Nombre requerido').max(200).optional(),
  taxId: z.string().max(50).nullable().optional(),
  logoUrl: z.string().max(1000).nullable().optional(),
  status: z.enum(['ACTIVE','INACTIVE']).optional(), // no DELETED
})
```

Añadir handlers:
- `createOrganizationHandler` → `CreateOrgSchema.parse`, llama service create, retorna 201.
- `listOrganizationsHandler` → lee page/pageSize/search/status/includeDeleted query params, llama service list.
- `getOrganizationByIdHandler` → lee param id, llama `getOrganizationById`, pero scope: si id ≠ auth.organizationId entonces caller requiere `org.listar` (middleware `requirePermission('org.listar')` ya lo ponemos en routes).
- `updateOrganizationByIdHandler` → `UpdateOrgSchema`, mismo scope de arriba.
- `deleteOrganizationHandler` → llama `softDeleteOrganization`, retorna 204.

Helper `buildOrgError(payload, fallback)` igual que users.service `buildError`.

#### 3.2 Routes `organizations.routes.ts`
Conservar los endpoints actuales (backward compat):
```
GET    /                     requireAuth + requirePermission('org.ver')     getOrganizationEndpoint     (= mi org)
PATCH  /                     requireAuth + requirePermission('org.editar')  updateOrganizationEndpoint  (= mi org)
```
Añadir nuevos endpoints (orden importante, `/:id` al final):
```
POST   /                     requireAuth + requirePermission('org.crear')   createOrganizationHandler
GET    /list                 requireAuth + requirePermission('org.listar')  listOrganizationsHandler
GET    /:id                  requireAuth + requirePermission(['org.ver', 'org.listar'])  getOrganizationByIdHandler
PATCH  /:id                  requireAuth + requirePermission('org.editar')  updateOrganizationByIdHandler
DELETE /:id                  requireAuth + requirePermission('org.eliminar') deleteOrganizationHandler
```

### Test Requirements
- **TR1 (rule)**: Endpoints GET/PATCH `/` sin cambio signature ni path → backward compat.
- **TR2 (rule)**: Handler `createOrganizationHandler` pasa Zod y retorna 201 con id.
- **TR3 (rule)**: DELETE `/:id` retorna 204 y org marca ELIMINADO.
- **TR4 (rule)**: Typecheck backend `tsc --noEmit` exit 0.

### Completion Evidence
Archivos controller/routes + typecheck exit code.

---

## Task 4: Frontend service organizaciones

**Depends on**: Task 1 (shared types)  
**Status**: pending  
**Priority**: high

### Descripción
Crear `frontend/src/services/organizations.service.ts` siguiendo el patrón de `users.service.ts` (usar api instance, `ApiResponse<T>` wrapper, helpers `buildError` igual style).

Exportar:
```ts
import type { CreateOrganizationDto, UpdateOrganizationDto, EntityStatus, Organization, PaginatedResult } from '../../../packages/shared-types/src'

export type ApiOrganization = Organization & { usersCount?: number; projectsCount?: number }

export const orgStatusMap: Record<EntityStatus|string, { label, dotClass, textClass, bgClass }> = { ... igual que userStatusMap }
export function orgStatusInfo(status?: EntityStatus|string)

export interface ListOrganizationsParams {
  page?: number, pageSize?: number, search?: string, status?: string, includeDeleted?: boolean
}

export async function getMyOrganization(): Promise<Organization>
export async function updateMyOrganization(payload: UpdateOrganizationDto): Promise<Organization>

export async function listOrganizations(params: ListOrganizationsParams): Promise<PaginatedResult<ApiOrganization>>
export async function getOrganization(orgId: string): Promise<ApiOrganization>
export async function createOrganization(payload: CreateOrganizationDto): Promise<Organization>
export async function updateOrganization(orgId: string, payload: UpdateOrganizationDto): Promise<Organization>
export async function deleteOrganization(orgId: string): Promise<void>

export function extractOrgError(err: any, fallback: string): string
```

Rutas backend a llamar:
- `GET /api/organizacion/` → my org
- `PATCH /api/organizacion/` → update my org
- `GET /api/organizacion/list?page=...` → list
- `POST /api/organizacion/` → create
- `GET/PATCH/DELETE /api/organizacion/:id` → by id

### Test Requirements
- **TR1 (rule)**: typecheck frontend `tsc --noEmit` exit 0.
- **TR2 (rule)**: Cada función exportada usa `api.get/post/patch/delete` correctos paths.

### Completion Evidence
Archivo service creado + typecheck.

---

## Task 5: Páginas frontend OrganizationSettings y Organizations list

**Depends on**: Task 4 + Task 3 endpoints listos  
**Status**: pending  
**Priority**: high

### 5.1 OrganizationSettingsPage.tsx
- Ruta `/organizations/me`.
- Permisos: si authStore hidratado y sin org.ver visibles → mostrar pantalla permisos insuficientes o nav. No usar redirect por ahora.
- UI igual a formulario de edición UsersPage:
  - `<Card>` o wrapper.
  - inputs: Nombre (text), NIT (text), Logo URL (text), Status badge readonly.
  - Botones Guardar / Cancelar.
  - useQuery `['organization','me']` + mutation `updateMyOrganization` con invalidateQueries.
  - useAuthStore para detectar si tiene permiso editar → deshabilitar inputs si no.
  - ReadOnly banner descriptivo si no puede editar.

### 5.2 OrganizationsPage.tsx
- Ruta `/organizations`.
- Solamente visible si `isOrgAdmin`; sino `<Navigate to="/projects" replace />`.
- Paginación, search debounced 350ms, status filter Todos/Activos/Inactivos/Eliminados igual que UsersPage (type StatusFilter 'ALL' | EntityStatus).
- Tabla con 6 columnas (Nombre, NIT, Estado, Creado, Actualizado, Acciones).
- Botón + Nueva organización → modal create.
- Menú acciones Editar / Eliminar → confirm modal → mutation + invalidate.
- Status badge con colores de `orgStatusMap`.

### Test Requirements
- **TR1 (rule)**: Typecheck OK (tsc --noEmit).
- **TR2 (rule)**: Las rutas renderizan sin warnings.
- **TR3 (rule)**: Mutations disparan invalidateQueries.

### Completion Evidence
2 archivos de páginas creados.

---

## Task 6: App.tsx rutas + Sidebar entradas

**Depends on**: Task 5  
**Status**: pending  
**Priority**: high

### Descripción
1. `App.tsx` → importar OrganizationsPage y OrganizationSettingsPage.
2. Añadir rutas dentro del `<Route path="/" element={<AppLayout />}>`, antes del catch-all o después de users:
   ```
   <Route path="organizations/me" element={<OrganizationSettingsPage />} />
   <Route path="organizations" element={<OrganizationsPage />} />
   ```
3. `Sidebar.tsx`:
   - Importar `Landmark` (o `Building2` fallback) de lucide-react.
   - Añadir a `navItems` después de `/users`:
     ```ts
     { to: '/organizations/me', label: 'Mi organización', icon: Building2 },
     { to: '/organizations', label: 'Organizaciones', icon: Landmark, adminOnly: true },
     ```
   - Añadir campo `adminOnly?: boolean` a los items de nav para filtrar:
     ```ts
     visibleNavItems = navItems.filter(item => {
       if (item.to === '/users' || (item as any).adminOnly) return isOrgAdmin
       return true
     })
     ```
   - Mantener Usuarios visible igual (no romper).

### Test Requirements
- **TR1 (rule)**: App.tsx compila con routes nuevos.
- **TR2 (rule)**: Sidebar renderiza "Mi organización" y solo muestra "Organizaciones" a `isOrgAdmin`.
- **TR3 (rule)**: Click sidebar link → cambia URL sin recarga.

### Completion Evidence
Ediciones App.tsx y Sidebar.tsx.

---

## Task 7: Validación final (typecheck + smoke tests manuales)

**Depends on**: Tasks 1-6  
**Status**: pending  
**Priority**: medium

### Descripción
1. Ejecutar `tsc --noEmit` en los 3 proyectos:
   - packages/shared-types
   - backend
   - frontend
2. Smoke check rutas:
   - `GET /api/organizacion/` (compat).
   - `POST, PATCH, DELETE, GET /list` (nuevos).
3. Revisar que UsersPage no haya roto (no editamos, salvo imports; comprobar tsc).

### Test Requirements
- **TR1 (rule)**: Los 3 tsc exit 0. Frontend puede tener los 7 warnings preexistentes de favorites no usados; ningún error nuevo.

### Completion Evidence
Terminal outputs.
