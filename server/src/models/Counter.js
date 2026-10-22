import mongoose from 'mongoose';

/** Atomic sequence generator for human-readable document numbers. */
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(key) {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 }, $setOnInsert: { key } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

export async function nextNumber(key, format) {
  const seq = await nextSequence(key);
  const year = new Date().getUTCFullYear();
  return String(format)
    .replace('{YYYY}', String(year))
    .replace('{MM}', String(new Date().getUTCMonth() + 1).padStart(2, '0'))
    .replace('{DD}', String(new Date().getUTCDate()).padStart(2, '0'))
    .replace('{0000}', String(seq).padStart(4, '0'))
    .replace('{00000}', String(seq).padStart(5, '0'))
    .replace('{SEQ}', String(seq));
}

export default Counter;
