# Documento maestro de proyecto (KMS) - PRD / Especificación

## Overview
- **Summary**: Añade la noción de Documento maestro a cada proyecto. El usuario administrador/propietario puede designar (y des-designar) una Carpeta o Archivo existente como "Documento maestro" (fuente única de verdad / punto de acceso único). El campo se expone en la API, se persiste en la tabla `Proyectos` con 2 FK (`IdDocMaestroCarpeta`, `IdDocMaestroArchivo`), es XOR-exclusivo (máximo uno de los dos ≠ NULL), valida pertenencia al proyecto, escribe auditoría, y se ve/gestiona desde una nueva pestaña "Documento maestro" del detalle del proyecto y desde el menú contextual.
- **Purpose**: Evitar que los miembros "se pierdan" entre 50+ carpetas; marcar explícitamente qué recurso es el acta o entrada oficial del proyecto (Project Charter, índice wiki, diseño final, contrato).
- **Target Users**: Propietario del proyecto / Administrador de organización / Miembros (lectura).

## Goals
- G1: Designar cualquier carpeta o archivo existente del proyecto como su Documento maestro sin duplicar contenido.
- G2: Cualquier miembro del proyecto pueda consultar (con 1 clic) cuál es el Documento maestro, su metadata y cómo abrirlo.
- G3: La designación respeta RBAC (`PROJECT · ADMINISTRAR`, o `proyectos.editar` para propietario-administrador org, o en última instancia solo propietario).
- G4: Operación idempotente y segura: des-designar automáticamente cuando el recurso designado se borra / mueve a otro proyecto / se envía a papelera.
- G5: Trazabilidad total por auditoría (designó / cambió / des-designó qué recurso).

## Non-Goals
- NG1: No se crean archivos/carpetas nuevas desde este módulo (solo se designan las que ya existen).
- NG2: No se aplica un flujo de aprobación/worfklow para "promover" un borrador a maestro (fuera de scope).
- NG3: No se cambian los permisos del recurso al marcarlo como maestro (sigue respetando PermisosRecurso + herencia normal).
- NG4: No hay versionado maestro ni historial de designaciones en esta fase (solo auditoría).
- NG5: No aplica a recursos externos / enlaces. Solo `Carpetas` y `Archivos` del proyecto.

## Background & Context
- Pestaña UI ya existía en `ProjectDetailPage.tsx` tabs (id=`master`, label=`Documento maestro` con icono `FileCheck2`) pero su contenido era el fallback genérico "Módulo en construcción". No había schema, ni API, ni lógica.
- Schema de `Proyectos` hoy no tiene ninguna FK a Carpetas/Archivos que represente un recurso destacado.
- Patrones KMS existentes usados como referencia:
  - PATCH `/projects/:id` actualiza `Nombre/Descripcion/Estado` con `requireResourcePermission('PROJECT','EDITAR')`.
  - Auditoría: `logAuditRecord` helper best-effort nunca rompe flujo; `Accion` en kebab-case `project.xxx.yyy`.
  - `requireResourcePermission('PROJECT', 'ADMINISTRAR')` se usa para deletes permanentes.
  - Validaciones pertenencia proyecto: los updates siempre filtran `AND IdOrganizacion = @orgId`.

## Functional Requirements
- **FR-1 Designación XOR exclusivo**: En la entidad `Proyectos` existen exactamente 2 columnas nullable `IdDocMaestroCarpeta (FK Carpetas.Id)` y `IdDocMaestroArchivo (FK Archivos.Id)`. Ningún proyecto puede tener ambas distintas de NULL (restricción CHECK XOR). Un proyecto puede tener NINGUNA (ambas NULL, caso sin designar).
- **FR-2 Endpoint designar**: `PATCH /api/projects/:id/documento-maestro` acepta body `{ resourceType: 'FOLDER'|'FILE', resourceId: UUID }` y valida:
  - a) Proyecto existe y pertenece a la organización.
  - b) Usuario tiene `PROJECT · ADMINISTRAR` OR `PROJECT · EDITAR` (re-uso permisos existentes; fallback propietario si se configura).
  - c) `resourceId` corresponde a un recurso EXISTENTE y NO ELIMINADO del MISMO proyecto:
    - Para `FOLDER`: `Carpetas.Id = @rid AND Carpetas.IdProyecto = @pid`.
    - Para `FILE`: validación doble: `Archivos.IdProyecto = @pid` O (si `IdProyecto` es NULL, caso huérfano proyecto antiguo) existe un join hacia `Carpetas` donde la carpeta pertenece al proyecto.
  - d) Al terminar el UPDATE, dentro del mismo statement ponemos la OTRA columna a NULL (garantiza XOR aunque llegara un request malo).
  - e) Actualiza `FechaActualizacion = GETDATE()`.
