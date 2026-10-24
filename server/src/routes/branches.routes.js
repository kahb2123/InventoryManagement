import { Router } from 'express';
import { body } from 'express-validator';
import { Branch } from '../models/Branch.js';
import { ProductStock } from '../models/ProductStock.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { audit } from '../services/audit.service.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    const branches = await Branch.find(filter).populate('manager', 'name').sort({ name: 1 }).lean();
    const stats = await ProductStock.aggregate([
      { $match: { tenantId: req.tenantId } },
      { $group: { _id: '$branch', quantity: { $sum: '$quantity' }, value: { $sum: '$totalValue' } } },
    ]);
    const map = new Map(stats.map((s) => [String(s._id), s]));
    res.json({
      success: true,
      data: branches.map((b) => ({
        ...b,
        stockQuantity: map.get(String(b._id))?.quantity ?? 0,
        stockValue: map.get(String(b._id))?.value ?? 0,
      })),
    });
  })
);

router.post(
  '/',
  requirePermission('branches.manage'),
  body('name').trim().notEmpty().withMessage('Branch name is required'),
  body('code').trim().notEmpty().withMessage('Branch code is required'),
  validate,
  asyncHandler(async (req, res) => {
    const { name, nameAm, code, address, phone, isDefault } = req.body;
    const normalized = code.toUpperCase();
    if (await Branch.exists({ code: normalized })) throw ApiError.conflict('This branch code already exists', 'DUPLICATE_CODE');
    const branch = await Branch.create({
      name,
      nameAm: nameAm || '',
      code: normalized,
      address: address || '',
      phone: phone || '',
      isDefault: Boolean(isDefault),
    });
    await audit(req, { action: 'branch.created', entity: 'Branch', entityId: branch._id, entityLabel: branch.name });
    res.status(201).json({ success: true, data: branch });
  })
);

router.patch(
  '/:id',
  requirePermission('branches.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    if (!branch) throw ApiError.notFound('Branch not found');
    const { name, nameAm, address, phone, isDefault, active, manager } = req.body;
    if (name !== undefined) branch.name = name;
    if (nameAm !== undefined) branch.nameAm = nameAm;
    if (address !== undefined) branch.address = address;
    if (phone !== undefined) branch.phone = phone;
    if (isDefault !== undefined) branch.isDefault = isDefault;
    if (active !== undefined) branch.active = active;
    if (manager !== undefined) branch.manager = manager || null;
    await branch.save();
    await audit(req, { action: 'branch.updated', entity: 'Branch', entityId: branch._id, entityLabel: branch.name });
    res.json({ success: true, data: branch });
  })
);

router.delete(
  '/:id',
  requirePermission('branches.manage'),
  asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    if (!branch) throw ApiError.notFound('Branch not found');
    const stock = await ProductStock.countDocuments({ branch: branch._id, quantity: { $gt: 0 } });
    if (stock > 0) throw ApiError.conflict('This branch still holds stock. Transfer or clear it first.', 'BRANCH_IN_USE');
    await branch.deleteOne();
    await audit(req, { action: 'branch.deleted', entity: 'Branch', entityId: branch._id, entityLabel: branch.name });
    res.json({ success: true, message: 'Branch deleted' });
  })
);

export default router;
