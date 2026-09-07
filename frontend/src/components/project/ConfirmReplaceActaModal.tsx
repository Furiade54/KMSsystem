import { AlertTriangle, Upload, Unlink } from 'lucide-react'
import type { ApiFile } from '@/services/files.service'

export type ConfirmReplaceActaModalProps = {
  open: boolean
  previousFile: ApiFile | null
  previousFileId: string | null
  pending?: boolean
  onClose: () => void
  onConfirmReplace: () => void
  onUnlinkFirst: () => void
}

export default function ConfirmReplaceActaModal(props: ConfirmReplaceActaModalProps) {
  const {
    open,
    previousFile,
    previousFileId,
    pending = false,
    onClose,
    onConfirmReplace,
    onUnlinkFirst,
  } = props
  if (!open) return null
  const label = previousFile
    ? previousFile.name
    : previousFileId
      ? `ID ${String(previousFileId).slice(0, 8)}…`
      : 'anterior'
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4 border-b border-border bg-surface-secondary/40">
          <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/15 ring-1 ring-amber-500/40 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">
              Esta reunión ya tiene un acta vinculada
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              Acta actual:{' '}
              <span className="font-medium text-foreground">{label}</span>
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-secondary disabled:opacity-50"
            disabled={pending}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-foreground">
            ¿Cómo querés proceder con el nuevo archivo que estás por subir?
          </p>

          <div className="space-y-2">
            <button
              type="button"
              className="w-full text-left rounded-lg border border-brand-500/50 bg-brand-500/10 dark:bg-brand-500/15 px-3.5 py-3 hover:bg-brand-500/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onConfirmReplace}
              disabled={pending}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center bg-brand-500 text-white">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-brand-800 dark:text-brand-100">
                      Reemplazar (sugerido)
                    </span>
                    <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-brand-500/15 ring-1 ring-brand-500/40 text-brand-700 dark:text-brand-200 uppercase tracking-wide font-semibold">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[12.5px] mt-1 text-brand-900/80 dark:text-brand-100/85 leading-snug">
                    Sube el nuevo acta, la vincula a la reunión y <strong>elimina el acta anterior automáticamente</strong>.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              className="w-full text-left rounded-lg border border-border hover:bg-surface-secondary/60 px-3.5 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onUnlinkFirst}
              disabled={pending}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40">
                  <Unlink className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground">
                    Guardar ambas versiones
                  </span>
                  <p className="text-[12.5px] mt-1 text-muted-foreground leading-snug">
                    Primero <strong>desvincula el acta actual</strong> (queda en Documentos), después volvé a hacer clic en Subir acta. La subida de ahora se cancela.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              className="w-full text-left rounded-lg border border-transparent hover:bg-surface-secondary/40 px-3.5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onClose}
              disabled={pending}
            >
              <div className="text-sm text-muted-foreground">
                Cancelar · no subir el nuevo acta.
              </div>
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border bg-surface-secondary/40 text-[11.5px] text-muted-foreground leading-relaxed">
          Consejo: si usás Google Drive / OneDrive, descargá la última versión de tu acta local y re-emplazá acá para mantener 1 solo archivo linked por reunión.
        </div>
      </div>
    </div>
  )
}
