/**
 * Seeds a realistic BuildStock Ethiopia dataset.
 * Run with: npm run seed   (from the server folder)
 */
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from '../config/db.js';
import env from '../config/env.js';
import { Settings } from '../models/Settings.js';
import { Branch } from '../models/Branch.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Unit, UNIT_CATALOG } from '../models/Unit.js';
import { Product } from '../models/Product.js';
import { Supplier } from '../models/Supplier.js';
import { Customer } from '../models/Customer.js';
import { Sale } from '../models/Sale.js';
import { Purchase } from '../models/Purchase.js';
import { Expense } from '../models/Expense.js';
import { Payment } from '../models/Payment.js';
import { StockMovement } from '../models/StockMovement.js';
import { ProductStock } from '../models/ProductStock.js';
import { Counter } from '../models/Counter.js';
import { Tenant } from '../models/Tenant.js';
import { setTenantContext } from '../utils/tenantScope.js';
import { recordStockIn, recordStockOut } from '../services/inventory.service.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

const CATEGORIES = [
  { name: 'Cement & Binders', nameAm: 'ሲሜንት እና ማጣፊያ', color: '#1769FF' },
  { name: 'Steel & Reinforcement', nameAm: 'ብርርክ እና አስተዋጋ ብርርክ', color: '#0B1F3A' },
  { name: 'Blocks & Masonry', nameAm: 'ድጋፍ እና ጠቅላላ', color: '#19C6D9' },
  { name: 'Aggregates & Sand', nameAm: 'ድንቦት እና አሞሌ', color: '#F59E0B' },
  { name: 'Paint & Coatings', nameAm: 'ቀለም እና ሽፋኖች', color: '#EF4444' },
  { name: 'Electrical', nameAm: 'የኤሌክትሪክ ዕቃ', color: '#8B5CF6' },
  { name: 'Plumbing & Pipes', nameAm: 'ቧንቧና ነፃስ', color: '#0EA5E9' },
  { name: 'Roofing', nameAm: 'ጫፍ ማጣፊያ', color: '#64748B' },
  { name: 'Tiles & Flooring', nameAm: 'ሰላል እና መስክር', color: '#EC4899' },
  { name: 'Doors & Windows', nameAm: 'በር እና መስክይ', color: '#14B8A6' },
  { name: 'Fasteners & Hardware', nameAm: 'ማስጣቪያና ሃርድዌር', color: '#F97316' },
  { name: 'Tools & Equipment', nameAm: 'መሣሪያና መርጃ', color: '#475569' },
];

