import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameAm: { type: String, trim: true, maxlength: 160, default: '' },
    code: { type: String, trim: true, uppercase: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    paymentTerms: { type: String, trim: true, default: '' },
    openingBalance: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

supplierSchema.index({ name: 1 });

export const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;
