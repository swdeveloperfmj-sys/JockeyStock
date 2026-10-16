import mongoose from 'mongoose';

const customerBranchSchema = new mongoose.Schema({
  branchName: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, trim: true, default: '', maxlength: 500 },
  contact: { type: String, trim: true, default: '', maxlength: 80 }
}, { _id: true });

const customerSchema = new mongoose.Schema({
  customerCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
  customerName: { type: String, required: true, trim: true, maxlength: 200 },
  billingAddress: { type: String, required: true, trim: true, maxlength: 500 },
  contact: { type: String, trim: true, default: '', maxlength: 80 },
  tinNo: { type: String, required: true, trim: true, maxlength: 80 },
  // Kept only to display existing customer records until they are edited and migrated to tinNo.
  vatNo: { type: String, trim: true, maxlength: 80 },
  discount: { type: Number, min: 0, max: 100, default: 0 },
  paymentTerm: { type: String, required: true, enum: ['30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS'] },
  branches: { type: [customerBranchSchema], default: [] },
  createdBy: { type: String, required: true, trim: true }
}, { timestamps: true });

export default mongoose.model('Customer', customerSchema);
