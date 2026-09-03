import { create } from 'zustand'
import api from '../services/api'

export type EntityStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'DELETED'
  | 'BLOCKED'
  | 'PENDING'

export interface UserShape {
  id: string
  organizationId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  status: EntityStatus
  lastLogin?: string | null
  createdAt: string
  updatedAt?: string | null
  roles?: Array<{
    id: string
    name: string
    isSystemRole: boolean
    priorityLevel?: number
    assignedAt?: string | null
    assignedBy?: string | null
  }>
  isOrgAdmin?: boolean
}

const TOKEN_KEY = 'kms_token'
const USER_KEY = 'kms_user'
const EXPIRES_AT_KEY = 'kms_expires_at'

interface AuthState {
  token: string | null
  user: UserShape | null
  expiresAt: string | null
  isAuthenticated: boolean
  isHydrated: boolean
  login: (token: string, user: UserShape, expiresAt?: string | null) => void
  logout: () => void
  hydrate: () => Promise<void>
}

function safeParseUser(raw: string | null): UserShape | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as UserShape
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  expiresAt: null,
  isAuthenticated: false,
  isHydrated: false,

  login: (token: string, user: UserShape, expiresAt?: string | null) => {
    const exp = expiresAt || null
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    if (exp) localStorage.setItem(EXPIRES_AT_KEY, exp)
    else localStorage.removeItem(EXPIRES_AT_KEY)
    set({ token, user, expiresAt: exp, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(EXPIRES_AT_KEY)
    set({ token: null, user: null, expiresAt: null, isAuthenticated: false })
  },

  hydrate: async () => {
    if (get().isHydrated) return
    const rawToken = localStorage.getItem(TOKEN_KEY)
    const rawUser = localStorage.getItem(USER_KEY)
    const storedExp = localStorage.getItem(EXPIRES_AT_KEY)
    const parsedUser = safeParseUser(rawUser)

    if (!rawToken || !parsedUser) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(EXPIRES_AT_KEY)
      set({ token: null, user: null, expiresAt: null, isAuthenticated: false, isHydrated: true })
      return
    }

    let expiresAtMs = storedExp ? new Date(storedExp).getTime() : NaN
    if (expiresAtMs && expiresAtMs < Date.now() - 30_000) {
      get().logout()
      set({ isHydrated: true })
      return
    }

    try {
      const res = await api.get<{ success: boolean; data?: UserShape; message?: string }>('/auth/me')
      if (res.data?.success && res.data.data) {
        const freshUser: UserShape = res.data.data
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser))
        set({
          token: rawToken,
          user: freshUser,
          expiresAt: storedExp,
          isAuthenticated: true,
          isHydrated: true,
        })
        return
      }
      get().logout()
      set({ isHydrated: true })
      return
    } catch (_err) {
      const valid = !expiresAtMs || expiresAtMs > Date.now() - 60_000
      if (valid) {
        set({
          token: rawToken,
          user: parsedUser,
          expiresAt: storedExp,
          isAuthenticated: true,
          isHydrated: true,
        })
      } else {
        get().logout()
        set({ isHydrated: true })
      }
    }
  },
}))

export default useAuthStore
