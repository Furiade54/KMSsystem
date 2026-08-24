import { useState, FormEvent } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react'
import { useAuthStore, type UserShape } from '../store/authStore'
import api from '../services/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/dashboard'

  const { isAuthenticated, hydrate, login } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)

  const [email, setEmail] = useState('carlos.perez@ejemplo.com')
  const [password, setPassword] = useState('Demo1234')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string[]; password?: string[]; _form?: string[] }>({})

  useState(() => {
    hydrate().finally(() => setHydrated(true))
  })

  if (hydrated && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    try {
      const res = await api.post<{
        success: boolean
        data?: { token: string; user: UserShape; expiresAt: string }
        message?: string
        errors?: Record<string, string[] | string>
      }>('/auth/login', { email, password })
      const payload = res.data
      if (!payload?.success || !payload.data) {
        setErrors({
          _form: Array.isArray((payload as any)?.errors?.['_form'])
            ? (payload as any).errors._form
            : [payload?.message || 'No fue posible autenticar. Verifica el correo y la contraseña.'],
        })
        return
      }
      const { token, user, expiresAt } = payload.data
      login(token, user, expiresAt)
      navigate(from, { replace: true })
    } catch (err: any) {
      if (err?.response) {
        const body = err.response.data as any
        const mapped: typeof errors = {}
        if (body?.errors && typeof body.errors === 'object') {
          for (const k of Object.keys(body.errors)) {
            const v = body.errors[k]
            if (Array.isArray(v) && v.every((x: any) => typeof x === 'string')) {
              ;(mapped as any)[k] = v
            } else if (typeof v === 'string') {
              ;(mapped as any)[k] = [v]
            }
          }
        }
        if (body?.message && !Object.keys(mapped).length) {
          mapped._form = [body.message]
        } else if (err.response.status === 401 && !mapped._form?.length) {
          mapped._form = ['Credenciales inválidas. Inténtalo de nuevo.']
        }
        setErrors(mapped)
      } else {
        setErrors({ _form: [String(err?.message || 'Error de conexión. Revisa que el backend esté levantado.')] })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fieldError = (k: keyof typeof errors) => {
    const arr = errors[k]
    return Array.isArray(arr) && arr.length ? arr[0] : undefined
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-background-secondary p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bienvenido al KMS</h1>
          <p className="text-muted-foreground mt-2">
            Sistema de Gestión del Conocimiento
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-surface border border-border rounded-2xl p-6 shadow-sm backdrop-blur-sm"
        >
          {errors._form?.length ? (
            <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {errors._form.join(' · ')}
            </div>
          ) : null}

          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full h-11 pl-10 pr-3 rounded-xl bg-background border ${
                    fieldError('email') ? 'border-destructive' : 'border-border'
                  } text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition disabled:opacity-60`}
                  placeholder="tu.correo@ejemplo.com"
                />
              </div>
              {fieldError('email') ? (
                <p className="mt-2 text-xs text-destructive">{fieldError('email')}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full h-11 pl-10 pr-11 rounded-xl bg-background border ${
                    fieldError('password') ? 'border-destructive' : 'border-border'
                  } text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition disabled:opacity-60`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition disabled:opacity-60"
                  tabIndex={-1}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldError('password') ? (
                <p className="mt-2 text-xs text-destructive">{fieldError('password')}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="btn-primary w-full h-11 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando sesión…
                </>
              ) : (
                <>Iniciar sesión</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
