import { useRef } from 'react'
import clsx from 'clsx'
import {
  Search,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Link2,
  Upload,
  Paperclip,
} from 'lucide-react'
import AportesHistoryList, {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
} from './project-aportes/AportesHistoryList'
import { formatBytes } from '@/services/files.service'
import type {
  ApiContributionPriority,
  ApiContributionStatus,
  ApiContributionType,
  ApiProjectContribution,
} from '@/services/aportes.service'
import type {
  AporteCallbacks,
  AporteFiltersState,
  AporteFormsState,
  AporteLinkTopicUiState,
  AporteMutationsPending,
} from './project-aportes/types'

export type ProjectAportesTabProps = {
  filters: AporteFiltersState
  listUi: {
    items: ApiProjectContribution[] | undefined
    total: number | undefined
    limit: number
    offset: number
    loading: boolean
    isError: boolean
  }
  forms: AporteFormsState
  pending: AporteMutationsPending
  callbacks: AporteCallbacks
  linkTopicUi: AporteLinkTopicUiState
  canCreateAportes: boolean
  canEditAportes: boolean
  canDeleteAportes: boolean
  formatRelativeTime: (iso: string | null | undefined) => string
}

const TIPOS_OPT: ApiContributionType[] = ['IDEA', 'COMENTARIO', 'ENLACE', 'ARCHIVO', 'IMAGEN', 'ENCUESTA', 'MENSAJE', 'OTRO']
const ESTADOS_OPT: ApiContributionStatus[] = ['PUBLICADO', 'BORRADOR', 'OCULTO', 'DESTACADO']
const PRIORIDADES_OPT: ApiContributionPriority[] = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE']

