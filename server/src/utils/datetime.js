export const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa';

function partsInZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function zoneOffsetMs(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** Start of the local calendar day (00:00:00) for the given timezone. */
export function startOfDay(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const offset = zoneOffsetMs(date, timeZone);
  const local = new Date(date.getTime() + offset);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(localMidnight - offset);
}

export function endOfDay(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const start = startOfDay(date, timeZone);
  const offset = zoneOffsetMs(date, timeZone);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1 - (offset - zoneOffsetMs(start, timeZone)));
}

export function dayRange(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const start = startOfDay(date, timeZone);
  return { $gte: start, $lte: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

export function rangeForDays(days, timeZone = DEFAULT_TIMEZONE, endDate = new Date()) {
  const end = endOfDay(endDate, timeZone);
  const start = new Date(startOfDay(endDate, timeZone).getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { $gte: start, $lte: end };
}

export function localDateKey(date, timeZone = DEFAULT_TIMEZONE) {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function localMonthKey(date, timeZone = DEFAULT_TIMEZONE) {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

/** Parse a "YYYY-MM-DD" filter into an absolute range (inclusive of the end day). */
export function parseDateFilter(from, to, fallbackDays = 30) {
  const now = new Date();
  if (!from && !to) {
    return { $gte: new Date(now.getTime() - fallbackDays * 86400000), $lte: now };
  }
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(0);
  const end = to ? new Date(`${to}T23:59:59.999Z`) : now;
  return { $gte: start, $lte: end };
}

/**
 * Ethiopian (Ge'ez) calendar conversion.
 * The Ethiopian year starts on 11 September (Gregorian) and has 13 months.
 */
const ETHIOPIC_EPOCH_JDN = 1723856;

export function gregorianToEthiopic(date) {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const jdn = Math.floor(utc / 86400000) + 2440588;
  const r = (jdn - ETHIOPIC_EPOCH_JDN) % 1461;
  const n = Math.floor((jdn - ETHIOPIC_EPOCH_JDN) / 1461);
  const year = 4 * n + Math.floor(r / 365);
  const month = Math.floor(r / 30) % 13;
  const day = (r % 30) + 1;
  return { year, month: month + 1, day };
}

export function ethiopicToGregorian(year, month, day) {
  const jdn =
    ETHIOPIC_EPOCH_JDN + 365 * year + Math.floor(year / 4) + 30 * (month - 1) + (day - 1);
  const ms = (jdn - 2440588) * 86400000;
  return new Date(ms);
}

export const ETHIOPIC_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagumen',
];

export const ETHIOPIC_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን',
];

export function formatEthiopic(date, { months = ETHIOPIC_MONTHS_EN, withTime = false } = {}) {
  const { year, month, day } = gregorianToEthiopic(date);
  const base = `${day} ${months[month - 1]} ${year} ዓ.ም`;
  if (!withTime) return base;
  const p = partsInZone(date, DEFAULT_TIMEZONE);
  const hh = String(p.hour).padStart(2, '0');
  const mm = String(p.minute).padStart(2, '0');
  return `${base} ${hh}:${mm}`;
}

export default {
  startOfDay,
  endOfDay,
  dayRange,
  rangeForDays,
  localDateKey,
  localMonthKey,
  parseDateFilter,
  gregorianToEthiopic,
  ethiopicToGregorian,
  formatEthiopic,
};
