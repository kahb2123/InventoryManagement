import { Router } from 'express';
import { body } from 'express-validator';
import { Customer, CUSTOMER_CATEGORIES } from '../models/Customer.js';
import { Sale } from '../models/Sale.js';
import { Payment } from '../models/Payment.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { customerBalance, customerBalances } from '../services/parties.service.js';
import { audit } from '../services/audit.service.js';
import { escapeRegex } from './products.routes.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('customers.view'),
  asyncHandler(async (req, res) => {
    const { search, category, status, branch, page = 1, limit = 50 } = req.query;
    const filter = { active: true };
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ name: rx }, { nameAm: rx }, { phone: rx }, { code: rx }];
    }
    if (category && category !== 'all') filter.category = category;
    if (status === 'inactive') filter.active = false;
    if (status === 'active') filter.active = true;
    if (branch && branch !== 'all') filter.branch = branch;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ name: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Customer.countDocuments(filter),
    ]);
    const balances = await customerBalances(customers.map((c) => c._id));

    res.json({
      success: true,
      data: customers.map((c) => {
        const b = balances.get(String(c._id)) || {};
        return {
          ...c,
          balance: b.balance ?? 0,
          totalSales: b.totalSales ?? 0,
          invoiceCount: b.invoiceCount ?? 0,
          lifetimeProfit: b.lifetimeProfit ?? 0,
          creditStatus: (b.balance ?? 0) > 0 ? 'has_balance' : 'clear',
          overCreditLimit: (b.balance ?? 0) > (c.creditLimit || 0) && (c.creditLimit || 0) > 0,
        };
      }),
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: CUSTOMER_CATEGORIES });
  })
);

router.get(
  '/:id',
  requirePermission('customers.view'),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) throw ApiError.notFound('Customer not found');
    const [balance, sales, payments] = await Promise.all([
      customerBalance(customer._id),
      Sale.find({ customer: customer._id }).sort({ date: -1 }).limit(50).populate('branch', 'name code').lean(),
      Payment.find({ type: 'customer_receipt', party: customer._id }).sort({ date: -1 }).limit(50).lean(),
    ]);
    res.json({ success: true, data: { ...customer, balance, sales, payments } });
  })
);

/** Account statement: every invoice and every receipt in date order. */
router.get(
  '/:id/statement',
  requirePermission('customers.view'),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) throw ApiError.notFound('Customer not found');
    const { from, to } = req.query;
    const range = buildRange(from, to);

    const [sales, payments, balance] = await Promise.all([
      Sale.find({ customer: customer._id, date: range, status: { $in: ['completed', 'partial_return'] } })
        .sort({ date: 1 })
        .populate('branch', 'name code')
        .lean(),
      Payment.find({ type: 'customer_receipt', party: customer._id, date: range }).sort({ date: 1 }).lean(),
      customerBalance(customer._id),
    ]);

    const lines = [
      ...sales.map((s) => ({
        date: s.date,
        type: 'sale',
        reference: s.invoiceNumber,
        description: `Invoice ${s.invoiceNumber}`,
        debit: s.balance,
        credit: 0,
        branch: s.branch?.name || '',
      })),
      ...payments.map((p) => ({
        date: p.date,
        type: 'payment',
        reference: p.reference,
        description: `Payment received (${p.method})`,
        debit: 0,
        credit: p.amount,
        branch: '',
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = 0;
    for (const line of lines) {
      running = Math.round((running + line.debit - line.credit) * 100) / 100;
      line.runningBalance = running;
    }

    res.json({ success: true, data: { customer, lines, balance, from: range.$gte, to: range.$lte } });
  })
);

router.post(
  '/',
  requirePermission('customers.manage'),
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  validate,
  asyncHandler(async (req, res) => {
    const { name, nameAm, phone, email, address, city, taxId, category, creditLimit, branch, notes, code } = req.body;
    const customer = await Customer.create({
      name,
      nameAm: nameAm || '',
      code: code || '',
      phone: phone || '',
      email: email || '',
      address: address || '',
      city: city || '',
      taxId: taxId || '',
      category: category || 'retail',
      creditLimit: creditLimit || 0,
      branch: branch || req.user.branch || null,
      notes: notes || '',
    });
    await audit(req, { action: 'customer.created', entity: 'Customer', entityId: customer._id, entityLabel: customer.name });
    res.status(201).json({ success: true, data: customer });
  })
);

router.patch(
  '/:id',
  requirePermission('customers.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found');
    const fields = ['name', 'nameAm', 'phone', 'email', 'address', 'city', 'taxId', 'category', 'creditLimit', 'notes', 'code', 'active'];
    for (const field of fields) if (req.body[field] !== undefined) customer[field] = req.body[field];
    if (req.body.branch !== undefined) customer.branch = req.body.branch || null;
    await customer.save();
    await audit(req, { action: 'customer.updated', entity: 'Customer', entityId: customer._id, entityLabel: customer.name, details: req.body });
    res.json({ success: true, data: customer });
  })
);

router.delete(
  '/:id',
  requirePermission('customers.delete'),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found');
    const saleCount = await Sale.countDocuments({ customer: customer._id });
    if (saleCount > 0) {
      customer.active = false;
      await customer.save();
      return res.json({ success: true, message: 'Customer has transactions so it was deactivated instead of deleted.' });
    }
    await customer.deleteOne();
    await audit(req, { action: 'customer.deleted', entity: 'Customer', entityId: customer._id, entityLabel: customer.name });
    res.json({ success: true, message: 'Customer deleted' });
  })
);

export function buildRange(from, to) {
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(0);
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  return { $gte: start, $lte: end };
}

export default router;
