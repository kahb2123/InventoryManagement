import { useCallback, useEffect, useState } from 'react';
import { Boxes, Search, Download, AlertTriangle, CircleSlash, CheckCircle2 } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber } from '../lib/format.js';
import { Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable } from '../components/ui/Table.jsx';
import { SearchInput } from '../components/ui/Form.jsx';
import { Button } from '../components/ui/Primitives.jsx';

export default function StockPositions() {
  const { t, locale, pick } = useI18n();
  const { currency, branches, categories } = useApp();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('status') || 'all';
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/positions', { params: { search, branch, category, status } });
      setRows(res.data.data || []);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [search, branch, category, status, t, toast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const exportCsv = () => {
    const header = ['SKU', 'Product', 'Category', 'Quantity', 'Unit', 'Avg Cost', 'Stock Value', 'Status'];
    const lines = rows.map((r) => [
      r.sku,
      r.name,
      r.category?.name || '',
      r.quantity,
      r.unit?.name || '',
      r.averageCost,
      r.value,
      r.status,
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-positions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totals = rows.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      value: acc.value + row.value,
      low: acc.low + (row.status === 'low_stock' ? 1 : 0),
      out: acc.out + (row.status === 'out_of_stock' ? 1 : 0),
    }),
    { quantity: 0, value: 0, low: 0, out: 0 }
  );

  const columns = [
    {
      key: 'sku',
      label: t('products.sku'),
      render: (row) => <span className="font-mono text-[12px] text-ink-muted">{row.sku}</span>,
    },
    {
      key: 'name',
      label: t('common.product'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{pick(row.name, row.nameAm)}</p>
          {row.category?.name ? <p className="text-[11px] text-ink-faint truncate">{row.category.name}</p> : null}
        </div>
      ),
    },
    {
      key: 'quantity',
      label: t('stock.currentStock'),
      render: (row) => (
        <span
          className={`font-semibold ${
            row.status === 'out_of_stock' ? 'text-danger-700' : row.status === 'low_stock' ? 'text-warning-700' : 'text-ink'
          }`}
        >
          {formatNumber(row.quantity, locale, 2)} <span className="text-[11px] font-normal text-ink-faint">{row.unit?.name}</span>
        </span>
      ),
    },
    { key: 'averageCost', label: t('stock.cost'), render: (row) => formatCurrency(row.averageCost, currency, locale) },
    { key: 'value', label: t('stock.stockValue'), render: (row) => formatCurrency(row.value, currency, locale) },
    { key: 'minStock', label: t('products.minStock'), render: (row) => formatNumber(row.minStock, locale, 0) },
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => (
        <Badge tone={row.status === 'out_of_stock' ? 'danger' : row.status === 'low_stock' ? 'warning' : 'success'}>
          {row.status === 'out_of_stock' ? t('products.outOfStock') : row.status === 'low_stock' ? t('products.lowStock') : t('products.inStock')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('stock.positions')}
        subtitle={t('stock.positionsSubtitle')}
        action={
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            {t('common.exportCsv')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('dashboard.totalStockQuantity')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">{formatNumber(totals.quantity, locale, 2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('dashboard.inventoryValueAtCost')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">{formatCurrency(totals.value, currency, locale, { compact: true })}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('products.lowStock')}</p>
          <p className="text-lg font-semibold text-warning-700 mt-0.5">{totals.low}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('products.outOfStock')}</p>
          <p className="text-lg font-semibold text-danger-700 mt-0.5">{totals.out}</p>
        </div>
      </div>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          <SearchInput value={search} onChange={setSearch} placeholder={t('products.searchPlaceholder')} className="w-full sm:w-72" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')}</option>
            <option value="low_stock">{t('products.lowStock')}</option>
            <option value="out_of_stock">{t('products.outOfStock')}</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink max-w-[190px]"
          >
            <option value="all">{t('common.all')} — {t('common.category')}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {pick(c.name, c.nameAm)}
              </option>
            ))}
          </select>
          {branches.length > 1 ? (
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink max-w-[170px]"
            >
              <option value="all">{t('common.all')} — {t('common.branch')}</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {pick(b.name, b.nameAm)}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyIcon={Boxes}
          emptyTitle={t('common.noData')}
          emptyDescription={t('common.noDataHint')}
        />
      </Card>
    </div>
  );
}
