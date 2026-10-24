import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameAm: { type: String, trim: true, maxlength: 120, default: '' },
    description: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '#1769FF' },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

tenantScope(categorySchema);

export const Category = mongoose.model('Category', categorySchema);
export default Category;

