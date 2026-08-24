import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import {
  ApiProject,
  fetchProjects,
  statusBadgeInfo,
} from '../services/projects.service'

function ProjectCardSkeleton() {
  return (
    <div className="p-3 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="h-4 w-48 bg-surface-secondary rounded animate-pulse" />
        <div className="h-4 w-20 bg-surface-secondary rounded-full animate-pulse shrink-0" />
      </div>
      <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden mb-2" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-surface-secondary rounded animate-pulse" />
        <div className="h-3 w-10 bg-surface-secondary rounded animate-pulse" />
      </div>
    </div>
  )
}

function ProjectCard({ p, onClick }: { p: ApiProject; onClick: () => void }) {
  const badge = statusBadgeInfo(p.status)
  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg hover:bg-surface-secondary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-foreground truncate pr-2">{p.name}</p>
        <span
          className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full shrink-0',
            badge.bgClass,
            badge.textClass,
          )}
        >
          {badge.label}
        </span>
      </div>
      <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden mb-2">
        <div
          className={clsx('h-full rounded-full', badge.gradient.includes('brand') ? 'bg-brand-500' : `bg-gradient-to-r ${badge.gradient}`)}
          style={{ width: `${Math.max(0, Math.min(100, p.progress ?? 0))}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{p.membersCount || 0} participantes</span>
        <span>{Math.max(0, Math.min(100, p.progress ?? 0))}%</span>
      </div>
    </div>
  )
}

function DashboardPage() {
  const navigate = useNavigate()

  const featuredQuery = useQuery({
    queryKey: ['projects', { destacados: true, pageSize: 4 }],
    queryFn: () =>
      fetchProjects({ destacados: true, pageSize: 4 }),
    staleTime: 60_000,
    retry: 1,
  })

  const featuredIsLoading = featuredQuery.isLoading && featuredQuery.fetchStatus !== 'idle'
  const featuredItems = featuredQuery.data?.items ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de control</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen de la actividad en tu organización</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1">
          <header className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-500 dark:text-brand-400" />
              Proyectos destacados
            </h2>
          </header>
          <div className="p-3 space-y-2">
            {featuredQuery.isError ? (
              <div className="p-3 text-center text-sm text-destructive/90">
                No se pudieron cargar los proyectos.
              </div>
            ) : featuredIsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <ProjectCardSkeleton key={`sk-pr-${i}`} />)
            ) : featuredItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Aún no hay proyectos destacados. Crea el primero desde el panel lateral.
              </div>
            ) : (
              featuredItems.map((p) => (
                <ProjectCard
                  key={`pr-${p.id}`}
                  p={p}
                  onClick={() => navigate(`/projects/${p.id}`)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
