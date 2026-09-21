import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productCode: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true, default: '' },
  salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salesRepName: { type: String, required: true, trim: true },
  items: { type: [orderItemSchema], validate: [(items) => items.length > 0, 'At least one item is required.'] },
  totalQuantity: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['COMPLETED'], default: 'COMPLETED' }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
