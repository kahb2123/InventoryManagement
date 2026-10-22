import { Router } from 'express';
import { body, param } from 'express-validator';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Unit, UNIT_CATALOG, UNIT_TYPES } from '../models/Unit.js';
import { ProductStock } from '../models/ProductStock.js';
import { Branch } from '../models/Branch.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { audit } from '../services/audit.service.js';
import { nextNumber } from '../models/Counter.js';
import { getSettings } from '../services/settings.service.js';

const router = Router();
router.use(requireAuth);

const isValidId = (id) => mongoose.isValidObjectId(id);

// ---------------------------------------------------------------- Categories
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    const categories = await Category.find(filter).sort({ name: 1 });
    const counts = await Product.aggregate([
      { $match: { category: { $in: categories.map((c) => c._id) } } },
      { $group: { _id: '$category', productCount: { $sum: 1 }, stockValue: { $sum: '$totalStockValue' } } },
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c]));
    res.json({
      success: true,
      data: categories.map((c) => ({
        ...c.toObject(),
        productCount: map.get(String(c._id))?.productCount || 0,
        stockValue: map.get(String(c._id))?.stockValue || 0,
      })),
    });
  })
);

router.post(
  '/categories',
  requirePermission('categories.manage'),
  body('name').trim().notEmpty().withMessage('Category name is required'),
  validate,
  asyncHandler(async (req, res) => {
    const { name, nameAm, description, color } = req.body;
    const existing = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) throw ApiError.conflict('A category with this name already exists', 'DUPLICATE_CATEGORY');
    const category = await Category.create({ name, nameAm: nameAm || '', description: description || '', color: color || '#1769FF' });
    await audit(req, { action: 'category.created', entity: 'Category', entityId: category._id, entityLabel: category.name });
    res.status(201).json({ success: true, data: category });
  })
);

router.patch(
  '/categories/:id',
  requirePermission('categories.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw ApiError.notFound('Category not found');
    const { name, nameAm, description, color, active } = req.body;
    if (name !== undefined) category.name = name;
    if (nameAm !== undefined) category.nameAm = nameAm;
    if (description !== undefined) category.description = description;
    if (color !== undefined) category.color = color;
    if (active !== undefined) category.active = active;
    await category.save();
    res.json({ success: true, data: category });
  })
);

router.delete(
  '/categories/:id',
  requirePermission('categories.manage'),
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) throw ApiError.notFound('Category not found');
    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      throw ApiError.conflict(
        `Cannot delete a category that still has ${productCount} product(s). Reassign them first.`,
        'CATEGORY_IN_USE'
      );
    }
    await category.deleteOne();
    await audit(req, { action: 'category.deleted', entity: 'Category', entityId: category._id, entityLabel: category.name });
    res.json({ success: true, message: 'Category deleted' });
  })
);

// -------------------------------------------------------------------- Units
router.get(
  '/units',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    const units = await Unit.find(filter).sort({ name: 1 });
    const usage = await Product.aggregate([{ $group: { _id: '$unit', count: { $sum: 1 } } }]);
    const map = new Map(usage.map((u) => [String(u._id), u.count]));
    res.json({
      success: true,
      data: units.map((u) => ({ ...u.toObject(), productCount: map.get(String(u._id)) || 0 })),
    });
  })
);

router.get(
  '/units/catalog',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: UNIT_CATALOG });
  })
);

router.post(
  '/units',
  requirePermission('units.manage'),
  body('code').trim().notEmpty().withMessage('Unit code is required'),
  body('name').trim().notEmpty().withMessage('Unit name is required'),
  body('dimension').trim().notEmpty().withMessage('Unit dimension is required'),
  validate,
  asyncHandler(async (req, res) => {
    const { code, name, nameAm, type, dimension, baseFactor, loadQuantity } = req.body;
    const existing = await Unit.findOne({ code: code.toUpperCase() });
    if (existing) throw ApiError.conflict('This unit code already exists', 'DUPLICATE_UNIT');
    const unit = await Unit.create({
      code: code.toUpperCase(),
      name,
      nameAm: nameAm || '',
      type: type || UNIT_TYPES.COUNT,
      dimension,
      baseFactor: baseFactor || 1,
      loadQuantity: loadQuantity ?? null,
    });
    await audit(req, { action: 'unit.created', entity: 'Unit', entityId: unit._id, entityLabel: unit.name });
    res.status(201).json({ success: true, data: unit });
  })
);

router.patch(
  '/units/:id',
  requirePermission('units.manage'),
  validate,
  asyncHandler(async (req, res) => {
    const unit = await Unit.findById(req.params.id);
    if (!unit) throw ApiError.notFound('Unit not found');
    const { name, nameAm, baseFactor, loadQuantity, active, dimension, type } = req.body;
    if (name !== undefined) unit.name = name;
    if (nameAm !== undefined) unit.nameAm = nameAm;
    if (baseFactor !== undefined) unit.baseFactor = baseFactor;
    if (loadQuantity !== undefined) unit.loadQuantity = loadQuantity;
    if (active !== undefined) unit.active = active;
    if (dimension !== undefined) unit.dimension = dimension;
    if (type !== undefined) unit.type = type;
    await unit.save();
    res.json({ success: true, data: unit });
  })
);

