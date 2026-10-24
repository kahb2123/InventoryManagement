import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

/**
 * Per-branch (per-warehouse) stock position for a product.
 * This is the live balance; every change is backed by a StockMovement ledger row.
 */
const productStockSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    quantity: { type: Number, default: 0 },
    // Weighted average unit cost (ETB per base unit of the product's unit)
    averageCost: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    lastMovementAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productStockSchema.index({ tenantId: 1, product: 1, branch: 1 }, { unique: true });

tenantScope(productStockSchema);

export const ProductStock = mongoose.model('ProductStock', productStockSchema);
export default ProductStock;

