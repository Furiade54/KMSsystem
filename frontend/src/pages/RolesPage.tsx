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
  Crown,
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
      [r.name, r.description ?? '', r.isOrgAdmin ? 'admin organizacion' : ''].some((s) => s.toLowerCase().includes(q))
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
            placeholder="Buscar rol por nombre, descripción o admin..."
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
                  <th className="text-center px-4 py-2.5 font-medium w-[10%]">Tipo</th>
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
                              {r.isOrgAdmin && (
                                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-400/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30">
                                  <Crown className="w-3 h-3" />
                                  Admin org
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[12px] text-foreground/80 line-clamp-2">
                          {r.description ? r.description : <span className="text-muted-foreground italic">Sin descripción</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5',
                            r.isOrgAdmin
                              ? 'bg-amber-400/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30'
                              : 'bg-surface-secondary text-muted-foreground'
                          )}
                        >
                          {r.isOrgAdmin ? (
                            <>
                              <Crown className="w-3 h-3" />
                              Admin org
                            </>
                          ) : (
                            'Estándar'
                          )}
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
  const [isOrgAdmin, setIsOrgAdmin] = useState<boolean>(seed?.isOrgAdmin ?? false)
  const [error, setError] = useState<string | null>(null)

  const canEditNameOrAdmin = !isEdit || !(seed?.isSystemRole) || false

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
              onSave({
                name: name.trim(),
                description: description.trim() || null,
                isOrgAdmin,
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
            disabled={!canEditNameOrAdmin || pending}
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

        <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-input text-brand-600 focus:ring-brand-500 shrink-0"
            checked={isOrgAdmin}
            disabled={!canEditNameOrAdmin || pending}
            onChange={(e) => setIsOrgAdmin(e.target.checked)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
              <span className="text-[12.5px] font-semibold text-foreground/90">Administrador de la organización</span>
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
              Al marcar esta opción, el rol <span className="font-semibold">salta todos los permisos</span>: tiene acceso total a la organización y sus proyectos, sin importar qué casillas estén marcadas.
            </p>
          </div>
        </label>

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

  const [collapsedLevels, setCollapsedLevels] = useState<Set<PermissionLevel>>(
    () => new Set(PERMISSION_LEVEL_ORDER.filter((lvl) => Object.keys(grouped[lvl]).length > 0))
  )
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
    const s = new Set<string>()
    for (const lvl of PERMISSION_LEVEL_ORDER) {
      for (const cat of Object.keys(grouped[lvl])) s.add(`${lvl}__${cat}`)
    }
    return s
  })
  const [openLevel, setOpenLevel] = useState<PermissionLevel | null>(null)
  const [openCatByLevel, setOpenCatByLevel] = useState<Record<PermissionLevel, string | null>>(() => ({
    ORGANIZACION: null,
    PROYECTO: null,
    RECURSO: null,
    SISTEMA: null,
  }))

  function toggleLevelOpen(lvl: PermissionLevel, expand: boolean) {
    setCollapsedLevels((prev) => {
      if (!expand) {
        const n = new Set(prev)
        n.add(lvl)
        return n
      }
      const n = new Set(PERMISSION_LEVEL_ORDER.filter((x) => Object.keys(grouped[x]).length > 0))
      n.delete(lvl)
      return n
    })
    setOpenLevel(expand ? lvl : null)
  }

  function toggleCatOpen(lvl: PermissionLevel, cat: string, expand: boolean) {
    const key = `${lvl}__${cat}`
    setCollapsedCats((prev) => {
      const catsOfLevel = Object.keys(grouped[lvl]).map((c) => `${lvl}__${c}`)
      if (!expand) {
        const n = new Set(prev)
        n.add(key)
        return n
      }
      const n = new Set(prev)
      for (const c of catsOfLevel) n.add(c)
      n.delete(key)
      return n
    })
    setOpenCatByLevel((prev) => ({ ...prev, [lvl]: expand ? cat : null }))
  }

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
          {totalAll > 0 && (
            <span className="ml-2 text-[10px] text-muted-foreground tabular-nums">
              ({Math.round((totalSelected / totalAll) * 100)}%)
            </span>
          )}
        </span>
      }
      progressPct={totalAll > 0 ? (totalSelected / totalAll) * 100 : 0}
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
      <div className="p-3 space-y-2.5">
        {PERMISSION_LEVEL_ORDER.map((lvl) => {
          const cats = grouped[lvl]
          const codes = Object.values(cats).flat()
          if (codes.length === 0) return null
          const levelOn = codes.every((it) => selected.has(it.code as PermissionCode))
          const levelPartial = codes.some((it) => selected.has(it.code as PermissionCode)) && !levelOn
          const collapsed = collapsedLevels.has(lvl)
          const accent = LEVEL_ACCENT[lvl]
          const levelChecked = codes.filter((it) => selected.has(it.code as PermissionCode)).length
          return (
            <div key={lvl} className={clsx('rounded-lg border border-border bg-surface overflow-hidden')}>
              <div className={clsx('flex items-center gap-2 px-3 py-1.5 border-b border-border', accent.headerBg)}>
                <button
                  type="button"
                  className="btn-ghost-square w-6 h-6 text-muted-foreground"
                  onClick={() => toggleLevelOpen(lvl, collapsed)}
                >
                  <span
                    className={clsx(
                      'inline-block transition-transform duration-200 ease-in-out motion-reduce:transition-none',
                      collapsed ? 'rotate-0' : 'rotate-90'
                    )}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </button>
                <TriCheckbox
                  checked={levelOn}
                  partial={levelPartial}
                  disabled={locked}
                  onChange={(v) => toggleLevel(lvl, v)}
                  title={
                    levelOn ? 'Desmarcar todo el nivel' :
                      levelPartial ? `Marcar todo el nivel (${levelChecked}/${codes.length} ya seleccionados)` :
                        'Marcar todo el nivel'
                  }
                />
                <LevelSectionHeaderInline level={lvl} count={codes.length} />
              </div>
              {Object.keys(cats).length > 0 && (
                <Collapsible open={!collapsed}>
                  <div className="divide-y divide-border">
                    {Object.entries(cats).map(([cat, items]) => {
                      const catOn = items.every((it) => selected.has(it.code as PermissionCode))
                      const catPartial = items.some((it) => selected.has(it.code as PermissionCode)) && !catOn
                      const key = `${lvl}__${cat}`
                      const catCollapsed = collapsedCats.has(key)
                      const catChecked = items.filter((it) => selected.has(it.code as PermissionCode)).length
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2 px-3 py-1">
                            <button
                              type="button"
                              className="btn-ghost-square w-6 h-6 text-muted-foreground"
                              onClick={() => toggleCatOpen(lvl, cat, catCollapsed)}
                            >
                              <span
                                className={clsx(
                                  'inline-block transition-transform duration-200 ease-in-out motion-reduce:transition-none',
                                  catCollapsed ? 'rotate-0' : 'rotate-90'
                                )}
                              >
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </button>
                            <TriCheckbox
                              checked={catOn}
                              partial={catPartial}
                              disabled={locked}
                              onChange={(v) => toggleCat(lvl, cat, v)}
                              title={
                                catOn ? `Desmarcar "${cat}"` :
                                  catPartial ? `Marcar todo "${cat}" (${catChecked}/${items.length} ya seleccionados)` :
                                    `Marcar todo "${cat}"`
                              }
                            />
                            <p className="text-[11.5px] font-semibold text-foreground/85 flex-1">
                              {cat}
                              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground tabular-nums">
                                {catChecked}/{items.length}
                              </span>
                            </p>
                          </div>
                          <Collapsible open={!catCollapsed}>
                            <div className="px-3 py-1.5 grid grid-cols-1 gap-y-0.5">
                              {items.map((it) => {
                                const on = selected.has(it.code as PermissionCode)
                                const permTitle = it.description ? `${it.code} — ${it.description}` : it.code
                                return (
                                  <label
                                    key={it.id}
                                    title={permTitle}
                                    className={clsx(
                                      'group flex items-center gap-2 rounded-md px-2 py-0.5 -mx-1 transition-colors cursor-pointer',
                                      on ? 'bg-brand-500/8 dark:bg-brand-500/10' : 'hover:bg-surface-secondary/50'
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="shrink-0"
                                      checked={on}
                                      disabled={locked}
                                      onChange={(e) => toggle(it.code as PermissionCode, e.target.checked)}
                                    />
                                    <div className="min-w-0 flex-1 flex items-baseline gap-2">
                                      <p className="text-[11px] font-mono leading-snug text-foreground/95 group-hover:text-foreground whitespace-nowrap shrink-0">
                                        {it.code}
                                      </p>
                                      {it.description && (
                                        <p className="text-[10.5px] text-muted-foreground leading-snug truncate">
                                          {it.description}
                                        </p>
                                      )}
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </Collapsible>
                        </div>
                      )
                    })}
                  </div>
                </Collapsible>
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
  progressPct,
}: {
  title: string
  subtitle?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  progressPct?: number
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute inset-y-0 right-0 w-full sm:max-w-[860px] bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border">
          <div className="flex items-start gap-3 p-4 pr-3">
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
          {progressPct !== undefined && (
            <div className="h-1 w-full bg-surface-secondary">
              <div
                className="h-full bg-brand-500 transition-all duration-200"
                style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
              />
            </div>
          )}
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

const LEVEL_ACCENT: Record<PermissionLevel, { chipBg: string; chipBorder: string; chipText: string; headerBg: string; labelText: string }> = {
  ORGANIZACION: {
    chipBg: 'bg-brand-500/10 dark:bg-brand-500/10',
    chipBorder: 'border-brand-500/30',
    chipText: 'text-brand-700 dark:text-brand-200',
    headerBg: 'bg-brand-500/5 dark:bg-brand-500/5',
    labelText: 'text-brand-700 dark:text-brand-200',
  },
  PROYECTO: {
    chipBg: 'bg-brand-500/10 dark:bg-brand-500/10',
    chipBorder: 'border-brand-500/30',
    chipText: 'text-brand-700 dark:text-brand-200',
    headerBg: 'bg-brand-500/5 dark:bg-brand-500/5',
    labelText: 'text-brand-700 dark:text-brand-200',
  },
  RECURSO: {
    chipBg: 'bg-brand-500/10 dark:bg-brand-500/10',
    chipBorder: 'border-brand-500/30',
    chipText: 'text-brand-700 dark:text-brand-200',
    headerBg: 'bg-brand-500/5 dark:bg-brand-500/5',
    labelText: 'text-brand-700 dark:text-brand-200',
  },
  SISTEMA: {
    chipBg: 'bg-brand-500/10 dark:bg-brand-500/10',
    chipBorder: 'border-brand-500/30',
    chipText: 'text-brand-700 dark:text-brand-200',
    headerBg: 'bg-brand-500/5 dark:bg-brand-500/5',
    labelText: 'text-brand-700 dark:text-brand-200',
  },
}

function Collapsible({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'grid transition-all duration-200 ease-in-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none',
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function LevelSectionHeaderInline({ level, count }: { level: PermissionLevel; count: number }) {
  const accent = LEVEL_ACCENT[level]
  return (
    <div className="flex-1 flex items-center gap-2">
      <span className={clsx('text-[12px] font-semibold uppercase tracking-wide', accent.labelText)}>
        {PERMISSION_LEVEL_LABEL[level]}
      </span>
      <span className={clsx(
        'text-[10px] rounded-full px-2 py-0.5 border',
        accent.chipBg,
        accent.chipBorder,
        accent.chipText,
      )}>
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
  title,
}: {
  checked: boolean
  partial?: boolean
  disabled?: boolean
  onChange: (nextChecked: boolean) => void
  title?: string
}) {
  return (
    <label
      className={clsx(
        'inline-flex items-center justify-center w-7 h-7 rounded-md transition',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-surface-secondary'
      )}
      title={title}
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