const PRODUCTS = [
  { name: 'Cement OPC 42.5', nameAm: 'ሲሜንት OPC 42.5', sku: 'CEM-OPC-425', category: 'Cement & Binders', brand: 'Derba', unit: 'bag', cost: 640, price: 720, minStock: 200, reorder: 500 },
  { name: 'Cement OPC 42.5 (Dashen)', nameAm: 'ዳሽን ሲሜንት', sku: 'CEM-DASH-425', category: 'Cement & Binders', brand: 'Dashen', unit: 'bag', cost: 655, price: 735, minStock: 150, reorder: 400 },
  { name: 'Wall Plaster 25kg', nameAm: 'ስር ፕላስተር 25 ኪሎ', sku: 'PLT-25', category: 'Cement & Binders', brand: 'Sureru', unit: 'bag', cost: 480, price: 560, minStock: 40, reorder: 100 },
  { name: 'Portland Cement 50kg', nameAm: 'ከረብ ሲሜንት 50 ኪሎ', sku: 'CEM-50KG', category: 'Cement & Binders', brand: 'Amhara', unit: 'bag', cost: 950, price: 1080, minStock: 60, reorder: 150 },
  { name: 'Reinforcement Bar D12', nameAm: 'የሆቀረብ ብርርክ D12', sku: 'RB-D12', category: 'Steel & Reinforcement', brand: 'MIDROC', unit: 'kg', cost: 92, price: 108, minStock: 3000, reorder: 8000 },
  { name: 'Reinforcement Bar D16', nameAm: 'የሆቀረብ ብርርክ D16', sku: 'RB-D16', category: 'Steel & Reinforcement', brand: 'MIDROC', unit: 'kg', cost: 90, price: 106, minStock: 2500, reorder: 6000 },
  { name: 'Steel Sheet Roofing 0.5mm', nameAm: 'የትንፍል ሳሪል 0.5mm', sku: 'SHR-05', category: 'Roofing', brand: 'Local', unit: 'sqm', cost: 310, price: 380, minStock: 80, reorder: 200 },
  { name: 'Corrugated Roof Sheet 0.4mm', nameAm: 'የጨርሹ ራፍ ሳሪል', sku: 'CRS-04', category: 'Roofing', brand: 'Local', unit: 'sqm', cost: 250, price: 310, minStock: 100, reorder: 250 },
  { name: 'Hollow Block 6 inch', nameAm: 'የውስጥ ድጋፍ 6 ኢንች', sku: 'HB-06', category: 'Blocks & Masonry', brand: 'Local', unit: 'pcs', cost: 45, price: 60, minStock: 300, reorder: 1000 },
  { name: 'Hollow Block 8 inch', nameAm: 'የውስጥ ድጋፍ 8 ኢንች', sku: 'HB-08', category: 'Blocks & Masonry', brand: 'Local', unit: 'pcs', cost: 62, price: 80, minStock: 250, reorder: 800 },
  { name: 'Concrete Block 10 inch', nameAm: 'የጾታ ድጋፍ 10 ኢንች', sku: 'CB-10', category: 'Blocks & Masonry', brand: 'Local', unit: 'pcs', cost: 78, price: 98, minStock: 200, reorder: 600 },
  { name: 'Sand (River / Construction)', nameAm: 'አሞሌ', sku: 'AG-SAND', category: 'Aggregates & Sand', brand: '', unit: 'cbm', cost: 380, price: 480, minStock: 20, reorder: 50 },
  { name: 'Gravel 5-15mm', nameAm: 'ድንቦት', sku: 'AG-GRAVEL', category: 'Aggregates & Sand', brand: '', unit: 'cbm', cost: 450, price: 560, minStock: 15, reorder: 40 },
  { name: 'Crushed Stone 1-3cm', nameAm: 'የተበረጠ ድንቦት', sku: 'AG-STONE', category: 'Aggregates & Sand', brand: '', unit: 'cbm', cost: 520, price: 650, minStock: 10, reorder: 30 },
  { name: 'Emulsion Paint White 20L', nameAm: 'ነጭ ኢሙልሽን ቀለም 20 ሊትር', sku: 'PNT-EMP-W20', category: 'Paint & Coatings', brand: 'Sheba', unit: 'ltr', cost: 2400, price: 2900, minStock: 8, reorder: 20 },
  { name: 'Enamel Paint Blue 1L', nameAm: 'ነጭ ኤናሌል ቀለም ሰማያዊ 1 ሊትር', sku: 'PNT-ENA-B1', category: 'Paint & Coatings', brand: 'Sheba', unit: 'ltr', cost: 380, price: 470, minStock: 12, reorder: 30 },
  { name: 'Waterproof Paint 20kg', nameAm: 'የውሃ መከላከያ ቀለም 20 ኪሎ', sku: 'PNT-WPF-20', category: 'Paint & Coatings', brand: 'Sureru', unit: 'bag', cost: 1450, price: 1750, minStock: 6, reorder: 15 },
  { name: 'Brush 4 inch', nameAm: 'ቅንጭ 4 ኢንች', sku: 'TOL-BRS-4', category: 'Tools & Equipment', brand: 'Local', unit: 'pcs', cost: 90, price: 130, minStock: 15, reorder: 40 },
  { name: 'Electrical Cable 2.5mm² (100m)', nameAm: 'የኤሌክትሪክ ኬብል 2.5mm (100 ሜ)', sku: 'CBL-25-100', category: 'Electrical', brand: 'Ethiopian Cable', unit: 'roll', cost: 1950, price: 2350, minStock: 6, reorder: 15 },
  { name: 'Electrical Cable 4mm² (100m)', nameAm: 'የኤሌክትሪክ ኬብል 4mm (100 ሜ)', sku: 'CBL-40-100', category: 'Electrical', brand: 'Ethiopian Cable', unit: 'roll', cost: 2950, price: 3450, minStock: 5, reorder: 12 },
  { name: 'Switch & Socket Plate', nameAm: 'ስዊችና ሶኬት ፕሌት', sku: 'EL-SWT-01', category: 'Electrical', brand: 'Schneider', unit: 'pcs', cost: 145, price: 190, minStock: 20, reorder: 60 },
  { name: 'LED Bulb 9W', nameAm: 'LED ብልር 9 ዋት', sku: 'EL-LED-9', category: 'Electrical', brand: 'Local', unit: 'pcs', cost: 65, price: 95, minStock: 30, reorder: 80 },
  { name: 'PVC Pipe 1/2 inch (6m)', nameAm: 'ፒቪሲ አጠዓይያ 1/2 (6 ሜ)', sku: 'PVC-12-6', category: 'Plumbing & Pipes', brand: 'Local', unit: 'pcs', cost: 210, price: 265, minStock: 15, reorder: 50 },
  { name: 'PVC Pipe 4 inch (6m)', nameAm: 'ፒቪሲ አጠዓይያ 4 (6 ሜ)', sku: 'PVC-40-6', category: 'Plumbing & Pipes', brand: 'Local', unit: 'pcs', cost: 720, price: 860, minStock: 8, reorder: 25 },
  { name: 'Water Tank 500L', nameAm: 'የውሃ ታንክ 500 ሊትር', sku: 'PLT-TNK-500', category: 'Plumbing & Pipes', brand: 'Local', unit: 'pcs', cost: 1450, price: 1750, minStock: 5, reorder: 12 },
  { name: 'Ceramic Floor Tile 60x60', nameAm: 'የሰላል ፎሎር ሰላል 60x60', sku: 'TIL-6060', category: 'Tiles & Flooring', brand: 'Local', unit: 'box', cost: 620, price: 750, minStock: 20, reorder: 60 },
  { name: 'Wall Tile 30x60', nameAm: 'የጋይ ሰላል 30x60', sku: 'TIL-3060', category: 'Tiles & Flooring', brand: 'Local', unit: 'box', cost: 480, price: 590, minStock: 15, reorder: 45 },
  { name: 'Steel Door Frame 90x200', nameAm: 'የብርርክ በር መስፈር 90x200', sku: 'DOR-9020', category: 'Doors & Windows', brand: 'Local', unit: 'pcs', cost: 5200, price: 6200, minStock: 2, reorder: 6 },
  { name: 'Aluminium Window 120x100', nameAm: 'የአሉሙሪያም መስክይ 120x100', sku: 'WIN-AL-1210', category: 'Doors & Windows', brand: 'Local', unit: 'pcs', cost: 3800, price: 4600, minStock: 2, reorder: 5 },
  { name: 'Common Nail 4 inch (25kg)', nameAm: 'ጠቅላል ገጠም 4 ኢንች 25 ኪሎ', sku: 'NAI-04-25', category: 'Fasteners & Hardware', brand: 'Local', unit: 'bag', cost: 1250, price: 1450, minStock: 8, reorder: 20 },
  { name: 'WIRE NAIL 3 inch (25kg)', nameAm: 'ዋር ገጠም 3 ኢንች 25 ኪሎ', sku: 'NAI-03-25', category: 'Fasteners & Hardware', brand: 'Local', unit: 'bag', cost: 1180, price: 1380, minStock: 6, reorder: 18 },
  { name: 'Hinge 4 inch', nameAm: 'ምርጫ 4 ኢንች', sku: 'HDG-04', category: 'Fasteners & Hardware', brand: 'Local', unit: 'pcs', cost: 65, price: 90, minStock: 25, reorder: 70 },
  { name: 'Padlock 50mm', nameAm: 'ጣሪያ 50mm', sku: 'HDL-50', category: 'Fasteners & Hardware', brand: 'Local', unit: 'pcs', cost: 180, price: 240, minStock: 10, reorder: 30 },
  { name: 'Wheelbarrow', nameAm: 'የአሽከርካሪ መጫጠሪያ', sku: 'TOL-WBR', category: 'Tools & Equipment', brand: 'Local', unit: 'pcs', cost: 2100, price: 2650, minStock: 3, reorder: 8 },
  { name: 'Shovel', nameAm: 'ካስ', sku: 'TOL-SHV', category: 'Tools & Equipment', brand: 'Local', unit: 'pcs', cost: 320, price: 410, minStock: 6, reorder: 15 },
  { name: 'Wheelbarrow Cement Mixer 200L', nameAm: 'የሲሜንት ማቀናጠሪያ 200 ሊትር', sku: 'TOL-MIX-200', category: 'Tools & Equipment', brand: 'Local', unit: 'pcs', cost: 14500, price: 17500, minStock: 1, reorder: 3 },
];

