import clsx from 'clsx'
import {
  Edit3,
  Trash2,
  Link2,
  Heart,
  MessageCircle,
  ExternalLink,
  Paperclip,
  Loader2,
  X,
} from 'lucide-react'
import type {
  ApiContributionPriority,
  ApiContributionStatus,
  ApiContributionType,
  ApiProjectContribution,
} from '@/services/aportes.service'
import { initials } from '../fileHelpers'

interface Props {
  items: ApiProjectContribution[]
  loading: boolean
  isError: boolean
  pending: {
    updatePending: boolean
    deletePending: boolean
    unlinkTopicPending: boolean
  }
  callbacks: {
    canEdit: boolean
    canDelete: boolean
    onEdit: (a: ApiProjectContribution) => void
    onConfirmDelete: (a: ApiProjectContribution) => void
    onOpenLinkTopic: (a: ApiProjectContribution) => void
    onUnlinkTopic: (aporteId: string, topicId: string) => void
  }
  formatRelativeTime: (iso: string | null | undefined) => string
}

export const TYPE_LABEL: Record<ApiContributionType, string> = {
  IDEA: 'Idea',
  COMENTARIO: 'Comentario',
  ENLACE: 'Enlace',
  ARCHIVO: 'Archivo',
  IMAGEN: 'Imagen',
  ENCUESTA: 'Encuesta',
  MENSAJE: 'Mensaje',
  OTRO: 'Otro',
}

export const TYPE_DESC: Record<ApiContributionType, string> = {
  IDEA: 'Propuesta o sugerencia nueva para mejorar el proyecto o resolver algo.',
  COMENTARIO: 'Opinión, aclaración o feedback breve sobre el proyecto o algún tema.',
  ENLACE: 'Link externo útil (documentación web, artículo, video, recurso online).',
  ARCHIVO: 'Adjunta un documento ya subido al proyecto (PDF, DOCX, Excel, etc.).',
  IMAGEN: 'Captura de pantalla, diseño, foto o gráfico para ilustrar una idea.',
  ENCUESTA: 'Búsqueda de opinión del equipo: haz una pregunta y que voten las respuestas.',
  MENSAJE: 'Comunicación general o recordatorio para todos los miembros del proyecto.',
  OTRO: 'Cualquier otro aporte que no encaje en las categorías anteriores.',
}

export const STATUS_LABEL: Record<ApiContributionStatus, string> = {
  BORRADOR: 'Borrador',
  PUBLICADO: 'Publicado',
  OCULTO: 'Oculto',
  ELIMINADO: 'Eliminado',
  DESTACADO: 'Destacado',
}

export const STATUS_DESC: Record<ApiContributionStatus, string> = {
  BORRADOR: 'Aún no se muestra al resto. Seguís editándolo antes de compartirlo.',
  PUBLICADO: 'Visible para todos los miembros del proyecto (estado normal).',
  OCULTO: 'Queda guardado pero temporalmente no se muestra al equipo.',
  ELIMINADO: 'Marcado como eliminado (queda en histórico para auditoría).',
  DESTACADO: 'Aporte importante que aparece resaltado en la parte superior.',
}

export const PRIORITY_LABEL: Record<ApiContributionPriority, string> = {
  BAJA: 'Baja',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
}

export const PRIORITY_DESC: Record<ApiContributionPriority, string> = {
  BAJA: 'Se puede revisar cuando haya disponibilidad, sin apuro.',
  NORMAL: 'Prioridad habitual para un aporte común del proyecto.',
  ALTA: 'Importante, conviene revisarlo pronto (en los próximos días).',
  URGENTE: 'Bloqueante o con plazo corto; necesita atención inmediata.',
}

export function typeBadgeClass(type: ApiContributionType): string {
  switch (type) {
    case 'IDEA': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    case 'COMENTARIO': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    case 'ENLACE': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
    case 'ARCHIVO': return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
    case 'IMAGEN': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300'
    case 'ENCUESTA': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'MENSAJE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }
}

export function priorityBadgeClass(p: ApiContributionPriority): string {
  switch (p) {
    case 'BAJA': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    case 'NORMAL': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
    case 'ALTA': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
    case 'URGENTE': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  }
}

export function statusBadgeClass(s: ApiContributionStatus): string {
  switch (s) {
    case 'BORRADOR': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    case 'PUBLICADO': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'OCULTO': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    case 'ELIMINADO': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    case 'DESTACADO': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  }
}

export default function AportesHistoryList(props: Props) {
  const { items, loading, isError, pending, callbacks, formatRelativeTime } = props

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando aportes…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="text-center py-12 text-sm text-red-600">
        Error cargando aportes. Intenta recargar.
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-500 italic">
        No hay aportes en el proyecto aún. Crea el primero haciendo clic en
        {' '}<strong>Nuevo aporte</strong>.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {items.map((a) => {
        const canEdit = callbacks.canEdit || a._permissions.canEdit
        const canDelete = callbacks.canDelete || a._permissions.canDelete
        return (
          <li key={a.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <div className="flex items-start gap-3">
              <div
                className={clsx(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white',
                  'bg-gradient-to-br from-brand-500 to-indigo-600 dark:from-brand-400 dark:to-indigo-500',
                )}
                title={a.authorName ?? a.authorEmail ?? ''}
              >
                {initials(a.authorName ?? a.authorEmail ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide', typeBadgeClass(a.type))}>
                    {TYPE_LABEL[a.type]}
                  </span>
                  <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide', priorityBadgeClass(a.priority))}>
                    {PRIORITY_LABEL[a.priority]}
                  </span>
                  <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide', statusBadgeClass(a.status))}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-auto">
                    {formatRelativeTime(a.createdAt)}
                  </span>
                </div>
                {a.title && (
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {a.title}
                  </h4>
                )}
                {a.content && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-wrap">
                    {a.content}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3" /> {a.likesCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {a.commentsCount}
                  </span>
                  {a.externalUrl && (
                    <a
                      href={a.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline max-w-[260px] truncate"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{a.externalUrl}</span>
                    </a>
                  )}
                  {a.attachedFileName && (
                    <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400">
                      <Paperclip className="w-3 h-3" />
                      <span className="max-w-[200px] truncate">{a.attachedFileName}</span>
                    </span>
                  )}
                  {a.authorName && (
                    <span className="text-slate-500">— {a.authorName}</span>
                  )}
                </div>
                {a.linkedTopics && a.linkedTopics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mr-0.5">
                      Temas:
                    </span>
                    {a.linkedTopics.map((t) => (
                      <span
                        key={t.id}
                        className="group inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <span className="max-w-[180px] truncate">{t.title}</span>
                        {canEdit && (
                          <button
                            type="button"
                            title="Desvincular tema"
                            disabled={pending.unlinkTopicPending}
                            onClick={() => callbacks.onUnlinkTopic(a.id, t.id)}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => callbacks.onOpenLinkTopic(a)}
                      title="Vincular tema"
                      className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => callbacks.onEdit(a)}
                      title="Editar aporte"
                      disabled={pending.updatePending}
                      className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => callbacks.onConfirmDelete(a)}
                    title="Eliminar aporte"
                    disabled={pending.deletePending}
                    className="p-1.5 rounded text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
