import { CheckCircle2, XCircle, X } from 'lucide-react'
import clsx from 'clsx'

export type ProjectPageToastProps = {
  pageToast: { kind: 'error' | 'success'; title: string; message: string } | null
  onDismiss: () => void
}

export default function ProjectPageToast(props: ProjectPageToastProps) {
  const { pageToast, onDismiss } = props
  if (!pageToast) return null
  return (
    <div className="fixed top-4 right-4 z-[60] max-w-sm w-full">
      <div
        className={clsx(
          'card shadow-lg border flex items-start gap-3 p-4 pr-12 animate-in fade-in slide-in-from-right-4',
          pageToast.kind === 'error'
            ? 'border-status-blocked/40 bg-status-blocked/10'
            : 'border-status-approved/40 bg-status-approved/10'
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className={clsx(
            'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center',
            pageToast.kind === 'error'
              ? 'bg-status-blocked/15 text-status-blocked'
              : 'bg-status-approved/15 text-status-approved'
          )}
        >
          {pageToast.kind === 'error' ? (
            <XCircle className="w-5 h-5" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h4 className="font-semibold text-sm text-foreground">{pageToast.title}</h4>
          <p className="text-xs text-muted-foreground dark:text-slate-300 mt-1 break-words">
            {pageToast.message}
          </p>
        </div>
        <button
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground"
          onClick={onDismiss}
          aria-label="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
