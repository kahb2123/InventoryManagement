import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { Button, Card } from '../../components/ui/Primitives.jsx';
import { Input, Select } from '../../components/ui/Form.jsx';

export default function TenantCreate() {
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    plan: 'starter',
    status: 'active',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    businessName: '',
    phone: '',
  });

  const update = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (key === 'name' && !form.businessName) {
      setForm((prev) => ({ ...prev, businessName: e.target.value }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/platform/tenants', form);
      toast.success('Customer onboarded successfully');
      navigate('/platform/tenants');
    } catch (err) {
      toast.error(err.userMessage || 'Error creating tenant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Onboard New Customer</h1>
        <p className="text-sm text-ink-muted">Create a new tenant and provision first-time access</p>
      </div>

      <form onSubmit={submit}>
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink mb-3">Company Information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Company Name" value={form.name} onChange={update('name')} required wrapperClassName="sm:col-span-2" />
              <Input label="Subdomain" value={form.subdomain} onChange={update('subdomain')} required placeholder="company-name" pattern="[a-z0-9-]+" />
              <Input label="Business Name" value={form.businessName} onChange={update('businessName')} />
              <Input label="Phone" value={form.phone} onChange={update('phone')} />
              <Select label="Plan" value={form.plan} onChange={update('plan')} options={[
                { value: 'starter', label: 'Starter' },
                { value: 'growth', label: 'Growth' },
                { value: 'enterprise', label: 'Enterprise' },
              ]} />
              <Select label="Status" value={form.status} onChange={update('status')} options={[
                { value: 'trialing', label: 'Trialing' },
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
              ]} />
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <h2 className="text-base font-semibold text-ink mb-3">Owner Account (First Access)</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Owner Full Name" value={form.ownerName} onChange={update('ownerName')} required />
              <Input label="Owner Email" type="email" value={form.ownerEmail} onChange={update('ownerEmail')} required />
              <Input label="Temporary Password" type="password" value={form.ownerPassword} onChange={update('ownerPassword')} required minLength={6} wrapperClassName="sm:col-span-2" placeholder="Minimum 6 characters" />
            </div>
            <p className="text-xs text-ink-muted mt-2">Share these credentials with the customer for first-time login.</p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" type="button" onClick={() => navigate('/platform/tenants')}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Customer & Grant Access</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}