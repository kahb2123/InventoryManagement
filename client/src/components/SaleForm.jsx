import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, ShoppingCart, AlertTriangle, UserPlus, Percent } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from './ui/Toast.jsx';
import { formatCurrency, formatNumber, todayInput } from '../lib/format.js';
import { Button, Badge } from './ui/Primitives.jsx';
import { Input, Select, Textarea } from './ui/Form.jsx';
import { Modal } from './ui/Overlay.jsx';
import ProductPicker from './ProductPicker.jsx';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export default function SaleForm({ open, onClose, onSaved, initialCustomer }) {
  const { t, locale, pick } = useI18n();
  const { currency, branches, customers, defaultBranch, settings, refreshReferenceData } = useApp();
  const toast = useToast();

  const taxEnabled = settings?.taxEnabled && settings?.showTaxOnInvoice !== false;
  const defaultTaxRate = settings?.taxRate ?? 0;
  const taxInclusive = settings?.taxInclusivePrices ?? false;

  const [form, setForm] = useState({
    customer: '',
    branch: '',
    date: todayInput(),
    paymentMethod: 'cash',
    paidAmount: '',
    reference: '',
    notes: '',
  });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newCustomer, setNewCustomer] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setItems([]);
    setNewCustomer(null);
    setForm({
      customer: initialCustomer || '',
      branch: defaultBranch?._id || branches[0]?._id || '',
      date: todayInput(),
      paymentMethod: settings?.defaultPaymentMethods?.[0] || 'cash',
      paidAmount: '',
      reference: '',
      notes: '',
    });
  }, [open, defaultBranch, branches, settings, initialCustomer]);

  const addItem = async (productId) => {
    if (!productId) return;
    if (items.find((i) => i.product === productId)) return;
    try {
      const res = await api.get(`/products/${productId}`);
      const product = res.data.data;
      setItems((prev) => [
        ...prev,
        {
          product: productId,
          name: product.name,
          nameAm: product.nameAm,
          sku: product.sku,
          unit: product.unit?._id,
          unitName: product.unit?.name || '',
          quantity: 1,
          unitPrice: product.sellingPrice ?? 0,
          discountType: 'none',
          discountValue: 0,
          taxRate: product.taxRate ?? defaultTaxRate,
          taxable: product.taxable ?? false,
          available:
            form.branch && product.stockByBranch
              ? (product.stockByBranch.find((s) => String(s.branch) === String(form.branch))?.quantity ?? 0)
              : product.totalStock,
        },
      ]);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  };

  const updateItem = (index, key, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const lines = useMemo(
    () =>
      items.map((item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const gross = round2(quantity * unitPrice);
        let discount = 0;
        if (item.discountType === 'percent') discount = round2((gross * Math.min(Number(item.discountValue) || 0, 100)) / 100);
        else if (item.discountType === 'amount') discount = round2(Math.min(Number(item.discountValue) || 0, gross));
        const net = round2(gross - discount);
        const taxRate = taxEnabled && item.taxable ? Number(item.taxRate ?? defaultTaxRate) : 0;
        const tax = taxInclusive ? 0 : round2((net * taxRate) / 100);
        const lineTotal = taxInclusive ? net : round2(net + tax);
        return { ...item, gross, discount, tax, taxRate, lineTotal, net };
      }),
    [items, taxEnabled, taxInclusive, defaultTaxRate]
  );

  const totals = useMemo(() => {
    const subtotal = round2(lines.reduce((s, l) => s + l.gross, 0));
    const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
    const taxTotal = round2(lines.reduce((s, l) => s + l.tax, 0));
    const total = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    return { subtotal, discountTotal, taxTotal, total };
  }, [lines]);

  const paidAmount = Math.min(Math.max(0, Number(form.paidAmount) || 0), totals.total);
  const balance = round2(totals.total - paidAmount);

  const overStock = lines.filter((l) => l.quantity > (l.available ?? 0));

  const submit = async (event) => {
    event.preventDefault();
    if (lines.length === 0) {
      setError(t('sales.itemsEmpty'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        customer: form.customer || null,
        branch: form.branch,
        date: form.date ? new Date(`${form.date}T12:00:00`).toISOString() : undefined,
        paymentMethod: form.paymentMethod,
        paidAmount,
        reference: form.reference,
        notes: form.notes,
        clientKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        items: lines.map((l) => ({
          product: l.product,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountType: l.discountType,
          discountValue: l.discountValue,
          taxRate: l.taxRate,
          taxable: l.taxable,
        })),
      };
      const res = await api.post('/sales', payload);
      toast.success(`${t('sales.saleCreated')} — ${res.data.data.invoiceNumber}`);
      refreshReferenceData();
      onSaved?.(res.data.data);
      onClose();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const createCustomer = async (payload) => {
    try {
      const res = await api.post('/customers', payload);
      refreshReferenceData();
      setForm((prev) => ({ ...prev, customer: res.data.data._id }));
      setNewCustomer(null);
      toast.success(t('customers.addCustomer'));
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sales.newSale')}
      subtitle={t('sales.subtitle')}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-ink-muted">{t('sales.grandTotal')}: </span>
            <span className="text-lg font-semibold text-ink">{formatCurrency(totals.total, currency, locale)}</span>
            {balance > 0 ? (
              <span className="ml-3 text-sm text-danger-700 font-medium">
                {t('sales.balance')}: {formatCurrency(balance, currency, locale)}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={saving} icon={ShoppingCart} disabled={lines.length === 0}>
              {t('sales.completeSale')}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}

        {/* Header fields */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label={t('sales.customer')}
                  value={form.customer}
                  onChange={(e) => setForm((prev) => ({ ...prev, customer: e.target.value }))}
                  options={customers.map((c) => ({ value: c._id, label: c.name }))}
                  placeholder={t('sales.walkIn')}
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                icon={UserPlus}
                onClick={() => setNewCustomer({ name: '', phone: '', category: 'retail', creditLimit: 0 })}
                className="mb-0.5"
                type="button"
              >
                {t('common.add')}
              </Button>
            </div>
            {form.customer ? (
              <p className="field-hint">
                {(() => {
                  const c = customers.find((x) => x._id === form.customer);
                  if (!c) return null;
                  return `${t('customers.outstandingBalance')}: ${formatCurrency(c.balance, currency, locale)}`;
                })()}
              </p>
            ) : null}
          </div>
          <Select
            label={t('common.branch')}
            value={form.branch}
            onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
            options={branches.map((b) => ({ value: b._id, label: pick(b.name, b.nameAm) }))}
            required
          />
          <Input
            label={t('sales.invoiceDate')}
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
          />
        </div>

        {/* Items */}
        <div className="border border-line rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-ink-50 border-b border-line">
            <p className="text-[13px] font-semibold text-ink">{t('sales.items')}</p>
            <div className="w-64">
              <ProductPicker
                value=""
                onChange={(value) => addItem(value)}
                branch={form.branch}
                disabled={false}
              />
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">{t('sales.itemsEmpty')}</p>
          ) : (
            <div className="scroll-x">
              <table className="w-full border-collapse min-w-[820px]">
                <thead>
                  <tr>
                    <th className="table-head">{t('common.product')}</th>
                    <th className="table-head w-24">{t('common.quantity')}</th>
                    <th className="table-head w-28">{t('sales.unitPrice')}</th>
                    <th className="table-head w-40">{t('sales.discount')}</th>
                    <th className="table-head w-28 text-right">{t('sales.lineTotal')}</th>
                    <th className="table-head w-12" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.product}>
                      <td className="table-cell">
                        <p className="font-medium text-ink">{pick(line.name, line.nameAm)}</p>
                        <p className="text-[11px] text-ink-faint font-mono">
                          {line.sku} · {line.unitName}
                        </p>
                        {line.quantity > (line.available ?? 0) ? (
                          <Badge tone="danger" className="mt-1">
                            {t('stock.insufficientStock')} ({formatNumber(line.available, locale, 2)})
                          </Badge>
                        ) : null}
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={line.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          className="input h-9"
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                          className="input h-9"
                        />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={line.discountType}
                            onChange={(e) => updateItem(index, 'discountType', e.target.value)}
                            className="h-9 rounded-lg border border-line bg-white px-1.5 text-[12px]"
                          >
                            <option value="none">{t('sales.noDiscount')}</option>
                            <option value="percent">{t('sales.percent')}</option>
                            <option value="amount">{t('sales.amountType')}</option>
                          </select>
                          {line.discountType !== 'none' ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.discountValue}
                              onChange={(e) => updateItem(index, 'discountValue', e.target.value)}
                              className="input h-9 w-20"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="table-cell text-right font-semibold">{formatCurrency(line.lineTotal, currency, locale)}</td>
                      <td className="table-cell">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="h-8 w-8 rounded-lg text-ink-muted hover:bg-danger-50 hover:text-danger-700 flex items-center justify-center"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {overStock.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3.5 py-2.5 text-sm text-warning-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t('stock.insufficientStockHint')}</span>
          </div>
        ) : null}

        {/* Totals & payment */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Select
                label={t('sales.paymentMethod')}
                value={form.paymentMethod}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                options={(settings?.defaultPaymentMethods || ['cash', 'bank_transfer', 'mobile_money']).map((m) => ({
                  value: m,
                  label: t(`payments.${m === 'bank_transfer' ? 'bankTransfer' : m === 'mobile_money' ? 'mobileMoney' : m}`),
                }))}
              />
              <Input
                label={t('common.reference')}
                value={form.reference}
                onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
              />
            </div>
            <Textarea
              label={t('common.notes')}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="rounded-xl border border-line bg-ink-50/70 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">{t('sales.subtotal')}</span>
              <span className="font-medium text-ink">{formatCurrency(totals.subtotal, currency, locale)}</span>
            </div>
            {totals.discountTotal > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">{t('sales.discountTotal')}</span>
                <span className="font-medium text-danger-700">-{formatCurrency(totals.discountTotal, currency, locale)}</span>
              </div>
            ) : null}
            {totals.taxTotal > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">{t('sales.taxTotal')}</span>
                <span className="font-medium text-ink">{formatCurrency(totals.taxTotal, currency, locale)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base pt-2 border-t border-line">
              <span className="font-semibold text-ink">{t('sales.grandTotal')}</span>
              <span className="font-semibold text-ink">{formatCurrency(totals.total, currency, locale)}</span>
            </div>
            <div className="pt-2">
              <Input
                label={t('sales.amountPaid')}
                type="number"
                step="0.01"
                min="0"
                value={form.paidAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, paidAmount: e.target.value }))}
                placeholder="0.00"
              />
              <div className="flex gap-1.5 mt-2">
                <Button size="xs" variant="secondary" type="button" onClick={() => setForm((prev) => ({ ...prev, paidAmount: String(totals.total) }))}>
                  {t('sales.paid')}
                </Button>
                <Button size="xs" variant="secondary" type="button" onClick={() => setForm((prev) => ({ ...prev, paidAmount: '0' }))}>
                  {t('sales.unpaid')}
                </Button>
                {balance > 0 ? (
                  <Button
                    size="xs"
                    variant="secondary"
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, paidAmount: String(paidAmount + balance) }))}
                  >
                    +{formatCurrency(balance, currency, locale, { compact: true })}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-line">
              <span className="font-medium text-ink">{t('sales.balance')}</span>
              <span className={`font-semibold ${balance > 0 ? 'text-danger-700' : 'text-success-700'}`}>
                {formatCurrency(balance, currency, locale)}
              </span>
            </div>
            <p className="text-[11px] text-ink-faint pt-1">
              {t('sales.paymentStatus')}: {balance <= 0 ? t('sales.paid') : paidAmount > 0 ? t('sales.partial') : t('sales.unpaid')}
            </p>
          </div>
        </div>
      </form>

      <QuickCustomerModal open={Boolean(newCustomer)} onClose={() => setNewCustomer(null)} onSave={createCustomer} initial={newCustomer || {}} />
    </Modal>
  );
}

function QuickCustomerModal({ open, onClose, onSave, initial }) {
  const { t } = useI18n();
  const [form, setForm] = useState(initial);
  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);
  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('customers.addCustomer')}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSave({ ...form, creditLimit: Number(form.creditLimit) || 0 })}>{t('common.save')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label={t('customers.name')} value={form.name || ''} onChange={update('name')} required />
        <Input label={t('common.phone')} value={form.phone || ''} onChange={update('phone')} />
        <Select
          label={t('customers.type')}
          value={form.category || 'retail'}
          onChange={update('category')}
          options={[
            { value: 'retail', label: t('customers.retail') },
            { value: 'contractor', label: t('customers.contractor') },
            { value: 'construction_company', label: t('customers.constructionCompany') },
            { value: 'wholesale', label: t('customers.wholesale') },
            { value: 'government', label: t('customers.government') },
            { value: 'other', label: t('customers.other') },
          ]}
        />
        <Input
          label={t('customers.creditLimit')}
          type="number"
          min="0"
          value={form.creditLimit ?? 0}
          onChange={update('creditLimit')}
        />
      </div>
    </Modal>
  );
}
