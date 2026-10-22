import { Router } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../utils/apiError.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('audit.view'),
  asyncHandler(async (req, res) => {
    const { action, entity, user, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (action && action !== 'all') filter.action = action;
    if (entity && entity !== 'all') filter.entity = entity;
    if (user && user !== 'all') filter.user = user;
    if (from || to) {
      filter.date = {
        $gte: from ? new Date(`${from}T00:00:00.000Z`) : new Date(0),
        $lte: to ? new Date(`${to}T23:59:59.999Z`) : new Date(),
      };
    }
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ date: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: entries,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  })
);

export default router;
