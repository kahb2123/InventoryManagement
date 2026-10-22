import { useCallback, useEffect, useState } from 'react';
import { Boxes, Plus, Pencil, Trash2, Ruler, RefreshCw } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle, Tabs } from '../components/ui/Primitives.jsx';
import { DataTable } from '../components/ui/Table.jsx';
import { Input, Select, Textarea } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';
import { CATEGORY_COLORS } from '../lib/colors.js';

const COLORS = CATEGORY_COLORS;

function CategoryModal({ open, onClose, category, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', nameAm: '', description: '', color: COLORS[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      category
        ? {
            name: category.name,
            nameAm: category.nameAm || '',
            description: category.description || '',
            color: category.color || COLORS[0],
          }
        : { name: '', nameAm: '', description: '', color: COLORS[0] }
    );
  }, [open, category]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (category) await api.patch(`/products/categories/${category._id}`, form);
      else await api.post('/products/categories', form);
      toast.success(category ? t('common.update') : t('common.add'));
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
      title={category ? t('categories.editCategory') : t('categories.addCategory')}
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
        <Input label={t('categories.name')} value={form.name} onChange={update('name')} required />
        <Input label={t('products.nameAm')} value={form.nameAm} onChange={update('nameAm')} />
        <Textarea label={t('categories.description')} value={form.description} onChange={update('description')} />
        <div>
          <p className="field-label">{t('categories.color')}</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, color }))}
                style={{ background: color }}
                className={`h-7 w-7 rounded-lg transition ${
                  form.color === color ? 'ring-2 ring-offset-2 ring-navy-900' : 'hover:scale-110'
                }`}
                aria-label={color}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function UnitModal({ open, onClose, unit, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      unit
        ? {
            code: unit.code,
            name: unit.name,
            nameAm: unit.nameAm || '',
            type: unit.type,
            dimension: unit.dimension,
            baseFactor: unit.baseFactor ?? 1,
            loadQuantity: unit.loadQuantity ?? '',
          }
        : { code: '', name: '', nameAm: '', type: 'count', dimension: 'each', baseFactor: 1, loadQuantity: '' }
    );
  }, [open, unit]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        baseFactor: Number(form.baseFactor) || 1,
        loadQuantity: form.loadQuantity === '' ? null : Number(form.loadQuantity),
      };
      if (unit) await api.patch(`/products/units/${unit._id}`, payload);
      else await api.post('/products/units', payload);
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
      title={unit ? t('units.name') : t('units.addUnit')}
      subtitle={t('units.subtitle')}
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
          <Input label={t('units.code')} value={form.code || ''} onChange={update('code')} required />
          <Input label={t('units.name')} value={form.name || ''} onChange={update('name')} required />
          <Input label={t('products.nameAm')} value={form.nameAm || ''} onChange={update('nameAm')} />
          <Select
            label={t('units.dimension')}
            value={form.dimension || 'each'}
            onChange={update('dimension')}
            options={[
              { value: 'each', label: t('units.dimensionCount') },
              { value: 'mass', label: t('units.dimensionMass') },
              { value: 'length', label: t('units.dimensionLength') },
              { value: 'area', label: t('units.dimensionArea') },
              { value: 'volume', label: t('units.dimensionVolume') },
            ]}
          />
          <Input
            label={t('units.baseFactor')}
            type="number"
            step="0.0001"
            min="0.0001"
            value={form.baseFactor ?? 1}
            onChange={update('baseFactor')}
            hint="1 ton = 1000 kg uses baseFactor 1000 for ton, 1 for kg"
          />
          <Input
            label={t('units.loadQuantity')}
            type="number"
            step="0.01"
            min="0"
            value={form.loadQuantity ?? ''}
            onChange={update('loadQuantity')}
            hint="Known quantity carried by one truck load"
          />
        </div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  const { t, pick } = useI18n();
  const { currency, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, unitRes] = await Promise.all([api.get('/products/categories'), api.get('/products/units')]);
      setCategories(catRes.data.data || []);
      setUnits(unitRes.data.data || []);
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
    setDeletingBusy(true);
    try {
      await api.delete(`/products/categories/${deleting._id}`);
      toast.success(t('common.delete'));
      setDeleting(null);
      load();
      refreshReferenceData();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setDeletingBusy(false);
    }
  };

  if (loading) return <LoadingBlock label={t('app.loading')} />;

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Tabs
              tabs={[
                { value: 'categories', label: t('nav.categories') },
                { value: 'units', label: t('units.title') },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'categories' && hasPermission('categories.manage') ? (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                {t('categories.addCategory')}
              </Button>
            ) : null}
            {tab === 'units' && hasPermission('units.manage') ? (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                {t('units.addUnit')}
              </Button>
            ) : null}
          </div>
        }
      />

      {tab === 'categories' ? (
        <Card>
          <DataTable
            columns={[
              {
                key: 'name',
                label: t('categories.name'),
                render: (row) => (
                  <div className="flex items-center gap-2.5">
                    <span className="h-7 w-7 rounded-lg" style={{ background: row.color || COLORS[0] }} />
                    <div>
                      <p className="font-medium text-ink">{pick(row.name, row.nameAm)}</p>
                      {row.nameAm ? <p className="text-[11px] text-ink-faint">{row.nameAm}</p> : null}
                    </div>
                  </div>
                ),
              },
              { key: 'productCount', label: t('categories.productCount'), render: (row) => formatNumber(row.productCount, 'en', 0) },
              {
                key: 'stockValue',
                label: t('categories.stockValue'),
                render: (row) => formatCurrency(row.stockValue, currency, 'en', { compact: true }),
              },
              { key: 'description', label: t('common.notes'), render: (row) => row.description || '—' },
              {
                key: 'actions',
                label: '',
                render: (row) =>
                  hasPermission('categories.manage') ? (
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
            ]}
            rows={categories}
            emptyIcon={Boxes}
            emptyTitle={t('common.noData')}
          />
        </Card>
      ) : (
        <Card>
          <DataTable
            columns={[
              { key: 'code', label: t('units.code'), render: (row) => <span className="font-mono text-[12px]">{row.code}</span> },
              { key: 'name', label: t('units.name'), render: (row) => pick(row.name, row.nameAm) },
              { key: 'dimension', label: t('units.dimension'), render: (row) => <Badge tone="navy">{row.dimension}</Badge> },
              { key: 'baseFactor', label: t('units.baseFactor'), render: (row) => formatNumber(row.baseFactor, 'en', 4) },
              {
                key: 'loadQuantity',
                label: t('units.loadQuantity'),
                render: (row) => (row.loadQuantity ? formatNumber(row.loadQuantity, 'en', 2) : '—'),
              },
              { key: 'productCount', label: t('categories.productCount'), render: (row) => formatNumber(row.productCount, 'en', 0) },
            ]}
            rows={units}
            emptyIcon={Ruler}
            emptyTitle={t('common.noData')}
          />
        </Card>
      )}

      <CategoryModal open={modalOpen && tab === 'categories'} onClose={() => setModalOpen(false)} category={editing} onSaved={load} />
      <UnitModal open={modalOpen && tab === 'units'} onClose={() => setModalOpen(false)} unit={editing} onSaved={load} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletingBusy}
        title={t('common.confirmDelete')}
        message={deleting?.productCount ? t('categories.cannotDelete') : t('common.irreversible')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
