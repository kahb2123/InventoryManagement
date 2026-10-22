export const ETHIOPIC_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagumen',
];

export const ETHIOPIC_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን',
];

const EPOCH_JDN = 1723856;

export function gregorianToEthiopic(input) {
  const date = input instanceof Date ? input : new Date(input);
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const jdn = Math.floor(utc / 86400000) + 2440588;
  const r = (jdn - EPOCH_JDN) % 1461;
  const n = Math.floor((jdn - EPOCH_JDN) / 1461);
  const year = 4 * n + Math.floor(r / 365);
  const month = Math.floor(r / 30) % 13;
  const day = (r % 30) + 1;
  return { year, month: month + 1, day };
}

export function formatEthiopic(date, { locale = 'en', withTime = false } = {}) {
  if (!date) return '';
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const { year, month, day } = gregorianToEthiopic(value);
  const months = locale === 'am' ? ETHIOPIC_MONTHS_AM : ETHIOPIC_MONTHS_EN;
  const base = `${day} ${months[month - 1]} ${year} ዓ.ም`;
  if (!withTime) return base;
  const hh = String(value.getUTCHours() + 3).padStart(2, '0');
  const mm = String(value.getUTCMinutes()).padStart(2, '0');
  return `${base} ${hh}:${mm}`;
}

export function formatDate(date, locale = 'en', options = {}) {
  if (!date) return '—';
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '—';
  const { ethiopic, withTime = false } = options;
  if (ethiopic) return formatEthiopic(value, { locale, withTime });
  return value.toLocaleDateString(locale === 'am' ? 'en-GB' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function formatNumber(value, locale = 'en', decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString(locale === 'am' ? 'en-GB' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(value, currency = 'ETB', locale = 'en', { compact = false } = {}) {
  const num = Number(value) || 0;
  if (compact && Math.abs(num) >= 1000000) {
    return `${currency} ${(num / 1000000).toFixed(1)}M`;
  }
  if (compact && Math.abs(num) >= 1000) {
    return `${currency} ${(num / 1000).toFixed(1)}K`;
  }
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

export function toDateInput(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() + 3 * 3600000);
  return local.toISOString().slice(0, 10);
}

export function todayInput() {
  return toDateInput(new Date());
}

export function startOfMonthInput() {
  const now = new Date();
  const local = new Date(now.getTime() + 3 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function daysAgoInput(days) {
  const d = new Date(Date.now() - days * 86400000);
  return toDateInput(d);
}

export default { formatDate, formatCurrency, formatNumber, formatEthiopic, toDateInput };
