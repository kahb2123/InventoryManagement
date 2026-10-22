import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, ArrowRight, ShieldCheck, Boxes, BarChart3, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../context/AppContext.jsx';
import api from '../lib/api.js';
import { Button } from '../components/ui/Primitives.jsx';
import { Input } from '../components/ui/Form.jsx';
import { LanguageSwitcher } from '../components/layout/AppShell.jsx';

const HIGHLIGHTS = [
  { icon: Boxes, en: 'Live stock for every material and branch', am: 'በየቁሳቁሱና በየቅርንጫው የቀጣይ ክምት' },
  { icon: BarChart3, en: 'Sales, profit and debt calculated from real records', am: 'ከእውነተኛ መዝገቦች የሚሰላ ሽያጭ፣ ትርፍና ብድር' },
  { icon: Globe, en: 'Full English and Amharic support', am: 'ሙሉ የእንግሊዝና አማርኛ ድጋፍ' },
  { icon: ShieldCheck, en: 'Role-based access with a full audit trail', am: 'በመደበኛት የተጠበቀ መድረክና የኦዲት መዝገብ' },
];

export default function Login() {
  const { t, locale } = useI18n();
  const { login, setup, isAuthenticated } = useAuth();
  const { settings } = useApp();
  const navigate = useNavigate();

  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/auth/setup-status')
      .then((res) => setNeedsSetup(res.data.data.needsSetup))
      .catch(() => setNeedsSetup(false))
      .finally(() => setChecking(false));
  }, []);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const businessName = settings?.businessName || 'BuildStock Ethiopia';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (needsSetup) {
        await setup({ name: form.name, email: form.email, password: form.password, businessName: form.businessName || businessName });
      } else {
        await login(form.email, form.password);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.userMessage || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <div className="min-h-screen bg-navy-900 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(23,105,255,.45), transparent 45%), radial-gradient(circle at 80% 70%, rgba(25,198,217,.35), transparent 45%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            {settings?.logo ? (
              <img src={settings.logo} alt="" className="h-11 w-11 rounded-xl object-contain bg-white p-1.5" />
            ) : (
              <div className="h-11 w-11 rounded-xl bg-brand-500 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-lg leading-tight">{businessName}</p>
              <p className="text-white/50 text-xs">{settings?.tagline}</p>
            </div>
          </div>

          <h1 className="mt-14 text-white text-[38px] leading-[1.15] font-semibold max-w-lg">
            {locale === 'am'
              ? 'የዕቃ ግብዓት ድርጅትዎን በአንድ መቆጣጠሪያ አጋራጭ ያስተዳድሩ።'
              : 'Run your construction material business from one connected system.'}
          </h1>
          <p className="mt-4 text-white/60 max-w-md">
            {locale === 'am'
              ? 'ክምት፣ ሽያጭ፣ ግዢ፣ አቅራቢ፣ ደንበኛ፣ ወጪና ሪፖርቶች በአንድ መቆጣጠሪያ መተግበሪያ።'
              : 'Inventory, sales, purchases, suppliers, customers, expenses and reporting — all in one place.'}
          </p>

          <ul className="mt-10 space-y-3.5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.en} className="flex items-center gap-3 text-white/75 text-sm">
                <span className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-cyan-400" />
                </span>
                {locale === 'am' ? item.am : item.en}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-white/35 text-xs">
          {locale === 'am' ? 'ተግባራዊ ስርዓት ለኢትዮጵያ የግብዓት ግብዓት ድርጅቶች' : 'Purpose-built for Ethiopian construction material businesses'}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen items-center justify-center bg-canvas p-5 sm:p-8">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-end mb-6 lg:hidden">
            <LanguageSwitcher />
          </div>

          <div className="card p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-6 lg:hidden">
              <div className="h-9 w-9 rounded-lg bg-navy-900 flex items-center justify-center">
                <Building2 className="h-4.5 w-4.5 text-white" style={{ height: 18, width: 18 }} />
              </div>
              <p className="font-semibold text-ink">{businessName}</p>
            </div>

            <h2 className="text-xl font-semibold text-ink">
              {checking ? '…' : needsSetup ? t('auth.setupTitle') : t('auth.welcomeBack')}
            </h2>
            <p className="text-sm text-ink-muted mt-1 mb-6">
              {checking ? ' ' : needsSetup ? t('auth.setupSubtitle') : t('auth.signInSubtitle')}
            </p>

            {error ? (
              <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              {needsSetup ? (
                <>
                  <Input
                    label={t('auth.yourName')}
                    value={form.name}
                    onChange={update('name')}
                    placeholder="Abebe Bekele"
                    required
                    autoComplete="name"
                  />
                  <Input
                    label={t('auth.businessName')}
                    value={form.businessName}
                    onChange={update('businessName')}
                    placeholder={businessName}
                  />
                </>
              ) : null}

              <Input
                label={t('auth.email')}
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@business.et"
                required
                autoComplete="email"
              />
              <Input
                label={t('auth.password')}
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />

              <Button type="submit" size="lg" loading={loading} className="w-full" icon={ArrowRight}>
                {checking ? '…' : needsSetup ? t('auth.createAccount') : t('auth.signIn')}
              </Button>
            </form>

            {needsSetup ? (
              <p className="mt-5 text-xs text-ink-muted text-center">
                {t('auth.setupSubtitle')}
              </p>
            ) : (
              <p className="mt-5 text-xs text-ink-muted text-center flex items-center justify-center gap-1.5">
                <Lock className="h-3 w-3" />
                Secured with role-based access
              </p>
            )}
          </div>

          <div className="mt-4 text-center">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}
