import mongoose from 'mongoose';

const stockUpdateSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productCode: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  quantityAdded: { type: Number, required: true, min: 1 },
  resultingStock: { type: Number, required: true, min: 0 },
  location: { type: String, required: true, trim: true, index: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  managerName: { type: String, required: true, trim: true }
}, { timestamps: true });

stockUpdateSchema.index({ createdAt: -1 });

export default mongoose.model('StockUpdate', stockUpdateSchema);