export default function ProjectAportesTab(props: ProjectAportesTabProps) {
  const { filters, listUi, forms, pending, callbacks, linkTopicUi, canCreateAportes, canEditAportes, canDeleteAportes, formatRelativeTime } = props

  const { showNewAporte, editingAporte, formNew, formEdit, confirmDeleteAporte, showLinkTopicModal } = forms
  const isEditing = editingAporte != null
  const form = isEditing ? formEdit : formNew
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handlePickFile = () => {
    if (form.uploading) return
    fileInputRef.current?.click()
  }
  const handleFileChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) callbacks.onSelectAttachedFile(file)
    e.target.value = ''
  }
  const uploadAccept = form.type === 'IMAGEN' ? 'image/*' : '*'
  const uploadLabel = form.type === 'IMAGEN' ? 'Subir imagen' : 'Subir archivo'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Buscar aportes por título, contenido, tipo, estado, prioridad, autor, adjunto, temas o enlace…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500 focus:ring-1 outline-none"
          />
        </div>
        <select
          value={filters.tipoFilter}
          onChange={(e) => filters.setTipoFilter(e.target.value as ApiContributionType | '')}
          className="text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_OPT.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <select
          value={filters.estadoFilter}
          onChange={(e) => filters.setEstadoFilter(e.target.value as ApiContributionStatus | '')}
          className="text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_OPT.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select
          value={filters.importanciaFilter}
          onChange={(e) => filters.setImportanciaFilter(e.target.value as ApiContributionPriority | '')}
          className="text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500"
        >
          <option value="">Toda prioridad</option>
          {PRIORIDADES_OPT.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {typeof listUi.total === 'number' && (
            <span className="text-[11px] text-slate-500">
              {listUi.items?.length ?? 0} de {listUi.total}
            </span>
          )}
          {canCreateAportes && (
            <button
              type="button"
              onClick={callbacks.onNewAporte}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400 px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={pending.createPending}
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo aporte
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        <AportesHistoryList
          items={listUi.items ?? []}
          loading={listUi.loading}
          isError={listUi.isError}
          pending={{
            updatePending: pending.updatePending,
            deletePending: pending.deletePending,
            unlinkTopicPending: pending.unlinkTopicPending,
          }}
          callbacks={{
            canEdit: canEditAportes,
            canDelete: canDeleteAportes,
            onEdit: callbacks.onEditAporte,
            onConfirmDelete: (a) => forms.setConfirmDeleteAporte(a),
            onOpenLinkTopic: callbacks.onOpenLinkTopic,
            onUnlinkTopic: callbacks.onUnlinkTopic,
          }}
          formatRelativeTime={formatRelativeTime}
        />
        {listUi.total && listUi.total > (listUi.items?.length ?? 0) && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={filters.offset <= 0}
              onClick={() => filters.setOffset((p) => Math.max(0, p - filters.limit))}
              className="text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-[11px] text-slate-500">
              Pág. {Math.floor((listUi.offset ?? 0) / filters.limit) + 1} / {Math.ceil(listUi.total / filters.limit)}
            </span>
            <button
              type="button"
              disabled={(listUi.offset ?? 0) + filters.limit >= (listUi.total ?? 0)}
              onClick={() => filters.setOffset((p) => p + filters.limit)}
              className="text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {showNewAporte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                {isEditing ? 'Editar aporte' : 'Nuevo aporte al proyecto'}
              </h3>
              <button
                type="button"
                onClick={() => forms.setShowNewAporte(false)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={callbacks.onSubmitAporte}
              className="p-4 space-y-3 text-sm"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => form.setType(e.target.value as ApiContributionType)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                  >
                    {TIPOS_OPT.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => form.setStatus(e.target.value as ApiContributionStatus)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                  >
                    {ESTADOS_OPT.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    <option value="ELIMINADO">Eliminado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Prioridad</label>
                  <select
                    value={form.priority}
                    onChange={(e) => form.setPriority(e.target.value as ApiContributionPriority)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                  >
                    {PRIORIDADES_OPT.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Título</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => form.setTitle(e.target.value)}
                  placeholder="Ej: Presupuesto tentativo para la fase 2"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Contenido</label>
                <textarea
                  rows={4}
                  value={form.content}
                  onChange={(e) => form.setContent(e.target.value)}
                  placeholder="Describe tu idea, comentario, enlace…"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs resize-y outline-none focus:border-brand-500"
                />
              </div>
              {form.type === 'ENLACE' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">URL externa (requerido)</label>
                  <input
                    type="url"
                    value={form.externalUrl}
                    onChange={(e) => form.setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              )}
              {(form.type === 'ARCHIVO' || form.type === 'IMAGEN') && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    {form.type === 'IMAGEN' ? 'Imagen adjunta (requerido)' : 'Archivo adjunto (requerido)'}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={uploadAccept}
                    className="hidden"
                    onChange={handleFileChanged}
                  />
                  <div className="flex flex-col gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-3 bg-slate-50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handlePickFile}
                        disabled={form.uploading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-brand-600 hover:bg-brand-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {uploadLabel}
                      </button>
                      {form.attachedFileMeta && !form.uploading && (
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-900">
                          <Paperclip className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-medium text-slate-800 dark:text-slate-100 truncate">
                              {form.attachedFileMeta.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatBytes(form.attachedFileMeta.sizeBytes)}
                              {form.attachedFileMeta.mimeType ? ` · ${form.attachedFileMeta.mimeType}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => callbacks.onClearAttachedFile()}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                            title="Quitar adjunto"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {form.uploading && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                          Subiendo… {form.uploadPercent}%
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-brand-600 transition-all"
                            style={{ width: `${form.uploadPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {!form.uploading && !form.attachedFileMeta && (
                      <p className="text-[11px] text-slate-500">
                        {form.type === 'IMAGEN'
                          ? 'Formatos permitidos: JPG, PNG, GIF, WebP, SVG. El archivo se sube directamente al bucket S3 del proyecto.'
                          : 'Selecciona cualquier archivo. Se subirá directamente al bucket S3 del proyecto y quedará registrado en Archivos.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="aporte-publish-now"
                    checked={form.publishNow}
                    onChange={(e) => form.setPublishNow(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="aporte-publish-now" className="text-xs text-slate-600 dark:text-slate-400">
                    Publicar inmediatamente
                  </label>
                </div>
              )}
              {form.error && (
                <p className="text-xs text-red-600 dark:text-red-400">{form.error}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => forms.setShowNewAporte(false)}
                  disabled={pending.createPending || pending.updatePending}
                  className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending.createPending || pending.updatePending}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-sm disabled:opacity-50"
                >
                  {(pending.createPending || pending.updatePending) && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {isEditing ? 'Guardar cambios' : 'Crear aporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteAporte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="px-4 py-3 flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Eliminar aporte
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  ¿Estás seguro que deseas eliminar{' '}
                  <strong className="break-all">{confirmDeleteAporte.title ?? 'este aporte'}</strong>?
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => forms.setConfirmDeleteAporte(null)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => forms.setConfirmDeleteAporte(null)}
                disabled={pending.deletePending}
                className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={callbacks.onConfirmDeleteAporte}
                disabled={pending.deletePending}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-medium shadow-sm disabled:opacity-50"
              >
                {pending.deletePending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Eliminar aporte
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-brand-600" />
                Vincular tema
              </h3>
              <button
                type="button"
                onClick={() => forms.setShowLinkTopicModal(null)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {linkTopicUi.availableTopicsLoading && (
                <div className="flex items-center justify-center py-6 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cargando temas…
                </div>
              )}
              {linkTopicUi.availableTopicsIsError && (
                <p className="text-xs text-red-600 text-center py-4">Error cargando temas</p>
              )}
              {!linkTopicUi.availableTopicsLoading && !linkTopicUi.availableTopics?.length && (
                <p className="text-xs text-slate-500 text-center py-6 italic">
                  No hay temas creados en el proyecto para vincular.
                </p>
              )}
              {linkTopicUi.availableTopics?.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  disabled={t.alreadyLinked || pending.linkTopicPending}
                  onClick={() => callbacks.onSubmitLinkTopic(t.id)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left border transition-colors text-xs',
                    t.alreadyLinked
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 cursor-default'
                      : 'border-slate-200 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 cursor-pointer',
                  )}
                >
                  <span className="flex-1 min-w-0 truncate">{t.title}</span>
                  <span
                    className={clsx(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
                      t.alreadyLinked
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {t.alreadyLinked ? 'Vinculado' : 'Vincular'}
                  </span>
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
              <button
                type="button"
                onClick={() => forms.setShowLinkTopicModal(null)}
                className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
