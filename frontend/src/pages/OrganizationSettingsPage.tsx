import { useState } from 'react'
import {
  Building2,
  Loader2,
  X,
  Check,
  Hash,
  Link as LinkIcon,
  Calendar,
  RefreshCw,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ApiOrganization,
  getMyOrganization,
  updateMyOrganization,
  orgStatusInfo,
  extractOrgError,
} from '../services/organizations.service'
import type { UpdateOrganizationDto } from '../../../packages/shared-types/src'
import { useAuthStore } from '../store/authStore'
import { formatRelativeTime } from '../services/projects.service'

function OrganizationSettingsPage() {
  const queryClient = useQueryClient()
  const orgQuery = useQuery({
    queryKey: ['organization', 'me'],
    queryFn: () => getMyOrganization(),
    staleTime: 60_000,
    retry: 2,
  })
  const org = orgQuery.data as ApiOrganization | undefined
  const st = org ? orgStatusInfo(org.status) : null

  const currentUser = useAuthStore((s) => s.user)
  const hasEdit = !!currentUser?.isOrgAdmin
  const readOnly = !hasEdit

  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')

  function hydrateIfNeeded(o: ApiOrganization) {
    if (!dirty && name === '') {
      setName(o.name ?? '')
      setTaxId(o.taxId ?? '')
      setLogoUrl(o.logoUrl ?? '')
    }
  }
  if (org) hydrateIfNeeded(org)

  const updateMutation = useMutation({
    mutationFn: (patch: UpdateOrganizationDto) => updateMyOrganization(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'me'] })
      setDirty(false)
      setError('')
    },
    onError: (err: any) => {
      setError(extractOrgError(err, 'No se pudo actualizar la organización'))
    },
  })

  function markDirty<T>(setter: (v: T) => void, v: T) {
    setter(v)
    setDirty(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || name.trim().length < 2) {
      setError('El nombre es requerido (al menos 2 caracteres)')
      return
    }
    if (name.trim().length > 200) {
      setError('El nombre no puede exceder 200 caracteres')
      return
    }
    if (taxId.trim().length > 50) {
      setError('El NIT no puede exceder 50 caracteres')
      return
    }
    if (logoUrl.trim().length > 1000) {
      setError('La URL del logo no puede exceder 1000 caracteres')
      return
    }
    const patch: UpdateOrganizationDto = {
      name: name.trim(),
      taxId: taxId.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
    }
    updateMutation.mutate(patch)
  }

  function reset() {
    if (!org) return
    setName(org.name ?? '')
    setTaxId(org.taxId ?? '')
    setLogoUrl(org.logoUrl ?? '')
    setDirty(false)
    setError('')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground inline-flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-500" />
            Mi organización
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Información y configuración general de tu organización.
          </p>
        </div>
        {st && (
          <span
            className={clsx(
              'text-xs px-3 py-1 rounded-full inline-flex items-center gap-1.5 border',
              st.bgClass,
              st.textClass
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', st.dotClass)} />
            {st.label}
          </span>
        )}
      </div>

      {orgQuery.isLoading && !org ? (
        <div className="card p-10 text-center space-y-3">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando datos de la organización…</p>
        </div>
      ) : orgQuery.isError ? (
        <div className="card p-8 text-center space-y-3 border-destructive/40">
          <X className="w-6 h-6 mx-auto text-destructive" />
          <h3 className="font-semibold text-foreground">Error al cargar</h3>
          <p className="text-sm text-muted-foreground">
            {extractOrgError(orgQuery.error, 'No se pudieron cargar los datos')}
          </p>
          <button
            className="btn-secondary text-sm inline-flex items-center gap-2"
            onClick={() => orgQuery.refetch()}
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      ) : org ? (
        <form onSubmit={submit} className="card p-6 space-y-6">
          <div className="flex items-start gap-5">
            <div className="shrink-0 w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-2xl ring-1 ring-white/10 overflow-hidden">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                (org.name ?? '?').slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-semibold text-foreground">{org.name}</h2>
              {org.taxId && (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Hash className="w-3 h-3" /> NIT: {org.taxId}
                </p>
              )}
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" /> Creada{' '}
                <span>{formatRelativeTime(org.createdAt)}</span>
                {org.updatedAt && (
                  <>
                    <span className="mx-1">·</span>
                    <RefreshCw className="w-3 h-3" />
                    Actualizada {formatRelativeTime(org.updatedAt)}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Nombre de la organización</label>
              <input
                className="input-base mt-1 text-sm"
                value={name}
                onChange={(e) => markDirty(setName, e.target.value)}
                disabled={readOnly || updateMutation.isPending}
                placeholder="Ej: Instituto Superior Tecnológico"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">NIT / Identificación tributaria</label>
              <input
                className="input-base mt-1 text-sm"
                value={taxId}
                onChange={(e) => markDirty(setTaxId, e.target.value)}
                disabled={readOnly || updateMutation.isPending}
                placeholder="Ej: 900.123.456-7"
                maxLength={50}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                <LinkIcon className="w-3 h-3" /> URL del logo
              </label>
              <input
                className="input-base mt-1 text-sm"
                value={logoUrl}
                onChange={(e) => markDirty(setLogoUrl, e.target.value)}
                disabled={readOnly || updateMutation.isPending}
                placeholder="https://…/logo.png"
                maxLength={1000}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border text-xs">
            <div className="card p-3 space-y-1 bg-surface-secondary/30">
              <p className="text-muted-foreground">Usuarios</p>
              <p className="text-2xl font-bold text-foreground">{org.usersCount ?? 0}</p>
            </div>
            <div className="card p-3 space-y-1 bg-surface-secondary/30">
              <p className="text-muted-foreground">Proyectos</p>
              <p className="text-2xl font-bold text-foreground">{org.projectsCount ?? 0}</p>
            </div>
            <div className="card p-3 space-y-1 bg-surface-secondary/30">
              <p className="text-muted-foreground">Estado</p>
              <p className="text-lg font-bold text-foreground inline-flex items-center gap-1.5">
                {st && <span className={clsx('w-2 h-2 rounded-full', st.dotClass)} />}
                {st?.label}
              </p>
            </div>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 border border-destructive/20">
              {error}
            </div>
          )}
          {updateMutation.isSuccess && !dirty && (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 rounded-md px-3 py-2 border border-emerald-500/20 inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Cambios guardados correctamente.
            </div>
          )}

          {readOnly && (
            <div className="text-xs text-muted-foreground bg-surface-secondary rounded-md px-3 py-2 border border-border">
              No tienes permisos para editar la información de la organización (se requiere{' '}
              <code className="font-mono text-[10px] px-1 bg-surface rounded">org.editar</code>).
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            {dirty && !readOnly && (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={reset}
                disabled={updateMutation.isPending}
              >
                Deshacer cambios
              </button>
            )}
            <button
              type="submit"
              className="btn-primary text-sm inline-flex items-center gap-2"
              disabled={!dirty || readOnly || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {updateMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

export default OrganizationSettingsPage
