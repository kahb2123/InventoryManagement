import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { ProductStock } from '../models/ProductStock.js';
import { StockMovement } from '../models/StockMovement.js';
import { ApiError } from '../utils/apiError.js';
import { getSettings } from './settings.service.js';
import { nextNumber } from '../models/Counter.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;

/**
 * Weighted average cost (moving average) is used for all inventory valuation.
 *
 * stock-in  : avg' = (qty*avg + qtyIn*unitCost) / (qty + qtyIn)
 * stock-out : avg' = avg            (cost of the goods leaving is captured at the
 *                                     current average and stored on the ledger row)
 */
export const COSTING_METHOD = 'weighted_average';

export async function getStockRow(productId, branchId) {
  return ProductStock.findOne({ product: productId, branch: branchId });
}

export async function listStockRows({ productId, branchId } = {}) {
  const filter = {};
  if (productId) filter.product = productId;
  if (branchId) filter.branch = branchId;
  return ProductStock.find(filter).sort({ product: 1 });
}

/** Rebuild product-level totals from the per-branch rows (source of truth). */
export async function recalcProductTotals(productId) {
  const rows = await ProductStock.find({ product: productId }).lean();
  const totalStock = round2(rows.reduce((s, r) => s + r.quantity, 0));
  const totalStockValue = round2(rows.reduce((s, r) => s + r.totalValue, 0));
  await Product.findByIdAndUpdate(productId, { $set: { totalStock, totalStockValue } });
  return { totalStock, totalStockValue };
}

async function writeLedger(doc) {
  const settings = await getSettings();
  const movementNumber = await nextNumber('movement', settings.movementNumberFormat || 'MOV-{YYYY}-{0000}');
  const row = await StockMovement.create({ ...doc, movementNumber });
  return row;
}

/**
 * Increase stock. Creates the ProductStock row when missing.
 */
export async function recordStockIn({
  product,
  branch,
  quantity,
  unitCost = 0,
  type = 'stock_in',
  sourceType = '',
  sourceId = null,
  sourceNumber = '',
  supplier = null,
  customer = null,
  fromBranch = null,
  toBranch = null,
  transferGroup = '',
  inTransit = false,
  employee = null,
  employeeName = '',
  reason = '',
  notes = '',
  approvedBy = null,
  date = new Date(),
  unit = null,
  unitName = '',
}) {
  const qty = Number(quantity);
  if (!(qty > 0)) throw ApiError.badRequest('Quantity must be greater than zero', 'INVALID_QUANTITY');

  const cost = Math.max(0, Number(unitCost) || 0);
  const value = round2(qty * cost);

  const updated = await ProductStock.findOneAndUpdate(
    { product, branch },
    [
      {
        $set: {
          quantity: { $add: [{ $ifNull: ['$quantity', 0] }, qty] },
          totalValue: { $add: [{ $ifNull: ['$totalValue', 0] }, value] },
        },
      },
      {
        $set: {
          averageCost: {
            $cond: [
              { $gt: [{ $add: [{ $ifNull: ['$quantity', 0] }, qty] }, 0] },
              {
                $divide: [
                  { $add: [{ $ifNull: ['$totalValue', 0] }, value] },
                  { $add: [{ $ifNull: ['$quantity', 0] }, qty] },
                ],
              },
              0,
            ],
          },
          lastMovementAt: date,
        },
      },
    ],
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const balanceAfter = round2(updated.quantity);

  const movement = await writeLedger({
    product,
    branch,
    type,
    direction: 'in',
    quantity: qty,
    unit,
    unitName,
    unitCost: cost,
    value,
    balanceAfter,
    sourceType,
    sourceId,
    sourceNumber,
    supplier,
    customer,
    fromBranch,
    toBranch,
    transferGroup,
    inTransit,
    employee,
    employeeName,
    reason,
    notes,
    approvedBy,
    date,
  });

  await Product.updateOne(
    { _id: product },
    { $inc: { totalStock: qty, totalStockValue: value } }
  );

  return { movement, balanceAfter, averageCost: round4(updated.averageCost) };
}

/**
 * Decrease stock. Refuses to go below zero unless `allowNegative` is set by an
 * authorised adjustment flow (owner/manager only, always audited).
 */
export async function recordStockOut({
  product,
  branch,
  quantity,
  type = 'stock_out',
  sourceType = '',
  sourceId = null,
  sourceNumber = '',
  customer = null,
  supplier = null,
  fromBranch = null,
  toBranch = null,
  transferGroup = '',
  inTransit = false,
  employee = null,
  employeeName = '',
  reason = '',
  notes = '',
  approvedBy = null,
  date = new Date(),
  unit = null,
  unitName = '',
  allowNegative = false,
}) {
  const qty = Number(quantity);
  if (!(qty > 0)) throw ApiError.badRequest('Quantity must be greater than zero', 'INVALID_QUANTITY');

  const filter = { product, branch };
  if (!allowNegative) filter.quantity = { $gte: qty };

  const updated = await ProductStock.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          quantity: { $subtract: [{ $ifNull: ['$quantity', 0] }, qty] },
          totalValue: {
            $subtract: [
              { $ifNull: ['$totalValue', 0] },
              { $multiply: [{ $ifNull: ['$averageCost', 0] }, qty] },
            ],
          },
          lastMovementAt: date,
        },
      },
    ],
    { new: true }
  );

  if (!updated) {
    const current = await getStockRow(product, branch);
    const available = current ? round2(current.quantity) : 0;
    throw ApiError.conflict(
      `Insufficient stock. Available ${available}${unitName ? ` ${unitName}` : ''}, requested ${qty}.`,
      'INSUFFICIENT_STOCK',
      { available, requested: qty, product: String(product), branch: String(branch) }
    );
  }

  const unitCost = round4(updated.averageCost);
  const value = round2(qty * unitCost);
  const balanceAfter = round2(updated.quantity);

  const movement = await writeLedger({
    product,
    branch,
    type,
    direction: 'out',
    quantity: qty,
    unit,
    unitName,
    unitCost,
    value,
    balanceAfter,
    sourceType,
    sourceId,
    sourceNumber,
    customer,
    supplier,
    fromBranch,
    toBranch,
    transferGroup,
    inTransit,
    employee,
    employeeName,
    reason,
    notes,
    approvedBy,
    date,
  });

  await Product.updateOne(
    { _id: product },
    { $inc: { totalStock: -qty, totalStockValue: -value } }
  );

  return { movement, balanceAfter, unitCost, value };
}

