import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Plus, PackageCheck, Banknote, Ban, Search, Eye, AlertTriangle } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber, formatDate, todayInput } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { SearchInput, Input, Select, Textarea } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';
import ProductPicker from '../components/ProductPicker.jsx';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export default function Purchases() {
  const { t, locale, pick } = useI18n();
  const { currency, branches, suppliers, defaultBranch, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
  const [summary, setSummary] = useState({ total: 0, paid: 0, balance: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [orderOpen, setOrderOpen] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [paying, setPaying] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/purchases', { params: { page, limit, search, branch, status } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
      setSummary(res.data.summary || {});
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, branch, status, t, toast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const cancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error(t('common.required'));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/purchases/${cancelling._id}/cancel`, { reason: cancelReason });
      toast.success(t('purchases.cancelledOrder'));
      setCancelling(null);
      setCancelReason('');
      load();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'purchaseNumber',
      label: t('purchases.purchaseNumber'),
      render: (row) => <span className="font-mono text-[12px] font-semibold text-ink">{row.purchaseNumber}</span>,
    },
    {
      key: 'orderedDate',
      label: t('purchases.orderDate'),
      render: (row) => (
        <span className="whitespace-nowrap">{formatDate(row.orderedDate, locale, { ethiopic: true })}</span>
      ),
    },
    { key: 'supplierName', label: t('common.supplier'), render: (row) => row.supplierName },
    { key: 'items', label: t('sales.items'), render: (row) => <span className="text-ink-muted">{row.items?.length ?? 0}</span> },
    { key: 'total', label: t('common.total'), render: (row) => <span className="font-semibold">{formatCurrency(row.total, currency, locale)}</span> },
    { key: 'paidAmount', label: t('sales.amountPaid'), render: (row) => formatCurrency(row.paidAmount, currency, locale) },
    {
      key: 'balance',
      label: t('purchases.outstanding'),
      render: (row) => (
        <span className={row.balance > 0 ? 'font-semibold text-warning-700' : 'text-ink-faint'}>
          {formatCurrency(row.balance, currency, locale)}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => (
        <Badge
          tone={
            row.status === 'received' ? 'success' : row.status === 'partially_received' ? 'warning' : row.status === 'cancelled' ? 'neutral' : 'brand'
          }
        >
          {row.status === 'received'
            ? t('purchases.received')
            : row.status === 'partially_received'
              ? t('purchases.partiallyReceived')
              : row.status === 'cancelled'
                ? t('purchases.cancelled')
                : t('purchases.ordered')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setViewing(row)}
            className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
            aria-label={t('common.view')}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {hasPermission('purchases.receive') && (row.status === 'ordered' || row.status === 'partially_received') ? (
            <button
              type="button"
              onClick={() => setReceiving(row)}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-success-50 hover:text-success-700 flex items-center justify-center"
              aria-label={t('purchases.receive')}
            >
              <PackageCheck className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {hasPermission('payments.create') && row.balance > 0 && row.status !== 'cancelled' ? (
            <button
              type="button"
              onClick={() => setPaying(row)}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-warning-50 hover:text-warning-700 flex items-center justify-center"
              aria-label={t('purchases.payment')}
            >
              <Banknote className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {hasPermission('purchases.cancel') && row.status === 'ordered' ? (
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
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle')}
        action={
          hasPermission('purchases.create') ? (
            <Button icon={Plus} onClick={() => setOrderOpen(true)}>
              {t('purchases.newPurchase')}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('common.total')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">{formatCurrency(summary.total, currency, locale, { compact: true })}</p>
          <p className="text-[11px] text-ink-faint">{summary.count} {t('nav.purchases')}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('sales.amountPaid')}</p>
          <p className="text-lg font-semibold text-success-700 mt-0.5">{formatCurrency(summary.paid, currency, locale, { compact: true })}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('purchases.outstanding')}</p>
          <p className="text-lg font-semibold text-warning-700 mt-0.5">{formatCurrency(summary.balance, currency, locale, { compact: true })}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('common.branch')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">{branches.length}</p>
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
            placeholder={t('purchases.searchPlaceholder')}
            className="w-full sm:w-72"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')} — {t('common.status')}</option>
            <option value="ordered">{t('purchases.ordered')}</option>
            <option value="partially_received">{t('purchases.partiallyReceived')}</option>
            <option value="received">{t('purchases.received')}</option>
            <option value="cancelled">{t('purchases.cancelled')}</option>
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
          emptyIcon={ShoppingCart}
          emptyTitle={t('common.noData')}
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

      <PurchaseOrderModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        branches={branches}
        suppliers={suppliers}
        defaultBranch={defaultBranch}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />

      <ReceiveModal
        purchase={receiving}
        onClose={() => setReceiving(null)}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />

      <PaymentModal
        purchase={paying}
        onClose={() => setPaying(null)}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />

      <PurchaseDetailModal purchase={viewing} onClose={() => setViewing(null)} />

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={t('purchases.cancelReason')}
        subtitle={cancelling?.purchaseNumber}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelling(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={cancelOrder} loading={busy}>
              {t('purchases.cancelledOrder')}
            </Button>
          </div>
        }
      >
        <Textarea
          label={t('purchases.cancelReason')}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

function PurchaseOrderModal({ open, onClose, branches, suppliers, defaultBranch, onSaved }) {
  const { t, locale, pick } = useI18n();
  const { currency } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ supplier: '', branch: '', orderedDate: todayInput(), expectedDate: '', invoiceNumber: '', notes: '' });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setItems([]);
    setForm({
      supplier: suppliers[0]?._id || '',
      branch: defaultBranch?._id || branches[0]?._id || '',
      orderedDate: todayInput(),
      expectedDate: '',
      invoiceNumber: '',
      notes: '',
    });
  }, [open, suppliers, branches, defaultBranch]);

  const addItem = async (productId) => {
    if (!productId || items.find((i) => i.product === productId)) return;
    try {
      const res = await api.get(`/products/${productId}`);
      const product = res.data.data;
      setItems((prev) => [
        ...prev,
        {
          product: productId,
          name: product.name,
          sku: product.sku,
          unit: product.unit?._id,
          unitName: product.unit?.name || '',
          quantity: Math.max(1, Math.round(product.minStock || 10)),
          unitCost: product.purchaseCost ?? 0,
        },
      ]);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  };

  const updateItem = (index, key, value) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const total = useMemo(
    () => round2(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0)),
    [items]
  );

  const submit = async (event) => {
    event.preventDefault();
    if (items.length === 0) {
      setError(t('sales.itemsEmpty'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/purchases', {
        ...form,
        expectedDate: form.expectedDate ? new Date(`${form.expectedDate}T12:00:00`).toISOString() : null,
        clientKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        items: items.map((i) => ({ product: i.product, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
      });
      toast.success(t('purchases.orderCreated'));
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('purchases.newPurchase')}
      subtitle={t('purchases.receiveHint')}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-ink-muted">{t('common.total')}: </span>
            <span className="text-lg font-semibold text-ink">{formatCurrency(total, currency, locale)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={saving} icon={ShoppingCart}>
              {t('purchases.createOrder')}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label={t('common.supplier')}
            value={form.supplier}
            onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
            options={suppliers.map((s) => ({ value: s._id, label: s.name }))}
            placeholder={t('common.selectOne')}
            required
          />
          <Select
            label={t('common.branch')}
            value={form.branch}
            onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
            options={branches.map((b) => ({ value: b._id, label: pick(b.name, b.nameAm) }))}
            required
          />
          <Input
            label={t('purchases.orderDate')}
            type="date"
            value={form.orderedDate}
            onChange={(e) => setForm((prev) => ({ ...prev, orderedDate: e.target.value }))}
          />
          <Input
            label={t('purchases.expectedDate')}
            type="date"
            value={form.expectedDate}
            onChange={(e) => setForm((prev) => ({ ...prev, expectedDate: e.target.value }))}
          />
          <Input
            label={t('purchases.supplierInvoice')}
            value={form.invoiceNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
            wrapperClassName="sm:col-span-2"
          />
        </div>

        <div className="border border-line rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-ink-50 border-b border-line">
            <p className="text-[13px] font-semibold text-ink">{t('sales.items')}</p>
            <div className="w-64">
              <ProductPicker value="" onChange={addItem} branch={form.branch} />
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">{t('sales.itemsEmpty')}</p>
          ) : (
            <div className="scroll-x">
              <table className="w-full border-collapse min-w-[640px]">
                <thead>
                  <tr>
                    <th className="table-head">{t('common.product')}</th>
                    <th className="table-head w-32">{t('purchases.orderedQuantity')}</th>
                    <th className="table-head w-32">{t('purchases.unitCost')}</th>
                    <th className="table-head w-28 text-right">{t('sales.lineTotal')}</th>
                    <th className="table-head w-12" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.product}>
                      <td className="table-cell">
                        <p className="font-medium text-ink">{item.name}</p>
                        <p className="text-[11px] text-ink-faint font-mono">
                          {item.sku} · {item.unitName}
                        </p>
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          className="input h-9"
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                          className="input h-9"
                        />
                      </td>
                      <td className="table-cell text-right font-semibold">
                        {formatCurrency((Number(item.quantity) || 0) * (Number(item.unitCost) || 0), currency, locale)}
                      </td>
                      <td className="table-cell">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="h-8 w-8 rounded-lg text-ink-muted hover:bg-danger-50 hover:text-danger-700 flex items-center justify-center"
                        >
                          <span className="text-xs">✕</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Textarea label={t('common.notes')} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
      </form>
    </Modal>
  );
}

function ReceiveModal({ purchase, onClose, onSaved }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!purchase) return;
    setError('');
    setItems(
      purchase.items.map((item) => ({
        product: String(item.product),
        name: item.name,
        ordered: item.orderedQuantity,
        received: item.receivedQuantity,
        outstanding: round2(item.orderedQuantity - item.receivedQuantity),
        quantity: round2(item.orderedQuantity - item.receivedQuantity),
        unitCost: item.unitCost,
        unitName: item.unitName,
      }))
    );
  }, [purchase]);

  const update = (index, key, value) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  const submit = async (event) => {
    event.preventDefault();
    const payload = items
      .filter((i) => Number(i.quantity) > 0)
      .map((i) => ({ product: i.product, quantity: Number(i.quantity), unitCost: Number(i.unitCost) }));
    if (payload.length === 0) {
      setError(t('common.required'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/purchases/${purchase._id}/receive`, { items: payload });
      toast.success(t('purchases.goodsReceived'));
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      title={t('purchases.receiveTitle')}
      subtitle={purchase?.purchaseNumber}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} icon={PackageCheck}>
            {t('purchases.receive')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}
        <div className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{t('purchases.receiveHint')}</span>
        </div>

        <div className="scroll-x">
          <table className="w-full border-collapse min-w-[620px]">
            <thead>
              <tr>
                <th className="table-head">{t('common.product')}</th>
                <th className="table-head w-24 text-right">{t('purchases.orderedQuantity')}</th>
                <th className="table-head w-24 text-right">{t('purchases.receivedQuantity')}</th>
                <th className="table-head w-32">{t('purchases.receiveQty')}</th>
                <th className="table-head w-28">{t('purchases.unitCost')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.product}>
                  <td className="table-cell">
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="text-[11px] text-ink-faint">{item.unitName}</p>
                  </td>
                  <td className="table-cell text-right">{formatNumber(item.ordered, locale, 2)}</td>
                  <td className="table-cell text-right">{formatNumber(item.received, locale, 2)}</td>
                  <td className="table-cell">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.outstanding}
                      value={item.quantity}
                      onChange={(e) => update(index, 'quantity', e.target.value)}
                      className="input h-9"
                    />
                  </td>
                  <td className="table-cell">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitCost}
                      onChange={(e) => update(index, 'unitCost', e.target.value)}
                      className="input h-9"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ purchase, onClose, onSaved }) {
  const { t, locale } = useI18n();
  const { currency, settings } = useApp();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!purchase) return;
    setError('');
    setAmount(String(purchase.balance ?? ''));
    setMethod(settings?.defaultPaymentMethods?.[0] || 'cash');
    setNotes('');
  }, [purchase, settings]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/purchases/${purchase._id}/payment`, { amount: Number(amount), method, notes });
      toast.success(t('purchases.paymentRecorded'));
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      title={t('purchases.paymentTitle')}
      subtitle={purchase ? `${purchase.purchaseNumber} · ${t('purchases.outstanding')}: ${formatCurrency(purchase.balance, currency, locale)}` : ''}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} icon={Banknote}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}
        <Input label={t('payments.amount')} type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Select
          label={t('payments.method')}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={(settings?.defaultPaymentMethods || ['cash']).map((m) => ({
            value: m,
            label: t(`payments.${m === 'bank_transfer' ? 'bankTransfer' : m === 'mobile_money' ? 'mobileMoney' : m}`),
          }))}
        />
        <Textarea label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
}

function PurchaseDetailModal({ purchase, onClose }) {
  const { t, locale } = useI18n();
  const { currency } = useApp();
  if (!purchase) return null;
  return (
    <Modal open={Boolean(purchase)} onClose={onClose} title={purchase.purchaseNumber} subtitle={purchase.supplierName} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[11px] text-ink-muted">{t('purchases.orderDate')}</p>
            <p className="font-medium">{formatDate(purchase.orderedDate, locale)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">{t('purchases.receivedDate')}</p>
            <p className="font-medium">{purchase.receivedDate ? formatDate(purchase.receivedDate, locale) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">{t('common.status')}</p>
            <p className="font-medium capitalize">{String(purchase.status).replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-muted">{t('purchases.outstanding')}</p>
            <p className="font-medium">{formatCurrency(purchase.balance, currency, locale)}</p>
          </div>
        </div>

        <div className="scroll-x">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className="table-head">{t('common.product')}</th>
                <th className="table-head text-right">{t('purchases.orderedQuantity')}</th>
                <th className="table-head text-right">{t('purchases.receivedQuantity')}</th>
                <th className="table-head text-right">{t('purchases.unitCost')}</th>
                <th className="table-head text-right">{t('sales.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item, index) => (
                <tr key={index}>
                  <td className="table-cell">
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="text-[11px] text-ink-faint font-mono">{item.sku}</p>
                  </td>
                  <td className="table-cell text-right">{formatNumber(item.orderedQuantity, locale, 2)}</td>
                  <td className="table-cell text-right">{formatNumber(item.receivedQuantity, locale, 2)}</td>
                  <td className="table-cell text-right">{formatCurrency(item.unitCost, currency, locale)}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(item.lineTotal, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {purchase.notes ? (
          <div>
            <p className="text-[11px] text-ink-muted">{t('common.notes')}</p>
            <p className="text-sm text-ink">{purchase.notes}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
