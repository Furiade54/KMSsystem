# Plan Cableado dbo.VersionesArchivo — BD → Backend → Frontend
Versión 1.0 | Alcance: integridad referencial + CRUD versiones históricas + reemplazar contenido + listar + descargar. Mantiene 0 roturas en módulo Archivos existente.

---

## 1. Inventario actual 100% (antes del refactor)

### 1.1 Capa BD MSSQL físico (KMS / HP2023\\IST) — auditado vía pool

| Tabla | Relación con VersionesArchivo | FKs | IX | Issue detectado |
|---|---|---|---|---|
| `dbo.Archivos` | PADRE: 1:N (1 Archivo tiene N VersionEs). Columna `IdVersionActual` uniqueidentifier NULLABLE. | FKs OUT: **IdCarpeta→Carpetas NO_ACTION**, **IdProyecto→Proyectos NO_ACTION**, **IdPropietario→Usuarios NO_ACTION**. | PK_Archivos Id CL. | ⚠️ **FALTA FK `IdVersionActual → VersionesArchivo.Id`** → valores huérfanos posibles. |
| `dbo.VersionesArchivo` | HIJA (N Archivos). 10 cols: Id / IdArchivo / NumeroVersion / BucketS3 / ClaveS3 / Hash / IdCargador / Comentario / Tamano / FechaCreacion. 0 filas. | FK OUT: **IdArchivo → Archivos CASCADE** (borrar archivo borra versiones) ✅; **IdCargador → Usuarios NO_ACTION** ✅. UQ(IdArchivo,NumeroVersion) ✅. | PK Id CL, UQ IdArchivo+NumeroVersion NC, IX_IdArchivo NC, IX_IdCargador NC. | ⚠️ FALTAN CKs: NumeroVersion>=1, Tamano>=0, Bucket+Clave coherentes. |
| `dbo.Reuniones.IdActaArchivo` | FK → Archivos.Id SET_NULL | — | — | NO tocar — Acta siempre usa "versión actual". |
| `dbo.Proyectos.IdDocMaestro{Carpeta,Archivo}` | FK Archivo/Carpeta SET_NULL | — | — | NO tocar — DocMaestro siempre usa versión actual. |
| `dbo.ComentariosArchivos` | FK → Archivos.Id NO_ACTION | — | — | NO tocar — comentarios son del archivo, no de una versión histórica. |
| `dbo.Carpetas` | Jerárquica `IdCarpetaPadre → Carpetas.Id` NO_ACTION, FK Proyecto CASCADE. | — | — | OK sin cambios. |

### 1.2 Capa Backend actual (modules/files)

