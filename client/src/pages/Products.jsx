import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, Pencil, Trash2, Search, AlertTriangle, Filter, Download, Boxes, Tag,
} from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatCurrency, formatNumber } from '../lib/format.js';
import { fieldValue } from '../lib/form.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { Input, Select, Textarea, SearchInput, Checkbox } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';

const STATUS_TABS = [
  { value: 'all', label: 'products.allProducts' },
  { value: 'low_stock', label: 'products.lowStock' },
  { value: 'out_of_stock', label: 'products.outOfStock' },
  { value: 'in_stock', label: 'products.inStock' },
];

function ProductModal({ open, onClose, product, onSaved }) {
  const { t } = useI18n();
  const { categories, units, suppliers, refreshReferenceData } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setError('');
    setForm(
      product
        ? {
            name: product.name,
            nameAm: product.nameAm || '',
            sku: product.sku,
            barcode: product.barcode || '',
            category: product.category?._id || product.category || '',
            brand: product.brand || '',
            unit: product.unit?._id || product.unit || '',
            purchaseCost: product.purchaseCost ?? 0,
            sellingPrice: product.sellingPrice ?? 0,
            minStock: product.minStock ?? 0,
            reorderQuantity: product.reorderQuantity ?? 0,
            preferredSupplier: product.preferredSupplier?._id || product.preferredSupplier || '',
            storageLocation: product.storageLocation || '',
            taxRate: product.taxRate ?? 15,
            taxable: product.taxable ?? false,
            description: product.description || '',
            active: product.active ?? true,
          }
        : {
            name: '',
            nameAm: '',
            sku: '',
            barcode: '',
            category: categories[0]?._id || '',
            brand: '',
            unit: units[0]?._id || '',
            purchaseCost: 0,
            sellingPrice: 0,
            minStock: 0,
            reorderQuantity: 0,
            preferredSupplier: '',
            storageLocation: '',
            taxRate: 15,
            taxable: false,
            description: '',
            active: true,
          }
    );
  }, [open, product, categories, units]);

  const update = (key) => (input) => {
    setForm((prev) => ({ ...prev, [key]: fieldValue(input) }));
  };

  const margin = useMemo(() => {
    const cost = Number(form.purchaseCost) || 0;
    const price = Number(form.sellingPrice) || 0;
    if (!cost) return 0;
    return ((price - cost) / price) * 100;
  }, [form.purchaseCost, form.sellingPrice]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const payload = {
        ...form,
        purchaseCost: Number(form.purchaseCost) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        minStock: Number(form.minStock) || 0,
        reorderQuantity: Number(form.reorderQuantity) || 0,
        taxRate: Number(form.taxRate) || 0,
        preferredSupplier: form.preferredSupplier || null,
      };
      if (product) {
        await api.patch(`/products/${product._id}`, payload);
        toast.success(t('products.updated'));
      } else {
        await api.post('/products', payload);
        toast.success(t('products.created'));
      }
      refreshReferenceData();
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
      if (Array.isArray(err.details)) {
        const map = {};
        err.details.forEach((d) => {
          map[d.field] = d.message;
        });
        setFieldErrors(map);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? t('products.editProduct') : t('products.addProduct')}
      subtitle={product ? product.sku : t('products.subtitle')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving}>
            {product ? t('common.update') : t('common.add')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label={t('products.productName')}
            value={form.name || ''}
            onChange={update('name')}
            error={fieldErrors.name}
            required
          />
          <Input
            label={t('products.nameAm')}
            value={form.nameAm || ''}
            onChange={update('nameAm')}
            placeholder="ስም በአማርኛ"
          />
          <Input
            label={t('products.sku')}
            value={form.sku || ''}
            onChange={update('sku')}
            error={fieldErrors.sku}
            required
          />
          <Input label={t('products.barcode')} value={form.barcode || ''} onChange={update('barcode')} />
          <Select
            label={t('common.category')}
            value={form.category || ''}
            onChange={update('category')}
            options={categories.map((c) => ({ value: c._id, label: c.nameAm ? `${c.name} · ${c.nameAm}` : c.name }))}
            placeholder={t('common.selectOne')}
            error={fieldErrors.category}
            required
          />
          <Select
            label={t('common.unit')}
            value={form.unit || ''}
            onChange={update('unit')}
            options={units.map((u) => ({ value: u._id, label: u.name }))}
            placeholder={t('common.selectOne')}
            error={fieldErrors.unit}
            required
          />
          <Input label={t('products.brand')} value={form.brand || ''} onChange={update('brand')} />
          <Input
            label={t('products.storageLocation')}
            value={form.storageLocation || ''}
            onChange={update('storageLocation')}
            placeholder="Warehouse A - Rack 3"
          />
          <Input
            label={t('products.purchaseCost')}
            type="number"
            step="0.01"
            min="0"
            value={form.purchaseCost ?? 0}
            onChange={update('purchaseCost')}
            error={fieldErrors.purchaseCost}
          />
          <Input
            label={t('products.sellingPrice')}
            type="number"
            step="0.01"
            min="0"
            value={form.sellingPrice ?? 0}
            onChange={update('sellingPrice')}
            error={fieldErrors.sellingPrice}
            required
          />
          <Input
            label={t('products.minStock')}
            type="number"
            step="0.01"
            min="0"
            value={form.minStock ?? 0}
            onChange={update('minStock')}
          />
          <Input
            label={t('products.reorderQuantity')}
            type="number"
            step="0.01"
            min="0"
            value={form.reorderQuantity ?? 0}
            onChange={update('reorderQuantity')}
          />
          <Select
            label={t('products.preferredSupplier')}
            value={form.preferredSupplier || ''}
            onChange={update('preferredSupplier')}
            options={suppliers.map((s) => ({ value: s._id, label: s.name }))}
            placeholder={t('common.selectOne')}
          />
          <Input
            label={t('products.taxRate')}
            type="number"
            step="0.01"
            min="0"
            value={form.taxRate ?? 0}
            onChange={update('taxRate')}
          />
        </div>

        <div className="rounded-lg bg-ink-50 border border-line px-3.5 py-2.5 flex items-center justify-between">
          <Checkbox label={t('products.taxable')} checked={Boolean(form.taxable)} onChange={update('taxable')} />
          <p className="text-xs text-ink-muted">
            {t('dashboard.estimatedGrossProfit')}:{' '}
            <span className="font-semibold text-ink">{formatNumber(margin, 'en', 1)}%</span>
          </p>
        </div>

        <Textarea label={t('products.description')} value={form.description || ''} onChange={update('description')} />
      </form>
    </Modal>
  );
}

