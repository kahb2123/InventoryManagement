import { useCallback, useEffect, useState } from 'react';
import { Wallet, Plus, Pencil, Trash2, Download } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatDate } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { Input, Select, Textarea } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';

const CATEGORY_KEYS = {
  rent: 'expenses.rent',
  salaries: 'expenses.salaries',
  transportation: 'expenses.transportation',
  loading_unloading: 'expenses.loadingUnloading',
  electricity: 'expenses.electricity',
  telephone_internet: 'expenses.telephoneInternet',
  maintenance: 'expenses.maintenance',
  utilities: 'expenses.utilities',
  marketing: 'expenses.marketing',
  bank_charges: 'expenses.bankCharges',
  other: 'expenses.other',
};

export default function Expenses() {
  const { t, locale } = useI18n();
  const { currency, branches, settings, defaultBranch } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const [byCategory, setByCategory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [branch, setBranch] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses', { params: { page, limit, category, branch, from, to } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
      setSummary(res.data.summary || {});
      setByCategory(res.data.byCategory || []);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, category, branch, from, to, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    const header = ['Reference', 'Date', 'Category', 'Description', 'Payment Method', 'Paid To', 'Employee', 'Amount'];
    const lines = rows.map((r) => [
      r.reference,
      new Date(r.date).toISOString().slice(0, 10),
      r.category,
      r.description,
      r.paymentMethod,
      r.paidTo,
      r.employeeName,
      r.amount,
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/expenses/${deleting._id}`);
      toast.success(t('common.delete'));
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'reference', label: t('common.reference'), render: (row) => <span className="font-mono text-[11px]">{row.reference}</span> },
    { key: 'date', label: t('common.date'), render: (row) => <span className="whitespace-nowrap">{formatDate(row.date, locale)}</span> },
    {
      key: 'category',
      label: t('expenses.category'),
      render: (row) => <Badge tone="navy">{t(CATEGORY_KEYS[row.category] || 'expenses.other')}</Badge>,
    },
    { key: 'description', label: t('expenses.description'), render: (row) => row.description || '—' },
    { key: 'paymentMethod', label: t('payments.method'), render: (row) => row.paymentMethod },
    { key: 'paidTo', label: t('expenses.paidTo'), render: (row) => row.paidTo || '—' },
    {
      key: 'amount',
      label: t('common.amount'),
      render: (row) => <span className="font-semibold text-danger-700">{formatCurrency(row.amount, currency, locale)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        hasPermission('expenses.manage') ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(row);
                setModalOpen(true);
              }}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
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

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Download} onClick={exportCsv}>
              {t('common.exportCsv')}
            </Button>
            {hasPermission('expenses.manage') ? (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                {t('expenses.addExpense')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[12px] text-ink-muted">{t('expenses.totalExpenses')}</p>
          <p className="text-lg font-semibold text-danger-700 mt-0.5">{formatCurrency(summary.total, currency, locale, { compact: true })}</p>
          <p className="text-[11px] text-ink-faint">{summary.count} entries</p>
        </div>
        {byCategory.slice(0, 3).map((item) => (
          <div key={item.category} className="card p-4">
            <p className="text-[12px] text-ink-muted">{t(CATEGORY_KEYS[item.category] || 'expenses.other')}</p>
            <p className="text-lg font-semibold text-ink mt-0.5">{formatCurrency(item.amount, currency, locale, { compact: true })}</p>
            <p className="text-[11px] text-ink-faint">{item.count}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink"
          >
            <option value="all">{t('common.all')} — {t('expenses.category')}</option>
            {Object.entries(CATEGORY_KEYS).map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
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
          emptyIcon={Wallet}
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

      <ExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        expense={editing}
        branches={branches}
        defaultBranch={defaultBranch}
        settings={settings}
        onSaved={load}
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

function ExpenseModal({ open, onClose, expense, branches, defaultBranch, settings, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      expense
        ? {
            category: expense.category,
            amount: expense.amount,
            date: new Date(expense.date).toISOString().slice(0, 10),
            description: expense.description || '',
            paymentMethod: expense.paymentMethod || 'cash',
            paidTo: expense.paidTo || '',
            receiptNumber: expense.receiptNumber || '',
            branch: expense.branch?._id || expense.branch || '',
            notes: expense.notes || '',
          }
        : {
            category: 'rent',
            amount: '',
            date: new Date().toISOString().slice(0, 10),
            description: '',
            paymentMethod: settings?.defaultPaymentMethods?.[0] || 'cash',
            paidTo: '',
            receiptNumber: '',
            branch: defaultBranch?._id || branches[0]?._id || '',
            notes: '',
          }
    );
  }, [open, expense, branches, defaultBranch, settings]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, amount: Number(form.amount), date: new Date(`${form.date}T12:00:00`).toISOString() };
      if (expense) await api.patch(`/expenses/${expense._id}`, payload);
      else await api.post('/expenses', payload);
      toast.success(t('expenses.recorded'));
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
      title={expense ? t('expenses.editExpense') : t('expenses.addExpense')}
      size="lg"
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
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label={t('expenses.category')}
            value={form.category || 'other'}
            onChange={update('category')}
            options={Object.entries(CATEGORY_KEYS).map(([value, key]) => ({ value, label: t(key) }))}
            required
          />
          <Input
            label={t('common.amount')}
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={update('amount')}
            required
          />
          <Input label={t('common.date')} type="date" value={form.date} onChange={update('date')} required />
          <Select
            label={t('payments.method')}
            value={form.paymentMethod || 'cash'}
            onChange={update('paymentMethod')}
            options={(settings?.defaultPaymentMethods || ['cash']).map((m) => ({
              value: m,
              label: t(`payments.${m === 'bank_transfer' ? 'bankTransfer' : m === 'mobile_money' ? 'mobileMoney' : m}`),
            }))}
          />
          <Input label={t('expenses.paidTo')} value={form.paidTo} onChange={update('paidTo')} />
          <Input label={t('expenses.receiptNumber')} value={form.receiptNumber} onChange={update('receiptNumber')} />
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
        <Textarea label={t('expenses.description')} value={form.description} onChange={update('description')} />
        <Textarea label={t('common.notes')} value={form.notes} onChange={update('notes')} />
      </form>
    </Modal>
  );
}
