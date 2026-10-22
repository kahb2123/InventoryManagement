import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Package, Boxes, Wallet, TrendingUp, ShoppingCart, Users, Truck, AlertTriangle,
  CircleSlash, ArrowUpRight, Receipt, FileBarChart,
} from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatCurrency, formatNumber, formatDate } from '../lib/format.js';
import { CHART, CATEGORICAL } from '../lib/colors.js';
import { StatCard, Card, CardHeader, Badge, LoadingBlock, EmptyState, Button } from '../components/ui/Primitives.jsx';
import { DataTable } from '../components/ui/Table.jsx';

const BRAND = CHART.brand;
const CYAN = CHART.cyan;
const NAVY = CHART.navy;
const GRID = CHART.grid;
const AXIS = CHART.axis;
const AXIS_STRONG = CHART.axisStrong;

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-pop text-xs">
      {label ? <p className="font-semibold text-ink mb-1">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5 text-ink-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}: <span className="font-semibold text-ink">{formatCurrency(entry.value, currency, 'en', { compact: true })}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t, locale, pick } = useI18n();
  const { currency, ethiopicCalendar, branches } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(7);
  const [branch, setBranch] = useState('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get('/dashboard', { params: { days, branch } })
      .then((res) => {
        if (active) {
          setData(res.data.data);
          setError('');
        }
      })
      .catch((err) => active && setError(err.userMessage || 'Failed to load dashboard'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days, branch]);

  const salesTrend = useMemo(() => {
    if (!data?.charts?.salesTrend?.length) return [];
    return data.charts.salesTrend.map((point) => ({ ...point, label: point.date.slice(5) }));
  }, [data]);

  const purchasesTrend = useMemo(() => {
    if (!data?.charts?.purchasesTrend?.length) return [];
    return data.charts.purchasesTrend.map((point) => ({ ...point, label: point.date.slice(5) }));
  }, [data]);

  const cards = data?.cards;

  if (loading && !data) return <LoadingBlock label={t('app.loading')} />;
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t('common.error')}
        description={error}
        action={<Button onClick={() => window.location.reload()}>{t('common.refresh')}</Button>}
      />
    );
  }

  const fmt = (value, compact = false) => formatCurrency(value, currency, locale, { compact });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">{t('dashboard.title')}</h2>
          <p className="text-sm text-ink-muted">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branches.length > 1 ? (
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
            >
              <option value="all">{t('common.all')} — {t('common.branch')}</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {pick(b.name, b.nameAm)}
                </option>
              ))}
            </select>
          ) : null}
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-line rounded-lg">
            {[7, 30, 90].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`px-2.5 h-7 text-xs font-medium rounded-md transition ${
                  days === option ? 'bg-navy-900 text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {option === 7 ? t('common.last7') : option === 30 ? t('common.last30') : t('common.last90')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          label={t('dashboard.totalInventoryItems')}
          value={formatNumber(cards.totalItems, locale, 0)}
          icon={Package}
          tone="brand"
        />
        <StatCard
          label={t('dashboard.totalStockQuantity')}
          value={formatNumber(cards.totalQuantity, locale, 0)}
          icon={Boxes}
          tone="cyan"
          subLabel={t('dashboard.units')}
        />
        <StatCard
          label={t('dashboard.inventoryValueAtCost')}
          value={fmt(cards.inventoryValueAtCost, true)}
          icon={Wallet}
          tone="navy"
          subLabel={t('dashboard.inventoryValueAtCost')}
        />
        <StatCard
          label={t('dashboard.todaysSales')}
          value={fmt(cards.todaySales, true)}
          icon={TrendingUp}
          tone="success"
          subLabel={t('dashboard.salesCount', { count: cards.todaySalesCount })}
        />
        <StatCard
          label={t('dashboard.todaysPurchases')}
          value={fmt(cards.todayPurchases, true)}
          icon={ShoppingCart}
          tone="warning"
          subLabel={t('dashboard.purchasesCount', { count: cards.todayPurchasesCount })}
        />
        <StatCard
          label={t('dashboard.outstandingCustomerPayments')}
          value={fmt(cards.outstandingCustomerPayments, true)}
          icon={Users}
          tone="brand"
          hint={t('dashboard.receivablesNote')}
        />
        <StatCard
          label={t('dashboard.outstandingSupplierPayments')}
          value={fmt(cards.outstandingSupplierPayments, true)}
          icon={Truck}
          tone="warning"
          hint={t('dashboard.payablesNote')}
        />
        <StatCard
          label={t('dashboard.lowStockItems')}
          value={formatNumber(cards.lowStockItems, locale, 0)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label={t('dashboard.outOfStockItems')}
          value={formatNumber(cards.outOfStockItems, locale, 0)}
          icon={CircleSlash}
          tone="danger"
        />
        <StatCard
          label={t('dashboard.estimatedGrossProfit')}
          value={fmt(cards.estimatedGrossProfit, true)}
          icon={ArrowUpRight}
          tone="success"
          hint={t('dashboard.grossProfitNote')}
          subLabel={`${t('dashboard.todaysSales')}: ${fmt(cards.todayGrossProfit, true)}`}
        />
      </div>

      {/* Profit summary strip */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-ink-muted">{t('dashboard.period')} · {t('common.last30')}</p>
            <p className="text-lg font-semibold text-ink mt-0.5">{fmt(cards.periodSales, true)}</p>
            <p className="text-[11px] text-ink-faint">{t('dashboard.salesCount', { count: cards.periodSalesCount })}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">{t('dashboard.grossProfitNote')}</p>
            <p className="text-lg font-semibold text-success-700 mt-0.5">{fmt(cards.estimatedGrossProfit, true)}</p>
            <p className="text-[11px] text-ink-faint">COGS {fmt(cards.costOfGoodsSold, true)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">{t('dashboard.netProfitNote')}</p>
            <p className="text-lg font-semibold text-brand-600 mt-0.5">{fmt(cards.estimatedNetProfit, true)}</p>
            <p className="text-[11px] text-ink-faint">
              {t('expenses.totalExpenses')} {fmt(cards.periodExpenses, true)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">{t('dashboard.cashCollected')}</p>
            <p className="text-lg font-semibold text-ink mt-0.5">{fmt(cards.cashCollected, true)}</p>
            <p className="text-[11px] text-ink-faint">
              {t('dashboard.outstandingCustomerPayments')} {fmt(cards.outstandingCustomerPayments, true)}
            </p>
          </div>
        </div>
      </Card>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t('dashboard.salesTrend')}
            subtitle={`${fmt(cards.periodSales)} · ${fmt(cards.estimatedGrossProfit)} ${t('dashboard.estimatedGrossProfit')}`}
          />
          <div className="p-4 h-[280px]">
            {salesTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: AXIS }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                    tickFormatter={(v) => formatNumber(v, locale, 0)}
                  />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Area type="monotone" dataKey="sales" name={t('dashboard.todaysSales')} stroke={BRAND} strokeWidth={2} fill="url(#salesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title={t('common.noData')} description={t('common.noDataHint')} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.inventoryByCategory')} />
          <div className="p-4 h-[280px]">
            {data.charts.inventoryByCategory.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.inventoryByCategory}
                    dataKey="value"
                    nameKey="category"
                    innerRadius={54}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke={CHART.surface}
                    strokeWidth={2}
                  >
                    {data.charts.inventoryByCategory.map((entry, index) => (
                      <Cell key={index} fill={entry.color || CATEGORICAL[index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency(value, currency, locale, { compact: true }), t('dashboard.inventoryValueAtCost')]}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title={t('common.noData')} />
            )}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader title={t('dashboard.purchasesTrend')} />
          <div className="p-4 h-[260px]">
            {purchasesTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purchasesTrend} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => formatNumber(v, locale, 0)} />
                  <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: CHART.tooltipCursor }} />
                  <Bar dataKey="purchases" name={t('dashboard.todaysPurchases')} fill={CYAN} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title={t('common.noData')} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.bestSellers')} />
          <div className="p-4 h-[260px]">
            {data.charts.bestSellers.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.bestSellers} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v, locale, 0)} />
                  <YAxis type="category" dataKey="name" width={116} tick={{ fontSize: 11, fill: AXIS_STRONG }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: CHART.tooltipCursor }} />
                  <Bar dataKey="revenue" name={t('dashboard.todaysSales')} fill={NAVY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title={t('common.noData')} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.monthlyTrend')} />
          <div className="p-4 h-[260px]">
            {data.charts.monthlyTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.monthlyTrend} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => formatNumber(v, locale, 0)} />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="sales" name={t('dashboard.todaysSales')} stroke={BRAND} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name={t('dashboard.estimatedGrossProfit')} stroke={CYAN} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title={t('common.noData')} />
            )}
          </div>
        </Card>
      </div>

      {/* Lists row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={t('dashboard.recentSales')}
            action={
              <Link to="/sales" className="text-xs font-medium text-brand-600 hover:underline">
                {t('common.viewAll')}
              </Link>
            }
          />
          {data.recentSales.length ? (
            <DataTable
              columns={[
                { key: 'invoiceNumber', label: t('sales.invoiceNumber') },
                { key: 'customerName', label: t('sales.customer') },
                {
                  key: 'total',
                  label: t('common.total'),
                  render: (row) => <span className="font-semibold">{fmt(row.total)}</span>,
                },
                {
                  key: 'paymentStatus',
                  label: t('sales.paymentStatus'),
                  render: (row) => (
                    <Badge tone={row.paymentStatus === 'paid' ? 'success' : row.paymentStatus === 'partial' ? 'warning' : 'danger'}>
                      {row.paymentStatus === 'paid' ? t('sales.paid') : row.paymentStatus === 'partial' ? t('sales.partial') : t('sales.unpaid')}
                    </Badge>
                  ),
                },
              ]}
              rows={data.recentSales}
              rowKey={(row) => row._id}
            />
          ) : (
            <EmptyState icon={Receipt} title={t('sales.emptyInvoices')} />
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('dashboard.recentPurchases')}
            action={
              <Link to="/purchases" className="text-xs font-medium text-brand-600 hover:underline">
                {t('common.viewAll')}
              </Link>
            }
          />
          {data.recentPurchases.length ? (
            <DataTable
              columns={[
                { key: 'purchaseNumber', label: t('purchases.purchaseNumber') },
                { key: 'supplierName', label: t('common.supplier') },
                {
                  key: 'total',
                  label: t('common.total'),
                  render: (row) => <span className="font-semibold">{fmt(row.total)}</span>,
                },
                {
                  key: 'status',
                  label: t('common.status'),
                  render: (row) => (
                    <Badge tone={row.status === 'received' ? 'success' : row.status === 'partially_received' ? 'warning' : 'neutral'}>
                      {row.status === 'received' ? t('purchases.received') : row.status === 'partially_received' ? t('purchases.partiallyReceived') : t('purchases.ordered')}
                    </Badge>
                  ),
                },
              ]}
              rows={data.recentPurchases}
              rowKey={(row) => row._id}
            />
          ) : (
            <EmptyState icon={ShoppingCart} title={t('common.noData')} />
          )}
        </Card>

        <Card>
          <CardHeader
            title={t('dashboard.lowStockAlerts')}
            action={
              <Link to="/stock/positions?status=low_stock" className="text-xs font-medium text-brand-600 hover:underline">
                {t('common.viewAll')}
              </Link>
            }
          />
          {data.lowStockAlerts.length ? (
            <DataTable
              columns={[
                { key: 'name', label: t('common.product') },
                {
                  key: 'totalStock',
                  label: t('stock.currentStock'),
                  render: (row) => (
                    <span className={row.totalStock <= 0 ? 'text-danger-700 font-semibold' : 'text-warning-700 font-semibold'}>
                      {formatNumber(row.totalStock, locale, 2)} {row.unit?.name || ''}
                    </span>
                  ),
                },
                { key: 'minStock', label: t('products.minStock'), render: (row) => formatNumber(row.minStock, locale, 0) },
                { key: 'preferredSupplier', label: t('common.supplier'), render: (row) => row.preferredSupplier?.name || '—' },
              ]}
              rows={data.lowStockAlerts}
              rowKey={(row) => row._id}
            />
          ) : (
            <EmptyState icon={AlertTriangle} title={t('dashboard.noLowStock')} description={t('dashboard.noDataHint')} />
          )}
        </Card>

        <Card>
          <CardHeader title={t('dashboard.pendingCustomerPayments')} />
          {data.pendingCustomerPayments.length ? (
            <DataTable
              columns={[
                { key: 'name', label: t('common.customer') },
                { key: 'phone', label: t('common.phone'), render: (row) => row.phone || '—' },
                {
                  key: 'balance',
                  label: t('sales.outstanding'),
                  render: (row) => <span className="font-semibold text-danger-700">{fmt(row.balance)}</span>,
                },
              ]}
              rows={data.pendingCustomerPayments}
              rowKey={(row, i) => `${row.name}-${i}`}
            />
          ) : (
            <EmptyState icon={Users} title={t('dashboard.noPendingPayments')} />
          )}
          <div className="px-4 py-3 border-t border-line">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
              {t('dashboard.pendingSupplierPayments')}
            </p>
            {data.pendingSupplierPayments.length ? (
              <div className="space-y-1.5">
                {data.pendingSupplierPayments.map((row, i) => (
                  <div key={`${row.name}-${i}`} className="flex items-center justify-between text-xs">
                    <span className="text-ink truncate">{row.name}</span>
                    <span className="font-semibold text-warning-700 shrink-0">{fmt(row.balance)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-faint">{t('dashboard.noPendingPayments')}</p>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link to="/reports" className="link text-sm inline-flex items-center gap-1.5">
          <FileBarChart className="h-4 w-4" />
          {t('nav.reports')}
        </Link>
        <span className="text-ink-faint">·</span>
        <span className="text-xs text-ink-muted">
          {t('dashboard.period')}: {formatDate(data.period.from, locale, { ethiopic: ethiopicCalendar })} —{' '}
          {formatDate(data.period.to, locale, { ethiopic: ethiopicCalendar })}
        </span>
      </div>
    </div>
  );
}
