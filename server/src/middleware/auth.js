import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/apiError.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) return next(ApiError.unauthorized('Authentication token is missing', 'NO_TOKEN'));

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid authentication token';
    return next(ApiError.unauthorized(message, 'BAD_TOKEN'));
  }

  const user = await User.findById(payload.sub);
  if (!user) return next(ApiError.unauthorized('User account no longer exists', 'NO_USER'));
  if (!user.active) return next(ApiError.forbidden('User account is deactivated', 'INACTIVE_USER'));

  req.user = user;
  req.userId = user._id;
  req.userRole = user.role;
  return next();
}

export function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export const requireAuth = asyncHandler(authenticate);
export default authenticate;
