import mongoose from 'mongoose';

const salesPivotLayoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  rowFields: { type: [String], default: [] },
  columnFields: { type: [String], default: [] },
  valueFields: { type: [String], default: [] },
  reportFields: { type: [String], default: [] },
  reportValues: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

salesPivotLayoutSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('SalesPivotLayout', salesPivotLayoutSchema);
