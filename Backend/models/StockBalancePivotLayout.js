import mongoose from 'mongoose';

const stockBalancePivotLayoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  rowField: { type: String, default: null },
  columnField: { type: String, default: null },
  valueField: { type: String, default: null },
  filterField: { type: String, default: null },
  filterValue: { type: String, default: '' },
  rowFields: { type: [String], default: [] },
  columnFields: { type: [String], default: [] },
  valueFields: { type: [String], default: [] },
  filterFields: { type: [String], default: [] },
  filterValues: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

stockBalancePivotLayoutSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('StockBalancePivotLayout', stockBalancePivotLayoutSchema);
