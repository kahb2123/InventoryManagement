import { Router } from 'express';
import { body } from 'express-validator';
import { StockMovement } from '../models/StockMovement.js';
import { Product } from '../models/Product.js';
import { Unit } from '../models/Unit.js';
import { Supplier } from '../models/Supplier.js';
import { Customer } from '../models/Customer.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { recordStockIn, recordStockOut, transferStock, listStockRows } from '../services/inventory.service.js';
import { getSettings } from '../services/settings.service.js';
import { audit } from '../services/audit.service.js';
import { escapeRegex } from './products.routes.js';
import { buildRange } from './customers.routes.js';

const router = Router();
router.use(requireAuth);

const STOCK_IN_TYPES = ['stock_in', 'opening_balance', 'customer_return', 'adjustment_in'];
const STOCK_OUT_TYPES = ['stock_out', 'damage', 'expired', 'internal_use', 'adjustment_out'];

router.get(
  '/ledger',
  requirePermission('stock.ledger.view'),
  asyncHandler(async (req, res) => {
    const { product, branch, type, from, to, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (product && product !== 'all') filter.product = product;
    if (branch && branch !== 'all') filter.branch = branch;
    if (type && type !== 'all') filter.type = type;
    if (from || to) filter.date = buildRange(from, to);
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ movementNumber: rx }, { sourceNumber: rx }, { reason: rx }, { notes: rx }, { employeeName: rx }];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(500, Math.max(1, Number(limit)));
    const [movements, total] = await Promise.all([
      StockMovement.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('product', 'name nameAm sku unit')
        .populate('branch', 'name code')
        .populate('fromBranch', 'name code')
        .populate('toBranch', 'name code')
        .populate('employee', 'name')
        .lean(),
      StockMovement.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: movements,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  })
);

/** Current stock position (per branch or consolidated). */
router.get(
  '/positions',
  requirePermission('stock.view'),
  asyncHandler(async (req, res) => {
    const { branch, search, category, status } = req.query;
    const productFilter = { active: true };
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      productFilter.$or = [{ name: rx }, { nameAm: rx }, { sku: rx }, { barcode: rx }];
    }
    if (category && category !== 'all') productFilter.category = category;
    if (status === 'low_stock') productFilter.$expr = { $and: [{ $gt: ['$minStock', 0] }, { $lte: ['$totalStock', '$minStock'] }] };
    if (status === 'out_of_stock') productFilter.totalStock = { $lte: 0 };

    const products = await Product.find(productFilter)
      .populate('unit', 'code name nameAm')
      .populate('category', 'name color')
      .sort({ name: 1 })
      .lean({ virtuals: true });

    const rows = await listStockRows({});
    const byProduct = new Map();
    for (const row of rows) {
      const list = byProduct.get(String(row.product)) || [];
      list.push(row);
      byProduct.set(String(row.product), list);
    }

    const data = products.map((p) => {
      const branches = byProduct.get(String(p._id)) || [];
      const branchQty = branch && branch !== 'all' ? branches.filter((b) => String(b.branch) === String(branch)) : branches;
      const quantity = branchQty.reduce((s, b) => s + b.quantity, 0);
      const value = branchQty.reduce((s, b) => s + b.totalValue, 0);
      return {
        _id: p._id,
        name: p.name,
        nameAm: p.nameAm,
        sku: p.sku,
        unit: p.unit,
        category: p.category,
        minStock: p.minStock,
        purchaseCost: p.purchaseCost,
        sellingPrice: p.sellingPrice,
        totalStock: p.totalStock,
        totalStockValue: p.totalStockValue,
        quantity,
        value,
        averageCost: quantity > 0 ? Number((value / quantity).toFixed(4)) : 0,
        status: quantity <= 0 ? 'out_of_stock' : p.minStock > 0 && quantity <= p.minStock ? 'low_stock' : 'in_stock',
        branches: branches.map((b) => ({ branch: b.branch, quantity: b.quantity, totalValue: b.totalValue, averageCost: b.averageCost })),
      };
    });

    res.json({ success: true, data });
  })
);

/** Manual stock-in (not tied to a purchase). */
router.post(
  '/in',
  requirePermission('stock.in'),
  body('product').isMongoId().withMessage('Select a product'),
  body('quantity').isFloat({ min: 0.0001 }).withMessage('Enter a quantity greater than zero'),
  validate,
  asyncHandler(async (req, res) => {
    const { product, branch, quantity, unitCost, supplier, source, reference, notes, type, date } = req.body;
    const settings = await getSettings();
    const targetBranch = branch || req.user.branch || settings.defaultBranch;
    if (!targetBranch) throw ApiError.badRequest('Select a branch', 'BRANCH_REQUIRED');

    const productDoc = await Product.findById(product);
    if (!productDoc) throw ApiError.notFound('Product not found');

    const unitDoc = await Unit.findById(productDoc.unit);
    const cost = unitCost !== undefined && unitCost !== '' ? Number(unitCost) : productDoc.purchaseCost;

    const movementType = STOCK_IN_TYPES.includes(type) ? type : 'stock_in';
    const result = await recordStockIn({
      product,
      branch: targetBranch,
      quantity: Number(quantity),
      unitCost: cost,
      type: movementType,
      sourceType: source || 'manual',
      sourceNumber: reference || '',
      supplier: supplier || null,
      unit: productDoc.unit,
      unitName: unitDoc?.name || '',
      employee: req.user._id,
      employeeName: req.user.name,
      reason: source || 'Manual stock-in',
      notes: notes || '',
      date: date ? new Date(date) : new Date(),
    });

    await audit(req, { action: 'stock.in', entity: 'StockMovement', entityId: result.movement._id, entityLabel: `${productDoc.name} +${quantity}`, details: { quantity, unitCost: cost } });
    res.status(201).json({ success: true, message: 'Stock recorded', data: result });
  })
);

