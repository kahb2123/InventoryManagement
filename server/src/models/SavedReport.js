import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

/** Saved report definitions (date range, filters) for quick recall. */
const savedReportSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    reportType: { type: String, required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    shared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

tenantScope(savedReportSchema);

export const SavedReport = mongoose.model('SavedReport', savedReportSchema);
export default SavedReport;

