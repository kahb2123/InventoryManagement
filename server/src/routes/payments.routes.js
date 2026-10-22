import { Router } from 'express';
import { body } from 'express-validator';
import { Payment } from '../models/Payment.js';
import { Sale } from '../models/Sale.js';
import { Purchase } from '../models/Purchase.js';
import { Customer } from '../models/Customer.js';
import { Supplier } from '../models/Supplier.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { nextNumber } from '../models/Counter.js';
import { getSettings } from '../services/settings.service.js';
import { audit } from '../services/audit.service.js';
import { escapeRegex } from './products.routes.js';
import { buildRange } from './customers.routes.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('payments.view'),
  asyncHandler(async (req, res) => {
    const { type, party, branch, method, from, to, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (type && type !== 'all') filter.type = type;
    if (party && party !== 'all') filter.party = party;
    if (branch && branch !== 'all') filter.branch = branch;
    if (method && method !== 'all') filter.method = method;
    if (from || to) filter.date = buildRange(from, to);
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ reference: rx }, { partyName: rx }, { notes: rx }];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const [payments, total, summary] = await Promise.all([
      Payment.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('branch', 'name code')
        .populate('recordedBy', 'name')
        .lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([
        { $match: filter },
        { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: payments,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
      summary: summary.map((s) => ({ type: s._id, amount: s.amount, count: s.count })),
    });
  })
);

/** Record a receipt from a customer or a payment to a supplier. */
router.post(
  '/',
  requirePermission('payments.create'),
  body('type').isIn(['customer_receipt', 'supplier_payment']).withMessage('Select a valid payment type'),
  body('party').isMongoId().withMessage('Select the customer or supplier'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Enter an amount greater than zero'),
  validate,
  asyncHandler(async (req, res) => {
    const { type, party, amount, method, date, notes, branch, sale, purchase } = req.body;
    const settings = await getSettings();
    const value = Number(amount);

    let partyName = '';
    if (type === 'customer_receipt') {
      const customer = await Customer.findById(party);
      if (!customer) throw ApiError.badRequest('Customer not found', 'CUSTOMER_NOT_FOUND');
      partyName = customer.name;
    } else {
      const supplier = await Supplier.findById(party);
      if (!supplier) throw ApiError.badRequest('Supplier not found', 'SUPPLIER_NOT_FOUND');
      partyName = supplier.name;
    }

    const reference = await nextNumber('payment', settings.receiptNumberFormat || 'RCP-{YYYY}-{0000}');
    const payment = await Payment.create({
      reference,
      type,
      party,
      partyName,
      branch: branch || req.user.branch || settings.defaultBranch || null,
      amount: value,
      method: method || 'cash',
      date: date ? new Date(date) : new Date(),
      sale: sale || null,
      purchase: purchase || null,
      notes: notes || '',
      recordedBy: req.user._id,
      recordedByName: req.user.name,
    });

    // Keep the linked invoice balance in sync.
    if (type === 'customer_receipt' && sale) {
      const linked = await Sale.findById(sale);
      if (linked) {
        linked.paidAmount = Number((linked.paidAmount + value).toFixed(2));
        linked.balance = Number((linked.total - linked.paidAmount).toFixed(2));
        linked.paymentStatus = linked.balance <= 0 ? 'paid' : 'partial';
        await linked.save();
      }
    }
    if (type === 'supplier_payment' && purchase) {
      const linked = await Purchase.findById(purchase);
      if (linked) {
        linked.paidAmount = Number((linked.paidAmount + value).toFixed(2));
        linked.balance = Number((linked.total - linked.paidAmount).toFixed(2));
        linked.paymentStatus = linked.balance <= 0 ? 'paid' : 'partial';
        await linked.save();
      }
    }

    await audit(req, { action: 'payment.created', entity: 'Payment', entityId: payment._id, entityLabel: `${reference} ${value}`, details: { type, party: String(party), amount: value } });
    res.status(201).json({ success: true, message: 'Payment recorded', data: payment });
  })
);

router.delete(
  '/:id',
  requirePermission('payments.create'),
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.sale) {
      const linked = await Sale.findById(payment.sale);
      if (linked) {
        linked.paidAmount = Number(Math.max(0, linked.paidAmount - payment.amount).toFixed(2));
        linked.balance = Number((linked.total - linked.paidAmount).toFixed(2));
        linked.paymentStatus = linked.balance <= 0 ? 'paid' : linked.paidAmount > 0 ? 'partial' : 'unpaid';
        await linked.save();
      }
    }
    if (payment.purchase) {
      const linked = await Purchase.findById(payment.purchase);
      if (linked) {
        linked.paidAmount = Number(Math.max(0, linked.paidAmount - payment.amount).toFixed(2));
        linked.balance = Number((linked.total - linked.paidAmount).toFixed(2));
        linked.paymentStatus = linked.balance <= 0 ? 'paid' : linked.paidAmount > 0 ? 'partial' : 'unpaid';
        await linked.save();
      }
    }
    await payment.deleteOne();
    await audit(req, { action: 'payment.deleted', entity: 'Payment', entityId: payment._id, entityLabel: payment.reference });
    res.json({ success: true, message: 'Payment removed' });
  })
);

export default router;
