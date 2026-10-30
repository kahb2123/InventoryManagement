import { ApiError, asyncHandler } from '../utils/apiError.js';

export function requirePlatformAdmin(req, res, next) {
  if (!req.user?.isPlatformAdmin) {
    throw ApiError.forbidden('Platform admin access required', 'PLATFORM_ADMIN_REQUIRED');
  }
  return next();
}

export const platformAuth = asyncHandler(requirePlatformAdmin);
export default requirePlatformAdmin;