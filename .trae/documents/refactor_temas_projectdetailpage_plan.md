# Refactor Módulo Temas (Enfoque A — No invasivo, sin romper nada)

Auditoría + plan de refactor incremental, siempre manteniendo `useQuery` / `useMutation` DENTRO de [ProjectDetailPage.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx) conforme hard constraint project\_memory.

***

## 1. Repository Research (Auditoría completa Capas BD / Backend / Frontend)

### 1.1 Capa MSSQL — ✅ Estructura congruente (tablas / FKs / IX)

Reset script [000\_KMS\_RESET\_TOTAL.sql](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/infra/sql/000_KMS_RESET_TOTAL.sql) refleja 100% la estructura física actual:

| Tabla                       | Clave                                            | FKs                                                                                                | IX                                                                                                            |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `TemasProyecto`             | PK `Id` GUID                                     | `FK_Tema_Proyecto` CASCADE, `FK_Tema_Creador` NO\_ACTION                                           | `IX_IdCreador`, `IX_IdProyecto_Orden` ambos `INCLUDE(...)` — OK MSSQL 2014 SOPORTA `INCLUDE` para NC índices. |
| `TemasProyectoItems`        | PK `Id` GUID                                     | `FK_TemaItem_Tema` CASCADE, **NO tiene** **`IdCreador`** (confirmado project\_memory)              | `IX_IdTema_Orden INCLUDE`, `IX_IdTema_Estado INCLUDE`                                                         |
| `TemasProyectoItemMiembros` | PK `Id` GUID + UQ `IdTemaItem,IdMiembroProyecto` | `FK_TemaItemMiembro_Item` NO\_ACTION, `FK_TemaItemMiembro_Miembro` NO\_ACTION                      | `IX_IdTemaItem INCLUDE`, `IX_IdMiembroProyecto INCLUDE` ✅                                                     |
| `ReunionesTemasVinculados`  | PK COMPUESTA `(IdReunion, IdTema)`               | `FK_RTV_Reunion` CASCADE, **`FK_RTV_Tema`** **NO\_ACTION**, **`FK_RTV_Vinculante`** **NO\_ACTION** | `IX_RTV_IdTema (IdTema, IdReunion)` NC compuesto, `IX_RTV_IdUsuarioVinculante` NC compuesto ✅                 |

**Riesgo BD descartado**: Cleanup usuarios en RTV → `users.controller.ts` usa `softDeleteUserHandler` (status `DELETED` no borrado físico). Por lo tanto `FK_RTV_Vinculante NO_ACTION` NUNCA bloquea. No hay nada que agregar.

