import { ShieldAlert, Check, Loader2, X, Folder, File } from 'lucide-react'
import clsx from 'clsx'
import type { ApiFile } from '@/services/files.service'
import type { FolderNode } from '@/services/folders.service'
import { formatRelativeTime } from '@/services/projects.service'
import {
  MasterFolderTreeItem,
} from './FolderTreeItem'
import {
  colorForKind,
  iconForKind,
} from './fileHelpers'
import { fileKind, formatBytes } from '@/services/files.service'

/* ================================================================
   MasterSelectorModal
   ================================================================ */
export type MasterSelectorModalProps = {
  open: boolean
  project: unknown | null | undefined
  masterSelectorTab: 'folders' | 'files'
  setMasterSelectorTab: (v: 'folders' | 'files') => void
  masterSelectedFolderId: string | null
  setMasterSelectedFolderId: (v: string | null) => void
  masterSelectedFileId: string | null
  setMasterSelectedFileId: (v: string | null) => void
  folderTree: FolderNode[]
  filesIsLoading: boolean
  filesItems: ApiFile[] | undefined
  designatePending: boolean
  onClose: () => void
  onSubmit: () => void
}

export function MasterSelectorModal(props: MasterSelectorModalProps) {
  const {
    open,
    project,
    masterSelectorTab,
    setMasterSelectorTab,
    masterSelectedFolderId,
    setMasterSelectedFolderId,
    masterSelectedFileId,
    setMasterSelectedFileId,
    folderTree,
    filesIsLoading,
    filesItems,
    designatePending,
    onClose,
    onSubmit,
  } = props
  if (!open || !project) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!designatePending) onClose()
      }}
    >
      <div
        className="card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Designar documento maestro</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecciona la carpeta o archivo que actuará como punto de entrada principal del proyecto.
            </p>
          </div>
          <button
            type="button"
            disabled={designatePending}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-border bg-surface-secondary/40 px-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMasterSelectorTab('folders')
              setMasterSelectedFileId(null)
            }}
            className={clsx(
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
              masterSelectorTab === 'folders'
                ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              Carpetas
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMasterSelectorTab('files')
              setMasterSelectedFolderId(null)
            }}
            className={clsx(
              'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
              masterSelectorTab === 'files'
                ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <File className="w-3.5 h-3.5" />
              Archivos
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {masterSelectorTab === 'folders' ? (
            <div className="space-y-0.5">
              {folderTree.length > 0 ? (
                folderTree.map((r) => (
                  <MasterFolderTreeItem
                    key={r.id}
                    node={r}
                    depth={0}
                    selectedFolderId={masterSelectedFolderId}
                    onSelect={(id) => setMasterSelectedFolderId(id)}
                  />
                ))
              ) : (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                  <Folder className="w-5 h-5 opacity-40 mx-auto mb-2" />
                  El proyecto aún no tiene carpetas creadas. Crea una primero o designa un archivo.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filesIsLoading ? (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                  Cargando archivos…
                </div>
              ) : !filesItems?.length ? (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                  No hay archivos en la ubicación actual. Puedes cambiar la carpeta seleccionada en la pestaña Documentos para ver más.
                </div>
              ) : (
                filesItems.map((f) => {
                  const KindIcon = iconForKind(fileKind(f))
                  const sel = masterSelectedFileId === f.id
                  return (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => setMasterSelectedFileId(f.id)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors',
                        sel ? 'bg-brand-600/15 ring-1 ring-brand-500/60 text-foreground' : 'text-foreground hover:bg-surface-secondary'
                      )}
                    >
                      <div className={clsx('w-8 h-8 rounded-md flex items-center justify-center shrink-0', colorForKind(fileKind(f)))}>
                        <KindIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {typeof f.sizeBytes === 'number' ? formatBytes(f.sizeBytes) : 'Sin tamaño'} · {formatRelativeTime(f.updatedAt ?? f.createdAt)}
                        </p>
                      </div>
                      {sel && (
                        <Check className="w-4 h-4 ml-2 text-brand-600 dark:text-brand-300 shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface-secondary/40 flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={designatePending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={
              designatePending ||
              (masterSelectorTab === 'folders' && !masterSelectedFolderId) ||
              (masterSelectorTab === 'files' && !masterSelectedFileId)
            }
            onClick={onSubmit}
          >
            {designatePending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Designando…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Designar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   ConfirmClearMasterDialog
   ================================================================ */
export type ConfirmClearMasterDialogProps = {
  open: boolean
  mutationPending: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmClearMasterDialog(props: ConfirmClearMasterDialogProps) {
  const { open, mutationPending, onClose, onConfirm } = props
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!mutationPending) onClose()
      }}
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-status-blocked/15 flex items-center justify-center shrink-0 ring-1 ring-black/5">
              <ShieldAlert className="w-5 h-5 text-status-blocked" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">Quitar documento maestro</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Esta acción desvincula el documento o carpeta actualmente designada como maestro del proyecto.
                El contenido no se eliminará, solo deja de estar marcado como principal.
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
            className="btn-ghost text-sm text-status-blocked hover:bg-status-blocked/10 hover:text-status-blocked"
            onClick={onConfirm}
            disabled={mutationPending}
          >
            {mutationPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Quitando…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Sí, quitar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
