import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import { User, ROLES, ROLE_LABELS } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { Tenant } from '../models/Tenant.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import env from '../config/env.js';
import { permissionsForRole } from '../config/permissions.js';
import { audit } from '../services/audit.service.js';

const router = Router();

const serialize = (user) => ({
  ...user.toPublic(),
  roleLabel: ROLE_LABELS[user.role],
  permissions: permissionsForRole(user.role),
});

/** True when the system has no users yet -> allows the one-time owner setup. */
router.get(
  '/setup-status',
  asyncHandler(async (req, res) => {
    const count = await User.countDocuments();
    res.json({ success: true, data: { needsSetup: count === 0 } });
  })
);

router.post(
  '/setup',
  body('name').trim().notEmpty().withMessage('Your name is required'),
  body('email').isEmail().withMessage('Enter a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('businessName').optional().trim(),
  validate,
  asyncHandler(async (req, res) => {
    const count = await User.countDocuments();
    if (count > 0) throw ApiError.conflict('Setup has already been completed', 'ALREADY_SETUP');

    const { name, email, password, businessName } = req.body;
    const emailDomain = String(email).split('@')[1] || 'buildstock.local';
    const subdomain = emailDomain.replace(/[^a-z0-9-]/g, '-').toLowerCase();

    const tenant = await Tenant.create({
      name: businessName || `${name}'s Business`,
      nameAm: businessName || `${name}'s Business`,
      subdomain,
      status: 'active',
      active: true,
      currency: 'ETB',
      currencySymbol: 'ETB',
      locale: 'en',
      timezone: 'Africa/Addis_Ababa',
    });

    const user = await User.create({ name, email, password, role: 'owner', active: true, tenantId: tenant._id });

    let branch = await Branch.findOne({ isDefault: true, tenantId: tenant._id });
    if (!branch) {
      branch = await Branch.create({
        name: 'Main Branch',
        nameAm: 'ዋና ቅርንጫ',
        code: 'MAIN',
        isDefault: true,
        active: true,
        tenantId: tenant._id,
      });
      user.branch = branch._id;
      await user.save();
    }

    if (businessName) {
      const { Settings } = await import('../models/Settings.js');
      await Settings.updateOne(
        { tenantId: tenant._id },
        { $set: { businessName, tenantId: tenant._id } },
        { upsert: true },
      );
    }

    res.status(201).json({ success: true, data: { token: signToken(user), user: serialize(user) } });
  })
);

router.post(
  '/login',
  body('email').isEmail().withMessage('Enter a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw ApiError.unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');
    }
    if (!user.active) throw ApiError.forbidden('This account has been deactivated', 'INACTIVE_USER');

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ success: true, data: { token: signToken(user), user: serialize(user) } });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: serialize(req.user) });
  })
);

router.post(
  '/change-password',
  requireAuth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(req.body.currentPassword))) {
      throw ApiError.unauthorized('Current password is incorrect', 'BAD_CREDENTIALS');
    }
    user.password = req.body.newPassword;
    user.mustChangePassword = false;
    await user.save();
    await audit(req, { action: 'auth.password_changed', entity: 'User', entityId: user._id, entityLabel: user.name });
    res.json({ success: true, message: 'Password updated successfully' });
  })
);

/** Owner/manager can create additional staff accounts. */
router.post(
  '/users',
  requireAuth,
  requirePermission('users.manage'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Enter a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(ROLES).withMessage('Select a valid role'),
  validate,
  asyncHandler(async (req, res) => {
    const { name, nameAm, email, password, role, phone, branch } = req.body;
    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) throw ApiError.conflict('A user with this email already exists', 'DUPLICATE_EMAIL');

    const user = await User.create({
      name,
      nameAm: nameAm || '',
      email: String(email).toLowerCase(),
      password,
      role,
      phone: phone || '',
      branch: branch || req.user.branch || null,
    });
    await audit(req, { action: 'user.created', entity: 'User', entityId: user._id, entityLabel: user.name, details: { role } });
    res.status(201).json({ success: true, data: serialize(user) });
  })
);

router.get(
  '/users',
  requireAuth,
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    const users = await User.find(filter).populate('branch', 'name code').sort({ name: 1 });
    res.json({ success: true, data: users.map((u) => serialize(u)) });
  })
);

router.patch(
  '/users/:id',
  requireAuth,
  requirePermission('users.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');
    const { name, nameAm, phone, role, active, branch, password } = req.body;
    if (name !== undefined) user.name = name;
    if (nameAm !== undefined) user.nameAm = nameAm;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) {
      if (!ROLES.includes(role)) throw ApiError.badRequest('Invalid role');
      user.role = role;
    }
    if (active !== undefined) user.active = Boolean(active);
    if (branch !== undefined) user.branch = branch || null;
    if (password) user.password = password;
    await user.save();
    await audit(req, { action: 'user.updated', entity: 'User', entityId: user._id, entityLabel: user.name });
    res.json({ success: true, data: serialize(user) });
  })
);

router.get(
  '/roles',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role], permissions: permissionsForRole(role) })),
    });
  })
);

export default router;
export { env };
