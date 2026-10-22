import mongoose from 'mongoose';

export const SALE_STATUSES = ['completed', 'cancelled', 'returned', 'partial_return'];
export const PAYMENT_STATUSES = ['paid', 'partial', 'unpaid'];

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    nameAm: { type: String, default: '' },
    sku: { type: String, default: '' },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
    unitName: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0.000001 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ['percent', 'amount', 'none'], default: 'none' },
    discountValue: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: 'Walk-in Customer' },
    customerType: { type: String, enum: ['cash', 'credit'], default: 'cash' },
    items: { type: [saleItemSchema], validate: [(v) => v.length > 0, 'A sale needs at least one item'] },
    subtotal: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    costTotal: { type: Number, default: 0, min: 0 },
    grossProfit: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
    paymentMethod: { type: String, default: 'cash' },
    reference: { type: String, trim: true, default: '' },
    status: { type: String, enum: SALE_STATUSES, default: 'completed', index: true },
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    soldByName: { type: String, default: '' },
    notes: { type: String, trim: true, default: '' },
    clientKey: { type: String, default: null },
    date: { type: Date, default: Date.now, index: true },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

saleSchema.index({ date: -1 });
saleSchema.index({ customer: 1, date: -1 });
saleSchema.index({ clientKey: 1 }, { unique: true, partialFilterExpression: { clientKey: { $type: 'string' } } });

export const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
