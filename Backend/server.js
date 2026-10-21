import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';
import User from './models/User.js';
import Location from './models/Location.js';
import Role from './models/Role.js';
import Product from './models/Product.js';
import Order from './models/Order.js';
import Notification from './models/Notification.js';
import StockUpdate from './models/StockUpdate.js';
import Counter from './models/Counter.js';
import GoodsReceivedNote from './models/GoodsReceivedNote.js';
import PurchaseReturnNote from './models/PurchaseReturnNote.js';
import SalesReturn from './models/SalesReturn.js';
import Customer from './models/Customer.js';
import SalesPivotLayout from './models/SalesPivotLayout.js';
import StockBalancePivotLayout from './models/StockBalancePivotLayout.js';

const app = express();
const port = process.env.PORT || 5000;
const INVENTORY_LOCATION = 'Head Office';
const LEGACY_INVENTORY_LOCATION = 'FMJ New Plant';
let databaseConnection;
let inventoryLocationMigration;
const migrateInventoryLocation = async () => {
  if (inventoryLocationMigration) return inventoryLocationMigration;
  inventoryLocationMigration = (async () => {
    // The original FMJ New Plant inventory is now operated from Head Office.
    // Use the collection directly because `plant` is immutable on Product.
    await Product.collection.updateMany(
      { plant: LEGACY_INVENTORY_LOCATION },
      { $set: { plant: INVENTORY_LOCATION } }
    );
    await Order.updateMany(
      { location: LEGACY_INVENTORY_LOCATION },
      { $set: { location: INVENTORY_LOCATION } }
    );
  })().catch((error) => {
    inventoryLocationMigration = undefined;
    throw error;
  });
  return inventoryLocationMigration;
};
const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Add it to your deployment environment variables.');
  if (!databaseConnection) {
    databaseConnection = mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .catch((error) => { databaseConnection = undefined; throw error; });
  }
  const connection = await databaseConnection;
  await migrateInventoryLocation();
  return connection;
};
// Keep the recipient alongside each live connection. Stock and order events are
// shared, while notification events must reach only their intended recipients.
const stockEventClients = new Map();
const publishNotificationUpdate = (recipientIds) => {
  const recipients = new Set(recipientIds.map(String));
  for (const [client, recipientId] of stockEventClients) {
    if (recipients.has(recipientId)) client.write('event: notification-update\ndata: {}\n\n');
  }
};
const publishOrderUpdate = () => {
  for (const client of stockEventClients.keys()) client.write('event: order-update\ndata: {}\n\n');
};
const publishStockUpdate = (products) => {
  const payload = JSON.stringify(products.map((product) => ({
    productId: String(product._id),
    openingStock: product.openingStock,
    updatedAt: product.updatedAt
  })));
  for (const client of stockEventClients.keys()) client.write(`event: stock-update\ndata: ${payload}\n\n`);
};
const sessionMaxAge = 5 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === 'production';
const emailIsConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
const mailTransport = emailIsConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;
const smsIsConfigured = process.env.TEXTWARE_SMS_ENABLED === 'true' && Boolean(
  process.env.TEXTWARE_SMS_URL && process.env.TEXTWARE_SMS_USERNAME && process.env.TEXTWARE_SMS_PASSWORD && process.env.TEXTWARE_SMS_SENDER_ID
);
const deliverMessage = async (recipient, subject, message) => {
  const deliveries = [];
  if (mailTransport && recipient.email) deliveries.push(mailTransport.sendMail({ from: process.env.EMAIL_FROM, to: recipient.email, subject, text: message }));
  if (smsIsConfigured && recipient.contactNumber) {
    const parameters = new URLSearchParams({ username: process.env.TEXTWARE_SMS_USERNAME, password: process.env.TEXTWARE_SMS_PASSWORD, sender_id: process.env.TEXTWARE_SMS_SENDER_ID, to: recipient.contactNumber, message });
    deliveries.push(fetch(`${process.env.TEXTWARE_SMS_URL}?${parameters}`).then((response) => {
      if (!response.ok) throw new Error(`Textware SMS failed with status ${response.status}.`);
    }));
  }
  const results = await Promise.allSettled(deliveries);
  results.filter((result) => result.status === 'rejected').forEach((result) => console.error('Notification delivery failed:', result.reason?.message || result.reason));
};
const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
// Keep configured deployment URLs, while allowing both common Vite dev URLs
// whenever the API is running locally.
const allowedOrigins = isProduction
  ? configuredOrigins
  : [...new Set([...configuredOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])];

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
  origin(origin, callback) {
    // Requests without an Origin header (for example health checks) are safe to allow.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
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
    // The frontend and API are deployed to different Vercel subdomains, which
    // browsers treat as cross-site. Cross-site credentialed fetches require
    // SameSite=None together with a secure cookie.
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction
  }
}));

app.use(async (_req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    res.status(503).json({ message: 'Database connection is unavailable. Check MONGODB_URI and MongoDB network access.' });
  }
});

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
        user: { id: user._id, name: user.name, username: user.username, email: user.email, location: user.location, role: user.role, sidebarPermissions: user.sidebarPermissions },
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

// An order belongs to the plant that supplies its products, not the sales
// representative's profile location. Normalize old records from their items.
let legacyOrderMigration;
const migrateLegacyOrders = async () => {
  if (legacyOrderMigration) return legacyOrderMigration;
  legacyOrderMigration = (async () => {
    // Only migrate records created before orders stored their supplying
    // location.  Re-running this after a server restart must never rewrite
    // current orders (in particular, completed shipments).
    const orders = await Order.find({ location: { $exists: false } }).select('_id items.productId');
    if (!orders.length) return;
    const productIds = [...new Set(orders.flatMap((order) => order.items.map((item) => String(item.productId))))];
    const products = await Product.find({ _id: { $in: productIds } }).select('_id plant');
    const plantByProduct = new Map(products.map((product) => [String(product._id), product.plant]));
    await Promise.all(orders.map((order) => {
      const plants = [...new Set(order.items.map((item) => plantByProduct.get(String(item.productId))).filter(Boolean))];
      return plants.length === 1
        ? Order.updateOne({ _id: order._id }, { $set: { location: plants[0] } })
        : null;
    }));
  })().catch((error) => {
    legacyOrderMigration = undefined;
    throw error;
  });
  return legacyOrderMigration;
};

// All signed-in sales screens receive stock changes immediately. The order API
// still performs the final atomic stock check, which protects against races.
app.get('/api/stock-events', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  res.write(': connected\n\n');
  stockEventClients.set(res, String(user._id));
  req.on('close', () => stockEventClients.delete(res));
});

