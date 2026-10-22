import { ApiError } from '../utils/apiError.js';
import env from '../config/env.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found`, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Unexpected server error';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details;

  // Mongoose validation
  if (err.name === 'ValidationError') {
    status = 422;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = 'Please correct the highlighted fields';
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = `Invalid identifier for field "${err.path}"`;
  }

  // Duplicate key
  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
    details = err.keyValue;
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
    if (env.nodeEnv === 'production') message = 'Something went wrong. Please try again.';
  }

  res.status(status).json({
    success: false,
    message,
    code,
    ...(details ? { details } : {}),
    ...(env.nodeEnv !== 'production' && status >= 500 ? { stack: err.stack } : {}),
  });
}

export default errorHandler;
