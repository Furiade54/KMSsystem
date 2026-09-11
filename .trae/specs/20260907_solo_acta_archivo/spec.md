# KMS - Solo Acta Archivo (Reuniones) - Product Requirements Document

## Overview
- **Summary**: Eliminar la funcionalidad de "Actas" textuales inline por reunión (editor textarea con múltiples versiones en `[dbo].[ActasReunion]`) y dejar **solo** la modalidad de "Acta archivo" en la UI expandible de reuniones, mejorándola para soportar tanto "vincular un archivo existente del proyecto" como **"subir un acta nueva directamente desde el panel"** (creada previamente en el PC/dispositivo del usuario). El flujo de subida debe respetar el storage provider existente (local o S3).
- **Purpose**: Reducir la duplicidad conceptual (no existen dos "actas"); unificar el único flujo real: el usuario crea el acta en Word/PDF fuera y luego la sube/vincula a la reunión. Asegurar que esa subida sea nativa en S3 cuando `STORAGE_PROVIDER=s3`, sin añadir lógica nueva de almacenamiento.
- **Target Users**: Miembros de proyecto con permisos `PROJECT VER` (ver) y `PROJECT EDITAR` (subir/vincular/desvincular).

## Goals
- Quitar el tab "Actas" y todo el código asociado a `[dbo].[ActasReunion]` (UI + mutations frontend + endpoints backend) para que no se siga usando.
- Dejar como único punto de verdad del acta el campo `[Reuniones].[IdActaArchivo] -> [Archivos].[Id]`.
- Mejorar el tab "Acta archivo" actual, que solo permite "Seleccionar archivo existente", añadiendo una **acción directa de Subir archivo** en el mismo panel, usando el flujo de upload del módulo `files` ya existente (S3 compatible).
- Mantener la vinculación/desvinculación actual y la apertura del archivo por URL prefirmada.
- Evitar cambios de schema SQL drásticos (no eliminar la tabla `[dbo].[ActasReunion]` todavía) para permitir rollback si se requiere.

## Non-Goals
- No reescribir el storage provider (local/S3): se usa el existente en `backend/src/shared/storage`.
- No introducir "versiones" de acta en `IdActaArchivo`; cada reunión tiene un acta archivo como vínculo, si el usuario desea una versión diferente sube otro archivo y lo vincula, o reemplaza el subido.
- No crear endpoints nuevos de reuniones independientes de `files`; la subida del archivo ocurre via `POST /api/projects/:projectId/archivos/upload` (ya existente) y luego se hace `PATCH /:meetingId/minutos-archivo` para vincular el id devuelto.
- No eliminar físicamente `[dbo].[ActasReunion]` ni `FK_Acta_Reunion` / `FK_Acta_Creador` en este cambio (solo desuscribir el código).
- No cambiar RBAC; las acciones de upload de archivo siguen el permiso `archivos.subir` ya existente, y la vinculación/desvinculación sigue exigiendo `PROJECT EDITAR`.

## Background & Context
- El esquema actual cuenta con:
  - `[dbo].[AsistentesReunion]` (asistentes, no se toca)
  - `[dbo].[Reuniones]` con `IdActaArchivo UNIQUEIDENTIFIER NULL`, FK `FK_Reunion_ActaArchivo` → `[Archivos].[Id]` (aplicada ya en `infra/sql/000_KMS_RESET_TOTAL.sql:L474-L489` y migración incremental `20260907_reuniones_acta_archivo_fk.sql`, ejecutada manualmente en SSMS).
  - `[dbo].[ActasReunion]` PK `Id`, FK `IdReunion`, `IdCreador`, `Contenido NVARCHAR(MAX)`. Esta tabla queda fuera de uso a nivel de aplicación.
- El backend ya expone:
  - `PATCH /api/projects/:projectId/reuniones/:meetingId/minutos-archivo` ([meetings.controller.ts:setMeetingMinutesFile](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/meetings/meetings.controller.ts))
  - `POST /api/projects/:projectId/archivos/upload` + `POST ../archivos` ([files.routes.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/files/files.routes.ts)), con `multer memoryStorage`, límite 50MB y storage provider abstracto.
- El frontend ya tiene:
  - Servicio de archivos con `uploadFile(projectId, file, folderId?)` y lista de archivos del proyecto.
  - `setMeetingMinutesFile(projectId, meetingId, {minutesFileId})` en `meeting-details.service.ts`.
  - FilePicker modal reutilizable (ya se muestra con "Seleccionar archivo") que lista archivos del proyecto y permite clickear para vincular.
  - Botón "Subir archivo al proyecto" global en el header de `ProjectDetailPage` pero no integrado dentro del tab Acta archivo.
- El storage provider S3 ya usa credenciales `.env`/hot-reload de config y almacena físicamente con `storageKey = projects/<projectId>[/folders/<folderId>]/<fileId>_<cleanName>`. Los archivos de acta se guardan en el raíz del proyecto (sin folder) por defecto, al igual que cualquier archivo subido desde el header.

