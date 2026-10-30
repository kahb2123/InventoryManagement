import { roleHasPermission, permissionsForRole } from '../config/permissions.js';
import { ApiError } from '../utils/apiError.js';

/** Require one or more permissions (all listed permissions must be granted). */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const missing = permissions.filter((p) => !roleHasPermission(req.user.role, p));
    if (missing.length > 0) {
      return next(
        ApiError.forbidden(
          `Your role (${req.user.role}) is not allowed to perform this action`,
          'FORBIDDEN_PERMISSION',
          { required: permissions, missing }
        )
      );
    }
    return next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of: ${roles.join(', ')}`, 'FORBIDDEN_ROLE'));
    }
    return next();
  };
}

/**
 * Branch scoping: non-admin roles only see their own branch.
 * Admins may pass ?branch=<id> or ?all=1 to widen the scope.
 */
export function branchScope(req) {
  const isAdmin = ['owner', 'admin', 'manager'].includes(req.user.role);
  const requested = req.query.branch || req.body?.branch;
  if (requested && requested !== 'all') return requested;
  if (!isAdmin) return req.user.branch || null;
  return null;
}

export function currentPermissions(user) {
  return permissionsForRole(user.role);
}

export default requirePermission;
