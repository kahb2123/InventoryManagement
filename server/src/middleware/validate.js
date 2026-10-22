import { validationResult } from 'express-validator';
import { ApiError } from '../utils/apiError.js';

export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg, location: e.location }));
  return next(ApiError.unprocessable('Please correct the highlighted fields', 'VALIDATION_ERROR', details));
}

export default validate;
