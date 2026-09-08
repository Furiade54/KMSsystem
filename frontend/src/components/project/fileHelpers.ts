import type { ApiMeetingStatus } from '@/services/meetings.service'
import type { ApiTopicStatus } from '@/services/project-topics.service'

export function topicStatusLabel(status: ApiTopicStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Abierto'
    case 'IN_REVIEW':
      return 'En revisión'
    case 'RESOLVED':
      return 'Resuelto'
    case 'CLOSED':
      return 'Cerrado'
    case 'IN_PROGRESS':
      return 'En progreso'
    default:
      return status
  }
}

export function topicStatusBadgeClass(status: ApiTopicStatus): string {
  switch (status) {
    case 'OPEN':
      return 'bg-brand-500/20 text-brand-700 dark:text-brand-300'
    case 'IN_REVIEW':
      return 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
    case 'RESOLVED':
      return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
    case 'CLOSED':
      return 'bg-gray-500/25 text-emerald-800 dark:text-emerald-200'
    case 'IN_PROGRESS':
      return 'bg-status-review/20 text-amber-700 dark:text-amber-300'
    default:
      return 'bg-surface-secondary text-muted-foreground'
  }
}
import type { ApiFileType } from '@/services/files.service'
import {
  Folder,
  File,
  Film,
  Music,
  Link2,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
} from 'lucide-react'

export function iconForKind(k: ApiFileType) {
  switch (k) {
    case 'folder':
      return Folder
    case 'video':
      return Film
    case 'audio':
      return Music
    case 'link':
      return Link2
    case 'image':
      return ImageIcon
    case 'pdf':
      return FileText
    case 'doc':
      return FileText
    case 'sheet':
      return FileSpreadsheet
    case 'slide':
      return Presentation
    case 'zip':
      return FileArchive
    default:
      return File
  }
}

export function colorForKind(k: ApiFileType) {
  switch (k) {
    case 'folder':
      return 'text-status-review bg-status-review/20'
    case 'video':
      return 'text-pink-400 bg-pink-400/20'
    case 'audio':
      return 'text-purple-400 bg-purple-400/20'
    case 'link':
      return 'text-brand-400 bg-brand-400/20'
    case 'image':
      return 'text-indigo-300 bg-indigo-400/20'
    case 'pdf':
      return 'text-rose-300 bg-rose-400/20'
    case 'doc':
      return 'text-brand-300 bg-brand-500/20'
    case 'sheet':
      return 'text-emerald-300 bg-emerald-400/20'
    case 'slide':
      return 'text-amber-300 bg-amber-400/20'
    case 'zip':
      return 'text-orange-300 bg-orange-400/20'
    default:
      return 'text-gray-300 bg-surface-tertiary'
  }
}

export function initials(fullName: string | null): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?'
}

export function meetingStatusLabel(status: ApiMeetingStatus): string {
  switch (status) {
    case 'SCHEDULED':
      return 'Programada'
    case 'IN_PROGRESS':
      return 'En curso'
    case 'HELD':
      return 'Realizada'
    case 'COMPLETED':
      return 'Completada'
    case 'CANCELLED':
      return 'Cancelada'
    default:
      return status
  }
}

export function meetingStatusBadgeClass(status: ApiMeetingStatus): string {
  switch (status) {
    case 'SCHEDULED':
      return 'bg-brand-500/20 text-brand-600 dark:text-brand-300'
    case 'IN_PROGRESS':
      return 'bg-status-review/20 text-amber-700 dark:text-amber-300'
    case 'HELD':
      return 'bg-status-approved/20 text-emerald-700 dark:text-emerald-300'
    case 'COMPLETED':
      return 'bg-status-approved/25 text-emerald-700 dark:text-emerald-300'
    case 'CANCELLED':
      return 'bg-status-blocked/20 text-rose-700 dark:text-rose-300'
    default:
      return 'bg-surface-secondary text-muted-foreground'
  }
}
