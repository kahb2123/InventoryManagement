import mongoose from 'mongoose';

/** Saved report definitions (date range, filters) for quick recall. */
const savedReportSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    reportType: { type: String, required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const SavedReport = mongoose.model('SavedReport', savedReportSchema);
export default SavedReport;
