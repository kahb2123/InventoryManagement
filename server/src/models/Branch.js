import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameAm: { type: String, trim: true, maxlength: 120, default: '' },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

branchSchema.pre('save', function ensureSingleDefault(next) {
  if (!this.isDefault) return next();
  this.constructor
    .updateMany({ _id: { $ne: this._id }, isDefault: true }, { $set: { isDefault: false } })
    .then(() => next())
    .catch((err) => next(err));
});

export const Branch = mongoose.model('Branch', branchSchema);
export default Branch;
