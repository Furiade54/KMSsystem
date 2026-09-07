import { Compass, FileCheck2, File, Folder, Loader2, X } from 'lucide-react'
import type { ProjectMasterDocInfo } from '@/services/projects.service'
import { formatRelativeTime } from '@/services/projects.service'
import { formatBytes } from '@/services/files.service'

export type ProjectMasterTabProps = {
  documentoMaestro: ProjectMasterDocInfo | null
  canAdminMaster: boolean
  clearMasterMutationPending: boolean
  onOpenMasterResource: (master: ProjectMasterDocInfo) => void
  onOpenDesignateMasterModal: () => void
  onClearMaster: () => void
}

export default function ProjectMasterTab({
  documentoMaestro,
  canAdminMaster,
  clearMasterMutationPending,
  onOpenMasterResource,
  onOpenDesignateMasterModal,
  onClearMaster,
}: ProjectMasterTabProps) {
  const hasMaster = Boolean(documentoMaestro)
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {hasMaster && documentoMaestro ? (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-border bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent dark:from-brand-500/20 dark:via-brand-500/10">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg bg-brand-500/25 flex items-center justify-center shrink-0 ring-1 ring-black/5">
                  <FileCheck2 className="w-5 h-5 text-brand-600 dark:text-brand-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-brand-600 dark:text-brand-300">
                      Documento maestro designado
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground ring-1 ring-black/5">
                      {documentoMaestro.resourceType === 'FOLDER' ? <Folder className="w-3 h-3" /> : <File className="w-3 h-3" />}
                      {documentoMaestro.resourceType === 'FOLDER' ? 'Carpeta' : 'Archivo'}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-[17px] font-semibold text-foreground truncate" title={documentoMaestro.name}>
                    {documentoMaestro.name}
                  </h2>
                  {documentoMaestro.path && documentoMaestro.path !== '/' && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate" title={documentoMaestro.path}>
                      /{documentoMaestro.path}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">Actualizado</p>
                <p className="text-foreground font-medium">
                  {documentoMaestro.lastUpdatedAt ? formatRelativeTime(documentoMaestro.lastUpdatedAt) : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Propietario</p>
                <p className="text-foreground font-medium truncate" title={documentoMaestro.ownerName || ''}>
                  {documentoMaestro.ownerName || '—'}
                </p>
              </div>
              {documentoMaestro.resourceType === 'FILE' ? (
                <div>
                  <p className="text-muted-foreground mb-0.5">Tamaño</p>
                  <p className="text-foreground font-medium">
                    {typeof documentoMaestro.size === 'number' ? formatBytes(documentoMaestro.size) : '—'}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-0.5">Tipo</p>
                  <p className="text-foreground font-medium">Espacio maestro</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-0.5">Identificador</p>
                <p className="text-foreground font-mono text-[11px] truncate" title={documentoMaestro.resourceId}>
                  {String(documentoMaestro.resourceId).slice(0, 8)}…
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-surface-secondary/30">
              <button
                type="button"
                onClick={() => onOpenMasterResource(documentoMaestro)}
                className="btn-secondary text-sm"
              >
                <Compass className="w-4 h-4" />
                Abrir
              </button>
              {canAdminMaster && (
                <button
                  type="button"
                  onClick={onClearMaster}
                  disabled={clearMasterMutationPending}
                  className="btn-ghost text-sm text-status-blocked hover:bg-status-blocked/10 hover:text-status-blocked"
                >
                  {clearMasterMutationPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Quitando…
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Quitar designación
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden text-center">
            <div className="p-8">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center mb-4 ring-1 ring-black/5">
                <FileCheck2 className="w-7 h-7 opacity-50" />
              </div>
              <h2 className="text-[17px] font-semibold text-foreground">
                Sin documento maestro
              </h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                Designa una carpeta o archivo como el punto de entrada principal del proyecto.
                El contenido aparecerá destacado y podrá abrirse directamente desde aquí.
              </p>
            </div>
            {canAdminMaster && (
              <div className="p-4 border-t border-border bg-surface-secondary/40 flex items-center justify-center">
                <button
                  type="button"
                  onClick={onOpenDesignateMasterModal}
                  className="btn-primary text-sm"
                >
                  <FileCheck2 className="w-4 h-4" />
                  Designar documento maestro
                </button>
              </div>
            )}
            {!canAdminMaster && (
              <div className="p-4 border-t border-border bg-surface-secondary/20 text-xs text-muted-foreground">
                Solo el propietario del proyecto o un administrador puede designar el documento maestro.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
