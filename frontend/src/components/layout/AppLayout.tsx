import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAuthStore } from '../../store/authStore'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import ContextPanel from './ContextPanel'
import { useUIStore } from '../../store/uiStore'
import { Loader2 } from 'lucide-react'

export default function AppLayout() {
  const { isAuthenticated, hydrate } = useAuthStore()
  const { leftSidebarOpen, rightPanelOpen, hydrateTheme, hydrateLayout } = useUIStore()
  const [hydrating, setHydrating] = useState(true)

  useEffect(() => {
    let active = true
    hydrate().finally(() => {
      if (active) {
        hydrateTheme()
        hydrateLayout()
        setHydrating(false)
      }
    })
    return () => {
      active = false
    }
  }, [hydrate, hydrateTheme, hydrateLayout])

  if (hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Cargando sesión…
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <Topbar />
      <div className="relative flex-1 w-full min-h-0 overflow-hidden pt-14">
        <aside
          className={`fixed top-14 left-0 bottom-0 z-40 ${
            leftSidebarOpen ? 'w-64' : 'w-0'
          } border-r border-border transition-all duration-300 overflow-hidden bg-surface/80 backdrop-blur-sm`}
        >
          <div className="w-64 h-full overflow-y-auto scrollbar-thin">
            {leftSidebarOpen ? <Sidebar /> : null}
          </div>
        </aside>

        <main
          className={clsx(
            'relative min-h-0 h-full w-full overflow-hidden flex',
            leftSidebarOpen ? 'pl-64' : 'pl-0',
            rightPanelOpen ? 'pr-80' : 'pr-0'
          )}
        >
          <div className="flex-1 overflow-y-auto scrollbar-thin min-w-0 flex flex-col min-h-0 h-full">
            <div className="p-6 max-w-[1600px] w-full mx-auto flex-1 min-h-0 flex flex-col">
              <Outlet />
            </div>
          </div>
        </main>

        <aside
          className={`fixed top-14 right-0 bottom-0 z-40 ${
            rightPanelOpen ? 'w-80' : 'w-0'
          } border-l border-border transition-all duration-300 overflow-hidden bg-surface/80 backdrop-blur-sm`}
        >
          <div className="w-80 h-full overflow-y-auto scrollbar-thin">
            {rightPanelOpen ? <ContextPanel /> : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
