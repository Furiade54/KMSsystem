import api from './api'
import type { ApiResponse, ResourceType } from '../../../packages/shared-types/src'

export type FavoriteResourceType = 'PROJECT' | 'FOLDER' | 'FILE'

export interface FavoriteItem {
  userId: string
  organizationId: string
  resourceType: FavoriteResourceType
  resourceId: string
  createdAt: string
  name: string | null
  projectId: string | null
  projectName: string | null
  folderId: string | null
  folderName: string | null
  extension: string | null
  mime: string | null
}

export interface FavoriteState {
  favorited: boolean
  createdAt: string | null
}

export async function listFavorites(params: {
  resourceType?: FavoriteResourceType
  page?: number
  pageSize?: number
}) {
  const q = new URLSearchParams()
  if (params.resourceType) q.set('resourceType', params.resourceType)
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  const res = await api.get<ApiResponse<{ items: FavoriteItem[]; total: number }>>(
    `/favorites?${q.toString()}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los favoritos')
  }
  return res.data.data
}

export async function checkFavorite(payload: {
  resourceType: FavoriteResourceType
  resourceId: string
}) {
  const q = new URLSearchParams()
  q.set('resourceType', payload.resourceType)
  q.set('resourceId', payload.resourceId)
  const res = await api.get<ApiResponse<FavoriteState>>(`/favorites/check?${q.toString()}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo comprobar el favorito')
  }
  return res.data.data
}

export async function toggleFavorite(payload: {
  resourceType: FavoriteResourceType
  resourceId: string
}) {
  const res = await api.put<ApiResponse<FavoriteState>>('/favorites/toggle', payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar el favorito')
  }
  return res.data.data
}

export async function addFavorite(payload: {
  resourceType: FavoriteResourceType
  resourceId: string
}) {
  const res = await api.post<ApiResponse<FavoriteState>>('/favorites', payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo agregar a favoritos')
  }
  return res.data.data
}

export async function removeFavorite(payload: {
  resourceType: FavoriteResourceType
  resourceId: string
}) {
  const res = await api.delete(
    `/favorites/${encodeURIComponent(payload.resourceType)}/${encodeURIComponent(payload.resourceId)}`
  )
  if (res.status !== 204) {
    throw new Error('No se pudo quitar de favoritos')
  }
}
