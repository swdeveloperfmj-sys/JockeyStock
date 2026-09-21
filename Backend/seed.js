import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from './models/User.js';
import Location from './models/Location.js';
import Role from './models/Role.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Create .env from .env.example first.');

await mongoose.connect(process.env.MONGODB_URI);

const demoUsers = [
  { name: 'System Administrator', username: 'admin', email: 'admin@jockey.lk', password: 'Admin@123', role: 'SUPER_ADMIN', location: 'Head Office' },
  { name: 'Nimal Perera', username: 'salesrep', email: 'sales@jockey.lk', password: 'Sales@123', role: 'SALES_REP', location: 'Colombo' }
];

for (const user of demoUsers) {
  const password = await bcrypt.hash(user.password, 12);
  await User.findOneAndUpdate({ email: user.email }, { ...user, password }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

await Location.bulkWrite([
  { name: 'Head Office', address: 'Colombo', latitude: 6.9271, longitude: 79.8612 },
  { name: 'Colombo', address: 'Colombo District', latitude: 6.9344, longitude: 79.8428 },
  { name: 'FMJ New Plant', address: 'Factory location', latitude: null, longitude: null }
].map((location) => ({ updateOne: { filter: { name: location.name }, update: location, upsert: true } })));
await Role.bulkWrite(['SUPER_ADMIN', 'SALES_REP', 'LOCATION_MANAGER'].map((name) => ({ updateOne: { filter: { name }, update: { name }, upsert: true } })));

console.log('Demo users seeded successfully.');
await mongoose.disconnect();
