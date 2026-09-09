import type { ApiFileVersion, formatBytes as FormatBytesType } from '../../../services/files.service'
import type { FileVersionCallbacks, FileVersionMutationsPending, FileVersionUiState } from './types'

interface Props {
  items: ApiFileVersion[]
  currentVersionId: string | null
  pending: FileVersionMutationsPending
  callbacks: FileVersionCallbacks
  uiState: FileVersionUiState
  formatBytes: typeof FormatBytesType
}

function shortHash(h: string | null): string {
  if (!h) return '—'
  if (h.length <= 12) return h
  return `${h.slice(0, 8)}…${h.slice(-4)}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function FileVersionHistoryList(props: Props) {
  const { items, currentVersionId, pending, callbacks, uiState, formatBytes } = props
  const currentIdLower = currentVersionId ? String(currentVersionId).toLowerCase() : null

  return (
    <div className="flex flex-col gap-3 text-sm">
      {callbacks.canEdit && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={uiState.toggleShowUpload}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={pending.uploadVersion}
          >
            <span>⬆</span>
            <span>Subir nueva versión</span>
          </button>
          {pending.uploadVersion && (
            <span className="text-xs text-slate-500">Subiendo…</span>
          )}
        </div>
      )}

      {uiState.showUpload && callbacks.canEdit && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="space-y-1">
            <label htmlFor="file-version-upload" className="block text-xs font-medium text-slate-700">
              Archivo
            </label>
            <input
              id="file-version-upload"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                uiState.setUploadFile(f)
              }}
              className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-slate-600"
            />
            {uiState.uploadFile && (
              <p className="text-xs text-slate-500">
                Seleccionado: <span className="font-mono">{uiState.uploadFile.name}</span>
                {' · '}
                {formatBytes(uiState.uploadFile.size)}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="file-version-comment" className="block text-xs font-medium text-slate-700">
              Comentario del cambio (opcional)
            </label>
            <textarea
              id="file-version-comment"
              value={uiState.uploadComment}
              onChange={(e) => uiState.setUploadComment(e.target.value)}
              rows={2}
              placeholder="Ej: Cambios logo del cliente + sección presupuesto"
              className="block w-full resize-none rounded-md border border-slate-300 bg-white text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1.5"
            />
          </div>
          {uiState.uploadError && (
            <p className="text-xs text-red-600">{uiState.uploadError}</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                uiState.setUploadError(null)
                uiState.toggleShowUpload()
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              disabled={pending.uploadVersion}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!uiState.uploadFile) {
                  uiState.setUploadError('Selecciona un archivo para subir.')
                  return
                }
                uiState.setUploadError(null)
                void callbacks.onUploadNew(uiState.uploadFile, uiState.uploadComment.trim() || null)
              }}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
              disabled={pending.uploadVersion || !uiState.uploadFile}
            >
              <span>Subir</span>
              {pending.uploadVersion && <span className="animate-pulse">…</span>}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-slate-500 italic">
          No hay versiones históricas para este archivo.
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {items.map((v) => {
          const isCurrent = currentIdLower != null && String(v.id).toLowerCase() === currentIdLower
          const pendingSetCurrent = pending.setCurrentVersion && callbacks.onSetCurrent.length === 0
          const pendingDelete = pending.deleteVersion && callbacks.onDelete.length === 0
          return (
            <li
              key={v.id}
              className={`flex flex-col gap-1 px-3 py-2 ${isCurrent ? 'bg-indigo-50/50' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                    V{String(v.versionNumber)}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Actual
                    </span>
                  )}
                  <span className="text-xs text-slate-600">
                    {formatDate(v.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={v.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    onClick={(e) => {
                      if (!v.downloadUrl) e.preventDefault()
                      callbacks.onDownload(v)
                    }}
                  >
                    Descargar
                  </a>
                  {callbacks.canEdit && !isCurrent && (
                    <button
                      type="button"
                      onClick={() => { void callbacks.onSetCurrent(v.id) }}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                      disabled={pendingSetCurrent}
                    >
                      Establecer actual
                    </button>
                  )}
                  {callbacks.canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la versión N°${v.versionNumber}? Esta acción no se puede deshacer.`)) {
                          void callbacks.onDelete(v.id)
                        }
                      }}
                      className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      disabled={pendingDelete}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                <span>
                  <span className="font-medium text-slate-700">Subida por:</span>{' '}
                  {v.uploadedByName ?? v.uploadedByEmail ?? v.uploadedBy ?? '—'}
                </span>
                <span>
                  <span className="font-medium text-slate-700">Tamaño:</span>{' '}
                  {formatBytes(v.size ?? null)}
                </span>
                <span>
                  <span className="font-medium text-slate-700">Hash:</span>{' '}
                  <span className="font-mono">{shortHash(v.hash)}</span>
                </span>
              </div>
              {v.comment && (
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700 rounded-md bg-slate-50 px-2 py-1 border border-slate-100">
                  💬 {v.comment}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