/** Manual stock-out (damage, expiry, internal use, adjustment). */
router.post(
  '/out',
  requirePermission('stock.out'),
  body('product').isMongoId().withMessage('Select a product'),
  body('quantity').isFloat({ min: 0.0001 }).withMessage('Enter a quantity greater than zero'),
  body('type').isIn(STOCK_OUT_TYPES).withMessage('Select a valid reason'),
  validate,
  asyncHandler(async (req, res) => {
    const { product, branch, quantity, type, customer, reason, reference, notes, date, allowNegative } = req.body;
    const settings = await getSettings();
    const targetBranch = branch || req.user.branch || settings.defaultBranch;
    if (!targetBranch) throw ApiError.badRequest('Select a branch', 'BRANCH_REQUIRED');

    const productDoc = await Product.findById(product);
    if (!productDoc) throw ApiError.notFound('Product not found');

    const unitDoc = await Unit.findById(productDoc.unit);

    // Only owner/manager may authorise a negative adjustment, and it is audited.
    let allow = false;
    if (allowNegative) {
      if (!['owner', 'manager'].includes(req.user.role)) {
        throw ApiError.forbidden('Only an owner or manager can authorise a negative stock adjustment', 'FORBIDDEN_ADJUSTMENT');
      }
      allow = true;
    }

    const result = await recordStockOut({
      product,
      branch: targetBranch,
      quantity: Number(quantity),
      type,
      sourceType: 'manual',
      sourceNumber: reference || '',
      customer: customer || null,
      unit: productDoc.unit,
      unitName: unitDoc?.name || '',
      employee: req.user._id,
      employeeName: req.user.name,
      reason: reason || type,
      notes: notes || '',
      approvedBy: allow ? req.user._id : null,
      date: date ? new Date(date) : new Date(),
      allowNegative: allow,
    });

    await audit(req, { action: 'stock.out', entity: 'StockMovement', entityId: result.movement._id, entityLabel: `${productDoc.name} -${quantity}`, details: { quantity, type, allowNegative: allow } });
    res.status(201).json({ success: true, message: 'Stock movement recorded', data: result });
  })
);

/** Branch-to-branch transfer. */
router.post(
  '/transfer',
  requirePermission('stock.transfer'),
  body('product').isMongoId().withMessage('Select a product'),
  body('fromBranch').isMongoId().withMessage('Select the source branch'),
  body('toBranch').isMongoId().withMessage('Select the destination branch'),
  body('quantity').isFloat({ min: 0.0001 }).withMessage('Enter a quantity greater than zero'),
  validate,
  asyncHandler(async (req, res) => {
    const { product, fromBranch, toBranch, quantity, notes, inTransit } = req.body;
    const productDoc = await Product.findById(product);
    if (!productDoc) throw ApiError.notFound('Product not found');
    const unitDoc = await Unit.findById(productDoc.unit);

    const result = await transferStock({
      product,
      fromBranch,
      toBranch,
      quantity: Number(quantity),
      unit: productDoc.unit,
      unitName: unitDoc?.name || '',
      employee: req.user._id,
      employeeName: req.user.name,
      notes: notes || '',
      approvedBy: req.user._id,
      inTransit: Boolean(inTransit),
    });

    await audit(req, { action: 'stock.transfer', entity: 'StockMovement', entityId: result.out.movement._id, entityLabel: `${productDoc.name} ${quantity}`, details: { fromBranch, toBranch, quantity, transferGroup: result.transferGroup } });
    res.status(201).json({ success: true, message: 'Transfer completed', data: result });
  })
);

/** Transfers that are still in transit. */
router.get(
  '/transfers',
  requirePermission('stock.view'),
  asyncHandler(async (req, res) => {
    const filter = { type: 'transfer_out' };
    if (req.query.inTransit === 'true') filter.inTransit = true;
    const movements = await StockMovement.find(filter)
      .sort({ date: -1 })
      .limit(200)
      .populate('product', 'name nameAm sku unit')
      .populate('fromBranch', 'name code')
      .populate('toBranch', 'name code')
      .lean();
    res.json({ success: true, data: movements });
  })
);

export default router;
