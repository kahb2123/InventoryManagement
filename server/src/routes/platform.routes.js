import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import { User, ROLES, ROLE_LABELS } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { Branch } from '../models/Branch.js';
import { Settings } from '../models/Settings.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platform.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { audit } from '../services/audit.service.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requirePlatformAdmin);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [tenantCount, userCount, activeTenants] = await Promise.all([
      Tenant.countDocuments(),
      User.countDocuments({ isPlatformAdmin: { $ne: true } }),
      Tenant.countDocuments({ status: 'active', active: true }),
    ]);

    const tenantsByPlan = await Tenant.aggregate([
      { $group: { _id: '', count: { $sum: 1 } } },
    ]);

    const tenantsByStatus = await Tenant.aggregate([
      { $group: { _id: '', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        totalTenants: tenantCount,
        totalUsers: userCount,
        activeTenants,
        tenantsByPlan,
        tenantsByStatus,
      },
    });
  })
);

router.get(
  '/tenants',
  asyncHandler(async (req, res) => {
    const { status, plan, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (plan) filter.plan = plan;
    if (search) {
      filter[$or] = [
        { name: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
        { subdomain: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const tenants = await Tenant.find(filter)
      .populate('ownerUser', 'name email')
      .populate('defaultBranch', 'name')
      .sort({ createdAt: -1 });

    const tenantIds = tenants.map((t) => t._id);
    const userCounts = await User.aggregate([
      { $match: { tenantId: { $in: tenantIds }, isPlatformAdmin: { $ne: true } } },
      { $group: { _id: '', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(userCounts.map((c) => [c._id.toString(), c.count]));

    const result = tenants.map((t) => ({
      ...t.toObject(),
      userCount: countMap.get(t._id.toString()) || 0,
    }));

    res.json({ success: true, data: result });
  })
);

router.post(
  '/tenants',
  body('name').trim().notEmpty().withMessage('Tenant/company name is required'),
  body('subdomain').trim().notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Subdomain must be lowercase alphanumeric with hyphens'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('ownerEmail').isEmail().withMessage('Valid owner email is required'),
  body('ownerPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('plan').optional().isIn(['starter', 'growth', 'enterprise']),
  body('status').optional().isIn(['active', 'suspended', 'trialing', 'cancelled']),
  validate,
  asyncHandler(async (req, res) => {
    const {
      name,
      nameAm,
      subdomain,
      businessName,
      businessNameAm,
      plan = 'starter',
      status = 'active',
      ownerName,
      ownerEmail,
      ownerPassword,
      phone,
      email,
      address,
    } = req.body;

    const existingTenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() });
    if (existingTenant) throw ApiError.conflict('Subdomain already taken', 'SUBDOMAIN_EXISTS');

    const existingUser = await User.findOne({ email: ownerEmail.toLowerCase() });
    if (existingUser) throw ApiError.conflict('User with this email already exists', 'EMAIL_EXISTS');

    const tenant = await Tenant.create({
      name,
      nameAm: nameAm || name,
      subdomain: subdomain.toLowerCase(),
      plan,
      status,
      active: status === 'active',
      businessName: businessName || name,
      businessNameAm: businessNameAm || nameAm || name,
      phone: phone || '',
      email: email || ownerEmail,
      address: address || '',
    });

    const owner = await User.create({
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      password: ownerPassword,
      role: 'owner',
      tenantId: tenant._id,
      active: true,
    });

    const branch = await Branch.create({
      name: 'Main Branch',
      nameAm: '?? ?????',
      code: 'MAIN',
      isDefault: true,
      active: true,
      tenantId: tenant._id,
    });

    owner.branch = branch._id;
    await owner.save();

    tenant.ownerUser = owner._id;
    tenant.defaultBranch = branch._id;
    await tenant.save();

    await Settings.create({
      tenantId: tenant._id,
      businessName: businessName || name,
      businessNameAm: businessNameAm || nameAm || name,
    });

    await audit(req, {
      action: 'platform.tenant.created',
      entity: 'Tenant',
      entityId: tenant._id,
      entityLabel: tenant.name,
      details: { subdomain: tenant.subdomain, ownerEmail },
    });

    res.status(201).json({
      success: true,
      data: {
        tenant,
        owner: { ...owner.toPublic(), roleLabel: ROLE_LABELS[owner.role] },
        branch,
      },
    });
  })
);

router.get(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id).populate('ownerUser').populate('defaultBranch');
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const users = await User.find({ tenantId: tenant._id, isPlatformAdmin: { $ne: true } })
      .select('-password')
      .populate('branch', 'name')
      .sort({ createdAt: -1 });

    const settings = await Settings.findOne({ tenantId: tenant._id });

    res.json({
      success: true,
      data: {
        tenant,
        users,
        settings,
        userCount: users.length,
      },
    });
  })
);

router.patch(
  '/tenants/:id',
  body('status').optional().isIn(['active', 'suspended', 'trialing', 'cancelled']),
  body('plan').optional().isIn(['starter', 'growth', 'enterprise']),
  validate,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const { name, nameAm, businessName, businessNameAm, status, plan, active, phone, email, address } = req.body;

    if (name !== undefined) tenant.name = name;
    if (nameAm !== undefined) tenant.nameAm = nameAm;
    if (businessName !== undefined) tenant.businessName = businessName;
    if (businessNameAm !== undefined) tenant.businessNameAm = businessNameAm;
    if (status !== undefined) {
      tenant.status = status;
      tenant.active = status === 'active';
    }
    if (active !== undefined) tenant.active = active;
    if (plan !== undefined) tenant.plan = plan;
    if (phone !== undefined) tenant.phone = phone;
    if (email !== undefined) tenant.email = email;
    if (address !== undefined) tenant.address = address;

    await tenant.save();

    await audit(req, {
      action: 'platform.tenant.updated',
      entity: 'Tenant',
      entityId: tenant._id,
      entityLabel: tenant.name,
      details: req.body,
    });

    res.json({ success: true, data: tenant });
  })
);

router.post(
  '/tenants/:id/owner',
  body('name').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  validate,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const { name, email, password } = req.body;
    const emailLower = email.toLowerCase();

    const existing = await User.findOne({ email: emailLower, tenantId: { $ne: tenant._id } });
    if (existing) throw ApiError.conflict('Email already in use', 'EMAIL_EXISTS');

    let owner = await User.findOne({ tenantId: tenant._id, role: 'owner' });
    if (owner) {
      owner.name = name;
      owner.email = emailLower;
      owner.password = password;
      await owner.save();
    } else {
      owner = await User.create({
        name,
        email: emailLower,
        password,
        role: 'owner',
        tenantId: tenant._id,
        active: true,
      });
      tenant.ownerUser = owner._id;
      await tenant.save();
    }

    await audit(req, {
      action: 'platform.tenant.owner_set',
      entity: 'Tenant',
      entityId: tenant._id,
      entityLabel: tenant.name,
      details: { ownerEmail: emailLower },
    });

    res.json({ success: true, data: { ...owner.toPublic(), roleLabel: ROLE_LABELS[owner.role] } });
  })
);

router.post(
  '/tenants/:id/impersonate',
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const owner = await User.findOne({ tenantId: tenant._id, role: 'owner' });
    if (!owner) throw ApiError.notFound('No owner found for this tenant');

    const token = signToken(owner);

    await audit(req, {
      action: 'platform.tenant.impersonate',
      entity: 'Tenant',
      entityId: tenant._id,
      entityLabel: tenant.name,
      details: { ownerEmail: owner.email },
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          ...owner.toPublic(),
          roleLabel: ROLE_LABELS[owner.role],
          permissions: [],
        },
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
        },
      },
    });
  })
);

router.get(
  '/admins',
  asyncHandler(async (req, res) => {
    const admins = await User.find({ isPlatformAdmin: true }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: admins });
  })
);

router.post(
  '/admins',
  body('name').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const emailLower = email.toLowerCase();

    const existing = await User.findOne({ email: emailLower });
    if (existing) throw ApiError.conflict('Email already exists', 'EMAIL_EXISTS');

    const admin = await User.create({
      name,
      email: emailLower,
      password,
      role: 'owner',
      isPlatformAdmin: true,
      tenantId: null,
      active: true,
    });

    await audit(req, {
      action: 'platform.admin.created',
      entity: 'User',
      entityId: admin._id,
      entityLabel: admin.name,
      details: { email: emailLower },
    });

    res.status(201).json({ success: true, data: { ...admin.toPublic() } });
  })
);

export default router;