export default function Products() {
  const { t, locale, pick } = useI18n();
  const { currency, categories, branches } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [branch, setBranch] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/products', { params: { search, status, category, branch, page, limit } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || { total: 0, page: 1, pages: 1, limit });
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [search, status, category, branch, page, limit, t, toast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const exportCsv = async () => {
    try {
      const res = await api.get('/products', { params: { search, status, category, branch, limit: 500 } });
      const header = ['SKU', 'Product', 'Category', 'Unit', 'Stock', 'Cost', 'Selling Price', 'Stock Value'];
      const lines = (res.data.data || []).map((p) => [
        p.sku,
        p.name,
        p.category?.name || '',
        p.unit?.name || '',
        p.totalStock,
        p.purchaseCost,
        p.sellingPrice,
        p.totalStockValue,
      ]);
      const csv = [header, ...lines].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  };

  const confirmDelete = async () => {
    setDeletingBusy(true);
    try {
      await api.delete(`/products/${deleting._id}`);
      toast.success(t('products.deleted'));
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setDeletingBusy(false);
    }
  };

  const columns = [
    { key: 'sku', label: t('products.sku'), render: (row) => <span className="font-mono text-[12px] text-ink-muted">{row.sku}</span> },
    {
      key: 'name',
      label: t('common.product'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{pick(row.name, row.nameAm)}</p>
          {row.brand ? <p className="text-[11px] text-ink-faint truncate">{row.brand}</p> : null}
        </div>
      ),
    },
    { key: 'category', label: t('common.category'), render: (row) => row.category?.name || '—' },
    {
      key: 'totalStock',
      label: t('products.currentStock'),
      render: (row) => {
        const qty = branch !== 'all' && row.branchQuantity !== undefined ? row.branchQuantity : row.totalStock;
        const tone = qty <= 0 ? 'text-danger-700' : row.minStock > 0 && qty <= row.minStock ? 'text-warning-700' : 'text-ink';
        return (
          <span className={`font-semibold ${tone}`}>
            {formatNumber(qty, locale, 2)} <span className="text-[11px] font-normal text-ink-faint">{row.unit?.name}</span>
          </span>
        );
      },
    },
    {
      key: 'totalStockValue',
      label: t('products.stockValue'),
      render: (row) => <span>{formatCurrency(row.totalStockValue, currency, locale, { compact: true })}</span>,
    },
    { key: 'sellingPrice', label: t('products.sellingPrice'), render: (row) => formatCurrency(row.sellingPrice, currency, locale) },
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => {
        const qty = branch !== 'all' && row.branchQuantity !== undefined ? row.branchQuantity : row.totalStock;
        if (qty <= 0) return <Badge tone="danger">{t('products.outOfStock')}</Badge>;
        if (row.minStock > 0 && qty <= row.minStock) return <Badge tone="warning">{t('products.lowStock')}</Badge>;
        return <Badge tone="success">{t('products.inStock')}</Badge>;
      },
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {hasPermission('products.update') ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(row);
                setModalOpen(true);
              }}
              className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
              aria-label={t('common.edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {hasPermission('products.delete') ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(row);
              }}
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
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Download} onClick={exportCsv}>
              {t('common.exportCsv')}
            </Button>
            {hasPermission('products.create') ? (
              <Button
                icon={Plus}
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                {t('products.addProduct')}
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder={t('products.searchPlaceholder')}
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
            {STATUS_TABS.map((tab) => (
              <option key={tab.value} value={tab.value}>
                {t(tab.label)}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink max-w-[190px]"
          >
            <option value="all">{t('common.all')} — {t('common.category')}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {pick(c.name, c.nameAm)}
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
          emptyIcon={Package}
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

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editing}
        onSaved={load}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deletingBusy}
        title={t('products.confirmDelete')}
        message={`${deleting?.name || ''} — ${t('common.irreversible')}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
