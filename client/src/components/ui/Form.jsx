import { forwardRef, useId } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export function Field({ label, hint, error, required, children, className = '', htmlFor }) {
  return (
    <div className={className}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-danger-700 ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-xs text-danger-700 mt-1">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, className = '', wrapperClassName = '', ...rest },
  ref
) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} htmlFor={id}>
      <input
        id={id}
        ref={ref}
        className={`input ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, required, options = [], placeholder, className = '', wrapperClassName = '', children, ...rest },
  ref
) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          ref={ref}
          className={`input appearance-none pr-9 ${error ? 'input-error' : ''} ${className}`}
          aria-invalid={Boolean(error)}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {children ||
            options.map((option) => {
              const value = option.value ?? option._id ?? option.id;
              const optionLabel = option.label ?? option.name;
              return (
                <option key={value} value={value} disabled={option.disabled}>
                  {optionLabel}
                </option>
              );
            })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, rows = 3, className = '', wrapperClassName = '', ...rest },
  ref
) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} htmlFor={id}>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        className={`input h-auto py-2 leading-relaxed ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </Field>
  );
});

export function SearchInput({ value, onChange, placeholder, className = '', autoFocus }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

export function Checkbox({ label, checked, onChange, hint, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500 cursor-pointer disabled:cursor-not-allowed"
      />
      <label htmlFor={id} className="text-sm text-ink select-none cursor-pointer">
        {label}
        {hint ? <span className="block text-xs text-ink-muted mt-0.5">{hint}</span> : null}
      </label>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-ink-300'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
      <label htmlFor={id} className="text-sm text-ink cursor-pointer select-none">
        {label}
        {hint ? <span className="block text-xs text-ink-muted mt-0.5">{hint}</span> : null}
      </label>
    </div>
  );
}

export function FormActions({ children, className = '' }) {
  return <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>{children}</div>;
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{message}</div>
  );
}

export default Input;
