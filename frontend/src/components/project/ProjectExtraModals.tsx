import React from 'react'
import {
  X, Check, Loader2, MessageCircle, Send, ArrowRightLeft, Copy, FolderKanban,
} from 'lucide-react'
import clsx from 'clsx'
import type { ApiFile } from '@/services/files.service'
import type { ApiFolder, FolderNode } from '@/services/folders.service'
import { TransferTargetTreeItem } from './FolderTreeItem'

/* ================================================================
   1. RenameFileModal
   ================================================================ */
export type RenameFileModalProps = {
  file: ApiFile | null
  nameValue: string
  setNameValue: (v: string) => void
  errorMsg: string
  setErrorMsg: (v: string) => void
  mutationPending: boolean
  mutationError: unknown
  inputRef: React.MutableRefObject<HTMLInputElement | null>
  onClose: () => void
  onSubmitClick: (
    e: React.MouseEvent<HTMLButtonElement>,
    fallbackName: string,
  ) => void
}

export function RenameFileModal(props: RenameFileModalProps) {
  const {
    file, nameValue, setNameValue, errorMsg, setErrorMsg: _setErrorMsg, mutationPending, mutationError,
    inputRef, onClose, onSubmitClick,
  } = props
  if (!file) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Renombrar archivo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nombre actual:{' '}
              <span className="text-foreground">{file.name}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={mutationPending}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {mutationError || errorMsg ? (
            <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
              {errorMsg ||
                (mutationError instanceof Error
                  ? mutationError.message
                  : 'Error desconocido')}
            </div>
          ) : null}
          {(() => {
            const n = file.name
            const dot = n.lastIndexOf('.')
            const ext = dot > 0 ? n.slice(dot) : ''
            return (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Nuevo nombre <span className="text-status-blocked">*</span>
                </label>
                <div className="flex items-stretch w-full rounded-lg border border-border bg-surface focus-within:ring-2 focus-within:ring-accent/40 focus-within:border-accent overflow-hidden transition-all">
                  <input
                    ref={inputRef}
                    autoFocus
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    maxLength={245}
                    placeholder="Ej. Inventario actualizado"
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
                  />
                  {ext && (
                    <div className="flex items-center px-3 py-2 bg-surface-secondary border-l border-border text-xs text-accent font-semibold select-none whitespace-nowrap">
                      {ext}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={mutationPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={(e) => onSubmitClick(e, nameValue)}
            disabled={mutationPending}
          >
            {mutationPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ================================================================
   2. CommentFileDialog
   ================================================================ */
export type CommentFileDialogProps = {
  file: ApiFile | null
  content: string
  setContent: (v: string) => void
  errorMsg: string
  setErrorMsg: (v: string) => void
  mutationPending: boolean
  mutationError: unknown
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>
  onClose: () => void
  onSubmitClick: (
    e: React.MouseEvent<HTMLButtonElement>,
    trimmedContent: string,
  ) => void
}

export function CommentFileDialog(props: CommentFileDialogProps) {
  const {
    file, content, setContent, errorMsg, setErrorMsg: _setErrorMsg, mutationPending, mutationError,
    inputRef, onClose, onSubmitClick,
  } = props
  if (!file) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        className="card w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-brand-500" />
              Comentar archivo
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="text-foreground font-medium">{file.name}</span>
              {' · '}
              El comentario será visible para todo el equipo.
            </p>
          </div>
          <button
            type="button"
            disabled={mutationPending}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {mutationError || errorMsg ? (
            <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
              {errorMsg ||
                (mutationError instanceof Error
                  ? mutationError.message
                  : 'Error desconocido')}
            </div>
          ) : null}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Tu comentario <span className="text-status-blocked">*</span>
            </label>
            <textarea
              ref={inputRef}
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Escribe un comentario o aportación sobre este archivo…"
              className="input-base w-full resize-y min-h-[120px]"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground">
                Se publicará y quedará asociado al documento.
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {content.length}
                <span className="text-muted-foreground/60"> / 2000</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={mutationPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={(e) => onSubmitClick(e, content.trim())}
            disabled={mutationPending}
          >
            {mutationPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publicando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Publicar
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ================================================================
   3. TransferDialog (Mover / Copiar)
   ================================================================ */
export type TransferResource =
  | { type: 'folder'; folder: ApiFolder }
  | { type: 'file'; file: ApiFile }

export type TransferDialogState = {
  resource: TransferResource
  mode: 'move' | 'copy'
  targetFolderId: string | null
  error: string
} | null

export type TransferDialogProps = {
  dialog: TransferDialogState
  folderTree: FolderNode[]
  disabledFolderIds: Set<string>
  transferIsPending: boolean
  transferFileMoveError: unknown
  transferFileCopyError: unknown
  transferFolderMoveError: unknown
  transferFolderCopyError: unknown
  onChange: (next: Partial<Exclude<TransferDialogState, null>>) => void
  onClose: () => void
  onSubmit: () => void
}

export function TransferDialog(props: TransferDialogProps) {
  const {
    dialog, folderTree, disabledFolderIds, transferIsPending,
    transferFileMoveError, transferFileCopyError,
    transferFolderMoveError, transferFolderCopyError,
    onChange, onClose, onSubmit,
  } = props
  if (!dialog) return null
  const t = dialog
  const resourceLabel =
    t.resource.type === 'folder' ? t.resource.folder.name : t.resource.file.name
  const resourceKind = t.resource.type === 'folder' ? 'carpeta' : 'archivo'
  const isRootSelected = t.targetFolderId === null
  const canSubmit =
    !transferIsPending &&
    (t.resource.type === 'file' ||
      !disabledFolderIds.has(t.targetFolderId ?? '__never__'))
  const selectTarget = (folderId: string | null) =>
    onChange({ targetFolderId: folderId, error: '' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t.mode === 'copy' ? 'Copiar' : 'Mover'} {resourceKind}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
              {resourceLabel}
            </p>
          </div>
          <button
            type="button"
            disabled={transferIsPending}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block xs:text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
              Acción (elige antes de confirmar)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['move', 'copy'] as const).map((mode) => {
                const active = t.mode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={transferIsPending}
                    onClick={() => onChange({ mode, error: '' })}
                    className={clsx(
                      'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all',
                      active
                        ? mode === 'move'
                          ? 'bg-brand-600/20 border-brand-500 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100 shadow-sm'
                          : 'bg-amber-500/15 border-amber-500/60 text-amber-800 dark:text-amber-200'
                        : 'border-border hover:bg-surface-secondary text-foreground'
                    )}
                  >
                    {mode === 'move' ? (
                      <>
                        <ArrowRightLeft className="w-4 h-4" />
                        Mover
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </button>
                )
              })}
            </div>
            <div
              className={clsx(
                'mt-3 rounded-md border px-3 py-2 text-xs flex items-start gap-2',
                t.mode === 'move'
                  ? 'bg-brand-500/10 border-brand-500/40 text-brand-800 dark:text-brand-200'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200'
              )}
            >
              <span className="mt-0.5">
                {t.mode === 'move' ? (
                  <ArrowRightLeft className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </span>
              <span className="leading-snug">
                <strong>
                  {t.mode === 'move' ? 'MODO MOVER:' : 'MODO COPIAR:'}
                </strong>{' '}
                {t.mode === 'move'
                  ? `el ${resourceKind} se ELIMINARÁ de su carpeta actual y solo quedará en el destino.`
                  : `se CREARÁ una copia en el destino; el ${resourceKind} original permanece intacto.`}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-muted-foreground font-medium">
                Carpeta destino
              </label>
              <span className="text-[11px] text-muted-foreground">
                {t.resource.type === 'folder' &&
                  '(carpeta propia y subcarpetas deshabilitadas)'}
              </span>
            </div>
            <div className="border border-border rounded-lg p-2 bg-surface-secondary/30 space-y-0.5 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => selectTarget(null)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors',
                  isRootSelected
                    ? 'bg-brand-600/15 ring-1 ring-brand-500/60 text-foreground'
                    : 'text-foreground hover:bg-surface-secondary'
                )}
              >
                <FolderKanban className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                <span className="truncate font-medium">Raíz del proyecto</span>
              </button>
              {folderTree.length > 0 ? (
                folderTree.map((r) => (
                  <TransferTargetTreeItem
                    key={r.id}
                    node={r}
                    depth={0}
                    disabledFolderIds={disabledFolderIds}
                    selectedTargetFolderId={t.targetFolderId}
                    onSelect={(id) => selectTarget(id)}
                  />
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No hay otras carpetas en el proyecto
                </div>
              )}
            </div>
          </div>

          {!!(t.error ||
            transferFileMoveError ||
            transferFileCopyError ||
            transferFolderMoveError ||
            transferFolderCopyError) && (
            <div className="text-xs rounded-md p-2.5 bg-status-blocked/15 border border-status-blocked/40 text-destructive/90">
              {(() => {
                const msg: string =
                  t.error ||
                  (transferFileMoveError instanceof Error
                    ? transferFileMoveError.message
                    : '') ||
                  (transferFileCopyError instanceof Error
                    ? transferFileCopyError.message
                    : '') ||
                  (transferFolderMoveError instanceof Error
                    ? transferFolderMoveError.message
                    : '') ||
                  (transferFolderCopyError instanceof Error
                    ? transferFolderCopyError.message
                    : '') ||
                  'Error desconocido'
                return msg
              })()}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface-secondary/40">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={transferIsPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={clsx(
              'text-sm font-semibold',
              t.mode === 'move' ? 'btn-primary' : 'btn-secondary'
            )}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {transferIsPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.mode === 'copy' ? 'Copiando…' : 'Moviendo…'}
              </>
            ) : (
              <>
                {t.mode === 'move' ? (
                  <ArrowRightLeft className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {t.mode === 'copy'
                  ? 'Confirmar copia'
                  : 'Confirmar movimiento'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
