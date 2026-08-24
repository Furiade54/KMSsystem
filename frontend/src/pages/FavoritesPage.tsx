import { Star, FolderKanban, FileText } from 'lucide-react'

function FavoritesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Favoritos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tus recursos marcados con ⭐
          </p>
        </div>
      </div>

      <div className="card p-16 text-center space-y-5">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-3xl bg-status-review/15 blur-xl" />
          <div className="relative w-20 h-20 rounded-3xl bg-surface-secondary ring-1 ring-status-review/30 flex items-center justify-center">
            <Star className="w-10 h-10 text-status-review" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            Aún no tienes elementos favoritos
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Marca proyectos, carpetas y documentos con ⭐ para acceder rápidamente
            a ellos desde aquí. Esta característica estará disponible en una
            próxima actualización.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-secondary/60 border border-border text-xs text-muted-foreground">
            <FolderKanban className="w-4 h-4 text-brand-500 dark:text-brand-400" />
            Proyectos
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-secondary/60 border border-border text-xs text-muted-foreground">
            <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            Documentos
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-secondary/60 border border-border text-xs text-muted-foreground">
            <Star className="w-4 h-4 text-status-review" />
            Próximamente
          </div>
        </div>
      </div>
    </div>
  )
}

export default FavoritesPage
