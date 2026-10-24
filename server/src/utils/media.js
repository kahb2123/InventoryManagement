/**
 * Media URLs are stored in the database as root-relative paths (e.g.
 * "/uploads/logo.png") so they stay portable across environments.
 *
 * The client is served from a different origin than the API in production
 * (Vercel -> Render), so a relative path would resolve against the frontend
 * host and 404. These helpers turn a stored path into an absolute URL based
 * on the incoming request, which behind Render's proxy is the public
 * https://<service>.onrender.com origin.
 */

/** Absolute URL for a stored media path. Returns the value untouched if it is already absolute. */
export function absoluteMediaUrl(req, value) {
  if (!value || typeof value !== 'string') return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith('/')) return value;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get?.('host');
  if (!host) return value;
  return `${protocol}://${host}${value}`;
}

/** Copy of a plain settings object with the logo URL made absolute. */
export function withAbsoluteLogo(req, settings) {
  if (!settings) return settings;
  const plain = typeof settings.toObject === 'function' ? settings.toObject() : { ...settings };
  plain.logo = absoluteMediaUrl(req, plain.logo);
  return plain;
}
