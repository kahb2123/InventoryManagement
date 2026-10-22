import { Purchase } from '../models/Purchase.js';
import { Product } from '../models/Product.js';
import { Unit } from '../models/Unit.js';
import { Supplier } from '../models/Supplier.js';
import { getSettings } from './settings.service.js';
import { recordStockIn, round2 } from './inventory.service.js';
import { nextNumber } from '../models/Counter.js';
import { ApiError } from '../utils/apiError.js';

export const round4 = (n) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;

/**
 * Create a purchase order. Ordered quantities do NOT change stock — stock only
 * moves when goods are received and confirmed.
 */
export async function createPurchase(req, body) {
  const settings = await getSettings();

  if (body.clientKey) {
    const existing = await Purchase.findOne({ clientKey: body.clientKey });
    if (existing) return { purchase: existing, duplicate: true };
  }

  const branch = body.branch || req.user.branch || settings.defaultBranch;
  if (!branch) throw ApiError.badRequest('Select a branch for this purchase', 'BRANCH_REQUIRED');

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) throw ApiError.badRequest('Add at least one product to the purchase', 'NO_ITEMS');

  const supplier = await Supplier.findById(body.supplier);
  if (!supplier) throw ApiError.badRequest('Select a valid supplier', 'SUPPLIER_NOT_FOUND');

  const products = await Product.find({ _id: { $in: rawItems.map((i) => i.product) } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const units = await Unit.find({ _id: { $in: products.map((p) => p.unit) } });
  const unitMap = new Map(units.map((u) => [String(u._id), u]));

  const items = rawItems.map((item) => {
    const product = productMap.get(String(item.product));
    if (!product) throw ApiError.badRequest(`Product ${item.product} was not found`, 'PRODUCT_NOT_FOUND');
    const orderedQuantity = Number(item.quantity);
    if (!(orderedQuantity > 0)) throw ApiError.badRequest(`Enter a quantity for ${product.name}`, 'INVALID_QUANTITY');
    const unitCost = Number(item.unitCost ?? product.purchaseCost) || 0;
    return {
      product: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      unitName: unitMap.get(String(product.unit))?.name || '',
      orderedQuantity,
      receivedQuantity: 0,
      unitCost,
      lineTotal: round2(orderedQuantity * unitCost),
      branch,
    };
  });

  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const taxTotal = round2(Number(body.taxTotal) || 0);
  const total = round2(subtotal + taxTotal);
  const paidAmount = Math.min(Math.max(0, Number(body.paidAmount) || 0), total);
  const balance = round2(total - paidAmount);
  const paymentStatus = balance <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  const purchaseNumber = await nextNumber('purchase', settings.purchaseNumberFormat || 'PO-{YYYY}-{0000}');

  const purchase = await Purchase.create({
    purchaseNumber,
    branch,
    supplier: supplier._id,
    supplierName: supplier.name,
    items,
    status: 'ordered',
    subtotal,
    taxTotal,
    total,
    paidAmount,
    balance,
    paymentStatus,
    invoiceNumber: body.invoiceNumber || '',
    reference: body.reference || '',
    orderedDate: body.orderedDate ? new Date(body.orderedDate) : new Date(),
    expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
    notes: body.notes || '',
    clientKey: body.clientKey || null,
  });

  if (paidAmount > 0) await recordSupplierPayment(req, purchase, paidAmount, body.paymentMethod || 'cash', 'Payment on purchase order');

  return { purchase, duplicate: false };
}

/** Record goods received. Increases stock through the normal weighted-average flow. */
export async function receivePurchase(req, purchase, receiveItems) {
  if (purchase.status === 'cancelled') throw ApiError.conflict('This purchase order was cancelled', 'PURCHASE_CANCELLED');
  if (purchase.status === 'received') throw ApiError.conflict('All goods on this order were already received', 'ALREADY_RECEIVED');

  for (const item of receiveItems) {
    const line = purchase.items.find((l) => String(l.product) === String(item.product));
    if (!line) throw ApiError.badRequest('A received product is not on this purchase order', 'INVALID_ITEM');
    const outstanding = round4(line.orderedQuantity - line.receivedQuantity);
    const qty = Number(item.quantity);
    if (!(qty > 0)) throw ApiError.badRequest('Enter a received quantity', 'INVALID_QUANTITY');
    if (qty > outstanding) {
      throw ApiError.badRequest(
        `Only ${outstanding} ${line.unitName || ''} of ${line.name} is still outstanding.`,
        'RECEIVE_EXCEEDS_ORDER',
        { outstanding, requested: qty }
      );
    }
    if (item.unitCost !== undefined && item.unitCost !== null && item.unitCost !== '') {
      line.unitCost = Math.max(0, Number(item.unitCost));
      line.lineTotal = round2(line.orderedQuantity * line.unitCost);
    }
  }

  const date = new Date();
  for (const item of receiveItems) {
    const line = purchase.items.find((l) => String(l.product) === String(item.product));
    const qty = Number(item.quantity);
    await recordStockIn({
      product: line.product,
      branch: purchase.branch,
      quantity: qty,
      unitCost: line.unitCost,
      type: 'purchase_receipt',
      sourceType: 'purchase',
      sourceId: purchase._id,
      sourceNumber: purchase.purchaseNumber,
      supplier: purchase.supplier,
      unit: line.unit,
      unitName: line.unitName,
      employee: req.user._id,
      employeeName: req.user.name,
      reason: 'Goods received',
      notes: '',
      date,
    });
    line.receivedQuantity = round4(line.receivedQuantity + qty);
  }

  const allReceived = purchase.items.every((l) => l.receivedQuantity >= l.orderedQuantity);
  purchase.status = allReceived ? 'received' : 'partially_received';
  purchase.receivedDate = date;
  purchase.receivedBy = req.user._id;
  purchase.receivedByName = req.user.name;
  purchase.subtotal = round2(purchase.items.reduce((s, i) => s + i.receivedQuantity * i.unitCost, 0));
  purchase.total = round2(purchase.subtotal + purchase.taxTotal);
  purchase.balance = round2(purchase.total - purchase.paidAmount);
  purchase.paymentStatus = purchase.balance <= 0 ? 'paid' : purchase.paidAmount > 0 ? 'partial' : 'unpaid';
  await purchase.save();

  return purchase;
}

/** Record a payment to the supplier and reduce the payable. */
export async function recordSupplierPayment(req, purchase, amount, method = 'cash', notes = '') {
  const { Payment } = await import('../models/Payment.js');
  const settings = await getSettings();
  const value = Math.min(Math.max(0, Number(amount) || 0), purchase.balance);
  if (value <= 0) throw ApiError.badRequest('Enter a payment amount greater than zero', 'INVALID_AMOUNT');

  const reference = await nextNumber('payment', settings.receiptNumberFormat || 'RCP-{YYYY}-{0000}');
  await Payment.create({
    reference,
    type: 'supplier_payment',
    party: purchase.supplier,
    partyName: purchase.supplierName,
    branch: purchase.branch,
    amount: value,
    method,
    date: new Date(),
    purchase: purchase._id,
    recordedBy: req.user._id,
    recordedByName: req.user.name,
    notes: notes || `Payment on purchase ${purchase.purchaseNumber}`,
  });

  purchase.paidAmount = round2(purchase.paidAmount + value);
  purchase.balance = round2(purchase.total - purchase.paidAmount);
  purchase.paymentStatus = purchase.balance <= 0 ? 'paid' : 'partial';
  await purchase.save();
  return purchase;
}

/** Build a purchase order draft from low-stock products. */
export async function buildLowStockOrder({ branch, category } = {}) {
  const match = { active: true, minStock: { $gt: 0 }, $expr: { $lte: ['$totalStock', '$minStock'] } };
  if (category && category !== 'all') match.category = category;
  const products = await Product.find(match).populate('preferredSupplier', 'name _id').populate('unit', 'name code').lean();
  const groups = new Map();
  for (const p of products) {
    const supplierId = p.preferredSupplier?._id ? String(p.preferredSupplier._id) : 'none';
    if (!groups.has(supplierId)) {
      groups.set(supplierId, {
        supplier: p.preferredSupplier || null,
        supplierName: p.preferredSupplier?.name || 'No preferred supplier',
        items: [],
      });
    }
    const suggested = p.reorderQuantity > 0 ? p.reorderQuantity : Math.max(0, p.minStock * 2 - p.totalStock);
    groups.get(supplierId).items.push({
      product: p._id,
      name: p.name,
      sku: p.sku,
      unitName: p.unit?.name || '',
      currentStock: p.totalStock,
      minStock: p.minStock,
      suggestedQuantity: suggested,
      unitCost: p.purchaseCost,
    });
  }
  return [...groups.values()];
}

export default createPurchase;