/**
 * Move stock between branches. The quantity leaves the source immediately and
 * arrives at the destination; a single transfer group links both ledger rows so
 * stock is never duplicated.
 */
export async function transferStock({
  product,
  fromBranch,
  toBranch,
  quantity,
  unitCost,
  unit = null,
  unitName = '',
  employee = null,
  employeeName = '',
  notes = '',
  approvedBy = null,
  date = new Date(),
  inTransit = false,
}) {
  if (String(fromBranch) === String(toBranch)) {
    throw ApiError.badRequest('Source and destination branches must be different', 'SAME_BRANCH');
  }
  const qty = Number(quantity);
  if (!(qty > 0)) throw ApiError.badRequest('Quantity must be greater than zero', 'INVALID_QUANTITY');

  const transferGroup = `TRF-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  const cost = unitCost !== undefined ? Number(unitCost) : undefined;

  const out = await recordStockOut({
    product,
    branch: fromBranch,
    quantity: qty,
    type: 'transfer_out',
    sourceType: 'transfer',
    transferGroup,
    fromBranch,
    toBranch,
    unit,
    unitName,
    employee,
    employeeName,
    reason: 'Branch transfer',
    notes,
    approvedBy,
    date,
    inTransit,
  });

  let inResult = null;
  try {
    inResult = await recordStockIn({
      product,
      branch: toBranch,
      quantity: qty,
      unitCost: cost !== undefined ? cost : out.unitCost,
      type: 'transfer_in',
      sourceType: 'transfer',
      transferGroup,
      fromBranch,
      toBranch,
      unit,
      unitName,
      employee,
      employeeName,
      reason: 'Branch transfer',
      notes,
      approvedBy,
      date,
      inTransit,
    });
  } catch (error) {
    // Compensate the outbound leg so the ledger stays balanced.
    await recordStockIn({
      product,
      branch: fromBranch,
      quantity: qty,
      unitCost: out.unitCost,
      type: 'transfer_in',
      sourceType: 'transfer_reversal',
      transferGroup,
      fromBranch,
      toBranch,
      unit,
      unitName,
      employee,
      employeeName,
      reason: 'Transfer reversal',
      notes: 'Automatic reversal of failed transfer',
      approvedBy,
      date,
    });
    throw error;
  }

  return { transferGroup, out, in: inResult };
}

/** Stock position for a product across all branches. */
export async function stockSnapshot(productId) {
  const rows = await listStockRows({ productId });
  return {
    totalQuantity: round2(rows.reduce((s, r) => s + r.quantity, 0)),
    totalValue: round2(rows.reduce((s, r) => s + r.totalValue, 0)),
    branches: rows.map((r) => ({
      branch: r.branch,
      quantity: r.quantity,
      averageCost: r.averageCost,
      totalValue: r.totalValue,
    })),
  };
}

export async function ensureProductStock(productIds, branchIds) {
  const docs = [];
  for (const productId of productIds) {
    for (const branchId of branchIds) {
      const exists = await ProductStock.exists({ product: productId, branch: branchId });
      if (!exists) docs.push({ product: productId, branch: branchId, quantity: 0, averageCost: 0, totalValue: 0 });
    }
  }
  if (docs.length) await ProductStock.insertMany(docs, { ordered: false });
}

export { round2, round4 };
export default {
  recordStockIn,
  recordStockOut,
  transferStock,
  recalcProductTotals,
  listStockRows,
  getStockRow,
  stockSnapshot,
  ensureProductStock,
};
