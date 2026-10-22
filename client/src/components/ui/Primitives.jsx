import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm focus-visible:ring-brand-200',
  secondary: 'bg-white text-ink border border-line hover:bg-ink-50 active:bg-ink-100 focus-visible:ring-ink-200',
  ghost: 'text-ink-muted hover:bg-ink-100 hover:text-ink focus-visible:ring-ink-200',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 focus-visible:ring-danger-200',
  success: 'bg-success-700 text-white hover:bg-success-800 active:bg-success-900 focus-visible:ring-success-200',
  warning: 'bg-warning-500 text-navy-900 hover:bg-warning-400 active:bg-warning-300 focus-visible:ring-warning-200',
  dark: 'bg-navy-900 text-white hover:bg-navy-800 focus-visible:ring-navy-200',
  cyan: 'bg-cyan-500 text-navy-900 hover:bg-cyan-400 focus-visible:ring-cyan-200',
};

const SIZES = {
  xs: 'h-8 px-2.5 text-xs gap-1',
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  icon: 'h-9 w-9 p-0',
  'icon-sm': 'h-8 w-8 p-0',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, children, className = '', disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        disabled:opacity-55 disabled:cursor-not-allowed whitespace-nowrap
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b border-line ${className}`}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink truncate">{title}</h3>
        {subtitle ? <p className="text-xs text-ink-muted mt-0.5 truncate">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  cyan: 'bg-cyan-50 text-cyan-800',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  navy: 'bg-navy-100 text-navy-700',
  neutral: 'bg-ink-100 text-ink-600',
};

export function Badge({ tone = 'neutral', size = 'sm', children, className = '' }) {
  const sizes = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide ${TONES[tone]} ${sizes} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 'sm', className = '' }) {
  const sizes = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };
  return <Loader2 className={`${sizes[size]} animate-spin text-brand-500 ${className}`} />;
}

export function LoadingBlock({ label = 'Loading...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-ink-muted ${className}`}>
      <Spinner size="lg" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
      {Icon ? (
        <div className="h-12 w-12 rounded-xl bg-ink-100 text-ink-faint flex items-center justify-center mb-4">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="text-sm text-ink-muted mt-1 max-w-sm">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  subLabel,
  icon: Icon,
  tone = 'brand',
  hint,
  trend,
  onClick,
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    cyan: 'bg-cyan-50 text-cyan-800',
    navy: 'bg-navy-100 text-navy-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    danger: 'bg-danger-50 text-danger-700',
    neutral: 'bg-ink-100 text-ink-600',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`card p-4 flex items-start gap-3 text-left transition ${onClick ? 'hover:shadow-pop hover:-translate-y-0.5 cursor-pointer' : ''}`}
    >
      {Icon ? (
        <div className={`h-10 w-10 shrink-0 rounded-lg ${tones[tone]} flex items-center justify-center`}>
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink-muted truncate">{label}</p>
        <p className="text-[19px] font-semibold text-ink mt-0.5 leading-tight truncate">{value}</p>
        {subLabel ? <p className="text-[11px] text-ink-faint mt-1 truncate">{subLabel}</p> : null}
        {trend ? (
          <p className={`text-[11px] mt-1 font-medium ${trend.direction === 'up' ? 'text-success-700' : trend.direction === 'down' ? 'text-danger-600' : 'text-ink-faint'}`}>
            {trend.label}
          </p>
        ) : null}
      </div>
      {hint ? <div className="text-[10px] text-ink-faint text-right max-w-[90px] leading-snug">{hint}</div> : null}
    </Wrapper>
  );
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-1 p-1 bg-ink-100 rounded-lg ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`px-3 h-8 text-[13px] font-medium rounded-md transition ${
              active ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={`ml-1.5 text-[11px] ${active ? 'text-brand-600' : 'text-ink-faint'}`}>{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value = 0, max = 100, tone = 'brand', className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones = { brand: 'bg-brand-500', success: 'bg-success-600', warning: 'bg-warning-600', danger: 'bg-danger-600', cyan: 'bg-cyan-500' };
  return (
    <div className={`h-1.5 w-full bg-ink-100 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full ${tones[tone]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default Button;
