import type { Request, Response, NextFunction } from 'express'
import {
  createContribution,
  deleteContribution,
  getContribution,
  linkTopicToContribution,
  listLinkedTopics,
  listProjectContributions,
  unlinkTopicFromContribution,
  updateContribution,
  type CreateContributionInput,
  type UpdateContributionInput,
} from './contributions.service'
import type { ApiResponse, ProjectContribution, ProjectContributionTopicLink } from '../../../../packages/shared-types/src'

type Auth = { organizationId: string; userId: string; isOrgAdmin?: boolean }

function getAuth(req: Request): Auth {
  return (req as any).auth as Auth
}

function getProjectId(req: Request): string {
  const p = (req.params as any).projectId
  return p ? String(p) : (req.body && (req.body as any).projectId ? String((req.body as any).projectId) : '')
}

function qStr(req: Request, key: string): string | null {
  const v = (req.query as any)[key]
  return (v === undefined || v === null) ? null : String(v)
}
function qNum(req: Request, key: string): number | undefined {
  const v = (req.query as any)[key]
  if (v === undefined || v === null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export async function listProjectContributionsEndpoint(
  req: Request, res: Response<ApiResponse<any>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const limit = qNum(req, 'limit')
    const offset = qNum(req, 'offset')
    const result = await listProjectContributions(auth, {
      projectId,
      tipo: qStr(req, 'tipo'),
      estado: qStr(req, 'estado'),
      importancia: qStr(req, 'importancia'),
      search: qStr(req, 'search'),
      limit,
      offset,
    })
    res.json({
      success: true,
      data: result.items,
      meta: { total: result.total, limit: limit ?? 50, offset: offset ?? 0, count: result.items.length },
    } as any)
  } catch (e) { next(e) }
}

export async function getContributionEndpoint(
  req: Request, res: Response<ApiResponse<ProjectContribution>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const contributionId = String(req.params.contributionId)
    const data = await getContribution(auth, { projectId, contributionId })
    res.json({ success: true, data })
  } catch (e) { next(e) }
}

export async function createContributionEndpoint(
  req: Request, res: Response<ApiResponse<ProjectContribution>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const body = req.body as Partial<CreateContributionInput>
    const input: CreateContributionInput = {
      projectId,
      title: body.title ?? null,
      content: body.content ?? null,
      type: body.type ?? null,
      externalUrl: body.externalUrl ?? null,
      folderId: body.folderId ?? null,
      attachedFileId: body.attachedFileId ?? null,
      status: body.status ?? null,
      priority: body.priority ?? null,
      order: body.order ?? null,
      publishNow: body.publishNow == null ? null : !!body.publishNow,
      topicIds: Array.isArray(body.topicIds) ? body.topicIds : null,
    }
    const data = await createContribution(auth, input, { req })
    res.status(201).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function updateContributionEndpoint(
  req: Request, res: Response<ApiResponse<ProjectContribution>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const contributionId = String(req.params.contributionId)
    const body = req.body as UpdateContributionInput
    const data = await updateContribution(auth, { projectId, contributionId, body }, { req })
    res.json({ success: true, data })
  } catch (e) { next(e) }
}

export async function deleteContributionEndpoint(
  req: Request, res: Response<ApiResponse<void>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const contributionId = String(req.params.contributionId)
    const permanent = qStr(req, 'permanent') === '1' || qStr(req, 'permanent') === 'true'
    await deleteContribution(auth, { projectId, contributionId, permanent: !!permanent }, { req })
    res.status(204).end()
  } catch (e) { next(e) }
}

export async function linkTopicEndpoint(
  req: Request, res: Response<ApiResponse<ProjectContributionTopicLink>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const contributionId = String(req.params.contributionId)
    const rawTopicId = (req.body as any).topicId
    if (!rawTopicId) {
      const r: any = { success: false, message: 'topicId requerido', code: 'EBADPARAM' }
      res.status(400).json(r); return
    }
    const topicId = String(rawTopicId)
    const data = await linkTopicToContribution(auth, { projectId, contributionId, topicId }, { req })
    res.status(201).json({ success: true, data })
  } catch (e) { next(e) }
}

export async function unlinkTopicEndpoint(
  req: Request, res: Response<ApiResponse<void>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const contributionId = String(req.params.contributionId)
    const topicId = String(req.params.topicId)
    await unlinkTopicFromContribution(auth, { projectId, contributionId, topicId }, { req })
    res.status(204).end()
  } catch (e) { next(e) }
}

export async function listLinkedTopicsEndpoint(
  req: Request, res: Response<ApiResponse<ProjectContributionTopicLink[]>>, next: NextFunction
) {
  try {
    const auth = getAuth(req)
    const projectId = getProjectId(req)
    const contributionId = String(req.params.contributionId)
    const data = await listLinkedTopics(auth, { projectId, contributionId })
    res.json({ success: true, data })
  } catch (e) { next(e) }
}
