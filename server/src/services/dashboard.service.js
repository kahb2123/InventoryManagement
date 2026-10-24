import { Sale } from '../models/Sale.js';
import { Purchase } from '../models/Purchase.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Payment } from '../models/Payment.js';
import { Expense } from '../models/Expense.js';
import { ProductStock } from '../models/ProductStock.js';
import { Branch } from '../models/Branch.js';
import { getSettings } from './settings.service.js';
import { dayRange, rangeForDays, parseDateFilter } from '../utils/datetime.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const ACTIVE_SALE_STATUSES = ['completed', 'partial_return'];

export async function buildDashboard({ days = 7, branch = null, from, to, tenantId } = {}) {
  const settings = await getSettings();
  const tz = settings.timezone || 'Africa/Addis_Ababa';
  const today = dayRange(new Date(), tz);
  const period = from || to ? parseDateFilter(from, to, days) : rangeForDays(days, tz);
  const tenantFilter = { tenantId };
  const branchFilter = branch && branch !== 'all' ? { branch } : {};

  const saleFilter = { ...tenantFilter, ...branchFilter, date: period, status: { $in: ACTIVE_SALE_STATUSES } };
  const purchaseFilter = { ...tenantFilter, ...branchFilter, orderedDate: period, status: { $ne: 'cancelled' } };

  const [
    productCount,
    stockAgg,
    todaySalesAgg,
    todayPurchasesAgg,
    periodSalesAgg,
    periodPurchaseAgg,
    periodProfitAgg,
    todayProfitAgg,
    receivablesAgg,
    receiptsAgg,
    payablesAgg,
    supplierPaymentsAgg,
    lowStockCount,
    outOfStockCount,
    salesTrend,
    purchasesTrend,
    bestSellers,
    inventoryByCategory,
    monthlyTrend,
    recentSales,
    recentPurchases,
    lowStockAlerts,
    expenseAgg,
    customerDebtAgg,
    supplierDebtAgg,
  ] = await Promise.all([
    Product.countDocuments({ active: true }),
    Product.aggregate([{ $match: { tenantId } }, { $group: { _id: null, quantity: { $sum: '$totalStock' }, value: { $sum: '$totalStockValue' } } }]),

    Sale.aggregate([{ $match: { ...branchFilter, date: today, status: { $in: ACTIVE_SALE_STATUSES } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Purchase.aggregate([{ $match: { ...branchFilter, orderedDate: today, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),

    Sale.aggregate([{ $match: saleFilter }, { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, cost: { $sum: '$costTotal' }, count: { $sum: 1 } } }]),
    Purchase.aggregate([{ $match: purchaseFilter }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Sale.aggregate([{ $match: saleFilter }, { $group: { _id: null, profit: { $sum: '$grossProfit' } } }]),
    Sale.aggregate([{ $match: { ...branchFilter, date: today, status: { $in: ACTIVE_SALE_STATUSES } } }, { $group: { _id: null, profit: { $sum: '$grossProfit' } } }]),

    Sale.aggregate([{ $match: { ...tenantFilter, status: { $in: ACTIVE_SALE_STATUSES } } }, { $group: { _id: null, balance: { $sum: '$balance' } } }]),
    Payment.aggregate([{ $match: { ...tenantFilter, type: 'customer_receipt' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Purchase.aggregate([{ $match: { ...tenantFilter, status: { $ne: 'cancelled' } } }, { $group: { _id: null, balance: { $sum: '$balance' } } }]),
    Payment.aggregate([{ $match: { ...tenantFilter, type: 'supplier_payment' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),

    Product.countDocuments({ active: true, minStock: { $gt: 0 }, $expr: { $lte: ['$totalStock', '$minStock'] } }),
    Product.countDocuments({ active: true, totalStock: { $lte: 0 } }),

    Sale.aggregate([
      { $match: saleFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz } },
          sales: { $sum: '$total' },
          profit: { $sum: '$grossProfit' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Purchase.aggregate([
      { $match: purchaseFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$orderedDate', timezone: tz } },
          purchases: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Sale.aggregate([
      { $match: saleFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          sku: { $first: '$items.sku' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
          profit: { $sum: { $multiply: ['$items.quantity', { $subtract: ['$items.unitPrice', '$items.unitCost'] }] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    Product.aggregate([
      { $match: { ...tenantFilter, active: true } },
      { $group: { _id: '$category', value: { $sum: '$totalStockValue' }, quantity: { $sum: '$totalStock' } } },
      { $sort: { value: -1 } },
    ]),
    Sale.aggregate([
      { $match: saleFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: tz } },
          sales: { $sum: '$total' },
          profit: { $sum: '$grossProfit' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Sale.find({ ...branchFilter, status: { $in: ACTIVE_SALE_STATUSES } })
      .sort({ date: -1 })
      .limit(6)
      .populate('branch', 'name code')
      .populate('soldBy', 'name')
      .lean(),
    Purchase.find({ ...branchFilter, status: { $ne: 'cancelled' } })
      .sort({ orderedDate: -1 })
      .limit(6)
      .populate('branch', 'name code')
      .populate('supplier', 'name')
      .lean(),
    Product.find({ active: true, minStock: { $gt: 0 }, $expr: { $lte: ['$totalStock', '$minStock'] } })
      .sort({ totalStock: 1 })
      .limit(8)
      .populate('unit', 'name code')
      .populate('category', 'name')
      .populate('preferredSupplier', 'name phone')
      .lean(),
    Expense.aggregate([{ $match: { ...tenantFilter, date: period } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Sale.aggregate([
      { $match: { ...tenantFilter, status: { $in: ACTIVE_SALE_STATUSES } } },
      { $group: { _id: '$customer', balance: { $sum: '$balance' } } },
      { $match: { balance: { $gt: 0 } } },
      { $sort: { balance: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      { $project: { balance: 1, name: { $ifNull: ['$customer.name', 'Walk-in Customer'] }, phone: '$customer.phone' } },
    ]),
    Purchase.aggregate([
      { $match: { ...tenantFilter, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$supplier', balance: { $sum: '$balance' } } },
      { $match: { balance: { $gt: 0 } } },
      { $sort: { balance: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 'supplier' } },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
      { $project: { balance: 1, name: { $ifNull: ['$supplier.name', 'Supplier'] }, phone: '$supplier.phone' } },
    ]),
  ]);

  const categoryDocs = await Category.find({ _id: { $in: inventoryByCategory.map((c) => c._id) } }).lean();
  const categoryMap = new Map(categoryDocs.map((c) => [String(c._id), c]));

  const periodSales = periodSalesAgg[0] || { total: 0, paid: 0, cost: 0, count: 0 };
  const periodPurchases = periodPurchaseAgg[0] || { total: 0, count: 0 };
  const grossProfit = round2(periodProfitAgg[0]?.profit || 0);
  const expenses = round2(expenseAgg[0]?.amount || 0);
  const receivables = round2((receivablesAgg[0]?.balance || 0) - (receiptsAgg[0]?.amount || 0));
  const payables = round2((payablesAgg[0]?.balance || 0) - (supplierPaymentsAgg[0]?.amount || 0));

  return {
    generatedAt: new Date(),
    period: { days, from: period.$gte, to: period.$lte, timezone: tz },
    currency: settings.currency,
    cards: {
      totalItems: productCount,
      totalQuantity: round2(stockAgg[0]?.quantity || 0),
      inventoryValueAtCost: round2(stockAgg[0]?.value || 0),
      todaySales: round2(todaySalesAgg[0]?.total || 0),
      todaySalesCount: todaySalesAgg[0]?.count || 0,
      todayPurchases: round2(todayPurchasesAgg[0]?.total || 0),
      todayPurchasesCount: todayPurchasesAgg[0]?.count || 0,
      outstandingCustomerPayments: receivables,
      outstandingSupplierPayments: payables,
      lowStockItems: lowStockCount,
      outOfStockItems: outOfStockCount,
      estimatedGrossProfit: grossProfit,
      todayGrossProfit: round2(todayProfitAgg[0]?.profit || 0),
      periodSales: round2(periodSales.total),
      periodSalesCount: periodSales.count,
      periodPurchases: round2(periodPurchases.total),
      periodExpenses: expenses,
      estimatedNetProfit: round2(grossProfit - expenses),
      cashCollected: round2(periodSales.paid),
      costOfGoodsSold: round2(periodSales.cost),
    },
    charts: {
      salesTrend: salesTrend.map((d) => ({ date: d._id, sales: round2(d.sales), profit: round2(d.profit), count: d.count })),
      purchasesTrend: purchasesTrend.map((d) => ({ date: d._id, purchases: round2(d.purchases), count: d.count })),
      bestSellers: bestSellers.map((b) => ({
        id: b._id,
        name: b.name,
        sku: b.sku,
        quantity: round2(b.quantity),
        revenue: round2(b.revenue),
        profit: round2(b.profit),
      })),
      inventoryByCategory: inventoryByCategory.map((c) => ({
        category: categoryMap.get(String(c._id))?.name || 'Uncategorised',
        categoryAm: categoryMap.get(String(c._id))?.nameAm || '',
        color: categoryMap.get(String(c._id))?.color || '#1769FF',
        value: round2(c.value),
        quantity: round2(c.quantity),
      })),
      monthlyTrend: monthlyTrend.map((m) => ({ month: m._id, sales: round2(m.sales), profit: round2(m.profit) })),
    },
    recentSales,
    recentPurchases,
    lowStockAlerts,
    pendingCustomerPayments: customerDebtAgg.map((c) => ({ ...c, balance: round2(c.balance) })),
    pendingSupplierPayments: supplierDebtAgg.map((s) => ({ ...s, balance: round2(s.balance) })),
  };
}

/** Branch comparison for multi-branch businesses. */
export async function branchComparison({ from, to, tenantId } = {}) {
  const settings = await getSettings();
  const tz = settings.timezone || 'Africa/Addis_Ababa';
  const period = from || to ? parseDateFilter(from, to, 30) : rangeForDays(30, tz);
  const tenantFilter = { tenantId };
  const branches = await Branch.find({ active: true }).sort({ name: 1 }).lean();

  const sales = await Sale.aggregate([
    { $match: { ...tenantFilter, date: period, status: { $in: ACTIVE_SALE_STATUSES } } },
    { $group: { _id: '$branch', sales: { $sum: '$total' }, profit: { $sum: '$grossProfit' }, count: { $sum: 1 } } },
  ]);
  const purchases = await Purchase.aggregate([
    { $match: { ...tenantFilter, orderedDate: period, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$branch', purchases: { $sum: '$total' }, count: { $sum: 1 } } },
  ]);
  const stock = await ProductStock.aggregate([
    { $match: { ...tenantFilter } },
    { $group: { _id: '$branch', quantity: { $sum: '$quantity' }, value: { $sum: '$totalValue' } } },
  ]);

  const saleMap = new Map(sales.map((s) => [String(s._id), s]));
  const purchaseMap = new Map(purchases.map((p) => [String(p._id), p]));
  const stockMap = new Map(stock.map((s) => [String(s._id), s]));

  return branches.map((b) => {
    const s = saleMap.get(String(b._id)) || {};
    const p = purchaseMap.get(String(b._id)) || {};
    const st = stockMap.get(String(b._id)) || {};
    return {
      branch: b._id,
      name: b.name,
      nameAm: b.nameAm,
      code: b.code,
      sales: round2(s.sales || 0),
      profit: round2(s.profit || 0),
      saleCount: s.count || 0,
      purchases: round2(p.purchases || 0),
      purchaseCount: p.count || 0,
      stockQuantity: round2(st.quantity || 0),
      stockValue: round2(st.value || 0),
    };
  });
}

export default buildDashboard;
