import { useCallback, useEffect, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, Banknote, FileText, Search } from 'lucide-react';
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

function SupplierModal({ open, onClose, supplier, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      supplier
        ? {
            name: supplier.name,
            nameAm: supplier.nameAm || '',
            contactPerson: supplier.contactPerson || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            city: supplier.city || '',
            taxId: supplier.taxId || '',
            paymentTerms: supplier.paymentTerms || '',
            notes: supplier.notes || '',
          }
        : {
            name: '',
            nameAm: '',
            contactPerson: '',
            phone: '',
            email: '',
            address: '',
            city: '',
            taxId: '',
            paymentTerms: '',
            notes: '',
          }
    );
  }, [open, supplier]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (supplier) await api.patch(`/suppliers/${supplier._id}`, form);
      else await api.post('/suppliers', form);
      toast.success(supplier ? t('common.update') : t('common.add'));
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
      title={supplier ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
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
          <Input label={t('suppliers.name')} value={form.name || ''} onChange={update('name')} required />
          <Input label={t('common.nameAm')} value={form.nameAm || ''} onChange={update('nameAm')} />
          <Input label={t('suppliers.contactPerson')} value={form.contactPerson || ''} onChange={update('contactPerson')} />
          <Input label={t('common.phone')} value={form.phone || ''} onChange={update('phone')} />
          <Input label={t('common.email')} type="email" value={form.email || ''} onChange={update('email')} />
          <Input label={t('common.address')} value={form.address || ''} onChange={update('address')} />
          <Input label={t('suppliers.city')} value={form.city || ''} onChange={update('city')} />
          <Input label={t('suppliers.taxId')} value={form.taxId || ''} onChange={update('taxId')} />
          <Input
            label={t('suppliers.paymentTerms')}
            value={form.paymentTerms || ''}
            onChange={update('paymentTerms')}
            wrapperClassName="sm:col-span-2"
            placeholder="30 days credit"
          />
        </div>
        <Textarea label={t('common.notes')} value={form.notes || ''} onChange={update('notes')} />
      </form>
    </Modal>
  );
}

function SupplierPaymentModal({ supplier, onClose, onSaved }) {
  const { t, locale } = useI18n();
  const { currency, settings } = useApp();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supplier) return;
    setError('');
    setAmount(String(supplier.balance ?? ''));
    setMethod(settings?.defaultPaymentMethods?.[0] || 'cash');
  }, [supplier, settings]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/payments', {
        type: 'supplier_payment',
        party: supplier._id,
        amount: Number(amount),
        method,
        date: new Date(`${date}T12:00:00`).toISOString(),
        notes,
      });
      toast.success(t('suppliers.paymentRecorded'));
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
      open={Boolean(supplier)}
      onClose={onClose}
      title={t('suppliers.recordPayment')}
      subtitle={supplier?.name}
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
        {supplier ? (
          <p className="text-sm text-ink-muted">
            {t('suppliers.outstandingBalance')}:{' '}
            <span className="font-semibold text-warning-700">{formatCurrency(supplier.balance, currency, locale)}</span>
          </p>
        ) : null}
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
        <Input label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Textarea label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
}

