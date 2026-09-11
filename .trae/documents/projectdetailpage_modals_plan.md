# ProjectDetailPage Round 2 — Extraer 18 Modales / Context Menús Implementation Plan

## Repository Research
- Baseline post Round 1 (tabs refactor): [ProjectDetailPage.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx) = **3670 líneas**, `npm run typecheck` = 0.
- 18 bloques JSX inline de UI **totalmente orquestables por el padre** = **2130 líneas** (58% del archivo). No comparten state interno entre sí. Cada uno abre por booleano y llama callbacks/mutations del padre.
- Medidas exactas (líneas inicial + tamaño):

| Bloque | Línea | Tamaño | Categoría |
|---|---|---|---|
| `{showNewFolder && ...}` | 1541 | 88 | Carpetas |
| `{renameFolder && ...}` | 1629 | 109 | Carpetas |
| `{renameFile && ...}` | 1738 | 462 | Archivos (GRANDE) |
| `{showEditProject && ...}` | 2200 | 102 | Proyecto |
| `{showMasterSelector && ...}` | 2302 | 169 | Maestro |
| `{showConfirmClearMaster && ...}` | 2471 | 57 | Maestro |
| `{folderContextMenu && ...}` | 2528 | 145 | Context Menus |
| `{fileContextMenu && ...}` | 2673 | 162 | Context Menus |
| `{docsAreaContextMenu && ...}` | 2835 | 56 | Context Menus |
| `{showDeleteProject && ...}` | 2891 | 48 | Proyecto |
| `{showForbiddenDelete && ...}` | 2939 | 31 | Proyecto |
| `{confirmDeleteFile && ...}` | 2970 | 54 | Archivos |
| `{confirmDeleteFolder && ...}` | 3024 | 113 | Carpetas |
| `{showInviteMember && ...}` | 3137 | 183 | Equipo |
| `{pageToast && ...}` | 3320 | 43 | UI |
| `{showNewMeeting && ...}` (incluye `editingMeeting` inline en el mismo bloque) | 3363 | 129 | Reuniones |
| `{confirmDeleteMeeting && ...}` | 3492 | 61 | Reuniones |
| `{showFilePicker && ...}` | 3553 | 118 | Reuniones |
| **Suma** | | **2130** | |

- 2 bloques que grep inicial detectó pero no aparecen top-level: `showAddMeetingParticipant` y `removeMeetingFileId` — se confirmó viven DENTRO del expandible de `ProjectMeetingsTab` (ya extraído en ronda 1). NO tocar.
- Carpeta destino ya existe: [frontend/src/components/project/](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/components/project/) — sin barrel `index.ts` (convención aprobada ronda 1).

## Restricciones heredadas (no negociables)
1. **NO mover `useQuery` ni `useMutation`** a hijos (padre orquestador / decision Plan Aprobado Round 1).
2. **NO usar Context API** — props drilling explícito tipado (igual que tabs Round 1).
3. **NO refactorizar lógica business dentro de los bloques** — solo mover el JSX + tipar props. Cualquier bug inline se conserva tal cual.
4. NO tocar DDL / SQL ni storage.
5. Cada componente nuevo exporta `XxxProps` (tipos públicos) + default export.

## Files and Modules

### Nuevos archivos en `frontend/src/components/project/` (11 archivos)

1. **`ProjectNewFolderModal.tsx`** (~120 líneas) — `showNewFolder`
   - Props: `project, show, setShow, selectedFolderId, flatFolderById, newFolderName, setNewFolderName, newFolderError, setNewFolderError, createFolderMutation(isPending, error), onSubmit`

2. **`ProjectFolderModals.tsx`** (~280 líneas) — agrupa 2 modales carpetas pequeños:
   - `RenameFolderModal` (renameFolder + renameFolderMutation + renameFolderName/Error setters + handleRenameFolder)
   - `ConfirmDeleteFolderDialog` (confirmDeleteFolder + deleteFolderMutation pending + onConfirm/onCancel)
   - Exporta ambos named-exports.

3. **`ProjectRenameFileModal.tsx`** (~500 líneas, archivo propio por tamaño 462) — `renameFile`:
   - Incluye renameFileInputRef, form con MUTACIÓN inline de nombre, y bloque "Versiones anteriores" + "Comentarios" + "Actividad" S3 (los 3 paneles que están abajo del form renombrar). No tocar lógica de versiones/comentarios.
   - Muchas props (~30): renameFile setter open/close, renameFileName/Error setters, renameFileMutation, renameFileInputRef, file={renameFile} entity (owner, createdAt, updatedAt, versions array, comments array, activity array), formatBytes, formatRelativeTime, initials, iconForKind, fileKind, colorForKind.

4. **`ProjectConfirmDeleteFileDialog.tsx`** (~80 líneas) — `confirmDeleteFile` + deleteFileMutation pending + onConfirm/onCancel.