const SUPPLIERS = [
  { name: 'MIDROC Ethiopia PLC', nameAm: 'ሚድሮክ ኢትዮጵያ ፕሌች', contactPerson: 'Abebe Bekele', phone: '+251911234567', city: 'Addis Ababa', paymentTerms: '30 days credit' },
  { name: 'Derba Cement Factory', nameAm: 'ደርባ ሲሜንት ፋብሪካ', contactPerson: 'Marta Tesfaye', phone: '+251912345678', city: 'Bahir Dar', paymentTerms: 'Advance 30%' },
  { name: 'Sheba Paints PLC', nameAm: 'ሸባ ቀለሞች ፕሌች', contactPerson: 'Sara Girma', phone: '+251913456789', city: 'Addis Ababa', paymentTerms: '15 days credit' },
  { name: 'Ethiopian Cable Factory', nameAm: 'የኢትዮጵያ ኬብል ፋብሪካ', contactPerson: 'Yonas Alemayehu', phone: '+251914567890', city: 'Adama', paymentTerms: 'Cash on delivery' },
  { name: 'Addis Building Materials Trading', nameAm: 'አዲስ የሕንፃ ግብዓት ግምን', contactPerson: 'Dawit Fikru', phone: '+251915678901', city: 'Addis Ababa', paymentTerms: 'Cash on delivery' },
];

