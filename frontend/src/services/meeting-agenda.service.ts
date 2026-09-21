import api from './api'
import type { ApiResponse, MeetingAgendaItem, PaginatedResult } from '../../../packages/shared-types/src'

const API_PREFIX = '/projects'

export interface MeetingAgendaListParams {
  parentId?: string | '__ROOT__' | null
  flatten?: boolean
  page?: number
  pageSize?: number
}

export interface CreateAgendaItemBody {
  parentId?: string | null
  order?: number
  title: string
  description?: string | null
  estimatedMinutes?: number | null
  state?: MeetingAgendaItem['state']
  responsibleUserId?: string | null
}

export type UpdateAgendaItemBody = Partial<
  Omit<CreateAgendaItemBody, 'title'> & { title?: string }
>

export interface DeleteAgendaBody {
  orphanStrategy?: 'PROMOTE_CHILDREN' | 'DELETE_CHILDREN'
}

export interface ReorderAgendaBody {
  parentId?: string | null
  ordering: Array<{ itemId: string; order: number }>
}

export interface MoveAgendaBody {
  parentId: string | null
  order?: number
}

export async function listMeetingAgenda(
  projectId: string,
  meetingId: string,
  params: MeetingAgendaListParams = {}
) {
  const qs = new URLSearchParams()
  if (params.parentId !== undefined) qs.set('parentId', params.parentId ?? '__ROOT__')
  if (typeof params.page === 'number') qs.set('page', String(params.page))
  if (typeof params.pageSize === 'number') qs.set('pageSize', String(params.pageSize))
  if (typeof params.flatten === 'boolean') qs.set('flatten', String(params.flatten))
  const url = `${API_PREFIX}/${projectId}/reuniones/${meetingId}/orden-dia${qs.toString() ? `?${qs.toString()}` : ''}`
  const { data } = await api.get<ApiResponse<PaginatedResult<MeetingAgendaItem>>>(url)
  if (!data.success) throw new Error(data.message || 'No se pudo cargar el orden del día')
  return data.data
}

export async function getMeetingAgendaItem(
  projectId: string,
  meetingId: string,
  itemId: string
) {
  const { data } = await api.get<ApiResponse<MeetingAgendaItem>>(
    `${API_PREFIX}/${projectId}/reuniones/${meetingId}/orden-dia/${itemId}`
  )
  if (!data.success) throw new Error(data.message || 'No se pudo cargar el ítem del orden del día')
  return data.data
}

export async function createMeetingAgendaItem(
  projectId: string,
  meetingId: string,
  body: CreateAgendaItemBody
) {
  const { data } = await api.post<ApiResponse<MeetingAgendaItem>>(
    `${API_PREFIX}/${projectId}/reuniones/${meetingId}/orden-dia`,
    body
  )
  if (!data.success) throw new Error(data.message || 'No se pudo crear el ítem del orden del día')
  return data.data
}

export async function updateMeetingAgendaItem(
  projectId: string,
  meetingId: string,
  itemId: string,
  body: UpdateAgendaItemBody
) {
  const { data } = await api.patch<ApiResponse<MeetingAgendaItem>>(
    `${API_PREFIX}/${projectId}/reuniones/${meetingId}/orden-dia/${itemId}`,
    body
  )
  if (!data.success) throw new Error(data.message || 'No se pudo actualizar el ítem del orden del día')
  return data.data
}

export async function deleteMeetingAgendaItem(
  projectId: string,
  meetingId: string,
  itemId: string,
  body: DeleteAgendaBody = {}
) {
  const { data } = await api.delete<ApiResponse<void>>(
    `${API_PREFIX}/${projectId}/reuniones/${meetingId}/orden-dia/${itemId}`,
    { data: Object.keys(body).length ? body : undefined }
  )
  if (!data.success) throw new Error(data.message || 'No se pudo eliminar el ítem del orden del día')
}

export async function reorderMeetingAgenda(
  projectId: string,
  meetingId: string,
  body: ReorderAgendaBody
) {
  const { data } = await api.patch<ApiResponse<void>>(
    `${API_PREFIX}/${projectId}/reuniones/${meetingId}/orden-dia/reorder`,
    body
  )
  if (!data.success) throw new Error(data.message || 'No se pudo reordenar el orden del día')
}

export async function moveMeetingAgendaItem(
  projectId: string,
  meetingId: string,
  itemId: string,
  body: MoveAgendaBody
) {
  const { data } = await api.patch<ApiResponse<MeetingAgendaItem>>(
    `${API_PREFIX}/${projectId}/reuniones/${meetingId}/orden-dia/${itemId}/move`,
    body
  )
  if (!data.success) throw new Error(data.message || 'No se pudo mover el ítem del orden del día')
  return data.data
}
