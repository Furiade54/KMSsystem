import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  UserCircle2,
  ChevronRight,
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
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
  const [pwdCopiedNew, setPwdCopiedNew] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  function generateRandomPwd(length = 14) {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*'
    const values = new Uint32Array(length)
    globalThis.crypto.getRandomValues(values)
    let out = ''
    for (let i = 0; i < length; i++) out += alphabet[values[i] % alphabet.length]
    return out
  }

  const pwdStrength = useMemo(() => {
    const p = pwdNew
    if (!p) return { score: 0, label: '', color: '', segmentColors: ['', '', '', ''] }
    let score = 0
    if (p.length >= 6) score++
    if (p.length >= 10) score++
    if (/[A-Z]/.test(p) || /[!@#$%&*]/.test(p)) score++
    if (/[0-9]/.test(p) && (/[A-Z]/.test(p) || /[a-z]/.test(p) && /[!@#$%&*]/.test(p))) score++
    const maps: Record<number, { label: string; color: string; segmentColors: string[] }> = {
      0: { label: 'Vacía', color: 'text-muted-foreground', segmentColors: ['bg-border', 'bg-border', 'bg-border', 'bg-border'] },
      1: { label: 'Débil', color: 'text-destructive', segmentColors: ['bg-destructive', 'bg-border', 'bg-border', 'bg-border'] },
      2: { label: 'Media', color: 'text-amber-600 dark:text-amber-300', segmentColors: ['bg-destructive', 'bg-amber-500', 'bg-border', 'bg-border'] },
      3: { label: 'Buena', color: 'text-sky-600 dark:text-sky-300', segmentColors: ['bg-destructive', 'bg-amber-500', 'bg-sky-500', 'bg-border'] },
      4: { label: 'Excelente', color: 'text-status-approved', segmentColors: ['bg-destructive', 'bg-amber-500', 'bg-sky-500', 'bg-status-approved'] },
    }
    return maps[score]
  }, [pwdNew])

  const pwdChecks = useMemo(() => {
    return [
      { id: 'len', label: 'Mínimo 6 caracteres', pass: pwdNew.length >= 6 },
      { id: 'diff', label: 'Diferente a la actual', pass: !!pwdNew && pwdCurrent !== pwdNew },
      { id: 'upper', label: 'Contiene mayúscula o símbolo', pass: /[A-Z]/.test(pwdNew) || /[!@#$%&*]/.test(pwdNew) },
      { id: 'num', label: 'Contiene un número', pass: /[0-9]/.test(pwdNew) },
      { id: 'match', label: 'Confirmación coincide', pass: !!pwdNew && pwdNew === pwdConfirm },
    ]
  }, [pwdCurrent, pwdNew, pwdConfirm])

  useEffect(() => {
    if (!userMenuOpen) return
    function onDocClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [userMenuOpen])

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
    setPwdCopiedNew(false)
  }

  async function copyNewPwd() {
    if (!pwdNew) return
    try {
      await navigator.clipboard.writeText(pwdNew)
      setPwdCopiedNew(true)
      setTimeout(() => setPwdCopiedNew(false), 1400)
    } catch {
      /* noop */
    }
  }

  function generateAndFillPwd() {
    const p = generateRandomPwd(14)
    setPwdNew(p)
    setPwdConfirm(p)
    setPwdShowNew(true)
    setPwdShowConfirm(true)
    setPwdFieldError(null)
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
        <div className="px-2 py-2" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((s) => !s)}
            className={clsx(
              'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors group',
              'text-left',
              userMenuOpen
                ? 'bg-surface-tertiary/40 ring-1 ring-brand-500/30'
                : 'hover:bg-surface-tertiary/40',
            )}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label="Menú del usuario"
          >
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
            <ChevronRight
              className={clsx(
                'w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                userMenuOpen && 'rotate-90 text-brand-500',
              )}
            />
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              className="mt-2 mb-1 rounded-lg border border-border bg-surface shadow-xl ring-1 ring-black/5 overflow-hidden animate-in fade-in slide-in-from-bottom-1"
            >
              <button
                type="button"
                role="menuitem"
                disabled
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground/70 bg-surface-secondary/40 border-b border-border/70 opacity-80 cursor-not-allowed"
                title="Próximamente: Mi perfil"
              >
                <UserCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">Mi perfil</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1.5 py-0.5 rounded bg-surface-tertiary/60">
                  pronto
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false)
                  setPwdModalOpen(true)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-brand-500/10 hover:text-brand-700 dark:hover:text-brand-200 transition-colors border-b border-border/70"
              >
                <Key className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">Cambiar mi contraseña</span>
                <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/60" />
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false)
                  handleLogout()
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">Cerrar sesión</span>
                <ChevronRight className="w-3 h-3 shrink-0 text-destructive/60" />
              </button>
            </div>
          )}
        </div>
      </footer>

      {pwdModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[60] bg-black/55 flex items-start sm:items-center justify-center p-4 overflow-y-auto backdrop-blur-[2px]"
          onClick={closePwdModal}
        >
          <div
            className="w-full max-w-[480px] my-8 bg-surface rounded-2xl shadow-2xl ring-1 ring-border overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-brand-500/10 via-transparent to-accent-500/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-500/15 text-brand-700 dark:text-brand-200 flex items-center justify-center ring-1 ring-brand-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">
                    Cambiar mi contraseña
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Solo tu puedes realizar este cambio — nadie más la ve.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePwdModal}
                disabled={pwdMutation.isPending}
                className="btn-icon text-muted-foreground hover:text-foreground hover:bg-surface-tertiary/60 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground/85">
                  Contraseña actual
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={pwdShowCurrent ? 'text' : 'password'}
                    className="input-base pr-11 text-sm h-10"
                    value={pwdCurrent}
                    disabled={pwdMutation.isPending}
                    onChange={(e) => {
                      setPwdCurrent(e.target.value)
                      setPwdFieldError(null)
                    }}
                    placeholder="Escribe la contraseña que usas para entrar"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowCurrent((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground focus:outline-none"
                    tabIndex={-1}
                    aria-label={pwdShowCurrent ? 'Ocultar' : 'Mostrar'}
                  >
                    {pwdShowCurrent ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-foreground/85">
                    Nueva contraseña
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={generateAndFillPwd}
                      disabled={pwdMutation.isPending}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-brand-700 dark:text-brand-300 bg-brand-500/10 hover:bg-brand-500/15 disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Generar
                    </button>
                    <button
                      type="button"
                      onClick={copyNewPwd}
                      disabled={pwdMutation.isPending || !pwdNew}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-foreground/80 bg-surface-tertiary/40 hover:bg-surface-tertiary/70 disabled:opacity-40"
                      aria-label="Copiar nueva contraseña"
                    >
                      {pwdCopiedNew ? (
                        <>
                          <Check className="w-3 h-3 text-status-approved" />
                          Copiada
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={pwdShowNew ? 'text' : 'password'}
                    className="input-base pr-11 text-sm h-10"
                    value={pwdNew}
                    disabled={pwdMutation.isPending}
                    onChange={(e) => {
                      setPwdNew(e.target.value)
                      setPwdFieldError(null)
                    }}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowNew((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground focus:outline-none"
                    tabIndex={-1}
                    aria-label={pwdShowNew ? 'Ocultar' : 'Mostrar'}
                  >
                    {pwdShowNew ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden grid grid-cols-4 gap-0.5">
                    {pwdStrength.segmentColors.map((cls, i) => (
                      <div
                        key={i}
                        className={clsx(
                          'h-full rounded-full transition-colors duration-300',
                          cls || 'bg-border',
                        )}
                      />
                    ))}
                  </div>
                  {pwdStrength.label && (
                    <span
                      className={clsx(
                        'text-[11px] font-semibold shrink-0',
                        pwdStrength.color,
                      )}
                    >
                      {pwdStrength.label}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground/85">
                  Confirmar nueva contraseña
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={pwdShowConfirm ? 'text' : 'password'}
                    className="input-base pr-11 text-sm h-10"
                    value={pwdConfirm}
                    disabled={pwdMutation.isPending}
                    onChange={(e) => {
                      setPwdConfirm(e.target.value)
                      setPwdFieldError(null)
                    }}
                    placeholder="Repite la nueva contraseña"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowConfirm((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground focus:outline-none"
                    tabIndex={-1}
                    aria-label={pwdShowConfirm ? 'Ocultar' : 'Mostrar'}
                  >
                    {pwdShowConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-1 px-0.5">
                {pwdChecks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-1.5 text-[11px]"
                  >
                    {c.pass ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-status-approved" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                    )}
                    <span
                      className={clsx(
                        c.pass
                          ? 'text-foreground/80'
                          : 'text-muted-foreground/80',
                      )}
                    >
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>

              {pwdFieldError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-start gap-2">
                  <X className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{pwdFieldError}</span>
                </div>
              )}
              {pwdSuccess && (
                <div className="rounded-lg border border-status-approved/40 bg-status-approved/10 px-3.5 py-2.5 text-xs text-status-approved flex items-start gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{pwdSuccess}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-border bg-surface-secondary/30">
              <button
                type="button"
                onClick={closePwdModal}
                className="btn-secondary text-sm h-9 px-4 min-w-[110px]"
                disabled={pwdMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitChangePwd}
                className="btn-primary text-sm h-9 px-4 inline-flex items-center gap-2 min-w-[180px] justify-center"
                disabled={pwdMutation.isPending}
              >
                {pwdMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {pwdMutation.isPending ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default Sidebar
