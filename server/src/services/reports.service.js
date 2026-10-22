import { Sale } from '../models/Sale.js';
import { Purchase } from '../models/Purchase.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Customer } from '../models/Customer.js';
import { Supplier } from '../models/Supplier.js';
import { Payment } from '../models/Payment.js';
import { Expense } from '../models/Expense.js';
import { StockMovement } from '../models/StockMovement.js';
import { ProductStock } from '../models/ProductStock.js';
import { Branch } from '../models/Branch.js';
import { User } from '../models/User.js';
import { getSettings } from './settings.service.js';
import { parseDateFilter, rangeForDays, dayRange } from '../utils/datetime.js';
import { customerBalances, supplierBalances } from './parties.service.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const ACTIVE_SALE_STATUSES = ['completed', 'partial_return'];

/** Localised period key ("2026-10-20" or "2026-10") in the business timezone. */
function localPeriodKey(date, timeZone, mode = 'day') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    ...(mode === 'day' ? { day: '2-digit' } : {}),
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return mode === 'day' ? `${get('year')}-${get('month')}-${get('day')}` : `${get('year')}-${get('month')}`;
}

async function range({ from, to, days = 30 }) {
  const settings = await getSettings();
  const tz = settings.timezone || 'Africa/Addis_Ababa';
  return from || to ? parseDateFilter(from, to, days) : rangeForDays(days, tz);
}

function branchMatch(branch, field = 'branch') {
  return branch && branch !== 'all' ? { [field]: branch } : {};
}