- **FR-3 Endpoint des-designar explícito**: `DELETE /api/projects/:id/documento-maestro` (sin body) vuelve ambas columnas a NULL. Mismos permisos que FR-2.
- **FR-4 Consistencia automática (cascada suave/NULLIFY)**: Si el recurso maestro se borra lógicamente o físicamente, el campo se pone a NULL automáticamente.
  - Solución práctica (sin trigger, ya que Archivos se borra MANUALMENTE antes de Carpetas/Proyectos en el service): en `projects.service.ts` permanentDeleteProject Y en `files.service.ts` deleteFile/deleteFolder Y en folders.service.ts deleteFolder, agregamos un pequeño SET NULL on the same tx antes de borrar.
  - Alternativa secundaria (FK ON DELETE SET NULL) en reset + migration para los DELETE directos de BD, pero por simplicidad de esta PR usamos la SET NULL manual dentro de los service ya existentes (suficiente).
- **FR-5 Lectura expandida en `GET /api/projects/:id`**: la respuesta incluye un campo `documentoMaestro?: { resourceType: 'FOLDER'|'FILE'; resourceId: string; name: string; path: string; size?: number; lastUpdatedAt?: string; ownerId?: string; ownerName?: string }` o `null` si no hay. Si el recurso fue borrado/ya no existe, devuelve `null` (degradación elegante).
- **FR-6 Auditoría**: Cada cambio de estado (designar/des-designar/cambio de tipo) produce un `logAuditRecord` de tipo `project` con:
  - `Accion = 'project.documento_maestro.actualizado'`
  - `Metadatos.Extra = { antes: {resourceType,resourceId}|null, despues: {resourceType,resourceId}|null, modo: 'set'|'clear' }`
  - Auditoría best-effort nunca 5xx.
- **FR-7 UI / Pestaña "Documento maestro"**:
  - Estado SIN designar: CTA + explicación "Elige una carpeta o archivo del proyecto para marcarlo como fuente de verdad. Solo propietarios/administradores pueden designar."
  - Estado CON designar: tarjeta con icono FileCheck2, nombre, path (breadcrumbs para carpetas, carpeta padre + nombre para archivos), metadata (propietario/actualizada), botón "Abrir" que navega a la carpeta/archivo, botón "Quitar designación" (solo si tienes permiso).
  - Botón "Designar existente" abre selector modal de carpeta + pestaña archivos.
- **FR-8 UI / Context menu**: En el menú derecho de cualquier archivo o carpeta del proyecto se agrega la acción "Designar como documento maestro" (visible solo si tienes permiso; y si YA lo es se desactiva o muestra "Quitar designación").
- **FR-9 UI / Badge en listado docs**: En la lista de documentos y en el árbol de carpetas se muestra un badge distintivo pequeño `📌 Maestro` al lado del nombre cuando un recurso está designado.

## Non-Functional Requirements
- **NFR-1 Sin errores de tipado TypeScript NUEVOS** (`tsc --noEmit` mantiene los errores PREEXISTENTES, no agrega ninguno).
- **NFR-2 Consistencia BD**: Todas las UPDATEs son atómicas (1 statement o TX) y NO permiten estado XOR roto; la migración incluye un CHECK en MSSQL.
- **NFR-3 Degradación sin 500**: Si el FK es dangling (master apunta a recurso borrado directamente por SQL sin pasar por service), `GET /projects/:id` devuelve `null` en `documentoMaestro` sin lanzar error.
- **NFR-4 Permisos**: Usar `requireResourcePermission('PROJECT', 'ADMINISTRAR')` en routes para los endpoints de escritura; lectura incluida implícita por el GET detail ya existente.
- **NFR-5 Tiempo respuesta**: Los 2 endpoints nuevos < 200ms p50 en BD local (1 query update + 1 audit INSERT).

