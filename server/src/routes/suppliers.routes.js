import { Router } from 'express';
import { body } from 'express-validator';
import { Supplier } from '../models/Supplier.js';
import { Purchase } from '../models/Purchase.js';
import { Payment } from '../models/Payment.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { supplierBalance, supplierBalances } from '../services/parties.service.js';
import { audit } from '../services/audit.service.js';
import { escapeRegex } from './products.routes.js';
import { buildRange } from './customers.routes.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('suppliers.view'),
  asyncHandler(async (req, res) => {
    const { search, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ name: rx }, { nameAm: rx }, { phone: rx }, { code: rx }, { contactPerson: rx }];
    }
    if (status === 'inactive') filter.active = false;
    if (status === 'active') filter.active = true;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const [suppliers, total] = await Promise.all([
      Supplier.find(filter).sort({ name: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Supplier.countDocuments(filter),
    ]);
    const balances = await supplierBalances(suppliers.map((s) => s._id));

    res.json({
      success: true,
      data: suppliers.map((s) => {
        const b = balances.get(String(s._id)) || {};
        return {
          ...s,
          balance: b.balance ?? 0,
          totalPurchases: b.totalPurchases ?? 0,
          invoiceCount: b.invoiceCount ?? 0,
          payable: b.payable ?? 0,
        };
      }),
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  })
);

router.get(
  '/:id',
  requirePermission('suppliers.view'),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) throw ApiError.notFound('Supplier not found');
    const [balance, purchases, payments] = await Promise.all([
      supplierBalance(supplier._id),
      Purchase.find({ supplier: supplier._id }).sort({ orderedDate: -1 }).limit(50).populate('branch', 'name code').lean(),
      Payment.find({ type: 'supplier_payment', party: supplier._id }).sort({ date: -1 }).limit(50).lean(),
    ]);
    res.json({ success: true, data: { ...supplier, balance, purchases, payments } });
  })
);

router.get(
  '/:id/statement',
  requirePermission('suppliers.view'),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) throw ApiError.notFound('Supplier not found');
    const range = buildRange(req.query.from, req.query.to);
    const [purchases, payments, balance] = await Promise.all([
      Purchase.find({ supplier: supplier._id, orderedDate: range, status: { $ne: 'cancelled' } }).sort({ orderedDate: 1 }).lean(),
      Payment.find({ type: 'supplier_payment', party: supplier._id, date: range }).sort({ date: 1 }).lean(),
      supplierBalance(supplier._id),
    ]);

    const lines = [
      ...purchases.map((p) => ({
        date: p.orderedDate,
        type: 'purchase',
        reference: p.purchaseNumber,
        description: `Purchase ${p.purchaseNumber}`,
        debit: p.balance,
        credit: 0,
      })),
      ...payments.map((p) => ({
        date: p.date,
        type: 'payment',
        reference: p.reference,
        description: `Payment made (${p.method})`,
        debit: 0,
        credit: p.amount,
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = 0;
    for (const line of lines) {
      running = Math.round((running + line.debit - line.credit) * 100) / 100;
      line.runningBalance = running;
    }

    res.json({ success: true, data: { supplier, lines, balance, from: range.$gte, to: range.$lte } });
  })
);

router.post(
  '/',
  requirePermission('suppliers.manage'),
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  validate,
  asyncHandler(async (req, res) => {
    const { name, nameAm, code, contactPerson, phone, email, address, city, taxId, paymentTerms, notes } = req.body;
    const supplier = await Supplier.create({
      name,
      nameAm: nameAm || '',
      code: code || '',
      contactPerson: contactPerson || '',
      phone: phone || '',
      email: email || '',
      address: address || '',
      city: city || '',
      taxId: taxId || '',
      paymentTerms: paymentTerms || '',
      notes: notes || '',
    });
    await audit(req, { action: 'supplier.created', entity: 'Supplier', entityId: supplier._id, entityLabel: supplier.name });
    res.status(201).json({ success: true, data: supplier });
  })
);

router.patch(
  '/:id',
  requirePermission('suppliers.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw ApiError.notFound('Supplier not found');
    const fields = ['name', 'nameAm', 'code', 'contactPerson', 'phone', 'email', 'address', 'city', 'taxId', 'paymentTerms', 'notes', 'active'];
    for (const field of fields) if (req.body[field] !== undefined) supplier[field] = req.body[field];
    await supplier.save();
    await audit(req, { action: 'supplier.updated', entity: 'Supplier', entityId: supplier._id, entityLabel: supplier.name, details: req.body });
    res.json({ success: true, data: supplier });
  })
);

router.delete(
  '/:id',
  requirePermission('suppliers.delete'),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw ApiError.notFound('Supplier not found');
    const purchaseCount = await Purchase.countDocuments({ supplier: supplier._id });
    if (purchaseCount > 0) {
      supplier.active = false;
      await supplier.save();
      return res.json({ success: true, message: 'Supplier has transactions so it was deactivated instead of deleted.' });
    }
    await supplier.deleteOne();
    await audit(req, { action: 'supplier.deleted', entity: 'Supplier', entityId: supplier._id, entityLabel: supplier.name });
    res.json({ success: true, message: 'Supplier deleted' });
  })
);

export default router;