## Functional Requirements
- **FR-1 (Quitar Tab Actas)**: Dentro del panel expandible de la reunión, solo deben visualizarse dos tabs: "Asistentes" y "Acta archivo". Desaparece el tab "Actas" junto con toda la UI de versiones inline, textarea de edición y modales/confirmaciones de borrado de acta.
- **FR-2 (Quitar endpoints /actas)**: Las rutas `GET|POST /:meetingId/actas` y `PATCH|DELETE /:meetingId/actas/:minutesId` del router de reuniones dejan de estar registradas; el controller `minutes.controller.ts` deja de montarse y sus funciones se marcan como deprecated (o se desacoplan de las rutas) sin romper compila.
- **FR-3 (Quitar state/queries/mutations de actas inline)**: En `ProjectDetailPage.tsx` y `meeting-details.service.ts` desaparecen `fetchMeetingMinutes`, `createMeetingMinutes`, `updateMeetingMinutes`, `deleteMeetingMinutes` y sus correspondientes hooks/estado.
- **FR-4 (Mejora Tab Acta Archivo)**: El panel "Acta archivo" muestra dos acciones primarias cuando el usuario puede editar:
  1. "Subir acta" → abre un selector nativo de archivo (`<input type=file>` oculto, activado por botón), valida que se eligió un archivo, lo sube mediante `uploadFile(projectId, file)`, obtiene el `fileId` devuelto, y acto seguido llama a `setMeetingMinutesFile(meetingId, { minutesFileId: fileId })` para vincularlo automáticamente a la reunión. Finaliza invalidando las queries de archivos y reuniones.
  2. "Seleccionar existente" → reutiliza el FilePicker actual.
  - La acción "Desvincular" se mantiene (setea `minutesFileId = null`).
- **FR-5 (Persistencia consistente con S3/Local)**: La subida del acta emplea **exactamente** el mismo path de `uploadFile` del módulo de archivos (storage provider, metadata, ETag, URLs prefirmadas de descarga). No hay código nuevo de putObject.
- **FR-6 (Compatibilidad Tabla ActasReunion)**: No se ejecuta DROP ni ALTER DDL adicional de `[dbo].[ActasReunion]` en este cambio; solo garantizamos que desde la aplicación ya no se escriba ni se lea. Se agrega un comentario de migración pendiente en una nota para el usuario (fuera del código).

## Non-Functional Requirements
- **NFR-1 (Typecheck)**: `cd backend && npx tsc --noEmit` debe terminar con 0 errores después del cambio; `cd frontend && npm run typecheck` también.
- **NFR-2 (Rendimiento)**: El tab "Acta archivo" no debe disparar queries sin uso (p. ej., `meetingMinutesQuery` se elimina completamente).
- **NFR-3 (Seguridad)**: Toda subida/vinculación/desvinculación sigue requiriendo autenticación Bearer y permisos `PROJECT EDITAR` para la reunión; la subida a files requiere el mismo `archivos.subir` que el upload global.
- **NFR-4 (Auditoría)**: Las acciones siguen registrando auditorías existentes: `file.subido` (cuando se sube el acta) y `meeting.minutesFile.updated` (cuando se vincula/desvincula).
- **NFR-5 (UX)**: El flujo de Subir acta debe tener feedback de loading (botón deshabilitado + spinner mientras sube y vincula), toast de éxito/error usando `setPageToast` y no debe permitir doble-click.

## Constraints
- **Technical**:
  - No introducir nuevas tablas ni nuevas FKs en este ciclo.
  - Reutilizar `uploadFile` del servicio `files.service.ts` sin crear endpoints nuevos de upload de "acta" dedicado.
  - Reutilizar el componente helper `fileKind / colorForKind / iconForKind / formatBytes / formatRelativeTime` existente para la renderización del fichero vinculado.
- **Business**:
  - Cada reunión vincula a lo sumo **un** archivo de acta; esto se mantiene en la FK `1:1` de `Reuniones.IdActaArchivo` (unique no, pero en UI se reemplaza).
  - El archivo de acta es un archivo del proyecto normal (aparece en la pestaña Documentos y en búsquedas).
- **Dependencies**:
  - Backend escucha en `http://localhost:51478` y proxy Vite en `51479` ya configurado.
  - `STORAGE_PROVIDER` puede ser `local` o `s3`; el código debe funcionar igual en ambos sin ramificación.

## Assumptions
- El usuario desea retener el nombre visual "Acta archivo" como pestaña (no "Actas" ni "Documento").
- El usuario no necesita un folder especial llamado "Actas" dentro del proyecto; los archivos se guardan en la raíz de Archivos del proyecto. Si se desea folder en el futuro se puede extender con selector adicional sin romper esto.
- Si se sube un acta que ya existía como archivo (mismo nombre), el comportamiento es el de `uploadFile` normal (se crea una nueva fila `Archivos` con id distinto; no se reemplaza el archivo existente).
- El usuario permite que el código de `minutes.controller.ts` continúe en el repo como "deprecated" (no montado en rutas) para fácil rollback durante unos días; si no, puede borrarse después con su confirmación.

