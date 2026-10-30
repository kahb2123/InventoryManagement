import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Eye, Power, PowerOff } from 'lucide-react';
import api from '../../lib/api.js';
import { useI18n } from '../../i18n/index.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Button, Card, Badge, LoadingBlock } from '../../components/ui/Primitives.jsx';
import { DataTable } from '../../components/ui/Table.jsx';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/format.js';

export default function TenantsList() {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/platform/tenants');
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

  const toggleStatus = async (tenant) => {
    try {
      const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
      await api.patch('/platform/tenants/' + tenant._id, { status: newStatus });
      toast.success('Tenant status updated');
      load();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Company',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.name}</p>
          <p className="text-xs text-ink-muted">{row.subdomain}.buildstock.et</p>
        </div>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (row) => <Badge>{row.plan}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : row.status === 'suspended' ? 'danger' : 'warning'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'users',
      label: 'Users',
      render: (row) => <span>{row.userCount || 0}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => <span className="text-xs">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Link to={'/platform/tenants/' + row._id}>
            <Button variant="ghost" size="sm">
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => toggleStatus(row)}>
            {row.status === 'active' ? <PowerOff className="h-3.5 w-3.5 text-danger-600" /> : <Power className="h-3.5 w-3.5 text-success-600" />}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Customers / Tenants</h1>
          <p className="text-sm text-ink-muted">Manage all customer accounts</p>
        </div>
        <Link to="/platform/tenants/new">
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            Add New Customer
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <DataTable columns={columns} rows={rows} emptyState={{ title: 'No tenants found', description: 'Start by adding your first customer' }} />
      </Card>
    </div>
  );
}

