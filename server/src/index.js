import env from './config/env.js';
import { connectDatabase } from './config/db.js';
import { createApp } from './app.js';

async function bootstrap() {
  if (process.argv.includes('--seed')) {
    const { seedDatabase } = await import('./utils/seed.js');
    await seedDatabase({ force: process.argv.includes('--force') });
  }

  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  BuildStock Ethiopia API`);
    // eslint-disable-next-line no-console
    console.log(`  ➜  http://localhost:${env.port}/api/health`);
    // eslint-disable-next-line no-console
    console.log(`  ➜  env: ${env.nodeEnv}\n`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      const { disconnectDatabase } = await import('./config/db.js');
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[unhandledRejection]', reason);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
