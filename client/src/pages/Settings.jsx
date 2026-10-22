import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon, Save, Upload, Building2, Percent, Globe, Hash, SlidersHorizontal } from 'lucide-react';
import api from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { Button, Card, LoadingBlock, SectionTitle } from '../components/ui/Primitives.jsx';
import { Input, Select, Textarea, Toggle, Checkbox } from '../components/ui/Form.jsx';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'credit_note', 'other'];

function SectionCard({ icon: Icon, title, children, description }) {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-line flex items-start gap-3">
        {Icon ? (
          <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {description ? <p className="text-xs text-ink-muted mt-0.5">{description}</p> : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const { refreshSettings, refreshReferenceData } = useApp();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const canEdit = hasPermission('settings.manage');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const data = res.data.data || {};
      setForm({
        businessName: data.businessName || '',
        businessNameAm: data.businessNameAm || '',
        tagline: data.tagline || '',
        logo: data.logo || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        taxId: data.taxId || '',
        website: data.website || '',
        currency: data.currency || 'ETB',
        currencySymbol: data.currencySymbol || 'ETB',
        locale: data.locale || 'en',
        timezone: data.timezone || 'Africa/Addis_Ababa',
        ethiopicCalendar: data.ethiopicCalendar ?? true,
        ethiopicTime: data.ethiopicTime ?? false,
        taxEnabled: data.taxEnabled ?? false,
        taxType: data.taxType || 'none',
        taxRate: data.taxRate ?? 0,
        taxNumber: data.taxNumber || '',
        taxInclusivePrices: data.taxInclusivePrices ?? false,
        showTaxOnInvoice: data.showTaxOnInvoice ?? true,
        invoicePrefix: data.invoicePrefix || 'INV',
        invoiceNumberFormat: data.invoiceNumberFormat || 'INV-{YYYY}-{0000}',
        purchasePrefix: data.purchasePrefix || 'PO',
        purchaseNumberFormat: data.purchaseNumberFormat || 'PO-{YYYY}-{0000}',
        receiptPrefix: data.receiptPrefix || 'RCP',
        receiptNumberFormat: data.receiptNumberFormat || 'RCP-{YYYY}-{0000}',
        movementPrefix: data.movementPrefix || 'MOV',
        movementNumberFormat: data.movementNumberFormat || 'MOV-{YYYY}-{0000}',
        receiptFooter: data.receiptFooter || '',
        invoiceNotes: data.invoiceNotes || '',
        lowStockDefault: data.lowStockDefault ?? 0,
        defaultPaymentMethods: data.defaultPaymentMethods || ['cash', 'bank_transfer', 'mobile_money'],
        costMethod: data.costMethod || 'weighted_average',
        stockAlertEnabled: data.stockAlertEnabled ?? true,
        defaultBranch: data.defaultBranch || '',
        branches: data.branches || [],
      });
      setError('');
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const toggle = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      delete payload.branches;
      payload.taxRate = Number(payload.taxRate) || 0;
      payload.lowStockDefault = Number(payload.lowStockDefault) || 0;
      await api.put('/settings', payload);
      toast.success(t('settings.saved'));
      await refreshSettings();
      await refreshReferenceData();
      await load();
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('logo', file);
      const res = await api.post('/settings/logo', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((prev) => ({ ...prev, logo: res.data.data.logo }));
      toast.success(t('settings.saved'));
      await refreshSettings();
    } catch (err) {
      toast.error(err.userMessage || t('common.error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleMethod = (method) => {
    setForm((prev) => {
      const list = prev.defaultPaymentMethods || [];
      return {
        ...prev,
        defaultPaymentMethods: list.includes(method) ? list.filter((m) => m !== method) : [...list, method],
      };
    });
  };

  if (loading) return <LoadingBlock />;
  if (!form) {
    return (
      <div className="space-y-4">
        <SectionTitle title={t('settings.title')} subtitle={t('settings.subtitle')} />
        <Card>
          <div className="p-5 text-sm text-danger-700">{error || t('common.error')}</div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SectionTitle
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        action={
          <Button type="submit" icon={Save} loading={saving} disabled={!canEdit}>
            {t('common.save')}
          </Button>
        }
      />

      {!canEdit ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800">
          {t('common.featureUnavailable')}
        </div>
      ) : null}
      {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <SectionCard icon={Building2} title={t('settings.business')} description={t('settings.contact')}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label={t('settings.businessName')} value={form.businessName} onChange={update('businessName')} disabled={!canEdit} />
              <Input label={t('settings.businessNameAm')} value={form.businessNameAm} onChange={update('businessNameAm')} disabled={!canEdit} />
              <Input label={t('settings.tagline')} value={form.tagline} onChange={update('tagline')} disabled={!canEdit} wrapperClassName="sm:col-span-2" />
              <Input label={t('common.address')} value={form.address} onChange={update('address')} disabled={!canEdit} wrapperClassName="sm:col-span-2" />
              <Input label={t('common.phone')} value={form.phone} onChange={update('phone')} disabled={!canEdit} />
              <Input label={t('common.email')} type="email" value={form.email} onChange={update('email')} disabled={!canEdit} />
              <Input label={t('settings.taxNumber')} value={form.taxNumber} onChange={update('taxNumber')} disabled={!canEdit} />
              <Input label="Website" value={form.website} onChange={update('website')} disabled={!canEdit} />

              <div className="sm:col-span-2 flex items-center gap-4">
                {form.logo ? (
                  <img src={form.logo} alt="" className="h-14 w-14 rounded-lg border border-line object-contain bg-white p-1" />
                ) : (
                  <div className="h-14 w-14 rounded-lg border border-dashed border-line flex items-center justify-center text-ink-faint">
                    <SettingsIcon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                  <Button type="button" variant="secondary" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()} disabled={!canEdit}>
                    {t('settings.uploadLogo')}
                  </Button>
                  <p className="text-[11px] text-ink-faint mt-1">{t('settings.logo')}</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Percent} title={t('settings.tax')}>
            <div className="space-y-4">
              <Toggle label={t('settings.taxEnabled')} checked={form.taxEnabled} onChange={toggle('taxEnabled')} />
              {form.taxEnabled ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Select
                    label={t('settings.taxType')}
                    value={form.taxType}
                    onChange={update('taxType')}
                    disabled={!canEdit}
                    options={[
                      { value: 'none', label: t('expenses.other') },
                      { value: 'vat', label: 'VAT' },
                      { value: 'withholding', label: 'Withholding' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                  <Input
                    label={t('settings.taxRate')}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.taxRate}
                    onChange={update('taxRate')}
                    disabled={!canEdit}
                  />
                </div>
              ) : null}
              <Checkbox
                label={t('settings.taxInclusive')}
                checked={form.taxInclusivePrices}
                onChange={toggle('taxInclusivePrices')}
                disabled={!canEdit}
              />
              <Checkbox
                label={t('settings.showTaxOnInvoice')}
                checked={form.showTaxOnInvoice}
                onChange={toggle('showTaxOnInvoice')}
                disabled={!canEdit}
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard icon={Globe} title={t('settings.regional')}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label={t('settings.currency')} value={form.currency} onChange={update('currency')} disabled={!canEdit} />
              <Input label="Currency symbol" value={form.currencySymbol} onChange={update('currencySymbol')} disabled={!canEdit} />
              <Select
                label={t('settings.locale')}
                value={form.locale}
                onChange={update('locale')}
                disabled={!canEdit}
                options={[
                  { value: 'en', label: t('common.english') },
                  { value: 'am', label: t('common.amharic') },
                ]}
              />
              <Input label={t('settings.timezone')} value={form.timezone} onChange={update('timezone')} disabled={!canEdit} />
              <Toggle
                label={t('settings.ethiopicCalendar')}
                checked={form.ethiopicCalendar}
                onChange={toggle('ethiopicCalendar')}
              />
              <Toggle label="Ethiopian time" checked={form.ethiopicTime} onChange={toggle('ethiopicTime')} />
            </div>
          </SectionCard>

          <SectionCard icon={Hash} title={t('settings.numbering')} description={t('settings.formatHint')}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label={t('sales.invoiceNumber')} value={form.invoiceNumberFormat} onChange={update('invoiceNumberFormat')} disabled={!canEdit} />
              <Input label={t('purchases.purchaseNumber')} value={form.purchaseNumberFormat} onChange={update('purchaseNumberFormat')} disabled={!canEdit} />
              <Input label={t('payments.reference')} value={form.receiptNumberFormat} onChange={update('receiptNumberFormat')} disabled={!canEdit} />
              <Input label={t('stock.movementNumber')} value={form.movementNumberFormat} onChange={update('movementNumberFormat')} disabled={!canEdit} />
            </div>
          </SectionCard>

          <SectionCard icon={SlidersHorizontal} title={t('settings.defaults')}>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label={t('settings.lowStockDefault')}
                  type="number"
                  min="0"
                  value={form.lowStockDefault}
                  onChange={update('lowStockDefault')}
                  disabled={!canEdit}
                />
                <Select
                  label={t('common.branch')}
                  value={form.defaultBranch || ''}
                  onChange={update('defaultBranch')}
                  disabled={!canEdit}
                  placeholder={t('validation.selectOne')}
                  options={(form.branches || []).map((b) => ({ value: b._id, label: b.name }))}
                />
              </div>

              <div>
                <p className="field-label">{t('settings.defaultPaymentMethods')}</p>
                <div className="grid sm:grid-cols-2 gap-2 mt-1">
                  {PAYMENT_METHODS.map((method) => (
                    <Checkbox
                      key={method}
                      label={t(`payments.${method === 'bank_transfer' ? 'bankTransfer' : method === 'mobile_money' ? 'mobileMoney' : method === 'credit_note' ? 'creditNote' : method}`)}
                      checked={(form.defaultPaymentMethods || []).includes(method)}
                      onChange={() => toggleMethod(method)}
                      disabled={!canEdit}
                    />
                  ))}
                </div>
              </div>

              <Toggle label={t('settings.stockAlertEnabled')} checked={form.stockAlertEnabled} onChange={toggle('stockAlertEnabled')} />
              <Select
                label={t('settings.costMethod')}
                value={form.costMethod}
                onChange={update('costMethod')}
                disabled={!canEdit}
                options={[{ value: 'weighted_average', label: t('settings.weightedAverage') }]}
              />
              <Textarea label={t('settings.receiptFooter')} value={form.receiptFooter} onChange={update('receiptFooter')} disabled={!canEdit} />
              <Textarea label={t('settings.invoiceNotes')} value={form.invoiceNotes} onChange={update('invoiceNotes')} disabled={!canEdit} />
            </div>
          </SectionCard>
        </div>
      </div>
    </form>
  );
}
