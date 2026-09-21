import api from './api'
import type { ApiResponse, PermissionCode } from '../../../packages/shared-types/src'

export async function listUserPermissions(): Promise<PermissionCode[]> {
  const res = await api.get<ApiResponse<PermissionCode[]>>('/auth/permissions')
  if (!res.data?.success) throw new Error(res.data?.message || 'No se pudieron cargar los permisos')
  return res.data.data ?? []
}

export function hasPermission(
  codes: PermissionCode | PermissionCode[] | null | undefined,
  userCodes: Set<PermissionCode> | PermissionCode[] | null | undefined,
  opts: { mode?: 'any' | 'all' } = {}
): boolean {
  if (!codes) return true
  const needed = Array.isArray(codes) ? codes : [codes]
  if (!needed.length) return true
  if (!userCodes) return false
  const set = Array.isArray(userCodes) ? new Set(userCodes) : userCodes
  const mode = opts.mode ?? 'any'
  let hits = 0
  for (const c of needed) if (set.has(c)) hits++
  return mode === 'any' ? hits > 0 : hits === needed.length
}