- **Service** [`files.service.ts`](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/files/files.service.ts#L11-L78): `ArchivoDto` NO contiene campo `idVersionActual`. Upload inserta SOLO Archivos (no VersionesArchivo). `copyFileById` inserta solo Archivos. `updateFileById` actualiza Archivos (no toca versiones). NADA toca VersionesArchivo.
- **Controller** [`files.controller.ts`](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/files/files.controller.ts#L14-L195): 12 endpoints estándar (upload/list/get/patch/copy/comments/permissions/delete/download). **No hay endpoints para /versiones**.
- **Routes** [`files.routes.ts`](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/files/files.routes.ts#L24-L45): monta filesRouter bajo `app.ts` antes de projectsRouter; `/:id/permisos` / `/:id/comentarios`. **No hay rutas /:id/versiones**.
- **revisions module (NO confundir)**: `modules/revisions` = Revisión workflow (revisiones para usuario "revisor", tiene resourceType/resourceId/estado) → NO se usa para versiones de archivos. Prohibido mezclar.

### 1.3 Capa Frontend actual

- **Tipos** [`ApiFile`](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/services/files.service.ts#L4-L25): **25 campos, NO contiene `idVersionActual`** ni metadata de versiones.
- **Funciones** [`files.service.ts`](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/services/files.service.ts#L52-L177): upload, list, delete, update, move, copy, comments. **No hay funciones versiones**.
- **UI Archivos (ProjectDetailPage DocsTab)**: render puro, sin panel histórico. Right panel ya muestra info archivo (Tamaño / Hash / Mime) → lugar natural para expandir "Versiones (N)".

### 1.4 shared-types (packages/shared-types)
Sin tipos relacionados versiones. Sin Archivo DTO tipo `FileVersion` compartido.

---

## 2. Relaciones que DEBE tener VersionesArchivo (diseño final)

| Nombre FK / CK | Tabla | Columna | Destino | Policy | Razón |
|---|---|---|---|---|---|
| `FK_Version_Archivo` (YA EXISTE) | VersionesArchivo | IdArchivo | Archivos.Id | CASCADE DELETE | Borrar archivo borra historial completo ✅ |
| `FK_Version_Cargador` (YA EXISTE) | VersionesArchivo | IdCargador | Usuarios.Id | NO_ACTION | Soft delete user no bloquea. ✅ |
| **`FK_Archivo_VersionActual` NUEVO** | Archivos | IdVersionActual | VersionesArchivo.Id | **ON DELETE SET NULL** ✅ tu elección | Si se borra la versión actual histórica, IdVersionActual vuelve NULL y la UI resuelve por MAX(NumeroVersion). |
| `CK_VerArchivo_NumeroVersionPositivo` NUEVO | VersionesArchivo | NumeroVersion | CHECK NumeroVersion >= 1 | NO_ACTION | Nunca habrá v0/v-5. |
| `CK_VerArchivo_TamanoNoNegativo` NUEVO | VersionesArchivo | Tamano | CHECK (Tamano IS NULL OR Tamano >= 0) | NO_ACTION | Protección lógica. |
| `CK_VerArchivo_Bucket_SiClave` NUEVO | VersionesArchivo | ClaveS3 + BucketS3 | CHECK ((ClaveS3 IS NULL AND BucketS3 IS NULL) OR BucketS3 IS NOT NULL) | NO_ACTION | No tengamos clave S3 sin bucket. |

**Relaciones que EXPLÍCITAMENTE NO AGREGAMOS**:
- ❌ NO `ComentariosArchivos.IdVersion` → comentarios son del archivo, no de v histórica.
- ❌ NO `Revisions.IdVersion` → revisions module es workflow de revisión, no versionado.
- ❌ NO `Reuniones.IdActaVersion` / `Proyectos.IdDocMaestroVersion` → SIEMPRE toman la VERSIÓN ACTUAL del archivo (IdVersionActual). Simple y alineado con Docs Maestro / Acta actual.

---

## 3. Archivos a modificar / crear por capas

### 3.1 BD MSSQL — 1 migration + actualizar reset script 000

1. **Archivo NUEVO** `infra/sql/migrations/YYYYMMDD_crear_fk_check_versiones_archivo.sql` —
   - `ALTER TABLE Archivos WITH NOCHECK ADD CONSTRAINT FK_Archivo_VersionActual FOREIGN KEY (IdVersionActual) REFERENCES VersionesArchivo(Id) ON DELETE SET NULL ON UPDATE NO ACTION;`
   - `ALTER TABLE Archivos WITH NOCHECK CHECK CONSTRAINT FK_Archivo_VersionActual;`
   - 3x `ALTER TABLE VersionesArchivo WITH NOCHECK ADD CONSTRAINT CK_* ...;`
   - `ALTER TABLE VersionesArchivo WITH NOCHECK CHECK CONSTRAINT ALL;`
2. **Modificar**: [`infra/sql/000_KMS_RESET_TOTAL.sql`](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/infra/sql/000_KMS_RESET_TOTAL.sql) sección CREATE TABLE Archivos + VersionesArchivo → agregar las FK y CK inline. Versión script 3.3 header + changelog RTV + Versiones.
3. **Opcional (IDEMPOTENTE)**: aplicar script ALTER directo en BD KMS físico en este momento (tablas VersionesArchivo VACÍAS, sin data, 0 riesgo). SKIP → lo hacemos manualmente solo tras aprobación explícita.

### 3.2 Backend — 4 módulos files existentes + 1 tipo compartido

| # | Archivo | Cambios |
|---|---|---|
| B1 | `packages/shared-types/src/index.ts` | NUEVOS tipos exportados: `ProjectFileVersion` (todos los campos BD VersionesArchivo mapeados API) + `ProjectFileVersionCreatePayload` (archivo nueva version multipart). NO tocar tipos existentes. |
| B2 | `backend/src/modules/files/files.service.ts` — service | (1) En `uploadFile` → tras UPDATE Archivos StorageKey/ETag/S3VersionId: INSERT VersionesArchivo N°1 + UPDATE Archivos.IdVersionActual = @@IDENTITY. <br> (2) NUEVO `listFileVersions(pool, auth, fileId)` paginado, valida org-chain via Archivos.IdProyecto→Proyectos.IdOrganizacion. <br> (3) NUEVO `getFileVersionById(pool, auth, fileId, versionId)` get con URL pre-firmada / local-signed. <br> (4) NUEVO `uploadNewVersion(pool, auth, fileId, req.file, { comment?:string })` → MAX(NumeroVersion)+1; nuevo blob storage; UPDATE Archivos FechaActualizacion, Tamano, StorageProvider, S3Bucket, S3ETag, S3VersionId, ChecksumSHA256; UPDATE Archivos.IdVersionActual = nuevaVersionId; INSERT audit.file.version.creada. <br> (5) NUEVO `setCurrentFileVersion(pool, auth, fileId, versionId)` → UPDATE Archivos.IdVersionActual=versionId; no toca blobs. <br> (6) NUEVO `deleteFileVersion(pool, auth, fileId, versionId)` → NO_ACTION a blobs S3 (por ahora, sin limpieza storage). Solo delete VersionesArchivo row; SET NULL CASCADE ya se encarga de IdVersionActual. <br> (7) Modificar `copyFileById` actual: tras storage.copyObject deep copy → INSERT VersionesArchivo N°1 del nuevo archivo → UPDATE Archivos.IdVersionActual = @@IDENTITY (tu elección opción B). |
| B3 | `backend/src/modules/files/files.controller.ts` | NUEVOS endpoints bajo archivo/:id/<br> a) GET `/versiones` requireResourcePermission FILE VER → list. <br> b) GET `/versiones/:versionId` requireResourcePermission FILE VER → downloadUrl/get metadata single. <br> c) POST `/versiones` requireResourcePermission FILE EDITAR + multer.single('file') → upload nueva versión multipart. <br> d) PATCH `/versiones/:versionId/actual` requireResourcePermission FILE EDITAR → setCurrent. <br> e) DELETE `/versiones/:versionId` requireResourcePermission FILE ADMINISTRAR → deleteFileVersion. |
| B4 | `backend/src/modules/files/files.routes.ts` | Añadir 5 rutas nuevas en ORDEN adecuado (sin colisión con `/comentarios` ni `/permisos`). |
| B5 | `backend/src/modules/favorites/favorites.controller` (SOLO si hay dependencia) | NO tocar. |
| B6 | `backend/app.ts` | Sin cambios (filesRouter ya está montado). |

