import { Router } from 'express';
import { body } from 'express-validator';
import { Expense, EXPENSE_CATEGORIES } from '../models/Expense.js';
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
  '/categories',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: EXPENSE_CATEGORIES });
  })
);

router.get(
  '/',
  requirePermission('expenses.view'),
  asyncHandler(async (req, res) => {
    const { category, branch, from, to, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (branch && branch !== 'all') filter.branch = branch;
    if (from || to) filter.date = buildRange(from, to);
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ reference: rx }, { description: rx }, { paidTo: rx }];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const [expenses, total, summary] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('branch', 'name code')
        .populate('employee', 'name')
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([{ $match: { ...filter, tenantId: req.tenantId } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);

    const byCategory = await Expense.aggregate([
      { $match: { ...filter, tenantId: req.tenantId } },
      { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]);

    res.json({
      success: true,
      data: expenses,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
      summary: { total: summary[0]?.amount || 0, count: summary[0]?.count || 0 },
      byCategory: byCategory.map((c) => ({ category: c._id, amount: c.amount, count: c.count })),
    });
  })
);

router.post(
  '/',
  requirePermission('expenses.manage'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Enter an amount greater than zero'),
  body('category').isIn(EXPENSE_CATEGORIES).withMessage('Select a valid category'),
  validate,
  asyncHandler(async (req, res) => {
    const { category, amount, date, description, paymentMethod, paidTo, employee, receiptNumber, notes, branch } = req.body;
    const settings = await getSettings();
    const reference = await nextNumber('expense', 'EXP-{YYYY}-{0000}');
    const expense = await Expense.create({
      reference,
      branch: branch || req.user.branch || settings.defaultBranch || null,
      category,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      description: description || '',
      paymentMethod: paymentMethod || 'cash',
      paidTo: paidTo || '',
      employee: employee || req.user._id,
      employeeName: req.user?.name || '',
      recordedBy: req.user._id,
      receiptNumber: receiptNumber || '',
      notes: notes || '',
    });
    await audit(req, { action: 'expense.created', entity: 'Expense', entityId: expense._id, entityLabel: `${reference} ${expense.amount}` });
    res.status(201).json({ success: true, message: 'Expense recorded', data: expense });
  })
);

router.patch(
  '/:id',
  requirePermission('expenses.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw ApiError.notFound('Expense not found');
    const fields = ['category', 'amount', 'date', 'description', 'paymentMethod', 'paidTo', 'receiptNumber', 'notes', 'branch', 'employee'];
    for (const field of fields) if (req.body[field] !== undefined) expense[field] = req.body[field];
    await expense.save();
    await audit(req, { action: 'expense.updated', entity: 'Expense', entityId: expense._id, entityLabel: expense.reference, details: req.body });
    res.json({ success: true, data: expense });
  })
);

router.delete(
  '/:id',
  requirePermission('expenses.manage'),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw ApiError.notFound('Expense not found');
    await expense.deleteOne();
    await audit(req, { action: 'expense.deleted', entity: 'Expense', entityId: expense._id, entityLabel: expense.reference });
    res.json({ success: true, message: 'Expense deleted' });
  })
);

export default router;
