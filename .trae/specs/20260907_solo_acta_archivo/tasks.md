# KMS - Solo Acta Archivo (Reuniones) - Implementation Plan

## Task 1: Desmontar endpoints /actas y controller minutes en el backend
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - En [meetings.routes.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/meetings/meetings.routes.ts) eliminar las 4 rutas que montan `listMeetingMinutes`, `createMeetingMinutes`, `updateMeetingMinutes`, `deleteMeetingMinutes` (`GET/POST /:meetingId/actas` y `PATCH/DELETE /:meetingId/actas/:minutesId`) y sus `requireResourcePermission` asociados, junto con los imports de `minutes.controller.ts`.
  - Dejar `minutes.controller.ts` presente en el directorio pero NO importado por las rutas (soft-deprecado para posible rollback). Añadir comentario `/* @deprecated Las actas textuales inline se desactivaron en favor de Acta Archivo (Reuniones.IdActaArchivo). Archivo conservado temporalmente. */` en cabecera del controller (sin borrarlo).
  - Mantener intacto `PATCH /:meetingId/minutos-archivo` (vinculación/desvinculación).
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `rule` TR-1.1: `cd backend && npx tsc --noEmit` exit 0.
  - `rule` TR-1.2: `curl -I -H "Authorization: Bearer $TOKEN" http://localhost:51478/api/projects/<proyecto>/reuniones/<reunion>/actas` retorna HTTP status 404.
- **Notes**: No tocar DDL de `dbo.ActasReunion`.

## Task 2: Eliminar service hooks/state de actas inline y types no usados en el frontend
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - En [meeting-details.service.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/services/meeting-details.service.ts): eliminar `fetchMeetingMinutes`, `createMeetingMinutes`, `updateMeetingMinutes`, `deleteMeetingMinutes`; eliminar tipos `ApiMeetingMinutes`, `CreateMinutesPayload`, `UpdateMinutesPayload`.
  - En [ProjectDetailPage.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx): eliminar imports `type ApiMeetingMinutes` de dicho service; eliminar states `showAddMeetingMinutes`, `newMinutesContent`, `editingMinutesId`, `editingMinutesContent`, `confirmDeleteMinutes` (y sus setters). Eliminar `meetingMinutesQuery`, `createMeetingMinutesMutation`, `updateMeetingMinutesMutation`, `deleteMeetingMinutesMutation` y handlers `handleCreateMeetingMinutes`, `handleSaveEditedMinutes`, `handleDeleteMinutes`.
- **Acceptance Criteria Addressed**: AC-1, AC-5
- **Test Requirements**:
  - `rule` TR-2.1: `cd frontend && npm run typecheck` exit 0 y 0 errores TS2304/TS6133 por símbolos de actas inline.
  - `rule` TR-2.2: `grep -c "meetingMinutesQuery\|ApiMeetingMinutes\|Nueva versión de acta" frontend/src/pages/ProjectDetailPage.tsx frontend/src/services/meeting-details.service.ts` == 0.
- **Notes**: No eliminar aún los tabs; eso es Task 3.

## Task 3: Quitar el tab "Actas" del JSX expandible y re-organizar panel (solo Asistentes + Acta archivo)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - En el bloque JSX de la fila expandible de reunión en [ProjectDetailPage.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx):
    - Eliminar el `<button>` del tab "Actas" y toda la sección de render de actas inline (card versiones, textarea editor, botones editar/eliminar).
    - Conservar el `<button>` de tab "Asistentes" y "Acta archivo". Actualizar el state inicial `meetingPanelTab` para que no tenga valor 'minutes' como default ni opción en el `useState`.
    - Eliminar el bloque JSX del modal `confirmDeleteMinutes` que se insertó globalmente antes del cierre.
- **Acceptance Criteria Addressed**: AC-1, AC-5
- **Test Requirements**:
  - `rule` TR-3.1: Smoke test en navegador integrado: expandir reunión, solo se renderizan 2 tabs.
  - `rule` TR-3.2: Frontend typecheck 0 errores.

## Task 4: Añadir "Subir acta" dentro del panel Acta archivo y reutilizar uploadFile + setMeetingMinutesFile
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - En `ProjectDetailPage.tsx`:
    - Importar el service `uploadFile` desde `files.service` si no está.
    - Añadir un `<input type="file" ref={minutesUploadInputRef}>` oculto (`className="hidden"`). Crear `useRef<HTMLInputElement>(null)` como `minutesUploadInputRef`. Añadir state `isUploadingActa: boolean` (false por defecto) para loading.
    - En la cabecera del card "Archivo del acta" (dentro del tab Acta archivo), donde están los botones "Seleccionar archivo" / "Desvincular", insertar un nuevo botón primario "Subir acta" (antes de "Seleccionar existente"), visible cuando `canEditMeetings`. Al pulsarlo disparar `minutesUploadInputRef.current?.click()`.
    - Añadir `onChange` al input file que: si no hay archivo retorna; activa loading; llama `uploadFile(projectId, file)` (sin folderId, raíz del proyecto); al éxito, llama `setMeetingMinutesFileMutation.mutateAsync({meetingId, minutesFileId: res.fileId ?? res.id})` y luego limpia el input (`value = ''`) y desactiva loading; al fallar en cualquier paso, limpia input, desactiva loading y `setPageToast` de error.
    - Mientras `isUploadingActa === true` deshabilitar los botones "Subir acta", "Seleccionar existente" y "Desvincular" para evitar doble-click; el botón Subir acta muestra un `Loader2 animate-spin` inline cuando está en loading.
  - Verificar que el service `uploadFile` devuelve `{ id: string }` (y ajustar la destructuración en consecuencia; inspeccionar antes la firma de `uploadFile`).
- **Acceptance Criteria Addressed**: FR-4, FR-5, AC-3, AC-4, AC-6
- **Test Requirements**:
  - `rule` TR-4.1: Frontend typecheck 0 errores.
  - `rule` TR-4.2: Navegador integrado: subir un `.txt` pequeño en el panel, ver que aparece la card del archivo, y comprobar en `Archivos` del proyecto aparece.
  - `rubric` TR-4.3: Transparencia storage provider; escala 1-5; anchors 1=hardcode, 3=algun if, 5=llama `uploadFile` tal cual sin if provider; threshold >=4; evidence=lectura de código.

## Task 5: Correcciones finales y verificación global (typecheck + smoke E2E)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1, Task 4
- **Description**:
  - Ejecutar ambos typechecks (back/front) y revisar lint/diagnostics.
  - Smoke navegador:
    1. Expandir reunión → solo 2 tabs.
    2. Subir un acta nueva con el botón "Subir acta" → se visualiza la ficha con datos y botón Abrir.
    3. Desvincular → vuelve al empty state.
    4. Seleccionar existente (el acta que acabamos de subir) → se vincula de nuevo.
    5. (Proporcional) Probar el 404 en `/actas` mediante `curl` con token.
- **Acceptance Criteria Addressed**: AC-1 a AC-5, AC-6
- **Test Requirements**:
  - `rule` TR-5.1: Backend `npx tsc --noEmit` 0.
  - `rule` TR-5.2: Frontend `npm run typecheck` 0.
  - `rule` TR-5.3: 4 smoke actions (E2E) OK sin error visible.
  - `rule` TR-5.4: `curl /actas` → 404.
- **Notes**: Si Task 1 se ejecuta después de levantar el servidor, tsx watch debería autorecargar el router; si no, reiniciar backend.
