import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productCode: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 }
}, { _id: false });

const goodsReceivedNoteSchema = new mongoose.Schema({
  grnNumber: { type: String, required: true, unique: true, trim: true },
  supplierCode: { type: String, required: true, trim: true, uppercase: true },
  supplierName: { type: String, required: true, trim: true },
  remarks: { type: String, trim: true, default: '' },
  grnDate: { type: Date, required: true },
  location: { type: String, required: true, trim: true },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true, trim: true },
  items: { type: [itemSchema], validate: [(items) => items.length > 0, 'At least one item is required.'] },
  totalQuantity: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 }
}, { timestamps: true });

goodsReceivedNoteSchema.index({ createdAt: -1 });

export default mongoose.model('GoodsReceivedNote', goodsReceivedNoteSchema);
