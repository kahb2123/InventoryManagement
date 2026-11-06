import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/User.js';

const EMAIL = String(process.env.PLATFORM_ADMIN_EMAIL || 'admin@buildstock.et').toLowerCase();
const PASSWORD = String(process.env.PLATFORM_ADMIN_PASSWORD || 'Admin@123456');
const NAME = String(process.env.PLATFORM_ADMIN_NAME || 'Platform Administrator');

async function run() {
  await connectDatabase();
  let user = await User.findOne({ email: EMAIL }).select('+password');
  if (!user) {
    user = await User.create({
      name: NAME,
      email: EMAIL,
      password: PASSWORD,
      role: 'owner',
      isPlatformAdmin: true,
      tenantId: null,
      active: true,
    });
    console.log(`[platform-admin] created ${EMAIL}`);
  } else {
    user.name = NAME;
    user.role = 'owner';
    user.isPlatformAdmin = true;
    user.tenantId = null;
    user.active = true;
    user.password = PASSWORD;
    await user.save();
    console.log(`[platform-admin] updated ${EMAIL}`);
  }
  await disconnectDatabase();
}

run().catch(async (err) => {
  console.error('[platform-admin] failed', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
