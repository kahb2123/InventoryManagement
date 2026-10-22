import mongoose from 'mongoose';
import env from './env.js';

let memoryServer = null;

async function connectMemoryFallback() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: 'buildstock_ethiopia' },
  });
  const uri = memoryServer.getUri();
  // eslint-disable-next-line no-console
  console.warn(
    '[db] MongoDB at MONGO_URI was unreachable. Started an in-memory MongoDB.\n' +
      '[db] Data is NOT persisted. Install MongoDB and set MONGO_URI for real usage.'
  );
  return uri;
}

export async function connectDatabase() {
  // Reuse an existing connection so seeding and serving share one database.
  if (mongoose.connection.readyState === 1) {
    const { host, port, name } = mongoose.connection;
    // eslint-disable-next-line no-console
    console.log(`[db] Reusing MongoDB "${name}" at ${host}:${port}`);
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  let uri = env.mongoUri;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  } catch (error) {
    if (!env.useMemoryDbFallback) throw error;
    uri = await connectMemoryFallback();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  }

  const { host, port, name } = mongoose.connection;
  // eslint-disable-next-line no-console
  console.log(`[db] Connected to MongoDB "${name}" at ${host}:${port}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export default connectDatabase;
