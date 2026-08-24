import { create } from 'zustand'

export type SelectedResourceType = 'project' | 'folder' | 'file'

export interface SelectedResource {
  type: SelectedResourceType
  id: string
  projectId: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_MODE_KEY = 'kms_theme_mode'
const RIGHT_PANEL_KEY = 'kms_right_panel_open'
const RIGHT_PANEL_DISMISSED_KEY = 'kms_right_panel_dismissed'
const LEFT_SIDEBAR_KEY = 'kms_left_sidebar_open'

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function safeDelete(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

interface UIState {
  leftSidebarOpen: boolean
  rightPanelOpen: boolean
  rightPanelUserDismissed: boolean
  /** @deprecated usar selectedResource */
  selectedResourceId: string | null
  selectedResource: SelectedResource | null
  themeMode: ThemeMode
  themeHydrated: boolean
  toggleLeftSidebar: () => void
  toggleRightPanel: () => void
  /** @deprecated usar setSelectedResource */
  setSelectedResourceId: (id: string | null) => void
  setSelectedResource: (resource: SelectedResource | null) => void
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  hydrateTheme: () => void
  hydrateLayout: () => void
  dismissRightPanel: () => void
}

function resolveDarkBySystem(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function isDarkEffective(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return resolveDarkBySystem()
}

function applyThemeToDOM(effectiveDark: boolean, mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  if (effectiveDark) {
    html.classList.add('dark')
    html.style.colorScheme = 'dark'
  } else {
    html.classList.remove('dark')
    html.style.colorScheme = 'light'
  }
  try {
    html.setAttribute('data-theme-mode', mode)
  } catch {
    /* ignore */
  }
}

function safeReadMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_MODE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* ignore */
  }
  return 'system'
}

function safeWriteMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

let systemMediaListenerInstalled = false
const ensureSystemMediaListener = (onChange: () => void): void => {
  if (systemMediaListenerInstalled) return
  if (typeof window === 'undefined' || !window.matchMedia) return
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => onChange()
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', listener)
    else if (typeof (mql as MediaQueryList).addListener === 'function') (mql as MediaQueryList).addListener(listener)
    systemMediaListenerInstalled = true
  } catch {
    /* ignore */
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  leftSidebarOpen: true,
  rightPanelOpen: false,
  rightPanelUserDismissed: false,
  selectedResourceId: null,
  selectedResource: null,
  themeMode: 'system',
  themeHydrated: false,

  toggleLeftSidebar: () => {
    const next = !get().leftSidebarOpen
    safeWrite(LEFT_SIDEBAR_KEY, next ? '1' : '0')
    set({ leftSidebarOpen: next })
  },
  toggleRightPanel: () => {
    const next = !get().rightPanelOpen
    safeWrite(RIGHT_PANEL_KEY, next ? '1' : '0')
    if (next) {
      safeDelete(RIGHT_PANEL_DISMISSED_KEY)
    }
    set({
      rightPanelOpen: next,
      rightPanelUserDismissed: next ? false : get().rightPanelUserDismissed,
    })
  },
  dismissRightPanel: () => {
    safeWrite(RIGHT_PANEL_KEY, '0')
    safeWrite(RIGHT_PANEL_DISMISSED_KEY, '1')
    set({ rightPanelOpen: false, rightPanelUserDismissed: true })
  },
  setSelectedResourceId: (id) => {
    set({
      selectedResourceId: id,
      selectedResource: null,
    })
  },
  setSelectedResource: (resource) => {
    set({
      selectedResource: resource,
      selectedResourceId: resource ? `${resource.type}-${resource.id}` : null,
    })
  },

  setThemeMode: (mode) => {
    safeWriteMode(mode)
    applyThemeToDOM(isDarkEffective(mode), mode)
    set({ themeMode: mode, themeHydrated: true })
  },

  toggleTheme: () => {
    const current = get().themeMode
    let next: ThemeMode
    if (current === 'light') next = 'dark'
    else if (current === 'dark') next = 'system'
    else next = 'light'
    get().setThemeMode(next)
  },

  hydrateTheme: () => {
    if (get().themeHydrated) return
    const mode = safeReadMode()
    safeWriteMode(mode)
    applyThemeToDOM(isDarkEffective(mode), mode)
    set({ themeMode: mode, themeHydrated: true })
    ensureSystemMediaListener(() => {
      const cur = get().themeMode
      if (cur === 'system') {
        applyThemeToDOM(resolveDarkBySystem(), 'system')
      }
    })
  },

  hydrateLayout: () => {
    const s = get()
    if (typeof window === 'undefined') return
    const left = safeRead(LEFT_SIDEBAR_KEY)
    const right = safeRead(RIGHT_PANEL_KEY)
    const dismissed = safeRead(RIGHT_PANEL_DISMISSED_KEY)
    set({
      leftSidebarOpen: left === null ? s.leftSidebarOpen : left === '1',
      rightPanelOpen: right === null ? s.rightPanelOpen : right === '1',
      rightPanelUserDismissed: dismissed === '1',
    })
  },
}))

export function resolveThemeDark(mode: ThemeMode): boolean {
  return isDarkEffective(mode)
}
