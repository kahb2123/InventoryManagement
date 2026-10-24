import mongoose from 'mongoose';

export const TENANT_PLANS = ['starter', 'growth', 'enterprise'];
export const TENANT_STATUSES = ['active', 'suspended', 'trialing', 'cancelled'];

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameAm: { type: String, trim: true, maxlength: 160, default: '' },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 60 },
    plan: { type: String, enum: TENANT_PLANS, default: 'starter' },
    status: { type: String, enum: TENANT_STATUSES, default: 'trialing' },

    // Business details
    businessName: { type: String, default: 'BuildStock Ethiopia', trim: true },
    businessNameAm: { type: String, default: 'ቢልድስቶክ ኢትዮጵያ', trim: true },
    tagline: { type: String, default: 'Smart Inventory Management for Construction Material Businesses.' },
    logo: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    taxId: { type: String, default: '' },
    website: { type: String, default: '' },

    currency: { type: String, default: 'ETB' },
    currencySymbol: { type: String, default: 'ETB' },
    locale: { type: String, default: 'en' },
    timezone: { type: String, default: 'Africa/Addis_Ababa' },
    ethiopicCalendar: { type: Boolean, default: true },
    ethiopicTime: { type: Boolean, default: false },

    taxEnabled: { type: Boolean, default: false },
    taxType: { type: String, enum: ['none', 'vat', 'withholding', 'custom'], default: 'none' },
    taxRate: { type: Number, default: 0 },
    taxNumber: { type: String, default: '' },
    taxInclusivePrices: { type: Boolean, default: false },
    showTaxOnInvoice: { type: Boolean, default: true },

    invoicePrefix: { type: String, default: 'INV' },
    invoiceNumberFormat: { type: String, default: 'INV-{YYYY}-{0000}' },
    purchasePrefix: { type: String, default: 'PO' },
    purchaseNumberFormat: { type: String, default: 'PO-{YYYY}-{0000}' },
    receiptPrefix: { type: String, default: 'RCP' },
    receiptNumberFormat: { type: String, default: 'RCP-{YYYY}-{0000}' },
    movementPrefix: { type: String, default: 'MOV' },
    movementNumberFormat: { type: String, default: 'MOV-{YYYY}-{0000}' },

    receiptFooter: { type: String, default: '' },
    invoiceNotes: { type: String, default: '' },
    lowStockDefault: { type: Number, default: 0 },
    defaultPaymentMethods: { type: [String], default: ['cash', 'bank_transfer', 'mobile_money'] },
    costMethod: { type: String, default: 'weighted_average' },
    stockAlertEnabled: { type: Boolean, default: true },

    // Owner user who created the tenant
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Default branch created during onboarding
    defaultBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

tenantSchema.index({ subdomain: 1 }, { unique: true });
tenantSchema.index({ status: 1, active: 1 });

export const Tenant = mongoose.model('Tenant', tenantSchema);
export default Tenant;