const CUSTOMERS = [
  { name: 'Walk-in Customer', nameAm: 'ራስ-ኢን ደንበኛ', category: 'retail', phone: '', creditLimit: 0 },
  { name: 'Tana Construction PLC', nameAm: 'ታና ግንበራ ፕሌች', category: 'construction_company', phone: '+251911000111', creditLimit: 250000, city: 'Addis Ababa' },
  { name: 'Mesfin Contractor', nameAm: 'መስፊን ተቀባይ', category: 'contractor', phone: '+251911222333', creditLimit: 80000, city: 'Bahir Dar' },
  { name: 'Blue Nile Hardware Store', nameAm: 'ንግሥቱ ወንዝ ሃርድዌር', category: 'wholesale', phone: '+251911444555', creditLimit: 120000, city: 'Adama' },
  { name: 'Habesha Builders', nameAm: 'ሐበሻ ተቀባዮች', category: 'contractor', phone: '+251911666777', creditLimit: 50000, city: 'Adama' },
  { name: 'City of Adama Works', nameAm: 'የአዳማ ከተማ ትምህርት', category: 'government', phone: '+251911888999', creditLimit: 300000, city: 'Adama' },
];

export async function seedDatabase({ force = false } = {}) {
  await connectDatabase();
  // eslint-disable-next-line no-console
  console.log('[seed] preparing data...');

  if (force) {
    await mongoose.connection.dropDatabase();
    // eslint-disable-next-line no-console
    console.log('[seed] database dropped.');
  }

  // Create a seed tenant so all seeded documents are tenant-scoped
  let tenant = await Tenant.findOne({ subdomain: 'buildstock' });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'BuildStock Ethiopia',
      nameAm: 'ቢልድስቶክ ኢትዮጵያ',
      subdomain: 'buildstock',
      status: 'active',
      active: true,
      currency: 'ETB',
      currencySymbol: 'ETB',
      locale: 'en',
      timezone: 'Africa/Addis_Ababa',
    });
  }
  setTenantContext(tenant._id);

  // Settings
  const settings = await Settings.findOneAndUpdate(
    { tenantId: tenant._id },
    {
      $set: {
        tenantId: tenant._id,
        businessName: 'BuildStock Ethiopia',
        businessNameAm: 'ቢልድስቶክ ኢትዮጵያ',
        tagline: 'Smart Inventory Management for Construction Material Businesses.',
        address: 'Bole Road, Bole, Addis Ababa, Ethiopia',
        phone: '+251 11 555 0123',
        email: 'info@buildstock.et',
        taxId: '000-123-456',
        currency: 'ETB',
        locale: 'en',
        timezone: 'Africa/Addis_Ababa',
        ethiopicCalendar: true,
        taxEnabled: true,
        taxType: 'vat',
        taxRate: 15,
        invoiceNumberFormat: 'INV-{YYYY}-{0000}',
        purchaseNumberFormat: 'PO-{YYYY}-{0000}',
        receiptNumberFormat: 'RCP-{YYYY}-{0000}',
        movementNumberFormat: 'MOV-{YYYY}-{0000}',
        lowStockDefault: 10,
        defaultPaymentMethods: ['cash', 'bank_transfer', 'mobile_money', 'cheque'],
        receiptFooter: 'Thank you for your business! Goods sold are not returnable after 7 days.',
      },
    },
    { upsert: true, new: true }
  );

  // Branch
  let branch = await Branch.findOne({ code: 'MAIN' });
  if (!branch) {
    branch = await Branch.create({
      name: 'Main Branch',
      nameAm: 'ዋና ቅርንጫ',
      code: 'MAIN',
      address: 'Bole Road, Bole, Addis Ababa',
      phone: '+251 11 555 0123',
      isDefault: true,
    });
  }
  settings.defaultBranch = branch._id;
  await settings.save();

  let secondBranch = await Branch.findOne({ code: 'ADAMA' });
  if (!secondBranch) {
    secondBranch = await Branch.create({
      name: 'Adama Branch',
      nameAm: 'አዳማ ቅርንጫ',
      code: 'ADAMA',
      address: 'Main Road, Adama',
      phone: '+251 11 555 0456',
      isDefault: false,
    });
  }

  // Users
  const users = {};
  const userDefs = [
    { key: 'owner', name: env.seedOwner.name, email: env.seedOwner.email, password: env.seedOwner.password, role: 'owner' },
    { key: 'manager', name: 'Selam Bekele', email: 'manager@buildstock.et', password: 'BuildStock@2024', role: 'manager' },
    { key: 'clerk', name: 'Dawit Worku', email: 'clerk@buildstock.et', password: 'BuildStock@2024', role: 'sales_clerk' },
    { key: 'storekeeper', name: 'Mekdes Haile', email: 'storekeeper@buildstock.et', password: 'BuildStock@2024', role: 'storekeeper' },
    { key: 'accountant', name: 'Kalkidan Ayele', email: 'accountant@buildstock.et', password: 'BuildStock@2024', role: 'accountant' },
  ];

  // Create platform admin if not exists
  let platformAdmin = await User.findOne({ email: 'admin@buildstock.et' });
  if (!platformAdmin) {
    platformAdmin = await User.create({
      name: 'Platform Administrator',
      email: 'admin@buildstock.et',
      password: 'Admin@123456',
      role: 'owner',
      isPlatformAdmin: true,
      tenantId: null,
      active: true,
    });
    console.log('[seed] Created platform admin: admin@buildstock.et / Admin@123456');
  }
  for (const def of userDefs) {
    let user = await User.findOne({ email: def.email });
    if (!user) {
      user = await User.create({
        name: def.name,
        email: def.email,
        password: def.password,
        role: def.role,
        branch: branch._id,
        active: true,
        tenantId: tenant._id,
      });
    }
    users[def.key] = user;
  }

  // ... rest of seed script continues ...
  // (Categories, Units, Products, Suppliers, Customers, Sales, Purchases, etc.)
  // All Model.create() calls will get tenantId from the save hook automatically

  // Categories
  const categoryDocs = {};
  for (const cat of CATEGORIES) {
    let doc = await Category.findOne({ name: cat.name });
    if (!doc) {
      doc = await Category.create({ ...cat, tenantId: tenant._id });
    }
    categoryDocs[cat.name] = doc;
  }

  // Units
  const unitDocs = {};
  for (const item of UNIT_CATALOG) {
    let doc = await Unit.findOne({ code: item.code });
    if (!doc) {
      doc = await Unit.create({ ...item, tenantId: tenant._id });
    }
    unitDocs[item.code] = doc;
  }

  // Products
  const productDocs = {};
  for (const p of PRODUCTS) {
    const cat = categoryDocs[p.category];
    const unit = unitDocs[p.unit];
    let doc = await Product.findOne({ sku: p.sku });
    if (!doc) {
      doc = await Product.create({
        ...p,
        category: cat._id,
        unit: unit._id,
        tenantId: tenant._id,
      });
    }
    productDocs[p.sku] = doc;
  }

  // Suppliers
  const supplierDocs = {};
  for (const s of SUPPLIERS) {
    let doc = await Supplier.findOne({ name: s.name });
    if (!doc) {
      doc = await Supplier.create({ ...s, tenantId: tenant._id });
    }
    supplierDocs[s.name] = doc;
  }

  // Customers
  const customerDocs = {};
  for (const c of CUSTOMERS) {
    let doc = await Customer.findOne({ name: c.name });
    if (!doc) {
      doc = await Customer.create({ ...c, tenantId: tenant._id, branch: branch._id });
    }
    customerDocs[c.name] = doc;
  }

  // Counters
  await Counter.create({ key: 'sale', tenantId: tenant._id, seq: 0 });
  await Counter.create({ key: 'purchase', tenantId: tenant._id, seq: 0 });
  await Counter.create({ key: 'receipt', tenantId: tenant._id, seq: 0 });
  await Counter.create({ key: 'movement', tenantId: tenant._id, seq: 0 });

  // Imports for transactional seeding
  const { createSale } = await import('../services/sales.service.js');
  const { createPurchase } = await import('../services/purchases.service.js');
  const { nextNumber } = await import('../models/Counter.js');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const productList = Object.values(productDocs);
  const clerk = users.clerk;
  const storekeeper = users.storekeeper;

  // --- Purchases first (to stock inventory) ---
  const purchases = [];
  for (let i = 0; i < 15; i++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (15 - i));
    const supplier = supplierDocs[Object.keys(supplierDocs)[i % Object.keys(supplierDocs).length]];
    const numItems = Math.floor(Math.random() * 4) + 2;
    const items = [];
    for (let j = 0; j < numItems; j++) {
      const prod = productList[Math.floor(Math.random() * productList.length)];
      const qty = Math.floor(Math.random() * 20) + 5;
      items.push({ product: prod._id, quantity: qty, unitPrice: prod.cost, discountType: 'none', discountValue: 0 });
    }
    const purchase = await createPurchase({ user: storekeeper, tenantId: tenant._id, branch: branch._id }, {
      items,
      supplier: supplier._id,
      date: date.toISOString(),
    });
    purchases.push(purchase.purchase);
  }

  // --- Create stock positions directly for all products ---
  for (const p of PRODUCTS) {
    const prod = productDocs[p.sku];
    await ProductStock.create({
      tenantId: tenant._id,
      product: prod._id,
      branch: branch._id,
      quantity: 500,
      averageCost: p.cost,
      totalValue: p.cost * 500,
      lastMovementAt: today,
    });
  }

  // --- Sales (now that inventory exists) ---
  const sales = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (12 - i));
    const customer = customerDocs[Object.keys(customerDocs)[i % Object.keys(customerDocs).length]];
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    for (let j = 0; j < numItems; j++) {
      const prod = productList[Math.floor(Math.random() * productList.length)];
      const qty = Math.floor(Math.random() * 5) + 1;
      items.push({ product: prod._id, quantity: qty, unitPrice: prod.price, discountType: 'none', discountValue: 0, taxable: false });
    }
    const sale = await createSale({ user: clerk, tenantId: tenant._id, branch: branch._id }, {
      items,
      customer: customer._id,
      paidAmount: 0,
      date: date.toISOString(),
    });
    sales.push(sale.sale);
  }

  // --- Expenses ---
  const expenseCats = ['rent', 'salaries', 'electricity', 'transportation', 'maintenance', 'other'];
  for (let i = 0; i < 10; i++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (10 - i));
    await Expense.create({
      reference: `EXP-${String(i + 1).padStart(4, '0')}`,
      branch: branch._id,
      category: expenseCats[i % expenseCats.length],
      amount: Math.floor(Math.random() * 5000) + 100,
      date,
      description: 'Seed expense',
      paymentMethod: 'cash',
      paidTo: 'Vendor',
      employee: clerk._id,
      employeeName: clerk.name,
      recordedBy: clerk._id,
      receiptNumber: `RCP-${i + 1}`,
      notes: '',
      tenantId: tenant._id,
    });
  }

  // --- Payments ---
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (5 - i));
    await Payment.create({
      reference: `PAY-${String(i + 1).padStart(4, '0')}`,
      type: 'customer_receipt',
      party: customerDocs['Walk-in Customer']._id,
      partyName: 'Walk-in Customer',
      branch: branch._id,
      amount: Math.floor(Math.random() * 3000) + 500,
      method: 'cash',
      date,
      sale: sales[i]?._id || null,
      notes: '',
      recordedBy: clerk._id,
      recordedByName: clerk.name,
      tenantId: tenant._id,
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `[seed] ${await Product.countDocuments()} products, ${await Sale.countDocuments()} sales, ${await Purchase.countDocuments()} purchases`
  );
  return { tenantId: tenant._id };
}

