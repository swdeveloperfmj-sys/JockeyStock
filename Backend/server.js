import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from './models/User.js';
import Location from './models/Location.js';
import Role from './models/Role.js';
import Product from './models/Product.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = await User.findOne({ username: username.toLowerCase() }).select('+password');
  const isPasswordValid = user && await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(401).json({ message: 'Invalid username or password.' });

  return res.json({ token: `demo-token-${user._id}`, user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role } });
});

const userFields = ['name', 'username', 'email', 'contactNumber', 'location', 'role'];
const safeUser = (user) => ({ id: user._id, name: user.name, username: user.username, email: user.email, contactNumber: user.contactNumber, location: user.location, role: user.role });

app.get('/api/users', async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map(safeUser));
});

app.post('/api/users', async (req, res) => {
  const { name, username, password, confirmPassword, role } = req.body;
  if (!name || !username || !password || !role || !req.body.location) return res.status(400).json({ message: 'Name, username, password, role, and location are required.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
  try {
    const data = Object.fromEntries(userFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    if (!data.email) delete data.email;
    const user = await User.create({ ...data, password: await bcrypt.hash(password, 12) });
    res.status(201).json(safeUser(user));
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Username or email already exists.' : error.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  const updates = Object.fromEntries(userFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
  if (!updates.email) delete updates.email;
  if (req.body.password) {
    if (req.body.password !== req.body.confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
    updates.password = await bcrypt.hash(req.body.password, 12);
  }
  try {
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(safeUser(user));
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Username or email already exists.' : error.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.status(204).end();
});

function managementRoutes(path, Model) {
  app.get(`/api/${path}`, async (_req, res) => res.json(await Model.find().sort({ name: 1 })));
  app.post(`/api/${path}`, async (req, res) => {
    if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name is required.' });
    try { res.status(201).json(await Model.create({ name: req.body.name.trim() })); }
    catch (error) { res.status(409).json({ message: 'This item already exists.' }); }
  });
  app.patch(`/api/${path}/:id`, async (req, res) => {
    if (!req.body.name?.trim()) return res.status(400).json({ message: 'Name is required.' });
    try { const item = await Model.findByIdAndUpdate(req.params.id, { name: req.body.name.trim() }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Item not found.' }); res.json(item); }
    catch (error) { res.status(409).json({ message: 'This item already exists.' }); }
  });
  app.delete(`/api/${path}/:id`, async (req, res) => { const item = await Model.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found.' }); res.status(204).end(); });
}
managementRoutes('roles', Role);

const productFields = ['productCode', 'productName', 'gender', 'categoryCode', 'subCategoryCode', 'subSubCategory', 'supplierCode', 'costPrice', 'orderPrice', 'averageCost', 'sellingPrice', 'wholesalePrice', 'minimumPrice'];
const parseProductName = (value = '') => {
  const productName = String(value).trim().toUpperCase();
  const match = productName.match(/^([A-Z0-9]+)-(\d{2})(\d{2})-([A-Z0-9]+)-([A-Z0-9]+)$/);
  if (!match) return null;
  return {
    productName,
    referenceCode1: productName,
    style: match[1],
    packingQuantity: match[2],
    cartonQuantity: match[3],
    color: match[4],
    size: match[5]
  };
};
app.get('/api/products', async (_req, res) => res.json(await Product.find().sort({ createdAt: -1 })));
app.post('/api/products', async (req, res) => {
  const data = Object.fromEntries(productFields.map((field) => [field, req.body[field]]));
  if (!/^\d{13}$/.test(data.productCode || '')) return res.status(400).json({ message: 'Product Code must contain exactly 13 numbers.' });
  const productDetails = parseProductName(data.productName);
  if (!productDetails) return res.status(400).json({ message: 'Product Name must use the format FP03-0205-ASSTD-XL.' });
  Object.assign(data, productDetails);
  const required = productFields.filter((field) => field !== 'subSubCategory');
  if (required.some((field) => data[field] === undefined || data[field] === '')) return res.status(400).json({ message: 'Please complete all required product fields.' });
  Object.assign(data, { sku: data.productCode, name: data.productName, category: data.categoryCode });
  try { res.status(201).json(await Product.create(data)); }
  catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Product Code already exists.' : error.message }); }
});
app.patch('/api/products/:id', async (req, res) => {
  const data = Object.fromEntries(productFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
  if (data.productCode && !/^\d{13}$/.test(data.productCode)) return res.status(400).json({ message: 'Product Code must contain exactly 13 numbers.' });
  if (data.productName !== undefined) {
    const productDetails = parseProductName(data.productName);
    if (!productDetails) return res.status(400).json({ message: 'Product Name must use the format FP03-0205-ASSTD-XL.' });
    Object.assign(data, productDetails);
  }
  if (data.productCode) data.sku = data.productCode;
  if (data.productName) data.name = data.productName;
  if (data.categoryCode) data.category = data.categoryCode;
  try { const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }); if (!product) return res.status(404).json({ message: 'Product not found.' }); res.json(product); }
  catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Product Code already exists.' : error.message }); }
});
app.delete('/api/products/:id', async (req, res) => { const product = await Product.findByIdAndDelete(req.params.id); if (!product) return res.status(404).json({ message: 'Product not found.' }); res.status(204).end(); });

app.get('/api/dashboard/summary', async (_req, res) => {
  try {
    const [inventory, lowStockProducts, salesReps, locations, roles, recentProducts] = await Promise.all([
      Product.aggregate([{ $group: { _id: null, totalProducts: { $sum: 1 }, totalStock: { $sum: '$openingStock' } } }]),
      Product.countDocuments({ openingStock: { $lte: 10 } }),
      User.countDocuments({ role: { $ne: 'SUPER_ADMIN' } }),
      Location.countDocuments(),
      Role.countDocuments(),
      Product.find().sort({ updatedAt: -1 }).limit(5).select('productCode productName categoryCode openingStock unit sku name category updatedAt')
    ]);
    const totals = inventory[0] || { totalProducts: 0, totalStock: 0 };
    res.json({
      totalProducts: totals.totalProducts,
      totalStock: totals.totalStock,
      lowStockProducts,
      salesReps,
      locations,
      roles,
      recentProducts
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load dashboard summary.' });
  }
});

app.get('/api/locations', async (_req, res) => res.json(await Location.find().sort({ name: 1 })));
app.post('/api/locations', async (req, res) => {
  const { name, address, latitude, longitude } = req.body;
  if (!name?.trim() || !address?.trim()) return res.status(400).json({ message: 'Location name and address/area are required.' });
  if ((latitude === '' || latitude == null) !== (longitude === '' || longitude == null)) return res.status(400).json({ message: 'Enter both latitude and longitude, or leave both blank.' });
  try { res.status(201).json(await Location.create({ name: name.trim(), address: address.trim(), latitude: latitude === '' || latitude == null ? null : Number(latitude), longitude: longitude === '' || longitude == null ? null : Number(longitude) })); }
  catch (error) { res.status(409).json({ message: 'This location already exists.' }); }
});
app.patch('/api/locations/:id', async (req, res) => {
  const { name, address, latitude, longitude } = req.body;
  if (!name?.trim() || !address?.trim()) return res.status(400).json({ message: 'Location name and address/area are required.' });
  if ((latitude === '' || latitude == null) !== (longitude === '' || longitude == null)) return res.status(400).json({ message: 'Enter both latitude and longitude, or leave both blank.' });
  try { const item = await Location.findByIdAndUpdate(req.params.id, { name: name.trim(), address: address.trim(), latitude: latitude === '' || latitude == null ? null : Number(latitude), longitude: longitude === '' || longitude == null ? null : Number(longitude) }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Location not found.' }); res.json(item); }
  catch (error) { res.status(409).json({ message: 'This location already exists.' }); }
});
app.delete('/api/locations/:id', async (req, res) => { const item = await Location.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ message: 'Location not found.' }); res.status(204).end(); });

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Create Backend/.env from .env.example and add your MongoDB connection string.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected.');
  app.listen(port, () => console.log(`Jockey Stock API running at http://localhost:${port}`));
}

startServer().catch((error) => { console.error('Unable to start server:', error.message); process.exit(1); });
