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

  const existing = await Product.countDocuments();
  if (existing > 0) {
    if (!force) {
      // eslint-disable-next-line no-console
      console.log(`[seed] ${existing} products already exist. Use --force to wipe and reseed.`);
      return { skipped: true, products: existing };
    }
    await mongoose.connection.dropDatabase();
    // eslint-disable-next-line no-console
    console.log('[seed] existing data dropped.');
  }

  // Settings
  const settings = await Settings.findOneAndUpdate(
    { businessId: 'default' },
    {
      $set: {
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
      });
    }
    users[def.key] = user;
  }

  // Units
  const unitMap = {};
  for (const item of UNIT_CATALOG) {
    let unit = await Unit.findOne({ code: item.code });
    if (!unit) unit = await Unit.create({ ...item, system: true, active: true });
    unitMap[item.code] = unit;
  }

  // Categories
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    let doc = await Category.findOne({ name: cat.name });
    if (!doc) doc = await Category.create(cat);
    categoryMap[cat.name] = doc;
  }

  // Suppliers
  const supplierDocs = [];
  for (const s of SUPPLIERS) {
    let doc = await Supplier.findOne({ name: s.name });
    if (!doc) doc = await Supplier.create({ ...s, active: true });
    supplierDocs.push(doc);
  }

  // Customers
  const customerDocs = [];
  for (const c of CUSTOMERS) {
    let doc = await Customer.findOne({ name: c.name });
    if (!doc) doc = await Customer.create({ ...c, active: true, branch: branch._id });
    customerDocs.push(doc);
  }

  // Products
  const productDocs = [];
  for (const p of PRODUCTS) {
    const doc = await Product.create({
      name: p.name,
      nameAm: p.nameAm,
      sku: p.sku,
      barcode: `62${p.sku.replace(/[^0-9]/g, '').padStart(6, '0').slice(0, 6)}`,
      category: categoryMap[p.category]._id,
      brand: p.brand,
      unit: unitMap[p.unit]._id,
      purchaseCost: p.cost,
      sellingPrice: p.price,
      minStock: p.minStock,
      reorderQuantity: p.reorder,
      preferredSupplier: supplierDocs[Math.floor(Math.random() * supplierDocs.length)]._id,
      storageLocation: `Warehouse A - Rack ${1 + Math.floor(Math.random() * 8)}`,
      taxRate: 15,
      taxable: true,
      active: true,
    });
    productDocs.push(doc);
  }

  // Opening stock
  for (const product of productDocs) {
    const qty = Math.max(product.minStock * 2, Math.round(product.minStock * 2.5));
    await recordStockIn({
      product: product._id,
      branch: branch._id,
      quantity: qty,
      unitCost: product.purchaseCost,
      type: 'opening_balance',
      sourceType: 'opening_balance',
      sourceNumber: 'OPENING',
      unit: product.unit,
      unitName: unitMap[Object.keys(unitMap).find((k) => String(unitMap[k]._id) === String(product.unit))]?.name || '',
      employee: users.owner._id,
      employeeName: users.owner.name,
      reason: 'Opening balance',
      notes: 'Initial stock counted at business start',
      date: daysAgo(45),
    });
  }

  // A little stock in the second branch
  for (const product of productDocs.slice(0, 8)) {
    await recordStockIn({
      product: product._id,
      branch: secondBranch._id,
      quantity: Math.max(10, Math.round(product.minStock)),
      unitCost: product.purchaseCost,
      type: 'opening_balance',
      sourceType: 'opening_balance',
      sourceNumber: 'OPENING-ADM',
      unit: product.unit,
      unitName: '',
      employee: users.owner._id,
      employeeName: users.owner.name,
      reason: 'Opening balance',
      date: daysAgo(44),
    });
  }

  // Purchase orders
  let purchaseSeq = 0;
  let paymentSeq = 0;
  for (let d = 30; d >= 1; d -= 3) {
    const supplier = supplierDocs[d % supplierDocs.length];
    const picks = productDocs.slice((d % 5) * 3, (d % 5) * 3 + 3);
    const items = picks.map((p) => ({
      product: p._id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      unitName: '',
      orderedQuantity: Math.max(10, Math.round(p.minStock * 0.8)),
      receivedQuantity: 0,
      unitCost: p.purchaseCost,
      lineTotal: round2(Math.max(10, Math.round(p.minStock * 0.8)) * p.purchaseCost),
      branch: branch._id,
    }));
    const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
    const taxTotal = round2((subtotal * 15) / 100);
    const total = round2(subtotal + taxTotal);
    const paid = d % 2 === 0 ? total : round2(total * 0.4);
    purchaseSeq += 1;
    const purchase = await Purchase.create({
      purchaseNumber: `PO-${new Date().getFullYear()}-${String(purchaseSeq).padStart(4, '0')}`,
      branch: branch._id,
      supplier: supplier._id,
      supplierName: supplier.name,
      items,
      status: 'received',
      subtotal,
      taxTotal,
      total,
      paidAmount: paid,
      balance: round2(total - paid),
      paymentStatus: paid >= total ? 'paid' : 'partial',
      invoiceNumber: `SINV-${1000 + purchaseSeq}`,
      orderedDate: daysAgo(d),
      receivedDate: daysAgo(d - 1),
      receivedBy: users.storekeeper._id,
      receivedByName: users.storekeeper.name,
    });
    await Counter.updateOne({ key: 'purchase' }, { $max: { seq: purchaseSeq } }, { upsert: true });

    // Receive into stock
    for (const item of items) {
      await recordStockIn({
        product: item.product,
        branch: branch._id,
        quantity: item.orderedQuantity,
        unitCost: item.unitCost,
        type: 'purchase_receipt',
        sourceType: 'purchase',
        sourceId: purchase._id,
        sourceNumber: purchase.purchaseNumber,
        supplier: supplier._id,
        unit: item.unit,
        unitName: item.unitName,
        employee: users.storekeeper._id,
        employeeName: users.storekeeper.name,
        reason: 'Goods received',
        date: daysAgo(d - 1),
      });
      item.receivedQuantity = item.orderedQuantity;
    }
    await purchase.save();

    if (paid > 0) {
      paymentSeq += 1;
      await Payment.create({
        reference: `RCP-${new Date().getFullYear()}-${String(paymentSeq).padStart(4, '0')}`,
        type: 'supplier_payment',
        party: supplier._id,
        partyName: supplier.name,
        branch: branch._id,
        amount: paid,
        method: d % 3 === 0 ? 'bank_transfer' : 'cash',
        date: daysAgo(d - 2),
        purchase: purchase._id,
        recordedBy: users.accountant._id,
        recordedByName: users.accountant.name,
      });
    }
  }

  // Sales
  let saleSeq = 0;
  for (let d = 28; d >= 0; d -= 1) {    const salesCount = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < salesCount; k += 1) {
      const picks = [];
      const pickCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pickCount; i += 1) {
        const p = productDocs[Math.floor(Math.random() * productDocs.length)];
        if (!picks.find((x) => String(x.product) === String(p._id))) picks.push(p);
      }
      const customer = customerDocs[Math.floor(Math.random() * customerDocs.length)];
      const items = picks.map((p) => {
        const qty = Math.max(1, Math.round(p.minStock * 0.05) || 5);
        const unitPrice = round2(p.sellingPrice * (0.95 + Math.random() * 0.12));
        const discountType = Math.random() < 0.25 ? 'percent' : 'none';
        const discountValue = discountType === 'percent' ? [5, 10, 15][Math.floor(Math.random() * 3)] : 0;
        const gross = round2(qty * unitPrice);
        const discount = discountType === 'percent' ? round2((gross * discountValue) / 100) : 0;
        const net = round2(gross - discount);
        const tax = round2((net * 15) / 100);
        return {
          product: p._id,
          name: p.name,
          nameAm: p.nameAm,
          sku: p.sku,
          unit: p.unit,
          unitName: '',
          quantity: qty,
          unitPrice,
          unitCost: p.purchaseCost,
          discountType,
          discountValue,
          discount,
          taxRate: 15,
          tax,
          lineTotal: round2(net + tax),
          returnedQuantity: 0,
          branch: branch._id,
        };
      });
      const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
      const discountTotal = round2(items.reduce((s, i) => s + i.discount, 0));
      const taxTotal = round2(items.reduce((s, i) => s + i.tax, 0));
      const total = round2(items.reduce((s, i) => s + i.lineTotal, 0));
      const isCredit = customer.creditLimit > 0 && Math.random() < 0.45;
      const paidAmount = isCredit ? round2(total * (Math.random() < 0.5 ? 0.3 : 0)) : total;
      const balance = round2(total - paidAmount);
      saleSeq += 1;

      const sale = await Sale.create({
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(saleSeq).padStart(4, '0')}`,
        branch: branch._id,
        customer: customer._id,
        customerName: customer.name,
        customerType: balance > 0 ? 'credit' : 'cash',
        items,
        subtotal,
        discountTotal,
        taxTotal,
        total,
        costTotal: 0,
        grossProfit: 0,
        paidAmount,
        balance,
        paymentStatus: balance <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        paymentMethod: ['cash', 'bank_transfer', 'mobile_money'][Math.floor(Math.random() * 3)],
        status: 'completed',
        soldBy: users.clerk._id,
        soldByName: users.clerk.name,
        date: daysAgo(d),
      });
      await Counter.updateOne({ key: 'sale' }, { $max: { seq: saleSeq } }, { upsert: true });

      for (const item of items) {
        try {
          await recordStockOut({
            product: item.product,
            branch: branch._id,
            quantity: item.quantity,
            type: 'sale',
            sourceType: 'sale',
            sourceId: sale._id,
            sourceNumber: sale.invoiceNumber,
            customer: customer._id,
            unit: item.unit,
            unitName: item.unitName,
            employee: users.clerk._id,
            employeeName: users.clerk.name,
            reason: 'Sale',
            date: daysAgo(d),
          });
        } catch (error) {
          // Not enough stock for this sample — skip the movement, the invoice stays as a record.
          item.quantity = 0;
        }
      }

      sale.costTotal = round2(items.reduce((s, i) => s + i.unitCost * i.quantity, 0));
      sale.grossProfit = round2(subtotal - discountTotal - sale.costTotal);
      await sale.save();

      if (paidAmount > 0) {
        paymentSeq += 1;
        await Payment.create({
          reference: `RCP-${new Date().getFullYear()}-${String(paymentSeq).padStart(4, '0')}`,
          type: 'customer_receipt',
          party: customer._id,
          partyName: customer.name,
          branch: branch._id,
          amount: paidAmount,
          method: sale.paymentMethod,
          date: daysAgo(d),
          sale: sale._id,
          recordedBy: users.accountant._id,
          recordedByName: users.accountant.name,
        });
      }
    }
  }
  // Extra receipts against customer debts
  const tana = customerDocs.find((c) => c.name === 'Tana Construction PLC');
  if (tana) {
    paymentSeq += 1;
    await Payment.create({
      reference: `RCP-${new Date().getFullYear()}-${String(paymentSeq).padStart(4, '0')}`,
      type: 'customer_receipt',
      party: tana._id,
      partyName: tana.name,
      branch: branch._id,
      amount: 25000,
      method: 'bank_transfer',
      date: daysAgo(3),
      recordedBy: users.accountant._id,
      recordedByName: users.accountant.name,
      notes: 'Part payment on outstanding invoices',
    });
  }
  // Keep the shared payment counter ahead of every seeded receipt so the
  // next generated reference cannot collide with a seeded one.
  await Counter.updateOne({ key: 'payment' }, { $max: { seq: paymentSeq } }, { upsert: true });

  // Expenses
  const expenseDefs = [
    { category: 'rent', amount: 35000, description: 'Monthly shop rent', paymentMethod: 'bank_transfer', paidTo: 'Landlord' },
    { category: 'salaries', amount: 92000, description: 'Staff salaries', paymentMethod: 'bank_transfer', paidTo: 'Payroll' },
    { category: 'transportation', amount: 8500, description: 'Delivery truck fuel and maintenance', paymentMethod: 'cash', paidTo: 'Transport service' },
    { category: 'loading_unloading', amount: 4200, description: 'Loading and unloading crew', paymentMethod: 'cash', paidTo: 'Daily labour crew' },
    { category: 'electricity', amount: 6300, description: 'Utility bill', paymentMethod: 'bank_transfer', paidTo: 'EEPCO' },
    { category: 'telephone_internet', amount: 2800, description: 'Telecom and internet', paymentMethod: 'mobile_money', paidTo: 'Ethio Telecom' },
    { category: 'maintenance', amount: 5100, description: 'Warehouse repairs and tools', paymentMethod: 'cash', paidTo: 'Maintenance' },
    { category: 'utilities', amount: 1900, description: 'Water and cleaning', paymentMethod: 'cash', paidTo: 'Various' },
  ];
  let expenseSeq = 0;
  for (let m = 0; m < 3; m += 1) {
    for (const def of expenseDefs) {
      expenseSeq += 1;
      await Expense.create({
        reference: `EXP-${new Date().getFullYear()}-${String(expenseSeq).padStart(4, '0')}`,
        branch: branch._id,
        category: def.category,
        amount: round2(def.amount * (0.9 + Math.random() * 0.2)),
        date: daysAgo(m * 30 + 3),
        description: def.description,
        paymentMethod: def.paymentMethod,
        paidTo: def.paidTo,
        employee: users.owner._id,
        employeeName: users.owner.name,
        recordedBy: users.accountant._id,
      });
    }
  }
  // Expense references are generated from their own counter at runtime.
  await Counter.updateOne({ key: 'expense' }, { $max: { seq: expenseSeq } }, { upsert: true });

  // eslint-disable-next-line no-console
  console.log('[seed] complete');
  // eslint-disable-next-line no-console
  console.log(`  ${productDocs.length} products, ${supplierDocs.length} suppliers, ${customerDocs.length} customers`);
  // eslint-disable-next-line no-console
  console.log(`  ${await Sale.countDocuments()} sales, ${await Purchase.countDocuments()} purchases, ${await Expense.countDocuments()} expenses`);
  // eslint-disable-next-line no-console
  console.log(`  Owner login: ${env.seedOwner.email} / ${env.seedOwner.password}`);

  return {
    skipped: false,
    products: productDocs.length,
    suppliers: supplierDocs.length,
    customers: customerDocs.length,
    sales: await Sale.countDocuments(),
    purchases: await Purchase.countDocuments(),
    expenses: await Expense.countDocuments(),
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  seedDatabase({ force: process.argv.includes('--force') })
    .then(async (result) => {
      await mongoose.disconnect();
      process.exit(result.skipped ? 0 : 0);
    })
    .catch(async (error) => {
      // eslint-disable-next-line no-console
      console.error('[seed] failed:', error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