### 3.3 Frontend — services + 2 hooks + 3 componentes sin barrel

| # | Archivo | Cambios |
|---|---|---|
| F1 | `frontend/src/services/files.service.ts` | Extender `ApiFile` con **3 nuevos campos opcionales**: `currentVersionId?: string | null`, `versionCount?: number | null`, `currentVersionNumber?: number | null`. <br> NUEVAS funciones: `fetchFileVersions(fileId)`, `uploadFileVersion(fileId, File, comment?, onProgress?)`, `setFileCurrentVersion(fileId, versionId)`, `deleteFileVersion(fileId, versionId)`, `getFileVersionDownloadUrl(fileId, versionId)` (si es get endpoint retorna directo). |
| F2 | `packages/shared-types/src/index.ts` (coherencia F1) | Tipos API `ApiFileVersion` / `CreateFileVersionPayload` mirrors F1. |
| F3 | `frontend/src/components/project/project-file-versions/types.ts` (NUEVO, sin index.ts barrel, conforme project_memory) | Tipos Props agrupados: `FileVersionsUiState`, `FileVersionMutationsPending`, `FileVersionCallbacks` (igual patrón Temas agrupado). |
| F4 | `frontend/src/components/project/project-file-versions/useFileVersionForms.ts` (NUEVO) | 1 useState: `uploadVersionComment` / `showUploadVersion` + 1 error msg. SIN useQuery ni useMutation (patrón Orquestador). |
| F5 | `frontend/src/components/project/project-file-versions/FileVersionHistoryList.tsx` (NUEVO componente DUMB) | Recibe props agrupadas: `items: ApiFileVersion[]`, `currentVersionId`, `pending`, `callbacks`. Render lista badge "Versión N° · ACTUAL" · Fecha · Uploader · Tamaño · Hash abreviado · 3 acciones: Descargar, Establecer actual, Eliminar (ADMINISTRAR). Sin hooks, sin state propio. |
| F6 | `frontend/src/components/project/ProjectDetailPage.tsx` (Orquestador principal) | Dentro del módulo docs (fuera del scope Temas), añadir 2 useQuery + 4 useMutation al final de TODOS los hooks antes de return Navigate: <br> a) `fileVersionsQuery` enabled `selectedResource?.type === 'FILE'`. <br> b) `uploadVersionMutation` con optimistic invalidateDetail() + invalidateQueries files/fileVersions. <br> c) `setCurrentMutation`. <br> d) `deleteVersionMutation`. <br> Pasar props agrupadas a RightPanel de archivos. |
| F7 | `frontend/src/components/project/ProjectFileRightPanel.tsx` (BUSCAR archivo real exacto) | Añadir acordeón "📜 Versiones (N)" justo debajo de "Metadatos" — colapsado por default. Dentro renderiza `FileVersionHistoryList`. Forma subida nueva versión multipart con textarea "Comentario del cambio" + botón "Subir nueva versión" que llama mutation. |

