import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

export const CUSTOMER_CATEGORIES = ['retail', 'contractor', 'construction_company', 'wholesale', 'government', 'other'];

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameAm: { type: String, trim: true, maxlength: 160, default: '' },
    code: { type: String, trim: true, uppercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    category: { type: String, enum: CUSTOMER_CATEGORIES, default: 'retail' },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    creditLimit: { type: Number, default: 0, min: 0 },
    openingBalance: { type: Number, default: 0 },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });
customerSchema.index({ phone: 1 });

tenantScope(customerSchema);

export const Customer = mongoose.model('Customer', customerSchema);
export default Customer;

