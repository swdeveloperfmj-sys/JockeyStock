import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: { type: String, enum: ['ORDER', 'STOCK', 'SYSTEM'], default: 'SYSTEM' },
  readAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
