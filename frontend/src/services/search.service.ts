import api from './api'
import type { ApiResponse } from './projects.service'

export type SearchHitType = 'project' | 'folder' | 'file' | 'user'

export interface SearchHit {
  id: string
  type: SearchHitType
  name: string
  path: string
  projectId: string | null
  updatedAt: string | null
}

export async function globalSearch(params: { q: string; limit?: number }) {
  const query = new URLSearchParams()
  query.set('q', params.q.trim())
  if (params?.limit) query.set('limit', String(params.limit))
  const res = await api.get<ApiResponse<{ items: SearchHit[]; total: number }>>(
    `/buscar?${query.toString()}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo realizar la búsqueda')
  }
  return res.data.data
}

export function labelForHitType(t: SearchHitType): { label: string; iconKey: string } {
  switch (t) {
    case 'project':
      return { label: 'Proyectos', iconKey: 'project' }
    case 'folder':
      return { label: 'Carpetas', iconKey: 'folder' }
    case 'file':
      return { label: 'Documentos', iconKey: 'file' }
    case 'user':
      return { label: 'Usuarios', iconKey: 'user' }
  }
}
