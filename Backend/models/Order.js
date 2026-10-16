import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productCode: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  style: { type: String, trim: true },
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, trim: true, default: '' },
  customerAddress: { type: String, required: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerCode: { type: String, trim: true },
  customerBranchId: { type: String, trim: true, default: 'billing' },
  customerBranchName: { type: String, trim: true, default: 'Billing address' },
  customerTinNo: { type: String, trim: true },
  customerDiscount: { type: Number, min: 0, max: 100, default: 0 },
  customerPaymentTerm: { type: String, trim: true },
  salesRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salesRepName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  items: { type: [orderItemSchema], validate: [(items) => items.length > 0, 'At least one item is required.'] },
  totalQuantity: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['PENDING', 'HELD', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
  hold: {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productCode: { type: String, trim: true },
    productName: { type: String, trim: true },
    items: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      productCode: { type: String, required: true, trim: true },
      productName: { type: String, required: true, trim: true },
      style: { type: String, trim: true },
      color: { type: String, trim: true },
      size: { type: String, trim: true },
      quantity: { type: Number, required: true, min: 1 }
    }],
    reason: { type: String, trim: true, maxlength: 500 },
    heldAt: { type: Date },
    heldBy: { type: String, trim: true }
  },
  invoice: {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    fileName: { type: String, trim: true },
    uploadedAt: { type: Date },
    uploadedBy: { type: String, trim: true }
  },
  cancelledAt: { type: Date },
  cancelledBy: { type: String, trim: true }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
