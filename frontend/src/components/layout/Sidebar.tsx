import { NavLink, useNavigate } from 'react-router-dom'
import {
  Building2,
  FolderKanban,
  Star,
  Clock,
  FileText,
  Users,
  BellRing,
  Trash2,
  Plus,
  ChevronDown,
  Loader2,
  LogOut,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { fetchProjects, projectColorClass } from '../../services/projects.service'
import { fetchRequestCount } from '../../services/requests.service'
import { useAuthStore } from '../../store/authStore'

const navItems: Array<{
  to: string
  label: string
  icon: typeof Building2
  badge?: number
  dynamicBadge?: true
}> = [
  { to: '/dashboard', label: 'Panel de control', icon: Building2 },
  { to: '/projects', label: 'Mis proyectos', icon: FolderKanban },
  { to: '/favorites', label: 'Favoritos', icon: Star },
  { to: '/activity', label: 'Actividad reciente', icon: Clock },
  { to: '/documents', label: 'Mis documentos', icon: FileText },
  { to: '/teams', label: 'Equipos', icon: Users },
  { to: '/requests', label: 'Solicitudes', icon: BellRing, dynamicBadge: true },
  { to: '/trash', label: 'Papelera', icon: Trash2 },
]

function Sidebar() {
  const recentQuery = useQuery({
    queryKey: ['projects', 'recent'],
    queryFn: () => fetchProjects({ recent: true, pageSize: 3 }),
    staleTime: 3 * 60_000,
    retry: 1,
  })
  const requestsCountQuery = useQuery({
    queryKey: ['requests', 'count'],
    queryFn: fetchRequestCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })
  const projects = recentQuery.data?.items ?? []
  const isLoading = recentQuery.isLoading && recentQuery.fetchStatus !== 'idle'

  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const avatarInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n: string) => n[0]?.toUpperCase() ?? '')
        .join('')
    : user?.email?.slice(0, 2)?.toUpperCase() ?? '??'

  const displayName = user?.fullName || user?.email || 'Usuario'
  const displayEmail = user?.email || ''

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="h-full w-64 flex flex-col overflow-hidden">
      <nav className="flex-1 min-h-0 w-full p-3 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
        <NavLink
          to="/projects?new=1"
          className="btn-primary w-full mb-2 text-sm flex items-center justify-center gap-2 no-underline"
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </NavLink>

        <div className="space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, badge, dynamicBadge }) => {
            const badgeValue = dynamicBadge ? requestsCountQuery.data?.pendingReceived ?? 0 : badge ?? 0
            const showBadge = dynamicBadge ? requestsCountQuery.isSuccess && badgeValue > 0 : !!badge
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx('sidebar-item text-sm', isActive && 'sidebar-item-active')
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {showBadge && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-status-blocked text-white min-w-[20px] inline-flex items-center justify-center">
                    {badgeValue}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <button className="sidebar-item w-full text-sm font-medium text-gray-400 hover:text-gray-200 mb-2">
            <FolderKanban className="w-4 h-4" />
            <span className="flex-1 text-left">Proyectos recientes</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="space-y-0.5 pl-2 min-h-[3rem]">
            {isLoading ? (
              <div className="sidebar-item text-sm justify-center text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Cargando…</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="sidebar-item text-sm justify-start text-gray-500 text-xs">
                Sin proyectos recientes
              </div>
            ) : (
              projects.map((p) => (
                <NavLink
                  key={p.id}
                  to={`/projects/${p.id}`}
                  title={p.name}
                  className={({ isActive }) =>
                    clsx('sidebar-item text-sm', isActive && 'sidebar-item-active')
                  }
                >
                  <span className={clsx('w-2 h-2 rounded-full shrink-0', projectColorClass(p.color))} />
                  <span className="flex-1 truncate text-xs">{p.name}</span>
                </NavLink>
              ))
            )}
          </div>
        </div>
      </nav>

      <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="px-2 py-2 flex items-center gap-2">
          <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-sm font-semibold ring-1 ring-surface-tertiary/30">
            {avatarInitials}
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-xs font-medium text-foreground truncate" title={displayName}>
              {displayName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate" title={displayEmail}>
              {displayEmail}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="btn-icon text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  )
}

export default Sidebar
