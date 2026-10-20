import mongoose from 'mongoose';

const prnItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productCode: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, trim: true, default: '' }
}, { _id: false });

const purchaseReturnNoteSchema = new mongoose.Schema({
  prnNumber: { type: String, required: true, unique: true, trim: true },
  grnNumber: { type: String, trim: true, default: '' },
  supplierCode: { type: String, required: true, trim: true },
  supplierName: { type: String, required: true, trim: true },
  prnDate: { type: Date, required: true },
  location: { type: String, required: true, trim: true },
  remarks: { type: String, trim: true, default: '' },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  items: { type: [prnItemSchema], validate: [(items) => items.length > 0, 'At least one item is required.'] },
  totalQuantity: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 }
}, { timestamps: true });

export default mongoose.model('PurchaseReturnNote', purchaseReturnNoteSchema);