## Constraints
- **Technical**: Stack fijado. MSSQL 2014-2022 (sintaxis compatible; no SWITCH, no JSON_PATH avanzado; usar CASE/LEFT JOIN). Backend Express + tedious via mssql; NO ORM. Frontend React + Vite + TanStack Query. shared-types package.
- **Business**: Los huérfanos legacy (`Archivos.IdProyecto IS NULL`) deben validarse por jerarquía carpetas al igual que el delete permanent.
- **Dependencies**: RBAC middleware existente; auditoría helper `logAuditRecord`.

## Assumptions
- A1: Los owners/administradores quieren designar 1 solo recurso maestro, no varios. Si hace falta "documentos destacados" en el futuro será un feature separado.
- A2: No hay triggers/DDL adicionales en producción que bloqueen los ALTER TABLE CHECK.
- A3: Los DELETEs de archivos/carpetas siempre pasan por los services `files.service.ts` / `folders.service.ts` / `projects.service.ts` — los pocos DELETE directos desde SQL manual son edge y se maneja con NFR-3.

## Acceptance Criteria

### AC-1: Schema XOR FK en Proyectos
- **Type**: `rule`
- **Given**: BD conectada KMS con Proyectos/Carpetas/Archivos existentes
- **When**: Aplicar migration `20260905_documento_maestro.sql` y en 000_KMS_RESET_TOTAL.sql
- **Then**:
  - `SELECT name, is_nullable FROM sys.columns WHERE object_id=OBJECT_ID('Proyectos') AND name IN ('IdDocMaestroCarpeta','IdDocMaestroArchivo')` → 2 rows, `is_nullable=1`
  - 2 FK constraints: `FK_Proyectos_DocMaestroCarpeta`, `FK_Proyectos_DocMaestroArchivo`
  - 1 CHECK CK_Proyectos_DocMaestro_Xor. Insert manual con ambos not null → falla. Insert con 1 not null → pasa. Insert con ambos null → pasa.
- **Pass Condition**: 3 checks arriba + migration idempotente (2da ejecución = 0 errores).
- **Evidence**: comando inline mssql test 2 veces migration OK.

### AC-2: Endpoint PATCH designa maestro correctamente
- **Type**: `rule`
- **Given**: Proyecto X con usuario Admin JWT, carpeta Y en el proyecto, archivo Z en el mismo proyecto
- **When**: `curl -X PATCH /api/projects/X/documento-maestro body={resourceType:'FOLDER', resourceId: Y}` con JWT admin
- **Then**:
  - HTTP status ∈ {200,204}
  - BD `IdDocMaestroCarpeta=Y AND IdDocMaestroArchivo IS NULL` en proyecto X
  - Luego `PATCH {resourceType:'FILE', resourceId: Z}` → BD debe tener `IdDocMaestroArchivo=Z AND IdDocMaestroCarpeta IS NULL` (XOR respetado en el 2º cambio)
  - Auditoría tiene 2 filas `project.documento_maestro.actualizado`
- **Pass Condition**: 4 sub-verificaciones (HTTP, SET1 XOR1, SET2 XOR2, auditoría 2 filas).
- **Evidence**: curl commands outputs + SQL select.

### AC-3: Endpoint DELETE des-designa maestro
- **Type**: `rule`
- **Given**: Proyecto X con carpeta Y ya designada como maestro (después de AC-2)
- **When**: `curl -X DELETE /api/projects/X/documento-maestro` JWT admin
- **Then**: HTTP 204, ambas columnas NULL en BD, auditoría `modo: 'clear'`
- **Pass Condition**: HTTP 204 AND (IdDocMaestroCarpeta is null AND IdDocMaestroArchivo is null).
- **Evidence**: curl + SQL check.

