import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { Unit } from '../models/Unit.js';
import { Customer } from '../models/Customer.js';
import { getSettings } from './settings.service.js';
import { recordStockIn, recordStockOut, round2 } from './inventory.service.js';
import { nextNumber } from '../models/Counter.js';
import { ApiError } from '../utils/apiError.js';
import { DISCOUNT_APPROVAL_THRESHOLD_PERCENT } from '../config/permissions.js';

export const round4 = (n) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;

/**
 * Build the priced line items for an invoice.
 * Tax handling follows the business settings: tax is only applied to products
 * flagged as taxable, and each product may carry its own rate.
 */
export function priceLines(items, { taxEnabled, defaultTaxRate, taxInclusive }) {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice) || 0;
    const gross = round2(quantity * unitPrice);

    let discount = 0;
    const discountType = item.discountType || 'none';
    const discountValue = Number(item.discountValue) || 0;
    if (discountType === 'percent') discount = round2((gross * Math.min(discountValue, 100)) / 100);
    else if (discountType === 'amount') discount = round2(Math.min(discountValue, gross));

    const net = round2(gross - discount);
    const taxRate = taxEnabled && item.taxable ? Number(item.taxRate ?? defaultTaxRate) : 0;
    const tax = taxInclusive ? 0 : round2((net * taxRate) / 100);
    const lineTotal = taxInclusive ? net : round2(net + tax);

    return {
      ...item,
      quantity,
      unitPrice,
      discountType,
      discountValue,
      discount,
      taxRate,
      tax,
      lineTotal,
    };
  });
}

export function totalsFor(lines) {
  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.tax, 0));
  const total = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  return { subtotal, discountTotal, taxTotal, total };
}

/**
 * Create a sales invoice.
 *  - validates availability server side (never trusts the client)
 *  - deducts stock and writes the ledger
 *  - compensates earlier lines if a later line fails
 *  - rejects duplicate submissions via clientKey
 */
