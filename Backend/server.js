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
import Customer from './models/Customer.js';

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
        user: { id: user._id, name: user.name, username: user.username, email: user.email, location: user.location, role: user.role },
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
      ? { location: user.location, status: 'PENDING' }
      : { salesRepId: user._id, status: 'PENDING' };
  if (user.role === 'SUPER_ADMIN') {
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000+05:30`);
      if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
    }
  }
  res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(user.role === 'SUPER_ADMIN' ? 5000 : 200));
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
  res.json(await Order.find(filter).sort({ updatedAt: -1 }).limit(200));
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
      if (!order || order.status !== 'PENDING') throw new Error('This pending order is no longer available.');
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
        customerVatNo: customer.vatNo,
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
        return { productId: product._id, productCode: product.productCode, productName: product.productName, quantity, unitPrice: Number(product.sellingPrice), total: Number(product.sellingPrice) * quantity, plant: product.plant };
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
      order.customerVatNo = customer.vatNo;
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

const userFields = ['name', 'username', 'email', 'contactNumber', 'location', 'role'];
const safeUser = (user) => ({ id: user._id, name: user.name, username: user.username, email: user.email, contactNumber: user.contactNumber, location: user.location, role: user.role });
const duplicateUserMessage = (error) => {
  if (error?.keyPattern?.username) return 'Username already exists.';
  if (error?.keyPattern?.email) return 'Email already exists.';
  return 'Username or email already exists.';
};

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
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? duplicateUserMessage(error) : error.message });
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
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? duplicateUserMessage(error) : error.message }); }
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
  const { customerName, billingAddress, contact = '', vatNo, discount = 0, paymentTerm, branches = [] } = req.body;
  const numericDiscount = Number(discount);
  const allowedPaymentTerms = ['30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS'];
  if (!customerName?.trim() || !billingAddress?.trim() || !vatNo?.trim()) return res.status(400).json({ message: 'Customer name, billing address, and VAT number are required.' });
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
        vatNo: vatNo.trim(),
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
  const { customerName, billingAddress, contact = '', vatNo, discount = 0, paymentTerm, branches = [] } = req.body;
  const numericDiscount = Number(discount);
  const allowedPaymentTerms = ['30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS'];
  if (!customerName?.trim() || !billingAddress?.trim() || !vatNo?.trim()) return res.status(400).json({ message: 'Customer name, billing address, and VAT number are required.' });
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
        vatNo: vatNo.trim(),
        discount: numericDiscount,
        paymentTerm,
        branches: branches.map((branch) => ({
          branchName: branch.branchName.trim(),
          address: String(branch.address || '').trim(),
          contact: String(branch.contact || '').trim()
        }))
      }
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
      await StockUpdate.insertMany(grnItems.map((item, index) => ({ productId: item.productId, productCode: item.productCode, productName: item.productName, quantityAdded: item.quantity, resultingStock: changedProducts[index].openingStock, location, managerId: user._id, managerName: user.name })), { session: dbSession });
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
