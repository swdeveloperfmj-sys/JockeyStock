import 'dotenv/config';
import mongoose from 'mongoose';
import Location from './models/Location.js';
import Role from './models/Role.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Create .env from .env.example first.');

await mongoose.connect(process.env.MONGODB_URI);

await Location.bulkWrite([
  { name: 'Head Office', address: 'Colombo', latitude: 6.9271, longitude: 79.8612 },
  { name: 'Colombo', address: 'Colombo District', latitude: 6.9344, longitude: 79.8428 },
  { name: 'FMJ New Plant', address: 'Factory location', latitude: null, longitude: null }
].map((location) => ({ updateOne: { filter: { name: location.name }, update: location, upsert: true } })));
await Role.bulkWrite(['SUPER_ADMIN', 'SALES_REP', 'LOCATION_MANAGER'].map((name) => ({ updateOne: { filter: { name }, update: { name }, upsert: true } })));

console.log('Locations and roles seeded successfully.');
await mongoose.disconnect();
