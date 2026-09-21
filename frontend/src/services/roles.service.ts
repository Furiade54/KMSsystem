import api from './api'
import type {
  ApiResponse,
  Role,
  RolePermission,
  CreateRoleDto,
  UpdateRoleDto,
  SetRolePermissionsDto,
  PermissionLevel,
} from '../../../packages/shared-types/src'

export type ApiRole = Role & {
  permissions?: RolePermission[]
  usersCount?: number
}

export interface ListRolesParams {
  includePermissions?: boolean
  includeUsersCount?: boolean
}

export type PermissionCatalogItem = {
  id: string
  code: string
  description?: string | null
  category?: string | null
  level?: PermissionLevel | null
}

function buildError(payload: any, fallback: string): string {
  const detail = payload?.error ? ` · ${String(payload.error)}` : ''
  return (payload?.message || fallback) + detail
}

export async function listRoles(params: ListRolesParams = {}): Promise<ApiRole[]> {
  const q = new URLSearchParams()
  if (params.includePermissions === false) q.set('includePermissions', 'false')
  if (params.includeUsersCount === true) q.set('includeUsersCount', 'true')
  const res = await api.get<ApiResponse<ApiRole[]>>(`/roles?${q.toString()}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudieron cargar los roles'))
  return res.data.data as ApiRole[]
}

export async function getRole(roleId: string): Promise<ApiRole> {
  const res = await api.get<ApiResponse<ApiRole>>(`/roles/${encodeURIComponent(roleId)}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'Rol no encontrado'))
  return res.data.data as ApiRole
}

export async function listPermissionCatalog(): Promise<PermissionCatalogItem[]> {
  const res = await api.get<ApiResponse<PermissionCatalogItem[]>>(`/roles/permisos/catalogo`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo cargar el catálogo de permisos'))
  return res.data.data as PermissionCatalogItem[]
}

export async function createRole(payload: CreateRoleDto): Promise<ApiRole> {
  const res = await api.post<ApiResponse<ApiRole>>(`/roles`, payload)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo crear el rol'))
  return res.data.data as ApiRole
}

export async function updateRole(roleId: string, payload: UpdateRoleDto): Promise<ApiRole> {
  const res = await api.patch<ApiResponse<ApiRole>>(`/roles/${encodeURIComponent(roleId)}`, payload)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo actualizar el rol'))
  return res.data.data as ApiRole
}

export async function setRolePermissions(roleId: string, payload: SetRolePermissionsDto): Promise<ApiRole> {
  const res = await api.patch<ApiResponse<ApiRole>>(
    `/roles/${encodeURIComponent(roleId)}/permisos`,
    payload
  )
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudieron actualizar los permisos'))
  return res.data.data as ApiRole
}

export async function deleteRole(roleId: string): Promise<void> {
  const res = await api.delete(`/roles/${encodeURIComponent(roleId)}`)
  if (res.status !== 204) throw new Error(buildError((res.data as any) || null, 'No se pudo eliminar el rol'))
}

export const PERMISSION_LEVEL_LABEL: Record<PermissionLevel, string> = {
  ORGANIZACION: 'Organización',
  PROYECTO: 'Proyectos',
  RECURSO: 'Recursos',
  SISTEMA: 'Sistema',
}

export const PERMISSION_LEVEL_ORDER: PermissionLevel[] = ['ORGANIZACION', 'PROYECTO', 'RECURSO', 'SISTEMA']
