import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

/** Append-only audit entry. Never throws into the request flow. */
export async function audit(req, { action, entity, entityId = null, entityLabel = '', details = {} }) {
  try {
    await AuditLog.create({
      action,
      entity,
      entityId: entityId ? new mongoose.Types.ObjectId(String(entityId)) : null,
      entityLabel,
      user: req.user?._id || null,
      userName: req.user?.name || 'system',
      userRole: req.user?.role || 'system',
      branch: req.user?.branch || null,
      details,
      ip: req.ip || req.headers?.['x-forwarded-for'] || '',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write audit entry', error.message);
  }
}

export default audit;
