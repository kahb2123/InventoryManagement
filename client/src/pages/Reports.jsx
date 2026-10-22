import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, Play, FileBarChart } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber, startOfMonthInput, todayInput } from '../lib/format.js';
import { Button, Card, EmptyState, LoadingBlock, SectionTitle, StatCard } from '../components/ui/Primitives.jsx';
import { Input, Select } from '../components/ui/Form.jsx';

const REPORT_GROUPS = [
  { group: 'reports.dailySales', types: ['daily-sales', 'period-sales'] },
  { group: 'reports.purchase', types: ['purchase'] },
  { group: 'reports.stockIn', types: ['stock-in'] },
  { group: 'reports.stockOut', types: ['stock-out'] },
  { group: 'reports.currentInventory', types: ['current-inventory', 'inventory-valuation'] },
  { group: 'reports.lowStock', types: ['low-stock', 'out-of-stock'] },
  { group: 'reports.customerDebt', types: ['customer-debt'] },
  { group: 'reports.supplierPayable', types: ['supplier-payable'] },
  { group: 'reports.grossProfit', types: ['gross-profit'] },
  { group: 'reports.expense', types: ['expense'] },
  { group: 'reports.netProfit', types: ['net-profit'] },
  { group: 'reports.productMovement', types: ['product-movement'] },
  { group: 'reports.employeeTransactions', types: ['employee-transactions'] },
  { group: 'reports.branchComparison', types: ['branch-comparison'] },
];

const FINANCIAL_REPORTS = new Set([
  'gross-profit',
  'net-profit',
  'expense',
  'customer-debt',
  'supplier-payable',
  'purchase',
]);

const DATED_REPORTS = new Set([
  'daily-sales',
  'period-sales',
  'purchase',
  'stock-in',
  'stock-out',
  'gross-profit',
  'expense',
  'net-profit',
  'product-movement',
  'employee-transactions',
]);

