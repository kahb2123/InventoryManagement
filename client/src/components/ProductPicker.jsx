import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Package, Check } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { formatNumber } from '../lib/format.js';

/**
 * Searchable product selector. Loads products from the API as the user types
 * and shows live stock for the selected branch.
 */
export default function ProductPicker({ value, onChange, branch, disabled, autoFocus }) {
  const { t, locale, pick } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get('/products', { params: { search, limit: 30, branch: branch || 'all' } })
        .then((res) => active && setOptions(res.data.data || []))
        .catch(() => active && setOptions([]))
        .finally(() => active && setLoading(false));
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, search, branch]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected && selected._id === value) return;
    api
      .get(`/products/${value}`)
      .then((res) => setSelected(res.data.data))
      .catch(() => setSelected(null));
  }, [value, selected]);

  const label = useMemo(() => {
    if (!selected) return null;
    const qty = branch && branch !== 'all' && selected.branchQuantity !== undefined ? selected.branchQuantity : selected.totalStock;
    return `${selected.name} · ${selected.sku} — ${formatNumber(qty, locale, 2)} ${selected.unit?.name || ''}`;
  }, [selected, branch, locale]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        autoFocus={autoFocus}
        className="input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-ink-faint'}`}>
          {label || t('common.searchPlaceholder')}
        </span>
        <ChevronDown className="h-4 w-4 text-ink-faint shrink-0" />
      </button>

      {open ? (
        <div className="absolute z-40 mt-1.5 w-full min-w-[320px] rounded-xl border border-line bg-white shadow-pop overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('products.searchPlaceholder')}
                className="input pl-9"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-ink-muted">{t('common.loading')}</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ink-muted">{t('common.noData')}</p>
            ) : (
              options.map((product) => {
                const qty =
                  branch && branch !== 'all' && product.branchQuantity !== undefined
                    ? product.branchQuantity
                    : product.totalStock;
                const active = selected?._id === product._id;
                return (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => {
                      onChange(product._id);
                      setSelected(product);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-ink-50 ${
                      active ? 'bg-brand-50' : ''
                    }`}
                  >
                    <span className="h-8 w-8 rounded-lg bg-ink-100 text-ink-faint flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-ink truncate">
                        {pick(product.name, product.nameAm)}
                      </span>
                      <span className="block text-[11px] text-ink-faint truncate">
                        {product.sku} · {product.category?.name || ''} · {product.unit?.name}
                      </span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold shrink-0 ${
                        qty <= 0 ? 'text-danger-700' : product.minStock > 0 && qty <= product.minStock ? 'text-warning-700' : 'text-ink-muted'
                      }`}
                    >
                      {formatNumber(qty, locale, 2)}
                    </span>
                    {active ? <Check className="h-4 w-4 text-brand-600 shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
