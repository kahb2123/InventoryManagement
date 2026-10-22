import { useCallback, useEffect, useState } from 'react';
import { Receipt, Plus, Printer, Ban, Undo2, Eye, Search } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber, formatDate } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { SearchInput, Input, Textarea } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';
import SaleForm from '../components/SaleForm.jsx';

export default function Sales() {
  const { t, locale, pick } = useI18n();
  const { currency, branches, customers, ethiopicCalendar, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
  const [summary, setSummary] = useState({ total: 0, paid: 0, balance: 0, profit: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [saleOpen, setSaleOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales', { params: { page, limit, search, branch, paymentStatus } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
      setSummary(res.data.summary || {});
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, branch, paymentStatus, t, toast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const openInvoice = async (sale) => {
    try {
      const res = await api.get(`/sales/${sale._id}/print`);
      setViewing(res.data.data);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  };

  const cancelInvoice = async () => {
    if (!cancelReason.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/sales/${cancelling._id}/cancel`, { reason: cancelReason });
      toast.success(t('sales.cancelled'));
      setCancelling(null);
      setCancelReason('');
      load();
      refreshReferenceData();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'invoiceNumber',
      label: t('sales.invoiceNumber'),
      render: (row) => <span className="font-mono text-[12px] font-semibold text-ink">{row.invoiceNumber}</span>,
    },
    {
      key: 'date',
      label: t('sales.invoiceDate'),
      render: (row) => (
        <span className="whitespace-nowrap">{formatDate(row.date, locale, { ethiopic: ethiopicCalendar })}</span>
      ),
    },
    {
      key: 'customerName',
      label: t('sales.customer'),
      render: (row) => <span className="font-medium text-ink">{pick(row.customerName, row.customer?.nameAm)}</span>,
    },
    { key: 'items', label: t('sales.items'), render: (row) => <span className="text-ink-muted">{row.items?.length ?? 0}</span> },
    { key: 'total', label: t('common.total'), render: (row) => <span className="font-semibold">{formatCurrency(row.total, currency, locale)}</span> },
    { key: 'paidAmount', label: t('sales.amountPaid'), render: (row) => formatCurrency(row.paidAmount, currency, locale) },
    {
      key: 'balance',
      label: t('sales.balance'),
      render: (row) => (
        <span className={row.balance > 0 ? 'font-semibold text-danger-700' : 'text-ink-faint'}>
          {formatCurrency(row.balance, currency, locale)}
        </span>
      ),
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
    {
      key: 'status',
      label: t('common.status'),
      render: (row) =>
        row.status === 'cancelled' ? (
          <Badge tone="neutral">{t('purchases.cancelled')}</Badge>
        ) : row.status === 'returned' ? (
          <Badge tone="navy">{t('sales.returnTitle')}</Badge>
        ) : row.status === 'partial_return' ? (
          <Badge tone="navy">Return</Badge>
        ) : (
          <Badge tone="brand">{t('purchases.received')}</Badge>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => openInvoice(row)}
            className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
            aria-label={t('common.view')}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {hasPermission('sales.cancel') && row.status === 'completed' ? (
            <button
              type="button"
              onClick={() => {
                setCancelling(row);
                setCancelReason('');
              }}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-danger-50 hover:text-danger-700 flex items-center justify-center"
              aria-label={t('common.delete')}
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('sales.title')}
        subtitle={t('sales.subtitle')}
        action={
          hasPermission('sales.create') ? (
            <Button icon={Plus} onClick={() => setSaleOpen(true)}>
              {t('sales.newSale')}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('common.total')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">{formatCurrency(summary.total, currency, locale, { compact: true })}</p>
          <p className="text-[11px] text-ink-faint">{summary.count} {t('dashboard.invoices')}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('sales.amountPaid')}</p>
          <p className="text-lg font-semibold text-success-700 mt-0.5">{formatCurrency(summary.paid, currency, locale, { compact: true })}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('sales.balance')}</p>
          <p className="text-lg font-semibold text-danger-700 mt-0.5">{formatCurrency(summary.balance, currency, locale, { compact: true })}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('dashboard.estimatedGrossProfit')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">{formatCurrency(summary.profit, currency, locale, { compact: true })}</p>
        </div>
      </div>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={t('sales.searchPlaceholder')}
            className="w-full sm:w-72"
          />
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')} — {t('sales.paymentStatus')}</option>
            <option value="paid">{t('sales.paid')}</option>
            <option value="partial">{t('sales.partial')}</option>
            <option value="unpaid">{t('sales.unpaid')}</option>
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
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyIcon={Receipt}
          emptyTitle={t('sales.emptyInvoices')}
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

      <SaleForm
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />

      <InvoiceModal open={Boolean(viewing)} onClose={() => setViewing(null)} data={viewing} />

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={t('sales.cancelTitle')}
        subtitle={cancelling?.invoiceNumber}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelling(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={cancelInvoice} loading={busy}>
              {t('sales.cancelled')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-800">
            <Undo2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t('sales.cancelWarning')}</span>
          </div>
          <Textarea
            label={t('sales.cancelReason')}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('common.reason')}
          />
        </div>
      </Modal>
    </div>
  );
}

export function InvoiceModal({ open, onClose, data }) {
  const { t, locale, pick } = useI18n();
  const { currency } = useApp();
  if (!data) return null;
  const { sale, settings } = data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('sales.invoice')} ${sale.invoiceNumber}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2 no-print">
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button icon={Printer} onClick={() => window.print()}>
            {t('sales.printInvoice')}
          </Button>
        </div>
      }
    >
      <div className="print-page bg-white p-6 rounded-lg border border-line">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-navy-900">
          <div className="flex items-center gap-3">
            {settings?.logo ? (
              <img src={settings.logo} alt="" className="h-14 w-14 object-contain" />
            ) : null}
            <div>
              <h1 className="text-lg font-bold text-navy-900">{settings?.businessName}</h1>
              {settings?.businessNameAm ? (
                <p className="text-sm font-semibold text-navy-700">{settings.businessNameAm}</p>
              ) : null}
              <p className="text-[11px] text-ink-muted mt-0.5 whitespace-pre-line">
                {[settings?.address, settings?.phone, settings?.email, settings?.taxId].filter(Boolean).join('\n')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-navy-900">{t('sales.invoice')}</p>
            <p className="font-mono text-sm font-semibold text-ink">{sale.invoiceNumber}</p>
            <p className="text-[11px] text-ink-muted mt-1">
              {t('sales.invoiceDate')}: {formatDate(sale.date, locale)}
            </p>
            {sale.branch?.name ? <p className="text-[11px] text-ink-muted">{sale.branch.name}</p> : null}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{t('sales.customer')}</p>
            <p className="font-semibold text-ink">{sale.customerName}</p>
            {sale.customer?.address ? <p className="text-[11px] text-ink-muted">{sale.customer.address}</p> : null}
            {sale.customer?.phone ? <p className="text-[11px] text-ink-muted">{sale.customer.phone}</p> : null}
            {sale.customer?.taxId ? (
              <p className="text-[11px] text-ink-muted">
                {t('customers.taxId')}: {sale.customer.taxId}
              </p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{t('sales.paymentStatus')}</p>
            <p className="font-semibold text-ink capitalize">{sale.paymentStatus}</p>
            <p className="text-[11px] text-ink-muted">
              {t('sales.paymentMethod')}: {sale.paymentMethod}
            </p>
            <p className="text-[11px] text-ink-muted">
              {t('sales.soldBy')}: {sale.soldByName || sale.soldBy?.name || '—'}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy-900 text-white">
              <th className="text-left px-2.5 py-2 text-[11px] font-semibold uppercase">#</th>
              <th className="text-left px-2.5 py-2 text-[11px] font-semibold uppercase">{t('common.product')}</th>
              <th className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase">{t('common.quantity')}</th>
              <th className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase">{t('sales.unitPrice')}</th>
              <th className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase">{t('sales.discount')}</th>
              <th className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase">{t('sales.tax')}</th>
              <th className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase">{t('sales.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item, index) => (
              <tr key={index} className="border-b border-line">
                <td className="px-2.5 py-2 text-ink-muted">{index + 1}</td>
                <td className="px-2.5 py-2">
                  <p className="font-medium text-ink">{item.name}</p>
                  {item.nameAm ? <p className="text-[11px] text-ink-muted">{item.nameAm}</p> : null}
                  <p className="text-[10px] text-ink-faint font-mono">{item.sku}</p>
                </td>
                <td className="px-2.5 py-2 text-right">
                  {formatNumber(item.quantity, locale, 2)} {item.unitName}
                </td>
                <td className="px-2.5 py-2 text-right">{formatCurrency(item.unitPrice, currency, locale)}</td>
                <td className="px-2.5 py-2 text-right">
                  {item.discount > 0 ? formatCurrency(item.discount, currency, locale) : '—'}
                </td>
                <td className="px-2.5 py-2 text-right">{item.tax > 0 ? formatCurrency(item.tax, currency, locale) : '—'}</td>
                <td className="px-2.5 py-2 text-right font-semibold">{formatCurrency(item.lineTotal, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-5">
          <dl className="w-full sm:w-80 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('sales.subtotal')}</dt>
              <dd className="font-medium">{formatCurrency(sale.subtotal, currency, locale)}</dd>
            </div>
            {sale.discountTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('sales.discountTotal')}</dt>
                <dd className="font-medium text-danger-700">-{formatCurrency(sale.discountTotal, currency, locale)}</dd>
              </div>
            ) : null}
            {sale.taxTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t('sales.taxTotal')}</dt>
                <dd className="font-medium">{formatCurrency(sale.taxTotal, currency, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between pt-2 border-t-2 border-navy-900 text-base">
              <dt className="font-bold">{t('sales.grandTotal')}</dt>
              <dd className="font-bold">{formatCurrency(sale.total, currency, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('sales.amountPaid')}</dt>
              <dd className="font-medium text-success-700">{formatCurrency(sale.paidAmount, currency, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('sales.balance')}</dt>
              <dd className={`font-semibold ${sale.balance > 0 ? 'text-danger-700' : 'text-ink'}`}>
                {formatCurrency(sale.balance, currency, locale)}
              </dd>
            </div>
          </dl>
        </div>

        {settings?.invoiceNotes ? (
          <p className="mt-5 text-[11px] text-ink-muted border-t border-line pt-3">{settings.invoiceNotes}</p>
        ) : null}
        <p className="mt-2 text-[11px] text-ink-muted">{settings?.receiptFooter}</p>
        <p className="mt-4 text-center text-[10px] text-ink-faint">
          {settings?.businessName} · {settings?.phone} · {settings?.email}
        </p>
      </div>
    </Modal>
  );
}
