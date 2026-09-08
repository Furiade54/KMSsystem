import api from './api'
import type { ApiResponse, PaginatedData } from './projects.service'

export type ApiTopicStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED' | 'IN_PROGRESS'

export interface ApiTopic {
  id: string
  projectId: string
  title: string
  createdBy?: string | null
  status: ApiTopicStatus
  createdAt: string
  updatedAt?: string | null
}

export interface CreateTopicPayload {
  title: string
  status?: ApiTopicStatus
}

export interface UpdateTopicPayload {
  title?: string
  status?: ApiTopicStatus
}

export async function fetchTopics(params: {
  projectId: string
  page?: number
  pageSize?: number
  search?: string
  status?: ApiTopicStatus
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  const res = await api.get<ApiResponse<PaginatedData<ApiTopic>>>(
    `/projects/${params.projectId}/temas${qs ? `?${qs}` : ''}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los temas')
  }
  return res.data.data
}

export async function fetchTopicById(projectId: string, topicId: string) {
  const res = await api.get<ApiResponse<ApiTopic>>(`/projects/${projectId}/temas/${topicId}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar el tema')
  }
  return res.data.data
}

export async function createTopic(projectId: string, payload: CreateTopicPayload) {
  const res = await api.post<ApiResponse<ApiTopic>>(`/projects/${projectId}/temas`, payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo crear el tema')
  }
  return res.data.data
}

export async function updateTopic(projectId: string, topicId: string, payload: UpdateTopicPayload) {
  const res = await api.patch<ApiResponse<ApiTopic>>(`/projects/${projectId}/temas/${topicId}`, payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar el tema')
  }
  return res.data.data
}

export async function deleteTopic(projectId: string, topicId: string) {
  const res = await api.delete(`/projects/${projectId}/temas/${topicId}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar el tema')
  }
}
