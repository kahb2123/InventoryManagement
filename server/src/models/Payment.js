import mongoose from 'mongoose';

export const PAYMENT_TYPES = ['customer_receipt', 'supplier_payment'];
export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'credit_note', 'other'];

const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    type: { type: String, enum: PAYMENT_TYPES, required: true, index: true },
    party: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    partyName: { type: String, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, default: 'cash' },
    date: { type: Date, default: Date.now, index: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
    notes: { type: String, trim: true, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recordedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

paymentSchema.index({ party: 1, date: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
