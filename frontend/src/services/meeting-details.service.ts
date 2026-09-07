import api from './api'
import type { ApiResponse, PaginatedData } from './projects.service'

export interface ApiMeetingParticipant {
  meetingId: string
  userId: string
  roleName?: string | null
  attended: boolean
  userFullName?: string | null
  userEmail?: string | null
}

export interface UpsertParticipantPayload {
  userId: string
  roleName?: string | null
  attended?: boolean
}

export async function fetchMeetingParticipants(params: {
  projectId: string
  meetingId: string
  page?: number
  pageSize?: number
  search?: string
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  const qs = query.toString()
  const res = await api.get<ApiResponse<PaginatedData<ApiMeetingParticipant>>>(
    `/projects/${params.projectId}/reuniones/${params.meetingId}/asistentes${qs ? `?${qs}` : ''}`
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudieron cargar los asistentes')
  }
  return res.data.data
}

export async function upsertMeetingParticipant(
  projectId: string,
  meetingId: string,
  payload: UpsertParticipantPayload
) {
  const res = await api.post<ApiResponse<ApiMeetingParticipant>>(
    `/projects/${projectId}/reuniones/${meetingId}/asistentes`,
    payload
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo guardar el asistente')
  }
  return res.data.data
}

export async function setMeetingAttendance(
  projectId: string,
  meetingId: string,
  userId: string,
  attended: boolean
) {
  const res = await api.patch<ApiResponse<ApiMeetingParticipant>>(
    `/projects/${projectId}/reuniones/${meetingId}/asistentes/${userId}/asistencia`,
    { attended }
  )
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'No se pudo actualizar la asistencia')
  }
  return res.data.data
}

export async function removeMeetingParticipant(projectId: string, meetingId: string, userId: string) {
  const deleteRes = await api.delete(`/projects/${projectId}/reuniones/${meetingId}/asistentes/${userId}`)
  if (deleteRes.status < 200 || deleteRes.status >= 300) {
    const anyErr = (deleteRes as any).data?.message
    throw new Error(anyErr || 'No se pudo retirar el asistente')
  }
  return void 0
}

export async function setMeetingMinutesFile(
  projectId: string,
  meetingId: string,
  minutesFileId: string | null
) {
  const res = await api.patch(
    `/projects/${projectId}/reuniones/${meetingId}/minutos-archivo`,
    { minutesFileId }
  )
  const data = (res.data as any) as ApiResponse<any>
  if (!data?.success) {
    throw new Error(data?.message || 'No se pudo actualizar el archivo del acta')
  }
  return data.data
}
