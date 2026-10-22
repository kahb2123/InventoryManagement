import { Router } from 'express';
import { body } from 'express-validator';
import { User, ROLES, ROLE_LABELS } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { permissionsForRole } from '../config/permissions.js';
import { audit } from '../services/audit.service.js';

const router = Router();
router.use(requireAuth);

const serialize = (user) => ({
  ...user.toPublic(),
  roleLabel: ROLE_LABELS[user.role],
  permissions: permissionsForRole(user.role),
});

router.get(
  '/roles',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role], permissions: permissionsForRole(role) })),
    });
  })
);

router.get(
  '/',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    if (req.query.role && req.query.role !== 'all') filter.role = req.query.role;
    if (req.query.branch && req.query.branch !== 'all') filter.branch = req.query.branch;
    const users = await User.find(filter).populate('branch', 'name code').sort({ name: 1 });
    res.json({ success: true, data: users.map((u) => serialize(u)) });
  })
);

router.post(
  '/',
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
      mustChangePassword: Boolean(req.body.mustChangePassword),
    });
    await audit(req, { action: 'user.created', entity: 'User', entityId: user._id, entityLabel: user.name, details: { role } });
    res.status(201).json({ success: true, message: 'User created', data: serialize(user) });
  })
);

router.patch(
  '/:id',
  requirePermission('users.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');

    const { name, nameAm, phone, role, active, branch, password, mustChangePassword } = req.body;

    if (role !== undefined) {
      if (!ROLES.includes(role)) throw ApiError.badRequest('Invalid role', 'INVALID_ROLE');
      if (user._id.equals(req.user._id) && role !== 'owner') {
        throw ApiError.badRequest('You cannot remove your own owner role', 'SELF_ROLE_CHANGE');
      }
      user.role = role;
    }
    if (name !== undefined) user.name = name;
    if (nameAm !== undefined) user.nameAm = nameAm;
    if (phone !== undefined) user.phone = phone;
    if (active !== undefined) {
      if (user._id.equals(req.user._id) && !active) {
        throw ApiError.badRequest('You cannot deactivate your own account', 'SELF_DEACTIVATE');
      }
      user.active = Boolean(active);
    }
    if (branch !== undefined) user.branch = branch || null;
    if (password) {
      if (String(password).length < 6) throw ApiError.badRequest('Password must be at least 6 characters', 'WEAK_PASSWORD');
      user.password = password;
      user.mustChangePassword = true;
    }
    if (mustChangePassword !== undefined) user.mustChangePassword = Boolean(mustChangePassword);
    await user.save();
    await audit(req, { action: 'user.updated', entity: 'User', entityId: user._id, entityLabel: user.name, details: { role: user.role, active: user.active } });
    res.json({ success: true, message: 'User updated', data: serialize(user) });
  })
);

router.delete(
  '/:id',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');
    if (user._id.equals(req.user._id)) throw ApiError.badRequest('You cannot delete your own account', 'SELF_DELETE');
    if (user.role === 'owner') {
      const owners = await User.countDocuments({ role: 'owner', active: true });
      if (owners <= 1) throw ApiError.conflict('Keep at least one active owner account', 'LAST_OWNER');
    }
    await user.deleteOne();
    await audit(req, { action: 'user.deleted', entity: 'User', entityId: user._id, entityLabel: user.name });
    res.json({ success: true, message: 'User deleted' });
  })
);

export default router;
