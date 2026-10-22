import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameAm: { type: String, trim: true, maxlength: 160, default: '' },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, trim: true, default: '', index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, trim: true, default: '' },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    purchaseCost: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    reorderQuantity: { type: Number, default: 0, min: 0 },
    preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    storageLocation: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    taxRate: { type: Number, default: 0, min: 0 },
    taxable: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    description: { type: String, trim: true, default: '' },
    // Denormalised totals (authoritative source = ProductStock + StockMovement ledger)
    totalStock: { type: Number, default: 0 },
    totalStockValue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', sku: 'text', barcode: 'text', brand: 'text' });
productSchema.index({ category: 1, active: 1 });
productSchema.index({ totalStock: 1 });

productSchema.virtual('stockStatus').get(function stockStatus() {
  if (this.totalStock <= 0) return 'out_of_stock';
  if (this.minStock > 0 && this.totalStock <= this.minStock) return 'low_stock';
  return 'in_stock';
});

productSchema.set('toJSON', { virtuals: true });

export const Product = mongoose.model('Product', productSchema);
export default Product;
