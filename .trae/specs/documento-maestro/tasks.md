# Documento maestro de proyecto - Plan de implementación (tasks)

## Task 1: Schema BD + migration SQL + reset actualizado
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Crear `infra/sql/migrations/20260905_documento_maestro.sql` idempotente:
    1. `ALTER TABLE Proyectos ADD IdDocMaestroCarpeta UNIQUEIDENTIFIER NULL;`
    2. `ALTER TABLE Proyectos ADD IdDocMaestroArchivo UNIQUEIDENTIFIER NULL;`
    3. Agregar 2 FK con `ON DELETE SET NULL` para Cascada Suave:
       - `FK_Proyectos_DocMaestroCarpeta REFERENCES Carpetas(Id) ON DELETE SET NULL`
       - `FK_Proyectos_DocMaestroArchivo REFERENCES Archivos(Id) ON DELETE SET NULL`
       (NOTA: ON DELETE SET NULL hace la NFR consitencia AUTOMATICO sin tocar services de files/folders/projects)
    4. Agregar CHECK `CK_Proyectos_DocMaestro_Xor`
       `CASE WHEN IdDocMaestroCarpeta IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN IdDocMaestroArchivo IS NOT NULL THEN 1 ELSE 0 END <= 1`
    5. 2 índices NONCLUSTERED sobre las FK para joins GET detail (performance).
  - Parchear [000_KMS_RESET_TOTAL.sql](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/infra/sql/000_KMS_RESET_TOTAL.sql) para que CREATE TABLE Proyectos incluya los 2 cols + FKs + CHECK + ÍNDICES inline (si se crea la BD desde cero no debe ejecutar migration). Seed Proyectos demo NULL en ambos campos.
  - Si `.gitignore` ignora el nuevo migration usar `git add --force`.
- **Acceptance Criteria Addressed**: AC-1, AC-6 (por FK ON DELETE SET NULL)
- **Test Requirements**:
  - `rule` TR-1.1: Ejecutar migration 2 veces → segunda con 0 errores.
  - `rule` TR-1.2: INSERT Proyectos con AMBOS campos not null → MSSQL error por CK.
  - `rule` TR-1.3: DELETE un Archivo que era maestro en un proyecto → el proyecto debe quedar ambos NULL (FK ON DELETE SET NULL).
  - `rule` TR-1.4: Reset completo BD, ver sys.columns/sys.foreign_keys/sys.check_constraints existen.
- **Notes**: La FK ON DELETE SET NULL reemplaza AC-6 "manual en services" por automatico DB. Si MSSQL 2014 soporta ON DELETE SET NULL (sí, lo soporta desde 2008).

## Task 2: Backend shared-types y types Project + DTOs
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - `packages/shared-types/src/index.ts`:
    - Extender interface `Project` con 2 nuevos campos optional `docMaestroCarpetaId?: string | null; docMaestroArchivoId?: string | null;`.
    - Agregar interface `DesignateMasterDocPayload` `{ resourceType: 'FOLDER'|'FILE'; resourceId: string }`.
    - Agregar interface `ProjectMasterDocInfo` expandido `{ resourceType: 'FOLDER'|'FILE'; resourceId: string; name: string; path: string; size?: number|null; lastUpdatedAt?: string|null; ownerId?: string|null; ownerName?: string|null; }`.
  - Frontend/backend lo consumen via type imports.
- **Acceptance Criteria Addressed**: AC-5 (nuevo type expandido)
- **Test Requirements**:
  - `rule` TR-2.1: `npx tsc --noEmit` en packages/shared-types → 0 errores.
  - `rule` TR-2.2: Ambos interfaces nuevas importables sin error en projects.service.ts y projects.service (frontend).

