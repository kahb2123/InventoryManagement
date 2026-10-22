import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameAm: { type: String, trim: true, maxlength: 120, default: '' },
    description: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '#1769FF' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 }, { unique: true });

export const Category = mongoose.model('Category', categorySchema);
export default Category;
