import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { EmptyState } from './Primitives.jsx';

export function DataTable({
  columns,
  rows,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyIcon,
  onRowClick,
  rowKey = (row) => row._id || row.id,
  sort,
  onSortChange,
  className = '',
}) {
  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-ink-muted">
        <div className="h-6 w-6 mx-auto mb-3 rounded-full border-2 border-line border-t-brand-500 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={`scroll-x ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`table-head whitespace-nowrap ${column.className || ''}`}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.sortable && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => onSortChange(column.key)}
                    className="inline-flex items-center gap-1 hover:text-ink transition"
                  >
                    {column.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition ${onRowClick ? 'cursor-pointer hover:bg-ink-50/80' : 'hover:bg-ink-50/50'}`}
            >
              {columns.map((column) => (
                <td key={column.key} className={`table-cell ${column.cellClassName || ''}`}>
                  {column.render ? column.render(row, index) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page = 1, pages = 1, total = 0, limit = 25, onPageChange, onLimitChange, t }) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line">
      <p className="text-xs text-ink-muted">
        {t ? t('common.showing') : 'Showing'} <span className="font-semibold text-ink">{from}</span>–
        <span className="font-semibold text-ink">{to}</span> {t ? t('common.of') : 'of'}{' '}
        <span className="font-semibold text-ink">{total}</span> {t ? t('common.results') : 'results'}
      </p>
      <div className="flex items-center gap-2">
        {onLimitChange ? (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
            className="h-8 w-8 rounded-lg border border-line bg-white flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-ink-muted px-2">
            {page} / {Math.max(1, pages)}
          </span>
          <button
            type="button"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= pages}
            className="h-8 w-8 rounded-lg border border-line bg-white flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
