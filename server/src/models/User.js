import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { tenantScope } from '../utils/tenantScope.js';

export const ROLES = ['owner', 'manager', 'sales_clerk', 'storekeeper', 'accountant'];

export const ROLE_LABELS = {
  owner: 'Owner / Administrator',
  manager: 'Manager',
  sales_clerk: 'Sales Clerk',
  storekeeper: 'Storekeeper',
  accountant: 'Accountant',
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameAm: { type: String, trim: true, maxlength: 120, default: '' },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'sales_clerk' },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublic = function toPublic() {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

tenantScope(userSchema);

export const User = mongoose.model('User', userSchema);
export default User;

