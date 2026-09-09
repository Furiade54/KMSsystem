import api from './api'
import type { ApiResponse } from './projects.service'

export type ApiContributionType =
  | 'IDEA'
  | 'COMENTARIO'
  | 'ENLACE'
  | 'ARCHIVO'
  | 'IMAGEN'
  | 'ENCUESTA'
  | 'MENSAJE'
  | 'OTRO'

export type ApiContributionStatus =
  | 'BORRADOR'
  | 'PUBLICADO'
  | 'OCULTO'
  | 'ELIMINADO'
  | 'DESTACADO'

export type ApiContributionPriority =
  | 'BAJA'
  | 'NORMAL'
  | 'ALTA'
  | 'URGENTE'

export interface ApiContributionPermissions {
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
}

export interface ApiContributionLinkedTopic {
  id: string
  title: string
  linkedAt: string
  linkedBy: string | null
}

export interface ApiProjectContribution {
  id: string
  organizationId: string
  projectId: string
  authorId: string | null
  authorName: string | null
  authorEmail: string | null
  title: string | null
  content: string | null
  type: ApiContributionType
  externalUrl: string | null
  folderId: string | null
  attachedFileId: string | null
  attachedFileName: string | null
  attachedFileSizeBytes: number | null
  attachedFileMimeType: string | null
  status: ApiContributionStatus
  priority: ApiContributionPriority
  order: number
  likesCount: number
  commentsCount: number
  createdAt: string
  updatedAt: string | null
  publishedAt: string | null
  linkedTopics?: ApiContributionLinkedTopic[]
  _permissions: ApiContributionPermissions
}

export interface ApiContributionTopicLink {
  contributionId: string
  topicId: string
  topicTitle: string | null
  linkedByUserId: string | null
  linkedAt: string
}

export interface CreateContributionPayload {
  title?: string | null
  content?: string | null
  type?: ApiContributionType | null
  externalUrl?: string | null
  folderId?: string | null
  attachedFileId?: string | null
  status?: ApiContributionStatus | null
  priority?: ApiContributionPriority | null
  order?: number | null
  publishNow?: boolean | null
  topicIds?: string[] | null
}

export interface UpdateContributionPayload {
  title?: string | null
  content?: string | null
  type?: ApiContributionType | null
  externalUrl?: string | null
  folderId?: string | null
  attachedFileId?: string | null
  status?: ApiContributionStatus | null
  priority?: ApiContributionPriority | null
  order?: number | null
  publishNow?: boolean | null
}

export interface ContributionListMeta {
  total: number
  limit: number
  offset: number
  count: number
}

export interface ContributionListResult {
  items: ApiProjectContribution[]
  meta: ContributionListMeta
}

export interface ListContributionsParams {
  projectId: string
  tipo?: ApiContributionType | null
  estado?: ApiContributionStatus | null
  importancia?: ApiContributionPriority | null
  search?: string | null
  limit?: number
  offset?: number
}

export const aportesQueryKeys = {
  all: (projectId: string) => ['project-aportes', projectId] as const,
  list: (projectId: string, params?: Partial<ListContributionsParams>) =>
    ['project-aportes', projectId, 'list', params ?? {}] as const,
  detail: (projectId: string, contributionId: string) =>
    ['project-aportes', projectId, 'detail', contributionId] as const,
  linkedTopics: (projectId: string, contributionId: string) =>
    ['project-aportes', projectId, 'linked-topics', contributionId] as const,
}

export async function fetchContributions(
  params: ListContributionsParams
): Promise<ContributionListResult> {
  const query = new URLSearchParams()
  if (params.tipo) query.set('tipo', params.tipo)
  if (params.estado) query.set('estado', params.estado)
  if (params.importancia) query.set('importancia', params.importancia)
  if (params.search) query.set('search', params.search)
  if (params.limit != null) query.set('limit', String(params.limit))
  if (params.offset != null) query.set('offset', String(params.offset))
  const qs = query.toString()
  const res = await api.get<
    ApiResponse<ApiProjectContribution[]> & { meta?: ContributionListMeta }
  >(`/projects/${params.projectId}/aportes${qs ? `?${qs}` : ''}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los aportes')
  }
  return {
    items: res.data.data ?? [],
    meta: (res.data as any).meta ?? {
      total: (res.data.data ?? []).length,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      count: (res.data.data ?? []).length,
    },
  }
}

export async function fetchContributionById(
  projectId: string,
  contributionId: string
): Promise<ApiProjectContribution> {
  const res = await api.get<ApiResponse<ApiProjectContribution>>(
    `/projects/${projectId}/aportes/${contributionId}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo cargar el aporte')
  }
  return res.data.data
}

export async function createContribution(
  projectId: string,
  payload: CreateContributionPayload
): Promise<ApiProjectContribution> {
  const res = await api.post<ApiResponse<ApiProjectContribution>>(
    `/projects/${projectId}/aportes`,
    payload
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo crear el aporte')
  }
  return res.data.data
}

export async function updateContribution(
  projectId: string,
  contributionId: string,
  payload: UpdateContributionPayload
): Promise<ApiProjectContribution> {
  const res = await api.patch<ApiResponse<ApiProjectContribution>>(
    `/projects/${projectId}/aportes/${contributionId}`,
    payload
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar el aporte')
  }
  return res.data.data
}

export async function deleteContribution(
  projectId: string,
  contributionId: string,
  permanent = false
): Promise<void> {
  const qs = permanent ? '?permanent=1' : ''
  const res = await api.delete(`/projects/${projectId}/aportes/${contributionId}${qs}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar el aporte')
  }
}

export async function fetchLinkedTopics(
  projectId: string,
  contributionId: string
): Promise<ApiContributionTopicLink[]> {
  const res = await api.get<ApiResponse<ApiContributionTopicLink[]>>(
    `/projects/${projectId}/aportes/${contributionId}/temas`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los temas vinculados')
  }
  return res.data.data
}

export async function linkTopic(
  projectId: string,
  contributionId: string,
  topicId: string
): Promise<ApiContributionTopicLink> {
  const res = await api.post<ApiResponse<ApiContributionTopicLink>>(
    `/projects/${projectId}/aportes/${contributionId}/temas`,
    { topicId }
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo vincular el tema')
  }
  return res.data.data
}

export async function unlinkTopic(
  projectId: string,
  contributionId: string,
  topicId: string
): Promise<void> {
  const res = await api.delete(
    `/projects/${projectId}/aportes/${contributionId}/temas/${topicId}`
  )
  if (res.status !== 204) {
    throw new Error('No se pudo desvincular el tema')
  }
}