### 3.4 Validación técnica — 6 comprobaciones

1. `npx tsc --noEmit -p backend/tsconfig.json` → exit 0.
2. `npx tsc --noEmit -p frontend/tsconfig.json` → exit 0.
3. `npm run lint backend` / `npm run lint frontend` → 0 errores introducidos (solo warnings CRLF preexistentes).
4. E2E manual en sandbox:
   - SUBIR archivo.png dentro de Proyecto Carlos → se crea v1 + IdVersionActual = nueva version.
   - PESTAÑA Docs → click archivo → panel derecho "📜 Versiones (1)" expandir → muestra v1.
   - SUBIR Nueva Versión archivo_v2.png con comentario "Cambios logo cliente" → Versión N°2 creada, marcada ACTUAL. FechaActualizacion Archivos actualizada, checksum nuevo, tamaño nuevo.
   - VOLVER a v1 como actual → click "Establecer actual" → IdVersionActual = v1, panel derecho refleja la metadata del archivo.
   - DESCARGAR v2 (histórica) → blob correcto (no el actual).
   - ELIMINAR v2 → DELETE 204, FK SET_NULL pone IdVersionActual = NULL (opcionalmente la UI muestra "Ninguna, última numérica N°1"), listado refleja solo 1 versión.
   - BORRAR Archivo completo → CASCADE elimina sus VersionesArchivo + FK_SET_NULL Proyectos.DocMaestroArchivo y Reuniones.Acta (tal como ya hacía antes, 0 cambios).
5. Multi-tenant scoping: otro usuario de ORG distinta intenta GET /archivos/<id>/versiones → 404 (org-chain join).
6. RBAC: usuario VER puede GET, EDITAR puede subir nueva versión / establecer actual, ADMINISTRAR solo puede borrar versión.

---

## 4. Dependencias y hard constraints (siempre cumplir)

✅ Mantener `useQuery` / `useMutation` versiones SIEMPRE en ProjectDetailPage.tsx (orquestador) — igual que en Temas Enfoque A. Los componentes nuevos `FileVersionHistoryList.tsx` / `useFileVersionForms.ts` NO tienen hooks de data.
✅ Sin barrel files `index.ts` en `components/project/*`. Carpeta nueva `project-file-versions/` contiene types.ts + useFileVersionForms.ts + FileVersionHistoryList.tsx DIRECTAMENTE sin index.
✅ Prohibido React Context para versiones.
✅ Prohibido mezclar con módulo `modules/revisions` (son WORKFLOW de aprobación, NO versionado binario).
✅ NO romper endpoints existing files (regresión): upload/copy/list/delete/comments/permissions siguen devolviendo exactamente el mismo DTO shape que antes (solo 3 campos NUEVOS opcionales).
✅ copyFile = opción B (tu elección) — inserta v1 propia + deep copy blob.
✅ DELETE file version NO toca storage blobs (sin borrado físico S3/local; lo deja para limpieza futura retention policy).

---

## 5. Riesgos y mitigación

