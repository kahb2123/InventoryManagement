import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../utils/apiError.js';
import { buildDashboard, branchComparison } from '../services/dashboard.service.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('dashboard.view'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 7));
    const data = await buildDashboard({
      days,
      branch: req.query.branch,
      from: req.query.from,
      to: req.query.to,
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/branches',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const data = await branchComparison({ from: req.query.from, to: req.query.to });
    res.json({ success: true, data });
  })
);

export default router;