/**
 * Unit conversion helper. Only conversions inside the same physical dimension
 * are allowed (mass <-> mass, length <-> length, ...) so unrelated units
 * (e.g. litre -> kilogram) are rejected.
 */
router.get(
  '/units/convert',
  asyncHandler(async (req, res) => {
    const { from, to, quantity = 1 } = req.query;
    const [fromUnit, toUnit] = await Promise.all([Unit.findOne({ code: String(from).toUpperCase() }), Unit.findOne({ code: String(to).toUpperCase() })]);
    if (!fromUnit || !toUnit) throw ApiError.notFound('Unknown unit');
    if (fromUnit.dimension !== toUnit.dimension) {
      throw ApiError.badRequest(
        `Cannot convert ${fromUnit.name} to ${toUnit.name} — they measure different things.`,
        'INCOMPATIBLE_UNITS'
      );
    }
    const result = (Number(quantity) * fromUnit.baseFactor) / toUnit.baseFactor;
    res.json({
      success: true,
      data: {
        from: fromUnit.code,
        to: toUnit.code,
        dimension: fromUnit.dimension,
        quantity: Number(quantity),
        converted: Number(result.toFixed(6)),
      },
    });
  })
);

// ----------------------------------------------------------------- Products
router.get(
  '/',
  requirePermission('products.view'),
  asyncHandler(async (req, res) => {
    const { search, category, branch, status, page = 1, limit = 25, sort = 'name', order = 'asc' } = req.query;
    const filter = {};

    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [{ name: rx }, { nameAm: rx }, { sku: rx }, { barcode: rx }, { brand: rx }];
    }
    if (category && category !== 'all') filter.category = category;
    if (status === 'low_stock') filter.$expr = { $and: [{ $gt: ['$minStock', 0] }, { $lte: ['$totalStock', '$minStock'] }] };
    else if (status === 'out_of_stock') filter.totalStock = { $lte: 0 };
    else if (status === 'in_stock') filter.$expr = { $or: [{ $lte: ['$minStock', 0] }, { $gt: ['$totalStock', '$minStock'] }] };
    else if (status === 'active') filter.active = true;
    else if (status === 'inactive') filter.active = false;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const sortField = ['name', 'sku', 'totalStock', 'totalStockValue', 'sellingPrice', 'purchaseCost', 'createdAt'].includes(sort)
      ? sort
      : 'name';
    const sortDir = order === 'desc' ? -1 : 1;

    let products = await Product.find(filter)
      .populate('category', 'name nameAm color')
      .populate('unit', 'code name nameAm type dimension baseFactor')
      .populate('preferredSupplier', 'name')
      .sort({ [sortField]: sortDir })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean({ virtuals: true });

    if (branch && branch !== 'all') {
      const rows = await ProductStock.find({ branch, product: { $in: products.map((p) => p._id) } }).lean();
      const map = new Map(rows.map((r) => [String(r.product), r]));
      products = products.map((p) => {
        const row = map.get(String(p._id));
        return { ...p, branchQuantity: row?.quantity ?? 0, branchValue: row?.totalValue ?? 0, branchAverageCost: row?.averageCost ?? 0 };
      });
    }

    const total = await Product.countDocuments(filter);
    res.json({
      success: true,
      data: products,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  })
);

router.get(
  '/:id',
  requirePermission('products.view'),
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw ApiError.notFound('Product not found');
    const product = await Product.findById(req.params.id)
      .populate('category', 'name nameAm color')
      .populate('unit', 'code name nameAm type dimension baseFactor loadQuantity')
      .populate('preferredSupplier', 'name nameAm phone')
      .lean({ virtuals: true });
    if (!product) throw ApiError.notFound('Product not found');
    const stock = await ProductStock.find({ product: product._id }).populate('branch', 'name code nameAm').lean();
    res.json({ success: true, data: { ...product, stockByBranch: stock } });
  })
);

