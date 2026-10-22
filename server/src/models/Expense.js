import mongoose from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'rent',
  'salaries',
  'transportation',
  'loading_unloading',
  'electricity',
  'telephone_internet',
  'maintenance',
  'utilities',
  'marketing',
  'bank_charges',
  'other',
];

const expenseSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, default: Date.now, index: true },
    description: { type: String, trim: true, default: '' },
    paymentMethod: { type: String, default: 'cash' },
    paidTo: { type: String, trim: true, default: '' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiptNumber: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });

export const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
