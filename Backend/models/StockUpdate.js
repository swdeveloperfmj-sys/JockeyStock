import mongoose from 'mongoose';

const stockUpdateSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productCode: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  quantityAdded: { type: Number, required: true },
  resultingStock: { type: Number, required: true, min: 0 },
  location: { type: String, required: true, trim: true, index: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  managerName: { type: String, required: true, trim: true },
  documentNo: { type: String, trim: true, default: '' },
  transactionType: { type: String, trim: true, default: 'STOCK UPDATE' },
  description: { type: String, trim: true, default: '' }
}, { timestamps: true });

stockUpdateSchema.index({ createdAt: -1 });

export default mongoose.model('StockUpdate', stockUpdateSchema);