app.get('/api/orders', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  await migrateLegacyOrders();
  const filter = user.role === 'SUPER_ADMIN'
    ? {}
    : user.role === 'LOCATION_MANAGER'
      ? { location: user.location, status: { $in: ['PENDING', 'HELD'] } }
      : { salesRepId: user._id, status: { $in: ['PENDING', 'HELD'] } };
  if (user.role === 'SUPER_ADMIN') {
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000+05:30`);
      if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
    }
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(user.role === 'SUPER_ADMIN' ? 5000 : 200).lean();
  const missingDetailIds = [...new Set(orders.flatMap((order) => order.items.filter((item) => !item.color || !item.size || !item.style).map((item) => String(item.productId))))];
  if (missingDetailIds.length) {
    const products = await Product.find({ _id: { $in: missingDetailIds } }).select('_id style color size').lean();
    const productById = new Map(products.map((product) => [String(product._id), product]));
    orders.forEach((order) => {
      order.items = order.items.map((item) => ({ ...item, ...(productById.get(String(item.productId)) || {}) }));
    });
  }
  res.json(orders);
});

app.get('/api/reports/sales-register', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to view sales reports.' });
  const filter = user.role === 'LOCATION_MANAGER' ? { location: user.location } : {};
  const { from, to } = req.query;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000+05:30`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999+05:30`);
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
  const productIds = [...new Set(orders.flatMap((order) => order.items.map((item) => String(item.productId))).filter((id) => mongoose.isValidObjectId(id)))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select('_id productCode productName style packingQuantity cartonQuantity gender categoryCode subCategoryCode subSubCategory supplierCode color size costPrice sellingPrice').lean()
    : [];
  const productById = new Map(products.map((product) => [String(product._id), product]));
  orders.forEach((order) => {
    order.items = order.items.map((item) => ({ ...item, product: productById.get(String(item.productId)) || null }));
  });
  res.json(orders);
});

// Super Admin's current inventory snapshot.  The Sales Register's report
// controls are reused on the client for filtering, exporting and totals.
app.get('/api/reports/stock-balance', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can view the stock balance report.' });
  const filter = {};
  const { from, to } = req.query;
  if (from || to) {
    filter.updatedAt = {};
    if (from) filter.updatedAt.$gte = new Date(`${from}T00:00:00.000+05:30`);
    if (to) filter.updatedAt.$lte = new Date(`${to}T23:59:59.999+05:30`);
  }
  const products = await Product.find(filter).sort({ productCode: 1, productName: 1 }).lean();
  res.json(products.map((product) => ({
    id: String(product._id), productCode: product.productCode || product.sku || '', productName: product.productName || product.name || '',
    style: product.style || '', packingQuantity: product.packingQuantity || '', cartonQuantity: product.cartonQuantity || '',
    location: product.plant || '', gender: product.gender || '', category: product.categoryCode || product.category || '',
    subCategory: product.subCategoryCode || '', subSubCategory: product.subSubCategory || '', supplier: product.supplierCode || '',
    colour: product.color || '', size: product.size || '', stockBalance: Number(product.openingStock || 0),
    costPrice: Number(product.costPrice || 0), stockValue: Number(product.openingStock || 0) * Number(product.costPrice || 0),
    lastUpdated: product.updatedAt,
  })));
});
app.get('/api/reports/bin-card', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to view stock movement details.' });
  const productCode = String(req.query.productCode || '').trim();
  const location = user.role === 'LOCATION_MANAGER' ? user.location : String(req.query.location || '').trim();
  if (!productCode || !location) return res.status(400).json({ message: 'Product code and location are required.' });
  const product = await Product.findOne({ $or: [{ productCode }, { sku: productCode }], plant: location }).lean();
  if (!product) return res.status(404).json({ message: 'Product not found at the selected location.' });
  const filter = { productId: product._id, location };
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00.000+05:30`);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999+05:30`);
  }
  const movements = await StockUpdate.find(filter).sort({ createdAt: 1 }).lean();
  res.json({ product: { productCode: product.productCode, productName: product.productName, costPrice: product.costPrice, sellingPrice: product.sellingPrice, location: product.plant }, movements });
});

const salesPivotDimensions = new Set([
  'Product Code', 'Product Name', 'Style', 'Packing Quantity', 'Carton Quantity',
  'Location', 'Gender', 'Category', 'SubCategory', 'SubSubCategory', 'Document No',
  'Customer', 'Supplier', 'SalesPerson', 'Colour', 'Size',
  'Year', 'Quarter', 'Month', 'Week', 'Day', 'Hour'
]);
const salesPivotValues = new Set(['Qty', 'Gross Amount', 'Discount Amount', 'Net Amount', 'Selling Price', 'Cost Price']);
const stockBalancePivotDimensions = new Set(['productCode', 'productName', 'style', 'packingQuantity', 'cartonQuantity', 'location', 'gender', 'category', 'subCategory', 'subSubCategory', 'supplier', 'colour', 'size']);
const stockBalancePivotValues = new Set(['stockBalance', 'costPrice', 'stockValue']);

app.get('/api/reports/stock-balance/pivot-layouts', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can view stock balance layouts.' });
  res.json(await StockBalancePivotLayout.find({ userId: user._id }).sort({ updatedAt: -1 }).lean());
});

app.post('/api/reports/stock-balance/pivot-layouts', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can save stock balance layouts.' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Enter a layout name or remark before saving.' });
  if (name.length > 100) return res.status(400).json({ message: 'Layout name must be 100 characters or less.' });
  const dimension = (value) => stockBalancePivotDimensions.has(value) ? value : null;
  const value = (item) => stockBalancePivotValues.has(item) ? item : null;
  const dimensions = (items) => [...new Set((Array.isArray(items) ? items : []).filter((item) => stockBalancePivotDimensions.has(item)))];
  const values = (items) => [...new Set((Array.isArray(items) ? items : []).filter((item) => stockBalancePivotValues.has(item)))];
  const filterValues = Object.fromEntries(Object.entries(req.body.filterValues || {}).filter(([field, item]) => stockBalancePivotDimensions.has(field) && typeof item === 'string'));
  const layout = await StockBalancePivotLayout.findOneAndUpdate(
    { userId: user._id, name },
    { $set: { rowField: dimension(req.body.rowField), columnField: dimension(req.body.columnField), valueField: value(req.body.valueField), filterField: dimension(req.body.filterField), filterValue: typeof req.body.filterValue === 'string' ? req.body.filterValue : '', rowFields: dimensions(req.body.rowFields), columnFields: dimensions(req.body.columnFields), valueFields: values(req.body.valueFields), filterFields: dimensions(req.body.filterFields), filterValues } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  res.json(layout);
});

app.get('/api/reports/sales-register/pivot-layouts', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to view sales reports.' });
  const layouts = await SalesPivotLayout.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();
  res.json(layouts);
});

app.post('/api/reports/sales-register/pivot-layouts', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to save sales report layouts.' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Enter a layout name or remark before saving.' });
  if (name.length > 100) return res.status(400).json({ message: 'Layout name must be 100 characters or less.' });
  const cleanList = (value, allowed) => [...new Set((Array.isArray(value) ? value : []).filter((field) => allowed.has(field)))];
  const rowFields = cleanList(req.body.rowFields, salesPivotDimensions);
  const columnFields = cleanList(req.body.columnFields, salesPivotDimensions);
  const reportFields = cleanList(req.body.reportFields, salesPivotDimensions);
  const valueFields = cleanList(req.body.valueFields, salesPivotValues);
  const reportValues = Object.fromEntries(Object.entries(req.body.reportValues || {})
    .filter(([field, value]) => salesPivotDimensions.has(field) && typeof value === 'string'));
  const layout = await SalesPivotLayout.findOneAndUpdate(
    { userId: user._id, name },
    { $set: { rowFields, columnFields, reportFields, valueFields, reportValues } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  res.json(layout);
});
const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    callback(allowedTypes.includes(file.mimetype) ? null : new Error('Upload a PDF, JPG, PNG, or WebP invoice.'), allowedTypes.includes(file.mimetype));
  }
}).single('invoice');
const receiveInvoice = (req, res, next) => invoiceUpload(req, res, (error) => {
  if (!error) return next();
  return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Invoice file must be 10 MB or less.' : error.message });
});

const isSalesDepartment = (user) => ['SALES DEP', 'SALES_DEP'].includes(user?.role);
const canAccessShipmentInvoice = (user, order) => (
  (isSalesDepartment(user) && user.location === INVENTORY_LOCATION)
  || (user.role === 'LOCATION_MANAGER' && user.location === order.location)
);

app.get('/api/shipments', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  const locationManager = user.role === 'LOCATION_MANAGER';
  if (!locationManager && !(isSalesDepartment(user) && user.location === INVENTORY_LOCATION)) return res.status(403).json({ message: 'You are not allowed to view shipments.' });
  const filter = locationManager ? { location: user.location, status: 'COMPLETED' } : { status: 'COMPLETED' };
  const shipments = await Order.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  const customerIds = [...new Set(shipments.map((order) => String(order.customerId || '')).filter((id) => mongoose.isValidObjectId(id)))];
  if (customerIds.length) {
    const customers = await Customer.find({ _id: { $in: customerIds } }).select('_id tinNo vatNo').lean();
    const customerById = new Map(customers.map((customer) => [String(customer._id), customer]));
    shipments.forEach((order) => {
      const customer = customerById.get(String(order.customerId));
      if (customer) order.customerTinNo = customer.tinNo || customer.vatNo || '';
    });
  }
  res.json(shipments);
});

app.post('/api/shipments/:id/invoice', receiveInvoice, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!isSalesDepartment(user) || user.location !== INVENTORY_LOCATION) return res.status(403).json({ message: 'Only Head Office Sales Department users can upload invoices.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment.' });
  if (!req.file) return res.status(400).json({ message: 'Choose an invoice file to upload.' });
  if (!cloudinaryIsConfigured()) return res.status(503).json({ message: 'Cloudinary is not configured. Add the Cloudinary credentials to Backend/.env.' });
  try {
    const order = await Order.findOne({ _id: req.params.id, status: 'COMPLETED' });
    if (!order) return res.status(404).json({ message: 'This shipment is no longer available.' });
    const previousInvoicePublicId = order.invoice?.publicId;
    const uploaded = await uploadImageBuffer(req.file.buffer, { resource_type: 'raw', folder: 'jockey-stock/invoices', public_id: `invoice-${order.orderNumber}-${Date.now()}` });
    order.invoice = { url: uploaded.secure_url, publicId: uploaded.public_id, fileName: req.file.originalname, uploadedAt: new Date(), uploadedBy: user.name };
    await order.save();
    if (previousInvoicePublicId) {
      try { await cloudinary.uploader.destroy(previousInvoicePublicId, { resource_type: 'raw', invalidate: true }); }
      catch (cleanupError) { console.error('Previous invoice cleanup failed:', cleanupError.message); }
    }
    publishOrderUpdate();
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to upload the invoice.' });
  }
});

app.get('/api/shipments/:id/invoice/download', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment.' });
  try {
    const order = await Order.findOne({ _id: req.params.id, status: 'COMPLETED' }).select('invoice location');
    if (!order) return res.status(404).json({ message: 'This shipment is no longer available.' });
    if (!canAccessShipmentInvoice(user, order)) return res.status(403).json({ message: 'You are not allowed to download this invoice.' });
    if (!order.invoice?.url) return res.status(404).json({ message: 'No invoice has been uploaded for this shipment.' });
    const invoiceResponse = await fetch(order.invoice.url);
    if (!invoiceResponse.ok) throw new Error('The invoice file could not be downloaded.');
    const fileName = String(order.invoice.fileName || 'invoice').replace(/[\\/:*?"<>|]/g, '_');
    res.set({ 'Content-Type': invoiceResponse.headers.get('content-type') || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${fileName}"` });
    res.send(Buffer.from(await invoiceResponse.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ message: error.message || 'Unable to download the invoice.' });
  }
});

