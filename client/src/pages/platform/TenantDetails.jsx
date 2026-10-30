import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Users, LogIn } from 'lucide-react';
import api from '../../lib/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { Button, Card, Badge, LoadingBlock } from '../../components/ui/Primitives.jsx';
import { formatDate } from '../../lib/format.js';

export default function TenantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/platform/tenants/' + id);
      setData(res.data.data);
    } catch (err) {
      toast.error(err.userMessage || 'Error loading tenant');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const impersonate = async () => {
    setImpersonating(true);
    try {
      const res = await api.post('/platform/tenants/' + id + '/impersonate');
      const { token, user } = res.data.data;
      localStorage.setItem('buildstock_token', token);
      localStorage.setItem('buildstock_user', JSON.stringify(user));
      toast.success('Logged in as tenant owner');
      window.location.href = '/';
    } catch (err) {
      toast.error(err.userMessage || 'Error impersonating');
    } finally {
      setImpersonating(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (!data) return <div>Tenant not found</div>;

  const { tenant, users } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">{tenant.name}</h1>
          <p className="text-sm text-ink-muted">{tenant.subdomain}.buildstock.et</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/platform/tenants')}>Back</Button>
          <Button onClick={impersonate} loading={impersonating}>
            <LogIn className="h-4 w-4 mr-1.5" />
            Access as Owner
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-ink-muted">Business Name</p>
              <p className="text-ink font-medium">{tenant.businessName}</p>
            </div>
            <div>
              <p className="text-ink-muted">Plan</p>
              <Badge>{tenant.plan}</Badge>
            </div>
            <div>
              <p className="text-ink-muted">Status</p>
              <Badge variant={tenant.status === 'active' ? 'success' : 'danger'}>{tenant.status}</Badge>
            </div>
            <div>
              <p className="text-ink-muted">Created</p>
              <p className="text-ink">{formatDate(tenant.createdAt)}</p>
            </div>
            <div>
              <p className="text-ink-muted">Email</p>
              <p className="text-ink">{tenant.email || '-'}</p>
            </div>
            <div>
              <p className="text-ink-muted">Phone</p>
              <p className="text-ink">{tenant.phone || '-'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users ({users.length})
          </h2>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-2 rounded-lg bg-ink-50">
                <div>
                  <p className="text-sm font-medium text-ink">{user.name}</p>
                  <p className="text-xs text-ink-muted">{user.email}</p>
                </div>
                <Badge>{user.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}