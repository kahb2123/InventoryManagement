import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(serverRoot, '.env') });

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

/** True for http://localhost:<port>, http://127.0.0.1:<port> and friends. */
export function isLoopbackOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/buildstock_ethiopia',
  useMemoryDbFallback: bool(process.env.USE_MEMORY_DB_FALLBACK, true),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'ETB',
  defaultLocale: process.env.DEFAULT_LOCALE || 'en',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Africa/Addis_Ababa',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // In development any loopback host/port is accepted, so a Vite server that
  // fell back to a different port (5174, 4173, ...) still works.
  corsAllowLoopback: bool(process.env.CORS_ALLOW_LOOPBACK, process.env.NODE_ENV !== 'production'),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024),
  seedOwner: {
    email: process.env.SEED_OWNER_EMAIL || 'owner@buildstock.et',
    password: process.env.SEED_OWNER_PASSWORD || 'BuildStock@2024',
    name: process.env.SEED_OWNER_NAME || 'BuildStock Owner',
  },
};

if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

export default env;
