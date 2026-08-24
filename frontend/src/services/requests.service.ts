import api from './api'
import type { ApiResponse } from './projects.service'
import { formatRelativeTime } from './projects.service'

export type RequestStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
export type RequestResourceType = 'proyecto' | 'carpeta' | 'archivo'
export type RequestScope = 'received' | 'sent' | 'all'

export interface ApiAccessRequest {
  id: string
  resourceType: RequestResourceType
  resourceId: string
  resourceName: string | null
  requesterId: string
  requesterName: string | null
  requesterEmail: string | null
  ownerId: string | null
  ownerName: string | null
  ownerEmail: string | null
  message: string | null
  status: RequestStatus
  createdAt: string
  resolvedAt: string | null
}

export interface RequestListResponse {
  items: ApiAccessRequest[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  scope: RequestScope
  status: RequestStatus | null
}

export interface RequestCountResponse {
  pendingReceived: number
  pendingSent: number
  totalPending: number
}

export async function fetchRequestCount(): Promise<RequestCountResponse> {
  try {
    const res = await api.get<ApiResponse<RequestCountResponse>>('/solicitudes/count')
    return res.data.data
  } catch (err: any) {
    throw err
  }
}

export async function fetchRequests(params?: {
  scope?: RequestScope
  status?: RequestStatus | null
  page?: number
  pageSize?: number
}): Promise<RequestListResponse> {
  const p = params ?? {}
  const q: Record<string, unknown> = {}
  if (p.scope) q.scope = p.scope
  if (p.status) q.status = p.status
  if (p.page) q.page = p.page
  if (p.pageSize) q.pageSize = p.pageSize
  try {
    const res = await api.get<ApiResponse<RequestListResponse>>('/solicitudes', { params: q })
    return res.data.data
  } catch (err: any) {
    throw err
  }
}

export async function createRequest(data: {
  resourceType: RequestResourceType
  resourceId: string
  message?: string
}): Promise<ApiAccessRequest> {
  const res = await api.post<ApiResponse<ApiAccessRequest>>('/solicitudes', {
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    message: data.message?.trim() || null,
  })
  return res.data.data
}

export async function approveRequest(id: string, opts?: { permissionScope?: 'view' | 'full' }): Promise<ApiAccessRequest> {
  const res = await api.patch<ApiResponse<ApiAccessRequest>>(`/solicitudes/${encodeURIComponent(id)}/aprobar`, {
    permissionScope: opts?.permissionScope ?? 'view',
  })
  return res.data.data
}

export async function rejectRequest(id: string): Promise<ApiAccessRequest> {
  const res = await api.patch<ApiResponse<ApiAccessRequest>>(`/solicitudes/${encodeURIComponent(id)}/rechazar`)
  return res.data.data
}

export function resourceTypeLabel(t: RequestResourceType): string {
  switch (t) {
    case 'proyecto': return 'Proyecto'
    case 'carpeta':  return 'Carpeta'
    case 'archivo':  return 'Archivo'
  }
}

export function requestStatusMeta(s: RequestStatus): { label: string; dot: string; pill: string } {
  switch (s) {
    case 'PENDIENTE':
      return { label: 'Pendiente', dot: 'bg-status-draft', pill: 'bg-status-draft/15 text-status-draft ring-1 ring-status-draft/30' }
    case 'APROBADO':
      return { label: 'Aprobada', dot: 'bg-status-approved', pill: 'bg-status-approved/15 text-status-approved ring-1 ring-status-approved/30' }
    case 'RECHAZADO':
      return { label: 'Rechazada', dot: 'bg-status-blocked', pill: 'bg-status-blocked/15 text-status-blocked ring-1 ring-status-blocked/30' }
  }
}

export function requestRelativeTime(r: ApiAccessRequest): string {
  return formatRelativeTime(r.createdAt)
}
