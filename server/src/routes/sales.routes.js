import { Router } from 'express';
import { body } from 'express-validator';
import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { createSale, cancelSale, returnSale, priceLines, totalsFor } from '../services/sales.service.js';
import { getSettings } from '../services/settings.service.js';
import { audit } from '../services/audit.service.js';
import { escapeRegex } from './products.routes.js';
import { buildRange } from './customers.routes.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('sales.view'),
  asyncHandler(async (req, res) => {
    const { search, customer, branch, paymentStatus, status, from, to, page = 1, limit = 25 } = req.query;
    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ invoiceNumber: rx }, { customerName: rx }, { reference: rx }];
    }
    if (customer && customer !== 'all') filter.customer = customer;
    if (branch && branch !== 'all') filter.branch = branch;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (status && status !== 'all') filter.status = status;
    if (from || to) filter.date = buildRange(from, to);

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('branch', 'name code nameAm')
        .populate('soldBy', 'name role')
        .lean(),
      Sale.countDocuments(filter),
    ]);

    const summary = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          paid: { $sum: '$paidAmount' },
          balance: { $sum: '$balance' },
          profit: { $sum: '$grossProfit' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: sales,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
      summary: summary[0] || { total: 0, paid: 0, balance: 0, profit: 0, count: 0 },
    });
  })
);

/** Price a cart without saving it (live totals in the sale form). */
router.post(
  '/quote',
  requirePermission('sales.view'),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const products = await Product.find({ _id: { $in: rawItems.map((i) => i.product) } });
    const map = new Map(products.map((p) => [String(p._id), p]));
    const items = rawItems.map((item) => {
      const product = map.get(String(item.product));
      return {
        product: item.product,
        name: product?.name || '',
        sku: product?.sku || '',
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || product?.sellingPrice || 0,
        discountType: item.discountType || 'none',
        discountValue: Number(item.discountValue) || 0,
        taxRate: item.taxRate ?? product?.taxRate ?? settings.taxRate,
        taxable: item.taxable ?? product?.taxable,
      };
    });
    const priced = priceLines(items, {
      taxEnabled: settings.taxEnabled && settings.showTaxOnInvoice !== false,
      defaultTaxRate: settings.taxRate,
      taxInclusive: settings.taxInclusivePrices,
    });
    res.json({ success: true, data: { items: priced, ...totalsFor(priced) } });
  })
);

router.get(
  '/:id',
  requirePermission('sales.view'),
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id)
      .populate('branch', 'name code nameAm')
      .populate('soldBy', 'name role')
      .populate('customer', 'name nameAm phone address taxId')
      .lean();
    if (!sale) throw ApiError.notFound('Invoice not found');
    res.json({ success: true, data: sale });
  })
);

router.post(
  '/',
  requirePermission('sales.create'),
  body('items').isArray({ min: 1 }).withMessage('Add at least one product to the invoice'),
  validate,
  asyncHandler(async (req, res) => {
    const { sale, duplicate } = await createSale(req, req.body);
    if (!duplicate) {
      await audit(req, {
        action: 'sale.created',
        entity: 'Sale',
        entityId: sale._id,
        entityLabel: sale.invoiceNumber,
        details: { total: sale.total, paid: sale.paidAmount, balance: sale.balance },
      });
    }
    res.status(duplicate ? 200 : 201).json({
      success: true,
      message: duplicate ? 'This invoice was already submitted.' : 'Invoice saved',
      data: sale,
    });
  })
);

router.post(
  '/:id/cancel',
  requirePermission('sales.cancel'),
  body('reason').trim().notEmpty().withMessage('Give a reason for cancelling this invoice'),
  validate,
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id);
    if (!sale) throw ApiError.notFound('Invoice not found');
    await cancelSale(req, sale, req.body.reason);
    await audit(req, { action: 'sale.cancelled', entity: 'Sale', entityId: sale._id, entityLabel: sale.invoiceNumber, details: { reason: req.body.reason } });
    res.json({ success: true, message: 'Invoice cancelled and stock returned', data: sale });
  })
);

router.post(
  '/:id/return',
  requirePermission('sales.return'),
  body('items').isArray({ min: 1 }).withMessage('Select at least one item to return'),
  validate,
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id);
    if (!sale) throw ApiError.notFound('Invoice not found');
    await returnSale(req, sale, req.body.items, {
      refundAmount: req.body.refundAmount,
      method: req.body.method,
      notes: req.body.notes,
    });
    await audit(req, { action: 'sale.returned', entity: 'Sale', entityId: sale._id, entityLabel: sale.invoiceNumber, details: { items: req.body.items } });
    res.json({ success: true, message: 'Return recorded', data: sale });
  })
);

/** Printable invoice payload (business identity + invoice lines). */
router.get(
  '/:id/print',
  requirePermission('sales.view'),
  asyncHandler(async (req, res) => {
    const [sale, settings] = await Promise.all([
      Sale.findById(req.params.id).populate('branch', 'name code nameAm address phone').lean(),
      getSettings(),
    ]);
    if (!sale) throw ApiError.notFound('Invoice not found');
    res.json({ success: true, data: { sale, settings } });
  })
);

export default router;