5. **`ProjectProjectModals.tsx`** (~220 líneas) — agrupa 3 chicos:
   - `EditProjectModal` (showEditProject + project entity, editForm setters, updateMutation, handleSubmitEdit, ApiProjectStatus enum)
   - `DeleteProjectDialog` (showDeleteProject + project entity, canDeleteProject, deleteMutation pending, onConfirm)
   - `ForbiddenDeleteDialog` (showForbiddenDelete setter + onClose)

6. **`ProjectMasterModals.tsx`** (~250 líneas) — agrupa los 2 de maestro:
   - `MasterSelectorModal`: showMasterSelector; tabs carpetas/archivos con sus selectores; masterSelectorTab setter; masterSelectedFolderId/FileId setters; folderTree + filesQuery.data.items + filesIsLoading; MasterFolderTreeItem FC + iconForKind/colorForKind/fileKind helpers; designateMasterMutation pending; handleMasterDesignateSubmit callback.
   - `ConfirmClearMasterDialog`: showConfirmClearMaster + clearMasterMutation pending + onConfirm.

7. **`ProjectContextMenus.tsx`** (~380 líneas) — agrupa los 3 menús contextuales (top-level overlays con fixed inset-0 backdrop). Usa refs/clamp:
   - `FolderContextMenu`: folderContextMenu state {folder,x,y}, setFolderContextMenu setter, folderCtxRef, ctxClamp.folder. Incluye todas las acciones: Abrir, Renombrar, Favorito, Copiar/Mover aquí, Nueva carpeta dentro, Eliminar carpeta. Necesita ~15 callbacks onX al padre.
   - `FileContextMenu`: fileContextMenu state {file,x,y}, setFileContextMenu setter, fileCtxRef, ctxClamp.file. Acciones: Abrir, Descargar, Renombrar, Favorito, Copiar/Mover, Comentar, Eliminar. ~15 callbacks.
   - `DocsAreaContextMenu`: docsAreaContextMenu {x,y} setter, setShowNewFolder (New Folder). ~4 acciones.
   - NOTA: `folderCtxRef`, `fileCtxRef`, `ctxClamp` son refs/estados QUE SE QUEDAN EN EL PADRE — se pasan por props. Motivo: sus efectos de click-outside y resize observer están definidos en useEffect en el padre (fuera de esta extracción).

8. **`ProjectInviteMemberModal.tsx`** (~200 líneas) — `showInviteMember` modal completo:
   - Search org members, lista miembros actuales proyecto, asignar roles, orgMembersQuery.data, membersQuery.data, addMemberMutation pending/error, removeMemberMutation, inviteSearch setter, inviteSelectedUserId setter, inviteError setter, canManageMembers.

9. **`ProjectPageToast.tsx`** (~60 líneas) — componente pequeño del banner `pageToast`. Props: `pageToast` state + `setPageToast` setter.

10. **`ProjectMeetingDialogs.tsx`** (~220 líneas) — 2 diálogos confirmación reuniones:
    - `NewMeetingModal` (bloque grande 129 líneas que maneja showNewMeeting **Y** editingMeeting): newMeetingForm setters, createMeetingMutation/updateMeetingMutation pending, meetingStatusBadgeClass y meetingStatusLabel helpers, orgMembers para dropdown asistentes iniciales, onSubmit.
    - `ConfirmDeleteMeetingDialog`: confirmDeleteMeeting entity + deleteMeetingMutation pending + onConfirm.

11. **`ProjectFilePickerModal.tsx`** (~130 líneas) — `showFilePicker`: carpeta actual + archivos; filePickerSearch setter; flatFolderById + selectedFolderId (navegación dentro del picker); filesQuery.data.items (o filesPickerFiles? según lo inline haga). onPickFile callback que retorna fileId seleccionado al padre.

### Modificaciones a archivos existentes
1. **`ProjectDetailPage.tsx`**:
   - Mantener: imports que sirven para mutations/queries/state/derivados/handlers business.
   - Añadir 11 imports nuevos de los componentes arriba.
   - Eliminar inline JSX de los 18 bloques. Sustituir cada bloque por `<Componente {...props drilling}`.
   - Limpiar imports lucide icons/types que dejan de usarse solo en el padre tras la extracción.

## Implementation Steps (orden de riesgo creciente → bajo riesgo primero)

**Cada paso termina con `cd frontend && npm run typecheck` → 0 errores antes de avanzar.**

### Step 1 — Props tiny / sin lógica
Extraer los 3 más pequeños y fáciles (menos props, menos riesgo):
1. `ProjectPageToast.tsx` → reemplazar `{pageToast && ...}` inline.
2. `ProjectConfirmDeleteFileDialog.tsx` → reemplazar bloque `confirmDeleteFile`.
3. `ProjectProjectModals.tsx` → agrupar `ForbiddenDeleteDialog` y `DeleteProjectDialog` primero (2 pequeños). Typecheck.

