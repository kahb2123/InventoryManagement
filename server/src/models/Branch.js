import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameAm: { type: String, trim: true, maxlength: 120, default: '' },
    code: { type: String, required: true, uppercase: true, trim: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  },
  { timestamps: true }
);

branchSchema.pre('save', function ensureSingleDefault(next) {
  if (!this.isDefault) return next();
  this.constructor
    .updateMany({ _id: { $ne: this._id }, tenantId: this.tenantId, isDefault: true }, { $set: { isDefault: false } })
    .then(() => next())
    .catch((err) => next(err));
});

tenantScope(branchSchema);

export const Branch = mongoose.model('Branch', branchSchema);
export default Branch;