| Riesgo | P | I | Mitigación |
|---|---|---|---|
| MSSQL 2014 no soporta FK `ON DELETE SET NULL` con multiples paths? | BAJA | ALTA | 1 sola FK inversa SET_NULL (Archivos→VersionActual). No hay ciclos con la CASCADE directa porque VersionesArchivo→Archivos es CASCADE en el SENTIDO OPUESTA (padre Archivos → hijas VersionEs). Documentar test: DELETE Archivo con 3 versiones + IdVersionActual = v2 OK. |
| Ciclo FK #1785 MSSQL | BAJA | ALTA | Conjunto de paths: Archivos→VersionesArchivo→Archivos. Primero CASCADE (Padre->Hija), luego SET_NULL (Hija->Padre). MSSQL detecta ciclo? → SI LO DETECTA. **MITIGACIÓN CONFIRMADA**: definir FK_Archivo_VersionActual `ON DELETE NO ACTION`, no SET_NULL. En el backend `deleteFileVersion` (F2 B2 punto6) HACER UPDATE manual `UPDATE Archivos SET IdVersionActual=NULL WHERE IdVersionActual=@versionId` ANTES del DELETE de VersionesArchivo. Comprobamos deuda en código: deleteVersion siempre pasa por controller + service, nunca raw-sql. → **ESTA ES LA DECISIÓN FINAL QUE PONGO EN PLAN porque MSSQL 2014 puede bloquear con #1785 en SET_NULL inversa.** Recomendación: `NO_ACTION` en la FK + manual UPDATE antes de DELETE. |
| Frontend selectedResource?.type == FILE se dispara con selectedResource aún en memoria (archivo borrado) → fileVersionsQuery 404. | MEDIA | BAJA | Guard en query.enabled: `enabled: Boolean(selectedResourceId && selectedType==='FILE' && !filesQuery.data.items.find?.(f=>f.id===selectedResourceId)?.no_exist)`. Manejar error 404 → no mostrar pestaña Versiones. |
| Upload nueva versión concurrencia (2 uploads mismo archivo a la vez) → NumeroVersion colisión N°2. | MEDIA | MEDIA | Aislar INSERT VersionesArchivo en 1 transacción con SERIALIZABLE isolation level (como recalculateProjectProgress) + SELECT MAX+1 con UPDLOCK(HOLDLOCK). |
| Hash no coincide (datacorrupt) | BAJA | BAJA | UI badge ✔️ checksum por versión al descargar. Comparar hash versión descargada vs Hash; no bloquea pero muestra warning. |
| Reset script header 3.3 changelog | — | — | Anotar en bloque comentarios de 000_KMS_RESET_TOTAL.sql. |

---

## 6. Off limits (NO hacer en este plan)

❌ Cleanup blobs viejos S3/local (retention policy v7).
❌ Frontend editor/preview de archivos (solo descargar + subir nueva versión).
❌ Asociar versión histórica a Acta de reunión / DocMaestro. Siempre usan versión actual.
❌ Comentarios por versión (solo comentarios por archivo).
❌ Revisiones workflow por versión (modules/revisions separado).
❌ Tags / favoritos por versión.
❌ Barrel files / React Context.

---

## 7. Pasos de ejecución ordenados (con aprobación usuario ANTES)

1. **Paso 0 — aprobar plan**: usuario aprueba el plan y también confirma explícitamente: ¿aplicamos ALTER FK directo a BD KMS físico (0 filas) o solo creamos migration.sql + actualizamos 000_KMS_RESET_TOTAL.sql y los corren manualmente DBA? (default: creamos archivos SQL + aplicamos ALTER físico idempotente)
2. **Paso 1 — BD**: crear archivo migration ALTER + actualizar 000_RESET con FK inline + 3 CK. Ejecutar ALTER físico (si se aprueba).
3. **Paso 2 — shared-types**: añadir `ProjectFileVersion` / `CreateFileVersionPayload` + `ApiFileVersion` mirror en frontend.
4. **Paso 3 — Backend service**: 7 modificaciones uploadFile, listFileVersions, getFileVersionById, uploadNewVersion, setCurrentFileVersion, deleteFileVersion, update copyFileById.
5. **Paso 4 — Backend controller + routes**: añadir 5 endpoints + 5 rutas.
6. **Paso 5 — Validar tsc backend + lint backend**.
7. **Paso 6 — Frontend project-file-versions**: 3 archivos types / useFileVersionForms / FileVersionHistoryList.
8. **Paso 7 — Frontend ProjectDetailPage + ProjectFileRightPanel**: añadir 2 queries + 4 mutations + render acordeón.
9. **Paso 8 — Validar tsc frontend + lint frontend**.
10. **Paso 9 — E2E sandbox 6 checks listados en 3.4**.
11. **Paso 10 — Entrega**: documentación cambios en plan + commit user-requested (si user pide commit).

**NO TOCAR NINGÚN ARCHIVO HASTA OBTENER RESPUESTA EXPLÍCITA DEL USUARIO sobre el punto 1 del paso 7 (aplicar ALTER BD físico o no).**
