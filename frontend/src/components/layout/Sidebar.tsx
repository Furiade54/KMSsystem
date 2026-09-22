import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Building2,
  FolderKanban,
  Star,
  Clock,
  FileText,
  Users,
  Shield,
  BellRing,
  Trash2,
  Plus,
  ChevronDown,
  Loader2,
  LogOut,
  Landmark,
  ShieldPlus,
  Key,
  Eye,
  EyeOff,
  X,
  Check,
  Lock,
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { fetchProjects, projectColorClass } from '../../services/projects.service'
import { fetchRequestCount } from '../../services/requests.service'
import { useAuthStore } from '../../store/authStore'
import { changeMyPassword, extractUserError } from '../../services/users.service'

const navItems: Array<{
  to: string
  label: string
  icon: typeof Building2
  badge?: number
  dynamicBadge?: true
  adminOnly?: boolean
}> = [
  { to: '/dashboard', label: 'Panel de control', icon: Building2 },
  { to: '/projects', label: 'Mis proyectos', icon: FolderKanban },
  { to: '/favorites', label: 'Favoritos', icon: Star },
  { to: '/activity', label: 'Actividad reciente', icon: Clock },
  { to: '/documents', label: 'Mis documentos', icon: FileText },
  { to: '/teams', label: 'Equipos', icon: Users },
  { to: '/organizations/me', label: 'Mi organización', icon: Building2 },
  { to: '/organizations', label: 'Organizaciones', icon: Landmark, adminOnly: true },
  { to: '/roles', label: 'Roles y permisos', icon: ShieldPlus, adminOnly: true },
  { to: '/users', label: 'Usuarios', icon: Shield, adminOnly: true },
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
  const isOrgAdmin = !!user?.isOrgAdmin

  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdShowCurrent, setPwdShowCurrent] = useState(false)
  const [pwdShowNew, setPwdShowNew] = useState(false)
  const [pwdShowConfirm, setPwdShowConfirm] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null)
  const [pwdFieldError, setPwdFieldError] = useState<string | null>(null)

  const pwdMutation = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) =>
      changeMyPassword(payload),
    onSuccess: () => {
      setPwdSuccess('Contraseña actualizada. Cerrando…')
      setTimeout(() => {
        setPwdModalOpen(false)
        setPwdSuccess(null)
        setPwdCurrent('')
        setPwdNew('')
        setPwdConfirm('')
        setPwdShowCurrent(false)
        setPwdShowNew(false)
        setPwdShowConfirm(false)
      }, 1200)
    },
    onError: (err: any) => {
      setPwdFieldError(extractUserError(err, 'No se pudo actualizar la contraseña'))
    },
  })

  const submitChangePwd = () => {
    setPwdFieldError(null)
    if (!pwdCurrent.trim()) return setPwdFieldError('Escribe tu contraseña actual')
    if (pwdNew.length < 6) return setPwdFieldError('La nueva contraseña debe tener al menos 6 caracteres')
    if (pwdNew !== pwdConfirm) return setPwdFieldError('La nueva contraseña y la confirmación no coinciden')
    if (pwdCurrent === pwdNew) return setPwdFieldError('La nueva contraseña debe ser diferente a la actual')
    setPwdSuccess(null)
    pwdMutation.mutate({ currentPassword: pwdCurrent, newPassword: pwdNew })
  }

  const closePwdModal = () => {
    if (pwdMutation.isPending) return
    setPwdModalOpen(false)
    setPwdSuccess(null)
    setPwdFieldError(null)
    setPwdCurrent('')
    setPwdNew('')
    setPwdConfirm('')
    setPwdShowCurrent(false)
    setPwdShowNew(false)
    setPwdShowConfirm(false)
  }

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly) return isOrgAdmin
    return true
  })

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
          {visibleNavItems.map(({ to, label, icon: Icon, badge, dynamicBadge }) => {
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
        <div className="px-2 py-1">
          <button
            type="button"
            onClick={() => setPwdModalOpen(true)}
            className="sidebar-item w-full text-xs text-muted-foreground hover:text-foreground"
            title="Cambiar mi contraseña"
          >
            <Key className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Cambiar mi contraseña</span>
          </button>
        </div>
        <div className="px-2 py-2 flex items-center gap-2 border-t border-border">
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

      {pwdModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={closePwdModal}
        >
          <div
            className="w-full max-w-[420px] my-8 bg-surface rounded-xl shadow-xl ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 flex items-center justify-center ring-1 ring-brand-500/20">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">Cambiar mi contraseña</h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Solo tu puedes realizar este cambio
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePwdModal}
                disabled={pwdMutation.isPending}
                className="btn-icon text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-4 space-y-3">
              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Contraseña actual</label>
                <div className="relative mt-1">
                  <input
                    type={pwdShowCurrent ? 'text' : 'password'}
                    className="input-base pr-9 text-sm"
                    value={pwdCurrent}
                    disabled={pwdMutation.isPending}
                    onChange={(e) => { setPwdCurrent(e.target.value); setPwdFieldError(null) }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowCurrent((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-9 text-muted-foreground hover:text-foreground focus:outline-none"
                    tabIndex={-1}
                  >
                    {pwdShowCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Nueva contraseña</label>
                <div className="relative mt-1">
                  <input
                    type={pwdShowNew ? 'text' : 'password'}
                    className="input-base pr-9 text-sm"
                    value={pwdNew}
                    disabled={pwdMutation.isPending}
                    onChange={(e) => { setPwdNew(e.target.value); setPwdFieldError(null) }}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowNew((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-9 text-muted-foreground hover:text-foreground focus:outline-none"
                    tabIndex={-1}
                  >
                    {pwdShowNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-foreground/80">Confirmar nueva contraseña</label>
                <div className="relative mt-1">
                  <input
                    type={pwdShowConfirm ? 'text' : 'password'}
                    className="input-base pr-9 text-sm"
                    value={pwdConfirm}
                    disabled={pwdMutation.isPending}
                    onChange={(e) => { setPwdConfirm(e.target.value); setPwdFieldError(null) }}
                    placeholder="Escribe la misma que arriba"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowConfirm((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-9 text-muted-foreground hover:text-foreground focus:outline-none"
                    tabIndex={-1}
                  >
                    {pwdShowConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {pwdFieldError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive flex items-start gap-2">
                  <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{pwdFieldError}</span>
                </div>
              )}
              {pwdSuccess && (
                <div className="rounded-md border border-status-approved/50 bg-status-approved/10 px-3 py-2 text-[11.5px] text-status-approved flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{pwdSuccess}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface-secondary/30 rounded-b-xl">
              <button
                type="button"
                onClick={closePwdModal}
                className="btn-secondary text-sm h-8 px-3"
                disabled={pwdMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitChangePwd}
                className="btn-primary text-sm h-8 px-3 inline-flex items-center gap-2"
                disabled={pwdMutation.isPending}
              >
                {pwdMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar contraseña
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