export async function createSale(req, body) {
  const settings = await getSettings();

  if (body.clientKey) {
    const existing = await Sale.findOne({ clientKey: body.clientKey });
    if (existing) return { sale: existing, duplicate: true };
  }

  const branch = body.branch || req.user.branch || settings.defaultBranch;
  if (!branch) throw ApiError.badRequest('Select a branch for this sale', 'BRANCH_REQUIRED');

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) throw ApiError.badRequest('Add at least one product to the invoice', 'NO_ITEMS');

  // Discount approval policy
  const maxDiscount = Number(body.maxDiscountPercent ?? DISCOUNT_APPROVAL_THRESHOLD_PERCENT);
  const appliedPercent = rawItems.reduce((max, item) => {
    if (item.discountType !== 'percent') return max;
    return Math.max(max, Number(item.discountValue) || 0);
  }, 0);
  if (appliedPercent > maxDiscount && !req.user.permissions?.includes?.('sales.discount.approve')) {
    const role = req.user.role;
    const canApprove = ['owner', 'manager'].includes(role);
    if (!canApprove) {
      throw ApiError.forbidden(
        `A ${appliedPercent}% discount needs manager approval (limit ${maxDiscount}%).`,
        'DISCOUNT_APPROVAL_REQUIRED'
      );
    }
  }

  // Resolve products & units
  const productIds = rawItems.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const unitIds = products.map((p) => p.unit);
  const units = await Unit.find({ _id: { $in: unitIds } });
  const unitMap = new Map(units.map((u) => [String(u._id), u]));

  const items = rawItems.map((item) => {
    const product = productMap.get(String(item.product));
    if (!product) throw ApiError.badRequest(`Product ${item.product} was not found`, 'PRODUCT_NOT_FOUND');
    const unit = unitMap.get(String(product.unit));
    return {
      product: product._id,
      name: product.name,
      nameAm: product.nameAm || '',
      sku: product.sku,
      unit: product.unit,
      unitName: unit?.name || '',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice) || 0,
      discountType: item.discountType || 'none',
      discountValue: Number(item.discountValue) || 0,
      taxRate: item.taxRate ?? product.taxRate ?? settings.taxRate,
      taxable: item.taxable ?? product.taxable,
      branch,
    };
  });

  for (const item of items) {
    if (!(item.quantity > 0)) throw ApiError.badRequest(`Enter a quantity for ${item.name}`, 'INVALID_QUANTITY');
    if (item.unitPrice < 0) throw ApiError.badRequest(`Invalid price for ${item.name}`, 'INVALID_PRICE');
  }

  const priced = priceLines(items, {
    taxEnabled: settings.taxEnabled && settings.showTaxOnInvoice !== false,
    defaultTaxRate: settings.taxRate,
    taxInclusive: settings.taxInclusivePrices,
  });
  const totals = totalsFor(priced);

  const paidAmount = Math.min(Math.max(0, Number(body.paidAmount) || 0), totals.total);
  const balance = round2(totals.total - paidAmount);
  const paymentStatus = balance <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  let customerName = 'Walk-in Customer';
  let customerType = 'cash';
  if (body.customer) {
    const customer = await Customer.findById(body.customer);
    if (!customer) throw ApiError.badRequest('Selected customer was not found', 'CUSTOMER_NOT_FOUND');
    customerName = customer.name;
    if (balance > 0) {
      customerType = 'credit';
      const limit = customer.creditLimit || 0;
      if (limit > 0) {
        const { customerBalance } = await import('./parties.service.js');
        const current = await customerBalance(customer._id);
        if (round2(current.balance + balance) > limit) {
          throw ApiError.conflict(
            `This sale would exceed the credit limit for ${customer.name} (limit ${limit} ETB).`,
            'CREDIT_LIMIT_EXCEEDED',
            { limit, currentBalance: current.balance, saleBalance: balance }
          );
        }
      }
    }
  }

  const invoiceNumber = await nextNumber('sale', settings.invoiceNumberFormat || 'INV-{YYYY}-{0000}');
  const date = body.date ? new Date(body.date) : new Date();

  const sale = new Sale({
    invoiceNumber,
    branch,
    customer: body.customer || null,
    customerName,
    customerType,
    items: priced.map((l) => ({
      ...l,
      unitCost: 0,
      costTotal: 0,
      lineTotal: l.lineTotal,
    })),
    ...totals,
    costTotal: 0,
    grossProfit: 0,
    paidAmount,
    balance,
    paymentStatus,
    paymentMethod: body.paymentMethod || 'cash',
    reference: body.reference || '',
    status: 'completed',
    soldBy: req.user._id,
    soldByName: req.user.name,
    notes: body.notes || '',
    clientKey: body.clientKey || null,
    date,
  });

  // Deduct stock line by line, compensating on failure.
  const applied = [];
  try {
    for (const line of sale.items) {
      const result = await recordStockOut({
        product: line.product,
        branch,
        quantity: line.quantity,
        type: 'sale',
        sourceType: 'sale',
        sourceNumber: invoiceNumber,
        customer: sale.customer,
        unit: line.unit,
        unitName: line.unitName,
        employee: req.user._id,
        employeeName: req.user.name,
        reason: 'Sale',
        notes: '',
        date,
      });
      line.unitCost = result.unitCost;
      line.costTotal = round2(result.unitCost * line.quantity);
      applied.push({ line, result });
    }
  } catch (error) {
    for (const { line, result } of applied.reverse()) {
      await recordStockIn({
        product: line.product,
        branch,
        quantity: line.quantity,
        unitCost: result.unitCost,
        type: 'sale_return',
        sourceType: 'sale_reversal',
        sourceNumber: invoiceNumber,
        customer: sale.customer,
        unit: line.unit,
        unitName: line.unitName,
        employee: req.user._id,
        employeeName: req.user.name,
        reason: 'Automatic reversal of failed sale',
        date,
      });
    }
    throw error;
  }

  sale.costTotal = round2(sale.items.reduce((s, l) => s + l.costTotal, 0));
  sale.grossProfit = round2(totals.subtotal - totals.discountTotal - sale.costTotal);

  await sale.save();

  // Register the receipt recorded at the point of sale (cash actually received).
  // Walk-in sales are booked against the invoice itself so they never distort a
  // customer statement, but they still count as cash received.
  if (paidAmount > 0) {
    const { Payment } = await import('../models/Payment.js');
    const paymentRef = await nextNumber('payment', settings.receiptNumberFormat || 'RCP-{YYYY}-{0000}');
    await Payment.create({
      reference: paymentRef,
      type: 'customer_receipt',
      party: sale.customer || sale._id,
      partyName: customerName,
      branch,
      amount: paidAmount,
      method: sale.paymentMethod,
      date,
      sale: sale._id,
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      notes: `Payment on invoice ${invoiceNumber}`,
    });
  }

  return { sale, duplicate: false };
}

