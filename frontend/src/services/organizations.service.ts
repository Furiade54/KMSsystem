import api from './api'
import type {
  ApiResponse,
  CreateOrganizationDto,
  EntityStatus,
  Organization,
  PaginatedResult,
  UpdateOrganizationDto,
} from '../../../packages/shared-types/src'

export type ApiOrganization = Organization & { usersCount?: number; projectsCount?: number }

export const orgStatusMap: Record<EntityStatus | string, { label: string; dotClass: string; textClass: string; bgClass: string }> = {
  ACTIVE: { label: 'Activo', dotClass: 'bg-status-approved', textClass: 'text-emerald-700 dark:text-emerald-200', bgClass: 'bg-status-approved/25 dark:bg-status-approved/15' },
  INACTIVE: { label: 'Inactivo', dotClass: 'bg-gray-500', textClass: 'text-gray-700 dark:text-gray-300', bgClass: 'bg-gray-500/25 dark:bg-gray-500/15' },
  BLOCKED: { label: 'Bloqueado', dotClass: 'bg-status-blocked', textClass: 'text-rose-700 dark:text-rose-200', bgClass: 'bg-status-blocked/25 dark:bg-status-blocked/15' },
  PENDING: { label: 'Pendiente', dotClass: 'bg-status-review', textClass: 'text-amber-700 dark:text-amber-200', bgClass: 'bg-status-review/25 dark:bg-status-review/15' },
  DELETED: { label: 'Eliminado', dotClass: 'bg-destructive', textClass: 'text-destructive dark:text-rose-200', bgClass: 'bg-destructive/25 dark:bg-destructive/15' },
  SUSPENDED: { label: 'Suspendido', dotClass: 'bg-amber-700', textClass: 'text-amber-700 dark:text-amber-200', bgClass: 'bg-amber-700/25' },
}

export function orgStatusInfo(status?: EntityStatus | string) {
  const key = (status || 'ACTIVE').toUpperCase() as EntityStatus
  return orgStatusMap[key] || orgStatusMap.ACTIVE
}

export interface ListOrganizationsParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  includeDeleted?: boolean
}

export type OrgDeleteBlock = {
  kind: 'info' | 'action'
  title: string
  items: string[]
}

export type OrgDeleteFailure = {
  title?: string
  summary?: string
  blocks?: OrgDeleteBlock[]
  rawHint?: string
}

export function extractOrgError(err: any, fallback: string): string {
  const data = err?.response?.data
  const detail = data?.error ? ` · ${String(data.error)}` : ''
  return (data?.message || err?.message || fallback) + detail
}

export function extractOrgFailure(err: any): OrgDeleteFailure | null {
  const details = err?.response?.data?.details
  if (!details) return null
  const blocks = Array.isArray(details.blocks) ? details.blocks as OrgDeleteBlock[] : []
  return {
    title: details.title ? String(details.title) : undefined,
    summary: details.summary ? String(details.summary) : undefined,
    blocks,
    rawHint: details.rawHint ? String(details.rawHint) : undefined,
  }
}

function buildError(payload: any, fallback: string): string {
  const detail = payload?.error ? ` · ${String(payload.error)}` : ''
  return (payload?.message || fallback) + detail
}

export async function getMyOrganization(): Promise<ApiOrganization> {
  const res = await api.get<ApiResponse<ApiOrganization>>('/organizacion')
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo cargar tu organización'))
  return res.data.data as ApiOrganization
}

export async function updateMyOrganization(payload: UpdateOrganizationDto): Promise<ApiOrganization> {
  const res = await api.patch<ApiResponse<ApiOrganization>>('/organizacion', payload)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo actualizar tu organización'))
  return res.data.data as ApiOrganization
}

export async function listOrganizations(params: ListOrganizationsParams): Promise<PaginatedResult<ApiOrganization>> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.search) q.set('search', params.search)
  if (params.status) q.set('status', params.status)
  if (params.includeDeleted) q.set('includeDeleted', 'true')
  const res = await api.get<ApiResponse<PaginatedResult<ApiOrganization>>>(`/organizacion/list?${q.toString()}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudieron cargar las organizaciones'))
  return res.data.data as PaginatedResult<ApiOrganization>
}

export async function getOrganization(orgId: string): Promise<ApiOrganization> {
  const res = await api.get<ApiResponse<ApiOrganization>>(`/organizacion/${orgId}`)
  if (!res.data?.success) throw new Error(buildError(res.data, 'Organización no encontrada'))
  return res.data.data as ApiOrganization
}

export async function createOrganization(payload: CreateOrganizationDto): Promise<ApiOrganization> {
  const res = await api.post<ApiResponse<ApiOrganization>>('/organizacion', payload)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo crear la organización'))
  return res.data.data as ApiOrganization
}

export async function updateOrganization(orgId: string, payload: UpdateOrganizationDto): Promise<ApiOrganization> {
  const res = await api.patch<ApiResponse<ApiOrganization>>(`/organizacion/${orgId}`, payload)
  if (!res.data?.success) throw new Error(buildError(res.data, 'No se pudo actualizar la organización'))
  return res.data.data as ApiOrganization
}

export async function deleteOrganization(orgId: string): Promise<void> {
  const res = await api.delete(`/organizacion/${orgId}`)
  if (res.status !== 204) throw new Error(buildError((res.data as any) || null, 'No se pudo eliminar la organización'))
}

export async function permanentlyDeleteOrganization(orgId: string): Promise<void> {
  const res = await api.delete(`/organizacion/${orgId}/permanent`)
  if (res.status !== 204) throw new Error(buildError((res.data as any) || null, 'No se pudo eliminar permanentemente la organización'))
}
