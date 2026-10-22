import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import env from './config/env.js';
import { isLoopbackOrigin } from './config/env.js';

import authRoutes from './routes/auth.routes.js';
import productsRoutes from './routes/products.routes.js';
import branchesRoutes from './routes/branches.routes.js';
import customersRoutes from './routes/customers.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import salesRoutes from './routes/sales.routes.js';
import purchasesRoutes from './routes/purchases.routes.js';
import stockRoutes from './routes/stock.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import auditRoutes from './routes/audit.routes.js';
import usersRoutes from './routes/users.routes.js';

import { notFound, errorHandler } from './middleware/error.js';
import { uploadDir } from './middleware/upload.js';
import { ApiError } from './utils/apiError.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) return callback(null, true);
        if (env.corsAllowLoopback && isLoopbackOrigin(origin)) return callback(null, true);
        return callback(
          ApiError.forbidden(
            `Origin "${origin}" is not allowed to call this API. Add it to CORS_ORIGINS in server/.env (currently: ${env.corsOrigins.join(', ') || 'none'}).`,
            'FORBIDDEN_ORIGIN'
          )
        );
      },
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  // Static uploads (logos, product images)
  app.use('/uploads', express.static(path.resolve(uploadDir), { maxAge: '7d' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again.' },
  });

  app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', env: env.nodeEnv, time: new Date().toISOString() } });
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/branches', branchesRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/suppliers', suppliersRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/purchases', purchasesRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/users', usersRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
