import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import User from './models/User.js';
import Location from './models/Location.js';
import Role from './models/Role.js';
import Product from './models/Product.js';
import Order from './models/Order.js';

const app = express();
const port = process.env.PORT || 5000;
const stockEventClients = new Set();
const publishStockUpdate = (products) => {
  const payload = JSON.stringify(products.map((product) => ({
    productId: String(product._id),
    openingStock: product.openingStock,
    updatedAt: product.updatedAt
  })));
  for (const client of stockEventClients) client.write(`event: stock-update\ndata: ${payload}\n\n`);
};
const sessionMaxAge = 5 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
const cloudinaryIsConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    callback(allowedTypes.includes(file.mimetype) ? null : new Error('Only JPG, PNG, and WebP images are allowed.'), allowedTypes.includes(file.mimetype));
  }
}).array('images', 6);
const receiveProductImage = (req, res, next) => productImageUpload(req, res, (error) => {
  if (!error) return next();
  const message = error.code === 'LIMIT_FILE_SIZE' ? 'Image size must be 5 MB or less.' : error.message;
  return res.status(400).json({ message });
});
const uploadImageBuffer = (buffer, options) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => error ? reject(error) : resolve(result));
  stream.end(buffer);
});
const migrateLegacyProductImage = (product) => {
  if (
    product.imageUrl &&
    product.imagePublicId &&
    !product.images.some((image) => image.publicId === product.imagePublicId)
  ) {
    product.images.unshift({ url: product.imageUrl, publicId: product.imagePublicId });
  }
};
const productImageEntries = (product) => {
  migrateLegacyProductImage(product);
  return product.images.map((image) => ({
    _id: image._id,
    url: image.url,
    publicId: image.publicId
  }));
};
const sharedProductImages = (products, excludedPublicId = '') => {
  const imagesByPublicId = new Map();
  for (const product of products) {
    for (const image of productImageEntries(product)) {
      if (image.publicId !== excludedPublicId && !imagesByPublicId.has(image.publicId)) {
        imagesByPublicId.set(image.publicId, image);
      }
    }
  }
  return [...imagesByPublicId.values()];
};
const productImageGroup = (product) => ({
  style: product.style,
  packingQuantity: product.packingQuantity
});
const syncProductImageGroup = async (filter, images) => {
  const firstImage = images[0];
  const result = await Product.updateMany(filter, {
    $set: {
      images,
      imageUrl: firstImage?.url || '',
      imagePublicId: firstImage?.publicId || ''
    }
  });
  return result.modifiedCount;
};
const productImageGroupKey = (product) => `${product.style}::${product.packingQuantity}`;
const addInheritedProductImages = async (products) => {
  if (!products.length) return;
  const uniqueGroups = new Map();
  for (const product of products) uniqueGroups.set(productImageGroupKey(product), productImageGroup(product));
  const groupProducts = await Product.find({ $or: [...uniqueGroups.values()] }).select('+imagePublicId');
  const productsByGroup = new Map();
  for (const product of groupProducts) {
    const key = productImageGroupKey(product);
    if (!productsByGroup.has(key)) productsByGroup.set(key, []);
    productsByGroup.get(key).push(product);
  }
  for (const product of products) {
    const images = sharedProductImages(productsByGroup.get(productImageGroupKey(product)) || []).slice(0, 6);
    if (!images.length) continue;
    product.images = images;
    product.imageUrl = images[0].url;
    product.imagePublicId = images[0].publicId;
  }
};

app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(session({
  name: 'jockey.sid',
  secret: process.env.SESSION_SECRET || 'change-this-development-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: sessionMaxAge / 1000 }),
  cookie: {
    maxAge: sessionMaxAge,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
}));

<<<<<<< Updated upstream
=======
app.use(async (_req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    res.status(503).json({ message: 'Database connection is unavailable. Check MONGODB_URI and MongoDB network access.' });
  }
});

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'Jockey Stock API', health: '/api/health' });
});

>>>>>>> Stashed changes
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = await User.findOne({ username: username.toLowerCase() }).select('+password');
  const isPasswordValid = user && await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(401).json({ message: 'Invalid username or password.' });

  return req.session.regenerate((sessionError) => {
    if (sessionError) return res.status(500).json({ message: 'Unable to create a login session.' });
    req.session.userId = user._id.toString();
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ message: 'Unable to save the login session.' });
      return res.json({
        user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role },
        expiresAt: Date.now() + sessionMaxAge
      });
    });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('jockey.sid');
    res.status(204).end();
  });
});

const requireSession = (req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  next();
};

app.use('/api', requireSession);

const currentUser = async (req) => User.findById(req.session.userId);