function StatementModal({ supplier, onClose }) {
  const { t, locale } = useI18n();
  const { currency } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplier) return;
    setLoading(true);
    api
      .get(`/suppliers/${supplier._id}/statement`)
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [supplier]);

  return (
    <Modal
      open={Boolean(supplier)}
      onClose={onClose}
      title={t('suppliers.statement')}
      subtitle={supplier?.name}
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : !data ? (
        <EmptyState title={t('common.noData')} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-[11px] text-ink-muted">{t('suppliers.totalPurchases')}</p>
              <p className="font-semibold text-ink">{formatCurrency(data.balance.totalPurchases, currency, locale)}</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-[11px] text-ink-muted">{t('payments.supplierPayment')}</p>
              <p className="font-semibold text-success-700">{formatCurrency(data.balance.payments, currency, locale)}</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-[11px] text-ink-muted">{t('suppliers.outstandingBalance')}</p>
              <p className="font-semibold text-warning-700">{formatCurrency(data.balance.balance, currency, locale)}</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-[11px] text-ink-muted">{t('nav.purchases')}</p>
              <p className="font-semibold text-ink">{data.balance.invoiceCount}</p>
            </div>
          </div>

          <div className="scroll-x max-h-80 overflow-y-auto">
            <table className="w-full border-collapse min-w-[520px]">
              <thead>
                <tr>
                  <th className="table-head">{t('common.date')}</th>
                  <th className="table-head">{t('common.reference')}</th>
                  <th className="table-head text-right">{t('common.amount')}</th>
                  <th className="table-head text-right">{t('suppliers.outstandingBalance')}</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-cell text-center text-ink-muted">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  data.lines.map((line, index) => (
                    <tr key={index}>
                      <td className="table-cell whitespace-nowrap">{formatDate(line.date, locale)}</td>
                      <td className="table-cell">
                        <span className="font-mono text-[11px]">{line.reference}</span>
                        <span className="block text-[11px] text-ink-muted">{line.description}</span>
                      </td>
                      <td className="table-cell text-right">
                        {line.debit > 0 ? (
                          <span className="font-medium text-warning-700">{formatCurrency(line.debit, currency, locale)}</span>
                        ) : (
                          <span className="font-medium text-success-700">{formatCurrency(line.credit, currency, locale)}</span>
                        )}
                      </td>
                      <td className="table-cell text-right font-semibold">{formatCurrency(line.runningBalance, currency, locale)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Suppliers() {
  const { t, locale, pick } = useI18n();
  const { currency, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [statement, setStatement] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers', { params: { page, limit, search } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, t, toast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/suppliers/${deleting._id}`);
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

  const columns = [
    {
      key: 'name',
      label: t('suppliers.name'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{pick(row.name, row.nameAm)}</p>
          {row.contactPerson ? <p className="text-[11px] text-ink-faint">{row.contactPerson}</p> : null}
        </div>
      ),
    },
    { key: 'phone', label: t('common.phone'), render: (row) => row.phone || '—' },
    { key: 'city', label: t('suppliers.city'), render: (row) => row.city || '—' },
    { key: 'totalPurchases', label: t('suppliers.totalPurchases'), render: (row) => formatCurrency(row.totalPurchases, currency, locale) },
    {
      key: 'balance',
      label: t('suppliers.outstandingBalance'),
      render: (row) => (
        <span className={row.balance > 0 ? 'font-semibold text-warning-700' : 'text-ink-faint'}>
          {formatCurrency(row.balance, currency, locale)}
        </span>
      ),
    },
    { key: 'paymentTerms', label: t('suppliers.paymentTerms'), render: (row) => row.paymentTerms || '—' },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {hasPermission('payments.create') && row.balance > 0 ? (
            <button
              type="button"
              onClick={() => setPaying(row)}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-success-50 hover:text-success-700 flex items-center justify-center"
              aria-label={t('suppliers.recordPayment')}
            >
              <Banknote className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setStatement(row)}
            className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
            aria-label={t('suppliers.statement')}
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
          {hasPermission('suppliers.manage') ? (
            <button
              type="button"
              onClick={() => {
                setEditing(row);
                setModalOpen(true);
              }}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
              aria-label={t('common.edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {hasPermission('suppliers.delete') ? (
            <button
              type="button"
              onClick={() => setDeleting(row)}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-danger-50 hover:text-danger-700 flex items-center justify-center"
              aria-label={t('common.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        action={
          hasPermission('suppliers.manage') ? (
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              {t('suppliers.addSupplier')}
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="p-4 border-b border-line">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={t('suppliers.searchPlaceholder')}
            className="w-full sm:w-72"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyIcon={Truck}
          emptyTitle={t('suppliers.noSuppliers')}
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

      <SupplierModal open={modalOpen} onClose={() => setModalOpen(false)} supplier={editing} onSaved={load} />
      <SupplierPaymentModal supplier={paying} onClose={() => setPaying(null)} onSaved={() => { load(); refreshReferenceData(); }} />
      <StatementModal supplier={statement} onClose={() => setStatement(null)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title={t('common.confirmDelete')}
        message={`${deleting?.name || ''} — ${t('common.irreversible')}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