**Riesgo BD detectado (LOW)**: `deleteTopic` del backend [project-topics.controller.ts:L509-L515](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/project-topics/project-topics.controller.ts#L509-L515) SI hace el cleanup manual de RTV antes de borrar tema. OK.

### 1.2 Capa Backend — ✅ Cableado correcto, 2 inconsistencias LOW:

* **Controller** [project-topics.controller.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/project-topics/project-topics.controller.ts) (1103 líneas): `listTopics / get / create / update / delete` + `items` + `miembros`. TODO:

  * ✅ Validación multi-tenant por `p.IdOrganizacion == auth.organizationId` en `getTopicRowOrThrow` (todos los endpoints que tocan tema/item pasan por esto).

  * ✅ `recalculateProjectProgress(projectId)` con 1 transacción, `transaction.request()` NUEVA por iter (fix #207 redecl param).

  * ✅ Mapeo `u.Correo` en 8 joins (fix histórico #Email).

  * ✅ listTopicItems usa `IN(CAST AS UNIQUEIDENTIFIER ...)` con regex GUID seguro — no TVPs (MSSQL 2014 compatible).

  * ⚠️ **LOW ISSUE #1** [L553-L558](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/project-topics/project-topics.controller.ts#L553-L558): `listTopicItems` count hace `SELECT COUNT(*) ... WHERE IdTema = @topicId` SIN pasar por JOIN `Proyectos → IdOrganizacion`. **Está protegido por el** **`getTopicRowOrThrow`** **de la L547**, pero por congruencia multi-tenant se recomienda agregar el org-check también al count (LOW risk, no falla porque el scope de la L547 ya bloquea).

* **Routes** [project-topics.routes.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/modules/project-topics/project-topics.routes.ts): `Router({ mergeParams: true })`, 12 rutas con `requireResourcePermission('PROJECT', VER/EDITAR/ADMINISTRAR, projectIdFromParams)`. ✅

* **app.ts montaje**: `topicsRouter` en [L68](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/backend/src/app.ts#L68) ANTES de `projectsRouter` (L69). ✅ evita colisión de parámetros.

* **shared-types** [index.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/packages/shared-types/src/index.ts#L324-L380): `ProjectTopic`, `ProjectTopicItem`, `ProjectTopicItemMember`, `TopicStatus`, `TopicItemStatus`, `DB_TOPIC_STATUS`, `DB_TOPIC_ITEM_STATUS` — sincronizados 1:1 con el controller. ✅

### 1.3 Capa Frontend Orquestador [ProjectDetailPage.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx)

Conteo actual (antes de refactor) **solo del dominio Temas**:

* **38 useState individuales** (líneas [L239-L279](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx#L239-L279)):

  * 18 state: Temas (paginación/filtro, forms nuevo+editar, confirm delete, expandedId)

  * 18 state: Items (lo mismo + assignedMembers x2)

  * 2 state: Miembros (managingMembersForItemId, manageMembersError)

* **3 useQuery** (lines [L489-L549](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx#L489-L549)): `topicsQuery`, `topicItemsQuery`, `topicItemAvailableMembersQuery` → **MANTENER SIEMPRE AQUÍ (hard constraint)**.

* **8 useMutation** (lines [L913-L1052](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx#L913-L1052)): create/update/delete Topic, create/update/delete TopicItem, assign/unassign member → **MANTENER SIEMPRE AQUÍ**.

* **14 funciones helper** (lines [L1054-L1165](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx#L1054-L1165)): `resetNewTopicItemForm`, `openNewTopic`, `handleSubmitTopic`, etc. → ESTAS SON LAS QUE SE EXTRAEN.

* **103 props individuales** pasadas a `ProjectTopicsTab` [L2009-L2112](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/pages/ProjectDetailPage.tsx#L2009-L2112) → agrupar en 3 objetos tipo: `topicFilters`, `topicFormsState`, `topicItemFormsState`, `topicMemberMgmtState`.

### 1.4 Capa Frontend Dumb Tab [ProjectTopicsTab.tsx](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/components/project/ProjectTopicsTab.tsx)

* Props [ProjectTopicsTabProps](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/components/project/ProjectTopicsTab.tsx#L22-L152): **152 líneas de declaración Props, 103 props** → objetivo: bajar a 12 props agrupadas.

* Dentro del tab no hay hooks de data, solo render puro → ✅ congruente con restricción.

### 1.5 Services Frontend [project-topics.service.ts](file:///d:/DesarrolloWeb/SistemaGestionConocimiento/frontend/src/services/project-topics.service.ts): 12 funciones + tipos `ApiTopic*` → ✅ sin cambios.

***

## 2. Files and Modules

**Backend (1 archivo touch, LOW)**:

* `backend/src/modules/project-topics/project-topics.controller.ts` — countRow `listTopicItems` org-chain opcional (LOW).

**Frontend (5 archivos):**

* `frontend/src/pages/ProjectDetailPage.tsx` — quitar 38 useState individuales y 14 helpers, reemplazar por 2 custom hooks; agrupar las 103 props a `ProjectTopicsTab` en 3-4 objetos Props agrupados.

* `frontend/src/components/project/project-topics/useTopicForms.ts` (NUEVO) — custom hook que encapsula los 20 state + 8 handlers de forms TEMAS (nuevo/editar/confirm delete/openEdit/submit). NO contiene useQuery/useMutation.

* `frontend/src/components/project/project-topics/useTopicItemForms.ts` (NUEVO) — custom hook que encapsula los 18 state + 6 handlers de forms ITEMS (nuevo/editar/confirm delete/reset forms/openManageMembers/submit). NO contiene useQuery/useMutation.

* `frontend/src/components/project/project-topics/types.ts` (NUEVO) — declara `TopicFiltersState`, `TopicFormsState`, `TopicItemFormsState`, `TopicMemberMgmtState`, `TopicPaginationData`, `TopicItemPaginationData` (tipos agrupados). **No usar barrel file** **`index.ts`** (hard constraint project\_memory: prohibido barrel files en `components/project`).

* `frontend/src/components/project/ProjectTopicsTab.tsx` — modificar `ProjectTopicsTabProps`: reemplazar 103 props individuales por 8-12 props agrupadas. El destructuring interno se actualiza, el render NO cambia.

***

## 3. Implementation Steps (orden de dependencias)

### Fase 0 — Pre-validación (0 cambios)

* [x] 0.1 Ejecutar `npx tsc --noEmit backend/` + `npx tsc --noEmit frontend/` → 0 errores (snapshot actual confirmado).

### Fase 1 — Backend fix opcional (LOW, 15min)

SI se aprueba realizarlo, si no SKIP:
1.1 Modificar `listTopicItems` countQuery \[L553-L558] para que haga JOIN `TemasProyecto t ON t.Id=@topicId JOIN Proyectos p ON p.Id=t.IdProyecto WHERE p.IdOrganizacion=@orgId`. El scope de la L547 ya lo protege, es solo congruencia. El `dataReq` de items (L560-L569) no requiere cambio porque su WHERE `IdTema=@topicId` + `getTopicRowOrThrow` ya lo valida.

SKIP recomendado en esta fase (no romper nada → dejarlo así y marcarlo tech debt): **marcado como NO APLICAR para maximizar no-rotura**.

### Fase 2 — Frontend: Crear archivos NUEVOS types + hooks SIN tocar NADA existente

2.1 Crear `frontend/src/components/project/project-topics/types.ts`

* `export type TopicFiltersState = { topicsSearch; setTopicsSearch; topicsStatusFilter; setTopicsStatusFilter; topicsPage; setTopicsPage; topicsPageSize }`

* `export type TopicItemFiltersState = { topicItemsSearch; setTopicItemsSearch; topicItemsStatusFilter; setTopicItemsStatusFilter; topicItemsPage; topicItemsPageSize }`

* `export type TopicFormsState = { showNewTopic; setShowNewTopic; editingTopic; setEditingTopic; formNew (title,desc,order,status,error + setters); formEdit (title,desc,order,status,error + setters); confirmDeleteTopic; setConfirmDeleteTopic }`

* `export type TopicItemFormsState = { expandedTopicId; setExpandedTopicId; showNewTopicItem; setShowNewTopicItem; editingTopicItem; setEditingTopicItem; formNew (title,desc,order,status,assignedMembers[],error + setters); formEdit (title,desc,order,status,assignedMembers[],error + setters); confirmDeleteTopicItem; setConfirmDeleteTopicItem }`

* `export type TopicMemberMgmtState = { managingMembersForItemId; setManagingMembersForItemId; manageMembersError; setManageMembersError }`

* `export type TopicMutationsPending = { createTopicPending; updateTopicPending; deleteTopicPending; createTopicItemPending; updateTopicItemPending; deleteTopicItemPending; assignItemMemberPending; unassignItemMemberPending }`

* `export type TopicCallbacks = { onNewTopic; onEditTopic; onSubmitTopic; onConfirmDeleteTopic; onNewTopicItem; onEditTopicItem; onSubmitTopicItem; onConfirmDeleteTopicItem; onOpenManageMembersForItem; onAssignItemMember; onUnassignItemMember }`

* Prohibido barrel `index.ts`: ProjectDetailPage importa directamente de `./project-topics/types`.

2.2 Crear `frontend/src/components/project/project-topics/useTopicForms.ts`

* Hook `export function useTopicForms(params: { setPageToast: (...) => void })` → retorna TODO el state de `TopicFormsState` + los callbacks `{ openNewTopic, openEditTopic, handleSubmitTopic, onConfirmDeleteTopic_wrapper? }`.

* Importante: el hook NO ejecuta las mutations. Retorna el state crudo y funciones helper que modifican state; la llamada real a `createTopicMutation.mutate()` sigue en ProjectDetailPage en `handleSubmitTopic` (el hook puede retornar `buildCreatePayload()` helper que valida longitud, construye el payload, setea errors en el state).

* Objetivo: encapsular 20 useState + validaciones de longitud, NO mover useMutation.

2.3 Crear `frontend/src/components/project/project-topics/useTopicItemForms.ts`

* Hook `export function useTopicItemForms()` → retorna `TopicItemFormsState` + `TopicMemberMgmtState` + helpers `openNewTopicItem, openEditTopicItem, resetNewTopicItemForm, resetEditTopicItemForm, openManageMembersForItem, buildCreateItemPayload, buildUpdateItemPayload`.

* Tampoco contiene useMutation.

### Fase 3 — Modificar ProjectDetailPage.tsx: reemplazar state individual por los 2 hooks (sin tocar useQuery/useMutation)

3.1 Importar los 2 hooks.
3.2 Eliminar las 38 líneas de `useState` individuales de Temas (L239-L279). Sustituir por:

* `const topicForms = useTopicForms({ setPageToast })`

* `const topicItemForms = useTopicItemForms()`
  3.3 Actualizar los 8 useMutation (L913-L1052) para que los `setShowNewTopic(false)`, `resetNewTopicItemForm()` llamen a los setters devueltos por `topicForms.xxx` y `topicItemForms.xxx` en vez de los antiguos setters individuales.
  3.4 Actualizar las 14 funciones helper (L1054-L1165) para que deleguen en `topicForms.handleSubmitTopicBuildPayload()` / `topicItemForms.openEdit(...)` etc.
  3.5 Actualizar la llamada a `<ProjectTopicsTab ... />` (L2009-L2112) pasando props AGRUPADAS:

* `topicFilters={...}` (páginación + filtros temas)

* `topicPaginationData={topicsQuery.data}` (items/total/totalPages/page)

* `topicUiState={...}` (loading, error, fetchStatus)

* `topicFormsState={topicForms.state}`

* `topicItemFilters={...}`

* `topicItemPaginationData={topicItemsQuery.data}`

* `topicItemUiState={topicItemsQuery.isLoading, isError}`

* `topicItemFormsState={topicItemForms.state}`

* `topicMemberMgmtState={topicItemForms.memberState}`

* `topicAvailableMembersUi={loading,error,data}`

* `pending={createTopicPending,...}` (obj agrupado `TopicMutationsPending`)

* `callbacks={{ onNewTopic, onEditTopic, onSubmitTopic, ... }}`

### Fase 4 — Modificar `ProjectTopicsTab.tsx`: Props new shape, MANTENER INTACTO RENDER

4.1 Nuevo `ProjectTopicsTabProps` con \~12 props en lugar de 103: las 10 listadas arriba + `formatRelativeTime` + `canEditTopics / canDeleteTopics / canAddTopicItems / canEditTopicItems / canDeleteTopicItems / canAssignItemMembers` (permisos planos no agrupados porque son 6 bools sueltos).
4.2 Destructuring en la función: primero extrae `topicFormsState.newTopicTitle` y asigna a variables locales con nombres antiguos. Así TODO EL RENDER de ProjectTopicsTab no cambia ni una sola línea (objetivo 0 roturas).
4.3 Validar: `npx tsc --noEmit frontend/` = 0.

### Fase 5 — Validación final

5.1 `tsc --noEmit backend` / `tsc --noEmit frontend` = 0 errores.
5.2 Prueba manual en navegador sandbox:

* Ir a pestaña Temas → se ven los temas.

* Expandir un tema → se ven los conceptos.

* Crear tema → success toast + lista actualizada + header % actualiza.

* Editar tema → se guarda.

* Borrar tema → confirm dialog + desaparece + % se recalcula.

* Crear concepto (con 2 miembros asignados) → success.

* Editar concepto, cambiar estado a COMPLETADO → % del tema sube, % del proyecto sube (invalidateDetail).

* Desasignar miembro de concepto, asignar otro.

* Borrar concepto.

* Volver a pestaña Reuniones, abrir Temas(0) popover → siga funcionando (no tocamos esa parte).

***

## 4. Dependencies and Considerations

* **Hard constraint project\_memory (SIEMPRE CUMPLIR)**: `useQuery`/`useMutation` de TEMAS nunca salen de ProjectDetailPage.tsx. Los 2 nuevos hooks solo manejan state del formulario.

* **Hard constraint 2**: Prohibido React Context y barrel files `index.ts` en `components/project`. El folder `project-topics/` contiene `types.ts`, `useTopicForms.ts`, `useTopicItemForms.ts` — sin index.ts.

* **ProjectTopicsTab NO puede agregar hooks internos de data**: sigue siendo dumb-render. Todo state de forms le llega por props (igual que antes).

* **Número mínimo de cambios en render del tab**: la fase 4.2 crea variables locales de los nombres antiguos a partir del objeto nuevo. Ej:

  ```ts
  const newTopicTitle = topicFormsState.formNew.title
  const setNewTopicTitle = topicFormsState.formNew.setTitle
  ```

  Así 0 cambios en el JSX.

* **Sin refactors cosméticos adicionales**: no renombrar clases, no mover lógica de estilos, no reordenar imports (salvo los de state que se van a los hooks). Maximal no-rotura.

***

## 5. Validation

1. **TypeScript**: `npx tsc --noEmit -p frontend/tsconfig.json` exit 0.
2. **Mutations siguen funcionando**: crear/editar/borrar tema crea concepto, asigna miembros. Todas las mutations se disparan desde ProjectDetailPage handlers igual que antes (los helpers de submit delegan en el mismo código).
3. **Invalidación caché React Query**: tras cada cambio → `invalidateDetail()` se sigue llamando. `queryClient.invalidateQueries(['project','topics', projectId])`, `['project','topic','items', ...]` — igual que antes.
4. **Persistencia en BD**: al crear un concepto con assignedMembers, se inserta correctamente en `TemasProyectoItemMiembros` (validación UQ `Item + Miembro` sigue existiendo, no tocamos nada del backend de items en este refactor).
5. **Backwards compatible API**: el frontend llama a los mismos endpoints con los mismos payloads shape — no cambiamos services. ✅

***

## 6. Risks

| Riesgo                                                                                                                                        | Probabilidad | Impacto             | Mitigación                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Props count era 103 y al agrupar en objetos olvido pasar alguna prop                                                                          | MEDIA        | MEDIA (render roto) | En la Fase 4.2, las variables locales se nombran IGUAL que antes. tsc --noEmit falla si falta una.                                                                                                                                                                    |
| Los callbacks `onSubmitTopic` que antes usaban closures sobre `newTopicTitle` local ahora leen del objeto state nuevo → valor desincronizado? | BAJA         | ALTO                | El custom hook de forms retorna setters normales de React, state se actualiza en el siguiente render igual que useState individuales. No hay cambio. Para máxima seguridad, en `handleSubmitTopic` el payload se arma usando el state en el momento, igual que antes. |
| `setPageToast` se pasa como parámetro a `useTopicForms` — si el hook lo llama en useEffect?                                                   | —            | —                   | El hook NO usa useEffect, solo retorna state + setters + `buildCreatePayload` que setea `formNew.error`. Ningún side effect dentro del hook.                                                                                                                          |
| Olvido que `expandedTopicId` se usa TAMBIÉN en ProjectDetailPage fuera del módulo Temas (en invalidaciones de query)                          | BAJA         | BAJA                | expandedTopicId sigue EXISTIENDO, pero ahora viene de `topicItemForms.expandedTopicId` (o como parte del hook). No cambia de scope.                                                                                                                                   |
| Backend fix optional de countRow → skip                                                                                                       | N/A          | N/A                 | NO APLICAR en esta iteración para no tocar backend → anotado como deuda baja en documento.                                                                                                                                                                            |

***

## 7. Out of Scope (NO HACER)

* ❌ Mover useQuery/useMutation a sub-orquestador (Enfoque B).

* ❌ Refactor de estilos / layout del tab Temas (solo Props shape + state hooks nuevo).

* ❌ Borrar filas demo de TemasProyectoItems "\[FIX OK] Concepto E2E" etc — clean up separado si se solicita.

* ❌ Actualizar versión header del reset sql 000 → tarea separada.

* ❌ Touch del backend más allá del skip opcional countRow.

* ❌ Barrel files / React Context.