export const REPORTS = {
  'daily-sales': {
    title: 'Daily Sales Report',
    columns: [
      { key: 'invoiceNumber', label: 'Invoice No' },
      { key: 'date', label: 'Date' },
      { key: 'customerName', label: 'Customer' },
      { key: 'items', label: 'Items' },
      { key: 'total', label: 'Total (ETB)' },
      { key: 'paidAmount', label: 'Paid (ETB)' },
      { key: 'balance', label: 'Balance (ETB)' },
      { key: 'paymentStatus', label: 'Payment Status' },
      { key: 'soldByName', label: 'Sold By' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const sales = await Sale.find({ ...branchMatch(query.branch), date: rangeFilter, status: { $in: ACTIVE_SALE_STATUSES } })
        .sort({ date: -1 })
        .populate('branch', 'name')
        .lean();
      const rows = sales.map((s) => ({
        invoiceNumber: s.invoiceNumber,
        date: new Date(s.date).toISOString().slice(0, 10),
        customerName: s.customerName,
        items: s.items.reduce((n, i) => n + i.quantity, 0),
        total: round2(s.total),
        paidAmount: round2(s.paidAmount),
        balance: round2(s.balance),
        paymentStatus: s.paymentStatus,
        soldByName: s.soldByName,
        branch: s.branch?.name || '',
      }));
      const summary = {
        invoices: rows.length,
        total: round2(rows.reduce((a, r) => a + r.total, 0)),
        paid: round2(rows.reduce((a, r) => a + r.paidAmount, 0)),
        balance: round2(rows.reduce((a, r) => a + r.balance, 0)),
      };
      return { rows, summary };
    },
  },

  'period-sales': {
    title: 'Sales Summary by Period',
    columns: [
      { key: 'period', label: 'Period' },
      { key: 'invoices', label: 'Invoices' },
      { key: 'itemsSold', label: 'Items Sold' },
      { key: 'total', label: 'Sales (ETB)' },
      { key: 'cost', label: 'Cost of Goods (ETB)' },
      { key: 'profit', label: 'Gross Profit (ETB)' },
      { key: 'margin', label: 'Margin %' },
    ],
    async run(query) {
      const settings = await getSettings();
      const tz = settings.timezone || 'Africa/Addis_Ababa';
      const groupBy = query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
      const rangeFilter = await range(query);
      const sales = await Sale.find({ ...branchMatch(query.branch), date: rangeFilter, status: { $in: ACTIVE_SALE_STATUSES } })
        .sort({ date: -1 })
        .lean();
      const grouped = new Map();
      for (const s of sales) {
        const key = localPeriodKey(new Date(s.date), tz, query.groupBy === 'month' ? 'month' : 'day');
        const entry = grouped.get(key) || { period: key, invoices: 0, itemsSold: 0, total: 0, cost: 0, profit: 0 };
        entry.invoices += 1;
        entry.itemsSold += s.items.reduce((n, i) => n + i.quantity, 0);
        entry.total += s.total;
        entry.cost += s.costTotal;
        entry.profit += s.grossProfit;
        grouped.set(key, entry);
      }
      const rows = [...grouped.values()]
        .sort((a, b) => b.period.localeCompare(a.period))
        .map((r) => ({
          ...r,
          total: round2(r.total),
          cost: round2(r.cost),
          profit: round2(r.profit),
          itemsSold: round2(r.itemsSold),
          margin: r.total > 0 ? round2((r.profit / r.total) * 100) : 0,
        }));
      const summary = {
        total: round2(rows.reduce((a, r) => a + r.total, 0)),
        profit: round2(rows.reduce((a, r) => a + r.profit, 0)),
        invoices: rows.reduce((a, r) => a + r.invoices, 0),
      };
      return { rows, summary };
    },
  },

  purchase: {
    title: 'Purchase Report',
    columns: [
      { key: 'purchaseNumber', label: 'PO No' },
      { key: 'orderedDate', label: 'Date' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'status', label: 'Status' },
      { key: 'items', label: 'Line Items' },
      { key: 'total', label: 'Total (ETB)' },
      { key: 'paidAmount', label: 'Paid (ETB)' },
      { key: 'balance', label: 'Payable (ETB)' },
      { key: 'branch', label: 'Branch' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const purchases = await Purchase.find({ ...branchMatch(query.branch), orderedDate: rangeFilter })
        .sort({ orderedDate: -1 })
        .populate('branch', 'name')
        .lean();
      const rows = purchases.map((p) => ({
        purchaseNumber: p.purchaseNumber,
        orderedDate: new Date(p.orderedDate).toISOString().slice(0, 10),
        supplierName: p.supplierName,
        status: p.status,
        items: p.items.length,
        total: round2(p.total),
        paidAmount: round2(p.paidAmount),
        balance: round2(p.balance),
        branch: p.branch?.name || '',
      }));
      const summary = {
        orders: rows.length,
        total: round2(rows.reduce((a, r) => a + r.total, 0)),
        balance: round2(rows.reduce((a, r) => a + r.balance, 0)),
      };
      return { rows, summary };
    },
  },

  'stock-in': {
    title: 'Stock-In Report',
    columns: [
      { key: 'movementNumber', label: 'Movement No' },
      { key: 'date', label: 'Date' },
      { key: 'productName', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unitName', label: 'Unit' },
      { key: 'unitCost', label: 'Unit Cost (ETB)' },
      { key: 'value', label: 'Value (ETB)' },
      { key: 'source', label: 'Source' },
      { key: 'employeeName', label: 'Received By' },
      { key: 'branch', label: 'Branch' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const movements = await StockMovement.find({
        ...branchMatch(query.branch),
        date: rangeFilter,
        direction: 'in',
      })
        .sort({ date: -1 })
        .populate('product', 'name sku')
        .populate('branch', 'name')
        .lean();
      const rows = movements.map((m) => ({
        movementNumber: m.movementNumber,
        date: new Date(m.date).toISOString().slice(0, 10),
        productName: m.product?.name || '',
        sku: m.product?.sku || '',
        quantity: round2(m.quantity),
        unitName: m.unitName,
        unitCost: round2(m.unitCost),
        value: round2(m.value),
        source: m.sourceType,
        employeeName: m.employeeName,
        branch: m.branch?.name || '',
      }));
      return { rows, summary: { movements: rows.length, value: round2(rows.reduce((a, r) => a + r.value, 0)) } };
    },
  },

  'stock-out': {
    title: 'Stock-Out Report',
    columns: [
      { key: 'movementNumber', label: 'Movement No' },
      { key: 'date', label: 'Date' },
      { key: 'productName', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unitName', label: 'Unit' },
      { key: 'unitCost', label: 'Unit Cost (ETB)' },
      { key: 'value', label: 'Value (ETB)' },
      { key: 'reason', label: 'Reason' },
      { key: 'employeeName', label: 'Issued By' },
      { key: 'branch', label: 'Branch' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const movements = await StockMovement.find({
        ...branchMatch(query.branch),
        date: rangeFilter,
        direction: 'out',
      })
        .sort({ date: -1 })
        .populate('product', 'name sku')
        .populate('branch', 'name')
        .lean();
      const rows = movements.map((m) => ({
        movementNumber: m.movementNumber,
        date: new Date(m.date).toISOString().slice(0, 10),
        productName: m.product?.name || '',
        sku: m.product?.sku || '',
        quantity: round2(m.quantity),
        unitName: m.unitName,
        unitCost: round2(m.unitCost),
        value: round2(m.value),
        reason: m.reason || m.type,
        employeeName: m.employeeName,
        branch: m.branch?.name || '',
      }));
      return { rows, summary: { movements: rows.length, value: round2(rows.reduce((a, r) => a + r.value, 0)) } };
    },
  },

  'current-inventory': {
    title: 'Current Inventory Report',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unitName', label: 'Unit' },
      { key: 'averageCost', label: 'Avg Cost (ETB)' },
      { key: 'totalValue', label: 'Stock Value (ETB)' },
      { key: 'sellingPrice', label: 'Selling Price (ETB)' },
      { key: 'minStock', label: 'Min Stock' },
      { key: 'status', label: 'Status' },
    ],
    async run(query) {
      const products = await Product.find({ active: true })
        .populate('unit', 'name code')
        .populate('category', 'name')
        .sort({ name: 1 })
        .lean();
      const stockFilter = branchMatch(query.branch);
      const rows = stockFilter.branch
        ? await (async () => {
            const stock = await ProductStock.find({ ...stockFilter, product: { $in: products.map((p) => p._id) } }).lean();
            const map = new Map(stock.map((s) => [String(s.product), s]));
            return products.map((p) => {
              const s = map.get(String(p._id));
              const quantity = s?.quantity ?? 0;
              const value = s?.totalValue ?? 0;
              return {
                sku: p.sku,
                name: p.name,
                category: p.category?.name || '',
                quantity: round2(quantity),
                unitName: p.unit?.name || '',
                averageCost: quantity > 0 ? round2(value / quantity) : 0,
                totalValue: round2(value),
                sellingPrice: round2(p.sellingPrice),
                minStock: round2(p.minStock),
                status: quantity <= 0 ? 'Out of stock' : p.minStock > 0 && quantity <= p.minStock ? 'Low stock' : 'In stock',
              };
            });
          })()
        : products.map((p) => ({
            sku: p.sku,
            name: p.name,
            category: p.category?.name || '',
            quantity: round2(p.totalStock),
            unitName: p.unit?.name || '',
            averageCost: p.totalStock > 0 ? round2(p.totalStockValue / p.totalStock) : 0,
            totalValue: round2(p.totalStockValue),
            sellingPrice: round2(p.sellingPrice),
            minStock: round2(p.minStock),
            status:
              p.totalStock <= 0 ? 'Out of stock' : p.minStock > 0 && p.totalStock <= p.minStock ? 'Low stock' : 'In stock',
          }));

      return {
        rows,
        summary: {
          products: rows.length,
          quantity: round2(rows.reduce((a, r) => a + r.quantity, 0)),
          value: round2(rows.reduce((a, r) => a + r.totalValue, 0)),
        },
      };
    },
  },

  'inventory-valuation': {
    title: 'Inventory Valuation Report',
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'items', label: 'Products' },
      { key: 'quantity', label: 'Total Quantity' },
      { key: 'costValue', label: 'Value at Cost (ETB)' },
      { key: 'retailValue', label: 'Value at Retail (ETB)' },
      { key: 'potentialProfit', label: 'Potential Profit (ETB)' },
    ],
    async run(query) {
      const products = await Product.find({ active: true }).populate('category', 'name').lean();
      const grouped = new Map();
      for (const p of products) {
        const key = p.category?.name || 'Uncategorised';
        const entry = grouped.get(key) || { category: key, items: 0, quantity: 0, costValue: 0, retailValue: 0 };
        entry.items += 1;
        entry.quantity += p.totalStock;
        entry.costValue += p.totalStockValue;
        entry.retailValue += p.totalStock * p.sellingPrice;
        grouped.set(key, entry);
      }
      const rows = [...grouped.values()]
        .sort((a, b) => b.costValue - a.costValue)
        .map((r) => ({
          ...r,
          quantity: round2(r.quantity),
          costValue: round2(r.costValue),
          retailValue: round2(r.retailValue),
          potentialProfit: round2(r.retailValue - r.costValue),
        }));
      return {
        rows,
        summary: {
          costValue: round2(rows.reduce((a, r) => a + r.costValue, 0)),
          retailValue: round2(rows.reduce((a, r) => a + r.retailValue, 0)),
        },
      };
    },
  },

  'low-stock': {
    title: 'Low-Stock Report',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Current Stock' },
      { key: 'minStock', label: 'Minimum' },
      { key: 'unitName', label: 'Unit' },
      { key: 'supplier', label: 'Preferred Supplier' },
      { key: 'suggestedOrder', label: 'Suggested Order' },
    ],
    async run(query) {
      const filter = { active: true, minStock: { $gt: 0 }, $expr: { $lte: ['$totalStock', '$minStock'] } };
      const products = await Product.find(filter)
        .populate('unit', 'name')
        .populate('category', 'name')
        .populate('preferredSupplier', 'name')
        .sort({ totalStock: 1 })
        .lean();
      const rows = products.map((p) => ({
        sku: p.sku,
        name: p.name,
        category: p.category?.name || '',
        quantity: round2(p.totalStock),
        minStock: round2(p.minStock),
        unitName: p.unit?.name || '',
        supplier: p.preferredSupplier?.name || '',
        suggestedOrder: round2(p.reorderQuantity > 0 ? p.reorderQuantity : Math.max(0, p.minStock * 2 - p.totalStock)),
      }));
      return { rows, summary: { count: rows.length } };
    },
  },

  'out-of-stock': {
    title: 'Out-of-Stock Report',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Current Stock' },
      { key: 'unitName', label: 'Unit' },
      { key: 'supplier', label: 'Preferred Supplier' },
      { key: 'lastMovement', label: 'Last Movement' },
    ],
    async run(query) {
      const products = await Product.find({ active: true, totalStock: { $lte: 0 } })
        .populate('unit', 'name')
        .populate('category', 'name')
        .populate('preferredSupplier', 'name')
        .sort({ name: 1 })
        .lean();
      const lastMovements = await StockMovement.find({ product: { $in: products.map((p) => p._id) } })
        .sort({ date: -1 })
        .limit(500)
        .lean();
      const map = new Map();
      for (const m of lastMovements) if (!map.has(String(m.product))) map.set(String(m.product), m);
      const rows = products.map((p) => ({
        sku: p.sku,
        name: p.name,
        category: p.category?.name || '',
        quantity: round2(p.totalStock),
        unitName: p.unit?.name || '',
        supplier: p.preferredSupplier?.name || '',
        lastMovement: map.get(String(p._id)) ? new Date(map.get(String(p._id)).date).toISOString().slice(0, 10) : '',
      }));
      return { rows, summary: { count: rows.length } };
    },
  },

  'customer-debt': {
    title: 'Customer Debt Report',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'category', label: 'Type' },
      { key: 'totalSales', label: 'Total Sales (ETB)' },
      { key: 'receipts', label: 'Payments Received (ETB)' },
      { key: 'balance', label: 'Outstanding (ETB)' },
      { key: 'creditLimit', label: 'Credit Limit (ETB)' },
      { key: 'status', label: 'Status' },
    ],
    async run(query) {
      const customers = await Customer.find({ active: true }).sort({ name: 1 }).lean();
      const balances = await customerBalances(customers.map((c) => c._id));
      const rows = customers
        .map((c) => {
          const b = balances.get(String(c._id)) || {};
          return {
            code: c.code,
            name: c.name,
            phone: c.phone,
            category: c.category,
            totalSales: round2(b.totalSales || 0),
            receipts: round2(b.receipts || 0),
            balance: round2(b.balance || 0),
            creditLimit: round2(c.creditLimit || 0),
            status: (b.balance || 0) > 0 ? 'Outstanding' : 'Clear',
          };
        })
        .filter((r) => (query.onlyOutstanding === 'true' ? r.balance > 0 : true));
      return {
        rows,
        summary: {
          customers: rows.length,
          outstanding: round2(rows.reduce((a, r) => a + r.balance, 0)),
        },
      };
    },
  },

  'supplier-payable': {
    title: 'Supplier Payable Report',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Supplier' },
      { key: 'phone', label: 'Phone' },
      { key: 'totalPurchases', label: 'Total Purchases (ETB)' },
      { key: 'payments', label: 'Payments Made (ETB)' },
      { key: 'balance', label: 'Outstanding (ETB)' },
      { key: 'paymentTerms', label: 'Terms' },
    ],
    async run(query) {
      const suppliers = await Supplier.find({ active: true }).sort({ name: 1 }).lean();
      const balances = await supplierBalances(suppliers.map((s) => s._id));
      const rows = suppliers
        .map((s) => {
          const b = balances.get(String(s._id)) || {};
          return {
            code: s.code,
            name: s.name,
            phone: s.phone,
            totalPurchases: round2(b.totalPurchases || 0),
            payments: round2(b.payments || 0),
            balance: round2(b.balance || 0),
            paymentTerms: s.paymentTerms,
          };
        })
        .filter((r) => (query.onlyOutstanding === 'true' ? r.balance > 0 : true));
      return {
        rows,
        summary: {
          suppliers: rows.length,
          outstanding: round2(rows.reduce((a, r) => a + r.balance, 0)),
        },
      };
    },
  },

  'gross-profit': {
    title: 'Gross Profit Report',
    columns: [
      { key: 'period', label: 'Period' },
      { key: 'invoices', label: 'Invoices' },
      { key: 'revenue', label: 'Revenue (ETB)' },
      { key: 'discounts', label: 'Discounts (ETB)' },
      { key: 'cogs', label: 'Cost of Goods Sold (ETB)' },
      { key: 'profit', label: 'Gross Profit (ETB)' },
      { key: 'margin', label: 'Margin %' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const sales = await Sale.find({ ...branchMatch(query.branch), date: rangeFilter, status: { $in: ACTIVE_SALE_STATUSES } }).lean();
      const grouped = new Map();
      for (const s of sales) {
        const key = new Date(s.date).toISOString().slice(0, 10);
        const entry = grouped.get(key) || { period: key, invoices: 0, revenue: 0, discounts: 0, cogs: 0, profit: 0 };
        entry.invoices += 1;
        entry.revenue += s.subtotal;
        entry.discounts += s.discountTotal;
        entry.cogs += s.costTotal;
        entry.profit += s.grossProfit;
        grouped.set(key, entry);
      }
      const rows = [...grouped.values()]
        .sort((a, b) => b.period.localeCompare(a.period))
        .map((r) => ({
          ...r,
          revenue: round2(r.revenue),
          discounts: round2(r.discounts),
          cogs: round2(r.cogs),
          profit: round2(r.profit),
          margin: r.revenue > 0 ? round2((r.profit / r.revenue) * 100) : 0,
        }));
      return {
        rows,
        summary: {
          revenue: round2(rows.reduce((a, r) => a + r.revenue, 0)),
          cogs: round2(rows.reduce((a, r) => a + r.cogs, 0)),
          profit: round2(rows.reduce((a, r) => a + r.profit, 0)),
        },
      };
    },
  },

  expense: {
    title: 'Expense Report',
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'date', label: 'Date' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'paidTo', label: 'Paid To' },
      { key: 'employeeName', label: 'Responsible' },
      { key: 'amount', label: 'Amount (ETB)' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const expenses = await Expense.find({ ...branchMatch(query.branch), date: rangeFilter }).sort({ date: -1 }).lean();
      const rows = expenses.map((e) => ({
        reference: e.reference,
        date: new Date(e.date).toISOString().slice(0, 10),
        category: e.category,
        description: e.description,
        paymentMethod: e.paymentMethod,
        paidTo: e.paidTo,
        employeeName: e.employeeName,
        amount: round2(e.amount),
      }));
      const byCategory = new Map();
      for (const r of rows) byCategory.set(r.category, round2((byCategory.get(r.category) || 0) + r.amount));
      return {
        rows,
        summary: { total: round2(rows.reduce((a, r) => a + r.amount, 0)), byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })) },
      };
    },
  },

  'net-profit': {
    title: 'Estimated Net Operating Profit Report',
    columns: [
      { key: 'line', label: 'Line' },
      { key: 'amount', label: 'Amount (ETB)' },
      { key: 'note', label: 'Note' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const [salesAgg, expenseAgg] = await Promise.all([
        Sale.aggregate([
          { $match: { ...branchMatch(query.branch), date: rangeFilter, status: { $in: ACTIVE_SALE_STATUSES } } },
          { $group: { _id: null, revenue: { $sum: '$subtotal' }, discounts: { $sum: '$discountTotal' }, cogs: { $sum: '$costTotal' }, profit: { $sum: '$grossProfit' }, collected: { $sum: '$paidAmount' }, receivable: { $sum: '$balance' } } },
        ]),
        Expense.aggregate([{ $match: { ...branchMatch(query.branch), date: rangeFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      ]);
      const s = salesAgg[0] || { revenue: 0, discounts: 0, cogs: 0, profit: 0, collected: 0, receivable: 0 };
      const e = expenseAgg[0]?.total || 0;
      const rows = [
        { line: 'Sales revenue', amount: round2(s.revenue), note: 'Gross invoice value before discounts' },
        { line: 'Less: discounts', amount: round2(-s.discounts), note: 'Discounts granted to customers' },
        { line: 'Net sales', amount: round2(s.revenue - s.discounts), note: 'Revenue after discounts' },
        { line: 'Less: cost of goods sold', amount: round2(-s.cogs), note: 'Weighted average cost of items sold' },
        { line: 'Gross profit', amount: round2(s.profit), note: 'Net sales minus cost of goods sold' },
        { line: 'Less: operating expenses', amount: round2(-e), note: 'Recorded expenses in the period' },
        { line: 'Estimated net operating profit', amount: round2(s.profit - e), note: 'Estimated profit, not cash balance' },
        { line: 'Cash collected from customers', amount: round2(s.collected), note: 'Actual money received' },
        { line: 'Outstanding customer receivables', amount: round2(s.receivable), note: 'Sold but not yet paid' },
      ];
      return { rows, summary: { grossProfit: round2(s.profit), expenses: round2(e), netProfit: round2(s.profit - e) } };
    },
  },

  'product-movement': {
    title: 'Product Movement Report',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'unitName', label: 'Unit' },
      { key: 'inQuantity', label: 'Stock In' },
      { key: 'outQuantity', label: 'Stock Out' },
      { key: 'net', label: 'Net Change' },
      { key: 'inValue', label: 'In Value (ETB)' },
      { key: 'outValue', label: 'Out Value (ETB)' },
      { key: 'balance', label: 'Closing Quantity' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const movements = await StockMovement.find({ ...branchMatch(query.branch), date: rangeFilter })
        .populate('product', 'name sku unit')
        .lean();
      const grouped = new Map();
      for (const m of movements) {
        const key = String(m.product?._id || m.product);
        const entry = grouped.get(key) || {
          sku: m.product?.sku || '',
          name: m.product?.name || '',
          unitName: m.unitName,
          inQuantity: 0,
          outQuantity: 0,
          inValue: 0,
          outValue: 0,
          balance: 0,
        };
        if (m.direction === 'in') {
          entry.inQuantity += m.quantity;
          entry.inValue += m.value;
        } else {
          entry.outQuantity += m.quantity;
          entry.outValue += m.value;
        }
        entry.balance = m.balanceAfter;
        grouped.set(key, entry);
      }
      const rows = [...grouped.values()].map((r) => ({
        ...r,
        inQuantity: round2(r.inQuantity),
        outQuantity: round2(r.outQuantity),
        net: round2(r.inQuantity - r.outQuantity),
        inValue: round2(r.inValue),
        outValue: round2(r.outValue),
        balance: round2(r.balance),
      }));
      return { rows, summary: { products: rows.length } };
    },
  },

  'employee-transactions': {
    title: 'Employee Transaction Report',
    columns: [
      { key: 'name', label: 'Employee' },
      { key: 'role', label: 'Role' },
      { key: 'branch', label: 'Branch' },
      { key: 'salesCount', label: 'Sales' },
      { key: 'salesTotal', label: 'Sales Value (ETB)' },
      { key: 'receipts', label: 'Stock In Movements' },
      { key: 'issues', label: 'Stock Out Movements' },
      { key: 'expenses', label: 'Expense Entries' },
    ],
    async run(query) {
      const rangeFilter = await range(query);
      const [users, sales, movements, expenses] = await Promise.all([
        User.find({ active: true }).populate('branch', 'name').lean(),
        Sale.aggregate([
          { $match: { ...branchMatch(query.branch), date: rangeFilter, status: { $in: ACTIVE_SALE_STATUSES } } },
          { $group: { _id: '$soldBy', count: { $sum: 1 }, total: { $sum: '$total' } } },
        ]),
        StockMovement.aggregate([
          { $match: { ...branchMatch(query.branch), date: rangeFilter } },
          { $group: { _id: '$employee', ins: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, 1, 0] } }, outs: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, 1, 0] } } } },
        ]),
        Expense.aggregate([
          { $match: { ...branchMatch(query.branch), date: rangeFilter } },
          { $group: { _id: '$employee', count: { $sum: 1 }, total: { $sum: '$amount' } } },
        ]),
      ]);
      const saleMap = new Map(sales.map((s) => [String(s._id), s]));
      const moveMap = new Map(movements.map((m) => [String(m._id), m]));
      const expenseMap = new Map(expenses.map((e) => [String(e._id), e]));
      const rows = users
        .map((u) => {
          const s = saleMap.get(String(u._id)) || {};
          const m = moveMap.get(String(u._id)) || {};
          const e = expenseMap.get(String(u._id)) || {};
          return {
            name: u.name,
            role: u.role,
            branch: u.branch?.name || '',
            salesCount: s.count || 0,
            salesTotal: round2(s.total || 0),
            receipts: m.ins || 0,
            issues: m.outs || 0,
            expenses: e.count || 0,
            expenseTotal: round2(e.total || 0),
          };
        })
        .filter((r) => r.salesCount || r.receipts || r.issues || r.expenses);
      return { rows, summary: { employees: rows.length } };
    },
  },

  'branch-comparison': {
    title: 'Branch Comparison Report',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Branch' },
      { key: 'saleCount', label: 'Sales Invoices' },
      { key: 'sales', label: 'Sales (ETB)' },
      { key: 'profit', label: 'Gross Profit (ETB)' },
      { key: 'purchases', label: 'Purchases (ETB)' },
      { key: 'stockQuantity', label: 'Stock Quantity' },
      { key: 'stockValue', label: 'Stock Value (ETB)' },
    ],
    async run(query) {
      const { branchComparison } = await import('./dashboard.service.js');
      const data = await branchComparison({ from: query.from, to: query.to });
      const rows = data.map((b) => ({
        code: b.code,
        name: b.name,
        saleCount: b.saleCount,
        sales: b.sales,
        profit: b.profit,
        purchases: b.purchases,
        stockQuantity: b.stockQuantity,
        stockValue: b.stockValue,
      }));
      return {
        rows,
        summary: {
          branches: rows.length,
          sales: round2(rows.reduce((a, r) => a + r.sales, 0)),
          stockValue: round2(rows.reduce((a, r) => a + r.stockValue, 0)),
        },
      };
    },
  },
};

export const REPORT_LIST = Object.entries(REPORTS).map(([key, def]) => ({ key, title: def.title }));

export async function runReport(type, query) {
  const report = REPORTS[type];
  if (!report) return null;
  const result = await report.run(query);
  return { title: report.title, columns: report.columns, ...result };
}

export default REPORTS;
