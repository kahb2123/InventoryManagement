import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Download } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber, formatDate } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { SearchInput, Input } from '../components/ui/Form.jsx';

const MOVEMENT_TYPES = [
  'stock_in', 'stock_out', 'sale', 'sale_return', 'purchase_receipt', 'purchase_return',
  'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'opening_balance',
  'damage', 'expired', 'internal_use',
];

export default function StockLedger() {
  const { t, locale, pick } = useI18n();
  const { currency, branches, ethiopicCalendar } = useApp();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [branch, setBranch] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/ledger', { params: { page, limit, search, type, branch, from, to } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, type, branch, from, to, t, toast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const exportCsv = () => {
    const header = ['Movement No', 'Date', 'Type', 'Product', 'SKU', 'Direction', 'Quantity', 'Unit', 'Unit Cost', 'Value', 'Balance After', 'Reason', 'Employee', 'Branch', 'Reference'];
    const lines = rows.map((r) => [
      r.movementNumber,
      new Date(r.date).toISOString().slice(0, 10),
      r.type,
      r.product?.name || '',
      r.product?.sku || '',
      r.direction,
      r.quantity,
      r.unitName,
      r.unitCost,
      r.value,
      r.balanceAfter,
      r.reason,
      r.employeeName,
      r.branch?.name || '',
      r.sourceNumber,
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'movementNumber', label: t('stock.movementNumber'), render: (row) => <span className="font-mono text-[11px] text-ink-muted">{row.movementNumber}</span> },
    {
      key: 'date',
      label: t('common.date'),
      render: (row) => (
        <span className="whitespace-nowrap">{formatDate(row.date, locale, { ethiopic: ethiopicCalendar })}</span>
      ),
    },
    {
      key: 'type',
      label: t('stock.type'),
      render: (row) => (
        <Badge tone={row.direction === 'in' ? 'success' : 'danger'}>
          {row.direction === 'in' ? 'IN' : 'OUT'} · {String(row.type).replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'product',
      label: t('common.product'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{pick(row.product?.name, row.product?.nameAm)}</p>
          <p className="text-[11px] text-ink-faint font-mono">{row.product?.sku}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: t('common.quantity'),
      render: (row) => (
        <span className={`font-semibold ${row.direction === 'in' ? 'text-success-700' : 'text-danger-600'}`}>
          {row.direction === 'in' ? '+' : '-'}
          {formatNumber(row.quantity, locale, 2)} <span className="text-[11px] font-normal text-ink-faint">{row.unitName}</span>
        </span>
      ),
    },
    { key: 'unitCost', label: t('stock.cost'), render: (row) => formatCurrency(row.unitCost, currency, locale) },
    { key: 'value', label: t('stock.value'), render: (row) => formatCurrency(row.value, currency, locale) },
    { key: 'balanceAfter', label: t('stock.balanceAfter'), render: (row) => formatNumber(row.balanceAfter, locale, 2) },
    {
      key: 'sourceNumber',
      label: t('common.reference'),
      render: (row) =>
        row.transferGroup ? (
          <span className="text-[11px] font-mono text-brand-600">{row.transferGroup}</span>
        ) : (
          row.sourceNumber || row.reason || '—'
        ),
    },
    { key: 'employeeName', label: t('stock.responsibleEmployee'), render: (row) => row.employeeName || '—' },
    { key: 'branch', label: t('common.branch'), render: (row) => row.branch?.name || '—' },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('stock.ledger')}
        subtitle={t('stock.ledgerSubtitle')}
        action={
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            {t('common.exportCsv')}
          </Button>
        }
      />

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} className="w-full sm:w-64" />
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')} — {t('stock.type')}</option>
            {MOVEMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {branches.length > 1 ? (
            <select
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                setPage(1);
              }}
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
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} wrapperClassName="w-36" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} wrapperClassName="w-36" />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyIcon={ScrollText}
          emptyTitle={t('stock.noMovements')}
          emptyDescription={t('common.noDataHint')}
        />
        <Pagination
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          limit={meta.limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
          t={t}
        />
      </Card>
    </div>
  );
}