## Task 3: Backend routes + controller endpoints PATCH / DELETE / GET maestro
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - [projects.routes.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/projects/projects.routes.ts) agregar 3 rutas:
    - `PATCH /:id/documento-maestro` → `requireResourcePermission('PROJECT','ADMINISTRAR')` → `patchDocumentoMaestroEndpoint`
    - `DELETE /:id/documento-maestro` → `requireResourcePermission('PROJECT','ADMINISTRAR')` → `clearDocumentoMaestroEndpoint`
  - [projects.controller.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/projects/projects.controller.ts) implementar:
    - `patchDocumentoMaestroEndpoint`:
      * Validar body `resourceType ∈ {FOLDER,FILE}`, `resourceId` UUID.
      * Validar pertenencia:
        - FOLDER: `Carpetas.Id = @rid AND Carpetas.IdProyecto = @pid` (1 query).
        - FILE: (`Archivos.IdProyecto = @pid`) O bien (IdProyecto NULL AND EXISTS join FolderHierarchy) (reutilizar lógica de huérfanos de projects.service).
      * Transaction begin → UPDATE Proyectos: si tipo FOLDER `SET IdDocMaestroCarpeta = @rid, IdDocMaestroArchivo = NULL`; si FILE lo inverso. `FechaActualizacion = GETDATE()`.
      * SELECT antes (el estado previo) y después en TX.
      * commit.
      * logAuditRecord best-effort `project.documento_maestro.actualizado` con `antes/despues/modo`.
      * 200 OK devuelve `{ success:true, data:{ documentoMaestro: ProjectMasterDocInfo|null }}` o `{ documentSaved:true }`.
    - `clearDocumentoMaestroEndpoint`: similar pero UPDATE ambos NULL. HTTP 204. Audit con modo 'clear'.
  - Cambios adicionales en el `getProject` (detail endpoint): Agregar LEFT JOIN a Carpetas/Archivos en el SELECT detail o un lookup adicional para devolver `documentoMaestro` expandido (ProjectMasterDocInfo). Si ambas FKs NULL → `null`.
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `rule` TR-3.1: `curl PATCH` designa FOLDER → 200 + BD correcto + audit 1 fila.
  - `rule` TR-3.2: Luego `curl PATCH` designa FILE → XOR OK (folder col = NULL).
  - `rule` TR-3.3: Miembro sin ADMIN → Forbidden 403.
  - `rule` TR-3.4: `curl DELETE` → 204, ambos NULL, audit clear.
  - `rule` TR-3.5: GET projects detail ahora tiene `documentoMaestro` con `resourceType/resourceId/name/path` cuando está designado.
  - `rule` TR-3.6: Designar recurso de OTRO proyecto (mismo org) → 400/404, BD no cambia.

