import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Shield,
  ShieldCheck,
  ShieldPlus,
  Plus,
  Edit3,
  Trash2,
  X,
  Loader2,
  Search,
  Users,
  Save,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { formatRelativeTime } from '../services/projects.service'
import {
  ApiRole,
  deleteRole,
  listRoles,
  createRole,
  updateRole,
  setRolePermissions,
  listPermissionCatalog,
  PERMISSION_LEVEL_LABEL,
  PERMISSION_LEVEL_ORDER,
  type PermissionCatalogItem,
} from '../services/roles.service'
import type { CreateRoleDto, PermissionLevel, UpdateRoleDto, PermissionCode } from '../../../packages/shared-types/src'
import { useAuthStore } from '../store/authStore'

type EditRoleTarget = { mode: 'create' } | { mode: 'edit'; role: ApiRole } | null
type PermissionsEditTarget = ApiRole | null
type ConfirmDeleteTarget = ApiRole | null

function extractError(err: any, fallback: string): string {
  const data = err?.response?.data
  const detail = data?.error ? ` · ${String(data.error)}` : ''
  return (data?.message || err?.message || fallback) + detail
}

function RoleBadge({ name, isSystemRole }: { name: string; isSystemRole?: boolean }) {
  const up = (name || '').toUpperCase()
  const isAdmin = up.includes('ADMIN') || up.includes('PROPIETARIO') || up.includes('OWNER')
  return (
    <span
      className={clsx(
        'text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1',
        isAdmin
          ? 'bg-status-blocked/20 dark:bg-status-blocked/15 text-rose-700 dark:text-rose-200 border-status-blocked/40'
          : 'bg-brand-500/15 dark:bg-brand-500/10 text-brand-700 dark:text-brand-200 border-brand-500/30'
      )}
    >
      {isSystemRole ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
      {name}
    </span>
  )
}

function groupByLevelAndCategory(catalog: PermissionCatalogItem[]) {
  const groups: Record<PermissionLevel, Record<string, PermissionCatalogItem[]>> = {
    ORGANIZACION: {},
    PROYECTO: {},
    RECURSO: {},
    SISTEMA: {},
  }
  for (const item of catalog) {
    const lvl = (item.level || 'RECURSO') as PermissionLevel
    const cat = item.category ?? 'Otros'
    const key: PermissionLevel = PERMISSION_LEVEL_ORDER.includes(lvl) ? lvl : 'RECURSO'
    groups[key][cat] ||= []
    groups[key][cat].push(item)
  }
  return groups
}

function RolesPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const isOrgAdmin = !!currentUser?.isOrgAdmin
  const isHydrated = useAuthStore((s) => s.isHydrated)

  const [searchInput, setSearchInput] = useState('')
  const [editTarget, setEditTarget] = useState<EditRoleTarget>(null)
  const [permissionsTarget, setPermissionsTarget] = useState<PermissionsEditTarget>(null)
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteTarget>(null)

  const listQuery = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => listRoles({ includeUsersCount: true }),
    staleTime: 60_000,
    retry: 1,
  })
  const catalogQuery = useQuery({
    queryKey: ['roles', 'permissions-catalog'],
    queryFn: listPermissionCatalog,
    staleTime: 10 * 60_000,
    retry: 1,
  })

  const filtered: ApiRole[] = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    const all = listQuery.data ?? []
    if (!q) return all
    return all.filter((r) =>
      [r.name, r.description ?? '', String(r.priorityLevel)].some((s) => s.toLowerCase().includes(q))
    )
  }, [listQuery.data, searchInput])

  const totalRoles = listQuery.data?.length ?? 0
  const totalCatalogPermissions = catalogQuery.data?.length ?? 0
  const grouped = useMemo(
    () => (catalogQuery.data ? groupByLevelAndCategory(catalogQuery.data) : null),
    [catalogQuery.data]
  )

  const createMutation = useMutation({
    mutationFn: (p: CreateRoleDto) => createRole(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] })
      setEditTarget(null)
    },
    onError: (err: any) => alert(extractError(err, 'No se pudo crear el rol')),
  })
  const updateMutation = useMutation({
    mutationFn: (p: { id: string; data: UpdateRoleDto }) => updateRole(p.id, p.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] })
      setEditTarget(null)
    },
    onError: (err: any) => alert(extractError(err, 'No se pudo actualizar el rol')),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] })
      setConfirmDelete(null)
    },
    onError: (err: any) => alert(extractError(err, 'No se pudo eliminar el rol')),
  })
  const setPermsMutation = useMutation({
    mutationFn: (p: { id: string; permissionCodes: PermissionCode[] }) =>
      setRolePermissions(p.id, { permissionCodes: p.permissionCodes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] })
      setPermissionsTarget(null)
    },
    onError: (err: any) => alert(extractError(err, 'No se pudieron actualizar los permisos')),
  })

  const isLoading =
    listQuery.isLoading && listQuery.fetchStatus !== 'idle'
  const isEmpty = !isLoading && filtered.length === 0
  const headerTotal = isLoading ? '…' : String(totalRoles)

  if (isHydrated && !isOrgAdmin) {
    return <Navigate to="/projects" replace />
  }
  if (!isHydrated) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando…
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles y permisos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {headerTotal} roles · {totalCatalogPermissions} permisos en el catálogo
          </p>
        </div>
        <button className="btn-primary text-sm inline-flex items-center gap-2" onClick={() => setEditTarget({ mode: 'create' })}>
          <Plus className="w-4 h-4" />
          Nuevo rol
        </button>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar rol por nombre, descripción o nivel..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-base pl-10 py-1.5 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-4 animate-pulse">
              <div className="h-5 w-2/5 bg-surface-secondary rounded" />
              <div className="h-3 w-full bg-surface-secondary rounded" />
              <div className="h-3 w-4/5 bg-surface-secondary rounded" />
              <div className="h-8 w-full bg-surface-secondary rounded mt-2" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="card p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center">
            <ShieldPlus className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-semibold">No hay roles para mostrar</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {searchInput
              ? 'Ningún rol coincide con tu búsqueda. Prueba con otros términos.'
              : 'Aún no existen roles personalizados. Podés crear el primero haciendo clic en "Nuevo rol".'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary/60 text-[11.5px] text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-medium w-[28%]">Rol</th>
                  <th className="text-left px-4 py-2.5 font-medium w-[32%]">Descripción</th>
                  <th className="text-center px-4 py-2.5 font-medium w-[10%]">Nivel</th>
                  <th className="text-center px-4 py-2.5 font-medium w-[12%]">Permisos</th>
                  <th className="text-center px-4 py-2.5 font-medium w-[10%]">
                    <Users className="w-3.5 h-3.5 mx-auto" />
                    <span className="sr-only">Usuarios</span>
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium w-[8%]">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const nPerms = r.permissions?.length ?? null
                  return (
                    <tr key={r.id} className="hover:bg-surface-secondary/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <div
                            className={clsx(
                              'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ring-1',
                              r.isSystemRole
                                ? 'bg-status-blocked/10 text-rose-600 dark:text-rose-300 ring-status-blocked/30'
                                : 'bg-brand-500/10 text-brand-700 dark:text-brand-300 ring-brand-500/30'
                            )}
                          >
                            {r.isSystemRole ? <ShieldCheck className="w-4.5 h-4.5" /> : <Shield className="w-4.5 h-4.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground truncate">{r.name}</p>
                              <RoleBadge name={r.isSystemRole ? 'Sistema' : 'Personalizado'} isSystemRole={r.isSystemRole} />
                            </div>
                            <p className="text-[11.5px] text-muted-foreground mt-0.5">
                              Prioridad {r.priorityLevel.toString().padStart(3, '0')}
                              {r.isSystemRole && r.priorityLevel <= 25 ? ' · Admin org' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[12px] text-foreground/80 line-clamp-2">
                          {r.description ? r.description : <span className="text-muted-foreground italic">Sin descripción</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className="inline-block text-[11px] font-mono rounded-full px-2 py-0.5 bg-surface-secondary text-muted-foreground">
                          {r.priorityLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <button
                          type="button"
                          className={clsx(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] border transition',
                            catalogQuery.isSuccess
                              ? 'hover:border-brand-500/50 hover:text-brand-700 dark:hover:text-brand-300'
                              : 'opacity-80',
                            nPerms === 0
                              ? 'bg-surface text-muted-foreground border-border'
                              : 'bg-brand-500/10 border-brand-500/30 text-brand-700 dark:text-brand-300'
                          )}
                          disabled={!r.isSystemRole && !currentUser?.isOrgAdmin}
                          onClick={() => { if (catalogQuery.isSuccess) setPermissionsTarget(r) }}
                        >
                          {nPerms === null ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <span className="font-semibold tabular-nums">{nPerms}</span>
                          )}
                          <span>/ {totalCatalogPermissions || '…'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span className="tabular-nums">{r.usersCount ?? 0}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[11px] text-muted-foreground">
                          {r.updatedAt ? formatRelativeTime(r.updatedAt) : formatRelativeTime(r.createdAt)}
                        </p>
                        <div className="flex items-center gap-1 mt-2 justify-end">
                          <button
                            type="button"
                            className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-foreground"
                            title="Editar rol"
                            onClick={() => setEditTarget({ mode: 'edit', role: r })}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {!r.isSystemRole && (
                            <button
                              type="button"
                              className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-destructive"
                              title="Eliminar rol"
                              onClick={() => setConfirmDelete(r)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editTarget && (
        <EditRoleDrawer
          key={editTarget.mode === 'edit' ? editTarget.role.id : 'new'}
          target={editTarget}
          pending={createMutation.isPending || updateMutation.isPending}
          onClose={() => setEditTarget(null)}
          onSave={(payload) => {
            if (editTarget.mode === 'create') createMutation.mutate(payload)
            else updateMutation.mutate({ id: editTarget.role.id, data: payload })
          }}
        />
      )}

      {permissionsTarget && grouped && (
        <PermissionsDrawer
          role={permissionsTarget}
          grouped={grouped}
          pending={setPermsMutation.isPending}
          onClose={() => setPermissionsTarget(null)}
          onSave={(codes) => setPermsMutation.mutate({ id: permissionsTarget.id, permissionCodes: codes })}
          systemRoleLocked={permissionsTarget.isSystemRole && !isOrgAdmin ? false : false}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteRoleDialog
          role={confirmDelete}
          pending={deleteMutation.isPending}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        />
      )}
    </div>
  )
}

function EditRoleDrawer({
  target,
  pending,
  onClose,
  onSave,
}: {
  target: Exclude<EditRoleTarget, null>
  pending: boolean
  onClose: () => void
  onSave: (payload: CreateRoleDto) => void
}) {
  const isEdit = target.mode === 'edit'
  const seed = target.mode === 'edit' ? target.role : null
  const [name, setName] = useState(seed?.name ?? '')
  const [description, setDescription] = useState(seed?.description ?? '')
  const [priorityLevel, setPriorityLevel] = useState<number>(seed?.priorityLevel ?? 100)
  const [error, setError] = useState<string | null>(null)

  const canEditNameOrPriority = !isEdit || !(seed?.isSystemRole) || false

  return (
    <DrawerShell
      title={isEdit ? 'Editar rol' : 'Nuevo rol'}
      subtitle={isEdit && seed?.isSystemRole ? 'Rol de sistema: solo puedes editar la descripción' : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary text-sm h-8 px-3" disabled={pending} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary text-sm h-8 px-3 inline-flex items-center gap-2"
            disabled={pending || !!error || !name.trim()}
            onClick={() => {
              if (!name.trim()) return setError('El nombre es requerido')
              const num = Number(priorityLevel)
              if (Number.isNaN(num) || num < 0 || num > 255) return setError('Nivel debe ser 0-255')
              onSave({
                name: name.trim(),
                description: description.trim() || null,
                priorityLevel: num,
              })
            }}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </>
      }
    >
      <div className="space-y-4 p-6">
        <label className="block">
          <span className="text-[11.5px] font-medium text-foreground/80">Nombre</span>
          <input
            className="input-base mt-1"
            value={name}
            disabled={!canEditNameOrPriority || pending}
            onChange={(e) => { setName(e.target.value); setError(null) }}
            placeholder="Ej: Supervisor de proyectos"
          />
        </label>

        <label className="block">
          <span className="text-[11.5px] font-medium text-foreground/80">Descripción</span>
          <textarea
            className="input-base mt-1 min-h-[90px]"
            value={description ?? ''}
            disabled={pending}
            onChange={(e) => { setDescription(e.target.value); setError(null) }}
            placeholder="Qué alcance tiene este rol en la organización..."
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-1 block">
            <span className="text-[11.5px] font-medium text-foreground/80">Nivel prioridad (0-255)</span>
            <input
              type="number"
              min={0}
              max={255}
              className="input-base mt-1 tabular-nums"
              value={priorityLevel}
              disabled={!canEditNameOrPriority || pending}
              onChange={(e) => { setPriorityLevel(Number(e.target.value)); setError(null) }}
            />
          </label>
          <div className="col-span-2 flex items-end">
            <p className="text-[11.5px] text-muted-foreground">
              Los valores ≤ 25 marcan al usuario como <span className="font-semibold">Administrador de la organización</span> (isOrgAdmin). Menor valor = mayor prioridad.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive">
            {error}
          </div>
        )}

        {isEdit && seed && (
          <div className="rounded-md border border-border bg-surface-secondary/40 px-3 py-2 text-[11.5px] text-muted-foreground">
            Creado {formatRelativeTime(seed.createdAt)}
            {seed.updatedAt ? ` · Actualizado ${formatRelativeTime(seed.updatedAt)}` : ''}
          </div>
        )}
      </div>
    </DrawerShell>
  )
}

function PermissionsDrawer({
  role,
  grouped,
  pending,
  systemRoleLocked,
  onClose,
  onSave,
}: {
  role: ApiRole
  grouped: ReturnType<typeof groupByLevelAndCategory>
  pending: boolean
  systemRoleLocked?: boolean
  onClose: () => void
  onSave: (codes: PermissionCode[]) => void
}) {
  const initialCodes = useMemo(
    () => new Set<PermissionCode>((role.permissions ?? []).map((p) => p.code as PermissionCode)),
    [role.id, role.permissions]
  )
  const [selected, setSelected] = useState<Set<PermissionCode>>(initialCodes)
  useEffect(() => {
    setSelected(new Set(initialCodes))
  }, [initialCodes, role.id])

  const [collapsedLevels, setCollapsedLevels] = useState<Set<PermissionLevel>>(new Set())
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  const totalSelected = selected.size
  const totalAll = useMemo(
    () =>
      PERMISSION_LEVEL_ORDER.reduce(
        (acc, lvl) => acc + Object.values(grouped[lvl]).reduce((s, arr) => s + arr.length, 0),
        0
      ),
    [grouped]
  )
  const locked = systemRoleLocked || pending

  function toggle(code: PermissionCode, force?: boolean) {
    if (locked) return
    setSelected((prev) => {
      const next = new Set(prev)
      const on = force !== undefined ? force : !prev.has(code)
      if (on) next.add(code); else next.delete(code)
      return next
    })
  }

  function toggleAll(on: boolean) {
    if (locked) return
    setSelected(new Set(on ? allCodes(grouped) : []))
  }

  function toggleLevel(lvl: PermissionLevel, on: boolean) {
    if (locked) return
    setSelected((prev) => {
      const next = new Set(prev)
      for (const items of Object.values(grouped[lvl]))
        for (const it of items) if (on) next.add(it.code as PermissionCode); else next.delete(it.code as PermissionCode)
      return next
    })
  }

  function toggleCat(lvl: PermissionLevel, cat: string, on: boolean) {
    if (locked) return
    setSelected((prev) => {
      const next = new Set(prev)
      for (const it of grouped[lvl][cat] ?? [])
        if (on) next.add(it.code as PermissionCode); else next.delete(it.code as PermissionCode)
      return next
    })
  }

  return (
    <DrawerShell
      title={`Permisos · ${role.name}`}
      subtitle={
        <span>
          Seleccionados <span className="font-semibold">{totalSelected}</span> / {totalAll}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <div className="flex gap-2 mr-auto">
            <button
              type="button"
              className="btn-ghost h-8 px-3 text-[11.5px]"
              disabled={locked}
              onClick={() => toggleAll(true)}
            >
              Seleccionar todo
            </button>
            <button
              type="button"
              className="btn-ghost h-8 px-3 text-[11.5px]"
              disabled={locked}
              onClick={() => toggleAll(false)}
            >
              Limpiar
            </button>
          </div>
          <button type="button" className="btn-secondary text-sm h-8 px-3" disabled={pending} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary text-sm h-8 px-3 inline-flex items-center gap-2"
            disabled={pending}
            onClick={() => onSave(Array.from(selected))}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar cambios
          </button>
        </>
      }
    >
      <div className="p-4 space-y-6">
        {PERMISSION_LEVEL_ORDER.map((lvl) => {
          const cats = grouped[lvl]
          const codes = Object.values(cats).flat()
          if (codes.length === 0) return null
          const levelOn = codes.every((it) => selected.has(it.code as PermissionCode))
          const levelPartial = codes.some((it) => selected.has(it.code as PermissionCode)) && !levelOn
          const collapsed = collapsedLevels.has(lvl)
          return (
            <div key={lvl} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-secondary/50">
                <button
                  type="button"
                  className="btn-ghost-square w-7 h-7 text-muted-foreground"
                  onClick={() => setCollapsedLevels((s) => { const n = new Set(s); collapsed ? n.delete(lvl) : n.add(lvl); return n })}
                >
                  {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <TriCheckbox
                  checked={levelOn}
                  partial={levelPartial}
                  disabled={locked}
                  onChange={(v) => toggleLevel(lvl, v)}
                />
                <LevelSectionHeaderInline level={lvl} count={codes.length} />
              </div>
              {!collapsed && Object.keys(cats).length > 0 && (
                <div className="divide-y divide-border">
                  {Object.entries(cats).map(([cat, items]) => {
                    const catOn = items.every((it) => selected.has(it.code as PermissionCode))
                    const catPartial = items.some((it) => selected.has(it.code as PermissionCode)) && !catOn
                    const key = `${lvl}__${cat}`
                    const catCollapsed = collapsedCats.has(key)
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-3 px-4 py-2">
                          <button
                            type="button"
                            className="btn-ghost-square w-7 h-7 text-muted-foreground"
                            onClick={() => setCollapsedCats((s) => { const n = new Set(s); catCollapsed ? n.delete(key) : n.add(key); return n })}
                          >
                            {catCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <TriCheckbox
                            checked={catOn}
                            partial={catPartial}
                            disabled={locked}
                            onChange={(v) => toggleCat(lvl, cat, v)}
                          />
                          <p className="text-[12px] font-semibold text-foreground/85 flex-1">
                            {cat}
                            <span className="ml-2 text-[10.5px] font-normal text-muted-foreground">
                              {items.length} permisos
                            </span>
                          </p>
                        </div>
                        {!catCollapsed && (
                          <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                            {items.map((it) => {
                              const on = selected.has(it.code as PermissionCode)
                              return (
                                <label
                                  key={it.id}
                                  className={clsx(
                                    'group flex items-start gap-2 rounded-md px-2 py-1.5 -mx-1 transition-colors cursor-pointer',
                                    on ? 'bg-brand-500/8 dark:bg-brand-500/10' : 'hover:bg-surface-secondary/50'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1.5"
                                    checked={on}
                                    disabled={locked}
                                    onChange={(e) => toggle(it.code as PermissionCode, e.target.checked)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11.5px] font-mono leading-tight text-foreground/95 group-hover:text-foreground truncate">
                                      {it.code}
                                    </p>
                                    {it.description && (
                                      <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                                        {it.description}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </DrawerShell>
  )
}

function ConfirmDeleteRoleDialog({
  role,
  pending,
  onClose,
  onConfirm,
}: {
  role: ApiRole
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const hasUsers = (role.usersCount ?? 0) > 0
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md card p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">Eliminar rol</h3>
            <p className="text-[12px] text-muted-foreground mt-1">
              Esta acción no se puede deshacer. El rol <span className="font-medium text-foreground">{role.name}</span> se quitará definitivamente.
            </p>
          </div>
          <button className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {hasUsers && (
          <div className="rounded-md border border-status-blocked/40 bg-status-blocked/10 px-3 py-2 text-[11.5px] text-status-blocked dark:text-rose-300">
            Este rol tiene asignado <span className="font-semibold">{role.usersCount}</span> usuario(s).
            No se permitirá eliminar hasta que reasignes esos usuarios.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary text-sm h-8 px-3" disabled={pending} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-destructive text-sm h-8 px-3 inline-flex items-center gap-2"
            disabled={pending || hasUsers}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Eliminar rol
          </button>
        </div>
      </div>
    </div>
  )
}

function DrawerShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string
  subtitle?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute inset-y-0 right-0 w-full sm:max-w-[680px] bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border p-4 pr-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ShieldPlus className="w-4 h-4 text-muted-foreground" />
              {title}
            </h2>
            {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button className="btn-ghost-square w-8 h-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center gap-2 border-t border-border p-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function LevelSectionHeaderInline({ level, count }: { level: PermissionLevel; count: number }) {
  return (
    <div className="flex-1 flex items-center gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-foreground/80">
        {PERMISSION_LEVEL_LABEL[level]}
      </span>
      <span className="text-[10.5px] text-muted-foreground rounded-full px-2 py-0.5 bg-surface-secondary">
        {count}
      </span>
    </div>
  )
}

function TriCheckbox({
  checked,
  partial,
  disabled,
  onChange,
}: {
  checked: boolean
  partial?: boolean
  disabled?: boolean
  onChange: (nextChecked: boolean) => void
}) {
  return (
    <label
      className={clsx(
        'inline-flex items-center justify-center w-7 h-7 rounded-md transition',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-surface-secondary'
      )}
    >
      <input
        type="checkbox"
        ref={(el) => {
          if (!el) return
          el.checked = checked
          el.indeterminate = !!partial && !checked
        }}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function allCodes(grouped: ReturnType<typeof groupByLevelAndCategory>): PermissionCode[] {
  const out: PermissionCode[] = []
  for (const lvl of PERMISSION_LEVEL_ORDER) {
    for (const items of Object.values(grouped[lvl])) {
      for (const it of items) out.push(it.code as PermissionCode)
    }
  }
  return out
}

export default RolesPage