## Acceptance Criteria

### AC-1: El tab "Actas" ya no aparece en el panel expandible de ninguna reunión
- **Type**: `rule`
- **Given**: Sesión iniciada, vista del detalle de proyecto en la pestaña Reuniones, reunión expandida con Chevron.
- **When**: Se renderiza el grupo de tabs bajo el encabezado de la reunión.
- **Then**: Solo se renderizan dos tabs ("Asistentes" y "Acta archivo"); no existe el tab "Actas", ni el botón "+ Nueva versión de acta", ni listado de versiones inline ni sus botones de editar/eliminar.
- **Pass Condition**: Inspección visual en navegador integrado + `grep -c 'Nueva versión de acta'` en el JSX/strings es 0.
- **Evidence**: Pendiente (smoke test browser).

### AC-2: Endpoints `/actas` del router reuniones devuelven 404
- **Type**: `rule`
- **Given**: Backend vivo, JWT de Carlos.
- **When**: Se ejecuta `curl -X GET "http://localhost:51478/api/projects/<projectId>/reuniones/<meetingId>/actas" -H "Authorization: Bearer ..."`.
- **Then**: Status HTTP es `404 Not Found` (no 500, no 200 con lista vacía).
- **Pass Condition**: Curl status code 404.
- **Evidence**: Pendiente (captura curl).

### AC-3: Tab "Acta archivo" permite subir un acta nueva y queda vinculada
- **Type**: `rule`
- **Given**: Reunión expandida, tab "Acta archivo" seleccionado, usuario con permisos EDITAR, reunión sin acta archivo aún.
- **When**: Se pulsa "Subir acta", se elige un fichero local pequeño (`.docx` o `.pdf`).
- **Then**: (1) El fichero se sube correctamente (fila en `dbo.Archivos`, storageKey en S3 o local), (2) la reunión queda con `IdActaArchivo = <nuevoId>` (se ve la ficha de archivo con nombre/tamaño/fecha en el panel), (3) el botón "Abrir" abre la descarga prefirmada en nueva pestaña.
- **Pass Condition**: UI muestra card del archivo y consulta SQL `SELECT IdActaArchivo FROM dbo.Reuniones WHERE Id=@meetingId` devuelve el id del archivo recién subido.
- **Evidence**: Pendiente (smoke + SQL check).

### AC-4: Se mantiene "Seleccionar existente" y "Desvincular"
- **Type**: `rule`
- **Given**: Reunión expandida, existen archivos en el proyecto (subida previamente), usuario con EDITAR.
- **When**: Caso A: pulsar "Seleccionar existente" → FilePicker muestra lista → clickear una fila. Caso B: con acta ya vinculada, pulsar Desvincular y confirmar.
- **Then**: A: la reunión pasa a tener el `IdActaArchivo` del seleccionado. B: `IdActaArchivo` vuelve a `NULL`.
- **Pass Condition**: Ambos flujos reflejan el cambio inmediato en UI sin refresh.
- **Evidence**: Pendiente (smoke test).

### AC-5: Typechecks limpios
- **Type**: `rule`
- **Given**: Código aplicado.
- **When**: `cd backend && npx tsc --noEmit` y `cd frontend && npm run typecheck`.
- **Then**: Ambos comandos terminan exit code 0, 0 errores.
- **Pass Condition**: Exit codes 0.
- **Evidence**: Pendiente (logs consola).

### AC-6: Storage S3 se comporta igual que local
- **Type**: `rubric`
- **Dimension**: Transparencia del proveedor de almacenamiento en el flujo de subida del acta.
- **Scale**: 1-5
- **Anchors**: 1 = flujo tiene hardcode `local`/`s3` y rompe si cambias provider; 3 = reutiliza uploadFile pero hay if/else especiales; 5 = reutiliza 100% el upload y getPresignedDownloadUrl sin ramificación adicional respecto a un archivo normal.
- **Pass Threshold**: >= 4
- **Evidence**: Pendiente (code review de llamadas).

## Open Questions
- [ ] ¿Deseas conservar `minutes.controller.ts` físicamente en el repo (no montado, deprecated) o prefieres **eliminarlo completamente** junto con borrar su import en `meetings.routes.ts`? Si lo borramos, la tabla `[dbo].[ActasReunion]` quedaría huérfana de código pero seguiría intacta en BD; si lo deseas, posteriormente puedo crear una migración incremental adicional `20260907_drop_actasreunion.sql` para hacer `DROP TABLE IF EXISTS dbo.ActasReunion` cuando confirmes.
