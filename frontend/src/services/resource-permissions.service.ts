import api from './api'
import type {
  ApiResponse,
  CreateResourcePermissionDto,
  ListResourcePermissionsParams,
  PaginatedResult,
  ResourcePermissionGrant,
  UpdateResourcePermissionDto,
} from '../../../packages/shared-types/src'

export type ApiResourceScope = 'projects' | 'carpetas' | 'archivos'

export interface ResourceCapabilityLabel {
  key: keyof Pick<
    ResourcePermissionGrant,
    | 'puedeVer'
    | 'puedeDescargar'
    | 'puedeComentar'
    | 'puedeEditar'
    | 'puedeCompartir'
    | 'puedeAdministrar'
  >
  label: string
  short: string
}

export const RESOURCE_CAPABILITIES: ResourceCapabilityLabel[] = [
  { key: 'puedeVer', label: 'Ver el recurso', short: 'Ver' },
  { key: 'puedeDescargar', label: 'Descargar archivos', short: 'Descargar' },
  { key: 'puedeComentar', label: 'Crear y ver comentarios', short: 'Comentar' },
  { key: 'puedeEditar', label: 'Editar nombre / metadata', short: 'Editar' },
  { key: 'puedeCompartir', label: 'Compartir / añadir miembros', short: 'Compartir' },
  { key: 'puedeAdministrar', label: 'Administrar total (implica todo)', short: 'Admin' },
]

function buildError(payload: any, fallback: string): string {
  const detail = payload?.error ? ` · ${String(payload.error)}` : ''
  return (payload?.message || fallback) + detail
}

export function extractResourcePermissionError(err: any, fallback = 'No se pudo completar la operación de permisos'): string {
  const data = err?.response?.data
  return buildError(data || err, fallback)
}

export async function listResourcePermissions(
  resourceScope: ApiResourceScope,
  resourceId: string,
  params: ListResourcePermissionsParams = {}
): Promise<PaginatedResult<ResourcePermissionGrant>> {
  const query = new URLSearchParams()
  if (params.page != null) query.set('page', String(params.page))
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  if (params.scope) query.set('scope', params.scope)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const res = await api.get<ApiResponse<PaginatedResult<ResourcePermissionGrant>>>(
    `/${resourceScope}/${encodeURIComponent(resourceId)}/permisos${suffix}`
  )
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo listar los permisos del recurso'))
  return res.data.data as PaginatedResult<ResourcePermissionGrant>
}

export async function grantPermission(
  resourceScope: ApiResourceScope,
  resourceId: string,
  payload: CreateResourcePermissionDto
): Promise<ResourcePermissionGrant> {
  const res = await api.post<ApiResponse<ResourcePermissionGrant>>(
    `/${resourceScope}/${encodeURIComponent(resourceId)}/permisos`,
    payload
  )
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo conceder el permiso'))
  return res.data.data as ResourcePermissionGrant
}

export async function getPermission(id: string): Promise<ResourcePermissionGrant> {
  const res = await api.get<ApiResponse<ResourcePermissionGrant>>(`/permisos-recurso/${encodeURIComponent(id)}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo obtener el permiso'))
  return res.data.data as ResourcePermissionGrant
}

export async function updatePermission(
  id: string,
  patch: UpdateResourcePermissionDto
): Promise<ResourcePermissionGrant> {
  const res = await api.patch<ApiResponse<ResourcePermissionGrant>>(
    `/permisos-recurso/${encodeURIComponent(id)}`,
    patch
  )
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo actualizar el permiso'))
  return res.data.data as ResourcePermissionGrant
}

export async function revokePermission(id: string): Promise<void> {
  const res = await api.delete(`/permisos-recurso/${encodeURIComponent(id)}`)
  if (res.status !== 204) {
    const d: any = (res as any).data
    if (d && !d.success) throw new Error(buildError(d, 'No se pudo revocar el permiso'))
  }
}

export async function canAccessCheck(params: {
  resourceType: 'PROJECT' | 'FOLDER' | 'FILE'
  resourceId: string
  capability: 'VER' | 'DESCARGAR' | 'COMENTAR' | 'EDITAR' | 'COMPARTIR' | 'ADMINISTRAR'
}): Promise<{ granted: boolean }> {
  const q = new URLSearchParams()
  q.set('resourceType', params.resourceType)
  q.set('resourceId', params.resourceId)
  q.set('capability', params.capability)
  const res = await api.get<ApiResponse<{ granted: boolean }>>(`/permisos-recurso/check?${q.toString()}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo comprobar el acceso'))
  return res.data.data as { granted: boolean }
}
