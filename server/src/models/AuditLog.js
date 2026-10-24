import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

/** Append-only audit trail for corrections, approvals and sensitive operations. */
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    entityLabel: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: '' },
    userRole: { type: String, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

auditLogSchema.index({ date: -1 });

tenantScope(auditLogSchema);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

