import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as authService from './auth.service'
import { BadRequestError } from '../../shared/errors/AppError'
import type { ApiResponse, LoginResponse, User } from '../../../../packages/shared-types/src'
import { getDbPool, sql } from '../../shared/db/pool'
import { sqlLocalToIsoOrNull } from '../../shared/utils/date'

const LoginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(4, 'Contraseña demasiado corta'),
})

const RegisterSchema = z.object({
  fullName: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  organizationName: z.string().min(2, 'Organización requerida').optional(),
})

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.issues.forEach((i) => {
        const key = i.path.join('.')
        if (!errors[key]) errors[key] = []
        errors[key].push(i.message)
      })
      throw new BadRequestError('Datos de inicio de sesión inválidos', errors)
    }

    const result = await authService.login(parsed.data.email, parsed.data.password)
    const body: ApiResponse<LoginResponse> = {
      success: true,
      data: result,
      message: 'Autenticación exitosa',
    }
    res.status(200).json(body)
  } catch (err) {
    next(err)
  }
}

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = RegisterSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.issues.forEach((i) => {
        const key = i.path.join('.')
        if (!errors[key]) errors[key] = []
        errors[key].push(i.message)
      })
      throw new BadRequestError('Datos de registro inválidos', errors)
    }
    const result = await authService.register({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
      organizationName: parsed.data.organizationName ?? parsed.data.email.split('@')[0],
    })
    res.status(201).json({
      success: true,
      data: result,
      message: 'Usuario registrado correctamente',
    })
  } catch (err) {
    next(err)
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) return res.status(401).json({ success: false, message: 'No autenticado' })
    const user = await authService.getUserById(req.auth.userId)
    const body: ApiResponse<User> = {
      success: true,
      data: user,
    }
    res.status(200).json(body)
  } catch (err) {
    next(err)
  }
}

export async function listOrganizationMembersHandler(req: Request, res: Response<ApiResponse<{ items: Array<{ id: string; fullName: string | null; email: string | null; role: string | null; joinedAt: string | null; projectsCount: number; status: string }>; total: number }>>, next: NextFunction) {
  try {
    const auth = (req as unknown as { auth: { organizationId: string; userId: string } }).auth
    const search = req.query.search ? String(req.query.search) : null
    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 25)))
    const offset = (page - 1) * pageSize
    const pool = await getDbPool()

    const where = ['IdOrganizacion = @orgId']
    const cReq = pool.request()
    cReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    if (search && search.trim().length > 0) {
      cReq.input('s', sql.NVarChar(255), `%${search.trim()}%`)
      where.push('(NombreCompleto LIKE @s OR Correo LIKE @s)')
    }
    const whereStr = 'WHERE ' + where.join(' AND ')
    const cnt = await cReq.query<{ total: number }>(`SELECT COUNT(*) total FROM Usuarios ${whereStr}`)
    const total = Number(cnt.recordset[0]?.total ?? 0)

    const dReq = pool.request()
    dReq.input('orgId', sql.UniqueIdentifier, auth.organizationId)
    if (search && search.trim().length > 0) dReq.input('s', sql.NVarChar(255), `%${search.trim()}%`)
    dReq.input('off', sql.Int, offset)
    dReq.input('lim', sql.Int, pageSize)
    const rows = await dReq.query<any>(`
      SELECT u.Id, u.NombreCompleto, u.Correo, u.FechaCreacion, u.Estado,
             ISNULL((SELECT TOP 1 mp.NombreRol FROM MiembrosProyecto mp WHERE mp.IdUsuario = u.Id ORDER BY mp.FechaIngreso DESC), 'Miembro') AS Rol,
             (SELECT COUNT(*) FROM MiembrosProyecto mp WHERE mp.IdUsuario = u.Id) projectsCount
      FROM Usuarios u ${whereStr}
      ORDER BY u.NombreCompleto ASC, u.FechaCreacion ASC
      OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
    `)
    const items = (rows.recordset || []).map(r => ({
      id: String(r.Id),
      fullName: r.NombreCompleto ?? null,
      email: r.Correo ?? null,
      role: r.Rol ?? null,
      joinedAt: sqlLocalToIsoOrNull(r.FechaCreacion as any),
      projectsCount: Number(r.projectsCount ?? 0),
      status: String(r.Estado || 'ACTIVO'),
    }))
    res.status(200).json({ success: true, data: { items, total } })
  } catch (e) {
    next(e)
  }
}
