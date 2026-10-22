import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle, StatCard } from '../components/ui/Primitives.jsx';
import { Input, Textarea, Checkbox } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';

function BranchModal({ open, onClose, branch, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      branch
        ? {
            name: branch.name || '',
            nameAm: branch.nameAm || '',
            code: branch.code || '',
            address: branch.address || '',
            phone: branch.phone || '',
            isDefault: branch.isDefault ?? false,
            active: branch.active ?? true,
          }
        : {
            name: '',
            nameAm: '',
            code: '',
            address: '',
            phone: '',
            isDefault: false,
            active: true,
          }
    );
  }, [open, branch]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (branch) await api.patch(`/branches/${branch._id}`, form);
      else await api.post('/branches', form);
      toast.success(t('common.save'));
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
      title={branch ? t('branches.editBranch') : t('branches.addBranch')}
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
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label={t('branches.name')} value={form.name || ''} onChange={update('name')} required />
          <Input label={t('common.nameAm')} value={form.nameAm || ''} onChange={update('nameAm')} />
          <Input label={t('branches.code')} value={form.code || ''} onChange={update('code')} required />
          <Input label={t('common.phone')} value={form.phone || ''} onChange={update('phone')} />
          <Input label={t('common.address')} value={form.address || ''} onChange={update('address')} wrapperClassName="sm:col-span-2" />
        </div>
        <Checkbox
          label={t('branches.isDefault')}
          checked={form.isDefault ?? false}
          onChange={(value) => setForm((prev) => ({ ...prev, isDefault: value }))}
        />
        {branch ? (
          <Checkbox
            label={t('common.active')}
            checked={form.active ?? true}
            onChange={(value) => setForm((prev) => ({ ...prev, active: value }))}
          />
        ) : null}
      </form>
    </Modal>
  );
}

export default function Branches() {
  const { t, locale } = useI18n();
  const { currency, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/branches');
      setRows(res.data.data || []);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/branches/${deleting._id}`);
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

  const totalValue = rows.reduce((sum, b) => sum + (b.stockValue || 0), 0);
  const totalQuantity = rows.reduce((sum, b) => sum + (b.stockQuantity || 0), 0);

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('branches.title')}
        subtitle={t('branches.subtitle')}
        action={
          hasPermission('branches.manage') ? (
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              {t('branches.addBranch')}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('nav.branches')} value={rows.length} icon={Building2} tone="navy" />
        <StatCard label={t('branches.stockValue')} value={formatCurrency(totalValue, currency, locale, { compact: true })} icon={Building2} tone="brand" />
        <StatCard label={t('branches.stockQuantity')} value={formatNumber(totalQuantity, locale, 2)} icon={Building2} tone="cyan" />
        <StatCard
          label={t('common.active')}
          value={rows.filter((b) => b.active).length}
          icon={Building2}
          tone="success"
        />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading ? (
          <div className="sm:col-span-2 xl:col-span-3">
            <LoadingBlock />
          </div>
        ) : rows.length === 0 ? (
          <div className="sm:col-span-2 xl:col-span-3">
            <Card>
              <EmptyState icon={Building2} title={t('common.noData')} description={t('common.noDataHint')} />
            </Card>
          </div>
        ) : (
          rows.map((branch) => (
            <Card key={branch._id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{branch.name}</p>
                  <p className="text-[11px] text-ink-faint font-mono">{branch.code}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {branch.isDefault ? <Badge tone="brand">{t('branches.isDefault')}</Badge> : null}
                  {!branch.active ? <Badge tone="neutral">{t('common.inactive')}</Badge> : null}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                  <dt className="text-[10px] text-ink-muted">{t('branches.stockQuantity')}</dt>
                  <dd className="font-semibold text-ink">{formatNumber(branch.stockQuantity, locale, 2)}</dd>
                </div>
                <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                  <dt className="text-[10px] text-ink-muted">{t('branches.stockValue')}</dt>
                  <dd className="font-semibold text-ink">{formatCurrency(branch.stockValue, currency, locale, { compact: true })}</dd>
                </div>
              </dl>

              {branch.phone || branch.address ? (
                <p className="text-[11px] text-ink-muted mt-2.5 truncate">
                  {[branch.phone, branch.address].filter(Boolean).join(' · ')}
                </p>
              ) : null}

              {hasPermission('branches.manage') ? (
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(branch);
                      setModalOpen(true);
                    }}
                    className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(branch)}
                    className="h-8 w-8 rounded-lg text-ink-muted hover:bg-danger-50 hover:text-danger-700 flex items-center justify-center"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>

      <BranchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        branch={editing}
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
        message={`${deleting?.name || ''} — ${t('branches.deleteBlocked')}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
