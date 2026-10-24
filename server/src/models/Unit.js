import mongoose from 'mongoose';
import { tenantScope } from '../utils/tenantScope.js';

export const UNIT_TYPES = {
  COUNT: 'count',
  MASS: 'mass',
  LENGTH: 'length',
  AREA: 'area',
  VOLUME: 'volume',
};

export const UNIT_CATALOG = [
  { code: 'pcs', name: 'Piece', nameAm: 'ክፍል', type: UNIT_TYPES.COUNT, dimension: 'each' },
  { code: 'bag', name: 'Bag', nameAm: 'ከረብ', type: UNIT_TYPES.COUNT, dimension: 'each' },
  { code: 'kg', name: 'Kilogram', nameAm: 'ኪሎግራም', type: UNIT_TYPES.MASS, dimension: 'mass' },
  { code: 'qt', name: 'Quintal', nameAm: 'ኩንታል', type: UNIT_TYPES.MASS, dimension: 'mass' },
  { code: 'ton', name: 'Metric ton', nameAm: 'ሚትሪክ ቶን', type: UNIT_TYPES.MASS, dimension: 'mass' },
  { code: 'm', name: 'Meter', nameAm: 'ሜትር', type: UNIT_TYPES.LENGTH, dimension: 'length' },
  { code: 'sqm', name: 'Square meter', nameAm: 'ካውሬ ሜትር', type: UNIT_TYPES.AREA, dimension: 'area' },
  { code: 'cbm', name: 'Cubic meter', nameAm: 'ካቢክ ሜትር', type: UNIT_TYPES.VOLUME, dimension: 'volume' },
  { code: 'ltr', name: 'Liter', nameAm: 'ሊትር', type: UNIT_TYPES.VOLUME, dimension: 'volume' },
  { code: 'box', name: 'Box', nameAm: 'ሳጥን', type: UNIT_TYPES.COUNT, dimension: 'each' },
  { code: 'roll', name: 'Roll', nameAm: 'ሩል', type: UNIT_TYPES.COUNT, dimension: 'each' },
  { code: 'bundle', name: 'Bundle', nameAm: 'ጥቅል', type: UNIT_TYPES.COUNT, dimension: 'each' },
  { code: 'carton', name: 'Carton', nameAm: 'ካርተን', type: UNIT_TYPES.COUNT, dimension: 'each' },
  { code: 'load', name: 'Load / Truckload', nameAm: 'ጫን', type: UNIT_TYPES.COUNT, dimension: 'each' },
];

const unitSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameAm: { type: String, trim: true, maxlength: 80, default: '' },
    type: { type: String, enum: Object.values(UNIT_TYPES), required: true },
    dimension: { type: String, required: true },
    // Base unit within the dimension, e.g. kg is base for mass; 1 ton = 1000 kg
    baseFactor: { type: Number, default: 1, min: 0.000001 },
    // Bulk materials: known quantity per vehicle load, expressed in base units
    loadQuantity: { type: Number, default: null, min: 0 },
    active: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  },
  { timestamps: true }
);

tenantScope(unitSchema);

export const Unit = mongoose.model('Unit', unitSchema);
export default Unit;

