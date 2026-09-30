import mongoose from 'mongoose';

const productImageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, required: true, trim: true }
});

const productSchema = new mongoose.Schema({
  plant: { type: String, default: 'Head Office', immutable: true },
  productCode: { type: String, required: true, unique: true, sparse: true, trim: true, match: [/^\d{13}$/, 'Product Code must contain exactly 13 numbers.'] },
  referenceCode1: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  style: { type: String, required: true, trim: true, uppercase: true },
  packingQuantity: { type: String, required: true, trim: true, match: [/^\d{2}$/, 'Packing Quantity must contain 2 numbers.'] },
  cartonQuantity: { type: String, required: true, trim: true, match: [/^\d{2}$/, 'Carton Quantity must contain 2 numbers.'] },
  color: { type: String, required: true, trim: true, uppercase: true },
  size: { type: String, required: true, trim: true, uppercase: true },
  gender: { type: String, required: true, uppercase: true, enum: ['MENS', 'WOMENS', 'BOYS', 'GIRLS', 'UNISEX'] },
  categoryCode: { type: String, required: true, trim: true },
  subCategoryCode: { type: String, required: true, trim: true },
  subSubCategory: { type: String, trim: true, default: '' },
  supplierCode: { type: String, required: true, trim: true, uppercase: true, default: 'JOCKEY' },
  costPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  imageUrl: { type: String, trim: true, default: '' },
  imagePublicId: { type: String, trim: true, default: '', select: false },
  images: { type: [productImageSchema], default: [] },
  openingStock: { type: Number, min: 0, default: 0 },
  unit: { type: String, trim: true, default: 'Pieces' },
  // Legacy fields are retained so existing development records remain readable.
  sku: { type: String, trim: true },
  name: { type: String, trim: true },
  category: { type: String, trim: true }
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
