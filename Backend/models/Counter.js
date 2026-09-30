import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true, default: 0 },
  prefix: { type: String, trim: true, default: 'GRN-' },
  padding: { type: Number, min: 1, max: 12, default: 6 }
});

export default mongoose.model('Counter', counterSchema);
