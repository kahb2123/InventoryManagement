import { Router } from 'express';
import { body } from 'express-validator';
import { Settings } from '../models/Settings.js';
import { Branch } from '../models/Branch.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { getSettings, updateSettings } from '../services/settings.service.js';
import { upload } from '../middleware/upload.js';
import { audit } from '../services/audit.service.js';
import { absoluteMediaUrl, withAbsoluteLogo } from '../utils/media.js';

const router = Router();

/** Public branding so the sign-in screen shows the shop identity. */
router.get(
  '/branding',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    res.json({
      success: true,
      data: {
        businessName: settings.businessName,
        businessNameAm: settings.businessNameAm,
        tagline: settings.tagline,
        logo: absoluteMediaUrl(req, settings.logo),
        currency: settings.currency,
        locale: settings.locale,
        timezone: settings.timezone,
        ethiopicCalendar: settings.ethiopicCalendar,
        defaultPaymentMethods: settings.defaultPaymentMethods,
        lowStockDefault: settings.lowStockDefault,
        stockAlertEnabled: settings.stockAlertEnabled,
        taxEnabled: settings.taxEnabled,
        taxRate: settings.taxRate,
        taxInclusivePrices: settings.taxInclusivePrices,
      },
    });
  })
);

router.get(
  '/',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const settings = await getSettings({ fresh: true });
    const branches = await Branch.find({ active: true }).sort({ name: 1 }).lean();
    res.json({ success: true, data: { ...withAbsoluteLogo(req, settings), branches } });
  })
);

const ALLOWED_FIELDS = [
  'businessName', 'businessNameAm', 'tagline', 'logo', 'address', 'phone', 'email', 'taxId', 'website',
  'currency', 'currencySymbol', 'locale', 'timezone', 'ethiopicCalendar', 'ethiopicTime',
  'taxEnabled', 'taxType', 'taxRate', 'taxNumber', 'taxInclusivePrices', 'showTaxOnInvoice',
  'invoicePrefix', 'invoiceNumberFormat', 'purchasePrefix', 'purchaseNumberFormat',
  'receiptPrefix', 'receiptNumberFormat', 'movementPrefix', 'movementNumberFormat',
  'receiptFooter', 'invoiceNotes', 'lowStockDefault', 'defaultPaymentMethods', 'costMethod',
  'stockAlertEnabled', 'defaultBranch',
];

router.put(
  '/',
  requireAuth,
  requirePermission('settings.manage'),
  body('businessName').optional().trim().notEmpty().withMessage('Business name cannot be empty'),
  validate,
  asyncHandler(async (req, res) => {
    const patch = {};
    for (const field of ALLOWED_FIELDS) if (req.body[field] !== undefined) patch[field] = req.body[field];
    if (patch.taxRate !== undefined) patch.taxRate = Math.max(0, Number(patch.taxRate) || 0);
    if (patch.lowStockDefault !== undefined) patch.lowStockDefault = Math.max(0, Number(patch.lowStockDefault) || 0);
    if (patch.defaultPaymentMethods && !Array.isArray(patch.defaultPaymentMethods)) {
      throw ApiError.badRequest('Payment methods must be a list', 'INVALID_PAYMENT_METHODS');
    }
    const settings = await updateSettings(patch);
    await audit(req, { action: 'settings.updated', entity: 'Settings', entityLabel: settings.businessName, details: { fields: Object.keys(patch) } });
    res.json({ success: true, message: 'Settings saved', data: withAbsoluteLogo(req, settings) });
  })
);

router.post(
  '/logo',
  requireAuth,
  requirePermission('settings.manage'),
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Choose an image to upload', 'NO_FILE');
    const settings = await updateSettings({ logo: `/uploads/${req.file.filename}` });
    await audit(req, { action: 'settings.logo_updated', entity: 'Settings', entityLabel: settings.businessName });
    res.json({ success: true, message: 'Logo updated', data: { logo: absoluteMediaUrl(req, settings.logo) } });
  })
);

export default router;
