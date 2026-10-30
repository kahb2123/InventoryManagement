import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

const rolePermissionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    role: { type: String, required: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ tenantId: 1, role: 1 }, { unique: true });
tenantScope(rolePermissionSchema);

export const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);
export default RolePermission;
