import { Settings } from '../models/Settings.js';

let cache = null;
let cacheStamp = 0;
const TTL = 5000;

export async function getSettings({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && cache && now - cacheStamp < TTL) return cache;
  let settings = await Settings.findOne({ businessId: 'default' });
  if (!settings) settings = await Settings.create({ businessId: 'default' });
  cache = settings;
  cacheStamp = now;
  return settings;
}

export function invalidateSettingsCache() {
  cache = null;
  cacheStamp = 0;
}

export async function updateSettings(patch) {
  const settings = await getSettings({ fresh: true });
  settings.set(patch);
  await settings.save();
  invalidateSettingsCache();
  return settings;
}

export default getSettings;
