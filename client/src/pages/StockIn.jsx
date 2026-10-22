import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Package, Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber, todayInput } from '../lib/format.js';
import { fieldValue } from '../lib/form.js';
import { Button, Card, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { Input, Select, Textarea } from '../components/ui/Form.jsx';
import { Modal } from '../components/ui/Overlay.jsx';
import ProductPicker from '../components/ProductPicker.jsx';

const SOURCE_TYPES = ['stock_in', 'opening_balance', 'customer_return', 'adjustment_in'];

export default function StockIn() {
  const { t, locale, pick } = useI18n();
  const { currency, branches, suppliers, defaultBranch, refreshReferenceData } = useApp();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [branchFilter, setBranchFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/ledger', {
        params: { page, limit, branch: branchFilter, type: 'stock_in', direction: 'in' },
      });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, branchFilter, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: 'date',
      label: t('common.date'),
      render: (row) => (
        <span className="whitespace-nowrap">
          {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
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
        <span className="font-semibold text-success-700">
          +{formatNumber(row.quantity, locale, 2)} <span className="text-[11px] font-normal text-ink-faint">{row.unitName}</span>
        </span>
      ),
    },
    { key: 'unitCost', label: t('stock.cost'), render: (row) => formatCurrency(row.unitCost, currency, locale) },
    { key: 'value', label: t('stock.value'), render: (row) => formatCurrency(row.value, currency, locale) },
    { key: 'balanceAfter', label: t('stock.balanceAfter'), render: (row) => formatNumber(row.balanceAfter, locale, 2) },
    { key: 'sourceType', label: t('stock.source'), render: (row) => <span className="capitalize">{row.sourceType || row.type}</span> },
    { key: 'employeeName', label: t('stock.receivingEmployee'), render: (row) => row.employeeName || '—' },
    { key: 'branch', label: t('common.branch'), render: (row) => row.branch?.name || '—' },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('stock.stockIn')}
        subtitle={t('stock.subtitle')}
        action={
          <Button icon={Plus} onClick={() => setModalOpen(true)}>
            {t('stock.addStockIn')}
          </Button>
        }
      />

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          {branches.length > 1 ? (
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
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
          emptyIcon={ArrowDownToLine}
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

      <StockInModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        branches={branches}
        defaultBranch={defaultBranch}
        suppliers={suppliers}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />
    </div>
  );
}

function StockInModal({ open, onClose, branches, defaultBranch, suppliers, onSaved }) {
  const { t, pick } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    product: '',
    branch: '',
    quantity: '',
    unitCost: '',
    supplier: '',
    type: 'stock_in',
    reference: '',
    notes: '',
    date: todayInput(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [productInfo, setProductInfo] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setProductInfo(null);
    setForm({
      product: '',
      branch: defaultBranch?._id || branches[0]?._id || '',
      quantity: '',
      unitCost: '',
      supplier: '',
      type: 'stock_in',
      reference: '',
      notes: '',
      date: todayInput(),
    });
  }, [open, defaultBranch, branches]);

  useEffect(() => {
    if (!form.product) {
      setProductInfo(null);
      return;
    }
    api
      .get(`/products/${form.product}`)
      .then((res) => {
        setProductInfo(res.data.data);
        setForm((prev) => ({ ...prev, unitCost: String(res.data.data.purchaseCost ?? '') }));
      })
      .catch(() => setProductInfo(null));
  }, [form.product]);

  const update = (key) => (input) => {
    setForm((prev) => ({ ...prev, [key]: fieldValue(input) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/stock/in', {
        ...form,
        quantity: Number(form.quantity),
        unitCost: form.unitCost === '' ? undefined : Number(form.unitCost),
        supplier: form.supplier || null,
      });
      toast.success(t('stock.recorded'));
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
      title={t('stock.addStockIn')}
      subtitle={t('stock.subtitle')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} icon={ArrowDownToLine}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}

        <div>
          <p className="field-label">
            {t('common.product')}
            <span className="text-danger-700 ml-0.5">*</span>
          </p>
          <ProductPicker value={form.product} onChange={(value) => setForm((prev) => ({ ...prev, product: value }))} branch={form.branch} />
          {productInfo ? (
            <p className="field-hint">
              {t('stock.currentStock')}: {formatNumber(productInfo.totalStock, 'en', 2)} {productInfo.unit?.name} ·{' '}
              {t('products.sellingPrice')}: {productInfo.sellingPrice} {productInfo.minStock > 0 ? `· ${t('products.minStock')}: ${productInfo.minStock}` : ''}
            </p>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label={t('common.branch')}
            value={form.branch}
            onChange={update('branch')}
            options={branches.map((b) => ({ value: b._id, label: pick(b.name, b.nameAm) }))}
            required
          />
          <Select
            label={t('stock.sourceType')}
            value={form.type}
            onChange={update('type')}
            options={[
              { value: 'stock_in', label: t('stock.purchase') },
              { value: 'opening_balance', label: t('stock.opening') },
              { value: 'customer_return', label: t('stock.customerReturn') },
              { value: 'adjustment_in', label: t('stock.adjustment') },
            ]}
          />
          <Input
            label={t('common.quantity')}
            type="number"
            step="0.01"
            min="0.0001"
            value={form.quantity}
            onChange={update('quantity')}
            required
          />
          <Input
            label={t('stock.cost')}
            type="number"
            step="0.01"
            min="0"
            value={form.unitCost}
            onChange={update('unitCost')}
            hint={t('settings.costMethod')}
          />
          <Select
            label={t('common.supplier')}
            value={form.supplier}
            onChange={update('supplier')}
            options={suppliers.map((s) => ({ value: s._id, label: s.name }))}
            placeholder={t('common.selectOne')}
          />
          <Input
            label={t('stock.invoiceNumber')}
            value={form.reference}
            onChange={update('reference')}
            placeholder="INV-2043"
          />
          <Input label={t('common.date')} type="date" value={form.date} onChange={update('date')} />
        </div>

        <Textarea label={t('common.notes')} value={form.notes} onChange={update('notes')} />
      </form>
    </Modal>
  );
}
