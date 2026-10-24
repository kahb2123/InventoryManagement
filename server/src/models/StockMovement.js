import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

export const MOVEMENT_TYPES = [
  'stock_in',
  'stock_out',
  'sale',
  'sale_return',
  'purchase_receipt',
  'purchase_return',
  'transfer_in',
  'transfer_out',
  'adjustment_in',
  'adjustment_out',
  'opening_balance',
  'damage',
  'expired',
  'internal_use',
];

const stockMovementSchema = new mongoose.Schema(
  {
    movementNumber: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },
    direction: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
    unitName: { type: String, default: '' },
    unitCost: { type: Number, default: 0, min: 0 },
    value: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, default: 0 },
    sourceType: { type: String, default: '' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sourceNumber: { type: String, default: '' },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    fromBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    toBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    transferGroup: { type: String, default: '' },
    inTransit: { type: Boolean, default: false },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, default: '' },
    reason: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

stockMovementSchema.index({ date: -1 });
stockMovementSchema.index({ tenantId: 1, date: -1 });
stockMovementSchema.index({ tenantId: 1, product: 1, date: -1 });
stockMovementSchema.index({ tenantId: 1, transferGroup: 1 });

tenantScope(stockMovementSchema);

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export default StockMovement;

