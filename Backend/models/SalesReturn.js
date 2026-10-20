import mongoose from 'mongoose';

const salesReturnItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productCode: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, trim: true, default: '' }
}, { _id: false });

const salesReturnSchema = new mongoose.Schema({
  returnNumber: { type: String, required: true, unique: true, trim: true },
  returnDate: { type: Date, required: true },
  sourceType: { type: String, enum: ['INVOICE', 'MANUAL'], required: true },
  invoiceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  invoiceNumber: { type: String, trim: true, default: '' },
  customerName: { type: String, trim: true, default: '' },
  location: { type: String, required: true, trim: true },
  remarks: { type: String, trim: true, default: '' },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true, trim: true },
  items: { type: [salesReturnItemSchema], validate: [(items) => items.length > 0, 'At least one item is required.'] },
  totalQuantity: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' },
  reversedAt: { type: Date, default: null },
  reversedByName: { type: String, trim: true, default: '' },
  reversalReason: { type: String, trim: true, default: '' }
}, { timestamps: true });

export default mongoose.model('SalesReturn', salesReturnSchema);