// Cloudinary raw-file URLs are returned as attachments, which causes browsers
// to download PDFs instead of rendering them in the shipment invoice preview.
app.get('/api/shipments/:id/invoice/view', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid shipment.' });
  try {
    const order = await Order.findOne({ _id: req.params.id, status: 'COMPLETED' }).select('invoice location');
    if (!order) return res.status(404).json({ message: 'This shipment is no longer available.' });
    if (!canAccessShipmentInvoice(user, order)) return res.status(403).json({ message: 'You are not allowed to view this invoice.' });
    if (!order.invoice?.url) return res.status(404).json({ message: 'No invoice has been uploaded for this shipment.' });
    const invoiceResponse = await fetch(order.invoice.url);
    if (!invoiceResponse.ok) throw new Error('The invoice file could not be loaded.');
    const fileName = String(order.invoice.fileName || 'invoice').replace(/[\\/:*?"<>|]/g, '_');
    const lowerFileName = fileName.toLowerCase();
    const previewContentType = lowerFileName.endsWith('.pdf')
      ? 'application/pdf'
      : lowerFileName.endsWith('.png')
        ? 'image/png'
        : lowerFileName.endsWith('.webp')
          ? 'image/webp'
          : lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')
            ? 'image/jpeg'
            : invoiceResponse.headers.get('content-type') || 'application/octet-stream';
    res.set({
      'Content-Type': previewContentType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, no-store'
    });
    res.send(Buffer.from(await invoiceResponse.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ message: error.message || 'Unable to view the invoice.' });
  }
});

const isTodayInSriLanka = (date) => {
  const dateParts = (value) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(value);
  return dateParts(date) === dateParts(new Date());
};
const notifyRecipients = async (recipients, { title, message, type = 'SYSTEM', expiresInDays = 7 }) => {
  const uniqueRecipients = [...new Map(
    recipients.filter((recipient) => recipient?._id).map((recipient) => [String(recipient._id), recipient])
  ).values()];
  if (!uniqueRecipients.length) return;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  await Notification.insertMany(uniqueRecipients.map((recipient) => ({ recipientId: recipient._id, title, message, type, expiresAt })));
  publishNotificationUpdate(uniqueRecipients.map((recipient) => recipient._id));
  void Promise.all(uniqueRecipients.map((recipient) => deliverMessage(recipient, title, message)));
};
const notifyOrderRecipients = (recipients, title, message) => notifyRecipients(recipients, { title, message, type: 'ORDER', expiresInDays: 2 });
const notifyLowStock = async (products, actorId) => {
  const lowStockProducts = products.filter((product) => Number(product.openingStock) <= 10 && product.productCode && product.plant);
  for (const product of lowStockProducts) {
    const recipients = await User.find({
      _id: { $ne: actorId },
      $or: [
        { role: 'SUPER_ADMIN' },
        { role: 'LOCATION_MANAGER', location: product.plant }
      ]
    }).select('_id email contactNumber');
    if (!recipients.length) continue;
    const title = Number(product.openingStock) === 0
      ? `Out of stock: ${product.productCode}`
      : `Low stock: ${product.productCode}`;
    const recentRecipientIds = await Notification.distinct('recipientId', {
      recipientId: { $in: recipients.map((recipient) => recipient._id) },
      title,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    const recentlyNotified = new Set(recentRecipientIds.map(String));
    const pendingRecipients = recipients.filter((recipient) => !recentlyNotified.has(String(recipient._id)));
    const message = `${product.productName} (${product.productCode}) at ${product.plant} has ${Number(product.openingStock).toLocaleString()} pieces remaining.`;
    await notifyRecipients(pendingRecipients, { title, message, type: 'STOCK', expiresInDays: 3 });
  }
};

// Cancelling reverses the original stock deduction in the same transaction.
// A Location Manager may cancel pending orders for their factory; a Sales Rep
// may reverse only their own pending orders created today.
app.post('/api/orders/:id/cancel', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['LOCATION_MANAGER', 'SALES_REP'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to cancel orders.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order.' });

  const dbSession = await mongoose.startSession();
  try {
    let cancelledOrder;
    await dbSession.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(dbSession);
      if (!order || !['PENDING', 'HELD'].includes(order.status)) throw new Error('This pending order is no longer available.');
      if (user.role === 'LOCATION_MANAGER' && order.location !== user.location) throw new Error('This order does not belong to your factory.');
      if (user.role === 'SALES_REP' && (String(order.salesRepId) !== String(user._id) || !isTodayInSriLanka(order.createdAt))) {
        throw new Error('Sales Representatives can reverse only their own orders created today.');
      }
      for (const item of order.items) {
        const restored = await Product.updateOne(
          { _id: item.productId, plant: order.location },
          { $inc: { openingStock: item.quantity } },
          { session: dbSession }
        );
        if (!restored.matchedCount) throw new Error(`Unable to restore stock for ${item.productName}.`);
      }
      order.status = 'CANCELLED';
      order.cancelledAt = new Date();
      order.cancelledBy = user.name;
      cancelledOrder = await order.save({ session: dbSession });
    });
    const changedProducts = await Product.find({ _id: { $in: cancelledOrder.items.map((item) => item.productId) } }).select('_id openingStock updatedAt');
    publishStockUpdate(changedProducts);
    publishOrderUpdate();
    const recipients = user.role === 'SALES_REP'
      ? await User.find({ role: 'LOCATION_MANAGER', location: cancelledOrder.location }).select('_id email contactNumber')
      : await User.find({ _id: cancelledOrder.salesRepId }).select('_id email contactNumber');
    try { await notifyOrderRecipients(recipients, `Order cancelled ${cancelledOrder.orderNumber}`, `${user.name} cancelled ${cancelledOrder.orderNumber}. ${cancelledOrder.totalQuantity} items were restored to stock.`); }
    catch (notificationError) { console.error('Cancellation notification failed:', notificationError.message); }
    res.json(cancelledOrder);
  } catch (error) {
    res.status(error.message === 'This pending order is no longer available.' ? 409 : 400).json({ message: error.message || 'Unable to cancel the order.' });
  } finally {
    await dbSession.endSession();
  }
});

// A hold keeps the order's stock reserved while the location manager resolves
// a damaged or otherwise unavailable item. It can later be resumed or cancelled.
app.post('/api/orders/:id/hold', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'LOCATION_MANAGER') return res.status(403).json({ message: 'Only Location Managers can hold orders.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order.' });

  const productIds = [...new Set((Array.isArray(req.body.productIds) ? req.body.productIds : [req.body.productId]).map(String).filter(Boolean))];
  const reason = String(req.body.reason || '').trim();
  if (!productIds.length || productIds.some((productId) => !mongoose.isValidObjectId(productId))) return res.status(400).json({ message: 'Select at least one affected item.' });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ message: 'Enter a hold reason between 3 and 500 characters.' });

  try {
    const pendingOrder = await Order.findOne({ _id: req.params.id, location: user.location, status: 'PENDING' });
    if (!pendingOrder) return res.status(409).json({ message: 'This pending order is no longer available.' });
    const affectedItems = productIds.map((productId) => pendingOrder.items.find((item) => String(item.productId) === productId));
    if (affectedItems.some((item) => !item)) return res.status(400).json({ message: 'One of the selected items is not part of this order.' });
    const products = await Product.find({ _id: { $in: pendingOrder.items.map((item) => item.productId) } }).select('_id style color size').lean();
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const heldItems = affectedItems.map((item) => {
      const product = productById.get(String(item.productId)) || {};
      return { productId: item.productId, productCode: item.productCode, productName: item.productName, style: item.style || product.style, color: item.color || product.color, size: item.size || product.size, quantity: item.quantity };
    });

    const order = await Order.findOneAndUpdate(
      { _id: pendingOrder._id, status: 'PENDING' },
      { $set: { status: 'HELD', hold: { items: heldItems, reason, heldAt: new Date(), heldBy: user.name } } },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(409).json({ message: 'This pending order is no longer available.' });
    publishOrderUpdate();
    try {
      const recipients = await User.find({ _id: order.salesRepId }).select('_id email contactNumber');
      await notifyOrderRecipients(recipients, `Order on hold ${order.orderNumber}`, `${user.name} placed ${order.orderNumber} on hold for ${heldItems.map((item) => item.productName).join(', ')}: ${reason}`);
    } catch (notificationError) { console.error('Order-hold notification failed:', notificationError.message); }
    const responseOrder = order.toObject();
    responseOrder.items = responseOrder.items.map((item) => ({ ...item, ...(productById.get(String(item.productId)) || {}) }));
    res.json(responseOrder);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to place the order on hold.' });
  }
});

app.post('/api/orders/:id/resume', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'LOCATION_MANAGER') return res.status(403).json({ message: 'Only Location Managers can resume held orders.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order.' });

  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, location: user.location, status: 'HELD' },
      { $set: { status: 'PENDING' }, $unset: { hold: 1 } },
      { new: true }
    );
    if (!order) return res.status(409).json({ message: 'This held order is no longer available.' });
    publishOrderUpdate();
    try {
      const recipients = await User.find({ _id: order.salesRepId }).select('_id email contactNumber');
      await notifyOrderRecipients(recipients, `Order resumed ${order.orderNumber}`, `${user.name} resumed ${order.orderNumber}. It is pending shipment review again.`);
    } catch (notificationError) { console.error('Order-resume notification failed:', notificationError.message); }
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to resume the held order.' });
  }
});

// Marking an order ready to ship finalizes the location manager's review.  The
// stock was already reserved when the order was created, so no stock movement
// is needed here.
app.post('/api/orders/:id/ready-to-ship', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'LOCATION_MANAGER') return res.status(403).json({ message: 'Only Location Managers can prepare orders for shipping.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid order.' });

  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, location: user.location, status: 'PENDING' },
      { $set: { status: 'COMPLETED' } },
      { new: true }
    );
    if (!order) return res.status(409).json({ message: 'This pending order is no longer available.' });
    publishOrderUpdate();
    try {
      const recipients = await User.find({ _id: order.salesRepId }).select('_id email contactNumber');
      await notifyOrderRecipients(recipients, `Order ready to ship ${order.orderNumber}`, `${order.orderNumber} for ${order.customerName} is ready to ship.`);
    } catch (notificationError) { console.error('Ready-to-ship notification failed:', notificationError.message); }
    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to prepare the order for shipping.' });
  }
});