### Step 2 — Carpetas chicas
`ProjectFolderModals.tsx` (RenameFolderModal + ConfirmDeleteFolderDialog) → sustituir 2 bloques inline. Typecheck.

### Step 3 — Carpetas + UI restante
`ProjectNewFolderModal.tsx` (solo). Typecheck.

### Step 4 — Maestro
`ProjectMasterModals.tsx` (MasterSelectorModal + ConfirmClearMasterDialog). Typecheck.

### Step 5 — Proyecto / Editar
Dentro de `ProjectProjectModals.tsx`: añadir `EditProjectModal`. Ya tenemos 2 modales de Step 1 → añadir el 3ero al mismo archivo. Typecheck.

### Step 6 — Equipo
`ProjectInviteMemberModal.tsx`. Typecheck.

### Step 7 — Reuniones
`ProjectMeetingDialogs.tsx` (NewMeeting + ConfirmDeleteMeeting). Typecheck.

### Step 8 — FilePicker reuniones
`ProjectFilePickerModal.tsx`. Typecheck.

### Step 9 — Context Menus (riesgo medio: refs + clamp)
`ProjectContextMenus.tsx` (3 menús). Typecheck.

### Step 10 — RenameFile (riesgo alto: 462 líneas, refs + versiones + comments + activity)
`ProjectRenameFileModal.tsx` (aislado por tamaño). Typecheck 0.

### Step 11 — Cleanup final padre
Grep unused imports en ProjectDetailPage.tsx (íconos lucide que solo se usaron en modales que ya salieron: X, Plus, Check, Loader2, ShieldAlert, Copy, ArrowRightLeft, FolderPlus, MessageCircle, Send, UserPlus, UserMinus, CheckCircle2, XCircle, File, FolderOpen, FolderKanban, Star, Search, Trash2, Edit3, Upload, FileCheck2, etc. — solo retirar los que el grep de 0 ocurrencias).

### Step 12 — Typecheck global final
`cd frontend && npm run typecheck` = 0. No build innecesario.

### Step 13 — Smoke runtime (Carlos)
Validación manual usuario:
- 7 tabs = comportamiento baseline.
- Abrir **cada uno de los 18 diálogos/menús**: cerrar sin cambios, reabrir, submit OK, submit con error (crear carpeta nombre vacío).
- Reuniones: Subir acta / Descargar / Desvincular / Cambiar estado / Añadir asistente.
- Renombrar archivo (462 líneas) con versiones/comentarios visibles.

## Dependencies and Considerations
- Todos los componentes usan únicamente las mismas dependencias que el padre (lucide-react, clsx, @tanstack/react-query indirectamente NO — los mutations pending se pasan por props como boolean/error value raw). NO importar hooks de query en hijos.
- Los handlers como `handleCreateFolder`, `handleRenameFolder`, `handleMasterDesignateSubmit`, `handleSubmitEdit`, `handleRenameFile` **siguen viviendo en el padre** → se pasan por prop `onSubmit={() => handleX()}`. No duplicar lógica.
- `folderCtxRef`, `fileCtxRef` y `ctxClamp` state: los dejo en el padre y los inyecto al componente. Motivo: los useEffect que clamean estas refs y actualizan clamp con observer viven en otras líneas del padre (fuera de los bloques inline). Moverlos al hijo rompería encapsulación de efectos.
- Tipos `ApiFolder / ApiFile / ApiMeeting / ProjectMember / OrgMember / ApiProjectStatus / PaginatedData / FavoriteResourceType`: se re-importan en los hijos de los mismos services que ya importa el padre.

## Validation
- **Mandatorio**: Typecheck 0 después de cada Step 1–12 individualmente. Estrategia "typecheck por bloque" para no arrastrar 40 errores al final.
- **Prohibido**: abrir navegador sin permiso previo explícito del usuario. Step 13 queda para validación manual suya.

## Risks
| Riesgo | Severidad | Manejo |
|---|---|---|
| `renameFile` 462 líneas con versiones, comentarios, actividad inline → perder una sección al extraer | Alto | Extraer como último Step 10 (menos urgente). Comparar visualmente antes/después del bloque. |
| Context menus: `folderCtxRef` / `fileCtxRef` + `ctxClamp` clamp estilos CSS → desalineación con los tamaños inline | Medio | Pasar refs y clamp props explícitamente al hijo; no recalcular clamp en hijo. |
| Props 30+ por modal → olvidar alguna → TS2322 missing prop | Bajo | Typecheck por step lo captura. |
| Props tipo `project?.color`/tipos de íconos que definieron `'PROJECT' as const` → incompatibilidad | Bajo | Mantener los imports de `FavoriteResourceType` etc. tal cual; usar los mismos tipos literales. |
| `renameFileInputRef` forwardRef? | Bajo | Es `MutableRefObject<HTMLInputElement|null>` del padre → lo paso como prop `renameFileInputRef`. El hijo coloca el `ref={renameFileInputRef}` en el `<input>` del nombre, igual que hoy. |
