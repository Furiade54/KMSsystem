import { Bell, Moon, PanelLeftClose, PanelRightClose, Search, Sun, Monitor } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUIStore, ThemeMode } from '../../store/uiStore'

export default function Topbar() {
  const { leftSidebarOpen, rightPanelOpen, toggleLeftSidebar, toggleRightPanel, themeMode, toggleTheme } = useUIStore()
  const navigate = useNavigate()
  const location = useLocation()
  const searchInput = useRef<HTMLInputElement>(null)
  const submitTimer = useRef<number | null>(null)
  const [searchValue, setSearchValue] = useState('')

  const themeTitleByMode: Record<ThemeMode, string> = {
    light: 'Tema claro (cambiar: claro → oscuro → sistema)',
    dark: 'Tema oscuro (cambiar: oscuro → sistema → claro)',
    system: 'Tema del sistema (cambiar: sistema → claro → oscuro)',
  }

  const ThemeIcon = themeMode === 'dark' ? Moon : themeMode === 'light' ? Sun : Monitor

  useEffect(() => {
    if (submitTimer.current) window.clearTimeout(submitTimer.current)
    if (!searchValue.trim()) return
    submitTimer.current = window.setTimeout(() => {
      const v = searchValue.trim()
      if (v.length >= 2) {
        navigate(`/search?q=${encodeURIComponent(v)}`)
      }
    }, 400)
    return () => {
      if (submitTimer.current) window.clearTimeout(submitTimer.current)
    }
  }, [searchValue, navigate])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const v = searchValue.trim()
    if (v.length < 2) return
    if (submitTimer.current) window.clearTimeout(submitTimer.current)
    navigate(`/search?q=${encodeURIComponent(v)}`)
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-50 border-b border-border bg-surface/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLeftSidebar}
            className="btn-icon"
            title={leftSidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
            aria-label="Alternar panel lateral izquierdo"
          >
            {leftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4 rotate-180" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
              K
            </div>
            <span className="font-semibold text-foreground hidden sm:inline">KMS</span>
          </div>
          <form onSubmit={submitSearch} className="ml-4 relative hidden md:block w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInput}
              type="text"
              placeholder="Buscar en documentos, proyectos, usuarios, comentarios... (Enter)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
            />
          </form>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggleTheme}
            className="btn-icon"
            title={themeTitleByMode[themeMode]}
            aria-label={`Cambiar tema: ${themeMode}`}
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
          <Link
            to="/activity"
            className={`btn-icon relative transition hover:bg-surface-secondary ${location.pathname === '/activity' ? 'bg-surface-secondary text-foreground' : ''}`}
            title="Notificaciones y actividad reciente"
            aria-label="Ver notificaciones (ir a Actividad reciente)"
          >
            <Bell className="w-4 h-4" />
          </Link>
          <button onClick={toggleRightPanel} className="btn-icon" title={rightPanelOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'} aria-label="Alternar panel derecho">
            {rightPanelOpen ? <PanelRightClose className="w-4 h-4 rotate-180" /> : <PanelRightClose className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