router.post(
  '/',
  requirePermission('products.create'),
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU / product code is required'),
  body('category').isMongoId().withMessage('Select a valid category'),
  body('unit').isMongoId().withMessage('Select a valid unit'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  body('purchaseCost').optional().isFloat({ min: 0 }).withMessage('Purchase cost must be a positive number'),
  body('minStock').optional().isFloat({ min: 0 }),
  validate,
  asyncHandler(async (req, res) => {
    const { name, nameAm, sku, barcode, category, brand, unit, purchaseCost = 0, sellingPrice, minStock = 0, reorderQuantity = 0, preferredSupplier, storageLocation, image, taxRate = 0, taxable = false, description = '' } = req.body;

    const normalizedSku = sku.toUpperCase();
    if (await Product.exists({ sku: normalizedSku })) {
      throw ApiError.conflict(`Product code "${normalizedSku}" already exists`, 'DUPLICATE_SKU');
    }
    const [categoryDoc, unitDoc] = await Promise.all([Category.findById(category), Unit.findById(unit)]);
    if (!categoryDoc) throw ApiError.badRequest('Selected category does not exist', 'INVALID_CATEGORY');
    if (!unitDoc) throw ApiError.badRequest('Selected unit does not exist', 'INVALID_UNIT');

    const product = await Product.create({
      name,
      nameAm: nameAm || '',
      sku: normalizedSku,
      barcode: barcode || '',
      category,
      brand: brand || '',
      unit,
      purchaseCost,
      sellingPrice,
      minStock,
      reorderQuantity,
      preferredSupplier: preferredSupplier || null,
      storageLocation: storageLocation || '',
      image: image || '',
      taxRate,
      taxable,
      description,
    });
    await audit(req, { action: 'product.created', entity: 'Product', entityId: product._id, entityLabel: `${product.name} (${product.sku})` });
    res.status(201).json({ success: true, data: product });
  })
);

router.patch(
  '/:id',
  requirePermission('products.update'),
  validate,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const fields = ['name', 'nameAm', 'barcode', 'brand', 'purchaseCost', 'sellingPrice', 'minStock', 'reorderQuantity', 'storageLocation', 'image', 'taxRate', 'taxable', 'description', 'active'];
    for (const field of fields) if (req.body[field] !== undefined) product[field] = req.body[field];
    if (req.body.category) product.category = req.body.category;
    if (req.body.unit) product.unit = req.body.unit;
    if (req.body.preferredSupplier !== undefined) product.preferredSupplier = req.body.preferredSupplier || null;
    if (req.body.sku) {
      const sku = String(req.body.sku).toUpperCase();
      if (sku !== product.sku && (await Product.exists({ sku }))) {
        throw ApiError.conflict(`Product code "${sku}" already exists`, 'DUPLICATE_SKU');
      }
      product.sku = sku;
    }
    await product.save();
    await audit(req, { action: 'product.updated', entity: 'Product', entityId: product._id, entityLabel: product.name, details: req.body });
    res.json({ success: true, data: product });
  })
);

router.delete(
  '/:id',
  requirePermission('products.delete'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const movementCount = await ProductStock.countDocuments({ product: product._id, quantity: { $gt: 0 } });
    if (movementCount > 0) {
      product.active = false;
      await product.save();
      await audit(req, { action: 'product.deactivated', entity: 'Product', entityId: product._id, entityLabel: product.name });
      return res.json({ success: true, message: 'Product has stock history so it was deactivated instead of deleted.', data: product });
    }
    await product.deleteOne();
    await audit(req, { action: 'product.deleted', entity: 'Product', entityId: product._id, entityLabel: product.name });
    res.json({ success: true, message: 'Product deleted' });
  })
);

/** Quick lookup for sales / purchase entry screens. */
router.get(
  '/lookup/barcode/:code',
  requirePermission('products.view'),
  asyncHandler(async (req, res) => {
    const code = escapeRegex(String(req.params.code).trim());
    const product = await Product.findOne({ $or: [{ barcode: code }, { sku: code }] })
      .populate('unit', 'code name nameAm')
      .populate('category', 'name');
    if (!product) throw ApiError.notFound('No product matches that code');
    res.json({ success: true, data: product });
  })
);

/** Low stock / out of stock listing with suggested reorder quantity. */
router.get(
  '/alerts/low-stock',
  requirePermission('products.view'),
  asyncHandler(async (req, res) => {
    const { branch, category } = req.query;
    const match = { active: true, minStock: { $gt: 0 }, $expr: { $lte: ['$totalStock', '$minStock'] } };
    if (category && category !== 'all') match.category = category;

    let products = await Product.find(match)
      .populate('category', 'name nameAm color')
      .populate('unit', 'code name nameAm')
      .populate('preferredSupplier', 'name nameAm phone')
      .sort({ totalStock: 1 })
      .lean({ virtuals: true });

    if (branch && branch !== 'all') {
      const rows = await ProductStock.find({ branch, product: { $in: products.map((p) => p._id) } }).lean();
      const map = new Map(rows.map((r) => [String(r.product), r]));
      products = products.map((p) => {
        const row = map.get(String(p._id));
        return {
          ...p,
          branchQuantity: row?.quantity ?? 0,
          status: (row?.quantity ?? 0) <= 0 ? 'out_of_stock' : 'low_stock',
        };
      });
    }

    const withSuggestion = products.map((p) => ({
      ...p,
      suggestedOrder: p.reorderQuantity > 0 ? p.reorderQuantity : Math.max(0, p.minStock * 2 - (p.branchQuantity ?? p.totalStock)),
    }));
    res.json({ success: true, data: withSuggestion });
  })
);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default router;
export { escapeRegex };
