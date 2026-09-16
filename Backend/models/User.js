import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, default: '' },
    password: { type: String, required: true, select: false },
    contactNumber: { type: String, trim: true, default: '' },
    location: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
