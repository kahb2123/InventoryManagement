import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Download } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatDate } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable, Pagination } from '../components/ui/Table.jsx';
import { Input, Select } from '../components/ui/Form.jsx';

const ENTITY_OPTIONS = [
  'Sale',
  'Purchase',
  'Product',
  'Customer',
  'Supplier',
  'Expense',
  'Payment',
  'StockMovement',
  'Branch',
  'User',
  'Settings',
];

function actionTone(action = '') {
  if (/(delete|cancel|void)/i.test(action)) return 'danger';
  if (/(create|receive|in)/i.test(action)) return 'success';
  if (/(update|adjust|approve)/i.test(action)) return 'warning';
  return 'navy';
}

export default function Audit() {
  const { t, locale } = useI18n();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit', { params: { page, limit, entity, from, to } });
      setRows(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, entity, from, to, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    const header = ['Date', 'Action', 'Entity', 'Record', 'User', 'Role', 'Details'];
    const lines = rows.map((row) => [
      new Date(row.date).toISOString(),
      row.action,
      row.entity,
      row.entityLabel || '',
      row.userName || '',
      row.userRole || '',
      row.details && typeof row.details === 'object' ? JSON.stringify(row.details) : String(row.details ?? ''),
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: 'date',
      label: t('audit.when'),
      render: (row) => <span className="whitespace-nowrap">{formatDate(row.date, locale, { withTime: true })}</span>,
    },
    {
      key: 'action',
      label: t('audit.action'),
      render: (row) => <Badge tone={actionTone(row.action)}>{row.action}</Badge>,
    },
    { key: 'entity', label: t('audit.entity'), render: (row) => <span className="text-[12px]">{row.entity}</span> },
    {
      key: 'entityLabel',
      label: t('common.details'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[12px] text-ink">{row.entityLabel || '—'}</p>
          {row.details && Object.keys(row.details).length ? (
            <p className="truncate text-[10px] text-ink-faint font-mono">{JSON.stringify(row.details)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'userName',
      label: t('audit.user'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[12px] text-ink">{row.userName || '—'}</p>
          {row.userRole ? <p className="truncate text-[10px] text-ink-faint capitalize">{row.userRole.replace('_', ' ')}</p> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        action={
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            {t('common.exportCsv')}
          </Button>
        }
      />

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-line">
          <Select
            label={t('audit.entity')}
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-56"
            options={[{ value: 'all', label: t('common.all') }, ...ENTITY_OPTIONS.map((value) => ({ value, label: value }))]}
          />
          <Input
            label={t('common.from')}
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-40"
          />
          <Input
            label={t('common.to')}
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            wrapperClassName="w-40"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyIcon={ShieldCheck}
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
    </div>
  );
}
