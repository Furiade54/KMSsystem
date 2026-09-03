import api from '../services/api'
import type {
  ApiResponse,
  PaginatedResult,
  User,
  Role,
  CreateUserDto,
  UpdateUserDto,
  RoleAssignment,
  EntityStatus,
} from '../../../packages/shared-types/src'

export type ApiUser = User & { projectsCount: number; rolesCount?: number }
export type ApiUserDetail = User & { projectsCount: number }

export const userStatusMap: Record<EntityStatus | string, { label: string; dotClass: string; textClass: string; bgClass: string }> = {
  ACTIVE: { label: 'Activo', dotClass: 'bg-status-approved', textClass: 'text-emerald-700 dark:text-emerald-200', bgClass: 'bg-status-approved/25 dark:bg-status-approved/15' },
  INACTIVE: { label: 'Inactivo', dotClass: 'bg-gray-500', textClass: 'text-gray-700 dark:text-gray-300', bgClass: 'bg-gray-500/25 dark:bg-gray-500/15' },
  BLOCKED: { label: 'Bloqueado', dotClass: 'bg-status-blocked', textClass: 'text-rose-700 dark:text-rose-200', bgClass: 'bg-status-blocked/25 dark:bg-status-blocked/15' },
  PENDING: { label: 'Pendiente', dotClass: 'bg-status-review', textClass: 'text-amber-700 dark:text-amber-200', bgClass: 'bg-status-review/25 dark:bg-status-review/15' },
  DELETED: { label: 'Eliminado', dotClass: 'bg-destructive', textClass: 'text-destructive dark:text-rose-200', bgClass: 'bg-destructive/25 dark:bg-destructive/15' },
}

export function userStatusInfo(status?: EntityStatus | string) {
  const key = (status || 'ACTIVE').toUpperCase() as EntityStatus
  return userStatusMap[key] || userStatusMap.ACTIVE
}

export interface ListUsersParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  includeDeleted?: boolean
}

export function extractUserError(err: any, fallback: string): string {
  const data = err?.response?.data
  const detail = data?.error ? ` · ${String(data.error)}` : ''
  return (data?.message || err?.message || fallback) + detail
}

function buildError(payload: any, fallback: string): string {
  const detail = payload?.error ? ` · ${String(payload.error)}` : ''
  return (payload?.message || fallback) + detail
}

export async function listUsers(params: ListUsersParams): Promise<PaginatedResult<ApiUser>> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.search) q.set('search', params.search)
  if (params.status) q.set('status', params.status)
  if (params.includeDeleted) q.set('includeDeleted', 'true')
  const res = await api.get<ApiResponse<PaginatedResult<ApiUser>>>(`/usuarios?${q.toString()}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudieron cargar los usuarios'))
  return res.data.data as PaginatedResult<ApiUser>
}

export async function getUserById(userId: string): Promise<ApiUserDetail> {
  const res = await api.get<ApiResponse<ApiUserDetail>>(`/usuarios/${userId}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'Usuario no encontrado'))
  return res.data.data as ApiUserDetail
}

export async function createUser(payload: CreateUserDto): Promise<User> {
  const res = await api.post<ApiResponse<User>>('/usuarios', payload)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo crear el usuario'))
  return res.data.data as User
}

export async function updateUser(userId: string, payload: UpdateUserDto): Promise<User> {
  const res = await api.patch<ApiResponse<User>>(`/usuarios/${userId}`, payload)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo actualizar el usuario'))
  return res.data.data as User
}

export async function softDeleteUser(userId: string): Promise<void> {
  const res = await api.delete(`/usuarios/${userId}`)
  if (res.status !== 204) throw new Error(buildError((res.data as any) || null, 'No se pudo eliminar el usuario'))
}

export async function permanentlyDeleteUser(userId: string): Promise<void> {
  const res = await api.delete(`/usuarios/${userId}/permanent`)
  if (res.status !== 204) throw new Error(buildError((res.data as any) || null, 'No se pudo eliminar el usuario permanentemente'))
}

export async function listRoles(options?: { includeSystem?: boolean }): Promise<Role[]> {
  const q = new URLSearchParams()
  if (options?.includeSystem === false) q.set('includeSystem', 'false')
  const res = await api.get<ApiResponse<Role[]>>(`/usuarios/roles?${q.toString()}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudieron cargar los roles'))
  return res.data.data as Role[]
}

export async function assignRolesToUser(userId: string, roleIds: string[]): Promise<RoleAssignment[]> {
  const res = await api.patch<ApiResponse<RoleAssignment[]>>(`/usuarios/${userId}/roles`, { roleIds })
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudieron actualizar los roles'))
  return res.data.data as RoleAssignment[]
}
