import { useCallback, useEffect, useState } from 'react';
import { Building2, Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import api from '../../lib/api.js';
import { useI18n } from '../../i18n/index.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Card, LoadingBlock } from '../../components/ui/Primitives.jsx';
import { Link } from 'react-router-dom';

export default function PlatformDashboard() {
  const { t } = useI18n();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/platform/stats');
      setStats(res.data.data);
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Platform Administration</h1>
        <p className="text-sm text-ink-muted">Manage all customers and tenants</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{stats?.totalTenants || 0}</p>
              <p className="text-xs text-ink-muted">Total Tenants</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{stats?.activeTenants || 0}</p>
              <p className="text-xs text-ink-muted">Active Tenants</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-info-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-info-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{stats?.totalUsers || 0}</p>
              <p className="text-xs text-ink-muted">Total Users</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">
                {stats?.tenantsByStatus?.find(s => s._id === 'trialing')?.count || 0}
              </p>
              <p className="text-xs text-ink-muted">Trialing</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink">Quick Actions</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/platform/tenants" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition">
            <Building2 className="h-4 w-4" />
            Manage Tenants
          </Link>
          <Link to="/platform/tenants/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-line hover:bg-ink-50 transition">
            <Building2 className="h-4 w-4" />
            Add New Customer
          </Link>
        </div>
      </Card>
    </div>
  );
}