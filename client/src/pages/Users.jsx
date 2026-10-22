import { useCallback, useEffect, useState } from 'react';
import { UserCog, Plus, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatDate } from '../lib/format.js';
import { Button, Card, Badge, EmptyState, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { DataTable } from '../components/ui/Table.jsx';
import { Input, Select, Checkbox } from '../components/ui/Form.jsx';
import { Modal, ConfirmDialog } from '../components/ui/Overlay.jsx';

const ROLE_KEYS = {
  owner: 'users.owner',
  manager: 'users.manager',
  sales_clerk: 'users.salesClerk',
  storekeeper: 'users.storekeeper',
  accountant: 'users.accountant',
};

const ROLE_DESC_KEYS = {
  owner: 'users.roleOwner',
  manager: 'users.roleManager',
  sales_clerk: 'users.roleSalesClerk',
  storekeeper: 'users.roleStorekeeper',
  accountant: 'users.roleAccountant',
};

function UserModal({ open, onClose, user, roles, branches, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      user
        ? {
            name: user.name || '',
            nameAm: user.nameAm || '',
            email: user.email || '',
            phone: user.phone || '',
            role: user.role || 'sales_clerk',
            branch: user.branch?._id || user.branch || '',
            active: user.active ?? true,
            password: '',
          }
        : {
            name: '',
            nameAm: '',
            email: '',
            phone: '',
            role: 'sales_clerk',
            branch: branches[0]?._id || '',
            active: true,
            password: '',
          }
    );
  }, [open, user, branches]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (user) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.patch(`/users/${user._id}`, payload);
      } else {
        await api.post('/users', form);
      }
      toast.success(t('common.save'));
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find((r) => r.value === form.role);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? t('users.editUser') : t('users.addUser')}
      size="lg"
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
          <Input label={t('users.name')} value={form.name || ''} onChange={update('name')} required />
          <Input label={t('common.nameAm')} value={form.nameAm || ''} onChange={update('nameAm')} />
          <Input label={t('auth.email')} type="email" value={form.email || ''} onChange={update('email')} required disabled={Boolean(user)} />
          <Input label={t('common.phone')} value={form.phone || ''} onChange={update('phone')} />
          <Select
            label={t('users.role')}
            value={form.role || 'sales_clerk'}
            onChange={update('role')}
            options={roles.map((role) => ({ value: role.value, label: t(ROLE_KEYS[role.value] || 'users.role') }))}
            required
          />
          <Select
            label={t('common.branch')}
            value={form.branch || ''}
            onChange={update('branch')}
            options={branches.map((b) => ({ value: b._id, label: b.name }))}
            placeholder={t('validation.selectOne')}
          />
          <Input
            label={t('users.password')}
            type="password"
            value={form.password || ''}
            onChange={update('password')}
            required={!user}
            minLength={6}
            placeholder={user ? t('users.passwordHint') : ''}
            wrapperClassName="sm:col-span-2"
          />
        </div>

        {user ? (
          <Checkbox
            label={t('common.active')}
            checked={form.active ?? true}
            onChange={(value) => setForm((prev) => ({ ...prev, active: value }))}
          />
        ) : null}

        {selectedRole ? (
          <div className="rounded-lg border border-line bg-ink-50 p-3">
            <p className="text-[12px] font-semibold text-ink mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
              {t('users.permissions')}
            </p>
            <p className="text-[12px] text-ink-muted mb-2">{t(ROLE_DESC_KEYS[selectedRole.value] || 'users.role')}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedRole.permissions.map((permission) => (
                <span key={permission} className="rounded-md bg-white border border-line px-1.5 py-0.5 text-[10px] text-ink-muted font-mono">
                  {permission}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

export default function Users() {
  const { t, locale } = useI18n();
  const { branches } = useApp();
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [passwordFor, setPasswordFor] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([api.get('/users'), api.get('/users/roles')]);
      setRows(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
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
      await api.delete(`/users/${deleting._id}`);
      toast.success(t('common.delete'));
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setPasswordBusy(true);
    try {
      await api.patch(`/users/${passwordFor._id}`, { password: newPassword });
      toast.success(t('users.updated'));
      setPasswordFor(null);
      setNewPassword('');
      load();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setPasswordBusy(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: t('users.name'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">
            {row.name}
            {row._id === currentUser?._id ? <span className="ml-1.5 text-[10px] text-brand-600">(you)</span> : null}
          </p>
          <p className="text-[11px] text-ink-faint truncate">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: t('users.role'),
      render: (row) => <Badge tone={row.role === 'owner' ? 'brand' : 'navy'}>{t(ROLE_KEYS[row.role] || 'users.role')}</Badge>,
    },
    { key: 'branch', label: t('common.branch'), render: (row) => row.branch?.name || '—' },
    { key: 'phone', label: t('common.phone'), render: (row) => row.phone || '—' },
    {
      key: 'active',
      label: t('common.status'),
      render: (row) => (
        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? t('common.active') : t('common.inactive')}</Badge>
      ),
    },
    {
      key: 'lastLoginAt',
      label: t('users.lastLogin'),
      render: (row) => (row.lastLoginAt ? formatDate(row.lastLoginAt, locale, { withTime: true }) : t('users.never')),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              setPasswordFor(row);
              setNewPassword('');
            }}
            className="h-8 w-8 rounded-lg text-ink-muted hover:bg-warning-50 hover:text-warning-700 flex items-center justify-center"
            aria-label={t('common.changePassword')}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(row);
              setModalOpen(true);
            }}
            className="h-8 w-8 rounded-lg text-ink-muted hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center"
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {row._id !== currentUser?._id ? (
            <button
              type="button"
              onClick={() => setDeleting(row)}
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
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        action={
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            {t('users.addUser')}
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyIcon={UserCog}
          emptyTitle={t('common.noData')}
          emptyDescription={t('common.noDataHint')}
        />
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map((role) => (
          <Card key={role.value} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{t(ROLE_KEYS[role.value] || role.label)}</p>
              <Badge tone="neutral">{role.permissions.length}</Badge>
            </div>
            <p className="text-[11px] text-ink-muted mt-1">{t(ROLE_DESC_KEYS[role.value] || role.label)}</p>
            <div className="flex flex-wrap gap-1 mt-2.5">
              {role.permissions.map((permission) => (
                <span key={permission} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-muted font-mono">
                  {permission}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={editing}
        roles={roles}
        branches={branches}
        onSaved={load}
      />

      <Modal
        open={Boolean(passwordFor)}
        onClose={() => setPasswordFor(null)}
        title={t('common.changePassword')}
        subtitle={passwordFor?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPasswordFor(null)} disabled={passwordBusy}>
              {t('common.cancel')}
            </Button>
            <Button onClick={resetPassword} loading={passwordBusy}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <form onSubmit={resetPassword} className="space-y-3">
          <Input
            label={t('users.password')}
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
          />
          <p className="text-[11px] text-ink-faint">{t('users.passwordHint')}</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title={t('common.confirmDelete')}
        message={`${deleting?.name || ''} — ${t('common.irreversible')}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
