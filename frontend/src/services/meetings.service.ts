import api from './api'
import type { ApiResponse, PaginatedData } from './projects.service'

export type ApiMeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'HELD'

export interface ApiMeeting {
  id: string
  projectId: string
  title: string
  description?: string | null
  meetingAt?: string | null
  createdBy?: string | null
  minutesFileId?: string | null
  status: ApiMeetingStatus
  createdAt: string
  updatedAt?: string | null
  linkedTopicsIds?: string[]
}

export interface ApiMeetingLinkedTopic {
  topicId: string
  title: string
  linkedAt: string
  linkedByUserId?: string | null
  linkedByUserName?: string | null
}

export interface CreateMeetingPayload {
  title: string
  description?: string | null
  meetingAt?: string | null
  status?: ApiMeetingStatus
}

export interface UpdateMeetingPayload {
  title?: string
  description?: string | null
  meetingAt?: string | null
  status?: ApiMeetingStatus
}

export async function fetchMeetings(params: {
  projectId: string
  page?: number
  pageSize?: number
  search?: string
  status?: ApiMeetingStatus
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  const res = await api.get<ApiResponse<PaginatedData<ApiMeeting>>>(
    `/projects/${params.projectId}/reuniones${qs ? `?${qs}` : ''}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar las reuniones')
  }
  return res.data.data
}

export async function fetchMeetingById(projectId: string, meetingId: string) {
  const res = await api.get<ApiResponse<ApiMeeting>>(`/projects/${projectId}/reuniones/${meetingId}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar la reunión')
  }
  return res.data.data
}

export async function createMeeting(projectId: string, payload: CreateMeetingPayload) {
  const res = await api.post<ApiResponse<ApiMeeting>>(`/projects/${projectId}/reuniones`, payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo crear la reunión')
  }
  return res.data.data
}

export async function updateMeeting(projectId: string, meetingId: string, payload: UpdateMeetingPayload) {
  const res = await api.patch<ApiResponse<ApiMeeting>>(`/projects/${projectId}/reuniones/${meetingId}`, payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar la reunión')
  }
  return res.data.data
}

export async function deleteMeeting(projectId: string, meetingId: string) {
  const res = await api.delete(`/projects/${projectId}/reuniones/${meetingId}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar la reunión')
  }
}

// --- Vinculación Reunión <-> Temas ---

export async function fetchMeetingLinkedTopics(projectId: string, meetingId: string): Promise<ApiMeetingLinkedTopic[]> {
  const res = await api.get<ApiResponse<ApiMeetingLinkedTopic[]>>(
    `/projects/${projectId}/reuniones/${meetingId}/temas`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los temas vinculados')
  }
  return res.data.data
}

export async function linkTopicToMeeting(projectId: string, meetingId: string, topicId: string): Promise<ApiMeeting> {
  const res = await api.post<ApiResponse<ApiMeeting>>(
    `/projects/${projectId}/reuniones/${meetingId}/temas/${topicId}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo vincular el tema a la reunión')
  }
  return res.data.data
}

export async function unlinkTopicFromMeeting(projectId: string, meetingId: string, topicId: string): Promise<ApiMeeting> {
  const res = await api.delete<ApiResponse<ApiMeeting>>(
    `/projects/${projectId}/reuniones/${meetingId}/temas/${topicId}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo desvincular el tema de la reunión')
  }
  return res.data.data
}
