import { Sale } from '../models/Sale.js';
import { Purchase } from '../models/Purchase.js';
import { Payment } from '../models/Payment.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Customer position computed from saved records only:
 *   balance = opening balance + credit sales (sale.balance) - receipts received
 */
export async function customerBalance(customerId) {
  const [salesAgg, receiptAgg, cust] = await Promise.all([
    Sale.aggregate([
      { $match: { customer: customerId, status: { $in: ['completed', 'partial_return'] } } },
      { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, balance: { $sum: '$balance' }, cogs: { $sum: '$costTotal' }, profit: { $sum: '$grossProfit' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { type: 'customer_receipt', party: customerId } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.findOne({ type: 'customer_receipt', party: customerId }).lean(),
  ]);

  const sales = salesAgg[0] || { total: 0, paid: 0, balance: 0, cogs: 0, profit: 0, count: 0 };
  const receipts = receiptAgg[0] || { amount: 0, count: 0 };
  const opening = cust ? 0 : 0;

  return {
    openingBalance: opening,
    invoiceCount: sales.count,
    totalSales: round2(sales.total),
    totalPaid: round2(sales.paid),
    creditSales: round2(sales.balance),
    receipts: round2(receipts.amount),
    receiptCount: receipts.count,
    balance: round2(sales.balance - receipts.amount),
    lifetimeProfit: round2(sales.profit),
    lifetimeCogs: round2(sales.cogs),
  };
}

/**
 * Supplier position computed from saved records only:
 *   balance = purchases (purchase.balance) - payments made
 */
export async function supplierBalance(supplierId) {
  const [purchAgg, payAgg] = await Promise.all([
    Purchase.aggregate([
      { $match: { supplier: supplierId, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, balance: { $sum: '$balance' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { type: 'supplier_payment', party: supplierId } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const purchases = purchAgg[0] || { total: 0, paid: 0, balance: 0, count: 0 };
  const payments = payAgg[0] || { amount: 0, count: 0 };

  return {
    invoiceCount: purchases.count,
    totalPurchases: round2(purchases.total),
    totalPaid: round2(purchases.paid),
    payable: round2(purchases.balance),
    payments: round2(payments.amount),
    paymentCount: payments.count,
    balance: round2(purchases.balance - payments.amount),
  };
}

/** Batch version for list screens (avoids N+1 queries). */
export async function customerBalances(customerIds) {
  if (!customerIds.length) return new Map();
  const [sales, receipts] = await Promise.all([
    Sale.aggregate([
      { $match: { customer: { $in: customerIds }, status: { $in: ['completed', 'partial_return'] } } },
      { $group: { _id: '$customer', balance: { $sum: '$balance' }, total: { $sum: '$total' }, profit: { $sum: '$grossProfit' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { type: 'customer_receipt', party: { $in: customerIds } } },
      { $group: { _id: '$party', amount: { $sum: '$amount' } } },
    ]),
  ]);
  const map = new Map();
  for (const id of customerIds) {
    map.set(String(id), { balance: 0, totalSales: 0, lifetimeProfit: 0, invoiceCount: 0, receipts: 0 });
  }
  for (const s of sales) {
    const entry = map.get(String(s._id));
    if (entry) {
      entry.creditSales = round2(s.balance);
      entry.balance = round2(s.balance);
      entry.totalSales = round2(s.total);
      entry.lifetimeProfit = round2(s.profit);
      entry.invoiceCount = s.count;
    }
  }
  for (const r of receipts) {
    const entry = map.get(String(r._id));
    if (entry) {
      entry.receipts = round2(r.amount);
      entry.balance = round2(entry.balance - r.amount);
    }
  }
  return map;
}

export async function supplierBalances(supplierIds) {
  if (!supplierIds.length) return new Map();
  const [purchases, payments] = await Promise.all([
    Purchase.aggregate([
      { $match: { supplier: { $in: supplierIds }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$supplier', balance: { $sum: '$balance' }, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { type: 'supplier_payment', party: { $in: supplierIds } } },
      { $group: { _id: '$party', amount: { $sum: '$amount' } } },
    ]),
  ]);
  const map = new Map();
  for (const id of supplierIds) {
    map.set(String(id), { balance: 0, totalPurchases: 0, invoiceCount: 0, payments: 0, payable: 0 });
  }
  for (const p of purchases) {
    const entry = map.get(String(p._id));
    if (entry) {
      entry.payable = round2(p.balance);
      entry.balance = round2(p.balance);
      entry.totalPurchases = round2(p.total);
      entry.invoiceCount = p.count;
    }
  }
  for (const p of payments) {
    const entry = map.get(String(p._id));
    if (entry) {
      entry.payments = round2(p.amount);
      entry.balance = round2(entry.balance - p.amount);
    }
  }
  return map;
}

export { round2 };