## Task 4: Backend consistency - servicios de borrado aseguran limpieza (doble seguridad)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - Aunque Task 1 ya usa FK ON DELETE SET NULL, agregar un SET NULL explícito como defensa-in-profundidad en los service deletes si los service usan `DELETE FROM Archivos WHERE ... IN @Archivos` statement (para asegurarnos):
    - [projects.service.ts permanentDeleteProject](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/projects/projects.service.ts#L88-L251): Antes de `DELETE Archivos` o `DELETE Carpetas`, actualizar el proyecto a ambos NULL dentro del mismo query (ya que ON DELETE CASCADE de Proyectos → Carpetas/Archivos no hay, son al revés). No es requerido, pero es OK agregar.
  - [files.service.ts delete endpoint](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/files/files.service.ts) - antes del DELETE, `UPDATE Proyectos SET IdDocMaestroArchivo = NULL WHERE IdDocMaestroArchivo = @fileId AND IdOrganizacion = @orgId`. Igual en folders.service.ts. Esto es sobre el FK, pero NO HACE FALTA porque Task 1 FK ON DELETE SET NULL ya lo hace. Pero agregar un comentario/documento es suficiente.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-4.1: Si hacemos DELETE Archivo (master) desde el endpoint HTTP normal, el proyecto vuelve a NULL (comprobar con SELECT; la prueba ya debe pasar por FK sola).

## Task 5: Frontend services - funciones para designar/quitar maestro
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - [frontend projects.service.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/services/projects.service.ts#L171-L183):
    - `export async function designateProjectMaster(projectId: string, payload: DesignateMasterDocPayload)` → PATCH `/projects/${projectId}/documento-maestro` 200.
    - `export async function clearProjectMaster(projectId: string)` → DELETE 204.
    - Actualizar `ProjectDetail` type / `ApiProject` type si falta `documentoMaestro: ProjectMasterDocInfo | null`.
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TR-5.1: `tsc --noEmit` frontend → 0 nuevos errores.

## Task 6: Frontend UI - Pestaña Documento maestro
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - En [ProjectDetailPage.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx#L1843-L1859) reemplazar el fallback general `activeTab !== 'docs' && activeTab !== 'team'` con un branch PRIMERO para `activeTab === 'master'`.
  - Estado designado: Card con icono FileCheck2, nombre del recurso, breadcrumbs/path (join de carpeta padre para archivos, ruta parent para carpetas), meta (actualizado Hace X días, propietario), botón "Abrir" que setea `selectedFolderId` y cambia al tab `docs` o navega al archivo. Botón "Quitar designación" con confirmación (solo visible si el usuario tiene permiso PROJECT ADMINISTRAR).
  - Estado NO designado: card CTA "Todavía no hay un documento maestro designado." Explicación 2 líneas + botón "Designar existente" que abre un modal "Seleccionar recurso".
  - Modal seleccionar recurso: 2 tabs (Carpetas, Archivos). Usar folderTree existente `folderTree` para selección de carpeta; y la query de files sin search para archivos. Aceptar → llama `designateProjectMaster` → invalidateQueries('project','detail').
  - useMutation designateProjectMaster onSuccess `setPageToast({kind:'success', title:'Documento maestro designado', message:'...'})`. onError `setPageToast({kind:'error'...})`. Mismo pattern que el toast inline ya existente L206.
  - clean up auto toast useEffect ya existente L903.
- **Acceptance Criteria Addressed**: AC-7, AC-8, AC-9 (badge más tarde)
- **Test Requirements**:
  - `rule` TR-6.1: No existe `activeTab === 'master'` → fallback modulo construcción.
  - `rule` TR-6.2: Snap tab master con y sin designación no muestra "Módulo en construcción".
  - `rubric` TR-6.3: Diseño y experiencia visual. Scale 1-5; 1=roto; 3=usable simple; 5=sigue diseño cards del KMS, colores brand, iconos lucide, deshabilita botones con permisos. Threshold >=4.

## Task 7: Frontend UI - Context menu Designar / Quitar
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 6
- **Description**:
  - En folderContextMenu y fileContextMenu (ProjectDetailPage.tsx donde están definidos):
    - Agregar separator + item `{ icon: FileCheck2, label: "Designar como documento maestro", onClick: () => designar}`.
    - Item disabled si YA está designado (o cambia label a "Quitar designación de documento maestro").
    - Solo visible si el user tiene permiso (comparar con `requireResourcePermission('PROJECT','ADMINISTRAR')` equivalente frontend, o bien un state computado que lee los permisos del usuario en el proyecto. Si no hay sistema de permisos frontend todavía, se muestra solo a `authUser.isOrgAdmin` OR `project.ownerId === authUser.id` como proxy).
  - Mutations usan el helper de Task 5 + toast state.
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rubric` TR-7.1: Discoverabilidad. Scale 1-5. 1=sin menú; 3=en un menú; 5=aparece tanto en file como folder menu, icono FileCheck2, texto claro, disabled cuando aplica. Threshold >=4.

## Task 8: Frontend UI - Badge Maestro en lista docs y árbol de carpetas
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 6
- **Description**:
  - En el árbol de carpetas: cada nodo name se compara con `projectQuery.data?.project.docMaestroCarpetaId`; si coincide, badge `<Badge>📌 Maestro</Badge>` pequeño inline.
  - En lista docs/files: cada fila compara file.id === `docMaestroArchivoId` o `folder.id === docMaestroCarpetaId`, agrega badge 16px alto antes del nombre (no ocupa mucho).
  - Usar estilos consistentes con el sistema (pequeño, color brand, icono FileCheck2).
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `rubric` TR-8.1: Visibilidad. Scale 1-5. 1=ninguna marca; 3=solo 1 lugar; 5=ambos lugares (árbol y lista) visible sin romper layout. Threshold >=4.

## Task 9: Typecheck y smoke tests HTTP reales, commit + merge
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1-8 completos
- **Description**:
  - Backend `tsc --noEmit` y frontend `tsc --noEmit`.
  - HTTP smoke reales: Designar (patch) folder → designar file (cambia) → quitar (delete) → query maestro null, todo con token admin. Repetir con Carlos Miembro → Forbidden 403.
  - Eliminar archivo maestro desde endpoint files → FK SET NULL pasa (comprobar SELECT).
  - Crear commit limpio `feature(documento-maestro): e2e schema FK XOR + API PATCH/DELETE + UI tab/contextmenu/badge`. Merge `--no-ff` a `main` al final (si el usuario aprueba antes el spec).
- **Acceptance Criteria Addressed**: AC-1..AC-10
- **Test Requirements**:
  - `rule` TR-9.1: backend tsc → 0 nuevos errores.
  - `rule` TR-9.2: frontend tsc → 0 nuevos errores.
  - `rule` TR-9.3: 6 smoke HTTP pass (PATCH folder/ PATCH file/ DELETE designación / 403 miembro / GET detail / delete file→ SET NULL).
