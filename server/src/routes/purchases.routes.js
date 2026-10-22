import { Router } from 'express';
import { body } from 'express-validator';
import { Purchase } from '../models/Purchase.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { createPurchase, receivePurchase, recordSupplierPayment, buildLowStockOrder } from '../services/purchases.service.js';
import { audit } from '../services/audit.service.js';
import { escapeRegex } from './products.routes.js';
import { buildRange } from './customers.routes.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('purchases.view'),
  asyncHandler(async (req, res) => {
    const { search, supplier, branch, status, paymentStatus, from, to, page = 1, limit = 25 } = req.query;
    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ purchaseNumber: rx }, { supplierName: rx }, { invoiceNumber: rx }];
    }
    if (supplier && supplier !== 'all') filter.supplier = supplier;
    if (branch && branch !== 'all') filter.branch = branch;
    if (status && status !== 'all') filter.status = status;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (from || to) filter.orderedDate = buildRange(from, to);

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .sort({ orderedDate: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('branch', 'name code')
        .populate('supplier', 'name phone')
        .populate('receivedBy', 'name')
        .lean(),
      Purchase.countDocuments(filter),
    ]);

    const summary = await Purchase.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, balance: { $sum: '$balance' }, count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: purchases,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
      summary: summary[0] || { total: 0, paid: 0, balance: 0, count: 0 },
    });
  })
);

/** Suggested purchase order built from low-stock products. */
router.get(
  '/low-stock-order',
  requirePermission('purchases.view'),
  asyncHandler(async (req, res) => {
    const groups = await buildLowStockOrder({ category: req.query.category });
    res.json({ success: true, data: groups });
  })
);

router.get(
  '/:id',
  requirePermission('purchases.view'),
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id)
      .populate('branch', 'name code nameAm')
      .populate('supplier', 'name nameAm phone address taxId')
      .populate('receivedBy', 'name')
      .lean();
    if (!purchase) throw ApiError.notFound('Purchase order not found');
    res.json({ success: true, data: purchase });
  })
);

router.post(
  '/',
  requirePermission('purchases.create'),
  body('items').isArray({ min: 1 }).withMessage('Add at least one product to the order'),
  body('supplier').isMongoId().withMessage('Select a supplier'),
  validate,
  asyncHandler(async (req, res) => {
    const { purchase, duplicate } = await createPurchase(req, req.body);
    if (!duplicate) {
      await audit(req, { action: 'purchase.created', entity: 'Purchase', entityId: purchase._id, entityLabel: purchase.purchaseNumber });
    }
    res.status(duplicate ? 200 : 201).json({
      success: true,
      message: duplicate ? 'This order was already submitted.' : 'Purchase order saved',
      data: purchase,
    });
  })
);

router.post(
  '/:id/receive',
  requirePermission('purchases.receive'),
  body('items').isArray({ min: 1 }).withMessage('Select the goods you are receiving'),
  validate,
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) throw ApiError.notFound('Purchase order not found');
    await receivePurchase(req, purchase, req.body.items);
    await audit(req, { action: 'purchase.received', entity: 'Purchase', entityId: purchase._id, entityLabel: purchase.purchaseNumber, details: { items: req.body.items } });
    res.json({ success: true, message: 'Goods received and stock updated', data: purchase });
  })
);

router.post(
  '/:id/payment',
  requirePermission('payments.create'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Enter a payment amount'),
  validate,
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) throw ApiError.notFound('Purchase order not found');
    await recordSupplierPayment(req, purchase, req.body.amount, req.body.method || 'cash', req.body.notes || '');
    await audit(req, { action: 'purchase.payment', entity: 'Purchase', entityId: purchase._id, entityLabel: purchase.purchaseNumber, details: { amount: req.body.amount } });
    res.json({ success: true, message: 'Payment recorded', data: purchase });
  })
);

router.post(
  '/:id/cancel',
  requirePermission('purchases.cancel'),
  body('reason').trim().notEmpty().withMessage('Give a reason for cancelling this order'),
  validate,
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) throw ApiError.notFound('Purchase order not found');
    if (purchase.status === 'cancelled') throw ApiError.conflict('This order is already cancelled', 'ALREADY_CANCELLED');
    const received = purchase.items.reduce((s, i) => s + i.receivedQuantity, 0);
    if (received > 0) {
      throw ApiError.conflict(
        'Goods have already been received on this order. Record a purchase return instead.',
        'GOODS_RECEIVED'
      );
    }
    purchase.status = 'cancelled';
    purchase.notes = `${purchase.notes}\n[Cancelled] ${req.body.reason}`.trim();
    await purchase.save();
    await audit(req, { action: 'purchase.cancelled', entity: 'Purchase', entityId: purchase._id, entityLabel: purchase.purchaseNumber, details: { reason: req.body.reason } });
    res.json({ success: true, message: 'Purchase order cancelled', data: purchase });
  })
);

/** Purchase return: goods go back to the supplier and leave stock. */
router.post(
  '/:id/return',
  requirePermission('purchases.receive'),
  body('items').isArray({ min: 1 }).withMessage('Select the goods being returned'),
  validate,
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) throw ApiError.notFound('Purchase order not found');
    const { recordStockOut } = await import('../services/inventory.service.js');
    for (const item of req.body.items) {
      const line = purchase.items.find((l) => String(l.product) === String(item.product));
      if (!line) throw ApiError.badRequest('A returned product is not on this purchase order', 'INVALID_ITEM');
      const qty = Number(item.quantity);
      if (!(qty > 0)) throw ApiError.badRequest('Enter a return quantity', 'INVALID_QUANTITY');
      if (qty > line.receivedQuantity) throw ApiError.badRequest(`Only ${line.receivedQuantity} of ${line.name} was received`, 'RETURN_EXCEEDS_QUANTITY');
      await recordStockOut({
        product: line.product,
        branch: purchase.branch,
        quantity: qty,
        type: 'purchase_return',
        sourceType: 'purchase_return',
        sourceId: purchase._id,
        sourceNumber: purchase.purchaseNumber,
        supplier: purchase.supplier,
        unit: line.unit,
        unitName: line.unitName,
        employee: req.user._id,
        employeeName: req.user.name,
        reason: 'Purchase return',
        notes: req.body.notes || '',
      });
      line.receivedQuantity = Number((line.receivedQuantity - qty).toFixed(4));
    }
    purchase.subtotal = Number(purchase.items.reduce((s, i) => s + i.receivedQuantity * i.unitCost, 0).toFixed(2));
    purchase.total = Number((purchase.subtotal + purchase.taxTotal).toFixed(2));
    purchase.balance = Number((purchase.total - purchase.paidAmount).toFixed(2));
    purchase.status = purchase.items.every((l) => l.receivedQuantity >= l.orderedQuantity) ? 'received' : 'partially_received';
    await purchase.save();
    await audit(req, { action: 'purchase.returned', entity: 'Purchase', entityId: purchase._id, entityLabel: purchase.purchaseNumber });
    res.json({ success: true, message: 'Purchase return recorded', data: purchase });
  })
);

export default router;