// All signed-in sales screens receive stock changes immediately. The order API
// still performs the final atomic stock check, which protects against races.
app.get('/api/stock-events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  res.write(': connected\n\n');
  stockEventClients.add(res);
  req.on('close', () => stockEventClients.delete(res));
});

app.get('/api/orders', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  const filter = user.role === 'SUPER_ADMIN' ? {} : { salesRepId: user._id };
  res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
});

app.post('/api/orders', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  const { customerName, customerPhone = '', customerAddress, items } = req.body;
  if (!customerName?.trim() || !customerAddress?.trim() || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Customer name, address, and at least one order item are required.' });
  }
  if (items.some((item) => !mongoose.isValidObjectId(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
    return res.status(400).json({ message: 'Each order item must have a valid product and quantity.' });
  }

  const dbSession = await mongoose.startSession();
  try {
    let createdOrder;
    await dbSession.withTransaction(async () => {
      const requestedItems = await Promise.all(items.map(async (item) => {
        const product = await Product.findById(item.productId).session(dbSession);
        if (!product) throw new Error('One of the selected products no longer exists.');
        const quantity = Number(item.quantity);
        if (product.openingStock < quantity) throw new Error(`${product.productName} has only ${product.openingStock} ${product.unit} available.`);
        const unitPrice = Number(product.orderPrice);
        return {
          productId: product._id,
          productCode: product.productCode,
          productName: product.productName,
          quantity,
          unitPrice,
          total: unitPrice * quantity
        };
      }));
      for (const item of requestedItems) {
        const result = await Product.updateOne(
          { _id: item.productId, openingStock: { $gte: item.quantity } },
          { $inc: { openingStock: -item.quantity } },
          { session: dbSession }
        );
        if (!result.modifiedCount) throw new Error('Product stock changed. Please review the order and try again.');
      }
      const totalQuantity = requestedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = requestedItems.reduce((sum, item) => sum + item.total, 0);
      [createdOrder] = await Order.create([{
        orderNumber: `SO-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        salesRepId: user._id,
        salesRepName: user.name,
        items: requestedItems,
        totalQuantity,
        totalAmount
      }], { session: dbSession });
    });
    const changedProducts = await Product.find({
      _id: { $in: createdOrder.items.map((item) => item.productId) }
    }).select('_id openingStock updatedAt');
    publishStockUpdate(changedProducts);
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to create the sales order.' });
  } finally {
    await dbSession.endSession();
  }
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
const allowedGenders = ['MENS', 'WOMENS', 'BOYS', 'GIRLS', 'UNISEX'];
const normalizeGender = (value = '') => {
  const gender = String(value).trim().toUpperCase();
  if (gender === 'MEN') return 'MENS';
  if (gender === 'WOMEN') return 'WOMENS';
  return gender;
};
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
app.get('/api/products', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  const filter = user.role === 'LOCATION_MANAGER' ? { plant: user.location } : {};
  res.json(await Product.find(filter).sort({ createdAt: -1 }));
});
app.post('/api/products/:id/stock', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'LOCATION_MANAGER') return res.status(403).json({ message: 'Only Location Managers can update factory stock.' });
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: 'Enter a whole quantity of at least 1.' });
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, plant: user.location },
    { $inc: { openingStock: quantity } },
    { new: true, runValidators: true }
  );
  if (!product) return res.status(404).json({ message: 'Product not found in your factory.' });
  publishStockUpdate([product]);
  res.json(product);
});
app.post('/api/products', async (req, res) => {
  const data = Object.fromEntries(productFields.map((field) => [field, req.body[field]]));
  data.gender = normalizeGender(data.gender);
  if (!/^\d{13}$/.test(data.productCode || '')) return res.status(400).json({ message: 'Product Code must contain exactly 13 numbers.' });
  const productDetails = parseProductName(data.productName);
  if (!productDetails) return res.status(400).json({ message: 'Product Name must use the format FP03-0205-ASSTD-XL.' });
  Object.assign(data, productDetails);
  const required = productFields.filter((field) => field !== 'subSubCategory');
  if (required.some((field) => data[field] === undefined || data[field] === '')) return res.status(400).json({ message: 'Please complete all required product fields.' });
  Object.assign(data, { sku: data.productCode, name: data.productName, category: data.categoryCode });
  try {
    await addInheritedProductImages([data]);
    res.status(201).json(await Product.create(data));
  }
  catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Product Code already exists.' : error.message }); }
});
app.post('/api/products/bulk', async (req, res) => {
  const rows = req.body.products;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'The spreadsheet does not contain any products.' });
  if (rows.length > 2000) return res.status(400).json({ message: 'A maximum of 2,000 products can be imported at once.' });

  const errors = [];
  const candidates = [];
  const seenCodes = new Set();
  const priceFields = ['costPrice', 'orderPrice', 'averageCost', 'sellingPrice', 'wholesalePrice', 'minimumPrice'];
  const requiredTextFields = ['productName', 'gender', 'categoryCode', 'subCategoryCode', 'supplierCode'];

  rows.forEach((row, index) => {
    const rowNumber = Number(row.rowNumber) || index + 2;
    const data = Object.fromEntries(productFields.map((field) => [field, row[field]]));
    data.productCode = String(data.productCode ?? '').trim();
    requiredTextFields.forEach((field) => { data[field] = String(data[field] ?? '').trim(); });
    data.subSubCategory = String(data.subSubCategory ?? '').trim();
    data.gender = normalizeGender(data.gender);
    data.supplierCode = (data.supplierCode || 'JOCKEY').toUpperCase();

    if (!/^\d{13}$/.test(data.productCode)) {
      errors.push({ row: rowNumber, productCode: data.productCode, message: 'Product Code must contain exactly 13 numbers.' });
      return;
    }
    if (seenCodes.has(data.productCode)) {
      errors.push({ row: rowNumber, productCode: data.productCode, message: 'Duplicate Product Code in this spreadsheet.' });
      return;
    }
    seenCodes.add(data.productCode);

    const productDetails = parseProductName(data.productName);
    if (!productDetails) {
      errors.push({ row: rowNumber, productCode: data.productCode, message: 'Product Name must use the format FP03-0205-ASSTD-XL.' });
      return;
    }
    if (requiredTextFields.some((field) => !data[field])) {
      errors.push({ row: rowNumber, productCode: data.productCode, message: 'A required field is empty.' });
      return;
    }
    if (!allowedGenders.includes(data.gender)) {
      errors.push({ row: rowNumber, productCode: data.productCode, message: 'Gender must be MENS, WOMENS, BOYS, GIRLS, or UNISEX.' });
      return;
    }

    if (priceFields.some((field) => String(data[field] ?? '').trim() === '')) {
      errors.push({ row: rowNumber, productCode: data.productCode, message: 'All price fields are required.' });
      return;
    }
    for (const field of priceFields) data[field] = Number(data[field]);
    if (priceFields.some((field) => !Number.isFinite(data[field]) || data[field] < 0)) {
      errors.push({ row: rowNumber, productCode: data.productCode, message: 'All prices must be valid positive numbers or zero.' });
      return;
    }

    Object.assign(data, productDetails, {
      sku: data.productCode,
      name: productDetails.productName,
      category: data.categoryCode,
      _sourceRow: rowNumber
    });
    candidates.push(data);
  });

  try {
    const existingCodes = candidates.length
      ? await Product.find({ productCode: { $in: candidates.map((item) => item.productCode) } }).distinct('productCode')
      : [];
    const existingSet = new Set(existingCodes);
    const newProducts = candidates.filter((item) => {
      if (!existingSet.has(item.productCode)) return true;
      errors.push({ row: item._sourceRow, productCode: item.productCode, message: 'Product Code already exists.' });
      return false;
    });
    newProducts.forEach((item) => delete item._sourceRow);
    await addInheritedProductImages(newProducts);
    const insertedProducts = newProducts.length ? await Product.insertMany(newProducts, { ordered: true }) : [];
    return res.status(insertedProducts.length ? 201 : 400).json({
      message: insertedProducts.length ? `${insertedProducts.length} products imported successfully.` : 'No products were imported.',
      inserted: insertedProducts.length,
      failed: errors.length,
      errors,
      products: insertedProducts
    });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'One or more Product Codes already exist.' : error.message });
  }
});
app.patch('/api/products/:id', async (req, res) => {
  const data = Object.fromEntries(productFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
  if (data.gender !== undefined) data.gender = normalizeGender(data.gender);
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
app.delete('/api/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id).select('+imagePublicId');
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  const publicIds = new Set(productImageEntries(product).map((image) => image.publicId));
  await product.deleteOne();
  if (cloudinaryIsConfigured()) {
    for (const publicId of publicIds) {
      const isStillUsed = await Product.exists({
        $or: [{ 'images.publicId': publicId }, { imagePublicId: publicId }]
      });
      if (isStillUsed) continue;
      try { await cloudinary.uploader.destroy(publicId, { invalidate: true }); }
      catch (error) { console.error('Unable to remove Cloudinary image:', error.message); }
    }
  }
  res.status(204).end();
});
app.post('/api/products/:id/image', receiveProductImage, async (req, res) => {
  if (!cloudinaryIsConfigured()) return res.status(503).json({ message: 'Cloudinary is not configured. Add the Cloudinary credentials to Backend/.env.' });
  if (!req.files?.length) return res.status(400).json({ message: 'Select one or more images to upload.' });
  const uploadedImages = [];
  try {
    const product = await Product.findById(req.params.id).select('+imagePublicId');
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const groupFilter = productImageGroup(product);
    const groupProducts = await Product.find(groupFilter).select('+imagePublicId');
    const existingImages = sharedProductImages(groupProducts);
    const remainingSlots = 6 - existingImages.length;
    if (remainingSlots <= 0) return res.status(400).json({ message: 'Products with this Style and Packing Quantity already have the maximum of 6 shared images.' });
    if (req.files.length > remainingSlots) {
      return res.status(400).json({ message: `You can upload only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} for this product.` });
    }
    for (const [index, file] of req.files.entries()) {
      const uploaded = await uploadImageBuffer(file.buffer, {
        resource_type: 'image',
        folder: 'jockey-stock/products',
        public_id: `${product._id}-${Date.now()}-${index + 1}`,
        overwrite: false,
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }]
      });
      uploadedImages.push(uploaded);
      existingImages.push({
        _id: new mongoose.Types.ObjectId(),
        url: uploaded.secure_url,
        publicId: uploaded.public_id
      });
    }
    await syncProductImageGroup(groupFilter, existingImages);
    return res.json({
      imageUrl: existingImages[0]?.url || '',
      images: existingImages.map((image) => ({ _id: image._id, url: image.url })),
      matchedProducts: groupProducts.length,
      style: product.style,
      packingQuantity: product.packingQuantity
    });
  } catch (error) {
    for (const image of uploadedImages) {
      try { await cloudinary.uploader.destroy(image.public_id, { invalidate: true }); }
      catch (cleanupError) { console.error('Unable to clean up Cloudinary image:', cleanupError.message); }
    }
    const message = /invalid signature|api_secret mismatch/i.test(error.message)
      ? 'Cloudinary credentials are invalid. Copy the API Secret again from the Cloudinary dashboard and restart the backend.'
      : `Image upload failed: ${error.message}`;
    return res.status(502).json({ message });
  }
});
app.delete('/api/products/:id/image', async (req, res) => {
  if (!cloudinaryIsConfigured()) return res.status(503).json({ message: 'Cloudinary is not configured. Add the Cloudinary credentials to Backend/.env.' });
  try {
    const product = await Product.findById(req.params.id).select('+imagePublicId');
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const groupFilter = productImageGroup(product);
    const groupProducts = await Product.find(groupFilter).select('+imagePublicId');
    const publicIds = new Set(sharedProductImages(groupProducts).map((image) => image.publicId));
    await syncProductImageGroup(groupFilter, []);
    for (const publicId of publicIds) {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
    }
    return res.status(204).end();
  } catch (error) {
    const message = /invalid signature|api_secret mismatch/i.test(error.message)
      ? 'Cloudinary credentials are invalid. Copy the API Secret again from the Cloudinary dashboard and restart the backend.'
      : `Image removal failed: ${error.message}`;
    return res.status(502).json({ message });
  }
});
app.delete('/api/products/:id/images/:imageId', async (req, res) => {
  if (!cloudinaryIsConfigured()) return res.status(503).json({ message: 'Cloudinary is not configured. Add the Cloudinary credentials to Backend/.env.' });
  try {
    const product = await Product.findById(req.params.id).select('+imagePublicId');
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const groupFilter = productImageGroup(product);
    const groupProducts = await Product.find(groupFilter).select('+imagePublicId');
    const allImages = sharedProductImages(groupProducts);
    const image = req.params.imageId === 'legacy'
      ? allImages.find((item) => item.publicId === product.imagePublicId)
      : allImages.find((item) => String(item._id) === req.params.imageId);
    if (!image?.publicId) return res.status(404).json({ message: 'Product image not found.' });
    const remainingImages = sharedProductImages(groupProducts, image.publicId);
    await syncProductImageGroup(groupFilter, remainingImages);
    await cloudinary.uploader.destroy(image.publicId, { invalidate: true });
    return res.json({
      imageUrl: remainingImages[0]?.url || '',
      images: remainingImages.map((item) => ({ _id: item._id, url: item.url })),
      matchedProducts: groupProducts.length
    });
  } catch (error) {
    const message = /invalid signature|api_secret mismatch/i.test(error.message)
      ? 'Cloudinary credentials are invalid. Copy the API Secret again from the Cloudinary dashboard and restart the backend.'
      : `Image removal failed: ${error.message}`;
    return res.status(502).json({ message });
  }
});

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
  await new Promise((resolve, reject) => {
    const server = app.listen(port);
    const handleError = (error) => reject(error);
    server.once('error', handleError);
    server.once('listening', () => {
      server.off('error', handleError);
      console.log(`Jockey Stock API running at http://localhost:${port}`);
      resolve();
    });
  });
}

startServer().catch((error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other backend process or choose a different PORT in Backend/.env.`);
  } else {
    console.error('Unable to start server:', error.message);
  }
  process.exit(1);
});
