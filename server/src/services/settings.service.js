import { Settings } from '../models/Settings.js';
import { getTenantContext } from '../utils/tenantScope.js';

let cache = null;
let cacheStamp = 0;
const TTL = 5000;

export async function getSettings({ fresh = false, tenantId } = {}) {
  const now = Date.now();
  const effectiveTenantId = tenantId || getTenantContext();
  const cacheKey = String(effectiveTenantId || 'global');
  if (!fresh && cache && cache.stampKey === cacheKey && now - cacheStamp < TTL) return cache.data;
  let query = effectiveTenantId ? { tenantId: effectiveTenantId } : {};
  let settings = await Settings.findOne(query);
  if (!settings) settings = await Settings.create({ tenantId: effectiveTenantId });
  cache = { stampKey: cacheKey, data: settings };
  cacheStamp = now;
  return settings;
}

export function invalidateSettingsCache() {
  cache = null;
  cacheStamp = 0;
}

export async function updateSettings(patch, { tenantId } = {}) {
  const settings = await getSettings({ fresh: true, tenantId });
  settings.set(patch);
  await settings.save();
  invalidateSettingsCache();
  return settings;
}

export default getSettings;