### AC-4: Permisos - Miembro sin ADMINISTRAR → Forbidden
- **Type**: `rule`
- **Given**: Usuario Carlos Pérez ROL Miembro (no administra el proyecto)
- **When**: PATCH o DELETE /documento-maestro con el JWT de Carlos
- **Then**: HTTP 403, NO hay cambios en BD, auditoría NO se escribe con éxito (o 0 rows nuevas).
- **Pass Condition**: HTTP 403 + sin cambios.
- **Evidence**: curl Carlos (403) + compare before/after rows Proyectos.

### AC-5: GET /projects/:id devuelve documentoMaestro expandido
- **Type**: `rule`
- **Given**: Proyecto X con designación FILE Z existente
- **When**: GET /api/projects/X
- **Then**: Respuesta contiene `data.documentoMaestro.resourceType === 'FILE'`, `resourceId === Z`, `name` coincide, `path` no está vacío, `lastUpdatedAt` !== null.
- **Pass Condition**: Todos los campos expandidos presentes y correctos.
- **Evidence**: curl + json field check.

### AC-6: Consistencia - eliminar archivo maestro NULLIFICA automáticamente
- **Type**: `rule`
- **Given**: Proyecto X tiene FILE Z designado maestro
- **When**: Se borra permanentemente el archivo Z (vía service normal `DELETE /api/files/:zid`)
- **Then**: Proyecto X ambas columnas maestro = NULL, NO queda FK dangling visible.
- **Pass Condition**: Después del delete del archivo, ambos campos Proyectos están NULL.
- **Evidence**: SQL inline test (begin tx → designa → delete archivo → select → ROLLBACK).

### AC-7: UI - Pestaña "Documento maestro" real (no placeholder)
- **Type**: `rule`
- **Given**: Entrar en proyecto X con designación hecha
- **When**: Click en tab "Documento maestro"
- **Then**: No aparece "Módulo en construcción"; muestra la tarjeta con los campos del resource (nombre, path, meta, Abrir, Quitar designación si permiso OK).
- **Pass Condition**: Quitar el render fallback activeTab !== 'docs' !== 'team' y el branch `activeTab === 'master'` renderiza la card.
- **Evidence**: diff de render code + browser snapshot.

### AC-8: UI - Context menu opción Designar archivo/carpeta
- **Type**: `rubric`
- **Dimension**: Accesibilidad y discoverability de la acción desde el flujo normal de documentos
- **Scale**: 1-5
- **Anchors**: 1 = no aparece en ningún menú; 3 = aparece en solo un tipo de recurso sin texto; 5 = visible tanto en carpeta (folderContextMenu) como archivo (fileContextMenu), icono FileCheck2, texto claro "Designar como documento maestro", y muestra estado "Ya es el documento maestro" deshabilitado cuando toca.
- **Pass Threshold**: >= 4
- **Evidence**: code review context menus + screenshot.

### AC-9: Badge distintivo 📌 Maestro en docs tree & list
- **Type**: `rubric`
- **Dimension**: Visibilidad/feedback del recurso maestro cuando navegas
- **Scale**: 1-5
- **Anchors**: 1 = sin feedback; 3 = solo en 1 de los 2 lugares (tree o list); 5 = pequeño badge inline en el árbol de carpetas y en el nombre del archivo/carpeta del listado docs, usando tonos brand o FileCheck2, sin ocupar espacio extra.
- **Pass Threshold**: >= 4
- **Evidence**: browser screenshot o diff de UI con el badge presente.

### AC-10: Zero nuevos TS errors
- **Type**: `rule`
- **Given**: Código backend y frontend con errores preexistentes conocidos (3 favorites backend unused, 7 frontend unused)
- **When**: `cd backend; npx tsc --noEmit` y `cd frontend; npx tsc --noEmit`
- **Then**: El COUNT de errores nuevos = 0; puedes tener los mismos errores de antes.
- **Pass Condition**: diff count errores <= baseline count
- **Evidence**: outputs typecheck guardados.

## Open Questions
- [ ] ¿Usar `proyectos.editar` o `proyectos.administrar` para designar/quitar? (por ahora asumimos `PROJECT · ADMINISTRAR` para bloquearlo; se puede cambiar después a `EDITAR` con un cambio de 1 línea en routes).