export default function Reports() {
  const { t, locale } = useI18n();
  const { currency, branches } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [available, setAvailable] = useState([]);
  const [type, setType] = useState('daily-sales');
  const [from, setFrom] = useState(startOfMonthInput());
  const [to, setTo] = useState(todayInput());
  const [branch, setBranch] = useState('all');
  const [groupBy, setGroupBy] = useState('day');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const canSeeFinancial = hasPermission('reports.financial');

  const loadCatalog = useCallback(async () => {
    try {
      const res = await api.get('/reports');
      setAvailable(res.data.data || []);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  }, [t, toast]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const restricted = FINANCIAL_REPORTS.has(type) && !canSeeFinancial;

  const run = useCallback(async () => {
    if (restricted) {
      toast.error(t('common.noPermission'));
      return;
    }
    setRunning(true);
    setLoading(true);
    try {
      const params = { branch };
      if (DATED_REPORTS.has(type)) {
        params.from = from;
        params.to = to;
      }
      if (type === 'period-sales' || type === 'gross-profit') params.groupBy = groupBy;
      if (type === 'customer-debt' || type === 'supplier-payable') params.onlyOutstanding = onlyOutstanding ? 'true' : 'false';
      const res = await api.get(`/reports/${type}`, { params });
      setResult(res.data.data);
      toast.success(t('reports.printed'));
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
      setResult(null);
    } finally {
      setLoading(false);
      setRunning(false);
    }
  }, [type, restricted, branch, from, to, groupBy, onlyOutstanding, t, toast]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = async () => {
    try {
      const params = { branch };
      if (DATED_REPORTS.has(type)) {
        params.from = from;
        params.to = to;
      }
      if (type === 'period-sales' || type === 'gross-profit') params.groupBy = groupBy;
      if (type === 'customer-debt' || type === 'supplier-payable') params.onlyOutstanding = onlyOutstanding ? 'true' : 'false';
      const res = await api.get(`/reports/${type}/export`, { params, responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      toast.success(t('reports.exported'));
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  };

  const columns = result?.columns || [];
  const rows = result?.rows || [];
  const summary = result?.summary || {};

  const summaryCards = Object.entries(summary)
    .filter(([key, value]) => typeof value === 'number' && !key.toLowerCase().includes('bycategory'))
    .slice(0, 4)
    .map(([key, value]) => ({
      key,
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      value: formatNumber(value, locale, 2),
    }));

  const isMoneyColumn = (key) =>
    /(total|amount|price|value|revenue|profit|cogs|cost|balance|paid|receivable|payable|sales|purchases|discount)/i.test(key) &&
    !/(quantity|items|count|invoices|stockQuantity|margin)/i.test(key);

  const renderCell = (column, row) => {
    const value = row[column.key];
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
      if (isMoneyColumn(column.key)) return formatCurrency(value, currency, locale);
      return formatNumber(value, locale, 2);
    }
    if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
    return String(value);
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={restricted || !result}>
              {t('common.exportCsv')}
            </Button>
            <Button icon={Play} onClick={run} loading={running} disabled={restricted}>
              {t('reports.runReport')}
            </Button>
          </div>
        }
      />

      <Card>
        <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label={t('reports.selectReport')}
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={REPORT_GROUPS.flatMap((group) => {
              const items = group.types
                .filter((key) => available.length === 0 || available.some((r) => r.key === key))
                .map((key) => ({
                  value: key,
                  label: t(group.group),
                  disabled: FINANCIAL_REPORTS.has(key) && !canSeeFinancial,
                }));
              return items;
            })}
          />
          {DATED_REPORTS.has(type) ? (
            <>
              <Input label={t('common.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input label={t('common.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          ) : null}
          {branches.length > 1 ? (
            <Select
              label={t('common.branch')}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              options={[{ value: 'all', label: t('common.all') }, ...branches.map((b) => ({ value: b._id, label: b.name }))]}
            />
          ) : null}
          {type === 'period-sales' || type === 'gross-profit' ? (
            <Select
              label={t('reports.groupBy')}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              options={[
                { value: 'day', label: t('reports.byDay') },
                { value: 'month', label: t('reports.byMonth') },
              ]}
            />
          ) : null}
          {type === 'customer-debt' || type === 'supplier-payable' ? (
            <Select
              label={t('common.filter')}
              value={onlyOutstanding ? 'yes' : 'no'}
              onChange={(e) => setOnlyOutstanding(e.target.value === 'yes')}
              options={[
                { value: 'no', label: t('common.all') },
                { value: 'yes', label: t('reports.onlyOutstanding') },
              ]}
            />
          ) : null}
        </div>
      </Card>

      {restricted ? (
        <Card>
          <EmptyState icon={FileBarChart} title={t('common.noPermission')} description={t('common.featureUnavailable')} />
        </Card>
      ) : (
        <>
          {summaryCards.length ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryCards.map((card) => (
                <StatCard key={card.key} label={card.label} value={card.value} icon={BarChart3} tone="navy" />
              ))}
            </div>
          ) : null}

          <Card>
            <div className="px-5 py-3.5 border-b border-line flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-ink">{result?.title || t('reports.title')}</h3>
              <span className="text-xs text-ink-muted">
                {rows.length} {t('common.results').toLowerCase()}
              </span>
            </div>

            {loading ? (
              <LoadingBlock />
            ) : rows.length === 0 ? (
              <EmptyState icon={FileBarChart} title={t('reports.noRows')} />
            ) : (
              <div className="scroll-x max-h-[70vh] overflow-y-auto">
                <table className="w-full border-collapse min-w-[720px]">
                  <thead className="sticky top-0 bg-white">
                    <tr>
                      {columns.map((column) => (
                        <th key={column.key} className="table-head whitespace-nowrap">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row._id || index}>
                        {columns.map((column) => (
                          <td key={column.key} className="table-cell whitespace-nowrap">
                            {renderCell(column, row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
