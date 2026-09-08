import api from './api'
import type { ApiResponse, PaginatedData } from './projects.service'

export type ApiTopicStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED' | 'IN_PROGRESS'
export type ApiTopicItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'

export interface ApiTopic {
  id: string
  projectId: string
  title: string
  description?: string | null
  order: number
  percentage: number
  createdBy?: string | null
  status: ApiTopicStatus
  createdAt: string
  updatedAt?: string | null
}

export interface CreateTopicPayload {
  title: string
  description?: string | null
  order?: number
  status?: ApiTopicStatus
}

export interface UpdateTopicPayload {
  title?: string
  description?: string | null
  order?: number
  status?: ApiTopicStatus
}

export interface ApiTopicItemMember {
  assignmentId: string
  projectMemberId: string
  userId: string
  userName?: string | null
  roleName?: string | null
  assignedAt: string
}

export interface ApiTopicItem {
  id: string
  topicId: string
  title: string
  description?: string | null
  status: ApiTopicItemStatus
  order: number
  assignedMemberIds: string[]
  assignedMembers?: ApiTopicItemMember[]
  createdAt: string
  updatedAt?: string | null
}

export interface CreateTopicItemPayload {
  title: string
  description?: string | null
  order?: number
  status?: ApiTopicItemStatus
  assignedMemberIds?: string[]
}

export interface UpdateTopicItemPayload {
  title?: string
  description?: string | null
  order?: number
  status?: ApiTopicItemStatus
  assignedMemberIds?: string[]
}

export interface ApiAvailableTopicItemMember {
  projectMemberId: string
  userId: string
  userName?: string | null
  roleName?: string | null
  alreadyAssigned: boolean
  assignmentId?: string | null
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

export async function fetchTopicItems(params: {
  projectId: string
  topicId: string
  page?: number
  pageSize?: number
  search?: string
  status?: ApiTopicItemStatus
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  const res = await api.get<ApiResponse<PaginatedData<ApiTopicItem>>>(
    `/projects/${params.projectId}/temas/${params.topicId}/items${qs ? `?${qs}` : ''}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los conceptos')
  }
  return res.data.data
}

export async function createTopicItem(
  projectId: string,
  topicId: string,
  payload: CreateTopicItemPayload
) {
  const res = await api.post<ApiResponse<ApiTopicItem>>(
    `/projects/${projectId}/temas/${topicId}/items`,
    payload
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo crear el concepto')
  }
  return res.data.data
}

export async function updateTopicItem(
  projectId: string,
  topicId: string,
  itemId: string,
  payload: UpdateTopicItemPayload
) {
  const res = await api.patch<ApiResponse<ApiTopicItem>>(
    `/projects/${projectId}/temas/${topicId}/items/${itemId}`,
    payload
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar el concepto')
  }
  return res.data.data
}

export async function deleteTopicItem(
  projectId: string,
  topicId: string,
  itemId: string
) {
  const res = await api.delete(`/projects/${projectId}/temas/${topicId}/items/${itemId}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar el concepto')
  }
}

export async function fetchTopicItemMembers(
  projectId: string,
  topicId: string,
  itemId: string
) {
  const res = await api.get<ApiResponse<ApiTopicItemMember[]>>(
    `/projects/${projectId}/temas/${topicId}/items/${itemId}/miembros`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los miembros asignados')
  }
  return res.data.data
}

export async function fetchAvailableMembersForItem(
  projectId: string,
  topicId: string,
  itemId: string
) {
  const res = await api.get<ApiResponse<ApiAvailableTopicItemMember[]>>(
    `/projects/${projectId}/temas/${topicId}/items/${itemId}/miembros/disponibles`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los miembros disponibles')
  }
  return res.data.data
}

export async function assignMemberToTopicItem(
  projectId: string,
  topicId: string,
  itemId: string,
  payload: { projectMemberId: string }
) {
  const res = await api.post<ApiResponse<ApiTopicItemMember>>(
    `/projects/${projectId}/temas/${topicId}/items/${itemId}/miembros`,
    payload
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo asignar el miembro')
  }
  return res.data.data
}

export async function unassignMemberFromTopicItem(
  projectId: string,
  topicId: string,
  itemId: string,
  assignmentId: string
) {
  const res = await api.delete(
    `/projects/${projectId}/temas/${topicId}/items/${itemId}/miembros/${assignmentId}`
  )
  if (res.status !== 204) {
    throw new Error('No se pudo desasignar el miembro')
  }
}
