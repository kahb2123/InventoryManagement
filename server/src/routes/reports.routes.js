import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { runReport, REPORT_LIST } from '../services/reports.service.js';
import { sendCsv } from '../utils/csv.js';
import { getSettings } from '../services/settings.service.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: REPORT_LIST });
  })
);

const FINANCIAL_REPORTS = new Set([
  'gross-profit',
  'net-profit',
  'expense',
  'customer-debt',
  'supplier-payable',
  'purchase',
]);

router.get(
  '/:type',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    if (FINANCIAL_REPORTS.has(req.params.type)) {
      requirePermission('reports.financial')(req, res, () => {});
      if (res.headersSent) return undefined;
      if (!['owner', 'manager', 'accountant'].includes(req.user.role)) {
        throw ApiError.forbidden('This report contains financial information and is restricted', 'FORBIDDEN_REPORT');
      }
    }
    const result = await runReport(req.params.type, req.query);
    if (!result) throw ApiError.notFound('Unknown report type');
    res.json({ success: true, data: result });
  })
);

router.get(
  '/:type/export',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    if (FINANCIAL_REPORTS.has(req.params.type) && !['owner', 'manager', 'accountant'].includes(req.user.role)) {
      throw ApiError.forbidden('This report contains financial information and is restricted', 'FORBIDDEN_REPORT');
    }
    const result = await runReport(req.params.type, req.query);
    if (!result) throw ApiError.notFound('Unknown report type');
    const suffix = new Date().toISOString().slice(0, 10);
    sendCsv(res, `${req.params.type}-${suffix}.csv`, result.rows, result.columns);
  })
);

export default router;
