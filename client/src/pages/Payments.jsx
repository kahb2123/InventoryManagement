import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Download, Trash2, Plus } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatDate } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { SearchInput, Input, Select, Textarea } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';

export default function Payments() {
  const { t, locale } = useI18n();
  const { currency, customers, suppliers, settings, defaultBranch, branches, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [method, setMethod] = useState('all');
  const [branch, setBranch] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments', { params: { page, limit, search, type, method, branch, from, to } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
      setSummary(res.data.summary || []);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, type, method, branch, from, to, t, toast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/payments/${deleting._id}`);
      toast.success(t('common.delete'));
      setDeleting(null);
      load();
      refreshReferenceData();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = ['Reference', 'Date', 'Type', 'Party', 'Method', 'Amount'];
    const lines = rows.map((r) => [
      r.reference,
      new Date(r.date).toISOString().slice(0, 10),
      r.type,
      r.partyName,
      r.method,
      r.amount,
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'reference', label: t('payments.reference'), render: (row) => <span className="font-mono text-[11px]">{row.reference}</span> },
    { key: 'date', label: t('common.date'), render: (row) => <span className="whitespace-nowrap">{formatDate(row.date, locale)}</span> },
    {
      key: 'type',
      label: t('common.type'),
      render: (row) => (
        <Badge tone={row.type === 'customer_receipt' ? 'success' : 'warning'}>
          {row.type === 'customer_receipt' ? t('payments.receipt') : t('payments.supplierPayment')}
        </Badge>
      ),
    },
    { key: 'partyName', label: t('payments.party'), render: (row) => row.partyName || '—' },
    { key: 'method', label: t('payments.method'), render: (row) => row.method },
    {
      key: 'amount',
      label: t('common.amount'),
      render: (row) => (
        <span className={`font-semibold ${row.amount >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
          {formatCurrency(row.amount, currency, locale)}
        </span>
      ),
    },
    { key: 'recordedByName', label: t('sales.recordedBy'), render: (row) => row.recordedByName || '—' },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        hasPermission('payments.create') ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDeleting(row)}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-danger-50 hover:text-danger-700 flex items-center justify-center"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null,
    },
  ];

  const receipts = summary.find((s) => s.type === 'customer_receipt');
  const supplierPayments = summary.find((s) => s.type === 'supplier_payment');

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('payments.title')}
        subtitle={t('payments.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Download} onClick={exportCsv}>
              {t('common.exportCsv')}
            </Button>
            {hasPermission('payments.create') ? (
              <Button icon={Plus} onClick={() => setModalOpen(true)}>
                {t('payments.title')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('payments.receipt')}</p>
          <p className="text-lg font-semibold text-success-700 mt-0.5">
            {formatCurrency(receipts?.amount || 0, currency, locale, { compact: true })}
          </p>
          <p className="text-[11px] text-ink-faint">{receipts?.count || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('payments.supplierPayment')}</p>
          <p className="text-lg font-semibold text-warning-700 mt-0.5">
            {formatCurrency(supplierPayments?.amount || 0, currency, locale, { compact: true })}
          </p>
          <p className="text-[11px] text-ink-faint">{supplierPayments?.count || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('dashboard.cashCollected')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">
            {formatCurrency((receipts?.amount || 0) - (supplierPayments?.amount || 0), currency, locale, { compact: true })}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('common.total')}</p>
          <p className="text-lg font-semibold text-ink mt-0.5">{meta.total}</p>
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
            placeholder={t('payments.searchPlaceholder')}
            className="w-full sm:w-64"
          />
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')} — {t('common.type')}</option>
            <option value="customer_receipt">{t('payments.receipt')}</option>
            <option value="supplier_payment">{t('payments.supplierPayment')}</option>
          </select>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')} — {t('payments.method')}</option>
            {(settings?.defaultPaymentMethods || ['cash', 'bank_transfer', 'mobile_money']).map((m) => (
              <option key={m} value={m}>
                {t(`payments.${m === 'bank_transfer' ? 'bankTransfer' : m === 'mobile_money' ? 'mobileMoney' : m}`)}
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
                  {b.name}
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
          emptyIcon={CreditCard}
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

      <PaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customers={customers}
        suppliers={suppliers}
        branches={branches}
        defaultBranch={defaultBranch}
        settings={settings}
        onSaved={() => {
          load();
          refreshReferenceData();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title={t('common.confirmDelete')}
        message={`${deleting?.reference || ''} — ${t('common.irreversible')}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}

function PaymentModal({ open, onClose, customers, suppliers, branches, defaultBranch, settings, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    type: 'customer_receipt',
    party: '',
    amount: '',
    method: 'cash',
    date: new Date().toISOString().slice(0, 10),
    branch: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      type: 'customer_receipt',
      party: '',
      amount: '',
      method: settings?.defaultPaymentMethods?.[0] || 'cash',
      date: new Date().toISOString().slice(0, 10),
      branch: defaultBranch?._id || branches[0]?._id || '',
      notes: '',
    });
  }, [open, settings, defaultBranch, branches]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/payments', {
        ...form,
        amount: Number(form.amount),
        date: new Date(`${form.date}T12:00:00`).toISOString(),
      });
      toast.success(t('payments.recorded'));
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const partyOptions =
    form.type === 'customer_receipt'
      ? customers.map((c) => ({ value: c._id, label: c.name }))
      : suppliers.map((s) => ({ value: s._id, label: s.name }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payments.title')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}
        <Select
          label={t('common.type')}
          value={form.type}
          onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value, party: '' }))}
          options={[
            { value: 'customer_receipt', label: t('payments.receipt') },
            { value: 'supplier_payment', label: t('payments.supplierPayment') },
          ]}
        />
        <Select
          label={t('payments.party')}
          value={form.party}
          onChange={update('party')}
          options={partyOptions}
          placeholder={t('common.selectOne')}
          required
        />
        <Input
          label={t('payments.amount')}
          type="number"
          step="0.01"
          min="0.01"
          value={form.amount}
          onChange={update('amount')}
          required
        />
        <Select
          label={t('payments.method')}
          value={form.method}
          onChange={update('method')}
          options={(settings?.defaultPaymentMethods || ['cash']).map((m) => ({
            value: m,
            label: t(`payments.${m === 'bank_transfer' ? 'bankTransfer' : m === 'mobile_money' ? 'mobileMoney' : m}`),
          }))}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label={t('common.date')} type="date" value={form.date} onChange={update('date')} required />
          {branches.length > 1 ? (
            <Select
              label={t('common.branch')}
              value={form.branch || ''}
              onChange={update('branch')}
              options={branches.map((b) => ({ value: b._id, label: b.name }))}
              placeholder={t('common.selectOne')}
            />
          ) : null}
        </div>
        <Textarea label={t('common.notes')} value={form.notes} onChange={update('notes')} />
      </form>
    </Modal>
  );
}
