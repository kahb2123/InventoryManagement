import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

export const PURCHASE_STATUSES = ['ordered', 'partially_received', 'received', 'cancelled'];

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
    unitName: { type: String, default: '' },
    orderedQuantity: { type: Number, required: true, min: 0 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    supplierName: { type: String, default: '' },
    items: { type: [purchaseItemSchema], validate: [(v) => v.length > 0, 'A purchase needs at least one item'] },
    status: { type: String, enum: PURCHASE_STATUSES, default: 'ordered', index: true },
    subtotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
    invoiceNumber: { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, default: '' },
    orderedDate: { type: Date, default: Date.now, index: true },
    expectedDate: { type: Date, default: null },
    receivedDate: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedByName: { type: String, default: '' },
    notes: { type: String, trim: true, default: '' },
    clientKey: { type: String, default: null },
  },
  { timestamps: true }
);

purchaseSchema.index({ orderedDate: -1 });
purchaseSchema.index({ tenantId: 1, orderedDate: -1 });
purchaseSchema.index({ tenantId: 1, clientKey: 1 }, { unique: true, partialFilterExpression: { clientKey: { $type: 'string' } } });

tenantScope(purchaseSchema);

export const Purchase = mongoose.model('Purchase', purchaseSchema);
export default Purchase;

