import { useCallback, useEffect, useState } from 'react';
import { ArrowUpFromLine, ArrowRightLeft, AlertTriangle, Plus } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber, todayInput } from '../lib/format.js';
import { fieldValue } from '../lib/form.js';
import { Button, Card, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { Input, Select, Textarea, Checkbox } from '../components/ui/Form.jsx';
import { Modal } from '../components/ui/Overlay.jsx';
import ProductPicker from '../components/ProductPicker.jsx';

const OUT_TYPES = ['damage', 'expired', 'internal_use', 'adjustment_out', 'stock_out'];

export default function StockOut() {
  const { t, locale, pick } = useI18n();
  const { currency, branches, defaultBranch, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [branchFilter, setBranchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/ledger', {
        params: { page, limit, branch: branchFilter, type: typeFilter, direction: 'out' },
      });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, branchFilter, typeFilter, t, toast]);

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
        <span className="font-semibold text-danger-600">
          -{formatNumber(row.quantity, locale, 2)} <span className="text-[11px] font-normal text-ink-faint">{row.unitName}</span>
        </span>
      ),
    },
    { key: 'unitCost', label: t('stock.cost'), render: (row) => formatCurrency(row.unitCost, currency, locale) },
    { key: 'value', label: t('stock.value'), render: (row) => formatCurrency(row.value, currency, locale) },
    { key: 'balanceAfter', label: t('stock.balanceAfter'), render: (row) => formatNumber(row.balanceAfter, locale, 2) },
    { key: 'reason', label: t('common.reason'), render: (row) => row.reason || row.type },
    { key: 'employeeName', label: t('stock.responsibleEmployee'), render: (row) => row.employeeName || '—' },
    { key: 'branch', label: t('common.branch'), render: (row) => row.branch?.name || '—' },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('stock.stockOut')}
        subtitle={t('stock.subtitle')}
        action={
          <div className="flex items-center gap-2">
            {hasPermission('stock.transfer') && branches.length > 1 ? (
              <Button variant="secondary" icon={ArrowRightLeft} onClick={() => setTransferOpen(true)}>
                {t('stock.transferTitle')}
              </Button>
            ) : null}
            {hasPermission('stock.out') ? (
              <Button icon={Plus} onClick={() => setModalOpen(true)}>
                {t('stock.addStockOut')}
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')} — {t('stock.type')}</option>
            {OUT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'damage'
                  ? t('stock.damaged')
                  : type === 'expired'
                    ? t('stock.expired')
                    : type === 'internal_use'
                      ? t('stock.internalUse')
                      : type === 'adjustment_out'
                        ? t('stock.adjustment')
                        : t('stock.stockOut')}
              </option>
            ))}
          </select>
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
          emptyIcon={ArrowUpFromLine}
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

      <StockOutModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        branches={branches}
        defaultBranch={defaultBranch}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        branches={branches}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />
    </div>
  );
}

function StockOutModal({ open, onClose, branches, defaultBranch, onSaved }) {
  const { t, pick } = useI18n();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    product: '',
    branch: '',
    quantity: '',
    type: 'damage',
    reason: '',
    reference: '',
    notes: '',
    date: todayInput(),
    allowNegative: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [productInfo, setProductInfo] = useState(null);

  const canForceNegative = hasPermission('stock.adjust.approve');

  useEffect(() => {
    if (!open) return;
    setError('');
    setProductInfo(null);
    setForm({
      product: '',
      branch: defaultBranch?._id || branches[0]?._id || '',
      quantity: '',
      type: 'damage',
      reason: '',
      reference: '',
      notes: '',
      date: todayInput(),
      allowNegative: false,
    });
  }, [open, defaultBranch, branches]);

  useEffect(() => {
    if (!form.product) {
      setProductInfo(null);
      return;
    }
    api
      .get(`/products/${form.product}`)
      .then((res) => setProductInfo(res.data.data))
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
      await api.post('/stock/out', {
        ...form,
        quantity: Number(form.quantity),
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

  const available =
    form.branch && productInfo
      ? (productInfo.stockByBranch || []).find((s) => String(s.branch) === String(form.branch))?.quantity ?? 0
      : productInfo?.totalStock ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('stock.addStockOut')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} variant="danger" icon={ArrowUpFromLine}>
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
            <p className={`field-hint ${available <= 0 ? 'text-danger-700 font-semibold' : ''}`}>
              {t('stock.availableStock')}: {formatNumber(available, 'en', 2)} {productInfo.unit?.name}
              {available <= 0 ? ` — ${t('stock.insufficientStockHint')}` : ''}
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
            label={t('stock.type')}
            value={form.type}
            onChange={update('type')}
            options={[
              { value: 'damage', label: t('stock.damaged') },
              { value: 'expired', label: t('stock.expired') },
              { value: 'internal_use', label: t('stock.internalUse') },
              { value: 'adjustment_out', label: t('stock.adjustment') },
              { value: 'stock_out', label: t('stock.stockOut') },
            ]}
            required
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
          <Input label={t('common.date')} type="date" value={form.date} onChange={update('date')} />
          <Input label={t('stock.invoiceNumber')} value={form.reference} onChange={update('reference')} />
          <Input label={t('common.reason')} value={form.reason} onChange={update('reason')} />
        </div>

        {canForceNegative ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-3.5 py-3">
            <Checkbox
              label={t('stock.adjustment')}
              hint={t('stock.insufficientStockHint')}
              checked={form.allowNegative}
              onChange={update('allowNegative')}
            />
          </div>
        ) : null}

        <Textarea label={t('common.notes')} value={form.notes} onChange={update('notes')} />
      </form>
    </Modal>
  );
}

function TransferModal({ open, onClose, branches, onSaved }) {
  const { t, pick } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ product: '', fromBranch: '', toBranch: '', quantity: '', notes: '', inTransit: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      product: '',
      fromBranch: branches[0]?._id || '',
      toBranch: branches[1]?._id || '',
      quantity: '',
      notes: '',
      inTransit: false,
    });
  }, [open, branches]);

  const update = (key) => (input) => {
    setForm((prev) => ({ ...prev, [key]: fieldValue(input) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/stock/transfer', { ...form, quantity: Number(form.quantity) });
      toast.success(t('stock.transferDone'));
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
      title={t('stock.transferTitle')}
      subtitle={t('stock.inTransitHint')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving} icon={ArrowRightLeft}>
            {t('common.confirm')}
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
          <ProductPicker value={form.product} onChange={(value) => setForm((prev) => ({ ...prev, product: value }))} branch={form.fromBranch} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label={t('stock.fromBranch')}
            value={form.fromBranch}
            onChange={update('fromBranch')}
            options={branches.map((b) => ({ value: b._id, label: pick(b.name, b.nameAm) }))}
            required
          />
          <Select
            label={t('stock.toBranch')}
            value={form.toBranch}
            onChange={update('toBranch')}
            options={branches.map((b) => ({ value: b._id, label: pick(b.name, b.nameAm) }))}
            required
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
        </div>

        <Checkbox label={t('stock.inTransit')} hint={t('stock.inTransitHint')} checked={form.inTransit} onChange={update('inTransit')} />

        <Textarea label={t('common.notes')} value={form.notes} onChange={update('notes')} />
      </form>
    </Modal>
  );
}