/** Cancel a completed invoice: return every line to stock and void the invoice. */
export async function cancelSale(req, sale, reason) {
  if (sale.status === 'cancelled') throw ApiError.conflict('This invoice is already cancelled', 'ALREADY_CANCELLED');

  for (const line of sale.items) {
    await recordStockIn({
      product: line.product,
      branch: line.branch || sale.branch,
      quantity: line.quantity - (line.returnedQuantity || 0),
      unitCost: line.unitCost,
      type: 'sale_return',
      sourceType: 'sale_cancellation',
      sourceNumber: sale.invoiceNumber,
      customer: sale.customer,
      unit: line.unit,
      unitName: line.unitName,
      employee: req.user._id,
      employeeName: req.user.name,
      reason: 'Invoice cancelled',
      notes: reason || '',
      date: new Date(),
    });
  }

  sale.status = 'cancelled';
  sale.cancelledAt = new Date();
  sale.cancelledBy = req.user._id;
  sale.cancelReason = reason || '';
  sale.balance = 0;
  sale.paymentStatus = 'paid';
  await sale.save();
  return sale;
}

/** Record a partial or full sales return against an invoice. */
export async function returnSale(req, sale, returnItems, { refundAmount = 0, method = 'cash', notes = '' } = {}) {
  if (sale.status === 'cancelled') throw ApiError.conflict('This invoice is cancelled', 'ALREADY_CANCELLED');

  const results = [];
  for (const item of returnItems) {
    const line = sale.items.find((l) => String(l.product) === String(item.product));
    if (!line) throw ApiError.badRequest('A returned product is not on this invoice', 'INVALID_RETURN_ITEM');
    const already = line.returnedQuantity || 0;
    const remaining = round4(line.quantity - already);
    const qty = Number(item.quantity);
    if (!(qty > 0)) throw ApiError.badRequest('Enter a return quantity', 'INVALID_QUANTITY');
    if (qty > remaining) {
      throw ApiError.badRequest(
        `Only ${remaining} of ${line.name} can still be returned.`,
        'RETURN_EXCEEDS_QUANTITY',
        { available: remaining, requested: qty }
      );
    }
    line.returnedQuantity = round4(already + qty);
    results.push({ line, qty });
  }

  for (const { line, qty } of results) {
    await recordStockIn({
      product: line.product,
      branch: line.branch || sale.branch,
      quantity: qty,
      unitCost: line.unitCost,
      type: 'sale_return',
      sourceType: 'sale_return',
      sourceNumber: sale.invoiceNumber,
      customer: sale.customer,
      unit: line.unit,
      unitName: line.unitName,
      employee: req.user._id,
      employeeName: req.user.name,
      reason: 'Sales return',
      notes,
      date: new Date(),
    });
  }

  const refund = Math.min(Math.max(0, Number(refundAmount) || 0), sale.balance);
  if (refund > 0 && sale.customer) {
    const { Payment } = await import('../models/Payment.js');
    const settings = await getSettings();
    const paymentRef = await nextNumber('payment', settings.receiptNumberFormat || 'RCP-{YYYY}-{0000}');
    await Payment.create({
      reference: paymentRef,
      type: 'customer_receipt',
      party: sale.customer,
      partyName: sale.customerName,
      branch: sale.branch,
      amount: -refund,
      method,
      date: new Date(),
      sale: sale._id,
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      notes: `Refund for return on invoice ${sale.invoiceNumber}`,
    });
  }

  const returnedValue = round2(
    results.reduce((s, { line, qty }) => s + line.lineTotal * (qty / line.quantity), 0)
  );
  sale.balance = round2(Math.max(0, sale.balance - returnedValue - refund));
  sale.total = round2(Math.max(0, sale.total - returnedValue));
  sale.subtotal = round2(Math.max(0, sale.subtotal - returnedValue));
  sale.costTotal = round2(Math.max(0, sale.costTotal - results.reduce((s, { line, qty }) => s + line.unitCost * qty, 0)));
  sale.grossProfit = round2(sale.subtotal - sale.costTotal);
  sale.paymentStatus = sale.balance <= 0 ? 'paid' : sale.paidAmount > 0 ? 'partial' : 'unpaid';
  sale.status = sale.items.every((l) => (l.returnedQuantity || 0) >= l.quantity) ? 'returned' : 'partial_return';
  await sale.save();

  return sale;
}

export default createSale;
