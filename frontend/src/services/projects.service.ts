import api from '../services/api'

export type ApiProjectStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED' | 'COMPLETED'

export interface ApiProject {
  id: string
  organizationId: string
  name: string
  description: string
  status: ApiProjectStatus
  ownerId: string | null
  createdAt: string
  updatedAt: string | null
  color: string
  progress: number
  membersCount: number
  filesCount: number
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export interface CreateProjectPayload {
  name: string
  description?: string
  status?: ApiProjectStatus
  color?: string
}

export const statusBadgeMap: Record<ApiProjectStatus | string, { label: string; dotClass: string; textClass: string; bgClass: string; gradient: string }> = {
  ACTIVE: { label: 'En construcción', dotClass: 'bg-brand-500', textClass: 'text-brand-700 dark:text-brand-200', bgClass: 'bg-brand-500/25 dark:bg-brand-500/15', gradient: 'from-brand-500 to-brand-700' },
  INACTIVE: { label: 'Inactivo', dotClass: 'bg-gray-500', textClass: 'text-gray-700 dark:text-gray-300', bgClass: 'bg-gray-500/25 dark:bg-gray-500/15', gradient: 'from-gray-500 to-gray-700' },
  PENDING: { label: 'Borrador', dotClass: 'bg-status-approved', textClass: 'text-emerald-700 dark:text-emerald-200', bgClass: 'bg-status-approved/25 dark:bg-status-approved/15', gradient: 'from-status-approved to-emerald-700' },
  COMPLETED: { label: 'Completado', dotClass: 'bg-status-review', textClass: 'text-amber-700 dark:text-amber-200', bgClass: 'bg-status-review/25 dark:bg-status-review/15', gradient: 'from-status-review to-amber-700' },
  ARCHIVED: { label: 'Archivado', dotClass: 'bg-status-blocked', textClass: 'text-rose-700 dark:text-rose-200', bgClass: 'bg-status-blocked/25 dark:bg-status-blocked/15', gradient: 'from-status-blocked to-rose-700' },
}

export function statusBadgeInfo(status: ApiProjectStatus | string) {
  return statusBadgeMap[status] || statusBadgeMap.ACTIVE
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return 'Nunca'
  const now = Date.now()
  const diff = Math.max(0, now - d)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Ahora mismo'
  if (m < 60) return `Hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Hace ${h} h`
  const day = Math.floor(h / 24)
  if (day < 7) return `Hace ${day} día${day === 1 ? '' : 's'}`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `Hace ${wk} sem`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `Hace ${mo} mes${mo === 1 ? '' : 'es'}`
  const yr = Math.floor(day / 365)
  return `Hace ${yr} año${yr === 1 ? '' : 's'}`
}

export async function fetchProjects(params: {
  recent?: boolean
  destacados?: boolean
  page?: number
  pageSize?: number
  search?: string
  status?: string
}) {
  const query = new URLSearchParams()
  if (params.recent) query.set('recent', 'true')
  if (params.destacados) query.set('destacados', 'true')
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  const res = await api.get<ApiResponse<PaginatedData<ApiProject>>>(
    `/projects?${query.toString()}`
  )
  return res.data.data
}

export async function createProject(payload: CreateProjectPayload) {
  const res = await api.post<ApiResponse<{ project: ApiProject }>>('/projects', payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo crear el proyecto')
  }
  return res.data.data.project
}

export interface ProjectMember {
  id: string
  userId: string
  roleName: string | null
  joinedAt: string | null
  fullName: string | null
  email: string | null
  avatarUrl: string | null
}

export interface ProjectStats {
  membersCount: number
  topicsCount: number
  meetingsCount: number
  foldersCount: number
  filesCount: number
}

export interface ProjectDetail {
  project: ApiProject
  stats: ProjectStats
}

export async function getProjectById(id: string) {
  const res = await api.get<ApiResponse<ProjectDetail>>(`/projects/${id}`)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Proyecto no encontrado')
  }
  return res.data.data
}

export async function getProjectMembers(projectId: string) {
  const res = await api.get<ApiResponse<{ items: ProjectMember[]; total: number }>>(
    `/projects/${projectId}/miembros`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los miembros')
  }
  return res.data.data
}

export async function addProjectMember(projectId: string, userId: string, roleName?: string) {
  const res = await api.post<ApiResponse<ProjectMember>>(`/projects/${projectId}/miembros`, {
    userId,
    roleName: roleName || 'Miembro',
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo agregar el miembro')
  }
  return res.data.data
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const res = await api.delete(`/projects/${projectId}/miembros/${memberId}`)
  if (res.status !== 204) {
    throw new Error('No se pudo retirar el miembro')
  }
}

export async function updateProjectMemberRole(projectId: string, memberId: string, roleName: string | null) {
  const res = await api.patch<ApiResponse<ProjectMember>>(`/projects/${projectId}/miembros/${memberId}`, {
    roleName,
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar el rol')
  }
  return res.data.data
}

export interface UpdateProjectPayload {
  name?: string
  description?: string
  status?: ApiProjectStatus
}

export async function updateProject(id: string, payload: UpdateProjectPayload) {
  const res = await api.patch<ApiResponse<{ project: ApiProject }>>(`/projects/${id}`, payload)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar el proyecto')
  }
  return res.data.data.project
}

export async function deleteProject(id: string) {
  const res = await api.delete(`/projects/${id}`)
  if (res.status !== 204) {
    throw new Error('No se pudo eliminar el proyecto')
  }
}

export async function permanentlyDeleteProject(id: string) {
  try {
    const res = await api.delete(`/projects/${id}/permanent`)
    if (res.status !== 204) {
      throw new Error('No se pudo eliminar permanentemente el proyecto')
    }
  } catch (err: any) {
    throw new Error(
      err?.response?.data?.message ||
        err?.message ||
        'No se pudo eliminar permanentemente el proyecto'
    )
  }
}

const projectColorMap: Record<string, string> = {
  rose: 'bg-status-blocked',
  indigo: 'bg-brand-500',
  emerald: 'bg-status-approved',
  amber: 'bg-status-review',
}

export function projectColorClass(colorKey?: string | null): string {
  if (!colorKey) return 'bg-brand-500'
  return projectColorMap[colorKey] || 'bg-brand-500'
}

const projectGradientMap: Record<string, string> = {
  rose: 'from-status-blocked to-rose-700',
  indigo: 'from-brand-500 to-brand-700',
  emerald: 'from-status-approved to-emerald-700',
  amber: 'from-status-review to-amber-700',
}

export function projectGradientClass(colorKey?: string | null): string {
  if (!colorKey) return 'from-brand-500 to-brand-700'
  return projectGradientMap[colorKey] || 'from-brand-500 to-brand-700'
}

export interface OrgMember {
  id: string
  fullName: string | null
  email: string | null
  role: string | null
  joinedAt: string | null
  projectsCount: number
  status: string
}

export async function fetchOrganizationMembers(params: {
  search?: string
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const res = await api.get<ApiResponse<{ items: OrgMember[]; total: number }>>(
    `/auth/organization/members?${query.toString()}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los miembros')
  }
  return res.data.data
}