app.get('/api/notifications', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  res.json(await Notification.find({ recipientId: user._id, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(50));
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  res.json(notification);
});

app.post('/api/orders', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  const { customerId, customerBranchId = 'billing', items } = req.body;
  if (!mongoose.isValidObjectId(customerId) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Select a customer and add at least one order item.' });
  }
  if (items.some((item) => !mongoose.isValidObjectId(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
    return res.status(400).json({ message: 'Each order item must have a valid product and quantity.' });
  }

  const dbSession = await mongoose.startSession();
  try {
    let createdOrder;
    await dbSession.withTransaction(async () => {
      const customer = await Customer.findById(customerId).session(dbSession);
      if (!customer) throw new Error('The selected customer no longer exists.');
      const selectedBranch = customerBranchId === 'billing' ? null : customer.branches.id(customerBranchId);
      if (customerBranchId !== 'billing' && !selectedBranch) throw new Error('The selected customer branch no longer exists.');
      const deliveryAddress = selectedBranch?.address || customer.billingAddress;
      const deliveryContact = selectedBranch?.contact || customer.contact || '';
      const requestedItems = await Promise.all(items.map(async (item) => {
        const product = await Product.findById(item.productId).session(dbSession);
        if (!product) throw new Error('One of the selected products no longer exists.');
        const quantity = Number(item.quantity);
        if (product.openingStock < quantity) throw new Error(`${product.productName} has only ${product.openingStock} ${product.unit} available.`);
        const unitPrice = Number(product.sellingPrice);
        return {
          productId: product._id,
          productCode: product.productCode,
          productName: product.productName,
          style: product.style,
          color: product.color,
          size: product.size,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
          plant: product.plant
        };
      }));
      const orderPlants = [...new Set(requestedItems.map((item) => item.plant))];
      if (orderPlants.length !== 1) throw new Error('Products from different factory locations cannot be added to the same order.');
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
      const orderCounter = await Counter.findOneAndUpdate(
        { key: 'SALES_ORDER' },
        { $inc: { value: 1 }, $setOnInsert: { prefix: 'SO-', padding: 6 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession }
      );
      [createdOrder] = await Order.create([{
        orderNumber: formatSalesOrderNumber(orderCounter.value, orderCounter),
        customerId: customer._id,
        customerCode: customer.customerCode,
        customerName: customer.customerName,
        customerPhone: deliveryContact,
        customerAddress: deliveryAddress,
        customerBranchId: selectedBranch ? String(selectedBranch._id) : 'billing',
        customerBranchName: selectedBranch?.branchName || 'Billing address',
        customerTinNo: customer.tinNo || customer.vatNo,
        customerDiscount: customer.discount,
        customerPaymentTerm: customer.paymentTerm,
        salesRepId: user._id,
        salesRepName: user.name,
        location: orderPlants[0],
        items: requestedItems,
        totalQuantity,
        totalAmount
      }], { session: dbSession });
    });
    const changedProducts = await Product.find({
      _id: { $in: createdOrder.items.map((item) => item.productId) }
    }).select('_id productCode productName plant openingStock updatedAt');
    const changedProductById = new Map(changedProducts.map((product) => [String(product._id), product]));
    await StockUpdate.insertMany(createdOrder.items.map((item) => ({ productId: item.productId, productCode: item.productCode, productName: item.productName, quantityAdded: -Number(item.quantity), resultingStock: changedProductById.get(String(item.productId))?.openingStock ?? 0, location: createdOrder.location, managerId: user._id, managerName: user.name, documentNo: createdOrder.orderNumber, transactionType: 'SALE', description: `Sale to ${createdOrder.customerName}` })));
    publishStockUpdate(changedProducts);
    publishOrderUpdate();
    const locationManagers = await User.find({ role: 'LOCATION_MANAGER', location: createdOrder.location }).select('_id email contactNumber');
    try {
      if (locationManagers.length) await notifyOrderRecipients(
        locationManagers,
        `New pending order ${createdOrder.orderNumber}`,
        `${user.name} created ${createdOrder.orderNumber} for ${createdOrder.customerName}. Total: ${createdOrder.totalQuantity} pieces, LKR ${Number(createdOrder.totalAmount).toLocaleString()}.`
      );
    } catch (notificationError) { console.error('New-order notification failed:', notificationError.message); }
    try { await notifyLowStock(changedProducts, user._id); }
    catch (notificationError) { console.error('Low-stock notification failed:', notificationError.message); }
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to create the sales order.' });
  } finally {
    await dbSession.endSession();
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SALES_REP') return res.status(403).json({ message: 'Only Sales Representatives can edit orders.' });
  const { customerId, customerBranchId = 'billing', items } = req.body;
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(customerId) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Select a customer and add at least one order item.' });
  }
  if (items.some((item) => !mongoose.isValidObjectId(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
    return res.status(400).json({ message: 'Each order item must have a valid product and quantity.' });
  }
  const dbSession = await mongoose.startSession();
  try {
    let updatedOrder;
    let changedProductIds = [];
    await dbSession.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(dbSession);
      if (!order || order.status !== 'PENDING' || String(order.salesRepId) !== String(user._id) || !isTodayInSriLanka(order.createdAt)) {
        throw new Error('Only your pending orders created today can be edited.');
      }
      const customer = await Customer.findById(customerId).session(dbSession);
      if (!customer) throw new Error('The selected customer no longer exists.');
      const selectedBranch = customerBranchId === 'billing' ? null : customer.branches.id(customerBranchId);
      if (customerBranchId !== 'billing' && !selectedBranch) throw new Error('The selected customer branch no longer exists.');
      const deliveryAddress = selectedBranch?.address || customer.billingAddress;
      const deliveryContact = selectedBranch?.contact || customer.contact || '';
      changedProductIds = order.items.map((item) => item.productId);
      for (const oldItem of order.items) {
        await Product.updateOne({ _id: oldItem.productId, plant: order.location }, { $inc: { openingStock: oldItem.quantity } }, { session: dbSession });
      }
      const requestedItems = await Promise.all(items.map(async (item) => {
        const product = await Product.findById(item.productId).session(dbSession);
        const quantity = Number(item.quantity);
        if (!product || product.plant !== order.location) throw new Error('Products must belong to the original factory.');
        if (product.openingStock < quantity) throw new Error(`${product.productName} has only ${product.openingStock} ${product.unit} available.`);
        return { productId: product._id, productCode: product.productCode, productName: product.productName, style: product.style, color: product.color, size: product.size, quantity, unitPrice: Number(product.sellingPrice), total: Number(product.sellingPrice) * quantity, plant: product.plant };
      }));
      changedProductIds.push(...requestedItems.map((item) => item.productId));
      for (const item of requestedItems) {
        const result = await Product.updateOne({ _id: item.productId, openingStock: { $gte: item.quantity } }, { $inc: { openingStock: -item.quantity } }, { session: dbSession });
        if (!result.modifiedCount) throw new Error('Product stock changed. Please review the order and try again.');
      }
      order.customerId = customer._id;
      order.customerCode = customer.customerCode;
      order.customerName = customer.customerName;
      order.customerPhone = deliveryContact;
      order.customerAddress = deliveryAddress;
      order.customerBranchId = selectedBranch ? String(selectedBranch._id) : 'billing';
      order.customerBranchName = selectedBranch?.branchName || 'Billing address';
      order.customerTinNo = customer.tinNo || customer.vatNo;
      order.customerDiscount = customer.discount;
      order.customerPaymentTerm = customer.paymentTerm;
      order.items = requestedItems;
      order.totalQuantity = requestedItems.reduce((sum, item) => sum + item.quantity, 0);
      order.totalAmount = requestedItems.reduce((sum, item) => sum + item.total, 0);
      updatedOrder = await order.save({ session: dbSession });
    });
    const changedProducts = await Product.find({ _id: { $in: [...new Set(changedProductIds)] } }).select('_id productCode productName plant openingStock updatedAt');
    publishStockUpdate(changedProducts);
    publishOrderUpdate();
    const locationManagers = await User.find({ role: 'LOCATION_MANAGER', location: updatedOrder.location }).select('_id email contactNumber');
    try { await notifyOrderRecipients(locationManagers, `Order updated ${updatedOrder.orderNumber}`, `${user.name} updated ${updatedOrder.orderNumber} for ${updatedOrder.customerName}. Total: ${updatedOrder.totalQuantity} pieces, LKR ${Number(updatedOrder.totalAmount).toLocaleString()}.`); }
    catch (notificationError) { console.error('Order-update notification failed:', notificationError.message); }
    try { await notifyLowStock(changedProducts, user._id); }
    catch (notificationError) { console.error('Low-stock notification failed:', notificationError.message); }
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to edit the sales order.' });
  } finally {
    await dbSession.endSession();
  }
});

const allowedSidebarPermissions = new Set([
  'Dashboard', 'Inventory', 'Stock Updates', 'GRN', 'PRN', 'Sales Return', 'Sales', 'Customers',
  'Users', 'Locations', 'Roles', 'Stock Update',
  'Create Order', 'Pending Orders', 'Shipment', 'Sales Register', 'GRN Report', 'Stock Balance Report', 'Stock Movement Details', 'Stock Adjustment'
]);
const normalizeSidebarPermissions = (value) => Array.isArray(value)
  ? [...new Set(value.map(String).filter((permission) => allowedSidebarPermissions.has(permission)))]
  : undefined;
const userFields = ['name', 'username', 'email', 'contactNumber', 'location', 'role', 'sidebarPermissions'];
const safeUser = (user) => ({ id: user._id, name: user.name, username: user.username, email: user.email, contactNumber: user.contactNumber, location: user.location, role: user.role, sidebarPermissions: user.sidebarPermissions });
const duplicateUserMessage = (error) => {
  if (error?.keyPattern?.username) return 'Username already exists.';
  if (error?.keyPattern?.email) return 'Email already exists.';
  return 'Username or email already exists.';
};

app.get('/api/users', async (req, res) => {
  const actor = await currentUser(req);
  if (actor?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admin can manage users.' });
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map(safeUser));
});

app.post('/api/users', async (req, res) => {
  const actor = await currentUser(req);
  if (actor?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admin can create users.' });
  const { name, username, password, confirmPassword, role } = req.body;
  if (!name || !username || !password || !role || !req.body.location) return res.status(400).json({ message: 'Name, username, password, role, and location are required.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
  try {
    const data = Object.fromEntries(userFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
    if (data.sidebarPermissions !== undefined) data.sidebarPermissions = normalizeSidebarPermissions(data.sidebarPermissions);
    if (!data.email) delete data.email;
    const user = await User.create({ ...data, password: await bcrypt.hash(password, 12) });
    res.status(201).json(safeUser(user));
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? duplicateUserMessage(error) : error.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  const actor = await currentUser(req);
  if (actor?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admin can edit users.' });
  const updates = Object.fromEntries(userFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
  if (updates.sidebarPermissions !== undefined) updates.sidebarPermissions = normalizeSidebarPermissions(updates.sidebarPermissions);
  if (!updates.email) delete updates.email;
  if (req.body.password) {
    if (req.body.password !== req.body.confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
    updates.password = await bcrypt.hash(req.body.password, 12);
  }
  try {
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(safeUser(user));
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? duplicateUserMessage(error) : error.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  const actor = await currentUser(req);
  if (actor?.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admin can delete users.' });
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

const productFields = ['productCode', 'productName', 'gender', 'categoryCode', 'subCategoryCode', 'subSubCategory', 'supplierCode', 'costPrice', 'sellingPrice'];
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
  await StockUpdate.create({
    productId: product._id,
    productCode: product.productCode,
    productName: product.productName,
    quantityAdded: quantity,
    resultingStock: product.openingStock,
    location: user.location,
    managerId: user._id,
    managerName: user.name
  });
  publishStockUpdate([product]);
  try {
    const superAdmins = await User.find({ role: 'SUPER_ADMIN', _id: { $ne: user._id } }).select('_id email contactNumber');
    await notifyRecipients(superAdmins, {
      title: `Stock updated: ${product.productCode}`,
      message: `${user.name} added ${quantity.toLocaleString()} pieces to ${product.productName} at ${product.plant}. Available stock: ${Number(product.openingStock).toLocaleString()} pieces.`,
      type: 'STOCK'
    });
  } catch (notificationError) { console.error('Stock notification failed:', notificationError.message); }
  res.json(product);
});
app.patch('/api/products/:id/stock', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can correct stock quantities.' });
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ message: 'Enter a whole quantity of zero or more.' });
  const current = await Product.findById(req.params.id);
  if (!current) return res.status(404).json({ message: 'Product not found.' });
  const quantityChange = quantity - Number(current.openingStock || 0);
  const product = await Product.findByIdAndUpdate(req.params.id, { $set: { openingStock: quantity } }, { new: true, runValidators: true });
  if (quantityChange !== 0) await StockUpdate.create({ productId: product._id, productCode: product.productCode, productName: product.productName, quantityAdded: quantityChange, resultingStock: product.openingStock, location: product.plant, managerId: user._id, managerName: user.name });
  publishStockUpdate([product]);
  if (quantityChange !== 0) {
    try {
      const locationManagers = await User.find({ role: 'LOCATION_MANAGER', location: product.plant }).select('_id email contactNumber');
      await notifyRecipients(locationManagers, {
        title: `Stock corrected: ${product.productCode}`,
        message: `${user.name} corrected ${product.productName} stock at ${product.plant} to ${Number(product.openingStock).toLocaleString()} pieces.`,
        type: 'STOCK'
      });
    } catch (notificationError) { console.error('Stock-correction notification failed:', notificationError.message); }
  }
  res.json(product);
});
app.post('/api/stock-adjustments', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN' && !user.sidebarPermissions?.includes('Stock Adjustment')) return res.status(403).json({ message: 'You are not allowed to make stock adjustments.' });
  const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
  const adjustmentType = String(req.body.adjustmentType || '').toUpperCase();
  const remark = String(req.body.remark || '').trim();
  if (!items.length || items.length > 100) return res.status(400).json({ message: 'Add between 1 and 100 adjustment items.' });
  if (!['ADD', 'REDUCE'].includes(adjustmentType)) return res.status(400).json({ message: 'Select Add Stock or Reduce Stock for this adjustment.' });
  if (!remark) return res.status(400).json({ message: 'Enter a common remark for this adjustment.' });
  const session = await mongoose.startSession();
  let changedProducts = [], updates = [];
  try {
    await session.withTransaction(async () => {
      const counter = await Counter.findOneAndUpdate({ key: 'STOCK_ADJUSTMENT' }, { $inc: { value: 1 }, $setOnInsert: { prefix: 'SA-', padding: 8 } }, { new: true, upsert: true, session });
      const documentNo = formatStockAdjustmentNumber(counter.value, counter);
      for (const item of items) {
        const amount = Number(item.quantity);
        if (!item.productId || !Number.isInteger(amount) || amount < 1) throw new Error('Every item needs a product and whole quantity.');
        const filter = adjustmentType === 'REDUCE' ? { _id: item.productId, openingStock: { $gte: amount } } : { _id: item.productId };
        const product = await Product.findOneAndUpdate(filter, { $inc: { openingStock: adjustmentType === 'ADD' ? amount : -amount } }, { new: true, runValidators: true, session });
        if (!product) throw new Error(adjustmentType === 'REDUCE' ? 'Cannot reduce more than the available stock.' : 'Product not found.');
        changedProducts.push(product);
        updates.push({ productId: product._id, productCode: product.productCode, productName: product.productName, quantityAdded: adjustmentType === 'ADD' ? amount : -amount, resultingStock: product.openingStock, location: product.plant, managerId: user._id, managerName: user.name, documentNo, transactionType: 'STOCK ADJUSTMENT', adjustmentType, reason: '', remark, description: `${adjustmentType === 'ADD' ? 'Stock Adjustment - Add' : 'Stock Adjustment - Reduce'} - ${remark}` });
      }
      await StockUpdate.insertMany(updates, { session });
    });
    publishStockUpdate(changedProducts);
    res.status(201).json({ adjusted: updates.length, updates });
  } catch (error) { res.status(400).json({ message: error.message || 'Could not save stock adjustments.' }); }
  finally { await session.endSession(); }
});
app.get('/api/stock-adjustments', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN' && !user.sidebarPermissions?.some((permission) => ['Stock Adjustment', 'Stock Adjustment Report'].includes(permission))) return res.status(403).json({ message: 'You are not allowed to view stock adjustments.' });
  const filter = { transactionType: 'STOCK ADJUSTMENT' };
  if (req.query.from || req.query.to) { filter.createdAt = {}; if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00.000+05:30`); if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999+05:30`); }
  res.json(await StockUpdate.find(filter).sort({ createdAt: -1 }).limit(2000).lean());
});
app.post('/api/products/zero-all-stock', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can reset all stock quantities.' });

  const products = await Product.find({ openingStock: { $gt: 0 } });
  if (!products.length) return res.json({ updated: 0 });

  await Product.bulkWrite(products.map((product) => ({
    updateOne: { filter: { _id: product._id }, update: { $set: { openingStock: 0 } } }
  })));
  const updatedProducts = await Product.find({ _id: { $in: products.map((product) => product._id) } });
  await StockUpdate.insertMany(products.map((product) => ({
    productId: product._id,
    productCode: product.productCode,
    productName: product.productName,
    quantityAdded: -Number(product.openingStock || 0),
    resultingStock: 0,
    location: product.plant,
    managerId: user._id,
    managerName: user.name
  })));
  publishStockUpdate(updatedProducts);
  res.json({ updated: products.length });
});
app.post('/api/products/stock-import', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can import stock quantities.' });

  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ message: 'There are no stock rows to update.' });
  if (rows.length > 5000) return res.status(400).json({ message: 'A maximum of 5,000 stock rows can be updated at once.' });

  const codes = rows.map((row) => String(row.levelCode || '').trim());
  const invalidRow = rows.find((row) => !/^\d{13}$/.test(String(row.levelCode || '').trim()) || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 0);
  if (invalidRow) return res.status(400).json({ message: `Row ${invalidRow.rowNumber || '?'} must have a 13-digit Level Code and a whole Qty of zero or more.` });
  const duplicateCode = codes.find((code, index) => codes.indexOf(code) !== index);
  if (duplicateCode) return res.status(400).json({ message: `Level Code ${duplicateCode} appears more than once in the upload.` });

  const products = await Product.find({ productCode: { $in: codes } });
  const productByCode = new Map(products.map((product) => [product.productCode, product]));
  const missingCode = codes.find((code) => !productByCode.has(code));
  if (missingCode) return res.status(400).json({ message: `Level Code ${missingCode} was not found in Product Master.` });

  const updates = rows.map((row) => {
    const product = productByCode.get(String(row.levelCode).trim());
    return { product, quantity: Number(row.quantity) };
  });
  const changed = updates.filter(({ product, quantity }) => Number(product.openingStock || 0) !== quantity);
  if (changed.length) {
    await Product.bulkWrite(changed.map(({ product, quantity }) => ({ updateOne: { filter: { _id: product._id }, update: { $set: { openingStock: quantity } } } })));
    const updatedProducts = await Product.find({ _id: { $in: changed.map(({ product }) => product._id) } });
    const updatedById = new Map(updatedProducts.map((product) => [String(product._id), product]));
    await StockUpdate.insertMany(changed.map(({ product, quantity }) => {
      const updated = updatedById.get(String(product._id));
      return { productId: updated._id, productCode: updated.productCode, productName: updated.productName, quantityAdded: quantity - Number(product.openingStock || 0), resultingStock: updated.openingStock, location: updated.plant, managerId: user._id, managerName: user.name };
    }));
    publishStockUpdate(updatedProducts);
  }
  res.json({ updated: changed.length, unchanged: rows.length - changed.length });
});
app.get('/api/stock-updates', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can view stock update history.' });
  res.json(await StockUpdate.find().sort({ createdAt: -1 }).limit(500));
});
const formatGrnNumber = (value, counter = {}) => {
  const prefix = counter.prefix ?? 'GRN-';
  const padding = Number(counter.padding || 6);
  return `${prefix}${String(value).padStart(padding, '0')}`;
};
const formatPrnNumber = (value, counter = {}) => `${counter.prefix ?? 'PRN-'}${String(value).padStart(Number(counter.padding || 6), '0')}`;
const formatStockAdjustmentNumber = (value, counter = {}) => `${counter.prefix ?? 'SA-'}${String(value).padStart(Number(counter.padding || 8), '0')}`;
const formatSalesOrderNumber = (value, counter = {}) => {
  const prefix = counter.prefix ?? 'SO-';
  const padding = Number(counter.padding || 6);
  return `${prefix}${String(value).padStart(padding, '0')}`;
};
const formatCustomerNumber = (value, counter = {}) => {
  const prefix = counter.prefix ?? 'CUS-';
  const padding = Number(counter.padding || 6);
  return `${prefix}${String(value).padStart(padding, '0')}`;
};
app.get('/api/stock-adjustments/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the stock-adjustment number series.' });
  const counter = await Counter.findOne({ key: 'STOCK_ADJUSTMENT' }).lean();
  const settings = counter || { value: 0, prefix: 'SA-', padding: 8 };
  res.json({
    prefix: settings.prefix ?? 'SA-',
    padding: Number(settings.padding || 8),
    currentNumber: Number(settings.value || 0) > 0 ? formatStockAdjustmentNumber(settings.value, settings) : null,
    nextNumber: formatStockAdjustmentNumber(Number(settings.value || 0) + 1, settings)
  });
});
app.put('/api/stock-adjustments/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the stock-adjustment number series.' });

  const nextNumber = String(req.body.nextNumber || '').trim().toUpperCase();
  const match = nextNumber.match(/^(.*?)(\d+)$/);
  if (!match || nextNumber.length > 50) return res.status(400).json({ message: 'Enter a pattern ending with numbers, for example SA-00000001.' });
  const [, prefix, digits] = match;
  const startingValue = Number(digits);
  if (!Number.isSafeInteger(startingValue) || startingValue < 1 || digits.length > 12) return res.status(400).json({ message: 'The stock-adjustment starting number must be between 1 and 12 digits.' });

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingNumbers = await StockUpdate.distinct('documentNo', {
    transactionType: 'STOCK ADJUSTMENT',
    documentNo: new RegExp(`^${escapedPrefix}\\d+$`, 'i')
  });
  const highestExisting = existingNumbers.reduce((highest, documentNo) => {
    const suffix = String(documentNo).slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
  }, 0);
  if (startingValue <= highestExisting) return res.status(409).json({ message: `The next number must be greater than the existing ${formatStockAdjustmentNumber(highestExisting, { prefix, padding: digits.length })}.` });

  const counter = await Counter.findOneAndUpdate(
    { key: 'STOCK_ADJUSTMENT' },
    { $set: { value: startingValue - 1, prefix, padding: digits.length } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({
    prefix: counter.prefix,
    padding: counter.padding,
    currentNumber: counter.value > 0 ? formatStockAdjustmentNumber(counter.value, counter) : null,
    nextNumber: formatStockAdjustmentNumber(counter.value + 1, counter)
  });
});
app.get('/api/customers/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the customer number series.' });
  const counter = await Counter.findOne({ key: 'CUSTOMER' }).lean();
  const settings = counter || { value: 0, prefix: 'CUS-', padding: 6 };
  res.json({
    prefix: settings.prefix ?? 'CUS-',
    padding: Number(settings.padding || 6),
    currentNumber: Number(settings.value || 0) > 0 ? formatCustomerNumber(settings.value, settings) : null,
    nextNumber: formatCustomerNumber(Number(settings.value || 0) + 1, settings)
  });
});
app.put('/api/customers/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the customer number series.' });

  const nextNumber = String(req.body.nextNumber || '').trim().toUpperCase();
  const match = nextNumber.match(/^(.*?)(\d+)$/);
  if (!match || nextNumber.length > 50) return res.status(400).json({ message: 'Enter a pattern ending with numbers, for example CUS-000001.' });
  const [, prefix, digits] = match;
  const startingValue = Number(digits);
  if (!Number.isSafeInteger(startingValue) || startingValue < 1 || digits.length > 12) return res.status(400).json({ message: 'The customer starting number must be between 1 and 12 digits.' });

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingNumbers = await Customer.find({ customerCode: new RegExp(`^${escapedPrefix}\\d+$`, 'i') }).select('customerCode').lean();
  const highestExisting = existingNumbers.reduce((highest, customer) => {
    const suffix = String(customer.customerCode).slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
  }, 0);
  if (startingValue <= highestExisting) return res.status(409).json({ message: `The next number must be greater than the existing ${formatCustomerNumber(highestExisting, { prefix, padding: digits.length })}.` });

  const counter = await Counter.findOneAndUpdate(
    { key: 'CUSTOMER' },
    { $set: { value: startingValue - 1, prefix, padding: digits.length } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({
    prefix: counter.prefix,
    padding: counter.padding,
    currentNumber: counter.value > 0 ? formatCustomerNumber(counter.value, counter) : null,
    nextNumber: formatCustomerNumber(counter.value + 1, counter)
  });
});
app.get('/api/customers', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'SALES_REP', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to view customers.' });
  res.json(await Customer.find().sort({ createdAt: -1 }).limit(2000));
});
app.post('/api/customers', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can add customers.' });
  const { customerName, billingAddress, contact = '', tinNo, discount = 0, paymentTerm, branches = [] } = req.body;
  const numericDiscount = Number(discount);
  const allowedPaymentTerms = ['30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS'];
  if (!customerName?.trim() || !billingAddress?.trim()) return res.status(400).json({ message: 'Customer name and billing address are required.' });
  if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) return res.status(400).json({ message: 'Discount must be between 0 and 100.' });
  if (!allowedPaymentTerms.includes(paymentTerm)) return res.status(400).json({ message: 'Select a valid payment term.' });
  if (!Array.isArray(branches) || branches.length > 100 || branches.some((branch) => !branch?.branchName?.trim())) {
    return res.status(400).json({ message: 'Each branch must have a branch name.' });
  }

  const dbSession = await mongoose.startSession();
  try {
    let customer;
    await dbSession.withTransaction(async () => {
      const counter = await Counter.findOneAndUpdate(
        { key: 'CUSTOMER' },
        { $inc: { value: 1 }, $setOnInsert: { prefix: 'CUS-', padding: 6 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession }
      );
      [customer] = await Customer.create([{
        customerCode: formatCustomerNumber(counter.value, counter),
        customerName: customerName.trim(),
        billingAddress: billingAddress.trim(),
        contact: String(contact || '').trim(),
        tinNo: tinNo?.trim() || '',
        discount: numericDiscount,
        paymentTerm,
        branches: branches.map((branch) => ({
          branchName: branch.branchName.trim(),
          address: String(branch.address || '').trim(),
          contact: String(branch.contact || '').trim()
        })),
        createdBy: user.name
      }], { session: dbSession });
    });
    res.status(201).json(customer);
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This customer code already exists.' : error.message || 'Unable to add the customer.' });
  } finally {
    await dbSession.endSession();
  }
});
app.patch('/api/customers/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can update customers.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid customer.' });
  const { customerName, billingAddress, contact = '', tinNo, discount = 0, paymentTerm, branches = [] } = req.body;
  const numericDiscount = Number(discount);
  const allowedPaymentTerms = ['30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS'];
  if (!customerName?.trim() || !billingAddress?.trim()) return res.status(400).json({ message: 'Customer name and billing address are required.' });
  if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) return res.status(400).json({ message: 'Discount must be between 0 and 100.' });
  if (!allowedPaymentTerms.includes(paymentTerm)) return res.status(400).json({ message: 'Select a valid payment term.' });
  if (!Array.isArray(branches) || branches.length > 100 || branches.some((branch) => !branch?.branchName?.trim())) {
    return res.status(400).json({ message: 'Each branch must have a branch name.' });
  }
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, {
      $set: {
        customerName: customerName.trim(),
        billingAddress: billingAddress.trim(),
        contact: String(contact || '').trim(),
        tinNo: tinNo?.trim() || '',
        discount: numericDiscount,
        paymentTerm,
        branches: branches.map((branch) => ({
          branchName: branch.branchName.trim(),
          address: String(branch.address || '').trim(),
          contact: String(branch.contact || '').trim()
        }))
      },
      $unset: { vatNo: 1 }
    }, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: 'This customer no longer exists.' });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to update the customer.' });
  }
});
app.delete('/api/customers/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can delete customers.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid customer.' });
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) return res.status(404).json({ message: 'This customer no longer exists.' });
  res.json({ message: `${customer.customerCode} — ${customer.customerName} was deleted.` });
});
app.get('/api/orders/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the sales-order number series.' });
  const counter = await Counter.findOne({ key: 'SALES_ORDER' }).lean();
  const settings = counter || { value: 0, prefix: 'SO-', padding: 6 };
  res.json({
    prefix: settings.prefix ?? 'SO-',
    padding: Number(settings.padding || 6),
    currentNumber: Number(settings.value || 0) > 0 ? formatSalesOrderNumber(settings.value, settings) : null,
    nextNumber: formatSalesOrderNumber(Number(settings.value || 0) + 1, settings)
  });
});
app.put('/api/orders/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the sales-order number series.' });

  const nextNumber = String(req.body.nextNumber || '').trim().toUpperCase();
  const match = nextNumber.match(/^(.*?)(\d+)$/);
  if (!match || nextNumber.length > 50) return res.status(400).json({ message: 'Enter a pattern ending with numbers, for example SO-000001.' });
  const [, prefix, digits] = match;
  const startingValue = Number(digits);
  if (!Number.isSafeInteger(startingValue) || startingValue < 1 || digits.length > 12) return res.status(400).json({ message: 'The sales-order starting number must be between 1 and 12 digits.' });

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingNumbers = await Order.find({ orderNumber: new RegExp(`^${escapedPrefix}\\d+$`, 'i') }).select('orderNumber').lean();
  const highestExisting = existingNumbers.reduce((highest, order) => {
    const suffix = String(order.orderNumber).slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
  }, 0);
  if (startingValue <= highestExisting) return res.status(409).json({ message: `The next number must be greater than the existing ${formatSalesOrderNumber(highestExisting, { prefix, padding: digits.length })}.` });

  const counter = await Counter.findOneAndUpdate(
    { key: 'SALES_ORDER' },
    { $set: { value: startingValue - 1, prefix, padding: digits.length } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({
    prefix: counter.prefix,
    padding: counter.padding,
    currentNumber: counter.value > 0 ? formatSalesOrderNumber(counter.value, counter) : null,
    nextNumber: formatSalesOrderNumber(counter.value + 1, counter)
  });
});
app.get('/api/grns/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the GRN number series.' });
  const counter = await Counter.findOne({ key: 'GRN' }).lean();
  const settings = counter || { value: 0, prefix: 'GRN-', padding: 6 };
  res.json({
    prefix: settings.prefix ?? 'GRN-',
    padding: Number(settings.padding || 6),
    currentNumber: Number(settings.value || 0) > 0 ? formatGrnNumber(settings.value, settings) : null,
    nextNumber: formatGrnNumber(Number(settings.value || 0) + 1, settings)
  });
});
app.put('/api/grns/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the GRN number series.' });

  const nextNumber = String(req.body.nextNumber || '').trim().toUpperCase();
  const match = nextNumber.match(/^(.*?)(\d+)$/);
  if (!match || nextNumber.length > 50) return res.status(400).json({ message: 'Enter a pattern ending with numbers, for example GRN-000001.' });
  const [, prefix, digits] = match;
  const startingValue = Number(digits);
  if (!Number.isSafeInteger(startingValue) || startingValue < 1 || digits.length > 12) return res.status(400).json({ message: 'The GRN starting number must be between 1 and 12 digits.' });

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingNumbers = await GoodsReceivedNote.find({ grnNumber: new RegExp(`^${escapedPrefix}\\d+$`, 'i') }).select('grnNumber').lean();
  const highestExisting = existingNumbers.reduce((highest, grn) => {
    const suffix = String(grn.grnNumber).slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
  }, 0);
  if (startingValue <= highestExisting) return res.status(409).json({ message: `The next number must be greater than the existing ${formatGrnNumber(highestExisting, { prefix, padding: digits.length })}.` });

  const counter = await Counter.findOneAndUpdate(
    { key: 'GRN' },
    { $set: { value: startingValue - 1, prefix, padding: digits.length } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({
    prefix: counter.prefix,
    padding: counter.padding,
    currentNumber: counter.value > 0 ? formatGrnNumber(counter.value, counter) : null,
    nextNumber: formatGrnNumber(counter.value + 1, counter)
  });
});
app.get('/api/prns/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the PRN number series.' });
  const counter = await Counter.findOne({ key: 'PRN' }).lean();
  const settings = counter || { value: 0, prefix: 'PRN-', padding: 6 };
  res.json({ prefix: settings.prefix ?? 'PRN-', padding: Number(settings.padding || 6), currentNumber: Number(settings.value || 0) > 0 ? formatPrnNumber(settings.value, settings) : null, nextNumber: formatPrnNumber(Number(settings.value || 0) + 1, settings) });
});
app.put('/api/prns/number-series', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can configure the PRN number series.' });
  const nextNumber = String(req.body.nextNumber || '').trim().toUpperCase(), match = nextNumber.match(/^(.*?)(\d+)$/);
  if (!match || nextNumber.length > 50) return res.status(400).json({ message: 'Enter a pattern ending with numbers, for example PRN-000001.' });
  const [, prefix, digits] = match, startingValue = Number(digits);
  if (!Number.isSafeInteger(startingValue) || startingValue < 1 || digits.length > 12) return res.status(400).json({ message: 'The PRN starting number must be between 1 and 12 digits.' });
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingNumbers = await PurchaseReturnNote.find({ prnNumber: new RegExp(`^${escapedPrefix}\\d+$`, 'i') }).select('prnNumber').lean();
  const highestExisting = existingNumbers.reduce((highest, prn) => { const suffix = String(prn.prnNumber).slice(prefix.length); return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest; }, 0);
  if (startingValue <= highestExisting) return res.status(409).json({ message: `The next number must be greater than the existing ${formatPrnNumber(highestExisting, { prefix, padding: digits.length })}.` });
  const counter = await Counter.findOneAndUpdate({ key: 'PRN' }, { $set: { value: startingValue - 1, prefix, padding: digits.length } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  res.json({ prefix: counter.prefix, padding: counter.padding, currentNumber: counter.value > 0 ? formatPrnNumber(counter.value, counter) : null, nextNumber: formatPrnNumber(counter.value + 1, counter) });
});
app.get('/api/grns', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to view GRN reports.' });

  const filter = user.role === 'LOCATION_MANAGER' ? { location: user.location } : {};
  const { from, to } = req.query;
  if (from || to) {
    filter.grnDate = {};
    if (from) {
      const fromDate = new Date(`${from}T00:00:00.000Z`);
      if (Number.isNaN(fromDate.getTime())) return res.status(400).json({ message: 'Invalid from date.' });
      filter.grnDate.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(`${to}T23:59:59.999Z`);
      if (Number.isNaN(toDate.getTime())) return res.status(400).json({ message: 'Invalid to date.' });
      filter.grnDate.$lte = toDate;
    }
  }

  res.json(await GoodsReceivedNote.find(filter).sort({ grnDate: -1, createdAt: -1 }).lean());
});
app.get('/api/grns/next-number', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to create GRNs.' });
  const counter = await Counter.findOne({ key: 'GRN' });
  res.json({ grnNumber: formatGrnNumber((counter?.value || 0) + 1, counter || {}) });
});
app.post('/api/grns', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to create GRNs.' });
  const { supplierCode, supplierName, remarks = '', grnDate, location, items } = req.body;
  if (!supplierCode?.trim() || !supplierName?.trim() || !grnDate || !location?.trim() || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Supplier, GRN date, location, and at least one item are required.' });
  if (user.role === 'LOCATION_MANAGER' && location !== user.location) return res.status(403).json({ message: 'Location Managers can create GRNs only for their own location.' });
  if (items.some((item) => !mongoose.isValidObjectId(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.costPrice) < 0 || Number(item.sellingPrice) < 0)) return res.status(400).json({ message: 'Each item needs a valid product, quantity, and prices.' });
  const dbSession = await mongoose.startSession();
  try {
    let grn;
    let changedProducts = [];
    await dbSession.withTransaction(async () => {
      const counter = await Counter.findOneAndUpdate({ key: 'GRN' }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession });
      const grnItems = [];
      for (const item of items) {
        const product = await Product.findOne({ _id: item.productId, plant: location }).session(dbSession);
        if (!product) throw new Error('One of the selected products does not belong to this location.');
        const quantity = Number(item.quantity), costPrice = Number(item.costPrice), sellingPrice = Number(item.sellingPrice);
        const updated = await Product.findByIdAndUpdate(
          product._id,
          { $inc: { openingStock: quantity } },
          { new: true, runValidators: true, session: dbSession }
        );
        changedProducts.push(updated);
        grnItems.push({ productId: product._id, productCode: product.productCode, productName: product.productName, quantity, costPrice, sellingPrice, amount: quantity * costPrice });
      }
      const totalQuantity = grnItems.reduce((total, item) => total + item.quantity, 0);
      const totalAmount = grnItems.reduce((total, item) => total + item.amount, 0);
      [grn] = await GoodsReceivedNote.create([{ grnNumber: formatGrnNumber(counter.value, counter), supplierCode: supplierCode.trim(), supplierName: supplierName.trim(), remarks: remarks.trim(), grnDate: new Date(grnDate), location, createdById: user._id, createdByName: user.name, items: grnItems, totalQuantity, totalAmount }], { session: dbSession });
      await StockUpdate.insertMany(grnItems.map((item, index) => ({ productId: item.productId, productCode: item.productCode, productName: item.productName, quantityAdded: item.quantity, resultingStock: changedProducts[index].openingStock, location, managerId: user._id, managerName: user.name, documentNo: grn.grnNumber, transactionType: 'GRN', description: `Goods received from ${supplierName}` })), { session: dbSession });
    });
    publishStockUpdate(changedProducts);
    try {
      const recipients = user.role === 'LOCATION_MANAGER'
        ? await User.find({ role: 'SUPER_ADMIN' }).select('_id email contactNumber')
        : await User.find({ role: 'LOCATION_MANAGER', location }).select('_id email contactNumber');
      await notifyRecipients(recipients.filter((recipient) => String(recipient._id) !== String(user._id)), {
        title: `GRN saved: ${grn.grnNumber}`,
        message: `${user.name} saved ${grn.grnNumber} at ${location}. Received ${Number(grn.totalQuantity).toLocaleString()} pieces worth LKR ${Number(grn.totalAmount).toLocaleString()}.`,
        type: 'GRN'
      });
    } catch (notificationError) { console.error('GRN notification failed:', notificationError.message); }
    res.status(201).json({
      ...grn.toObject(),
      updatedProducts: changedProducts.map((product) => ({
        productId: String(product._id),
        openingStock: product.openingStock
      }))
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to save GRN.' });
  } finally { await dbSession.endSession(); }
});
app.get('/api/prns/next-number', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to create PRNs.' });
  const counter = await Counter.findOne({ key: 'PRN' });
  res.json({ prnNumber: formatPrnNumber((counter?.value || 0) + 1, counter || {}) });
});
app.get('/api/prns', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to view PRNs.' });
  const filter = user.role === 'LOCATION_MANAGER' ? { location: user.location } : {};
  res.json(await PurchaseReturnNote.find(filter).sort({ prnDate: -1, createdAt: -1 }).lean());
});
app.post('/api/prns', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to create PRNs.' });
  const { supplierCode, supplierName, grnNumber = '', prnDate, location, remarks = '', items } = req.body;
  if (!supplierCode?.trim() || !supplierName?.trim() || !prnDate || !location?.trim() || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Supplier, PRN date, location, and at least one item are required.' });
  if (user.role === 'LOCATION_MANAGER' && location !== user.location) return res.status(403).json({ message: 'Location Managers can create PRNs only for their own location.' });
  const dbSession = await mongoose.startSession();
  try {
    let prn; const changedProducts = [];
    await dbSession.withTransaction(async () => {
      const counter = await Counter.findOneAndUpdate({ key: 'PRN' }, { $inc: { value: 1 }, $setOnInsert: { prefix: 'PRN-', padding: 6 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession });
      const prnItems = [];
      for (const item of items) {
        if (!mongoose.isValidObjectId(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) throw new Error('Each item needs a valid product and whole return quantity.');
        const product = await Product.findOne({ _id: item.productId, plant: location }).session(dbSession);
        if (!product) throw new Error('One of the selected products does not belong to this location.');
        const quantity = Number(item.quantity); if (Number(product.openingStock || 0) < quantity) throw new Error(`${product.productCode} does not have enough available stock.`);
        const costPrice = Number(product.costPrice || 0);
        const updated = await Product.findByIdAndUpdate(product._id, { $inc: { openingStock: -quantity } }, { new: true, runValidators: true, session: dbSession });
        changedProducts.push(updated); prnItems.push({ productId: product._id, productCode: product.productCode, productName: product.productName, quantity, costPrice, amount: quantity * costPrice, reason: String(item.reason || '').trim() });
      }
      const totalQuantity = prnItems.reduce((sum, item) => sum + item.quantity, 0), totalAmount = prnItems.reduce((sum, item) => sum + item.amount, 0);
      [prn] = await PurchaseReturnNote.create([{ prnNumber: formatPrnNumber(counter.value, counter), grnNumber: String(grnNumber).trim(), supplierCode: supplierCode.trim(), supplierName: supplierName.trim(), prnDate: new Date(prnDate), location, remarks: String(remarks).trim(), createdById: user._id, createdByName: user.name, items: prnItems, totalQuantity, totalAmount }], { session: dbSession });
      await StockUpdate.insertMany(prnItems.map((item, index) => ({ productId: item.productId, productCode: item.productCode, productName: item.productName, quantityAdded: -item.quantity, resultingStock: changedProducts[index].openingStock, location, managerId: user._id, managerName: user.name, documentNo: prn.prnNumber, transactionType: 'PRN', description: `Purchase return to ${supplierName}` })) , { session: dbSession });
    });
    publishStockUpdate(changedProducts);
    res.status(201).json({ ...prn.toObject(), updatedProducts: changedProducts.map((product) => ({ productId: String(product._id), openingStock: product.openingStock })) });
  } catch (error) { res.status(400).json({ message: error.message || 'Unable to save PRN.' }); } finally { await dbSession.endSession(); }
});
app.post('/api/prns/:id/reverse', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to reverse PRNs.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid PRN.' });
  const reversalReason = String(req.body.reason || '').trim();
  if (reversalReason.length < 3 || reversalReason.length > 500) return res.status(400).json({ message: 'Enter a reversal reason between 3 and 500 characters.' });
  const dbSession = await mongoose.startSession();
  try {
    let prn; const changedProducts = [];
    await dbSession.withTransaction(async () => {
      prn = await PurchaseReturnNote.findById(req.params.id).session(dbSession);
      if (!prn) throw new Error('PRN not found.');
      if (user.role === 'LOCATION_MANAGER' && prn.location !== user.location) throw new Error('You can reverse PRNs only for your own location.');
      if (prn.status === 'REVERSED') throw new Error('This PRN has already been reversed.');
      for (const item of prn.items) {
        const updated = await Product.findOneAndUpdate({ _id: item.productId, plant: prn.location }, { $inc: { openingStock: Number(item.quantity) } }, { new: true, session: dbSession });
        if (!updated) throw new Error(`Product ${item.productCode} is no longer available at this location.`);
        changedProducts.push(updated);
      }
      prn.status = 'REVERSED'; prn.reversedAt = new Date(); prn.reversedById = user._id; prn.reversedByName = user.name; prn.reversalReason = reversalReason;
      await prn.save({ session: dbSession });
      await StockUpdate.insertMany(prn.items.map((item, index) => ({ productId: item.productId, productCode: item.productCode, productName: item.productName, quantityAdded: Number(item.quantity), resultingStock: changedProducts[index].openingStock, location: prn.location, managerId: user._id, managerName: user.name })), { session: dbSession });
    });
    publishStockUpdate(changedProducts);
    res.json(prn);
  } catch (error) { res.status(400).json({ message: error.message || 'Unable to reverse PRN.' }); } finally { await dbSession.endSession(); }
});
app.put('/api/prns/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user.role)) return res.status(403).json({ message: 'You are not allowed to update PRNs.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid PRN.' });
  const { supplierCode, supplierName, grnNumber = '', prnDate, location, remarks = '', items } = req.body;
  if (!supplierCode?.trim() || !supplierName?.trim() || !prnDate || !location?.trim() || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Supplier, PRN date, location, and at least one item are required.' });
  const dbSession = await mongoose.startSession();
  try {
    let prn; const changedProducts = [];
    await dbSession.withTransaction(async () => {
      prn = await PurchaseReturnNote.findById(req.params.id).session(dbSession);
      if (!prn) throw new Error('PRN not found.');
      if (prn.status === 'REVERSED') throw new Error('A reversed PRN cannot be edited.');
      if (user.role === 'LOCATION_MANAGER' && prn.location !== user.location) throw new Error('You can update PRNs only for your own location.');
      if (location !== prn.location) throw new Error('Reverse this PRN and create a new one to use a different location.');
      const quantities = new Map(prn.items.map((item) => [String(item.productId), Number(item.quantity)]));
      for (const item of items) { if (!mongoose.isValidObjectId(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) throw new Error('Each item needs a valid product and whole return quantity.'); quantities.set(String(item.productId), -Number(item.quantity) + (quantities.get(String(item.productId)) || 0)); }
      const productIds = [...quantities.keys()]; const products = await Product.find({ _id: { $in: productIds }, plant: location }).session(dbSession);
      if (products.length !== productIds.length) throw new Error('One of the selected products does not belong to this location.');
      for (const product of products) { const adjustment = quantities.get(String(product._id)) || 0; if (Number(product.openingStock || 0) + adjustment < 0) throw new Error(`${product.productCode} does not have enough available stock.`); }
      const productById = new Map(products.map((product) => [String(product._id), product]));
      const prnItems = items.map((item) => { const product = productById.get(String(item.productId)); const quantity = Number(item.quantity), costPrice = Number(product.costPrice || 0); return { productId: product._id, productCode: product.productCode, productName: product.productName, quantity, costPrice, amount: quantity * costPrice, reason: String(item.reason || '').trim() }; });
      for (const product of products) { const adjustment = quantities.get(String(product._id)) || 0; if (!adjustment) continue; changedProducts.push(await Product.findByIdAndUpdate(product._id, { $inc: { openingStock: adjustment } }, { new: true, session: dbSession })); }
      prn.supplierCode = supplierCode.trim(); prn.supplierName = supplierName.trim(); prn.grnNumber = String(grnNumber).trim(); prn.prnDate = new Date(prnDate); prn.remarks = String(remarks).trim(); prn.items = prnItems; prn.totalQuantity = prnItems.reduce((sum, item) => sum + item.quantity, 0); prn.totalAmount = prnItems.reduce((sum, item) => sum + item.amount, 0); await prn.save({ session: dbSession });
      await StockUpdate.insertMany(changedProducts.map((product) => ({ productId: product._id, productCode: product.productCode, productName: product.productName, quantityAdded: quantities.get(String(product._id)), resultingStock: product.openingStock, location, managerId: user._id, managerName: user.name })), { session: dbSession });
    });
    publishStockUpdate(changedProducts); res.json(prn);
  } catch (error) { res.status(400).json({ message: error.message || 'Unable to update PRN.' }); } finally { await dbSession.endSession(); }
});

const formatSalesReturnNumber = (value, counter = {}) => `${counter.prefix ?? 'SRN-'}${String(value).padStart(Number(counter.padding || 6), '0')}`;
const canManageSalesReturns = (user) => ['SUPER_ADMIN', 'LOCATION_MANAGER'].includes(user?.role);

app.get('/api/sales-returns/next-number', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!canManageSalesReturns(user)) return res.status(403).json({ message: 'You are not allowed to create sales returns.' });
  const counter = await Counter.findOne({ key: 'SALES_RETURN' });
  res.json({ returnNumber: formatSalesReturnNumber((counter?.value || 0) + 1, counter || {}) });
});
app.get('/api/sales-returns/invoices', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!canManageSalesReturns(user)) return res.status(403).json({ message: 'You are not allowed to view invoices.' });
  const filter = { status: 'COMPLETED', ...(user.role === 'LOCATION_MANAGER' ? { location: user.location } : {}) };
  res.json(await Order.find(filter).select('orderNumber customerName location items totalQuantity totalAmount createdAt').sort({ createdAt: -1 }).limit(500).lean());
});
app.get('/api/sales-returns', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!canManageSalesReturns(user)) return res.status(403).json({ message: 'You are not allowed to view sales returns.' });
  const filter = user.role === 'LOCATION_MANAGER' ? { location: user.location } : {};
  res.json(await SalesReturn.find(filter).sort({ returnDate: -1, createdAt: -1 }).limit(1000).lean());
});
app.post('/api/sales-returns', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!canManageSalesReturns(user)) return res.status(403).json({ message: 'You are not allowed to create sales returns.' });
  const { sourceType, invoiceOrderId, returnDate, location, remarks = '', items } = req.body;
  if (!['INVOICE', 'MANUAL'].includes(sourceType) || !returnDate || !location?.trim() || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Return type, date, location, and at least one item are required.' });
  if (sourceType === 'INVOICE' && !mongoose.isValidObjectId(invoiceOrderId)) return res.status(400).json({ message: 'Select an invoice to create an invoice return.' });
  if (user.role === 'LOCATION_MANAGER' && location !== user.location) return res.status(403).json({ message: 'Location Managers can create returns only for their own location.' });
  const dbSession = await mongoose.startSession();
  try {
    let salesReturn; const changedProducts = [];
    await dbSession.withTransaction(async () => {
      let invoice = null;
      if (sourceType === 'INVOICE') {
        invoice = await Order.findOne({ _id: invoiceOrderId, status: 'COMPLETED', location }).session(dbSession);
        if (!invoice) throw new Error('The selected invoice is not available for this location.');
      }
      const productIds = [...new Set(items.map((item) => String(item.productId)))];
      if (productIds.some((id) => !mongoose.isValidObjectId(id))) throw new Error('One or more products are invalid.');
      const products = await Product.find({ _id: { $in: productIds }, plant: location }).session(dbSession);
      if (products.length !== productIds.length) throw new Error('Every returned product must belong to the selected location.');
      const productById = new Map(products.map((product) => [String(product._id), product]));
      const invoiceItems = new Map((invoice?.items || []).map((item) => [String(item.productId), item]));
      const priorReturns = invoice ? await SalesReturn.find({ invoiceOrderId: invoice._id, status: 'POSTED' }).session(dbSession) : [];
      const returnedByProduct = new Map();
      priorReturns.flatMap((record) => record.items).forEach((item) => returnedByProduct.set(String(item.productId), (returnedByProduct.get(String(item.productId)) || 0) + Number(item.quantity)));
      const returnItems = [];
      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Return quantities must be whole numbers of at least 1.');
        const product = productById.get(String(item.productId));
        const invoiceItem = invoiceItems.get(String(item.productId));
        if (invoice && !invoiceItem) throw new Error(`${product.productCode} was not sold on the selected invoice.`);
        if (invoice && quantity + (returnedByProduct.get(String(product._id)) || 0) > Number(invoiceItem.quantity)) throw new Error(`${product.productCode} exceeds the remaining returnable invoice quantity.`);
        const unitPrice = invoiceItem ? Number(invoiceItem.unitPrice) : Number(product.sellingPrice || 0);
        returnItems.push({ productId: product._id, productCode: product.productCode, productName: product.productName, quantity, unitPrice, amount: quantity * unitPrice, reason: String(item.reason || '').trim() });
        const updated = await Product.findByIdAndUpdate(product._id, { $inc: { openingStock: quantity } }, { new: true, session: dbSession });
        changedProducts.push(updated);
      }
      const counter = await Counter.findOneAndUpdate({ key: 'SALES_RETURN' }, { $inc: { value: 1 }, $setOnInsert: { prefix: 'SRN-', padding: 6 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession });
      const totalQuantity = returnItems.reduce((sum, item) => sum + item.quantity, 0), totalAmount = returnItems.reduce((sum, item) => sum + item.amount, 0);
      [salesReturn] = await SalesReturn.create([{ returnNumber: formatSalesReturnNumber(counter.value, counter), returnDate: new Date(returnDate), sourceType, invoiceOrderId: invoice?._id || null, invoiceNumber: invoice?.orderNumber || '', customerName: invoice?.customerName || String(req.body.customerName || '').trim(), location, remarks: String(remarks).trim(), createdById: user._id, createdByName: user.name, items: returnItems, totalQuantity, totalAmount }], { session: dbSession });
      await StockUpdate.insertMany(returnItems.map((item, index) => ({ productId: item.productId, productCode: item.productCode, productName: item.productName, quantityAdded: item.quantity, resultingStock: changedProducts[index].openingStock, location, managerId: user._id, managerName: user.name, documentNo: salesReturn.returnNumber, transactionType: 'SALES RETURN', description: salesReturn.invoiceNumber ? `Return against ${salesReturn.invoiceNumber}` : 'Manual sales return' })), { session: dbSession });
    });
    publishStockUpdate(changedProducts); publishOrderUpdate(); res.status(201).json(salesReturn);
  } catch (error) { res.status(400).json({ message: error.message || 'Unable to save sales return.' }); } finally { await dbSession.endSession(); }
});
app.post('/api/sales-returns/:id/reverse', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Only Super Admins can reverse sales returns.' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid sales return.' });
  const reversalReason = String(req.body.reason || '').trim();
  if (!reversalReason) return res.status(400).json({ message: 'Enter a reason for reversing this sales return.' });
  const dbSession = await mongoose.startSession();
  try {
    let salesReturn; const changedProducts = [];
    await dbSession.withTransaction(async () => {
      salesReturn = await SalesReturn.findById(req.params.id).session(dbSession);
      if (!salesReturn) throw new Error('Sales return not found.');
      if (salesReturn.status === 'REVERSED') throw new Error('This sales return has already been reversed.');
      for (const item of salesReturn.items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.productId, plant: salesReturn.location, openingStock: { $gte: Number(item.quantity) } },
          { $inc: { openingStock: -Number(item.quantity) } },
          { new: true, session: dbSession }
        );
        if (!updated) throw new Error(`${item.productCode} does not have enough available stock to reverse this return.`);
        changedProducts.push(updated);
      }
      salesReturn.status = 'REVERSED'; salesReturn.reversedAt = new Date(); salesReturn.reversedByName = user.name; salesReturn.reversalReason = reversalReason;
      await salesReturn.save({ session: dbSession });
      await StockUpdate.insertMany(salesReturn.items.map((item, index) => ({ productId: item.productId, productCode: item.productCode, productName: item.productName, quantityAdded: -Number(item.quantity), resultingStock: changedProducts[index].openingStock, location: salesReturn.location, managerId: user._id, managerName: user.name })), { session: dbSession });
    });
    publishStockUpdate(changedProducts); res.json(salesReturn);
  } catch (error) { res.status(400).json({ message: error.message || 'Unable to reverse sales return.' }); } finally { await dbSession.endSession(); }
});

app.post('/api/products', async (req, res) => {
  const data = Object.fromEntries(productFields.map((field) => [field, req.body[field]]));
  data.plant = INVENTORY_LOCATION;
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
  const priceFields = ['costPrice', 'sellingPrice'];
  const requiredTextFields = ['productName', 'gender', 'categoryCode', 'subCategoryCode', 'supplierCode'];
  const textFields = productFields.filter((field) => !priceFields.includes(field));

  rows.forEach((row, index) => {
    const rowNumber = Number(row.rowNumber) || index + 2;
    const data = Object.fromEntries(productFields.map((field) => [field, row[field]]));
    textFields.forEach((field) => { data[field] = String(data[field] ?? '').trim().toUpperCase(); });
    data.gender = normalizeGender(data.gender);
    data.supplierCode = data.supplierCode || 'JOCKEY';

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
      plant: INVENTORY_LOCATION,
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
  await connectDatabase();
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

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the other backend process or choose a different PORT in Backend/.env.`);
    } else {
      console.error('Unable to start server:', error.message);
    }
    process.exit(1);
  });
}

export default app;
