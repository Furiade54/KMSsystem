import { Router, type Request, type Response } from 'express'
import {
  getConfigPage,
  getConfigJSON,
  postConfig,
  postTestSql,
  postReloadEnv,
  postRebuildPool,
  postResetStorage,
} from './config.controller'

const router = Router()

router.get('/config', getConfigPage as unknown as (_req: Request, res: Response) => void)
router.get('/config/ui', getConfigPage as unknown as (_req: Request, res: Response) => void)

router.get('/api/config', getConfigJSON as unknown as (_req: Request, res: Response) => void)
router.post('/api/config', postConfig as unknown as (_req: Request, res: Response) => void)

router.post('/api/config/test-sql', postTestSql as unknown as (_req: Request, res: Response) => void)
router.post('/api/config/reload', postReloadEnv as unknown as (_req: Request, res: Response) => void)
router.post('/api/config/rebuild-pool', postRebuildPool as unknown as (_req: Request, res: Response) => void)
router.post('/api/config/reset-storage', postResetStorage as unknown as (_req: Request, res: Response) => void)

export default router
