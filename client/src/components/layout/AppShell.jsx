import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine, ScrollText, Boxes, Receipt,
  ShoppingCart, Truck, Users, Wallet, CreditCard, BarChart3, Building2, UserCog, Settings,
  ShieldCheck, X, Menu, Globe, ChevronDown, LogOut, KeyRound, CircleUser,
} from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApp } from '../../context/AppContext.jsx';

function NavSection({ label, items, onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="mb-5">
      <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.key}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(item.label)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LanguageSwitcher({ compact = false, dark = false }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-[13px] font-medium transition ${
          dark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-ink-muted hover:bg-ink-100 hover:text-ink'
        }`}
        aria-label={t('common.language')}
      >
        <Globe className="h-4 w-4" />
        {!compact && <span>{locale === 'am' ? 'አማርኛ' : 'EN'}</span>}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open ? (
        <div
          className="absolute right-0 mt-1.5 z-40 w-40 overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-fade-in"
          role="menu"
        >
          <button
            type="button"
            onClick={() => {
              setLocale('en');
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-ink-50 ${
              locale === 'en' ? 'text-brand-600 font-semibold' : 'text-ink'
            }`}
          >
            <span>English</span>
            {locale === 'en' ? <span className="text-[10px]">EN</span> : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setLocale('am');
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-ink-50 ${
              locale === 'am' ? 'text-brand-600 font-semibold' : 'text-ink'
            }`}
          >
            <span>አማርኛ</span>
            {locale === 'am' ? <span className="text-[10px]">AM</span> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ open, onClose }) {
  const { t } = useI18n();
  const { user, hasPermission } = useAuth();
  const { settings } = useApp();
  const location = useLocation();

  const can = (permission) => hasPermission(permission);

  const inventoryItems = [
    { key: 'products', to: '/products', icon: Package, label: 'nav.products' },
    { key: 'categories', to: '/categories', icon: Boxes, label: 'nav.categories' },
    { key: 'stock-in', to: '/stock/in', icon: ArrowDownToLine, label: 'nav.stockIn' },
    { key: 'stock-out', to: '/stock/out', icon: ArrowUpFromLine, label: 'nav.stockOut' },
    { key: 'positions', to: '/stock/positions', icon: ScrollText, label: 'nav.positions' },
    { key: 'ledger', to: '/stock/ledger', icon: ScrollText, label: 'nav.ledger' },
  ].filter((item) => {
    if (item.key === 'categories') return can('categories.manage') || can('products.view');
    if (item.key === 'stock-in' || item.key === 'stock-out') return can('stock.in') || can('stock.out');
    if (item.key === 'ledger') return can('stock.ledger.view');
    return can('products.view');
  });

  const tradeItems = [
    { key: 'sales', to: '/sales', icon: Receipt, label: 'nav.invoices' },
    { key: 'purchases', to: '/purchases', icon: ShoppingCart, label: 'nav.purchases' },
    { key: 'customers', to: '/customers', icon: Users, label: 'nav.customers' },
    { key: 'suppliers', to: '/suppliers', icon: Truck, label: 'nav.suppliers' },
  ].filter((item) => {
    if (item.key === 'sales') return can('sales.view');
    if (item.key === 'purchases') return can('purchases.view');
    if (item.key === 'customers') return can('customers.view');
    return can('suppliers.view');
  });

  const financeItems = [
    { key: 'expenses', to: '/expenses', icon: Wallet, label: 'nav.expenses' },
    { key: 'payments', to: '/payments', icon: CreditCard, label: 'nav.payments' },
    { key: 'reports', to: '/reports', icon: BarChart3, label: 'nav.reports' },
  ].filter((item) => {
    if (item.key === 'expenses') return can('expenses.view');
    if (item.key === 'payments') return can('payments.view');
    return can('reports.view');
  });

  const adminItems = [
    { key: 'branches', to: '/branches', icon: Building2, label: 'nav.branches' },
    { key: 'users', to: '/users', icon: UserCog, label: 'nav.users' },
    { key: 'settings', to: '/settings', icon: Settings, label: 'nav.settings' },
    { key: 'audit', to: '/audit', icon: ShieldCheck, label: 'nav.audit' },
  ].filter((item) => {
    if (item.key === 'branches') return can('branches.manage') || can('settings.view');
    if (item.key === 'users') return can('users.manage');
    if (item.key === 'settings') return can('settings.view');
    return can('audit.view');
  });

  const businessName = settings?.businessName || 'BuildStock Ethiopia';

  return (
    <>
      {open ? <div className="fixed inset-0 bg-navy-950/50 z-40 lg:hidden" onClick={onClose} aria-hidden="true" /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[258px] bg-navy-900 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-white/10 shrink-0">
          {settings?.logo ? (
            <img src={settings.logo} alt="" className="h-9 w-9 rounded-lg object-contain bg-white/95 p-1" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-brand-500 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate leading-tight">{businessName}</p>
            <p className="text-[10px] text-white/45 truncate">{settings?.tagline || 'Inventory Management'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 flex items-center justify-center"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-5">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{t('nav.dashboard')}</p>
            <NavLink
              to="/"
              onClick={onClose}
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition ${
                  isActive ? 'bg-brand-500 text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>{t('nav.dashboard')}</span>
            </NavLink>
          </div>

          {inventoryItems.length ? (
            <NavSection label={t('nav.inventory')} items={inventoryItems} onNavigate={onClose} />
          ) : null}
          {tradeItems.length ? <NavSection label={t('nav.sales')} items={tradeItems} onNavigate={onClose} /> : null}
          {financeItems.length ? <NavSection label={t('nav.finance')} items={financeItems} onNavigate={onClose} /> : null}
          {adminItems.length ? <NavSection label={t('nav.administration')} items={adminItems} onNavigate={onClose} /> : null}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 text-[10px] text-white/35 shrink-0">
          {t('app.name')} · v1.0
        </div>
      </aside>
    </>
  );
}

export function Topbar({ onMenuClick }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const titles = {
    '/': 'nav.dashboard',
    '/products': 'nav.products',
    '/categories': 'nav.categories',
    '/stock/in': 'nav.stockIn',
    '/stock/out': 'nav.stockOut',
    '/stock/positions': 'nav.positions',
    '/stock/ledger': 'nav.ledger',
    '/sales': 'nav.invoices',
    '/purchases': 'nav.purchases',
    '/customers': 'nav.customers',
    '/suppliers': 'nav.suppliers',
    '/expenses': 'nav.expenses',
    '/payments': 'nav.payments',
    '/reports': 'nav.reports',
    '/branches': 'nav.branches',
    '/users': 'nav.users',
    '/settings': 'nav.settings',
    '/audit': 'nav.audit',
  };
  const titleKey = titles[location.pathname] || 'nav.dashboard';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-line flex items-center gap-3 px-4 lg:px-6 no-print">
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden h-9 w-9 rounded-lg border border-line flex items-center justify-center text-ink-muted"
        aria-label="Open navigation"
      >
        <Menu className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="text-[15px] font-semibold text-ink truncate">{t(titleKey)}</h1>
      </div>

      <LanguageSwitcher />

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-lg hover:bg-ink-100 transition"
        >
          <span className="h-7 w-7 rounded-full bg-navy-900 text-white text-[11px] font-semibold flex items-center justify-center">
            {(user?.name || '?')
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </span>
          <span className="hidden sm:block text-left leading-tight">
            <span className="block text-[13px] font-medium text-ink max-w-[130px] truncate">{user?.name}</span>
            <span className="block text-[10px] text-ink-muted capitalize">{user?.role?.replace('_', ' ')}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 mt-1.5 z-40 w-56 overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-fade-in">
            <div className="px-3.5 py-3 border-b border-line">
              <p className="text-[13px] font-semibold text-ink truncate">{user?.name}</p>
              <p className="text-[11px] text-ink-muted truncate">{user?.email}</p>
              <p className="text-[10px] text-brand-600 font-semibold mt-1 capitalize">
                {user?.roleLabel || user?.role}
              </p>
            </div>
            <div className="p-1.5">
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-ink-muted hover:bg-ink-100 hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[258px]">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-6 max-w-[1600px] mx-auto">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
